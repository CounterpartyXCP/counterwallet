
function NotificationViewModel(type, message, when) {
  if(typeof(when)==='undefined') when = new Date().getTime();

  var self = this;
  self.type = ko.observable(type);
  /*
   * Possible types:
   * user: Misc user notification (not critical)
   * alert: Something to alert the user to at a notification level
   * security: Security-related notification
   * 
   * Beyond this, any one of the valid message category types:
   * credits, debits, orders, bets, broadcasts, etc
   */
  self.message = ko.observable(message);
  self.when = ko.observable(when); //when generated
  
  self.displayIconForType = ko.computed(function() {
    if(type == 'user') return 'fa-user';
    if(type == 'alert') return 'fa-exclamation';
    if(type == 'security') return 'fa-shield';
    return ENTITY_ICONS[type] ? ENTITY_ICONS[type] : 'fa-question';
  }, self);
  
  self.displayColorForType = ko.computed(function() {
    if(type == 'user') return 'bg-color-lighten';
    if(type == 'alert') return 'bg-color-redLight';
    if(type == 'security') return 'bg-color-redLight';
    return ENTITY_NOTO_COLORS[type] ? ENTITY_NOTO_COLORS[type] : 'bg-color-white';
  }, self);
}

function OpenOrderViewModel(order) {
  assert(order['tx_index'], "Must be a valid order object");
  var self = this;
  self.order = order;
  //break out the dynamic (changing) fields as observables
  self.giveRemaining = ko.observable(order['give_remaining']);
  self.getRemaining = ko.observable(order['get_remaining']);
  self.feeRemaining = ko.observable(order['fee_remaining']);
  
  self.cancelOpenOrder = function() {
    bootbox.dialog({
      message: "Are you sure that you want to cancel this order?<br/><br/> \
        <b style='color:red'>Please NOTE that this action is irreversable!</b>",
      title: "Are you sure?",
      buttons: {
        success: {
          label: "Don't Cancel Order'",
          className: "btn-default",
          callback: function() {
            //modal will disappear
          }
        },
        danger: {
          label: "Cancel Order",
          className: "btn-danger",
          callback: function() {
            //issue 0 to lock the asset
            WALLET.doTransaction(self.order['source'], "create_cancel",
              { offer_hash: self.order['tx_hash'] },
              function() {
                bootbox.alert("Your order cancellation has been submitted"
                  + " but it may take a bit for this to formally reflect on the network.");
              }
            );
          }
        },
      }
    });    
  }
}

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
                  ACTIVITY_FEED.removePendingBTCPay(self.orderMatchID());
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

function ActivityFeedViewModel(initialActivityCount) {
  if(typeof(initialActivityCount)==='undefined') initialActivityCount = 0;
  
  //An address has 2 or more assets (BTC, XCP, and any others)
  var self = this;
  self.notifications = ko.observableArray([]);
  self.pendingBTCPays = ko.observableArray([]);
  self.openOrders = ko.observableArray([]);
  self.lastUpdated = ko.observable(new Date());
  self.unackedNotificationCount = ko.observable(0);
  self.USE_TESTNET = USE_TESTNET;
  self.IS_DEV = IS_DEV;

  self.totalActivityCount = ko.computed(function() {
    return self.unackedNotificationCount() + self.pendingBTCPays().length; //don't list open orders as a red badge 
  }, self);

  self.dispLastUpdated = ko.computed(function() {
    return "Last Updated: " + self.lastUpdated().toTimeString(); 
  }, self);
  
  self.addNotification = function(type, message, when) {
    self.notifications.unshift(new NotificationViewModel(type, message, when)); //add to front of array
    self.unackedNotificationCount(self.unackedNotificationCount() + 1);
    //if the number of notifications are over 40, remove the oldest one
    if(self.notifications().length > 40) self.notifications.pop();
  }

  self.addPendingBTCPay = function(orderMatchID, BTCPayTxIndex, myAddr, btcDestAddress, btcAmount, myOrderTxIndex,
  otherOrderTxIndex, otherOrderOtherAsset, otherOrderOtherAssetAmount, whenBTCPayCreated) {
    self.pendingBTCPays.push(new PendingBTCPayViewModel(orderMatchID, BTCPayTxIndex, myAddr, btcDestAddress, btcAmount, myOrderTxIndex,
      otherOrderTxIndex, otherOrderOtherAsset, otherOrderOtherAssetAmount, whenBTCPayCreated));
  }
  
  self.removePendingBTCPay = function(orderMatchID) {
    var match = ko.utils.arrayFirst(self.pendingBTCPays(), function(item) {
      return orderMatchID == item.orderMatchID();
    });
    if (match) {
      ko.utils.arrayRemoveItem(self.pendingBTCPays, match);
    }
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
  }

  self.addOpenOrder = function(order) {
    assert(order);
    self.openOrders.push(new OpenOrderViewModel(order));
  }

  self.removeOpenOrder = function(orderTxIndex) {
    var match = ko.utils.arrayFirst(self.openOrders(), function(item) {
        return orderTxIndex == item.order['tx_index'];
    });
    if (match) {
      ko.utils.arrayRemoveItem(self.openOrders, match);
    }
  }
}


window.ACTIVITY_FEED = new ActivityFeedViewModel();

$(document).ready(function() {
  ko.applyBindings(ACTIVITY_FEED, document.getElementById("logo-group"));
});
