
function PendingBTCPayViewModel(btcPayData) {
  /* message is a message data object from the message feed for an order_match that requires a btc pay from an address in our wallet*/
  var self = this;
  self.BTCPAY_DATA = btcPayData;
  self.WHEN_REQUESTED = new Date();
  self.now = ko.observable(new Date()); //auto updates from the parent model every minute
  
  self.displayColor = ko.computed(function() {
    /* todo make this work off of an updating timestamp..*/
    if(self.now() - self.WHEN_REQUESTED > 3600 * 1000) return 'bg-color-red'; //> 1 hour
    if(self.now() - self.WHEN_REQUESTED > 1800 * 1000) return 'bg-color-orange'; //> 30 min
    if(self.now() - self.WHEN_REQUESTED > 900 * 1000) return 'bg-color-yellow'; //> 15 min
    return 'bg-color-greenLight';
  }, self);
  
  self.completeBTCPay = function() {
    //Pop up confirm dialog, and make BTC payment
    WALLET.retrieveBTCBalance(self.btcPayData['myAddr'], function(balance) {
      if(balance < self.btcPayData['btcQuantityRaw'] + MIN_PRIME_BALANCE) {
        bootbox.alert("You do not have the required BTC balance to settle this order. Please deposit more BTC into address "
          + self.btcPayData['myAddr'] + " and try again.");
        return;
      }
      
      bootbox.dialog({
        message: "Confirm a payment of " + self.btcPayData['btcQuantity'] + " BTC to address " + self.btcPayData['btcDestAddr']
          + " to settle order ID " + self.btcPayData['myOrderTxIndex'] + "?",
        title: "Confirm Order Settlement (BTC Payment)",
        buttons: {
          cancel: {
            label: "Cancel",
            className: "btn-danger",
            callback: function() { } //just close the dialog
          },
          confirm: {
            label: "Confirm and Pay",
            className: "btn-success",
            callback: function() {
              //complete the BTCpay. Start by getting the current BTC balance for the address
              WALLET.doTransaction(self.btcPayData['myAddr'], "create_btcpay",
                { order_match_id: self.btcPayData['orderMatchID'] },
                function() {
                  //remove the BTC payment from the notifications
                  PENDING_ACTION_FEED.removePendingBTCPay(self.btcPayData['orderMatchID']);
                  //bootbox.alert("Order successfully settled. " + ACTION_PENDING_NOTICE);
                }
              );
            }
          }
        }
      });
    });    
  }
}


function PendingActionViewModel(eventID, category, data) {
  var self = this;
  self.WHEN = new Date();
  self.EVENTID = eventID;
  self.CATEGORY = category;
  self.DATA = data;
  self.ICON_CLASS = ENTITY_ICONS[category];
  self.COLOR_CLASS = ENTITY_NOTO_COLORS[category];
  self.ACTION_TEXT = PendingActionViewModel.calcText(category, data);
}
PendingActionViewModel.calcText = function(category, data) {
  //This is data as it is specified from the relevant create_ API request parameters (NOT as it comes in from the message feed)
  var desc = "";
  var divisible = null;
  assert(!(category == "btcpays" || category == "balances" || category == "debits" || category == "credits"), "Invalid category");
  if(data['source'] && data['asset'])
    divisible = WALLET.getAddressObj(data['source']).getAssetObj(data['asset']).DIVISIBLE;

  if(category == 'burns') {
    desc = "Pending burn of <Am>" + normalizeQuantity(data['quantity']) + "</Am> <As>BTC</As>";
  } else if(category == 'sends') {
    desc = "Pending send of <Am>" + numberWithCommas(normalizeQuantity(data['quantity'], divisible)) + "</Am> <As>" + data['asset']
      + "</As> from <Ad>" + getLinkForCPData('address', data['source'],  getAddressLabel(data['source'])) + "</Ad>"
      + " to <Ad>" + getLinkForCPData('address', data['destination'],  getAddressLabel(data['destination'])) + "</Ad>"; 
  } else if(category == 'orders') {
    desc = "Pending order to sell <Am>" + numberWithCommas(normalizeQuantity(data['give_quantity'], data['_give_divisible']))
      + "</Am> <As>" + data['give_asset'] + "</As> for <Am>"
      + numberWithCommas(normalizeQuantity(data['get_quantity'], data['_get_divisible'])) + "</Am> <As>"
      + data['get_asset'] + "</As>";
  } else if(category == 'issuances') {
    if(data['transfer_destination']) {
      desc = "Pending transfer of asset <As>" + data['asset'] + "</As> from <Ad>"
        + getLinkForCPData('address', data['source'], getAddressLabel(data['source'])) + "</Ad> to <Ad>"
        + getLinkForCPData('address', data['transfer_destination'], getAddressLabel(data['transfer_destination'])) + "</Ad>"; 
    } else if(data['locked']) {
      desc = "Pending lock of asset <As>" + data['asset'] + "</As> against additional issuance";
    } else if(data['quantity'] == 0) {
      desc = "Pending change of description for asset <As>" + data['asset'] + "</As> to <b>" + data['description'] + "</b>";
    } else {
      //See if this is a new issuance or not
      var assetObj = null;
      var addressesWithAsset = WALLET.getAddressesWithAsset(data['asset']);
      if(addressesWithAsset.length)
        assetObj = WALLET.getAddressObj(addressesWithAsset[0]).getAssetObj(data['asset']);
      
      if(assetObj) { //the asset exists in our wallet already somewhere, so it's an additional issuance of more units for it
        desc = "Pending issuance of <Am>" + numberWithCommas(normalizeQuantity(data['quantity'], data['divisible']))
          + "</Am> additional units for asset <As>" + data['asset'] + "</As>";
      } else { //new issuance
        desc = "Pending creation of asset <As>" + data['asset'] + "</As> with initial quantity of <Am>"
          + numberWithCommas(normalizeQuantity(data['quantity'], data['divisible'])) + "</Am> units";
      }
    }
  } else if(category == 'broadcasts') {
    desc = "Pending broadcast:<br/>Text: " + data['text'] + "<br/>Value:" + data['value'];
  } else if(category == 'bets') {
    desc = "Pending <b>" + BET_CATEGORYS[data['bet_type']] + "</b> bet on feed @ <Ad>"
      + getLinkForCPData('address', data['feed_address'], getAddressLabel(data['feed_address'])) + "</Ad><br/>"
      + "Odds: " + data['odds'] + ", Wager: <Am>"
      + numberWithCommas(normalizeQuantity(data['wager_quantity'])) + "</Am> <As>XCP</As>, Counterwager: <Am>"
      + numberWithCommas(normalizeQuantity(data['counterwager_quantity'])) + "</Am> <As>XCP</As>";  
  } else if(category == 'dividends') {
    desc = "Pending dividend payment of <Am>" + numberWithCommas(data['quantity_per_share']) + "</Am> <As>"
      + data['dividend_asset'] + "</As> on asset <As>" + data['asset'] + "</As>";
  } else if(category == 'cancels') {
    desc = "Pending cancellation of order/bet <i>" + data['offer_hash'] + "</i>";
  } else if(category == 'callbacks') {
    desc = "Pending callback for <Am>" + data['fraction'] + "</Am> fraction on asset <As>" + data['asset'] + "</As>";
  } else {
    desc = "UNHANDLED TRANSACTION CATEGORY";
  }

  desc = desc.replace(/<Am>/g, '<b class="notoQuantityColor">').replace(/<\/Am>/g, '</b>');
  desc = desc.replace(/<Ad>/g, '<b class="notoAddrColor">').replace(/<\/Ad>/g, '</b>');
  desc = desc.replace(/<As>/g, '<b class="notoAssetColor">').replace(/<\/As>/g, '</b>');
  return desc;
}


function PendingActionFeedViewModel() {
  var self = this;
  self.pendingBTCPays = ko.observableArray([]);
  self.pendingActions = ko.observableArray([]); //pending actions beyond pending BTCpays
  self.lastUpdated = ko.observable(new Date());
  self.ALLOWED_CATEGORIES = [
    'sends', 'orders', 'issuances', 'broadcasts', 'bets', 'dividends', 'burns', 'cancels', 'callbacks'
    //^ pending actions are only allowed for these categories
  ];
  
  self.dispCount = ko.computed(function() {
    return self.pendingBTCPays().length + self.pendingActions().length;
  }, self);

  //Every 60 seconds, run through all pendingBTCPays and update their 'now' members
  setInterval(function() {
    var now = new Date();
    for(var i=0; i < self.pendingBTCPays().length; i++) {
      self.pendingBTCPays()[i].now(now);
    }  
  }, 60 * 1000); 

  self.addPendingAction = function(eventID, category, data) {
    assert(self.ALLOWED_CATEGORIES.contains(category), "Illegal pending action category");
    var pendingAction = new PendingActionViewModel(eventID, category, data);
    if(!pendingAction.ACTION_TEXT) return; //not something we need to display and/or add to the list
    self.pendingActions.unshift(pendingAction);
    $.jqlog.log("pendingAction:add:" + eventID + ":" + category + ": " + JSON.stringify(data));
    self.lastUpdated(new Date());
  }

  self.removePendingAction = function(eventID, category, data) {
    if(!self.ALLOWED_CATEGORIES.contains(category)) return; //ignore this category as we don't handle it
    var match = ko.utils.arrayFirst(self.pendingActions(), function(item) {
      return item.EVENTID == eventID;
      //item.CATEGORY == category
    });
    if(match) {
      self.pendingActions.remove(match);
      $.jqlog.log("pendingAction:remove:" + eventID + ":" + category + ": " + JSON.stringify(data));
      self.lastUpdated(new Date());
    } else{
      $.jqlog.log("pendingAction:NOT FOUND:" + eventID + ":" + category + ": " + JSON.stringify(data));
    }
    
    //If the pending action is marked as invalid, then we want to let the user know (as it wont be added to their notifications)
    if(match && data['status'] && data['status'].startsWith('invalid')) {
      bootbox.alert("Network processing of the following action <b class='errorColor'>failed</b>:<br/><br/>"
        + match.ACTION_TEXT + "<br/><br/><b>Reason:</b> " + data['status']);
    }
  }
  
  self.addPendingBTCPay = function(message) {
    self.pendingBTCPays.push(new PendingBTCPayViewModel(message));
    self.lastUpdated(new Date());
  }
  
  self.removePendingBTCPay = function(orderMatchID, data) {
    //data is supplied optionally to allow us to notify the user on a failed BTCpay...it's only used when called from messagesfeed.js
    // before we work with valid messages only
    var match = ko.utils.arrayFirst(self.pendingBTCPays(), function(item) {
      return orderMatchID == item.ORDER_MATCH_ID;
    });
    if(match) {
      self.pendingBTCPays.remove(match);
      self.lastUpdated(new Date());
    }
    
    //If the pending action is marked as invalid, then we want to let the user know (as it wont be added to their notifications)
    if(match && data && data['status'].startsWith('invalid')) {
      bootbox.alert("Network processing of the BTC payment for order match ID " + match.BTCPAY_DATA['orderMatchID']
        + " <b class='errorColor'>failed</b>.<br/><br/><b>Reason:</b> " + data['status']);
    }
  }
  
  self.removePendingBTCPayByOrderID = function(orderID) {
    var match = ko.utils.arrayFirst(self.pendingBTCPays(), function(item) {
      var orderID1 = item.orderMatchID().substring(0, 64);
      var orderID2 = item.orderMatchID().substring(64);
      return orderID == orderID1 || orderID == orderID2;
    });
    if(match) {
      self.pendingBTCPays.remove(match);
      self.lastUpdated(new Date());
    }
  }
}
PendingActionFeedViewModel.makeBTCPayData = function(data) {
  var firstInPair = WALLET.getAddressObj(message['tx0_address']) ? true : false;
  if(!firstInPair) assert(WALLET.getAddressObj(message['tx1_address']));
  return {
    orderMatchID: data['tx0_hash'] + data['tx1_hash'],
    myAddr: firstInPair ? data['tx0_address'] : data['tx1_address'],
    btcDestAddr: firstInPair ? data['tx1_address'] : data['tx0_address'],
    btcQuantity: normalizeQuantity(firstInPair ? data['forward_quantity'] : data['backward_quantity']), //normalized
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
