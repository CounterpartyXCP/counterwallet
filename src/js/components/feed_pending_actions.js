
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
  //The category being allowable was checked in the factory class
  if(data['source'] && data['asset'])
    divisible = data['divisible'] !== undefined ? data['divisible'] : WALLET.getAddressObj(data['source']).getAssetObj(data['asset']).DIVISIBLE;
    //^ if the asset is being created, data['divisible'] should be present, otherwise, get it from an existing asset in our wallet

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
    desc = "Pending dividend payment of <Am>" + numberWithCommas(data['quantity_per_unit']) + "</Am> <As>"
      + data['dividend_asset'] + "</As> on asset <As>" + data['asset'] + "</As>";
  } else if(category == 'cancels') {
    desc = "Pending cancellation of " + data['_type'] + " ID <b>" + data['_tx_index'] + "</b>";
  } else if(category == 'callbacks') {
    desc = "Pending callback for <Am>" + (data['fraction'] * 100).toFixed(4) + "%</Am> outstanding on asset <As>" + data['asset'] + "</As>";
  } else if(category == 'btcpays') {
    desc = "Pending BTC Payment from <Ad>" + getAddressLabel(data['source']) + "</Ad>";
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
  self.pendingActions = ko.observableArray([]); //pending actions beyond pending BTCpays
  self.lastUpdated = ko.observable(new Date());
  self.ALLOWED_CATEGORIES = [
    'sends', 'orders', 'issuances', 'broadcasts', 'bets', 'dividends', 'burns', 'cancels', 'callbacks', 'btcpays'
    //^ pending actions are only allowed for these categories
  ];
  
  self.dispCount = ko.computed(function() {
    return self.pendingActions().length;
  }, self);

  self.add = function(eventID, category, data) {
    assert(self.ALLOWED_CATEGORIES.contains(category), "Illegal pending action category");
    var pendingAction = new PendingActionViewModel(eventID, category, data);
    if(!pendingAction.ACTION_TEXT) return; //not something we need to display and/or add to the list
    self.pendingActions.unshift(pendingAction);
    $.jqlog.log("pendingAction:add:" + eventID + ":" + category + ": " + JSON.stringify(data));
    self.lastUpdated(new Date());
  }

  self.remove = function(eventID, category, data) {
    if(!eventID) return; //if the event doesn't have an eventID, we can't do much about that. :)
    if(!self.ALLOWED_CATEGORIES.contains(category)) return; //ignore this category as we don't handle it
    var match = ko.utils.arrayFirst(self.pendingActions(), function(item) {
      return item.EVENTID == eventID;
      //item.CATEGORY == category
    });
    if(match) {
      self.pendingActions.remove(match);
      $.jqlog.log("pendingAction:remove:" + eventID + ":" + category);
      self.lastUpdated(new Date());
    } else{
      $.jqlog.log("pendingAction:NOT FOUND:" + eventID + ":" + category);
    }
    
    //If the pending action is marked as invalid, then we want to let the user know (as it wont be added to their notifications)
    if(match && data['status'] && data['status'].startsWith('invalid')) {
      bootbox.alert("Network processing of the following action <b class='errorColor'>failed</b>:<br/><br/>"
        + match.ACTION_TEXT + "<br/><br/><b>Reason:</b> " + data['status']);
    }
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
