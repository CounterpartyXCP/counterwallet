
/* the life of a BTCpay:

* user makes order to sell BTC
* order is matched with another order (to buy BTC, in return for some other asset)
* user's order listed as an *upcoming* BTCPay for 6 blocks. Shows up in the Waiting BTCpay feed with a clock icon.
* After 6 blocks, it's "safe" for the user to make a BTCpay against the item:
   -if automatic, a create_btcpay transaction is then immediately made. item does not show up in waiting BTCpays pane
   -if manual, the user is promtped to make payment. If they say "yes, do it now", things proceed simiarly to the automatic route
   above. if they say "no, hold off" the create_btcpay transaction is made once the user chooses to make it.
   the item then shows up in the waiting BTCpay feed with an exclamation point icon, and the user must make payment
* Once the user DOES make payment (automatic or manually), the btcpay is added to the pending actions list to show that
  the BTCPay is inprogress (i.e. txn has been broadcast). (Note that if the user were to log out and back in during this time,
  we would see that the BTCpay is on the pending list and wouldn't show it as eligable to be paid.)
* Once confirmed on the network, the btcpay data is received across the message feed:
   -WaitingBTCPay is no longer marked as "inprogress". localstorage data is removed for it
   -Waiting BTCpay item is removed from waitingBTCPays
   -Notification item for this BTCPay is added to the notifications feed pane

* Basically: upcomingBTCPay -> waitingBTCPay -> pendingBTCPay -> completedBTCPay
* */
function BTCPayFeedViewModel() {
  var self = this;
  
  self.dispCount = ko.computed(function() {
    return WAITING_BTCPAY_FEED.entries().length + UPCOMING_BTCPAY_FEED.entries().length;
  }, self);
  
  self.dispLastUpdated = ko.computed(function() {
    return WAITING_BTCPAY_FEED.lastUpdated() >= UPCOMING_BTCPAY_FEED.lastUpdated() ? WAITING_BTCPAY_FEED.lastUpdated() : UPCOMING_BTCPAY_FEED.lastUpdated();
  }, self);
}


function WaitingBTCPayViewModel(btcPayData) {
  /* message is a message data object from the message feed for an order_match that requires a btc pay from an address in our wallet*/
  var self = this;
  self.BTCPAY_DATA = btcPayData;
  self.now = ko.observable(new Date()); //auto updates from the parent model every minute
  self.MATCH_EXPIRE_INDEX = self.BTCPAY_DATA['matchExpireIndex'];
  
  self.dispBTCQuantity = smartFormat(self.BTCPAY_DATA['btcQuantity']);
  self.dispMyAddr = getAddressLabel(self.BTCPAY_DATA['myAddr']);
  self.dispMyOrderTxHash = getTxHashLink(self.BTCPAY_DATA['myOrderTxHash']);
  
  self.expiresInNumBlocks = ko.computed(function() {
    return self.BTCPAY_DATA['matchExpireIndex'] - WALLET.networkBlockHeight();
  }, self);
  
  self.approxExpiresInTime = ko.computed(function() {
    return self.now().getTime() + (self.expiresInNumBlocks() * APPROX_SECONDS_PER_BLOCK * 1000);
  }, self);
  
  self.displayColor = ko.computed(function() {
    if(self.approxExpiresInTime() - self.now() > 7200 * 1000) return 'bg-color-greenLight'; //> 2 hours
    if(self.approxExpiresInTime() - self.now() > 3600 * 1000) return 'bg-color-yellow'; //> 1 hour
    if(self.approxExpiresInTime() - self.now() > 1800 * 1000) return 'bg-color-orange'; //> 30 min
    return 'bg-color-red'; // < 30 min, or already expired according to our reough estimate
  }, self);
  
  self.completeBTCPay = function() {
    //check duplicate
    if (PROCESSED_BTCPAY[btcPayData['orderMatchID']]) {
      $.jqlog.error("Attempt to make duplicate btcpay: " + btcPayData['orderMatchID']);
      return false;
    } else if (self.expiresInNumBlocks()<3) {
      $.jqlog.error("Attempt to make expired btcpay: " + btcPayData['orderMatchID']);
      return false;
    } else {
      PROCESSED_BTCPAY[btcPayData['orderMatchID']] = true;
    }

    //Pop up confirm dialog, and make BTC payment
    WALLET.retrieveBTCBalance(self.BTCPAY_DATA['myAddr'], function(balance) {
      if(balance < self.BTCPAY_DATA['btcQuantityRaw'] + MIN_PRIME_BALANCE) {
        bootbox.alert("You do not have the required <b class='notoAssetColor'>BTC</b> balance to settle this order."
          + " Please deposit more <b class='notoAssetColor'>BTC</b> into address"
          + " <b class='notoAddrColor'>" + getAddressLabel(self.BTCPAY_DATA['myAddr']) + "</b> and try again.");
        return;
      }
      
      bootbox.dialog({
        message: "Confirm a payment of <b class='notoQuantityColor'>" + self.BTCPAY_DATA['btcQuantity'] + "</b>"
          + " <b class='notoAssetColor'>BTC</b>" + " to address"
          + " <b class='notoAddrColor'>" + getAddressLabel(self.BTCPAY_DATA['btcDestAddr']) + "</b> to settle order ID"
          + " <b>" + self.BTCPAY_DATA['myOrderTxIndex'] + "</b>?",
        title: "Confirm Order Settlement (BTC Payment)",
        buttons: {
          cancel: {
            label: "Cancel",
            className: "btn-default",
            callback: function() { } //just close the dialog
          },
          confirm: {
            label: "Confirm and Pay",
            className: "btn-success",
            callback: function() {
              //complete the BTCpay. Start by getting the current BTC balance for the address
              WALLET.doTransaction(self.BTCPAY_DATA['myAddr'], "create_btcpay",
                { order_match_id: self.BTCPAY_DATA['orderMatchID'],
                  source: self.BTCPAY_DATA['myAddr'],
                  destBtcPay: self.BTCPAY_DATA['btcDestAddr']
                },
                function(txHash, data, endpoint, addressType, armoryUTx) {
                  //remove the BTC payment from the notifications (even armory tx at this point...)
                  WAITING_BTCPAY_FEED.remove(self.BTCPAY_DATA['orderMatchID']);
                }
              );
            }
          }
        }
      });
    });    
  }
}

function WaitingBTCPayFeedViewModel() {
  var self = this;
  self.entries = ko.observableArray([]);
  self.lastUpdated = ko.observable(new Date());
  
  self.entries.subscribe(function() {
    WALLET.isSellingBTC(self.entries().length + UPCOMING_BTCPAY_FEED.entries().length ? true : false);
  });

  //Every 60 seconds, run through all entries and update their 'now' members
  setInterval(function() {
    var now = new Date();
    for(var i=0; i < self.entries().length; i++) {
      self.entries()[i].now(now);
    }  
  }, 60 * 1000); 

  self.add = function(btcPayData, resort) {
    assert(btcPayData && btcPayData['orderMatchID']);
    //^ must be a BTCPayData structure, not a plain message from the feed or result from the API
    
    if(typeof(resort)==='undefined') resort = true;
    self.entries.unshift(new WaitingBTCPayViewModel(btcPayData));
    if(resort) self.sort();
    self.lastUpdated(new Date());
  }
  
  self.remove = function(orderHashOrMatchHash, data) {
    //data is supplied optionally to allow us to notify the user on a failed BTCpay...it's only used when called from messagesfeed.js
    // before we work with valid messages only
    var match = ko.utils.arrayFirst(self.entries(), function(item) {
      if(orderHashOrMatchHash == item.BTCPAY_DATA['orderMatchID']) return true; //matched by the entire order match hash
      //otherwise try to match on a single order hash
      var orderHash1 = item.BTCPAY_DATA['orderMatchID'].substring(0, 64);
      var orderHash2 = item.BTCPAY_DATA['orderMatchID'].substring(64);
      return orderHashOrMatchHash == orderHash1 || orderHashOrMatchHash == orderHash2;
    });
    if(match) {
      self.entries.remove(match);
      self.lastUpdated(new Date());
    }
  }
  
  self.sort = function() {
    //sort the pending BTCpays so that the entry most close to expiring is at top
    self.entries.sort(function(left, right) {
      return left.expiresInNumBlocks() == right.expiresInNumBlocks() ? 0 : (left.expiresInNumBlocks() < right.expiresInNumBlocks() ? -1 : 1);
    });      
  }

  self.restore = function() {
    //Get and populate any waiting BTC pays, filtering out those they are marked as in progress (i.e. are not waiting
    // for manual user payment, but waiting confirmation on the network instead -- we call these pendingBTCPays) to
    // avoid the possibility of double payment
    var addresses = WALLET.getAddressesList();
    var filters = [];
    for(var i=0; i < addresses.length; i++) {
      filters.push({'field': 'tx0_address', 'op': '==', 'value': addresses[i]});
      filters.push({'field': 'tx1_address', 'op': '==', 'value': addresses[i]});
    }

    failoverAPI("get_order_matches", {'filters': filters, 'filterop': 'or', status: 'pending'},
      function(data, endpoint) {
        $.jqlog.debug("Order matches: " + JSON.stringify(data));
        for(var i=0; i < data.length; i++) {
          //if the other party is the one that should be paying BTC for this specific order match, then skip it          
          if(   WALLET.getAddressObj(data['tx0_address']) && data['forward_asset'] == BTC
             || WALLET.getAddressObj(data['tx1_address']) && data['backward_asset'] == BTC)
             continue;
          
          //if here, we have a pending order match that we owe BTC for. 
          var orderMatchID = data[i]['tx0_hash'] + data[i]['tx1_hash'];
          
          //next step is that we need to check if it's one we have paid, but just hasn't been confirmed yet. check
          // the pendingactions feed to see if the BTCpay is pending
          var pendingBTCPay = $.grep(PENDING_ACTION_FEED.entries(), function(e) {
            return e['CATEGORY'] == 'btcpays' && e['DATA']['order_match_id'] == orderMatchID;
          })[0];
          if(pendingBTCPay) {
            $.jqlog.debug("pendingBTCPay:restore:not showing btcpay request for order match ID: " + orderMatchID);
          } else {
            //not paid yet (confirmed), nor is it a pending action
            var btcPayData = WaitingBTCPayFeedViewModel.makeBTCPayData(data[i]);            
            if (btcPayData) {
              if(WALLET.networkBlockHeight() - btcPayData['blockIndex'] < NUM_BLOCKS_TO_WAIT_FOR_BTCPAY) {
                //If the order match is younger than NUM_BLOCKS_TO_WAIT_FOR_BTCPAY blocks, then it's actually still an
                // order that should be in the upcomingBTCPay feed
                UPCOMING_BTCPAY_FEED.add(btcPayData);
              } else {
                //otherwise, if not already paid and awaiting confirmation, show it as a waiting BTCpay
                WAITING_BTCPAY_FEED.add(btcPayData);
              }
            }
          }
        }
          
        //Sort upcoming btcpay and waiting btcpay lists
        UPCOMING_BTCPAY_FEED.sort();
        WAITING_BTCPAY_FEED.sort();
      }
    );
  }
}
WaitingBTCPayFeedViewModel.makeBTCPayData = function(data) {
  //data is a pending order match object (from a data feed message received, or from a get_orders API result)
  var firstInPair = (WALLET.getAddressObj(data['tx0_address']) && data['forward_asset'] == BTC) ? true : false;
  if(!firstInPair) if (!(WALLET.getAddressObj(data['tx1_address']) && data['backward_asset'] == BTC)) return false;
  
  return {
    blockIndex: data['tx1_block_index'], //the latter block index, which is when the match was actually made
    matchExpireIndex: data['match_expire_index'],
    orderMatchID: data['tx0_hash'] + data['tx1_hash'],
    myAddr: firstInPair ? data['tx0_address'] : data['tx1_address'],
    btcDestAddr: firstInPair ? data['tx1_address'] : data['tx0_address'],
    btcQuantity: normalizeQuantity(firstInPair ? data['forward_quantity'] : data['backward_quantity'], true), //normalized
    btcQuantityRaw: firstInPair ? data['forward_quantity'] : data['backward_quantity'],
    myOrderTxIndex: firstInPair ? data['tx0_index'] : data['tx1_index'],
    myOrderTxHash: firstInPair ? data['tx0_hash'] : data['tx1_hash'],
    otherOrderTxIndex: firstInPair ? data['tx1_index'] : data['tx0_index'],
    otherOrderAsset: firstInPair ? data['backward_asset'] : data['forward_asset'],
    otherOrderQuantity: normalizeQuantity(firstInPair ? data['backward_quantity'] : data['forward_quantity'],
      firstInPair ? data['_backward_asset_divisible'] : data['_forward_asset_divisible']), //normalized
    otherOrderQuantityRaw: firstInPair ? data['backward_quantity'] : data['forward_quantity']
  }
}


function UpcomingBTCPayViewModel(btcPayData) {
  /* message is a message data object from the message feed for an order_match that requires a btc pay from an address in our wallet*/
  var self = this;
  self.BTCPAY_DATA = btcPayData;
  self.now = ko.observable(new Date()); //auto updates from the parent model every minute
  
  self.dispBTCQuantity = smartFormat(self.BTCPAY_DATA['btcQuantity']);
  self.dispMyOrderTxHash = getTxHashLink(self.BTCPAY_DATA['myOrderTxHash']);
  
  self.numBlocksUntilEligible = ko.computed(function() {
    return Math.max(NUM_BLOCKS_TO_WAIT_FOR_BTCPAY - (WALLET.networkBlockHeight() - self.BTCPAY_DATA['blockIndex']), 0);
  }, self);
  
  self.approxTimeUntilEligible = ko.computed(function() {
    return self.now().getTime() + (self.numBlocksUntilEligible() * APPROX_SECONDS_PER_BLOCK * 1000);
  }, self);
}

function UpcomingBTCPayFeedViewModel() {
  /* when an order match occurs where we owe BTC, a btcpay transaction should be made. Due to the potential of a 
   * blockchain reorg happening at any time, we delay the btcpay by 6 or so blocks so that (barring some kind of catastrophic
   * sized reorg) we're sure that by the time of the bTCpay, the user is making a payment against a real order (i.e. one
   * that won't "disappear" potentially, if there is a reorg)
   */
  var self = this;
  self.entries = ko.observableArray([]);
  self.lastUpdated = ko.observable(new Date());
  
  self.entries.subscribe(function() {
    WALLET.isSellingBTC(WAITING_BTCPAY_FEED.entries().length + self.entries().length ? true : false);
  });
  
  //Every 60 seconds, run through all entries and update their 'now' members
  setInterval(function() {
    var now = new Date();
    for(var i=0; i < self.entries().length; i++) {
      self.entries()[i].now(now);
      
      //if this btcpay is now eligible, process it
      if(self.entries()[i].numBlocksUntilEligible() == 0)
        self.process(self.entries()[i]['BTCPAY_DATA']);
    }  
  }, 60 * 1000); 

  self.add = function(btcPayData, resort) {
    assert(btcPayData && btcPayData['orderMatchID']);
    //^ must be a BTCPayData structure, not a plain message from the feed or result from the API

    if(typeof(resort)==='undefined') resort = true;
    // check duplicate
    for (var e in self.entries) {
      if (self.entries[e].BTCPAY_DATA && self.entries[e].BTCPAY_DATA['orderMatchID'] == btcPayData['orderMatchID']) {
        $.jqlog.error("Attempt to make duplicate btcpay: " + btcPayData['orderMatchID']);
        return false;
      }
    }
    self.entries.unshift(new UpcomingBTCPayViewModel(btcPayData));
    if(resort) self.sort();
    self.lastUpdated(new Date());
  }
  
  self.remove = function(orderHashOrMatchHash) {
    var match = ko.utils.arrayFirst(self.entries(), function(item) {
      if(orderHashOrMatchHash == item.BTCPAY_DATA['orderMatchID']) return true; //matched by the entire order match hash
      //otherwise try to match on a single order hash
      var orderHash1 = item.BTCPAY_DATA['orderMatchID'].substring(0, 64);
      var orderHash2 = item.BTCPAY_DATA['orderMatchID'].substring(64);
      return orderHashOrMatchHash == orderHash1 || orderHashOrMatchHash == orderHash2;
    });
    if(match) {
      self.entries.remove(match);
      self.lastUpdated(new Date());
    }
  }
  
  self.sort = function() {
    //sort the upcoming BTCpays so that the entry most close to becoming eligible is on top
    self.entries.sort(function(left, right) {
      return left.numBlocksUntilEligible() == right.numBlocksUntilEligible() ? 0 : (left.numBlocksUntilEligible() < right.numBlocksUntilEligible() ? -1 : 1);
    });
  }
  
  self.process = function(btcPayData) {
    //The btcpay required is no longer "upcoming" and a create_btcpay should be broadcast...

    //check duplicate
    if (PROCESSED_BTCPAY[btcPayData['orderMatchID']]) {
      $.jqlog.error("Attempt to make duplicate btcpay: " + btcPayData['orderMatchID']);
      return false;
    } else if (btcPayData['matchExpireIndex'] - WALLET.networkBlockHeight() < 3) {
      $.jqlog.error("Attempt to make expired btcpay: " + btcPayData['orderMatchID']);
      return false;
    } else {
      PROCESSED_BTCPAY[btcPayData['orderMatchID']] = true;
    }
    
    //remove the entry from the "upcoming" list, as it will be migrating to the "waiting" list
    self.remove(btcPayData['orderMatchID']);
        
    //If automatic BTC pays are enabled, just take care of the BTC pay right now
    if(PREFERENCES['auto_btcpay']) {

      if(WALLET.getBalance(btcPayData['myAddr'], BTC, false) >= (btcPayData['btcQuantityRaw']) + MIN_PRIME_BALANCE) {
        
         //user has the sufficient balance
        WALLET.doTransaction(btcPayData['myAddr'], "create_btcpay",
          { order_match_id: btcPayData['orderMatchID'], source: btcPayData['myAddr'], destBtcPay: btcPayData['btcDestAddr'] },
          function(txHash, data, endpoint, addressType, armoryUTx) {
            //notify the user of the automatic BTC payment
            var message = "Automatic <b class='notoAssetColor'>BTC</b> payment of "
              + "<b class='notoQuantityColor'>" + btcPayData['btcQuantity'] + "</b>"
              + " <b class='notoAssetColor'>BTC</b> made from address"
              + " <b class='notoAddrColor'>" + btcPayData['myAddr'] + "</b> for"
              + " <b class='notoQuantityColor'>" + btcPayData['otherOrderQuantity'] + "</b> "
              + " <b class='notoAssetColor'>" + btcPayData['otherOrderAsset'] + "</b>. ";
            WALLET.showTransactionCompleteDialog(message + ACTION_PENDING_NOTICE, message, armoryUTx);
          }, function() {
            WAITING_BTCPAY_FEED.add(btcPayData);
            bootbox.alert("There was an error processing an automatic <b class='notoAssetColor'>BTC</b> payment."
              + " This payment has been placed in a pending state. Please try again manually.");
          }
        );

      } else {

        //The user doesn't have the necessary balance on the address... let them know and add the BTC as pending
        WAITING_BTCPAY_FEED.add(btcPayData);
        WALLET.showTransactionCompleteDialog("A payment on a matched order for "
          + "<b class='notoQuantityColor'>" + btcPayData['btcQuantity'] + "</b>"
          + "<b class='notoAssetColor'>BTC</b> is required, however, the address that made the order ("
          + "<b class='notoAddrColor'>" + getAddressLabel(btcPayData['myAddr']) + "</b>"
          + ") lacks the balance necessary to do this automatically. This order has been placed in a pending state."
          + "<br/><br/>Please deposit the necessary <b class='notoAssetColor'>BTC</b> into this address and"
          + "manually make the payment from the Bitcoin icon in the top bar of the site.");  
      }

    } else {
      //Otherwise, prompt the user to make the BTC pay
      var prompt = "An order match for <b class='notoQuantityColor'>" + btcPayData['otherOrderQuantity'] + "</b>"
        + " <b class='notoAssetColor'>" + btcPayData['otherOrderAsset'] + "</b> was successfully made. "
        + " To finalize, this requires payment of <b class='notoQuantityColor'>"+ btcPayData['btcQuantity'] + "</b>"
        + " <b class='notoAssetColor'>BTC</b>" + " from address"
        + " <b class='notoAddressColor'>" + getAddressLabel(btcPayData['myAddr']) + "</b>."
        + "<br/><br/><b>You must pay within 10 blocks time, or lose the purchase. Pay now?</b>";          
      bootbox.dialog({
        message: prompt,
        title: "Order Settlement (BTC Pay)",
        buttons: {
          success: {
            label: "No, hold off",
            className: "btn-danger",
            callback: function() {
              //If the user says no, then throw the BTC pay in pending BTC pays
              WAITING_BTCPAY_FEED.add(btcPayData);
            }
          },
          danger: {
            label: "Yes",
            className: "btn-success",
            callback: function() {
              WALLET.doTransaction(btcPayData['myAddr'], "create_btcpay",
                { order_match_id: btcPayData['orderMatchID'], source: btcPayData['myAddr'], destBtcPay: btcPayData['btcDestAddr'] },
                function(txHash, data, endpoint, addressType, armoryUTx) {
                  //notify the user of the automatic BTC payment
                  var message = "Automatic <b class='notoAssetColor'>BTC</b> payment of"
                    + " <b class='notoQuantityColor'>" + btcPayData['btcQuantity'] + "</b> <b class='notoAssetColor'>BTC</b> "
                    + (armoryUTx ? 'to be made' : 'made') + " from address <b class='notoAddressColor'>" + getAddressLabel(btcPayData['myAddr']) + "</b>"
                    + " for <b class='notoQuantityColor'>" + btcPayData['otherOrderQuantity'] + "</b>"
                    + " <b class='notoAssetColor'>" + btcPayData['otherOrderAsset'] + "</b>. ";
                  WALLET.showTransactionCompleteDialog(message + ACTION_PENDING_NOTICE, message, armoryUTx);
                }, function() {
                  WAITING_BTCPAY_FEED.add(btcPayData);
                  bootbox.alert("There was an error processing an automatic <b class='notoAssetColor'>BTC</b> payment."
                    + "<br/><br/><b>Please manually make the payment from the Bitcoin icon in the top bar of the site.</b>");
                }
              );
            }
          },
        }
      });    
    }
  }



}


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
