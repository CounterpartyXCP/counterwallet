
var AssetPairMarketInfoItemModel = function(entry) {
  this.MARKET = entry['base_asset'] + '/' + entry['quote_asset'];
  this.BASE_ASSET = entry['base_asset'];
  this.QUOTE_ASSET = entry['quote_asset'];
  this.LOWEST_ASK = entry['lowest_ask'];
  this.HIGHEST_BID = entry['highest_bid'];
  this.ORDER_DEPTH = entry['open_orders_count'];
  this.ORDER_VOL_24H = entry['completed_trades_count'];
  this.PCT_CHANGE_24H = entry['24h_pct_change'];
  this.XCP_VOL_24H = entry['24h_vol_in_xcp'];
  this.BTC_VOL_24H = entry['24h_vol_in_btc'];

  this.PCT_CHANGE_24H_CSS_CLASS = this.PCT_CHANGE_24H > 0 ? 'txt-color-green' : (this.PCT_CHANGE_24H < 0 ? 'txt-color-red' : 'initial');
};

var OrderBookEntryItemModel = function(entry) {
  $.jqlog.debug(entry);
  this.BASE_ASSET = entry['base_asset'];
  this.QUOTE_ASSET = entry['quote_asset'];
  this.UNIT_PRICE = entry['unit_price'];
  this.QTY_AND_COUNT = smartFormat(entry['quantity']) + ' (' + entry['count'] + ')';
  this.QUANTITY = smartFormat(entry['quantity']);
  this.TOTAL = smartFormat(mulFloat(entry['unit_price'], entry['quantity']));
  this.DEPTH = smartFormat(entry['depth'], 10);
};

var OpenOrderItemModel = function(entry, isBuySell) {
  this.PARENT = isBuySell ? BUY_SELL : VIEW_PRICES;
  this.TX_ID = getTxHashLink(entry['tx_hash']) + ViewPricesViewModel.deriveIsOnlineForBTCPayment(entry['give_asset'], entry['_is_online']);
  this.WHEN_CREATED = new Date(entry['block_time']);
  this.PRICE = this.PARENT.deriveOpenOrderAssetPrice(entry['get_asset'], entry['get_quantity'], entry['give_asset'], entry['give_quantity']) + ' ' + entry['base_asset'] + '/' + entry['quote_asset'];
  this.BUY_QTY_LEFT = this.PARENT.deriveOpenOrderAssetQuantity(entry['get_asset'], entry['get_remaining']) + ' ' + entry['get_asset'] + ' ' + ViewPricesViewModel.deriveOpenOrderBuySellLeft(entry['get_quantity'], entry['get_remaining']);
  this.SELL_QTY_LEFT = this.PARENT.deriveOpenOrderAssetQuantity(entry['give_asset'], entry['give_remaining']) + ' ' + entry['give_asset'] + ' ' + ViewPricesViewModel.deriveOpenOrderBuySellLeft(entry['give_quantity'], entry['give_remaining']);
  this.EXPIRES_IN = ViewPricesViewModel.deriveOpenOrderExpiresIn(entry['block_index'], entry['expiration']);
  this.FEE_REQUIRED_LEFT = smartFormat(normalizeQuantity(entry['fee_required_remaining'])) + ' BTC ' + ViewPricesViewModel.deriveOpenOrderBuySellLeft(entry['fee_required'], entry['fee_required_remaining']);
  this.FEE_PROVIDED_LEFT = smartFormat(normalizeQuantity(entry['fee_provided_remaining'])) + ' BTC ' + ViewPricesViewModel.deriveOpenOrderBuySellLeft(entry['fee_provided'], entry['fee_provided_remaining']);
  this.ORDER = entry;
};

var TradeHistoryItemModel = function(entry) {
  this.BLOCK_INDEX = getLinkForBlock(entry['block_index']);
  this.BLOCK_TIME = moment(entry['block_time']).format('MMM Do YYYY, h:mm:ss a');
  this.ORDER_1 = getTxHashLink(entry['order_match_id'].substr(0,64));
  this.ADDRESS_1 = getLinkForCPData('address', entry['order_match_tx0_address']);
  this.ORDER_2 = getTxHashLink(entry['order_match_id'].substr(64));
  this.ADDRESS_2 = getLinkForCPData('address', entry['order_match_tx1_address']);
  this.QUANTITY_BASE = smartFormat(entry['base_quantity_normalized']) + ' ' + entry['base_asset'];
  this.QUANTITY_QUOTE = smartFormat(entry['quote_quantity_normalized']) + ' ' + entry['quote_asset'];
  this.UNIT_PRICE = entry['unit_price'] + ' ' + entry['base_asset'] + '/' + entry['quote_asset'];
  this.RAW_UNIT_PRICE = smartFormat(entry['unit_price']);
  this.RAW_BLOCK_INDEX = entry['block_index'];
  this.RAW_BLOCK_TIME = entry['block_time'];
  this.RAW_QUANTITY_BASE = entry['base_quantity_normalized'];
  this.RAW_QUANTITY_QUOTE = entry['quote_quantity_normalized'];
}

ko.validation.rules['ordersIsExistingAssetName'] = {
  validator: function (asset, self) {
    if(asset == 'XCP' || asset == 'BTC') return true;
    var match = ko.utils.arrayFirst(self.allAssets(), function(item) {
      return item == asset;
    });
    return match;
  },
  message: "Asset doesn't exist."
};
ko.validation.registerExtenders();

function ViewPricesViewModel() {
  var self = this;
  self.MY_ADDRESSES = WALLET.getAddressesList();
  self._lastWindowWidth = null;
  
  self.latestTrades = ko.observableArray([]); //populated with the VIEW_PRICES_NUM_LATEST_TRADES latest trades (of any asset pair)
  self.assetPairMarketInfo = ko.observableArray([]); //populated with top pair level market info
  self.allAssets = ko.observableArray([]);
  //^ a list of all existing assets (for choosing which asset to buy)
  self.tradeHistory = ko.observableArray([]);
  //^ a list of the last X trades for the specified asset pair
  self.askBook = ko.observableArray([]);
  self.bidBook = ko.observableArray([]);
  self.bidAskMedian = ko.observable(null);
  self.bidAskSpread = ko.observable(null);
  self.bidDepth = ko.observable(null);
  self.askDepth = ko.observable(null);

  self.openBuyOrdersHelper = ko.observableArray(['1', '2']);
  self.asset1IsDivisible = ko.observable(null);
  self.asset2IsDivisible = ko.observable(null);
  self.asset1OpenBuyOrders = ko.observableArray([]);
  self.asset2OpenBuyOrders = ko.observableArray([]);
  
  self.MARKET_DATA_REFRESH_TIMERID = null;
  self.recievedMarketData = ko.observable(false); 
  self.currentMarketUnitPrice = ko.observable();

  self.asset1 = ko.observable('').extend({
    required: true,
    ordersIsExistingAssetName: self
  });
  self.asset2 = ko.observable('').extend({
    required: true,
    ordersIsExistingAssetName: self,
    validation: {
      validator: function (val, self) {
        return val !== self.asset1();
      },
      message: 'Same as other asset',
      params: self
    }    
  });
  self.minBTCFeeProvidedPct = ko.observable(FEE_FRACTION_DEFAULT_FILTER);
  self.maxBTCFeeRequiredPct = ko.observable(FEE_FRACTION_DEFAULT_FILTER);

  self.assetPair = ko.computed(function() {
    if(!self.asset1() || !self.asset2()) return null;
    var pair = assetsToAssetPair(self.asset1(), self.asset2());
    return pair; //2 element array, as [baseAsset, quoteAsset]
  }, self);
  self.dispAssetPair = ko.computed(function() {
    if(!self.assetPair()) return null;
    var pair = self.assetPair();
    return pair[0] + "/" + pair[1];
  }, self);
  self.baseAsset = ko.computed(function() {
    if(!self.assetPair()) return null;
    return self.assetPair()[0] == self.asset1() ? self.asset1() : self.asset2();
  }, self);
  self.quoteAsset = ko.computed(function() {
    if(!self.assetPair()) return null;
    return self.assetPair()[0] == self.asset1() ? self.asset2() : self.asset1();
  }, self);
  self.baseAssetIsDivisible = ko.computed(function() {
    if(!self.assetPair()) return null;
    return self.assetPair()[0] == self.asset1IsDivisible() ? self.asset1IsDivisible() : self.asset2IsDivisible();
  }, self);
  self.quoteAssetIsDivisible = ko.computed(function() {
    if(!self.assetPair()) return null;
    return self.assetPair()[0] == self.asset1IsDivisible() ? self.asset2IsDivisible() : self.asset1IsDivisible();
  }, self);
  
  self.delayedBTCFeeSelection = ko.computed(function() {
    return self.minBTCFeeProvidedPct().toString() + '-' + self.maxBTCFeeRequiredPct().toString(); //don't care about the value, we just want to be notified here
  }).extend({ rateLimit: { method: "notifyWhenChangesStop", timeout: 400 } });

  //SUBSCRIBED CALLBACKS
  //auto refresh the order book tuned to the entered fee, if it applies
  self.delayedBTCFeeSelection.subscribeChanged(function(newValue, prevValue) {
    if(!self.validationModelBaseOrders.isValid()) return;
    if(self.asset1() != 'BTC' && self.asset2() != 'BTC') return;
    self.metricsRefreshOrderBook(); //refresh the order book
  });
  
  self.delayedAssetPairSelection = ko.computed(self.assetPair).extend({ rateLimit: { method: "notifyWhenChangesStop", timeout: 400 } });
  self.delayedAssetPairSelection.subscribeChanged(function(newValue, prevValue) {
    if(newValue == null || !self.validationModelBaseOrders.isValid()) return;
    self.fetchOpenUserOrders();
    self.fetchUserLastTrades();
    //Get asset divisibility
    self.recievedMarketData(false);
    
    //Track user choice
    trackEvent('Exchange', 'ViewPrices', self.dispAssetPair());
    
    failoverAPI("get_asset_info", {'assets': [self.asset1(), self.asset2()]}, function(assetsInfo, endpoint) {
      self.asset1IsDivisible(assetsInfo[0]['divisible']);
      self.asset2IsDivisible(assetsInfo[1]['divisible']);
      self.metricsStopAutoRefresh(); //stop autorefresh if currently happening, so that the new asset selection data can be pulled up
      self.metricsStartAutoRefresh(function() {
        self.recievedMarketData(true);
      }); //start periodically refreshing the data display
    });    
  });
  
  //VALIDATION MODELS  
  self.validationModelBaseOrders = ko.validatedObservable({
    asset1: self.asset1,
    asset2: self.asset2,
    minBTCFeeProvidedPct: self.minBTCFeeProvidedPct,
    maxBTCFeeRequiredPct: self.maxBTCFeeRequiredPct
  });


  self.balances = {};
  self.currentMarketPrice = ko.observable();
  self.marketProgression24h = ko.observable();

  self.marketProgression24hDisp = ko.computed(function() {
    var span = $('<span></span>').css('font-size', '12px').css('color', '#000');
    if (self.marketProgression24h()==0) {
      span.text('0%');
    } else if (self.marketProgression24h()>0) {
      span.text('+' + self.marketProgression24h() + '%').addClass('txt-color-greenDark');
    } else {
      span.text('-' + self.marketProgression24h() + '%').addClass('txt-color-red');
    }
    return $('<div>').append(span).html();
  });

  /********************************************

  SELL FORM BEGIN
  
  ********************************************/

  self.highestBidPrice = ko.observable();
  self.sellPrice = ko.observable();
  self.sellAmount = ko.observable(0);
  self.sellTotal = ko.observable(0);
  self.sellPriceHasFocus = ko.observable();
  self.sellAmountHasFocus = ko.observable();
  self.sellTotalHasFocus = ko.observable();
  self.obtainableForSell = ko.observable();
  self.selectedAddressForSell = ko.observable();
  self.availableBalanceForSell = ko.observable();

  self.availableAddressesForSell = ko.computed(function() { //stores BuySellAddressInDropdownItemModel objects
    if(!self.baseAsset()) return null; //must have a sell asset selected
    //Get a list of all of my available addresses with the specified sell asset balance
    var addresses = WALLET.getAddressesList(true);
    var addressesWithBalance = [];
    var bal = null, address = null, addressObj = null;
    for(var i = 0; i < addresses.length; i++) {
      address = addresses[i][0];
      addressObj = WALLET.getAddressObj(address);
      bal = WALLET.getBalance(address, self.baseAsset());
      if(addressObj.IS_WATCH_ONLY) continue; //don't list watch addresses, obviously
      if(bal) {
        addressesWithBalance.push(new BuySellAddressInDropdownItemModel(addresses[i][0], addresses[i][1], self.baseAsset(), bal));  
        self.balances[addresses[i][0] + '_' + self.baseAsset()] = parseFloat(bal);     
      } 
    }
    
    addressesWithBalance.sort(function(left, right) {
      return left.BALANCE == right.BALANCE ? 0 : (left.BALANCE > right.BALANCE ? -1 : 1);
    });

    return addressesWithBalance;
  }, self);

  self.selectedAddressForSell.subscribe(function(value) {
    var bal = self.balances[value + '_' + self.baseAsset()];
    self.availableBalanceForSell(bal);
    self.obtainableForSell(mulFloat(bal, self.highestBidPrice()));
  })

  self.sellPrice.subscribe(function(price) {
    if (!self.sellPriceHasFocus() || !self.sellAmount()) return;
    self.sellTotal(mulFloat(self.sellAmount(), price));
  })
  
  self.sellAmount.subscribe(function(amount) {
    if (!self.sellAmountHasFocus() || !self.sellPrice()) return;
    self.sellTotal(mulFloat(self.sellPrice(), amount));
  })

  self.sellTotal.subscribe(function(total) {
    if (!self.sellTotalHasFocus() || !self.sellPrice()) return;
    self.sellAmount(divFloat(total, self.sellPrice()));
  })

  self.sellAmount.extend({
    required: true,
    isValidPositiveQuantity: self,
    validation: {
      validator: function (val, self) {
        return parseFloat(val) <= self.availableBalanceForSell();
      },
      message: 'Amount entered exceeds the address balance.',
      params: self
    }    
  });

  self.sellValidation = ko.validatedObservable({
    sellAmount: self.sellAmount
  });

  self.sellFee = ko.computed(function() {
    var give_quantity = denormalizeQuantity(self.sellAmount(), self.baseAssetIsDivisible());
    var fee_provided = MIN_FEE;
    
    if (self.baseAsset() == 'BTC') {
      fee_provided = mulFloat(give_quantity, FEE_FRACTION_PROVIDED_DEFAULT_PCT/100);
      fee_provided = Math.ceil(fee_provided);
    }

    return normalizeQuantity(fee_provided);
  });

  self.selectBuyOrder = function(order) {
    $.jqlog.debug(order);
    self.sellPrice(parseFloat(order.UNIT_PRICE));
    var amount = Math.min(self.availableBalanceForSell(), parseFloat(order.DEPTH));
    self.sellAmount(amount);
    if (self.sellPrice()) {
      self.sellTotal(mulFloat(self.sellPrice(), amount));
    }
  }

  self.setMaxSellAmount = function() {
    var amount = self.availableBalanceForSell();
    self.sellAmount(amount);
    if (self.sellPrice()) {
      self.sellTotal(mulFloat(self.sellPrice(), amount));
    } 
  }

  self.doSell = function() {
    var give_quantity = denormalizeQuantity(self.sellAmount(), self.baseAssetIsDivisible());
    var get_quantity = denormalizeQuantity(self.sellTotal(), self.quoteAssetIsDivisible());
    var fee_required = 0;
    var fee_provided = MIN_FEE;
    var expiration = ORDER_DEFAULT_EXPIRATION;

    if (self.quoteAsset() == 'BTC') {
      fee_required = mulFloat(get_quantity, FEE_FRACTION_REQUIRED_DEFAULT_PCT/100);
      fee_required = Math.ceil(fee_required);
    }

    if (self.baseAsset() == 'BTC') {
      fee_provided = mulFloat(give_quantity, FEE_FRACTION_PROVIDED_DEFAULT_PCT/100);
      fee_provided = Math.ceil(fee_provided);
      expiration = ORDER_BTCSELL_DEFAULT_EXPIRATION;
    }

    var params = {
      source: self.selectedAddressForSell(),
      give_quantity: give_quantity,
      give_asset: self.baseAsset(),
      _give_divisible: self.baseAssetIsDivisible(),
      get_quantity: get_quantity,
      get_asset: self.quoteAsset(),
      _get_divisible: self.quoteAssetIsDivisible(),
      fee_required: fee_required,
      fee_provided: fee_provided,
      expiration: expiration
    }

    var onSuccess = function(txHash, data, endpoint) {
      bootbox.alert("Your order for <b class='notoQuantityColor'>" + self.sellTotal() + "</b>"
       + " <b class='notoAssetColor'>" + self.quoteAsset() + "</b> has been placed. "
       + ACTION_PENDING_NOTICE);
       
      //if the order involes selling BTC, then we want to notify the servers of our wallet_id so folks can see if our
      // wallet is "online", in order to determine if we'd be able to best make the necessary BTCpay
      if(self.baseAsset() == 'BTC') {
        multiAPI("record_btc_open_order", [WALLET.identifier(), txHash]);
      }
    }

    $.jqlog.debug(params);
    WALLET.doTransaction(self.selectedAddressForSell(), "create_order", params, onSuccess);
  }

  self.sell = function() {
    if (!self.sellValidation.isValid()) {
      self.sellValidation.errors.showAllMessages();
      return false;
    }

    message  = '<table class="confirmOrderBox">';
    message += '<tr><td><b>Price: </b></td><td style="text-align:right">' + self.sellPrice() + '</td><td>' + self.quoteAsset() + '/' + self.baseAsset() + '</td></tr>';
    message += '<tr><td><b>Amount: </b></td><td style="text-align:right">' + self.sellAmount() + '</td><td>' + self.baseAsset() + '</td></tr>';
    message += '<tr><td><b>Total: </b></td><td style="text-align:right">' + self.sellTotal() + '</td><td>' + self.quoteAsset() + '</td></tr>';
    message += '</table>';

    bootbox.dialog({
      title: "Confirm your order",
      message: message,
      buttons: {
        "cancel": {
          label: "Close",
          className: "btn-danger",
          callback: function() {
            bootbox.hideAll();
            return false;
          }
        },
        "confirm": {
          label: "Confirm Order",
          className: "btn-primary",
          callback: function() {
            bootbox.hideAll();
            self.doSell();
            return true;
          }
        }

      }
    });

  }
  /* SELL FORM END */

  /********************************************

  BUY FORM BEGIN
  
  ********************************************/

  self.lowestAskPrice = ko.observable();
  self.buyPrice = ko.observable();
  self.buyAmount = ko.observable(0);
  self.buyTotal = ko.observable(0);
  self.buyPriceHasFocus = ko.observable();
  self.buyAmountHasFocus = ko.observable();
  self.buyTotalHasFocus = ko.observable();
  self.obtainableForBuy = ko.observable();
  self.selectedAddressForBuy = ko.observable();
  self.availableBalanceForBuy = ko.observable();

  self.availableAddressesForBuy = ko.computed(function() { //stores BuySellAddressInDropdownItemModel objects
    if(!self.quoteAsset()) return null; //must have a sell asset selected
    //Get a list of all of my available addresses with the specified sell asset balance
    var addresses = WALLET.getAddressesList(true);
    var addressesWithBalance = [];
    var bal = null, address = null, addressObj = null;
    for(var i = 0; i < addresses.length; i++) {
      address = addresses[i][0];
      addressObj = WALLET.getAddressObj(address);
      bal = WALLET.getBalance(address, self.quoteAsset());
      if(addressObj.IS_WATCH_ONLY) continue; //don't list watch addresses, obviously
      if(bal) {
        addressesWithBalance.push(new BuySellAddressInDropdownItemModel(addresses[i][0], addresses[i][1], self.quoteAsset(), bal));  
        self.balances[addresses[i][0] + '_' + self.quoteAsset()] = parseFloat(bal);     
      } 
    }
    
    addressesWithBalance.sort(function(left, right) {
      return left.BALANCE == right.BALANCE ? 0 : (left.BALANCE > right.BALANCE ? -1 : 1);
    });

    return addressesWithBalance;
  }, self);

  self.selectedAddressForBuy.subscribe(function(value) {
    var bal = self.balances[value + '_' + self.quoteAsset()];
    self.availableBalanceForBuy(bal);
    if (self.lowestAskPrice()) {
      self.obtainableForBuy(divFloat(bal, self.lowestAskPrice()));  
    }
  })

  self.buyPrice.subscribe(function(price) {
    if (!self.buyPriceHasFocus() || !self.buyAmount()) return;
    self.buyTotal(mulFloat(self.buyAmount(), price));
  })
  
  self.buyAmount.subscribe(function(amount) {
    if (!self.buyAmountHasFocus() || !self.buyPrice()) return;
    self.buyTotal(mulFloat(self.buyPrice(), amount));
  })

  self.buyTotal.subscribe(function(total) {
    if (!self.buyTotalHasFocus() || !self.buyPrice()) return;
    self.buyAmount(divFloat(total, self.buyPrice()));
  })

  self.buyTotal.extend({
    required: true,
    isValidPositiveQuantity: self,
    validation: {
      validator: function (val, self) {
        return parseFloat(val) <= self.availableBalanceForBuy();
      },
      message: 'Amount entered exceeds the address balance.',
      params: self
    }    
  });

  self.buyValidation = ko.validatedObservable({
    buyTotal: self.buyTotal
  });

  self.buyFee = ko.computed(function() {
    var give_quantity = denormalizeQuantity(self.buyTotal(), self.quoteAssetIsDivisible());
    var fee_provided = MIN_FEE;

    if (self.quoteAsset() == 'BTC') {
      fee_provided = mulFloat(give_quantity, FEE_FRACTION_PROVIDED_DEFAULT_PCT/100);
      fee_provided = Math.ceil(fee_provided);
    }

    return normalizeQuantity(fee_provided);
  });

  self.selectSellOrder = function(order) {
    $.jqlog.debug(order);
    self.buyPrice(parseFloat(order.UNIT_PRICE));
    var amount = Math.min(self.availableBalanceForBuy(), parseFloat(order.DEPTH));
    self.buyAmount(amount);
    if (self.buyPrice()) {
      self.buyTotal(mulFloat(self.buyPrice(), amount));
    }
  }

  self.setMaxBuyAmount = function() {
    var total = self.availableBalanceForBuy();
    self.buyTotal(total);
    if (self.buyPrice()) {
      self.buyAmount(divFloat(total, self.buyPrice()));
    } 
  }

  self.doBuy = function() {
    var give_quantity = denormalizeQuantity(self.buyTotal(), self.quoteAssetIsDivisible());
    var get_quantity = denormalizeQuantity(self.buyAmount(), self.baseAssetIsDivisible());
    var fee_required = 0;
    var fee_provided = MIN_FEE;
    var expiration = ORDER_DEFAULT_EXPIRATION;

    if (self.baseAsset() == 'BTC') {
      fee_required = mulFloat(get_quantity, FEE_FRACTION_REQUIRED_DEFAULT_PCT/100);
      fee_required = Math.ceil(fee_required);
    }

    if (self.quoteAsset() == 'BTC') {
      fee_provided = mulFloat(give_quantity, FEE_FRACTION_PROVIDED_DEFAULT_PCT/100);
      fee_provided = Math.ceil(fee_provided);
      expiration = ORDER_BTCSELL_DEFAULT_EXPIRATION;
    }

    var params = {
      source: self.selectedAddressForBuy(),
      give_quantity: give_quantity,
      give_asset: self.quoteAsset(),
      _give_divisible: self.quoteAssetIsDivisible(),
      get_quantity: get_quantity,
      get_asset: self.baseAsset(),
      _get_divisible: self.baseAssetIsDivisible(),
      fee_required: fee_required,
      fee_provided: fee_provided,
      expiration: expiration
    }

    var onSuccess = function(txHash, data, endpoint) {
      bootbox.alert("Your order for <b class='notoQuantityColor'>" + self.buyTotal() + "</b>"
       + " <b class='notoAssetColor'>" + self.quoteAsset() + "</b> has been placed. "
       + ACTION_PENDING_NOTICE);
       
      //if the order involes selling BTC, then we want to notify the servers of our wallet_id so folks can see if our
      // wallet is "online", in order to determine if we'd be able to best make the necessary BTCpay
      if(self.quoteAsset() == 'BTC') {
        multiAPI("record_btc_open_order", [WALLET.identifier(), txHash]);
      }
    }

    $.jqlog.debug(params);
    WALLET.doTransaction(self.selectedAddressForBuy(), "create_order", params, onSuccess);
  }

  self.buy = function() {
    if (!self.buyValidation.isValid()) {
      self.buyValidation.errors.showAllMessages();
      return false;
    }

    message  = '<table class="confirmOrderBox">';
    message += '<tr><td><b>Price: </b></td><td style="text-align:right">' + self.buyPrice() + '</td><td>' + self.quoteAsset() + '/' + self.baseAsset() + '</td></tr>';
    message += '<tr><td><b>Amount: </b></td><td style="text-align:right">' + self.buyAmount() + '</td><td>' + self.baseAsset() + '</td></tr>';
    message += '<tr><td><b>Total: </b></td><td style="text-align:right">' + self.buyTotal() + '</td><td>' + self.quoteAsset() + '</td></tr>';
    message += '</table>';

    bootbox.dialog({
      title: "Confirm your order",
      message: message,
      buttons: {
        "cancel": {
          label: "Close",
          className: "btn-danger",
          callback: function() {
            bootbox.hideAll();
            return false;
          }
        },
        "confirm": {
          label: "Confirm Order",
          className: "btn-primary",
          callback: function() {
            bootbox.hideAll();
            self.doBuy();
            return true;
          }
        }

      }
    });

  }
  /* BUY FORM END */


  /********************************************

  TOP USER PAIRS BEGIN
  
  ********************************************/

  self.topUserPairs = ko.observableArray([]);

  self.displayTopUserPairs = function(data) {
    $.jqlog.debug(data);
    self.topUserPairs(data);
  }

  self.fetchTopUserPairs = function() {
    var params = {
      'addresses': WALLET.getAddressesList(),
      'max_pairs': 12
    }
    failoverAPI('get_users_pairs', params, self.displayTopUserPairs);
  }

  self.selectTopUserPair = function(item) {
    self.asset1(item.base_asset);
    self.asset2(item.quote_asset);
    self.marketProgression24h(0);
  }
  /* TOP USER PAIRS END */

  self.userOpenOrders = ko.observableArray([]);

  self.displayOpenUserOrders = function(data) {
    for (var i in data) {
      data[i].amount = normalizeQuantity(data[i].amount, self.baseAssetIsDivisible());
      data[i].total = normalizeQuantity(data[i].total, self.baseAssetIsDivisible());
    }
    self.userOpenOrders(data);
  }

  self.fetchOpenUserOrders = function() {
    self.userOpenOrders([]);
    var params = {
      'asset1': self.asset1(),
      'asset2': self.asset2(),
      'addresses': WALLET.getAddressesList()
    }
    failoverAPI('get_market_orders', params, self.displayOpenUserOrders);
  }

  self.userLastTrades = ko.observableArray([]);

  self.displayUserLastTrades = function(data) {
    $.jqlog.debug(data);
    for (var i in data) {
      data[i].amount = normalizeQuantity(data[i].amount, self.baseAssetIsDivisible());
      data[i].total = normalizeQuantity(data[i].total, self.baseAssetIsDivisible());
      data[i].block_time = moment(data[i].block_time * 1000).format('YYYY/MM/DD hh:mm:ss A Z');
    }
    self.userLastTrades(data);
  }

  self.fetchUserLastTrades = function() {
    self.userOpenOrders([]);
    var params = {
      'asset1': self.asset1(),
      'asset2': self.asset2(),
      'addresses': WALLET.getAddressesList()
    }
    failoverAPI('get_market_trades', params, self.displayUserLastTrades);
  }

  self.init = function() {
    self.fetchTopUserPairs();
    self.fetchAssetPairMarketInfo();
    self.fetchLatestTrades();
    
    //Get a list of all assets
    failoverAPI("get_asset_names", {}, function(data, endpoint) {
      data = ['XCP', 'BTC'].concat(data);
      self.allAssets(data);
      
      //Set up typeahead bindings manually for now (can't get knockout and typeahead playing well together...)
      var assets = new Bloodhound({
        datumTokenizer: Bloodhound.tokenizers.whitespace,
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        local: self.allAssets()
      });
      assets.initialize();
      $('#asset1, #asset2').typeahead(null, {
        source: assets.ttAdapter(),
        displayKey: function(obj) { return obj }
      }).on('typeahead:selected', function($e, datum) {
        if($($e.target).attr('name') == 'asset1')
          self.asset1(datum); //gotta do a manual update...doesn't play well with knockout
        else if($($e.target).attr('name') == 'asset2')
          self.asset2(datum); //gotta do a manual update...doesn't play well with knockout
      });
    });
  }
  
  self.fetchAssetPairMarketInfo = function() {
    if(self.recievedMarketData())
      return; //stop auto refreshing
    
    failoverAPI("get_asset_pair_market_info", {'limit': VIEW_PRICES_NUM_ASSET_PAIRS}, function(data, endpoint) {

      self.assetPairMarketInfo([]);
      $('#assetPairMarketInfo').dataTable().fnClearTable();

      var pair_data = [];
      for(var i=0; i < data.length; i++) {
        pair_data.push(new AssetPairMarketInfoItemModel(data[i]));
      }
      self.assetPairMarketInfo(pair_data);
      if(self.assetPairMarketInfo().length) {
        runDataTables('#assetPairMarketInfo', true, { "aaSorting": [ [4, 'desc'] ] });
      }
      
      //kick off the next update to fire after a delay
      setTimeout(self.fetchAssetPairMarketInfo, VIEW_PRICES_ASSET_PAIRS_REFRESH_EVERY);
    });
  }

  self.selectTopPair = function(item) {
    self.asset1(item.BASE_ASSET);
    self.asset2(item.QUOTE_ASSET);
    self.marketProgression24h(item.PCT_CHANGE_24H);
    $.jqlog.debug(item);
  }
  
  self.fetchLatestTrades = function() {
    if(self.recievedMarketData())
      return; //stop auto refreshing

    self.latestTrades([]);
      
    failoverAPI("get_trade_history", {'limit': VIEW_PRICES_NUM_LATEST_TRADES}, function(data, endpoint) {
      $('#latestTrades').dataTable().fnClearTable();
      
      var trades = [];
      for(var i=0; i < data.length; i++) {
        trades.push(new TradeHistoryItemModel(data[i]));
      }

      self.latestTrades(trades);
      if(self.latestTrades().length) {
        runDataTables('#latestTrades', true, {
          "aaSorting": [ [1, 'desc'] ],
          "aoColumns": [
           {"sType": "numeric", "iDataSort": 9}, //block ID
           {"sType": "numeric", "iDataSort": 10}, //datetime
           {"sType": "string"}, //order 1
           {"sType": "string"}, //address 1
           {"sType": "string"}, //order 2
           {"sType": "string"}, //address 2
           {"sType": "numeric", "iDataSort": 11}, //quantity base
           {"sType": "numeric", "iDataSort": 12}, //quantity quote
           {"sType": "numeric"}, //unit price
           {"bVisible": false}, //block index RAW
           {"bVisible": false}, //block datetime RAW
           {"bVisible": false}, //quantity base RAW
           {"bVisible": false}  //quantity quote RAW
         ]
        });
      }
      
      //kick off the next update to fire after a delay
      setTimeout(self.fetchLatestTrades, VIEW_PRICES_LATEST_TRADES_REFRESH_EVERY);
    });
  }
  
  self.metricsStartAutoRefresh = function(callback) {
    if(self.MARKET_DATA_REFRESH_TIMERID) return; //already auto refreshing
    $.jqlog.debug("Auto-refreshing market data for " + self.dispAssetPair() + ' ...');
    var d1 = self.metricsRefreshMarketUnitPrice();
    var d2 = self.metricsRefreshPriceChart();
    var d3 = self.metricsRefreshTradeHistory();
    var d4 = self.metricsRefreshOrderBook();
    $.when(d1, d2, d3, d4).done(function(d1, d2, d3, d4) {
      self.MARKET_DATA_REFRESH_TIMERID = setTimeout(self.metricsStartAutoRefresh, MARKET_INFO_REFRESH_EVERY);
      if(callback) callback();
    });
  }
  
  self.metricsStopAutoRefresh = function() {
    if(self.MARKET_DATA_REFRESH_TIMERID) { //stop auto update of market data
      clearTimeout(self.MARKET_DATA_REFRESH_TIMERID);
      self.MARKET_DATA_REFRESH_TIMERID = null;
    }
  }

  self.metricsRefreshMarketUnitPrice = function() {
    var deferred = $.Deferred();
    //get the market price (if available) for display
    failoverAPI("get_market_price_summary", {'asset1': self.asset1(), 'asset2': self.asset2()}, function(data, endpoint) {
      self.currentMarketUnitPrice(data['market_price'] || 0);
      //^ use 0 to signify that we got the data, but that there is no established market price
      deferred.resolve();
    }, function(jqXHR, textStatus, errorThrown, endpoint) {
      deferred.resolve();
      return defaultErrorHandler(jqXHR, textStatus, errorThrown, endpoint);
    });
  }
          
  self.metricsRefreshPriceChart = function() {
    var deferred = $.Deferred();
    //now that an asset pair is picked, we can show a price chart for that pair
    failoverAPI("get_market_price_history", {'asset1': self.asset1(), 'asset2': self.asset2()}, function(data, endpoint) {
      deferred.resolve();
      if(data.length) {
        ViewPricesViewModel.doChart(self.dispAssetPair(), $('#priceHistory'), data);
      }
    }, function(jqXHR, textStatus, errorThrown, endpoint) {
      deferred.resolve();
      return defaultErrorHandler(jqXHR, textStatus, errorThrown, endpoint);
    });
  }

  self.metricsRefreshTradeHistory = function() {
    var deferred = $.Deferred();
    self.currentMarketPrice(null);

    failoverAPI("get_trade_history", {'asset1': self.asset1(), 'asset2': self.asset2()}, function(data, endpoint) {

      deferred.resolve();
      self.tradeHistory([]);
      $('#tradeHistory').dataTable().fnClearTable();

      for(var i=0; i < data.length; i++) {
        var item = new TradeHistoryItemModel(data[i]);
        if (i==0) self.currentMarketPrice(item.RAW_UNIT_PRICE);
        self.tradeHistory.push(item);
      }
      if(self.tradeHistory().length) {

        runDataTables('#tradeHistory', true, { "aaSorting": [ [0, 'desc'] ] });
      }
    }, function(jqXHR, textStatus, errorThrown, endpoint) {
      deferred.resolve();
      return defaultErrorHandler(jqXHR, textStatus, errorThrown, endpoint);
    });
  }

  self.metricsRefreshOrderBook = function() {
    var deferred = $.Deferred();
    var args = {
      'asset1': self.asset1(),
      'asset2': self.asset2(),
      'max_pct_fee_required': self.maxBTCFeeRequiredPct() / 100,
      'min_pct_fee_provided': self.minBTCFeeProvidedPct() / 100,
    };

    self.bidBook([])
    self.askBook([])

    failoverAPI("get_order_book_simple", args, function(data, endpoint) {
      
      deferred.resolve();
      //set up order book display
      var i = null;
      for(i=0; i < Math.min(10, data['base_ask_book'].length); i++) { //limit to 10 entries
        data['base_ask_book'][i]['base_asset'] = data['base_asset'];
        data['base_ask_book'][i]['quote_asset'] = data['quote_asset'];
        var item = new OrderBookEntryItemModel(data['base_ask_book'][i]);
        self.askBook.push(item);  
        if (i==0) {
          self.lowestAskPrice(item.UNIT_PRICE);
          self.buyPrice(item.UNIT_PRICE);
          self.obtainableForBuy(divFloat(self.availableBalanceForBuy(), self.lowestAskPrice()));
        }
      }
      for(i=0; i < Math.min(10, data['base_bid_book'].length); i++) { //limit to 10 entries
        data['base_bid_book'][i]['base_asset'] = data['base_asset'];
        data['base_bid_book'][i]['quote_asset'] = data['quote_asset'];
        var item = new OrderBookEntryItemModel(data['base_bid_book'][i]);
        self.bidBook.push(item);  
        if (i==0) {
          self.highestBidPrice(item.UNIT_PRICE);
          self.sellPrice(item.UNIT_PRICE);
          self.obtainableForSell(mulFloat(self.availableBalanceForSell(), self.highestBidPrice()));
        }
      }
      self.bidAskMedian(data['bid_ask_median']);
      self.bidAskSpread(data['bid_ask_spread']);
      self.bidDepth(data['bid_depth']);
      self.askDepth(data['ask_depth']);
      
      try { $('#asset1OpenBuyOrders').dataTable().fnClearTable(); } catch(err) { }
      try { $('#asset2OpenBuyOrders').dataTable().fnClearTable(); } catch(err) { }
      //split raw_orders into buy orders for asset1 and asset2
      for(var i=0; i < data['raw_orders'].length; i++) {
        data['raw_orders'][i]['base_asset'] = data['base_asset'];
        data['raw_orders'][i]['quote_asset'] = data['quote_asset'];
        if(data['raw_orders'][i]['get_asset'] == self.asset1())
          self.asset1OpenBuyOrders.push(new OpenOrderItemModel(data['raw_orders'][i], false));
        else {
          assert(data['raw_orders'][i]['get_asset'] == self.asset2());
          self.asset2OpenBuyOrders.push(new OpenOrderItemModel(data['raw_orders'][i], false));
        }
      }
      if(self.asset1OpenBuyOrders().length) {
        runDataTables('#asset1OpenBuyOrders', true, { "aaSorting": [ [0, 'desc'] ] });
      }
      if(self.asset2OpenBuyOrders().length) {
        runDataTables('#asset2OpenBuyOrders', true, { "aaSorting": [ [0, 'desc'] ] });
      }
    }, function(jqXHR, textStatus, errorThrown, endpoint) {
      deferred.resolve();
      return defaultErrorHandler(jqXHR, textStatus, errorThrown, endpoint);
    });
  }
  
  self.normalizeAssetQuantity = function(asset, quantity) {
    //helper function for showing pending trades
    if(!self.validationModelBaseOrders.isValid()) return;
    if(asset != self.asset1() && asset != self.asset2()) return; //in process of changing assets
    assert(asset && quantity, "Asset and/or quantity not present, or quantity is zero: " + quantity);
    if(asset == self.asset1()) {
      return normalizeQuantity(quantity, self.asset1IsDivisible());
    } else {
      assert(asset == self.asset2());
      return normalizeQuantity(quantity, self.asset2IsDivisible());
    }
  }

  self.deriveOpenOrderAssetQuantity = function(asset, quantity) {
    return smartFormat(self.normalizeAssetQuantity(asset, quantity));
  }

  self.deriveOpenOrderAssetPrice = function(asset1, quantity1, asset2, quantity2) {
    //helper function for showing pending trades
    if(!self.validationModelBaseOrders.isValid()) return;
    if((asset1 != self.asset1() && asset1 != self.asset2()) || (asset2 != self.asset1() && asset2 != self.asset2())) return; //in process of changing assets
    assert(asset1 && quantity1, "Asset1 and/or quantity1 not present");
    assert(asset2 && quantity2, "Asset2 and/or quantity2 not present");
    var derivedQuantity1 = self.normalizeAssetQuantity(asset1, quantity1);
    var derivedQuantity2 = self.normalizeAssetQuantity(asset2, quantity2);

    if(asset1 == self.baseAsset()) {
      if(!derivedQuantity1) return; //in process of changing assets
      return smartFormat(Decimal.round(new Decimal(derivedQuantity2).div(derivedQuantity1), 8, Decimal.MidpointRounding.ToEven).toFloat());
    } else {
      assert(asset2 == self.baseAsset());
      if(!derivedQuantity2) return; //in process of changing assets
      return smartFormat(Decimal.round(new Decimal(derivedQuantity1).div(derivedQuantity2), 8, Decimal.MidpointRounding.ToEven).toFloat());
    }
  }
  
  self.dataTableResponsive = function(e) {
    // Responsive design for our data tables and more on this page
    var newWindowWidth = $(window).width();
    if(self._lastWindowWidth && newWindowWidth == self._lastWindowWidth) return;
    self._lastWindowWidth = newWindowWidth;
    
    if($('#tradeHistory').hasClass('dataTable')) {
      var tradeHistory = $('#tradeHistory').dataTable();
      if(newWindowWidth < 1250) { //hide some...
        tradeHistory.fnSetColumnVis(1, false); //hide blocktime
        tradeHistory.fnSetColumnVis(2, false); //hide Order 1
        tradeHistory.fnSetColumnVis(4, false); //hide Order 2
      }
      if(newWindowWidth <= 1000) { //hide even more...
        tradeHistory.fnSetColumnVis(3, false); //hide address 1
        tradeHistory.fnSetColumnVis(5, false); //hide address 2
      }
      if(newWindowWidth >= 1250) { //show it all, baby
        tradeHistory.fnSetColumnVis(1, true); //show blocktime
        tradeHistory.fnSetColumnVis(2, true); //show Order 1
        tradeHistory.fnSetColumnVis(3, true); //show address 1
        tradeHistory.fnSetColumnVis(4, true); //show Order 2
        tradeHistory.fnSetColumnVis(5, true); //show address 5
      }
      tradeHistory.fnAdjustColumnSizing();
    }
  }

};

ViewPricesViewModel.deriveOpenOrderExpiresIn = function(blockIndexCreatedAt, expiration) {
  assert(WALLET.networkBlockHeight());
  //Outputs HTML
  var blockLifetime = WALLET.networkBlockHeight() - blockIndexCreatedAt;
  var timeLeft = expiration - blockLifetime;
  var labelType = null;

  if(timeLeft < 0) {
    labelType = 'danger'; //red
  } else if(timeLeft > 5) { // > 5
    labelType = 'success'; //green
  } else if(timeLeft >= 3) { //5, 4, 3
    labelType = 'warning'; //yellow
  } else { //2, 1, 0
    labelType = 'danger'; //red
  }
  return '<span class="label label-' + labelType + '">' + (timeLeft >= 0 ? 'In ' + timeLeft + (timeLeft == 1 ? ' block' : ' blocks') : 'EXPIRED') + '</span>';
}

ViewPricesViewModel.deriveOpenOrderBuySellLeft = function(whole, part) {
  var pctLeft = (whole == 0 && part == 0) ? 1 : part / whole;
  if(pctLeft >= .30) { //30%+ 
    labelType = 'green';
  } else if(pctLeft >= .15) { //15%+
    labelType = 'yellow'; 
  } else if(pctLeft >= .10) { //10%+
    labelType = 'orange';
  } else { //less than 10%
    labelType = 'red'; 
  }
  return '<span class="pull-right label opacity-70pct padding-5 bg-color-' + labelType + '">' + smartFormat(pctLeft * 100, null, 0) + '%</span>';
}

ViewPricesViewModel.deriveIsOnlineForBTCPayment = function(give_asset, _is_online) {
  if(give_asset != 'BTC') return '';
  return '<span class="padding-left-5" class="fa fa-circle txt-color-' + (_is_online ? 'green' : 'yellow') + ' pull-left" title="' + (_is_online ? 'User is online for BTC payment' : 'User is offline or unknown') + '"></span>';
}

ViewPricesViewModel.doChart = function(dispAssetPair, chartDiv, data) {
  // split the data set into ohlc and volume
  var ohlc = [];
  var midline = [];
  var volume = [];
  
  for(var i = 0; i < data.length; i++) {
    ohlc.push([
      data[i][0], // the date
      data[i][1], // open
      data[i][2], // high
      data[i][3], // low
      data[i][4]  // close
    ]);
    midline.push([
      data[i][0], // the date
      data[i][7]  // the midline for that sample
    ])
    volume.push([
      data[i][0], // the date
      data[i][5]  // the volume
    ])
  }

  // set the allowed units for data grouping
  var groupingUnits = [[
    'week',                         // unit name
    [1]                             // allowed multiples
  ], [
    'month',
    [1, 2, 3, 4, 6]
  ]];
      
  //graph.highcharts('StockChart', {
  chartDiv.highcharts('StockChart', {


      xAxis: {
        type: 'datetime'
      },
      legend: {
        enabled: false
      },
      plotOptions: {
        candlestick: {
          color: '#f01717',
          upColor: '#0ab92b'
        },
        volume: {
          color: '#0000FF'
        }
      },
      scrollbar: {
        enabled: false
      },
      navigator: {
        enabled: true
      },
      rangeSelector: {
        enabled: false,       
        inputEnabled: false
      },
      tooltip: {
        crosshairs: true,
        shared: true,
        valueDecimals: 8
      },
      credits: {
        enabled: false
      },

      yAxis: [{
        labels: { 
          style: { 
            color: '#CC3300'
          }
        },
        title: { 
          text: 'Price', 
          style: { color: '#CC3300' }
        }
      }, {
        title: { 
          text: 'Amount', 
          style: { color: '#4572A7' } 
        },
        labels: { 
          style: { 
            color: '#4572A7' 
          }
        },
        opposite: true
      }],   
      
      series: [
      {
          type: 'column',
          name: 'Volume',
          data: volume,
          yAxis: 1,
          dataGrouping: {
            units: groupingUnits
          }
      },
      {
          type: 'candlestick',
          name: dispAssetPair,
          data: ohlc,
          yAxis: 0,
          dataGrouping: {
            units: groupingUnits
          }
      },
      {
          name: 'Trace Line',
          id: 'primary',
          type : 'line',
          data: midline,
          yAxis: 0,
          visible: false,
          showInLegend: false
      },      
      {
          name: '7-Sample SMA',
          linkedTo: 'primary',
          showInLegend: true,
          yAxis: 0,
          type: 'trendline',
          algorithm: 'SMA',
          periods: 7
      }]
  });
}





/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
