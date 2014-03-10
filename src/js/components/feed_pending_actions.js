
function PendingBTCPayViewModel(orderMatchID, BTCPayTxIndex, myAddr, btcDestAddress, btcAmount, myOrderTxIndex,
  otherOrderTxIndex, otherOrderOtherAsset, otherOrderOtherAssetAmount, whenBTCPayCreated) {
  if(typeof(whenBTCPayCreated)==='undefined') whenBTCPayCreated = new Date().getTime();
  
  var self = this;
  self.orderMatchID = ko.observable(orderMatchID);
  self.BTCPayTxIndex = ko.observable(BTCPayTxIndex);
  self.myAddr = ko.observable(myAddr);
  self.btcDestAddress = ko.observable(btcDestAddress);
  self.btcAmount = ko.observable(btcAmount); //normalized
  self.myOrderTxIndex = ko.observable(myOrderTxIndex);
  self.otherOrderTxIndex = ko.observable(otherOrderTxIndex);  
  self.otherOrderOtherAsset = ko.observable(otherOrderOtherAsset);
  self.otherOrderOtherAssetAmount = ko.observable(otherOrderOtherAssetAmount);
  self.whenBTCPayCreated = ko.observable(whenBTCPayCreated); //epoch ts (in ms)
  
  self.displayColor = ko.computed(function() {
    var curTS = new Date().getTime();
    if(curTS - self.whenBTCPayCreated() > 3600 * 1000) return 'bg-color-red'; //> 1 hour
    if(curTS - self.whenBTCPayCreated() > 1800 * 1000) return 'bg-color-orange'; //> 30 min
    if(curTS - self.whenBTCPayCreated() > 900 * 1000) return 'bg-color-yellow'; //> 15 min
    return 'bg-color-greenLight';
  }, self);
  
  self.completeBTCPay = function() {
    //Pop up confirm dialog, and make BTC payment
    WALLET.retrieveBTCBalance(self.myAddr(), function(balance) {
      if(balance < (denormalizeAmount(self.btcAmount())) + MIN_PRIME_BALANCE) {
        bootbox.alert("You do not have the required BTC balance to settle this order. Please deposit more BTC into address " + self.myAddr() + " and try again.");
        return;
      }
      
      bootbox.dialog({
        message: "Confirm a payment of " + self.btcAmount() + " BTC to address " + self.btcDestAddress() + " to settle order ID " + self.origOrderTxIndex() + "?",
        title: "Confirm Order Settlement",
        buttons: {
          cancel: {
            label: "Cancel",
            className: "btn-danger",
            callback: function() {
              //just close the dialog
            }
          },
          confirm: {
            label: "Confirm and Pay",
            className: "btn-success",
            callback: function() {
              //complete the BTCpay. Start by getting the current BTC balance for the address
              WALLET.doTransaction(self.myAddr, "create_btcpay",
                { order_match_id: self.orderMatchID() },
                function() {
                  //remove the BTC payment from the notifications
                  PENDING_ACTION_FEED.removePendingBTCPay(self.orderMatchID());
                  bootbox.alert("Order successfully settled. Will take 1 block to confirm across the network.");
                }
              );
            }
          }
        }
      });
    });    
  }
}

function PendingActionViewModel(type, keyData, keyDataJSON) {
  var self = this;
  self.WHEN_CREATED = new Date();
  self.TYPE = type;
  self.KEYDATA = keyData;
  self.KEYDATAJSON = keyDataJSON;
}

function PendingActionFeedViewModel() {
  var self = this;
  self.pendingBTCPays = ko.observableArray([]);
  self.pendingActions = ko.observableArray([]); //pending actions beyond pending BTCpays
  self.lastUpdated = ko.observable(new Date());

  self.dispLastUpdated = ko.computed(function() {
    return "Last Updated: " + self.lastUpdated().toTimeString(); 
  }, self);

  self.dispCount = ko.computed(function() {
    return self.pendingBTCPays().length + self.pendingActions().length;
  }, self);

  self._generateKeyData = function(type, data) {
    //compose the data dictionary from the passed in create_ dict
    // the goal of the dict is to contain just enough parameters to uniquely identify the pending txn so it can be found
    // and removed from the list, once the it is confirmed on the blockchain and we get the message feed message
    var keyData = null;
    if(type == 'burns')
      keyData = {'source': data.source, 'burned': data.burned || data.amount};
    else if(type == 'credits' || type == 'debits')
      keyData = {'address': data.address, 'asset': data.asset, 'amount': data.amount};
    else if(type == 'sends')
      keyData = {'source': data.source, 'destination': data.destination, 'asset': data.asset, 'amount': data.amount};
    else if(type == 'orders')
      keyData = {'source': data.source, 'give_asset': data.give_asset, 'give_amount': data.give_amount,
        'get_asset': data.get_asset, 'get_amount': data.get_amount, 'expiration': data.expiration};    
    else if(type == 'issuances') //issue new, lock, transfer, change description, issue additional
      keyData = {'source': data.source, 'asset': data.asset, 'amount': data.amount,
        'destination': data.destination || data.transfer_destination,
        'issuer': data.issuer || data.source, 'description': data.description};
    else if(type == 'broadcasts')
      keyData = {'source': data.source, 'text': data.text, 'value': data.value};
    else if(type == 'bets')
      keyData = {'source': data.source, 'feed_address': data.feed_address, 'bet_type': data.bet_type,
        'deadline': data.deadline, 'wager_amount': data.wager_amount, 'counterwager_amount': data.counterwager_amount};    
    else if(type == 'dividends')
      keyData = {'source': data.source, 'asset': data.asset, 'dividend_asset': data.dividend_asset,
        'amount_per_unit': data.amount_per_unit};
    else if(type == 'cancels')
      keyData = {'source': data.source, 'offer_hash': data.offer_hash};
    else if(type == 'callbacks')
      keyData = {'source': data.source, 'fraction': data.fraction, 'asset': data.asset};
    else
      assert(false, "Invalid action: " + type);
    $.jqlog.log("pendingEvent:" + type + ": " + keyData);
    return keyData;
  }
  
  self.addPendingAction = function(type, data) {
    var keyData = self._generateKeyData(type, data);
    self.pendingActions.push(new PendingActionViewModel(type, keyData, JSON.stringify(keyData)));
    self.lastUpdated(new Date());
  }

  self.removePendingAction = function(type, data) {
    var keyData = self._generateKeyData(type, data);
    var keyDataJSON = JSON.stringify(keyData);
    var match = ko.utils.arrayFirst(self.pendingActions(), function(item) {
      return item.TYPE == type && item.KEYDATAJSON == keyDataJSON;
    });
    if (match) {
      ko.utils.arrayRemoveItem(self.pendingActions, match);
    }
    self.lastUpdated(new Date());
  }
  
  self.addPendingBTCPay = function(orderMatchID, BTCPayTxIndex, myAddr, btcDestAddress, btcAmount, myOrderTxIndex,
  otherOrderTxIndex, otherOrderOtherAsset, otherOrderOtherAssetAmount, whenBTCPayCreated) {
    self.pendingBTCPays.push(new PendingBTCPayViewModel(orderMatchID, BTCPayTxIndex, myAddr, btcDestAddress, btcAmount, myOrderTxIndex,
      otherOrderTxIndex, otherOrderOtherAsset, otherOrderOtherAssetAmount, whenBTCPayCreated));
    self.lastUpdated(new Date());
  }
  
  self.removePendingBTCPay = function(orderMatchID) {
    var match = ko.utils.arrayFirst(self.pendingBTCPays(), function(item) {
      return orderMatchID == item.orderMatchID();
    });
    if (match) {
      ko.utils.arrayRemoveItem(self.pendingBTCPays, match);
    }
    self.lastUpdated(new Date());
  }
  
  self.removePendingBTCPayByOrderID = function(orderID) {
    var orderID1 = null, orderID2 = null;
    var match = ko.utils.arrayFirst(self.pendingBTCPays(), function(item) {
      orderID1 = item.orderMatchID().substring(0, 64);
      orderID2 = item.orderMatchID().substring(64);
      return orderID == orderID1 || orderID == orderID2;
    });
    if (match) {
      ko.utils.arrayRemoveItem(self.pendingBTCPays, match);
    }
    self.lastUpdated(new Date());
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
