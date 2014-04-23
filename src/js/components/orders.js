var OrderBookEntryItemModel = function(entry) {
  this.UNIT_PRICE = entry['unit_price'];
  this.QTY_AND_COUNT = smartFormat(entry['quantity']) + ' (' + entry['count'] + ')';
  this.DEPTH = smartFormat(entry['depth'], 10);
};

var OpenOrderItemModel = function(entry, isBuySell) {
  this.PARENT = isBuySell ? BUY_SELL : ORDERS;
  this.TX_ID = getTxHashLink(entry['tx_hash']) + OrdersViewModel.deriveIsOnlineForBTCPayment(entry['give_asset'], entry['_is_online']);
  this.WHEN_CREATED = new Date(entry['block_time']);
  this.PRICE = this.PARENT.deriveOpenOrderAssetPrice(entry['get_asset'], entry['get_quantity'], entry['give_asset'], entry['give_quantity']);
  this.BUY_QTY_LEFT = this.PARENT.deriveOpenOrderAssetQuantity(entry['get_asset'], entry['get_remaining']) + ' ' + entry['get_asset'] + ' ' + OrdersViewModel.deriveOpenOrderBuySellLeft(entry['get_quantity'], entry['get_remaining']);
  this.SELL_QTY_LEFT = this.PARENT.deriveOpenOrderAssetQuantity(entry['give_asset'], entry['give_remaining']) + ' ' + entry['give_asset'] + ' ' + OrdersViewModel.deriveOpenOrderBuySellLeft(entry['give_quantity'], entry['give_remaining']);
  this.EXPIRES_IN = OrdersViewModel.deriveOpenOrderExpiresIn(entry['block_index'], entry['expiration']);
  this.FEE_REQUIRED_LEFT = smartFormat(normalizeQuantity(entry['fee_required_remaining'])) + ' BTC ' + OrdersViewModel.deriveOpenOrderBuySellLeft(entry['fee_required'], entry['fee_required_remaining']);
  this.FEE_PROVIDED_LEFT = smartFormat(normalizeQuantity(entry['fee_provided_remaining'])) + ' BTC ' + OrdersViewModel.deriveOpenOrderBuySellLeft(entry['fee_provided'], entry['fee_provided_remaining']);
};

var TradeHistoryItemModel = function(entry) {
  this.BLOCK = getLinkForBlock(entry['block_index']);
  this.BLOCK_TIME = moment(entry['block_time']).format('MMM Do YYYY, h:mm:ss a');
  this.ORDER_1 = getTxHashLink(entry['order_match_id'].substr(0,64));
  this.ADDRESS_1 = getLinkForCPData('address', entry['order_match_tx0_address']);
  this.ORDER_2 = getTxHashLink(entry['order_match_id'].substr(64));
  this.ADDRESS_2 = getLinkForCPData('address', entry['order_match_tx1_address']);
  this.QUANTITY_BASE = smartFormat(entry['base_quantity_normalized']) + ' ' + entry['base_asset'];
  this.QUANTITY_QUOTE = smartFormat(entry['quote_quantity_normalized']) + ' ' + entry['quote_asset'];
  this.UNIT_PRICE = entry['unit_price'];
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

function OrdersViewModel() {
  var self = this;
  self.MY_ADDRESSES = WALLET.getAddressesList();
  self._lastWindowWidth = null;
  
  self.allAssets = ko.observableArray([]);
  //^ a list of all existing assets (for choosing which asset to buy)
  self.tradeHistory = ko.observableArray([]);
  //^ a list of the last X trades for the specified asset pair
  self.askBook = ko.observableArray([]);
  self.bidBook = ko.observableArray([]);
  self.bidAskMedian = ko.observable(null);
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
  self.minBTCFeeProvidedPct = ko.observable(ORDER_DEFAULT_BTCFEE_PCT*1.05).extend({
    required: {
      message: "This field is required.",
      onlyIf: function () { return self.asset1() == 'BTC' || self.asset2() == 'BTC'; }
    },
    isValidPositiveQuantityOrZero: self,
    max: 100
  });
  self.maxBTCFeeRequiredPct = ko.observable(ORDER_DEFAULT_BTCFEE_PCT*0.95).extend({
    required: {
      message: "This field is required.",
      onlyIf: function () { return self.asset1() == 'BTC' || self.asset2() == 'BTC'; }
    },
    isValidPositiveQuantityOrZero: self,
    max: 100
  });

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
    //Get asset divisibility
    self.recievedMarketData(false);
    failoverAPI("get_asset_info", [[self.asset1(), self.asset2()]], function(assetsInfo, endpoint) {
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
  
  self.init = function() {
    //Get a list of all assets
    failoverAPI("get_asset_names", [], function(data, endpoint) {
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
    failoverAPI("get_market_price_summary", [self.asset1(), self.asset2()], function(data, endpoint) {
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
    failoverAPI("get_market_price_history", [self.asset1(), self.asset2()], function(data, endpoint) {
      deferred.resolve();
      if(data.length) {
        OrdersViewModel.doChart(self.dispAssetPair(), $('#priceHistory'), data);
      }
    }, function(jqXHR, textStatus, errorThrown, endpoint) {
      deferred.resolve();
      return defaultErrorHandler(jqXHR, textStatus, errorThrown, endpoint);
    });
  }

  self.metricsRefreshTradeHistory = function() {
    var deferred = $.Deferred();
    failoverAPI("get_trade_history_within_dates", [self.asset1(), self.asset2()], function(data, endpoint) {
      deferred.resolve();
      self.tradeHistory([]);
      for(var i=0; i < data.length; i++) {
        self.tradeHistory.push(new TradeHistoryItemModel(data[i]));
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

    failoverAPI("get_order_book_simple", args, function(data, endpoint) {
      deferred.resolve();
      //set up order book display
      var i = null;
      for(i=0; i < Math.min(10, data['base_ask_book'].length); i++) { //limit to 10 entries
        self.askBook.push(new OrderBookEntryItemModel(data['base_ask_book'][i]));  
      }
      for(i=0; i < Math.min(10, data['base_bid_book'].length); i++) { //limit to 10 entries
        self.bidBook.push(new OrderBookEntryItemModel(data['base_bid_book'][i]));  
      }
      self.bidAskMedian(data['bid_ask_median']);
      self.bidDepth(data['bid_depth']);
      self.askDepth(data['ask_depth']);
      
      try { $('#asset1OpenBuyOrders').dataTable().fnClearTable(); } catch(err) { }
      try { $('#asset2OpenBuyOrders').dataTable().fnClearTable(); } catch(err) { }
      //split raw_orders into buy orders for asset1 and asset2
      for(var i=0; i < data['raw_orders'].length; i++) {
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
  
  self.deriveOpenOrderAssetQuantity = function(asset, quantity) {
    //helper function for showing pending trades
    if(!self.validationModelBaseOrders.isValid()) return;
    if(asset != self.asset1() && asset != self.asset2()) return; //in process of changing assets
    assert(asset && quantity, "Asset and/or quantity not present, or quantity is zero: " + quantity);
    if(asset == self.asset1()) {
      return smartFormat(normalizeQuantity(quantity, self.asset1IsDivisible()));
    } else {
      assert(asset == self.asset2());
      return smartFormat(normalizeQuantity(quantity, self.asset2IsDivisible()));
    }
  }

  self.deriveOpenOrderAssetPrice = function(asset1, quantity1, asset2, quantity2) {
    //helper function for showing pending trades
    if(!self.validationModelBaseOrders.isValid()) return;
    if((asset1 != self.asset1() && asset1 != self.asset2()) || (asset2 != self.asset1() && asset2 != self.asset2())) return; //in process of changing assets
    assert(asset1 && quantity1, "Asset1 and/or quantity1 not present");
    assert(asset2 && quantity2, "Asset2 and/or quantity2 not present");
    var derivedQuantity1 = self.deriveOpenOrderAssetQuantity(asset1, quantity1);
    var derivedQuantity2 = self.deriveOpenOrderAssetQuantity(asset2, quantity2);
    
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

OrdersViewModel.deriveOpenOrderExpiresIn = function(blockIndexCreatedAt, expiration) {
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

OrdersViewModel.deriveOpenOrderBuySellLeft = function(whole, part) {
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

OrdersViewModel.deriveIsOnlineForBTCPayment = function(give_asset, _is_online) {
  if(give_asset != 'BTC') return '';
  return '<span class="padding-left-5" class="fa fa-circle txt-color-' + (_is_online ? 'green' : 'yellow') + ' pull-left" title="' + (_is_online ? 'User is online for BTC payment' : 'User is offline or unknown') + '"></span>';
}

OrdersViewModel.doChart = function(dispAssetPair, chartDiv, data) {
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
      title: {
          text: dispAssetPair
      },
      yAxis: [{
          title: {
              text: 'Price'
          },
          height: 200,
          lineWidth: 2
      }, {
          title: {
              text: 'Volume'
          },
          top: 300,
          height: 100,
          offset: 0,
          lineWidth: 2
      }],
      
      tooltip: {
          crosshairs: true,
          shared: true,
          valueDecimals: 8
      },      
      rangeSelector: {
          selected: 0
      },
      
      /*legend: {
          enabled: true,
          layout: 'vertical',
          align: 'right',
          verticalAlign: 'middle',
          borderWidth: 0
      },*/      
      
      series: [
      {
          type: 'candlestick',
          name: dispAssetPair,
          data: ohlc,
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
      },
      {
          type: 'column',
          name: 'Volume',
          data: volume,
          yAxis: 1,
          dataGrouping: {
            units: groupingUnits
          }
      }],
      credits: {
        enabled: false
      }
  });
}


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
