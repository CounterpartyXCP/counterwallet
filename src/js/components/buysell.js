var MARKET_INFO_REFRESH_EVERY = 5 * 60 * 1000; //refresh market info every 5 minutes while on tab 2 

var BuySellAddressInDropdownItemModel = function(address, label, asset, balance) {
  this.ADDRESS = address;
  this.LABEL = label;
  this.SELECT_LABEL = (label ? ("<b>" + label + "</b><br/>" + address + "<br/>" + asset + " Bal: " + balance) : (address + "<br/>" + asset + " Bal: " + balance));
};

ko.validation.rules['isValidQtyForBuyAssetDivisibility'] = {
    validator: function (val, self) {
      if(!self.buyAssetIsDivisible() && numberHasDecimalPlace(parseFloat(val))) {
        return false;
      }
      return true;
    },
    message: 'The quantity entered must be a whole number, since this is a non-divisible asset.'
};
ko.validation.rules['isValidQtyForSellAssetDivisibility'] = {
    validator: function (val, self) {
      if(!self.params.sellAssetIsDivisible() && numberHasDecimalPlace(parseFloat(val))) {
        return false;
      }
      return true;
    },
    message: 'The quantity entered must be a whole number, since this is a non-divisible asset.'
};
ko.validation.rules['doesNotMatchSelectedBuyAsset'] = {
  validator: function (asset, self) {
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

ko.validation.rules['addressHasPrimedTxouts'] = {
  validator: function (address, self) {
    if(!address) return true; //leave it alone for blank addresses
    return WALLET.getAddressObj(address).numPrimedTxouts() > 0;
  },
  message: 'This address has no BTC and/or no primed outputs. Please prime the address first.'
};
ko.validation.rules['addressHasSellAssetBalance'] = {
  validator: function (address, self) {
    if(!address) return true; //leave it alone for blank addresses
    return WALLET.getBalance(address, self.sellAsset());
  },
  message: 'You have no available balance for the sell asset at this address.'
};
ko.validation.rules['isValidBuyOrSellQuantity'] = {
  validator: function (quantity, self) {
    if(self.params && self.onlyIf !== undefined) self = self.params; //allows use as a conditional requirement
    if(quantity == null || quantity == '') return true; //let the required validator handle this
    return quantity.toString().match(/^[0-9]*\.?[0-9]{0,8}$/) && quantity > 0;
  },
  message: 'Must be a valid quantity (> 0, max 8 decimal places)'
};
ko.validation.rules['coorespondingSellQuantityDoesNotExceedBalance'] = {
  //For the quantity the user wants to buy
  validator: function (buyQuantity, self) {
    if(self.selectedSellQuantity() == null) return true; //don't complain yet until the user fills something in
    if(self.selectedSellQuantityCustom()) return true; //this field is not used for custom orders (we do validation on the customBuy field instead)
    if(!self.selectedAddress() || buyQuantity == null || buyQuantity == '') return false;
    return self.sellQuantityRemainingAfterSale() >= 0;
    //return self.selectedSellQuantity() <= self.totalBalanceAvailForSale();
  },
  message: 'You are trying to buy more than you can afford.'
};
ko.validation.rules['customSellQuantityDoesNotExceedBalance'] = {
  validator: function (quantity, self) {
    if(self.selectedSellQuantityCustom() == null) return true; //don't complain yet until the user fills something in
    return quantity <= WALLET.getBalance(self.selectedAddress(), self.sellAsset());
  },
  message: 'You have no available balance for the sell asset at this address.'
};
ko.validation.registerExtenders();

function BuySellWizardViewModel() {
  var self = this;
  self.MY_ADDRESSES = WALLET.getAddressesList();
  self._lastWindowWidth = null;
  
  self.allTradeDataRetrieved = ko.observable(false);
  self.showPriceChart = ko.observable(false);
  self.showTradeHistory = ko.observable(false);
  self.showOpenOrders = ko.observable(false);
  self.currentTab = ko.observable(1);
  self.overrideMarketPrice = ko.observable(false);
  self.overrideDefaultOptions = ko.observable(false);

  self.myAssets = ko.observableArray([]);
  //^ a list of all assets that this user owns in one or more addresses (for choosing which asset to sell)
  self.allAssets = ko.observableArray([]);
  //^ a list of all existing assets (for choosing which asset to buy)
  self.tradeHistory = ko.observableArray([]);
  //^ a list of the last X trades for the specified asset pair (once selected and tab 2 is showing)
  self.openOrders = ko.observableArray([]);
  //^ a list of open orders for the selected asset pair and address
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
    return WALLET.getAddressObj(self.selectedAddress()).getAssetObj(self.sellAsset()).DIVISIBLE;
  }, self);
  self.buyAssetIsDivisible = ko.observable(); //set during change of selectedBuyAsset

  self.selectedAddress = ko.observable('').extend({
    required: {
      message: "This field is required.",
      onlyIf: function () { return (self.selectedBuyAsset() && self.selectedSellAsset()); }
    },
    addressHasPrimedTxouts: self,
    addressHasSellAssetBalance: self
  });
  self.dispSelectedAddress = ko.computed(function() {
    if(!self.selectedAddress()) return null;
    return self.selectedAddress();
  }, self);
  self.dispSelectedAddressWithLabel = ko.computed(function() {
    if(!self.selectedAddress()) return null;
    return getAddressLabel(self.selectedAddress());
  }, self);
  
  self.availableAddressesWithBalance = ko.computed(function() { //stores BuySellAddressInDropdownItemModel objects
    if(!self.sellAsset()) return null; //must have a sell asset selected
    //Get a list of all of my available addresses with the specified sell asset balance
    var addresses = WALLET.getAddressesList(true);
    var addressesWithBalance = [];
    var bal = null, address = null, addressObj = null;
    for(var i = 0; i < addresses.length; i++) {
      address = addresses[i][0];
      addressObj = WALLET.getAddressObj(address);
      bal = WALLET.getBalance(address, self.sellAsset());
      if(addressObj.IS_WATCH_ONLY) continue; //don't list watch addresses, obviously
      if(bal) {
        addressesWithBalance.push(new BuySellAddressInDropdownItemModel(addresses[i][0], addresses[i][1], self.sellAsset(), bal));        
      } 
    }
    addressesWithBalance.sort(function(left, right) {
      return left.SELECT_LABEL == right.SELECT_LABEL ? 0 : (left.SELECT_LABEL < right.SELECT_LABEL ? -1 : 1)
    });
    
    return addressesWithBalance;
  }, self);
  self.assetPair = ko.computed(function() {
    if(!self.buyAsset() || !self.sellAsset()) return null;
    var pair = assetsToAssetPair(self.buyAsset(), self.sellAsset());
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
    return self.getMaxAfford(self.currentMarketUnitPrice());
  }, self);
  
  self.totalBalanceAvailForSale = ko.computed(function() {
    if(!self.selectedAddress() || !self.sellAsset()) return null;
    return WALLET.getBalance(self.selectedAddress(), self.sellAsset());
  }, self);
  
  
  //WIZARD TAB 2
  self.MARKET_DATA_REFRESH_TIMERID = null;
  self.selectedBuyQuantity = ko.observable().extend({
    required: true,
    isValidBuyOrSellQuantity: self,
    coorespondingSellQuantityDoesNotExceedBalance: self,
    isValidQtyForBuyAssetDivisibility: self
  });
  self.currentMarketUnitPrice = ko.observable();
  // ^ quote / base (per 1 base unit). May be null if there is no established market rate
  self.numBlocksUntilExpiration = ko.observable(ORDER_DEFAULT_EXPIRATION).extend({
    required: {
      message: "This field is required.",
      onlyIf: function () { return self.overrideDefaultOptions(); }
    },
    digit: true,
    min: 1,
    max: 1000 //arbitrary
  });
  //^ default to expiration in this many blocks
  self.btcFee = ko.observable(ORDER_DEFAULT_BTCFEE_PCT).extend({
    required: {
      message: "This field is required.",
      onlyIf: function () { return self.overrideDefaultOptions(); }
    },
    isValidPositiveQuantity: self
  });
  //^ if we are selling BTC, this is a fee_required override if buying BTC, and a fee_provided override if selling BTC. if neither, this is not used
  self.btcFeeAs = ko.observable('percentage');
  
  self.selectedSellQuantityCustom = ko.observable();
  //^ this field is not set directly, and is instead set via customSellAsEntry subscribe handler. customSellAsEntry has validators on it that will
  // make sure that this field, once data is entered into it, is clean
  self.selectedSellQuantityAtMarket = ko.computed(function() {
    if(!self.assetPair() || !isNumber(self.selectedBuyQuantity()) || !self.currentMarketUnitPrice()) return null;
    if(parseFloat(self.selectedBuyQuantity()) == 0) return 0;
    if(self.assetPair()[0] == self.buyAsset()) //buy asset is the base
      //self.selectedBuyQuantity * self.currentMarketUnitPrice
      return Decimal.round(new Decimal(self.selectedBuyQuantity()).mul(self.currentMarketUnitPrice()), 8).toFloat();
    else { // sell asset is the base
      assert(self.assetPair()[0] == self.sellAsset(), "Asset pair is what we thought it should be");
      //self.selectedBuyQuantity / self.currentMarketUnitPrice
      return Decimal.round(new Decimal(self.selectedBuyQuantity()).div(self.currentMarketUnitPrice()), 8).toFloat();
    }
  }, self);
  self.selectedSellQuantity = ko.computed(function() {
    return (self.selectedSellQuantityCustom() || self.selectedSellQuantityAtMarket());
  }, self);
  
  self.customSellAs = ko.observable('unitprice'); //unitprice or quantity (default to unitprice)
  //this field allows the user to enter a sell quantity, or overridden market price ...depending on the value of the switch selected
  self.customSellAsEntry = ko.observable().extend({
     //only set if there is no market data, or market data is overridden
    required: {
      message: "This field is required.",
      onlyIf: function () { return (!self.currentMarketUnitPrice() || self.overrideMarketPrice()); }
    },
    isValidBuyOrSellQuantity: {
      params: self,
      onlyIf: function () { self.customSellAs() == "quantity"; }
    },
    isValidQtyForSellAssetDivisibility: {
      params: self,
      onlyIf: function () { self.customSellAs() == "quantity"; }
    },
    isValidPositiveQuantity: {
      params: self,
      onlyIf: function () { self.customSellAs() == "unitprice"; }
    }
  });
  self.customSellAsEntry.subscribe(function(newValue) {
    if(!self.assetPair() || isNaN(parseFloat(newValue)) || parseFloat(newValue) <= 0 || !self.selectedBuyQuantity()) return;
    if(self.customSellAs() == "unitprice") {
      var val = null;
      if(self.assetPair()[0] == self.buyAsset()) //buy asset is the base
        val = Decimal.round(new Decimal(self.selectedBuyQuantity()).mul(newValue), 8).toFloat();
      else { // sell asset is the base
        assert(self.assetPair()[0] == self.sellAsset());
        val = Decimal.round(new Decimal(self.selectedBuyQuantity()).div(newValue), 8).toFloat();
      }
      assert(val !== null); 
      self.selectedSellQuantityCustom(val);
    } else {
      assert(self.customSellAs() == "quantity");
      self.selectedSellQuantityCustom(newValue); //easy
    }
  });
  self.customSellAs.subscribe(function(newValue) {
    self.customSellAsEntry.valueHasMutated(); //update the value when the button setting changes
  });
  self.selectedBuyQuantity.subscribe(function(newValue) {
    self.customSellAsEntry.valueHasMutated(); //update the value when the button setting changes
  });
  
  self.feeForSelectedBTCQuantity = ko.computed(function() {
    //returns the fee (as an quantity, not a %) for the specified buy OR sell quantity (if EITHER is for BTC)
    // -- if the BUY asset is BTC, the fee returned is the FEE REQUIRED
    // -- if the SELL asset is BTC, the fee returned is the FEE PROVIDED
    //if neither the buy nor sell asset is in BTC, then 0 will be returned
    var fee = 0;
    if(self.buyAsset() == 'BTC' || self.sellAsset() == 'BTC') {
      var quantity = self.buyAsset() == 'BTC' ? self.selectedBuyQuantity() : self.selectedSellQuantity();
      
      if(!isNumber(quantity) || parseFloat(quantity) == 0) return 0; //no quantity == zero fee (since there is nothing to get e.g. 1% from)
      
      if(!self.btcFee())
        return Decimal.round(new Decimal(quantity).mul(ORDER_DEFAULT_BTCFEE_PCT / 100), 8).toFloat();
      //^ default percentage fee (depends on btcFeeAs() defaulting to 'percentage')
      
      if(self.btcFeeAs() == 'percentage') {
        if(!parseFloat(self.btcFee())) return 0;
        //^ avoid decimal round bug giving undefined if fee specified is zero, or any nonnumber garbage
        fee = Decimal.round(new Decimal(quantity).mul(self.btcFee() / 100), 8).toFloat(); 
      } else { //the quantity itself
        fee = parseFloat(self.btcFee());
      }
    }
    return fee;
  }, self);
  self.delayedFeeForSelectedBTCQuantity = ko.computed(self.feeForSelectedBTCQuantity).extend({ rateLimit: { method: "notifyWhenChangesStop", timeout: 400 } });
  //^ this is used for refreshing the order book, depending on what BTC fee was entered as. However we want the refresh to be
  // delayed to that we don't make a bunch of ajax requests WHILE the user is typing...instead, waiting until the user
  // a) finishes typing and b) the value is valid, before making changes. Subscribing to changes in delayedFeeForSelectedBTCQuantity allows us to do this
  
  self.feeForSelectedBTCQuantityAsPct = ko.computed(function() {
    if(!self.feeForSelectedBTCQuantity()) return null;
    return self.btcFeeAs() == 'percentage'
      ? self.btcFee()
      : Decimal.round(new Decimal(100).mul(self.feeForSelectedBTCQuantity()).div(self.selectedSellQuantity()), 2).toFloat();
  }, self);
  
  self.unitPriceCustom = ko.computed(function() {
    if(!self.assetPair() || !isNumber(self.selectedBuyQuantity()) || !isNumber(self.selectedSellQuantityCustom())) return null;
    //^ only valid when the market unit price doesn't exist or is overridden
    if(parseFloat(self.selectedSellQuantityCustom()) == 0 || parseFloat(self.selectedBuyQuantity()) == 0) return null;
    if(self.assetPair()[0] == self.buyAsset()) //buy asset is the base
      //self.selectedSellQuantityCustom / self.selectedBuyQuantity
      return Decimal.round(new Decimal(self.selectedSellQuantityCustom()).div(self.selectedBuyQuantity()), 8).toFloat();
    else { // sell asset is the base
      assert(self.assetPair()[0] == self.sellAsset());
      //self.selectedBuyQuantity / self.selectedSellQuantityCustom
      return Decimal.round(new Decimal(self.selectedBuyQuantity()).div(self.selectedSellQuantityCustom()), 8).toFloat();
    }
  }, self);
  self.unitPrice = ko.computed(function() {
    //if we've overridden the unit price, return that, otherwise go with the market rate (if there is one)
    return(self.unitPriceCustom() || self.currentMarketUnitPrice());
  }, self);
  self.dispUnitPrice = ko.computed(function() {
    if(!self.unitPrice()) return null;
    return smartFormat(self.unitPrice());
  }, self);
  
  self.sellQuantityRemainingAfterSale = ko.computed(function() {
    if(!self.selectedSellQuantity()) return null;
    var curBalance = WALLET.getBalance(self.selectedAddress(), self.sellAsset());
    //curBalance - self.selectedSellQuantity
    var quantityLeft = Decimal.round(new Decimal(curBalance).sub(self.selectedSellQuantity()), 8).toFloat();
    if(self.sellAsset() == 'BTC') { //include the fee if we're selling BTC
      quantityLeft = Decimal.round(new Decimal(quantityLeft).sub(self.feeForSelectedBTCQuantity()), 8).toFloat();
    }
    //console.log("1.selectedSellQuantity: " + self.selectedSellQuantity());
    //console.log("2.feeForSelectedBTCQuantity: " + self.feeForSelectedBTCQuantity());
    //console.log("3.quantityLeft: " + quantityLeft);
    return quantityLeft;
  }, self);//.extend({ notify: 'always' });
  self.dispSellQuantityRemainingAfterSale = ko.computed(function() {
    return numberWithCommas(noExponents(self.sellQuantityRemainingAfterSale()));
  }, self);
  self.dispSellQuantityRemainingAfterSaleAbs = ko.computed(function() {
    return numberWithCommas(noExponents(Math.abs(self.sellQuantityRemainingAfterSale())));
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
    selectedBuyQuantity: self.selectedBuyQuantity,
    customSellAsEntry: self.customSellAsEntry,
    selectedUnitPrice: self.selectedUnitPrice,
    numBlocksUntilExpiration: self.numBlocksUntilExpiration,
    btcFee: self.btcFee,
    btcFeeAs: self.btcFeeAs
  });  

  self.validationModelTab2BTCFee = ko.validatedObservable({
    btcFee: self.btcFee,
    btcFeeAs: self.btcFeeAs
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

    //Get a list of all assets this user has balances of
    var addresses = WALLET.getAddressesList();
    var assets = [];
    for(var i=0; i < addresses.length; i++) {
        assets = assets.concat(WALLET.getAddressObj(addresses[i]).getAssetsList());
    }
    assets = assets.remove('XCP').remove('BTC').unique();
    self.myAssets(assets);
    
    self.buyAsset.subscribe(function(newValue) {
      self.selectedAddress(''); //clear it
      //setTimeout(function() { self.selectedAddress(''); }, 20); //clear it
      if(!newValue) return;
      if(newValue == 'XCP' || newValue == 'BTC') {
        self.buyAssetIsDivisible(true);
        return;
      }
      failoverAPI("get_asset_info", [[newValue]], function(assetsInfo, endpoint) {
        self.buyAssetIsDivisible(assetsInfo[0]['divisible']);
      });    
    });

    self.sellAsset.subscribe(function(newValue) {
      self.selectedAddress(''); //clear it
    });
    
    self.selectedAddress.subscribe(function(newValue) {
      if(!newValue) $('#buySellFromAddress').select2("val", "");
      //^ hack to get the select box to TOTALLY clear selectedAddress is cleared
      // ...without this, it will clear the options listing, but previously selected option (if any) will stay
      // visible as selected, even though there are no options
    });
    
    //auto refresh the order book tuned to the entered fee, if it applies
    self.delayedFeeForSelectedBTCQuantity.subscribeChanged(function(newValue, prevValue) {
      assert(self.buyAsset() == 'BTC' || self.sellAsset() == 'BTC'); //should not fire otherwise, as the field would not be shown
      if(!self.validationModelTab2BTCFee.isValid()) return;
      self.tab2RefreshOrderBook(); //refresh the order book
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
        $.jqlog.debug("onTabShow: " + current);
        self.currentTab(current);
        
        if(current == 1) { //going BACK to tab 1
          self._tab2StopAutoRefresh();
          self.allTradeDataRetrieved(false);
          self.showPriceChart(false);
          self.showTradeHistory(false);
          self.showOpenOrders(false);
          self.overrideMarketPrice(false);
          self.overrideDefaultOptions(false);
          $('a[href="#tab2"] span.title').text("Select Quantitys");
          $('#tradeHistory').dataTable().fnClearTable(); //otherwise we get duplicate rows for some reason...
          
          //reset the fields on tab 2
          self.selectedBuyQuantity(null);
          self.selectedSellQuantityCustom(null);
          self.customSellAsEntry(null);
          self.currentMarketUnitPrice(null);
          self.numBlocksUntilExpiration(ORDER_DEFAULT_EXPIRATION);
          self.btcFee(ORDER_DEFAULT_BTCFEE_PCT);
          self.btcFeeAs('percentage');
          self.tradeHistory([]);
          self.openOrders([]);
          self.askBook([]);
          self.bidBook([]);
          self.bidAskMedian(null);
          self.bidDepth(null);
          self.askDepth(null);
        } else if(current == 2) {
          assert(self.assetPair(), "Asset pair is not set");
          self.selectedBuyQuantity.isModified(false);
          self.customSellAsEntry.isModified(false);
          $('a[href="#tab2"] span.title').text("Select Quantitys (" + self.dispAssetPair() + ")");

          //Set up the timer to refresh market data (this will immediately refresh and display data as well)
          self._tab2AutoRefresh(function() { self.allTradeDataRetrieved(true); });
        } else {
          assert(current == 3, "Unknown wizard tab change!");
          self.showTradeHistory(false);
          self.showOpenOrders(false);
          $('#tradeHistory').dataTable().fnClearTable(); //otherwise we get duplicate rows for some reason...
          self._tab2StopAutoRefresh();
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
        $.jqlog.debug("onNext: " + index);
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
          var buyQuantity = denormalizeQuantity(self.selectedBuyQuantity(), self.buyAssetIsDivisible());
          var sellQuantity = denormalizeQuantity(self.selectedSellQuantity(), self.sellAssetIsDivisible());

          WALLET.doTransaction(self.selectedAddress(), "create_order",
            {source: self.selectedAddress(),
             give_quantity: sellQuantity,
             give_asset: self.sellAsset(),
             _give_divisible: self.sellAssetIsDivisible(),
             get_quantity: buyQuantity,
             get_asset: self.buyAsset(),
             _get_divisible: self.buyAssetIsDivisible(),
             fee_required: self.buyAsset() == 'BTC' ? denormalizeQuantity(self.feeForSelectedBTCQuantity()) : null,
             fee_provided: self.sellAsset() == 'BTC' ? denormalizeQuantity(self.feeForSelectedBTCQuantity()) : null,
             expiration: parseInt(self.numBlocksUntilExpiration())
            },
            function() {
              bootbox.alert("Your order for <b class='notoQuantityColor'>" + self.selectedBuyQuantity() + "</b>"
               + " <b class='notoAssetColor'>" + self.buyAsset() + "</b> has been placed. "
               + ACTION_PENDING_NOTICE);
              checkURL(); //reset the form and take the user back to the first tab by just refreshing the page
            }
          );
        }
      }
    });
  }

  self._tab2AutoRefresh = function(callback) {
    if(self.currentTab() != 2) return; //stop refreshing
    $.jqlog.debug("Refreshing market data for " + self.dispAssetPair() + ' ...');
    var d1 = self.tab2RefreshMarketUnitPrice();
    var d2 = self.tab2RefreshPriceChart();
    var d3 = self.tab2RefreshTradeHistory();
    var d4 = self.tab2RefreshOrderBook();
    $.when(d1, d2, d3, d4).done(function(d1, d2, d3, d4) {
      self.MARKET_DATA_REFRESH_TIMERID = setTimeout(self._tab2AutoRefresh, MARKET_INFO_REFRESH_EVERY);
      if(callback) callback();
    });
  }
  
  self._tab2StopAutoRefresh = function() {
    if(self.MARKET_DATA_REFRESH_TIMERID) { //stop auto update of market data
      clearTimeout(self.MARKET_DATA_REFRESH_TIMERID);
      self.MARKET_DATA_REFRESH_TIMERID = null;
    }
  }

  self.tab2RefreshMarketUnitPrice = function() {
    if(self.currentTab() != 2) return;
    var deferred = $.Deferred();
    //get the market price (if available) for display
    failoverAPI("get_market_price_summary", [self.buyAsset(), self.sellAsset()], function(data, endpoint) {
      self.currentMarketUnitPrice(data['market_price'] || 0);
      //^ use 0 to signify that we got the data, but that there is no established market price
      deferred.resolve();
    }, function(jqXHR, textStatus, errorThrown, endpoint) {
      deferred.resolve();
      return defaultErrorHandler(jqXHR, textStatus, errorThrown, endpoint);
    });
  }
          
  self.tab2RefreshPriceChart = function() {
    if(self.currentTab() != 2) return;
    var deferred = $.Deferred();
    //now that an asset pair is picked, we can show a price chart for that pair
    failoverAPI("get_market_price_history", [self.buyAsset(), self.sellAsset()], function(data, endpoint) {
      deferred.resolve();
      if(data.length) {
        self.showPriceChart(true);
        self.doChart($('#priceHistory'), data);
      } else {
        self.showPriceChart(false);
      }
    }, function(jqXHR, textStatus, errorThrown, endpoint) {
      deferred.resolve();
      return defaultErrorHandler(jqXHR, textStatus, errorThrown, endpoint);
    });
  }

  self.tab2RefreshTradeHistory = function() {
    if(self.currentTab() != 2) return;
    var deferred = $.Deferred();
    failoverAPI("get_trade_history_within_dates", [self.buyAsset(), self.sellAsset()], function(data, endpoint) {
      deferred.resolve();
      self.tradeHistory(data);
      if(data.length) {
        runDataTables('#tradeHistory', true, { "aaSorting": [ [0, 'desc'] ] });
        self.showTradeHistory(true);
      } else {
        self.showTradeHistory(false);
      }
    }, function(jqXHR, textStatus, errorThrown, endpoint) {
      deferred.resolve();
      return defaultErrorHandler(jqXHR, textStatus, errorThrown, endpoint);
    });
  }

  self.tab2RefreshOrderBook = function() {
    if(self.currentTab() != 2) return;
    var deferred = $.Deferred();
    var args = {'buy_asset': self.buyAsset(), 'sell_asset': self.sellAsset()};
    //default to 0 fee (showing all orders) if no buy amount is entered into the order book
    if(self.buyAsset() == 'BTC' && self.feeForSelectedBTCQuantityAsPct() !== null) {
      args['pct_fee_required'] = self.feeForSelectedBTCQuantityAsPct() / 100;
    } else if(self.sellAsset() == 'BTC' && self.feeForSelectedBTCQuantityAsPct() !== null) {
      args['pct_fee_provided'] = self.feeForSelectedBTCQuantityAsPct() / 100; 
    }
    
    failoverAPI("get_order_book_buysell", args, function(data, endpoint) {
      deferred.resolve();
      if(data['raw_orders'] && data['raw_orders'].length) {
        //we have an order book, showPriceChart should end up being set to true and the order book will show
        //set up order book display
        data['base_ask_book'].reverse(); //for display
        self.askBook(data['base_ask_book'].slice(0,7)); //limit to 7 entries
        self.bidBook(data['base_bid_book'].slice(0,7));
        self.bidAskMedian(data['bid_ask_median']);
        self.bidDepth(data['bid_depth']);
        self.askDepth(data['ask_depth']);
      }
      
      //show all open orders for the selected asset pair
      try { $('#openOrders').dataTable().fnClearTable(); } catch(err) { }
      //^ hack...rows seem to hang around and be duplicated otherwise      
      self.openOrders(data['open_sell_orders']);
      //now that we have the complete data, show the orders listing
      if(self.openOrders().length) {
        runDataTables('#openOrders', true, { "aaSorting": [ [0, 'desc'] ] });
        self.showOpenOrders(true);
      } else {
        self.showOpenOrders(false);
      }
    }, function(jqXHR, textStatus, errorThrown, endpoint) {
      deferred.resolve();
      return defaultErrorHandler(jqXHR, textStatus, errorThrown, endpoint);
    });
  }
  
  self.getMaxAfford = function(unitPrice) {
    var pair = self.assetPair();
    if(self.buyAsset() == pair[0]) { //buy asset is the base asset
      //self.totalBalanceAvailForSale / self.currentMarketUnitPrice
      var maxAfford = Decimal.round(new Decimal(self.totalBalanceAvailForSale()).div(unitPrice), 8).toFloat();
    } else { //sell asset is the base asset
      //self.totalBalanceAvailForSale * self.currentMarketUnitPrice
      var maxAfford = Decimal.round(new Decimal(self.totalBalanceAvailForSale()).mul(unitPrice), 8).toFloat();
    }
    return maxAfford;
  }
  
  self.derivePendingOrderAssetQuantity = function(asset, quantity) {
    //helper function for showing pending trades
    assert(asset && quantity, "Asset and/or quantity not present");
    if(asset == self.buyAsset()) {
      return smartFormat(normalizeQuantity(quantity, self.buyAssetIsDivisible()));
    } else {
      assert(asset == self.sellAsset());
      return smartFormat(normalizeQuantity(quantity, self.sellAssetIsDivisible()));
    }
  }

  self.derivePendingOrderAssetPrice = function(asset1, quantity1, asset2, quantity2) {
    //helper function for showing pending trades
    assert(asset1 && quantity1, "Asset1 and/or quantity1 not present");
    assert(asset2 && quantity2, "Asset2 and/or quantity2 not present");
    var derivedQuantity1 = self.derivePendingOrderAssetQuantity(asset1, quantity1);
    var derivedQuantity2 = self.derivePendingOrderAssetQuantity(asset2, quantity2);
    
    if(asset1 == self.baseAsset()) {
      return smartFormat(Decimal.round(new Decimal(derivedQuantity2).div(derivedQuantity1), 8).toFloat());
    } else {
      assert(asset2 == self.baseAsset());
      return smartFormat(Decimal.round(new Decimal(derivedQuantity1).div(derivedQuantity2), 8).toFloat());
    }
  }
  
  self.derivePendingOrderExpiresIn = function(blockIndexCreatedAt, expiration) {
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
  
  self._afterSelectedAnOpenOrder = ko.observable(false);
  self.buySelectedOpenOrder = function(order) {
    //called when a user clicks on an open order they would like to buy. should fill in the details for them on the buy page
    self.overrideMarketPrice(true);
    self.customSellAs('unitprice');
    var unitPrice = self.derivePendingOrderAssetPrice(
      order['get_asset'], order['get_quantity'], order['give_asset'], order['give_quantity'])
    self.customSellAsEntry(unitPrice);
    var maxAfford = self.getMaxAfford(unitPrice);
    var totalSaleAmount = self.derivePendingOrderAssetQuantity(order['give_asset'], order['give_remaining']);
    var buyAmount = Math.min(maxAfford, totalSaleAmount);
    self.selectedBuyQuantity(buyAmount);

    //The below is an awful, horrible hack because for some reason, the "invalid balance" message will get triggered and
    // not receive updated obervable notifications (which DO change value)....when it should even't be visible in the first
    // place, because it got an amount where it should have shown, but then didn't disappear when that amount changed, e.g.
    //1.selectedSellQuantity: 14.09602 buysell.js:402
    //2.feeForSelectedBTCQuantity: 0.1409602 buysell.js:403
    //3.quantityLeft: -11.8629786 buysell.js:404              <-- showed up, as it should
    //1.selectedSellQuantity: 0.99999985 buysell.js:402
    //2.feeForSelectedBTCQuantity: 0.1409602 buysell.js:403
    //3.quantityLeft: 1.23304155                              <-- did NOT disappear... ????
    $.jqlog.debug("Activating _afterSelectedAnOpenOrder guard");
    self._afterSelectedAnOpenOrder(true);
    setTimeout(function() { $.jqlog.debug("Deactivating _afterSelectedAnOpenOrder guard"); self._afterSelectedAnOpenOrder(false); }, 2500);

    $("body").animate({ scrollTop: 0 }, "fast"); //scroll to top of screen
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
            WALLET.doTransaction(self.selectedAddress(), "create_cancel",
              {
                offer_hash: item['tx_hash'],
                _type: 'order',
                _tx_index: item['tx_index']
              },
              function() {
                bootbox.alert("Your order cancellation has been submitted. " + ACTION_PENDING_NOTICE);
              }
            );
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


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
