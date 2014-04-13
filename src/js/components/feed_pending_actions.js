
function PendingActionViewModel(txHash, category, data, when) {
  var self = this;
  self.WHEN = when;
  self.TX_HASH = txHash;
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
    divisible = data['divisible'] !== undefined ? data['divisible'] : (data['_divisible'] !== undefined ? data['_divisible'] : WALLET.getAddressObj(data['source']).getAssetObj(data['asset']).DIVISIBLE);
    //^ if the asset is being created, data['divisible'] should be present (or [_divisible] if coming in from message feed oftentimes),
    // otherwise, get it from an existing asset in our wallet

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
    var divUnitDivisible = WALLET.getAddressObj(data['source']).getAssetObj(data['dividend_asset']).DIVISIBLE;
    desc = "Pending dividend payment of <Am>" + numberWithCommas(normalizeQuantity(data['quantity_per_unit'], divUnitDivisible)) + "</Am> <As>"
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
  self.entries = ko.observableArray([]); //pending actions beyond pending BTCpays
  self.lastUpdated = ko.observable(new Date());
  self.ALLOWED_CATEGORIES = [
    'sends', 'orders', 'issuances', 'broadcasts', 'bets', 'dividends', 'burns', 'cancels', 'callbacks', 'btcpays'
    //^ pending actions are only allowed for these categories
  ];
  
  self.dispCount = ko.computed(function() {
    return self.entries().length;
  }, self);

  self.pendingSellBTCOrdersCount = ko.computed(function() {
    return $.map(self.entries(), function(item) { 
        var sellingBTC = ('orders' == item.CATEGORY && 'BTC' == item.DATA.give_asset) || ('btcpays' == item.CATEGORY);
        return sellingBTC ? item : null;
    }).length;
  }, self);
  
  self.getLocalStorageKey = function() {
    return 'pendingActions_' + WALLET.identifier();
  }

  self.add = function(txHash, category, data, when) {
    if(typeof(when)==='undefined') when = new Date();
    assert(self.ALLOWED_CATEGORIES.contains(category), "Illegal pending action category");
    var pendingAction = new PendingActionViewModel(txHash, category, data, when);
    if(!pendingAction.ACTION_TEXT) return; //not something we need to display and/or add to the list
    self.entries.unshift(pendingAction); //place at top (i.e. newest at top)
    $.jqlog.debug("pendingAction:add:" + txHash + ":" + category + ": " + JSON.stringify(data));

    //Add to local storage so we can reload it if the user logs out and back in
    var pendingActionsStorage = localStorage.getObject(self.getLocalStorageKey());
    if(pendingActionsStorage === null) pendingActionsStorage = [];
    pendingActionsStorage.unshift({
      'txHash': txHash,
      'category': category,
      'data': data,
      'when': when //serialized to string, need to use Date.parse to deserialize
    });
    localStorage.setObject(self.getLocalStorageKey(), pendingActionsStorage);     
    
    self.lastUpdated(new Date());
    PendingActionFeedViewModel.modifyBalancePendingFlag(category, data, true);
  }

  self.remove = function(txHash, category, btcRefreshSpecialLogic) {
    if(typeof(btcRefreshSpecialLogic)==='undefined') btcRefreshSpecialLogic = false;
    if(!txHash) return; //if the event doesn't have an txHash, we can't do much about that. :)
    if(!self.ALLOWED_CATEGORIES.contains(category)) return; //ignore this category as we don't handle it
    var match = ko.utils.arrayFirst(self.entries(), function(item) {
      return item.TX_HASH == txHash;
      //item.CATEGORY == category
    });
    if(match) {
      //if the magically hackish btcRefreshSpecialLogic flag is specified, then do a few custom checks
      // that prevent us from removing events whose txns we see as recent txns, but are actually NOT btc
      // send txns (e.g. is a counterparty asset send, or asset issuance, or something the BTC balance refresh
      // routine should NOT be deleting. This hack is a consequence of managing BTC balances synchronously like we do)
      if(btcRefreshSpecialLogic) {
        assert(category == "sends");
        if (match['CATEGORY'] != category || match['DATA']['asset'] != 'BTC')
          return;
      } 
      
      self.entries.remove(match);
      $.jqlog.debug("pendingAction:remove:" + txHash + ":" + category);
      self.lastUpdated(new Date());
      PendingActionFeedViewModel.modifyBalancePendingFlag(category, match['DATA'], false);
    } else{
      $.jqlog.debug("pendingAction:NOT FOUND:" + txHash + ":" + category);
    }
    
    //Remove from local storage as well (if present)
    var pendingActionsStorage = localStorage.getObject(self.getLocalStorageKey());
    if(pendingActionsStorage === null) pendingActionsStorage = [];
    pendingActionsStorage = pendingActionsStorage.filter(function(item) {
        return item['txHash'] !== txHash;
    });    
    localStorage.setObject(self.getLocalStorageKey(), pendingActionsStorage);
  }
  
  self.restoreFromLocalStorage = function(onSuccess) {
    //restore the list of any pending transactions from local storage (removing those entries for txns that have been confirmed)
    var pendingActionsStorage = localStorage.getObject(self.getLocalStorageKey());
    var txHashes = [], i = null;
    if(pendingActionsStorage === null) pendingActionsStorage = [];
    for(var i=0; i < pendingActionsStorage.length; i++) {
      txHashes.push(pendingActionsStorage[i]['txHash']);
    }
    if(!txHashes.length) return onSuccess ? onSuccess() : null;

    //construct a new pending info storage object that doesn't include any hashes that we get no data back on
    var newPendingActionsStorage = [], pendingAction = null;
    failoverAPI("get_btc_txns_status", [txHashes], function(txInfo, endpoint) {
      for(i=0; i < txInfo.length; i++) {
        pendingAction = $.grep(pendingActionsStorage, function(e) { return e['txHash'] == txInfo[i]['tx_hash']; })[0];
        if(pendingAction && txInfo[i]['confirmations'] == 0) { //still pending
          $.jqlog.debug("pendingAction:restoreFromStorage:load: " + txInfo[i]['tx_hash'] + ":" + pendingAction['category']);
          newPendingActionsStorage.push(pendingAction);
          self.add(txInfo[i]['tx_hash'], pendingAction['category'], pendingAction['data'], Date.parse(pendingAction['when']));
        } else {
          //otherwise, do not load into pending actions, and do not include in updated pending actions list
          $.jqlog.debug("pendingAction:restoreFromStorage:remove: " + txInfo[i]['tx_hash']);
        }
        //sort the listing (newest to oldest)
        self.entries.sort(function(left, right) {
          return left.WHEN == right.WHEN ? 0 : (left.WHEN < right.WHEN ? 1 : -1);
        });
      }
      localStorage.setObject(self.getLocalStorageKey(), newPendingActionsStorage);
      if(onSuccess) onSuccess();
    });
  }
}
PendingActionFeedViewModel.modifyBalancePendingFlag = function(category, data, flagSetting) {
  assert(flagSetting === true || flagSetting === false);
  //depending on the value of category and data, will modify the associated asset(s) (if any)'s balanceChangePending flag
  var addressObj = null;
  if(category == 'burns') {
    addressObj = WALLET.getAddressObj(data['source']);
    addressObj.getAssetObj("BTC").balanceChangePending(flagSetting);
    addressObj.getAssetObj("XCP").balanceChangePending(flagSetting);
  } else if(category == 'sends') {
    addressObj = WALLET.getAddressObj(data['source']);
    if(addressObj && addressObj.getAssetObj(data['asset'])) {
      //source addr may not exist in the wallet if we are importing funds from an outside address 
      addressObj.getAssetObj(data['asset']).balanceChangePending(flagSetting);
    }
    addressObj = WALLET.getAddressObj(data['destination']);
    if(addressObj && addressObj.getAssetObj(data['asset'])) {
      //dest addr may not exist in the wallet if we are sending funds to an outside address 
      addressObj.getAssetObj(data['asset']).balanceChangePending(flagSetting);
    }
  } else if(category == 'btcpays') {
    addressObj = WALLET.getAddressObj(data['source']);
    addressObj.getAssetObj("BTC").balanceChangePending(flagSetting);
  } else if(category == 'issuances' && data['quantity'] != 0 && !data['locked'] && !data['transfer_destination']) {
    //with this, we don't modify the balanceChangePending flag, but the issuanceQtyChangePending flag instead...
    addressObj = WALLET.getAddressObj(data['source']);
    var assetObj = addressObj.getAssetObj(data['asset']);
    if(assetObj && assetObj.isMine())
      assetObj.issuanceQtyChangePending(flagSetting);
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
