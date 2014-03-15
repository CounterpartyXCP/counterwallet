
function PendingBTCPayViewModel(btcPayData) {
  /* message is a message data object from the message feed for an order_match that requires a btc pay from an address in our wallet*/
  var self = this;
  self.BTCPAY_DATA = btcPayData;
  self.whenBTCPayRequested = ko.observable(new Date());
  self.now = ko.observable(new Date()); //auto updates from the parent model every minute
  
  self.displayColor = ko.computed(function() {
    /* todo make this work off of an updating timestamp..*/
    if(self.now() - self.whenBTCPayRequested() > 3600 * 1000) return 'bg-color-red'; //> 1 hour
    if(self.now() - self.whenBTCPayRequested() > 1800 * 1000) return 'bg-color-orange'; //> 30 min
    if(self.now() - self.whenBTCPayRequested() > 900 * 1000) return 'bg-color-yellow'; //> 15 min
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

function PendingActionViewModel(category, keyData) {
  var self = this;
  self.WHEN = ko.observable(new Date());
  self.CATEGORY = category;
  self.KEYDATA = keyData;
  self.DISPLAY_ICON = ENTITY_ICONS[self.CATEGORY];
  self.DISPLAY_COLOR = ENTITY_NOTO_COLORS[self.CATEGORY];
   
  self.displayText = function() {
    //TODO: this display of data is very elementary and basic. IMPROVE greatly in the future...
    var desc = "";
    var asset = WALLET.getAsset
    if(self.CATEGORY == 'burns') {
      desc = "Pending burn of <Am>" + normalizeQuantity(self.KEYDATA['burned']) + "</Am> <As>BTC</As>";
    } else if(self.CATEGORY == 'sends') {
      desc = "Pending send of <Am>" + numberWithCommas(normalizeQuantity(self.KEYDATA['quantity'], self.KEYDATA['_divisible'])) + "</Am> <As>" + self.KEYDATA['asset']
        + "</As> to <Ad>" + getLinkForCPData('address', self.KEYDATA['destination'],  getAddressLabel(self.KEYDATA['destination'])) + "</Ad>"; 
    } else if(self.CATEGORY == 'orders') {
      desc = "Pending order to sell <Am>" + numberWithCommas(normalizeQuantity(self.KEYDATA['give_quantity'], self.KEYDATA['_give_divisible']))
        + "</Am> <As>" + self.KEYDATA['give_asset'] + "</As> for <Am>"
        + numberWithCommas(normalizeQuantity(self.KEYDATA['get_quantity'], self.KEYDATA['_get_divisible'])) + "</Am> <As>"
        + self.KEYDATA['get_asset'] + "</As>";
    } else if(self.CATEGORY == 'issuances') {
      if(self.KEYDATA['transfer']) {
        desc = "Pending transfer of asset <As>" + self.KEYDATA['asset'] + "</As> from <Ad>"
          + getLinkForCPData('address', self.KEYDATA['source'], getAddressLabel(self.KEYDATA['source'])) + "</Ad> to <Ad>"
          + getLinkForCPData('address', self.KEYDATA['issuer'], getAddressLabel(self.KEYDATA['issuer'])) + "</Ad>"; 
      } else if(self.KEYDATA['description'] == 'LOCK') {
        desc = "Pending lock of asset <As>" + self.KEYDATA['asset'] + "</As> against additional issuance";
      } else if(self.KEYDATA['quantity'] == 0) {
        desc = "Pending change of description for asset <As>" + self.KEYDATA['asset'] + "</As> to <b>" + self.KEYDATA['description'] + "</b>";
      } else {
        //See if this is an issuance or not
        var assetObj = null;
        var addressesWithAsset = WALLET.getAddressesWithAsset(msg['asset']);
        if(addressesWithAsset.length)
          assetObj = WALLET.getAddressObj(addressesWithAsset[0]).getAssetObj(msg['asset']);
        
        if(assetObj) { //additional issuance
          desc = "Pending issuance for quantity <Am>" + numberWithCommas(normalizeQuantity(self.KEYDATA['quantity'], self.KEYDATA['divisible']))
            + "</Am> units for asset <As>" + self.KEYDATA['asset'] + "</As>";
        } else { //new issuance
          desc = "Pending creation of asset <As>" + self.KEYDATA['asset'] + "</As> with initial quantity of <Am>"
            + numberWithCommas(normalizeQuantity(self.KEYDATA['quantity'], self.KEYDATA['divisible'])) + "</Am> units";
        }
      }
    } else if(self.CATEGORY == 'broadcasts') {
      desc = "Pending broadcast:<br/>Text: " + self.KEYDATA['text'] + "<br/>Value:" + self.KEYDATA['value'];
    } else if(self.CATEGORY == 'bets') {
      desc = "Pending <b>" + BET_CATEGORYS[self.KEYDATA['bet_type']] + "</b> bet on feed @ <Ad>"
        + getLinkForCPData('address', self.KEYDATA['feed_address'], getAddressLabel(self.KEYDATA['feed_address'])) + "</Ad><br/>"
        + "Odds: " + self.KEYDATA['odds'] + ", Wager: <Am>"
        + numberWithCommas(normalizeQuantity(self.KEYDATA['wager_quantity'])) + "</Am> <As>XCP</As>, Counterwager: <Am>"
        + numberWithCommas(normalizeQuantity(self.KEYDATA['counterwager_quantity'])) + "</Am> <As>XCP</As>";  
    } else if(self.CATEGORY == 'dividends') {
      desc = "Pending dividend payment of <Am>" + numberWithCommas(self.KEYDATA['quantity_per_share']) + "</Am> <As>"
        + self.KEYDATA['dividend_asset'] + "</As> on asset <As>" + self.KEYDATA['asset'] + "</As>";
    } else if(self.CATEGORY == 'cancels') {
      desc = "Pending cancellation of order/bet <i>" + data['offer_hash'] + "</i>";
    } else if(self.CATEGORY == 'callbacks') {
      desc = "Pending callback for <Am>" + self.KEYDATA['fraction'] + "</Am> fraction on asset <As>" + self.KEYDATA['asset'] + "</As>";
    } else {
      desc = "UNHANDLED TRANSACTION CATEGORY";
    }

    desc = desc.replace(/<Am>/g, '<b class="notoQuantityColor">').replace(/<\/Am>/g, '</b>');
    desc = desc.replace(/<Ad>/g, '<b class="notoAddrColor">').replace(/<\/Ad>/g, '</b>');
    desc = desc.replace(/<As>/g, '<b class="notoAssetColor">').replace(/<\/As>/g, '</b>');
    return desc;
  };
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

  //Every 60 seconds, run through all pendingBTCPays and update their 'now' members
  setInterval(function() {
    var now = new Date();
    for(var i=0; i < self.pendingBTCPays().length; i++) {
      self.pendingBTCPays()[i].now(now);
    }  
  }, 60 * 1000); 

  self._generateKeyData = function(category, data) {
    //compose the data dictionary from the passed in create_ dict
    // the goal of the dict is to contain just enough parameters to uniquely identify the pending txn so it can be found
    // and removed from the list, once the it is confirmed on the blockchain and we get the message feed message
    var keyData = null;
    if(category == 'burns') {
      keyData = {'source': data.source, 'burned': data.burned || data.quantity};
    } else if(category == 'sends') {
      keyData = {'source': data.source, 'destination': data.destination, 'asset': data.asset, 'quantity': data.quantity};
    } else if(category == 'orders') {
      keyData = {'source': data.source,
        'give_asset': data.give_asset, 'give_quantity': data.give_quantity, '_give_divisible': data._give_divisible,
        'get_asset': data.get_asset, 'get_quantity': data.get_quantity, '_get_divisible': data._get_divisible,
        'expiration': data.expiration};    
    } else if(category == 'issuances') { //issue new, lock, transfer, change description, issue additional
      keyData = {'source': data.source, 'asset': data.asset, 'quantity': data.quantity,
        'transfer': data.transfer !== undefined ? data.transfer : (data.transfer_destination ? true : false),
        'issuer': data.transfer_destination || data.issuer || data.source,
        // the issuer is set to where the asset was transferred to, in the case of transfers. otherwise, go with the existing issuer
        'description': data.description, 'divisible': data.divisible};
    } else if(category == 'broadcasts') {
      keyData = {'source': data.source, 'text': data.text, 'value': data.value};
    } else if(category == 'bets') {
      keyData = {'source': data.source, 'feed_address': data.feed_address, 'bet_type': data.bet_type,
        'deadline': data.deadline, 'wager_quantity': data.wager_quantity, 'counterwager_quantity': data.counterwager_quantity};    
    } else if(category == 'dividends') {
      keyData = {'source': data.source, 'asset': data.asset, 'dividend_asset': data.dividend_asset,
        'quantity_per_unit': data.quantity_per_unit};
    } else if(category == 'cancels') {
      keyData = {'source': data.source, 'offer_hash': data.offer_hash};
    } else if(category == 'callbacks') {
      keyData = {'source': data.source, 'fraction': data.fraction, 'asset': data.asset};
    } else {
      //certain actions, like debits, credits, cancellations, etc either are ignored or don't apply
      $.jqlog.log("Ignored action: " + category + " -- " + JSON.stringify(keyData));
      return null;
    }
    //check for some common fields
    assert(keyData['source'], "Missing source");
    
    //add in some other helpful fields
    if(keyData['asset']) {
      if(data['_divisible'] === undefined && data['divisible'] === undefined)
        keyData['_divisible'] = WALLET.getAddressObj(keyData['source']).getAssetObj(keyData['asset']).DIVISIBLE;
      else
        keyData['_divisible'] = data['_divisible'] || data['divisible']; 
    }
    return keyData;
  }
  
  self.addPendingAction = function(category, data) {
    var keyData = self._generateKeyData(category, data);
    if(keyData === null) return; //ignored action
    self.pendingActions.push(new PendingActionViewModel(category, keyData));
    $.jqlog.log("pendingAction:add:" + category + ": " + JSON.stringify(keyData));
    self.lastUpdated(new Date());
  }

  self.removePendingAction = function(category, data) {
    var keyData = self._generateKeyData(category, data);
    if(keyData === null) return; //ignored action
    var match = ko.utils.arrayFirst(self.pendingActions(), function(item) {
      return item.CATEGORY == category && deepCompare(item.KEYDATA, keyData);
    });
    if(match) {
      self.pendingActions.remove(match);
      $.jqlog.log("pendingAction:remove:" + category + ": " + JSON.stringify(keyData));
      self.lastUpdated(new Date());
    } else{
      $.jqlog.log("pendingAction:NOT FOUND:" + category + ": " + JSON.stringify(keyData));
    }
    
    //If the pending action is marked as invalid, then we want to let the user know (as it wont be added to their notifications)
    if(match && data['status'].startsWith('invalid')) {
      bootbox.alert("Network processing of the following action <b class='errorColor'>failed</b>:<br/><br/>"
        + match.displayText() + "<br/><br/><b>Reason:</b> " + data['status']);
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
