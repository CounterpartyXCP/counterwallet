
function WaitingBTCPayViewModel(btcPayData) {
  /* message is a message data object from the message feed for an order_match that requires a btc pay from an address in our wallet*/
  var self = this;
  self.BTCPAY_DATA = btcPayData;
  self.now = ko.observable(new Date()); //auto updates from the parent model every minute
  
  self.expiresInNumBlocks = ko.computed(function() {
    return self.BTCPAY_DATA['matchExpireIndex'] - WALLET.networkBlockHeight();
  }, self);
  
  self.approxExpiresInTime = ko.computed(function() {
    return new Date((new Date()).getTime() + (self.expiresInNumBlocks() * APPROX_SECONDS_PER_BLOCK * 1000));
  }, self);
  
  self.displayColor = ko.computed(function() {
    if(self.approxExpiresInTime() - self.now() > 7200 * 1000) return 'bg-color-greenLight'; //> 2 hours
    if(self.approxExpiresInTime() - self.now() > 3600 * 1000) return 'bg-color-yellow'; //> 1 hour
    if(self.approxExpiresInTime() - self.now() > 1800 * 1000) return 'bg-color-orange'; //> 30 min
    return 'bg-color-red'; // < 30 min, or already expired according to our reough estimate
  }, self);
  
  self.completeBTCPay = function() {
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
                { order_match_id: self.BTCPAY_DATA['orderMatchID'] },
                function(txHash, data, endpoint) { 
                  //remove the BTC payment from the notifications
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
  self.waitingBTCPays = ko.observableArray([]);
  self.lastUpdated = ko.observable(new Date());
  
  self.dispCount = ko.computed(function() {
    return self.waitingBTCPays().length;
  }, self);

  //Every 60 seconds, run through all waitingBTCPays and update their 'now' members
  setInterval(function() {
    var now = new Date();
    for(var i=0; i < self.waitingBTCPays().length; i++) {
      self.waitingBTCPays()[i].now(now);
    }  
  }, 60 * 1000); 

  self.add = function(message, resort) {
    assert(message);
    if(typeof(resort)==='undefined') resort = true;
    self.waitingBTCPays.unshift(new WaitingBTCPayViewModel(message));
    if(resort) {
      //sort the pending BTCpays so that the entry most close to expiring is at top
      self.waitingBTCPays.sort(function(left, right) {
        return left.expiresInNumBlocks() == right.expiresInNumBlocks() ? 0 : (left.expiresInNumBlocks() < right.expiresInNumBlocks() ? -1 : 1);
      });      
    }
    self.lastUpdated(new Date());
  }
  
  self.remove = function(orderHashOrMatchHash, data) {
    //data is supplied optionally to allow us to notify the user on a failed BTCpay...it's only used when called from messagesfeed.js
    // before we work with valid messages only
    var match = ko.utils.arrayFirst(self.waitingBTCPays(), function(item) {
      if(orderHashOrMatchHash == item.BTCPAY_DATA['orderMatchID']) return true; //matched by the entire order match hash
      //otherwise try to match on a single order hash
      var orderHash1 = item.BTCPAY_DATA['orderMatchID'].substring(0, 64);
      var orderHash2 = item.BTCPAY_DATA['orderMatchID'].substring(64);
      return orderHashOrMatchHash == orderHash1 || orderHashOrMatchHash == orderHash2;
    });
    if(match) {
      self.waitingBTCPays.remove(match);
      self.lastUpdated(new Date());
    }
  }
  
  self.markAsInProgress = function(orderMatchID, btcPayTxHash) {
    //locally records a BTCpay transaction as in progress (i.e. not yet confirmed on the blockchain)
    //we add a record of this to local storage so that if the user logs out and back in again before the BTC pay is
    // confirmed, they will NOT see this BTC pay to make, since they have already made it)
    //Add to local storage so we can reload it if the user logs out and back in
    var pendingBTCPayStorage = localStorage.getObject('pendingBTCPays');
    if(pendingBTCPayStorage === null) pendingBTCPayStorage = [];
    pendingBTCPayStorage.push([orderMatchID, btcPayTxHash]);
    localStorage.setObject('pendingBTCPays', pendingBTCPayStorage);     
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

    var pendingBTCPayStorage = localStorage.getObject('pendingBTCPays');
    if(pendingBTCPayStorage === null) pendingBTCPayStorage = [];

    failoverAPI("get_order_matches", {'filters': filters, 'filterop': 'or', status: 'pending'},
      function(data, endpoint) {
        for(var i=0; i < data.length; i++) {
          var orderMatchID = data[i]['tx0_hash'] + data[i]['tx1_hash'];
          var match = $.grep(pendingBTCPayStorage, function(e) { return e[0] == orderMatchID; })[0];
          if(!match) {
            //if not already paid and awaiting confirmation, show it as a waiting BTC
            // pay, but only if we're the ones that should pay the BTC
            if(   WALLET.getAddressObj(data['tx0_address']) && data['forward_asset'] == 'BTC'
               || WALLET.getAddressObj(data['tx1_address']) && data['backward_asset'] == 'BTC') {
              var btcPayData = WaitingBTCPayFeedViewModel.makeBTCPayData(data[i]);
              WAITING_BTCPAY_FEED.add(btcPayData, i == data.length - 1);
            }
          } else {
            $.jqlog.debug("pendingBTCPay:restore:not showing (awaiting network confirmation): " + match[1]);
          }
        }
        
        if(!pendingBTCPayStorage.length) return;
        //Clear out entries in pendingBTCPays where the BTCPay itself is confirmed
        var txHashes = [];
        for(i=0; i < pendingBTCPayStorage.length; i++) {
          txHashes.push(pendingBTCPayStorage[i][1]); //btcpay txhash
        }
        
        //construct a new pending info storage object that doesn't include any hashes that we get no data back on
        var newPendingBTCPayStorage = [], pendingBTCPay = null;
        failoverAPI("get_btc_txns_status", [txHashes], function(txInfo, endpoint) {
          for(var i=0; i < txInfo.length; i++) {
            pendingBTCPay = $.grep(pendingBTCPayStorage, function(e) { return e[1] == txInfo[i]['tx_hash']; })[0];
            if(pendingBTCPay && txInfo[i]['confirmations'] == 0) { //still pending
              $.jqlog.debug("pendingBTCPay:restore:load: " + txInfo[i]['tx_hash'] + ":" + pendingBTCPay[1]);
              newPendingBTCPayStorage.push(pendingBTCPay);
            } else {
              //otherwise, do not load into pending actions, and do not include in updated pending actions list
              $.jqlog.debug("pendingBTCPay:restore:remove: " + txInfo[i]['tx_hash']);
            }
          }
          localStorage.setObject('pendingBTCPays', newPendingBTCPayStorage);
        });
      }
    );
  }
}

WaitingBTCPayFeedViewModel.makeBTCPayData = function(data) {
  //data is a pending order match object (from a data feed message received, or from a get_orders API result)
  var firstInPair = (WALLET.getAddressObj(data['tx0_address']) && data['forward_asset'] == 'BTC') ? true : false;
  if(!firstInPair) assert(WALLET.getAddressObj(data['tx1_address']) && data['backward_asset'] == 'BTC');
  
  return {
    matchExpireIndex: data['match_expire_index'],
    orderMatchID: data['tx0_hash'] + data['tx1_hash'],
    myAddr: firstInPair ? data['tx0_address'] : data['tx1_address'],
    btcDestAddr: firstInPair ? data['tx1_address'] : data['tx0_address'],
    btcQuantity: normalizeQuantity(firstInPair ? data['forward_quantity'] : data['backward_quantity'], true), //normalized
    btcQuantityRaw: firstInPair ? data['forward_quantity'] : data['backward_quantity'],
    myOrderTxIndex: firstInPair ? data['tx0_index'] : data['tx1_index'],
    otherOrderTxIndex: firstInPair ? data['tx1_index'] : data['tx0_index'],
    otherOrderAsset: firstInPair ? data['backward_asset'] : data['forward_asset'],
    otherOrderQuantity: normalizeQuantity(firstInPair ? data['backward_quantity'] : data['forward_quantity'],
      firstInPair ? data['_backward_asset_divisible'] : data['_forward_asset_divisible']), //normalized
    otherOrderQuantityRaw: firstInPair ? data['backward_quantity'] : data['forward_quantity']
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
