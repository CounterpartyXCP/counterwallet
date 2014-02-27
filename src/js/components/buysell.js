var AddressInDropdownItemModel = function(address, label, asset, balance) {
  this.ADDRESS = address;
  this.LABEL = label;
  this.SELECT_LABEL = label ? 
      ("<b>" + label + "</b><br/>" + address + "<br/>" + asset + " Bal: " + balance)
    : (address + "<br/>" + asset + " Bal: " + balance);
};

ko.validation.rules['isValidQtyForBuyAssetDivisibility'] = {
    validator: function (val, self) {
      if(!self.buyAssetIsDivisible() && numberHasDecimalPlace(parseFloat(val))) {
        return false;
      }
      return true;
    },
    message: 'The amount must be a whole number, since this is a non-divisible asset.'
};
ko.validation.rules['isValidQtyForSellAssetDivisibility'] = {
    validator: function (val, self) {
      if(!self.sellAssetIsDivisible() && numberHasDecimalPlace(parseFloat(val))) {
        return false;
      }
      return true;
    },
    message: 'The amount must be a whole number, since this is a non-divisible asset.'
};
ko.validation.rules['doesNotMatchSelectedBuyAsset'] = {
  validator: function (asset, self) {
    console.log("doesNotMatchSelectedBuyAsset: " + asset);
    if(!asset) return null;
    if(asset == "BTC" && self.selectedBuyAsset() == "BTC") return false;
    if(asset == "XCP" && self.selectedBuyAsset() == "XCP") return false;
    if(   asset == "Other"
       && self.selectedBuyAsset() == "Other"
       && self.selectedBuyAssetOther() == self.selectedSellAssetOther() ) return false;
    return true;
  },
  message: 'You cannot buy and sell the same asset.'
};
ko.validation.rules['isExistingBuyAssetName'] = {
  validator: function (asset, self) {
    if(self.selectedBuyAsset() != "Other") return true; //this validator doesn't apply
    if(asset == 'XCP' || asset == 'BTC') return false; //shouldn't be in this list
    var match = ko.utils.arrayFirst(self.allAssets(), function(item) {
      return item == asset;
    });
    return match;
  },
  message: 'The asset specified does not exist.'
};
ko.validation.rules['isExistingSellAssetName'] = {
  validator: function (asset, self) {
    if(self.selectedSellAsset() != "Other") return true; //this validator doesn't apply
    if(asset == 'XCP' || asset == 'BTC') return false; //shouldn't be in this list
    var match = ko.utils.arrayFirst(self.allAssets(), function(item) {
      return item == asset;
    });
    return match;
  },
  message: 'The asset specified does not exist.'
};
ko.validation.rules['addressHasSellAssetBalance'] = {
  validator: function (address, self) {
    if(!address) return true; //leave it alone for blank addresses
    return WALLET.getBalance(address.ADDRESS, self.sellAsset());
  },
  message: 'You have no available balance for the sell asset at this address.'
};
ko.validation.rules['isValidBuyOrSellAmount'] = {
  validator: function (amount, self) {
    if(amount == null || amount == '') return true; //let the required validator handle this
    return amount > 0;
  },
  message: 'Must be greater than 0'
};
ko.validation.rules['coorespondingSellAmountDoesNotExceedBalance'] = {
  //For the amount the user wants to buy
  validator: function (buyAmount, self) {
    if(self.selectedSellAmount() == null) return true; //don't complain yet until the user fills something in
    if(self.selectedSellAmountCustom()) return true; //this field is not used for custom orders (we do validation on the customBuy field instead)
    if(!self.selectedAddress() || buyAmount == null || buyAmount == '') return false;
    return self.selectedSellAmount() <= self.totalBalanceAvailForSale();
  },
  message: 'You are trying to buy more than you can afford.'
};
ko.validation.rules['customSellAmountDoesNotExceedBalance'] = {
  validator: function (amount, self) {
    if(self.selectedSellAmountCustom() == null) return true; //don't complain yet until the user fills something in
    return amount <= WALLET.getBalance(self.selectedAddress().ADDRESS, self.sellAsset());
  },
  message: 'You have no available balance for the sell asset at this address.'
};
ko.validation.registerExtenders();

function BuySellWizardViewModel() {
  var self = this;
  self._lastWindowWidth = null;
  self.showPriceChart = ko.observable(false);
  self.showTradeHistory = ko.observable(false);
  self.showOpenOrders = ko.observable(false);
  self.currentTab = ko.observable(1);
  self.overrideMarketPrice = ko.observable(false);

  self.myAssets = ko.observableArray([]);
  //^ a list of all assets that this user owns in one or more addresses (for choosing which asset to sell)
  self.allAssets = ko.observableArray([]);
  //^ a list of all existing assets (for choosing which asset to buy)
  self.tradeHistory = ko.observableArray([]);
  //^ a list of the last X trades for the specified asset pair (once selected and tab 2 is showing)
  self.openOrders = ko.observableArray([]);
  //^ a list of open orders for the selected asset pair and address
  self.currentBlockIndex = ko.observable(null);
  self.askBook = ko.observableArray([]);
  self.bidBook = ko.observableArray([]);
  self.bidAskMedian = ko.observable(null);
  self.bidDepth = ko.observable(null);
  self.askDepth = ko.observable(null);

  //WIZARD TAB 1
  self.selectedBuyAsset = ko.observable('').extend({
    required: true
  });
  self.selectedBuyAssetOther = ko.observable('').extend({
     //if the "Other" radio button is selected
    required: {
      message: "Asset required.",
      onlyIf: function () { return (self.selectedBuyAsset() == 'Other'); }
    },
    isExistingBuyAssetName: self
  });
  self.selectedSellAsset = ko.observable('').extend({
    required: true,
    doesNotMatchSelectedBuyAsset: self
  });
  self.selectedSellAssetOther = ko.observable('').extend({
     //if the "Other" radio button is selected
    required: {
      message: "Asset required.",
      onlyIf: function () { return (self.selectedSellAsset() == 'Other'); }
    },
    isExistingSellAssetName: self
  });
  self.buyAsset = ko.computed(function() {
    if(self.selectedBuyAsset() == 'Other') return self.selectedBuyAssetOther();
    return self.selectedBuyAsset();
  }, self);
  self.sellAsset = ko.computed(function() {
    if(self.selectedSellAsset() == 'Other') return self.selectedSellAssetOther();
    return self.selectedSellAsset();
  }, self);

  self.sellAssetIsDivisible = ko.computed(function() {
    if(!self.sellAsset() || !self.selectedAddress()) return null;
    return WALLET.getAddressObj(self.selectedAddress().ADDRESS).getAssetObj(self.sellAsset()).DIVISIBLE;
  }, self);
  self.buyAssetIsDivisible = ko.observable(); //set during change of selectedBuyAsset

  self.selectedAddress = ko.observable('').extend({
    required: {
      message: "This field is required.",
      onlyIf: function () { return (self.selectedBuyAsset() && self.selectedSellAsset()); }
    },
    addressHasSellAssetBalance: self
  });
  self.dispSelectedAddress = ko.computed(function() {
    if(!self.selectedAddress()) return null;
    return self.selectedAddress().ADDRESS;
  }, self);
  self.dispSelectedAddressWithLabel = ko.computed(function() {
    if(!self.selectedAddress()) return null;
    var address = self.selectedAddress();
    return address.LABEL ? address.LABEL + " (" + address.ADDRESS + ")" : address.ADDRESS;
  }, self);
  
  self.availableAddressesWithBalance = ko.computed(function() { //stores AddressInDropdownModel objects
    if(!self.sellAsset()) return null; //must have a sell asset selected
    //Get a list of all of my available addresses with the specified sell asset balance
    var addresses = WALLET.getAddressesList(true);
    var addressesWithBalance = [];
    var bal = null;
    for(var i = 0; i < addresses.length; i++) {
      bal = WALLET.getBalance(addresses[i][0], self.sellAsset());
      if(bal) {
        addressesWithBalance.push(new AddressInDropdownItemModel(addresses[i][0], addresses[i][1], self.sellAsset(), bal));        
      } 
    }
    addressesWithBalance.sort(function(left, right) {
      return left.SELECT_LABEL == right.SELECT_LABEL ? 0 : (left.SELECT_LABEL < right.SELECT_LABEL ? -1 : 1)
    });
    return addressesWithBalance;
  }, self);
  self.assetPair = ko.computed(function() {
    if(!self.buyAsset() || !self.sellAsset()) return null;
    var pair = WALLET.assetsToAssetPair(self.buyAsset(), self.sellAsset());
    return pair; //2 element array, as [baseAsset, quoteAsset]
  }, self);
  self.dispAssetPair = ko.computed(function() {
    if(!self.assetPair()) return null;
    var pair = self.assetPair();
    return pair[0] + "/" + pair[1];
  }, self);
  self.baseAsset = ko.computed(function() {
    if(!self.assetPair()) return null;
    return self.assetPair()[0] == self.buyAsset() ? self.buyAsset() : self.sellAsset();
  }, self);
  self.quoteAsset = ko.computed(function() {
    if(!self.assetPair()) return null;
    return self.assetPair()[0] == self.buyAsset() ? self.sellAsset() : self.buyAsset();
  }, self);
  self.maxAfford = ko.computed(function() {
    //max number of buyAsset that can be bought, given the balance
    // of sellAsset at the selectedAddress and sellAsset's market price
    if(!self.buyAsset() || !self.sellAsset() || !self.assetPair() || !self.selectedAddress() || !self.currentMarketUnitPrice()) return null;
    var pair = self.assetPair();
    if(self.buyAsset() == pair[0]) { //buy asset is the base asset
      //self.totalBalanceAvailForSale / self.currentMarketUnitPrice
      return Decimal.round(new Decimal(self.totalBalanceAvailForSale()).div(self.currentMarketUnitPrice()), 8).toFloat();
    } else { //sell asset is the base asset
      //self.totalBalanceAvailForSale * self.currentMarketUnitPrice
      return Decimal.round(new Decimal(self.totalBalanceAvailForSale()).mul(self.currentMarketUnitPrice()), 8).toFloat();
    }
  }, self);
  self.totalBalanceAvailForSale = ko.computed(function() {
    if(!self.selectedAddress() || !self.sellAsset()) return null;
    return WALLET.getBalance(self.selectedAddress().ADDRESS, self.sellAsset());
  }, self);
  
  //WIZARD TAB 2
  self.selectedBuyAmount = ko.observable().extend({
    required: true,
    isValidBuyOrSellAmount: self,
    coorespondingSellAmountDoesNotExceedBalance: self,
    isValidQtyForBuyAssetDivisibility: self
  });
  self.currentMarketUnitPrice = ko.observable();
  // ^ quote / base (per 1 base unit). May be null if there is no established market rate
  self.selectedSellAmountCustom = ko.observable().extend({
     //only set if there is no market data, or market data is overridden
    required: {
      message: "This field is required.",
      onlyIf: function () { return (self.currentMarketUnitPrice() === null); }
    },
    isValidBuyOrSellAmount: self,
    isValidQtyForSellAssetDivisibility: self
  });
  self.selectedSellAmountAtMarket = ko.computed(function() {
    if(!self.assetPair() || !self.selectedBuyAmount() || !isNumber(self.selectedBuyAmount()) || !self.currentMarketUnitPrice()) return null;
    if(parseFloat(self.selectedBuyAmount()) == 0) return 0;
    if(self.assetPair()[0] == self.buyAsset()) //buy asset is the base
      //self.selectedBuyAmount * self.currentMarketUnitPrice
      return Decimal.round(new Decimal(self.selectedBuyAmount()).mul(self.currentMarketUnitPrice()), 8).toFloat();
    else { // sell asset is the base
      assert(self.assetPair()[0] == self.sellAsset(), "Asset pair is what we thought it should be");
      //self.selectedBuyAmount / self.currentMarketUnitPrice
      return Decimal.round(new Decimal(self.selectedBuyAmount()).div(self.currentMarketUnitPrice()), 8).toFloat();
    }
  }, self);
  self.selectedSellAmount = ko.computed(function() {
    return(self.selectedSellAmountCustom() || self.selectedSellAmountAtMarket());
  }, self);
  self.unitPriceCustom = ko.computed(function() {
    if(!self.assetPair() || !self.selectedSellAmountCustom() || !isNumber(self.selectedSellAmountCustom())) return null;
    //^ only valid when the market unit price doesn't exist or is overridden
    if(parseFloat(self.selectedSellAmountCustom()) == 0 || parseFloat(self.selectedBuyAmount()) == 0) return null;
    if(self.assetPair()[0] == self.buyAsset()) //buy asset is the base
      //self.selectedSellAmountCustom / self.selectedBuyAmount
      return Decimal.round(new Decimal(self.selectedSellAmountCustom()).div(self.selectedBuyAmount()), 8).toFloat();
    else { // sell asset is the base
      assert(self.assetPair()[0] == self.sellAsset());
      //self.selectedBuyAmount / self.selectedSellAmountCustom
      return Decimal.round(new Decimal(self.selectedBuyAmount()).div(self.selectedSellAmountCustom()), 8).toFloat();
    }
  }, self);
  self.unitPrice = ko.computed(function() {
    //if we've overridden the unit price, return that, otherwise go with the market rate (if there is one)
    return(self.unitPriceCustom() || self.currentMarketUnitPrice());
  }, self);
  self.sellAmountRemainingAfterSale = ko.computed(function() {
    if(!self.selectedSellAmount()) return null;
    var curBalance = WALLET.getBalance(self.selectedAddress().ADDRESS, self.sellAsset());
    //curBalance - self.selectedSellAmount
    return Decimal.round(new Decimal(curBalance).sub(self.selectedSellAmount()), 8).toFloat();
  }, self);

  //VALIDATION MODELS  
  self.validationModelTab1 = ko.validatedObservable({
    selectedBuyAsset: self.selectedBuyAsset,
    selectedBuyAssetOther: self.selectedBuyAssetOther,
    selectedSellAsset: self.selectedSellAsset,
    selectedSellAssetOther: self.selectedSellAssetOther,
    selectedAddress: self.selectedAddress
  });  
  
  self.validationModelTab2 = ko.validatedObservable({
    selectedBuyAmount: self.selectedBuyAmount,
    selectedSellAmountCustom: self.selectedSellAmountCustom,
    selectedUnitPrice: self.selectedUnitPrice,
  });  

  self.init = function() {
    //Get a list of all assets
    failoverAPI("get_asset_names", [], function(data, endpoint) {
      self.allAssets(data);
      
      //Set up typeahead bindings manually for now (can't get knockout and typeahead playing well together...)
      var assets = new Bloodhound({
        datumTokenizer: Bloodhound.tokenizers.whitespace,
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        local: self.allAssets()
      });
      assets.initialize();  
      $('#otherBuyAssetName').typeahead(null, {
        source: assets.ttAdapter(),
        displayKey: function(obj) { return obj }
      }).on('typeahead:selected', function($e, datum) {
        self.selectedBuyAssetOther(datum); //gotta do a manual update...doesn't play well with knockout
      });    
    });

    //Get a list of all owned assets for this user
    failoverAPI("get_owned_assets", { addresses: WALLET.getAddressesList() }, function(data, endpoint) {
      var otherAssets = [];
      for(var i = 0; i < data.length; i++) {
        self.myAssets.push(data[i]['asset']); //asset ID (e.g. "FOOBAR")
      }
    });
    
    self.buyAsset.subscribe(function(newValue) {
      if(!newValue) return;
      failoverAPI("get_asset_info", [newValue], function(assetInfo, endpoint) {
        self.buyAssetIsDivisible(assetInfo['divisible']);
      });    
    });  

    //RELEASE the WIZARD (Ydkokw2Y-rc)
    $('#buySellWizard').bootstrapWizard({
      tabClass: 'form-wizard',
      onTabClick: function(tab, navigation, index) {
        return false; //tab click disabled
      },
      onTabShow: function(tab, navigation, index) {
        var total = navigation.find('li').length;
        var current = index + 1;
        console.log("onTabShow: " + current);
        
        if(current == 1) { //going BACK to tab 1
          self.showPriceChart(false);
          self.showTradeHistory(false);
          self.showOpenOrders(false);
          self.overrideMarketPrice(false);
          $('a[href="#tab2"] span.title').text("Select Amounts");
          
          //reset the fields on tab 2
          self.selectedBuyAmount(null);
          self.selectedSellAmountCustom(null);
          self.currentMarketUnitPrice(null);
          self.tradeHistory([]);
          self.openOrders([]);
          self.currentTab(current);
          self.currentBlockIndex(null);
          self.askBook([]);
          self.bidBook([]);
          self.bidAskMedian(null);
          self.bidDepth(null);
          self.askDepth(null);
        } else if(current == 2) {
          assert(self.assetPair(), "Asset pair is not set");
          self.selectedBuyAmount.isModified(false);
          self.selectedSellAmountCustom.isModified(false);
          $('a[href="#tab2"] span.title').text("Select Amounts (" + self.dispAssetPair() + ")");
          
          //get the market price (if available) for display
          failoverAPI("get_market_price_summary", [self.buyAsset(), self.sellAsset()], function(data, endpoint) {
            self.currentMarketUnitPrice(data['market_price'] || null); //may end up being null
            self.currentTab(current); //set this here so we don't get a flash with content before we load the market price data
          });
          
          failoverAPI("get_trade_history", [self.buyAsset(), self.sellAsset()], function(data, endpoint) {
            self.tradeHistory(data);
            if(data.length) {
              runDataTables('#tradeHistory', true);
              self.showTradeHistory(true);
            } else {
              self.showTradeHistory(false);
            }
          });

          //fetch the current block index
          failoverAPI("get_running_info", [], function(data, endpoint) {
            self.currentBlockIndex(data['bitcoin_block_count']);

            //fetch and show all open orders for the selected address and asset pair
            failoverAPI("get_orders", {
                filters: [{'field': 'source', 'op': '==', 'value': self.selectedAddress().ADDRESS},
                          {'field': 'give_asset', 'op': '==', 'value': self.buyAsset()},
                          {'field': 'get_asset', 'op': '==', 'value': self.sellAsset()},
                          {'field': 'give_remaining', 'op': '!=', 'value': 0},
                         ],
                show_expired: false,
                order_by: 'block_index',
                order_dir: 'asc',
              }, function(data, endpoint) {
                self.openOrders(data);
                //issue a second call for the other direction
                failoverAPI("get_orders", {
                  filters: [{'field': 'source', 'op': '==', 'value': self.selectedAddress().ADDRESS},
                            {'field': 'give_asset', 'op': '==', 'value': self.sellAsset()},
                            {'field': 'get_asset', 'op': '==', 'value': self.buyAsset()},
                            {'field': 'give_remaining', 'op': '!=', 'value': 0},
                           ],
                  show_expired: false,
                  order_by: 'block_index',
                  order_dir: 'asc',
                  }, function(data, endpoint) {
                    self.openOrders(self.openOrders().concat(data)); //combine the two
                    //now that we have the complete data, show the orders listing
                    if(data.length) {
                      runDataTables('#openOrders', true);
                      self.showOpenOrders(true);
                    } else {
                      self.showOpenOrders(false);
                    }
                  }
                )
              }
            );
          });
          
          //now that an asset pair is picked, we can show a price chart for that pair
          failoverAPI("get_market_price_history", [self.buyAsset(), self.sellAsset()], function(data, endpoint) {
            if(data.length) {
              self.showPriceChart(true);
              self.doChart($('#priceHistory'), data);
              
              //get order book (only if we have a price history, which we do)
              failoverAPI("get_order_book", [self.buyAsset(), self.sellAsset()], function(data, endpoint) {
                data['base_ask_book'].reverse(); //for display
                self.askBook(data['base_ask_book'].slice(0,7)); //limit to 7 entries
                self.bidBook(data['base_bid_book'].slice(0,7));
                self.bidAskMedian(data['bid_ask_median']);
                self.bidDepth(data['bid_depth']);
                self.askDepth(data['ask_depth']);
              });
            } else {
              self.showPriceChart(false);
            }
          });

        } else {
          assert(current == 3, "Unknown wizard tab change!");
          self.currentTab(current);
        }
        
        //If it's the first tab, disable the previous button
        //current
        // If it's the last tab then hide the last button and show the finish instead
        if(current >= total) {
          $('#buySellWizard').find('.pager .next').hide();
          $('#buySellWizard').find('.pager .finish').show();
          $('#buySellWizard').find('.pager .finish').removeClass('disabled');          
        } else {
          $('#buySellWizard').find('.pager .next').show();
          $('#buySellWizard').find('.pager .finish').hide();
        }                
      },
      onNext: function (tab, navigation, index) {
        console.log("onNext: " + index);
        //Do form valdation before proceeding to the next tab
        if(index == 1) {
          if(!self.validationModelTab1.isValid()) {
            self.validationModelTab1.errors.showAllMessages();
            return false; //disable moving to the next step
          } else {
            return true;
          }
        } else if(index == 2) {
          if(!self.validationModelTab2.isValid()) {
            self.validationModelTab2.errors.showAllMessages();
            return false; //disable moving to the next step
          } else {
            return true;
          }
        } else if(index == 3) {
          //user has confirmed -- submit the order to the server
          var buyAmount = normalizeAmount(self.selectedBuyAmount(), self.buyAssetIsDivisible());
          var sellAmount = normalizeAmount(self.selectedSellAmount(), self.sellAssetIsDivisible());

          multiAPIConsensus("create_order",
            {source: self.selectedAddress().ADDRESS,
             give_quantity: sellAmount, give_asset: self.sellAsset(),
             get_quantity: buyAmount, get_asset: self.buyAsset(),
             expiration: 10, /* go with the default fee required and provided */ 
             multisig: WALLET.getAddressObj(self.selectedAddress().ADDRESS).PUBKEY},
            function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {
              WALLET.signAndBroadcastTx(self.selectedAddress().ADDRESS, unsignedTxHex);
              bootbox.alert("Your order for <b>" + self.selectedBuyAmount() + " " + self.selectedBuyAsset() + "</b> has been placed."
               + " You will be notified when it fills.");
              checkURL(); //reset the form and take the user back to the first tab by just refreshing the page
          });
        }
      }
    });
  }
  
  self.derivePendingOrderAssetAmount = function(asset, amount) {
    //helper function for showing pending trades
    assert(asset && amount, "Asset and/or amount not present");
    if(asset == self.buyAsset()) {
      return normalizeAmount(amount, self.buyAssetIsDivisible());
    } else {
      assert(asset == self.sellAsset());
      return normalizeAmount(amount, self.sellAssetIsDivisible());
    }
  }

  self.derivePendingOrderAssetPrice = function(asset1, amount1, asset2, amount2) {
    //helper function for showing pending trades
    assert(asset1 && amount1, "Asset1 and/or amount1 not present");
    assert(asset2 && amount2, "Asset2 and/or amount2 not present");
    var derivedAmount1 = self.derivePendingOrderAssetAmount(asset1, amount1);
    var derivedAmount2 = self.derivePendingOrderAssetAmount(asset2, amount2);
    
    if(asset1 == self.baseAsset()) {
      return Decimal.round(new Decimal(derivedAmount2).div(derivedAmount1), 8).toFloat();
    } else {
      assert(asset2 == self.baseAsset());
      return Decimal.round(new Decimal(derivedAmount1).div(derivedAmount2), 8).toFloat();
    }
  }
  
  self.derivePendingOrderExpiresIn = function(blockIndexCreatedAt, expiration) {
    //Outputs HTML
    var blockLifetime = self.currentBlockIndex() - blockIndexCreatedAt;
    var timeLeft = expiration - blockLifetime;
    assert(timeLeft >= 0);
    var labelType = null;
    
    if(timeLeft > 5) { // > 5
      labelType = 'success'; //green
    } else if(timeLeft >= 3) { //5, 4, 3
      labelType = 'warning'; //yellow
    } else { //2, 1, 0
      labelType = 'danger'; //red
    }
    return '<span class="label label-' + labelType + '">In ' + timeLeft + ' blocks</span>';
  }
  
  self.cancelOrder = function(order) {
    assert(order['tx_index'], "Order is invalid");
    
    //pop up a confirmation dialog
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
            multiAPIConsensus("create_cancel",
              {offer_hash: item['tx_hash'],
               multisig: WALLET.getAddressObj(self.selectedAddress().ADDRESS).PUBKEY},
              function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {
                WALLET.signAndBroadcastTx(self.selectedAddress().ADDRESS, unsignedTxHex);
                //remove order from the table
                self.openOrders.remove(function(item) { return item.tx_index == order['tx_index']});
                bootbox.alert("Your has been cancelled. We have removed the order from your open orders list,"
                  + " but it may take a bit for this to formally reflect on the network.");
            });
          }
        },
      }
    });    
  }
  
  self.doChart = function(chartDiv, data) {
    // split the data set into ohlc and volume
    var ohlc = [];
    var volume = [];
    
    for(var i = 0; i < data.length; i++) {
      ohlc.push([
        data[i][0], // the date
        data[i][1], // open
        data[i][2], // high
        data[i][3], // low
        data[i][4]  // close
      ]);
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
        rangeSelector: {
            selected: 1
        },
        title: {
            text: self.dispAssetPair()
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
        series: [{
            type: 'candlestick',
            name: self.dispAssetPair(),
            data: ohlc,
            dataGrouping: {
              units: groupingUnits
            }
        }, {
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
}


var BUY_SELL = new BuySellWizardViewModel();

$(document).ready(function() {
  ko.applyBindings(BUY_SELL, document.getElementsByClassName("buySellGrid")[0]);
  BUY_SELL.init();
  
  $(window).resize(BUY_SELL.dataTableResponsive);
  $(window).on('hashchange', function() {
    $(window).off("resize", BUY_SELL.dataTableResponsive);
  });
});


