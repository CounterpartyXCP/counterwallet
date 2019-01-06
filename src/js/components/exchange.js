var BuySellAddressInDropdownItemModel = function(address, label, asset, balance) {
  this.ADDRESS = address;
  this.LABEL = label;
  this.SELECT_LABEL = (label ? ("<b>" + label + "</b><br/>" + address + "<br/>" + asset + " " + i18n.t('bal') + " " + balance) : (address + "<br/>" + asset + " " + i18n.t('bal') + " " + balance));
  this.BALANCE = parseFloat(balance);
};

function createExchangeKnockoutValidators() {
  ko.validation.rules['ordersIsExistingAssetName'] = {
    validator: function(asset, self) {
      if (asset === KEY_ASSET.XCP) return true;
      var match = ko.utils.arrayFirst(self.allAssets(), function(item) {
        return asset == item['asset'] || (item['asset_longname'] && asset == item['asset_longname']); //matches asset name or asset longname
      });
      return match;
    },
    message: i18n.t("asset_doesnt_exist")
  };

  ko.validation.rules['baseDivisibilityIsOk'] = {
    validator: function(value, self) {
      if (!self.baseAssetIsDivisible() && (value % 1) > 0) {
        return false;
      } else {
        return true;
      }
    },
    message: i18n.t("nodivisible_amount_incorrect")
  };

  ko.validation.rules['quoteDivisibilityIsOk'] = {
    validator: function(value, self) {
      if (!self.quoteAssetIsDivisible() && (value % 1) > 0) {
        return false;
      } else {
        return true;
      }
    },
    message: i18n.t("nodivisible_total_incorrect")
  };

  ko.validation.registerExtenders();
}

function ExchangeViewModel() {
  var self = this;
  createExchangeKnockoutValidators();

  self.dexHome = ko.observable(true);

  self._lastWindowWidth = null;

  self.latestTrades = ko.observableArray([]); //populated with the VIEW_PRICES_NUM_LATEST_TRADES latest trades (of any asset pair)
  self.allAssets = ko.observableArray([]);
  //^ a list of all existing assets (for choosing which asset to buy)
  self.tradeHistory = ko.observableArray([]);
  //^ a list of the last X trades for the specified asset pair
  self.askBook = ko.observableArray([]);
  self.bidBook = ko.observableArray([]);

  self.asset1IsDivisible = ko.observable(null);
  self.asset2IsDivisible = ko.observable(null);

  self.asset1Raw = ko.observable('').extend({
    required: true,
    ordersIsExistingAssetName: self
  });
  self.asset1 = ko.computed(function() {
    /* "Token 1" as entered under "Select Another Pair". Will be the numeric asset name with subassets, while asset1Raw is == the subasset longname (or whatever was entered)*/
    if (!self.asset1Raw() || !self.allAssets()) return null;
    var match = ko.utils.arrayFirst(self.allAssets(), function(item) {
      return self.asset1Raw() == item['asset'] || (item['asset_longname'] && self.asset1Raw() == item['asset_longname']); //matches asset name or asset longname
    });
    return match['asset'];
  }, self);
  self.asset1Longname = ko.observable('');
  self.asset2Raw = ko.observable('').extend({
    required: true,
    ordersIsExistingAssetName: self,
    validation: {
      validator: function(val, self) {
        return val !== self.asset1();
      },
      message: i18n.t('same_as_other_asset'),
      params: self
    }
  });
  self.asset2 = ko.computed(function() {
    /* "Token 2" as entered under "Select Another Pair". Will be the numeric asset name with subassets, while asset2Raw is == the subasset longname (or whatever was entered)*/
    if (!self.asset2Raw() || !self.allAssets()) return null;
    var match = ko.utils.arrayFirst(self.allAssets(), function(item) {
      return self.asset2Raw() == item['asset'] || (item['asset_longname'] && self.asset2Raw() == item['asset_longname']); //matches asset name or asset longname
    });
    return match['asset'];
  }, self);
  self.asset2Longname = ko.observable('');

  self.selectedQuoteAsset = ko.observable();
  self.selectedQuoteAsset.subscribe(function(value) {
    if (value === KEY_ASSET.XCP) {
      self.asset2Raw(value);
    } else {
      self.asset2Raw('');
    }
  })

  self.assetPair = ko.computed(function() {
    if (!self.asset1() || !self.asset2()) return null;
    var pair = assetsToAssetPair(self.asset1(), self.asset2());
    return pair; //2 element array, as [baseAsset, quoteAsset]
  }, self);
  self.dispAssetPair = ko.computed(function() {
    if (!self.asset1() || !self.asset2()) return null;
    var pair = assetsToAssetPair(self.asset1(), self.asset2());
    if(pair[0] === self.asset1()) {
      return (self.asset1Longname() || self.asset1()) + '/' + (self.asset2Longname() || self.asset2());
    } else {
      return (self.asset2Longname() || self.asset2()) + '/' + (self.asset1Longname() || self.asset1());
    }
  }, self);
  self.dispAssetPair.subscribeChanged(function(newValue, prevValue) {
    self.currentMarketPrice(0);
  });
  self.baseAsset = ko.computed(function() {
    if (!self.assetPair()) return null;
    return self.assetPair()[0];
  }, self);
  self.baseAssetIsDivisible = ko.computed(function() {
    if (!self.assetPair()) return null;
    return self.baseAsset() == self.asset1() ? self.asset1IsDivisible() : self.asset2IsDivisible();
  }, self);
  self.baseAssetLongname = ko.computed(function() {
    if (!self.assetPair()) return null;
    if(self.assetPair()[0] === self.asset1()) {
      return self.asset1Longname();
    } else {
      return self.asset2Longname();
    }
  }, self);
  self.dispBaseAsset = ko.computed(function() {
    if (!self.baseAsset()) return null;
    return self.baseAssetLongname() ? _.truncate(self.baseAssetLongname(), 24) : self.baseAsset();
  }, self);

  self.quoteAsset = ko.computed(function() {
    if (!self.assetPair()) return null;
    return self.assetPair()[1];
  }, self);
  self.quoteAssetIsDivisible = ko.computed(function() {
    if (!self.assetPair()) return null;
    return self.quoteAsset() == self.asset1() ? self.asset1IsDivisible() : self.asset2IsDivisible();
  }, self);
  self.quoteAssetLongname = ko.computed(function() {
    if (!self.assetPair()) return null;
    if(self.assetPair()[1] === self.asset1()) {
      return self.asset1Longname();
    } else {
      return self.asset2Longname();
    }
  }, self);
  self.dispQuoteAsset = ko.computed(function() {
    if (!self.quoteAsset()) return null;
    return self.quoteAssetLongname() ? _.truncate(self.quoteAssetLongname(), 24) : self.quoteAsset();
  }, self);

  self.delayedAssetPairSelection = ko.computed(self.assetPair).extend({
    rateLimit: {
      method: "notifyWhenChangesStop",
      timeout: 400
    }
  });
  self.delayedAssetPairSelection.subscribeChanged(function(newValue, prevValue) {
    if (newValue == null || !self.validationModelBaseOrders.isValid() || self.asset1() == self.asset2()) {
      self.dexHome(true);
      return;
    }
    self.buyAmount(0);
    self.sellAmount(0);
    self.buyTotal(0);
    self.sellTotal(0);
    self.selectedAddressForBuy(null);
    self.selectedAddressForSell(null);
    $('table.buySellForm span.invalid').hide(); // hack
    self.baseAssetImage('');
    self.dexHome(false);
    self.fetchMarketDetails();
    $('a.top_user_pair').removeClass('selected_pair');
    $('a.top_user_pair.pair_' + self.baseAsset() + self.quoteAsset()).addClass('selected_pair');

    self.buyValidation.errors.showAllMessages(false);
    self.sellValidation.errors.showAllMessages(false);

    if(self.asset1Raw() != self.asset1()) {
      assert(self.asset1Raw().includes('.'));
      self.asset1Longname(self.asset1Raw());
    }
    if(self.asset2Raw() != self.asset2()) {
      assert(self.asset2Raw().includes('.'));
      self.asset2Longname(self.asset2Raw());
    }

    self.buyFeeOption('optimal');
    self.buyCustomFee(null);
    self.sellFeeOption('optimal');
    self.sellCustomFee(null);
    $('#buyFeeOption').select2("val", self.buyFeeOption()); //hack
    $('#sellFeeOption').select2("val", self.sellFeeOption()); //hack
  });

  //VALIDATION MODELS
  self.validationModelBaseOrders = ko.validatedObservable({
    asset1Raw: self.asset1Raw,
    asset2Raw: self.asset2Raw
  });


  self.balances = {};
  self.currentMarketPrice = ko.observable();
  self.marketProgression24h = ko.observable();
  self.baseAssetImage = ko.observable('');

  self.marketProgression24hDisp = ko.computed(function() {
    var span = $('<span></span>').css('font-size', '12px').css('color', '#000');
    if (self.marketProgression24h() == 0) {
      span.text('0%');
    } else if (self.marketProgression24h() > 0) {
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
  self.sellPrice = ko.observable(0).extend({
    required: true,
    isValidPositiveQuantity: self
  });
  self.sellAmount = ko.observable(0).extend({
    required: true,
    baseDivisibilityIsOk: self
  });
  self.sellTotal = ko.observable(0).extend({
    required: true,
    isValidPositiveQuantity: self,
    quoteDivisibilityIsOk: self
  });
  self.sellFeeOption = ko.observable('optimal');
  self.sellCustomFee = ko.observable(null).extend({
    validation: [{
      validator: function(val, self) {
        return self.sellFeeOption() === 'custom' ? val : true;
      },
      message: i18n.t('field_required'),
      params: self
    }],
    isValidCustomFeeIfSpecified: self
  });
  self.sellPriceHasFocus = ko.observable();
  self.sellAmountHasFocus = ko.observable();
  self.sellTotalHasFocus = ko.observable();
  self.obtainableForSell = ko.observable();
  self.selectedAddressForSell = ko.observable();
  self.availableBalanceForSell = ko.observable();

  self.sellFeeOption.subscribeChanged(function(newValue, prevValue) {
    if(newValue !== 'custom') {
      self.sellCustomFee(null);
      self.sellCustomFee.isModified(false);
    }
  });

  self.availableAddressesForSell = ko.computed(function() { //stores BuySellAddressInDropdownItemModel objects
    if (!self.baseAsset()) return null; //must have a sell asset selected
    //Get a list of all of my available addresses with the specified sell asset balance
    var addresses = WALLET.getAddressesList(true);
    var addressesWithBalance = [];
    var bal = null, address = null, addressObj = null;
    for (var i = 0; i < addresses.length; i++) {
      address = addresses[i][0];
      addressObj = WALLET.getAddressObj(address);
      bal = WALLET.getBalance(address, self.baseAsset());
      if (addressObj.IS_WATCH_ONLY) continue; //don't list watch addresses, obviously
      if (bal) {
        addressesWithBalance.push(new BuySellAddressInDropdownItemModel(addresses[i][0], addresses[i][1], self.baseAsset(), bal));
        self.balances[addresses[i][0] + '_' + self.baseAsset()] = parseFloat(bal);
      }
    }

    addressesWithBalance.sort(function(left, right) {
      return left.BALANCE == right.BALANCE ? 0 : (left.BALANCE > right.BALANCE ? -1 : 1);
    });

    if (addressesWithBalance.length == 0) {
      $('#sellButton').addClass('disabled');
      $('div.sellForm').addClass('disabled');
      self.availableBalanceForSell(0);
      self.obtainableForSell(0);
    } else {
      $('#sellButton').removeClass('disabled');
      $('div.sellForm').removeClass('disabled');
    }


    return addressesWithBalance;
  }, self);

  self.selectedAddressForSell.subscribe(function(value) {
    if (!value) return;
    var bal = self.balances[value + '_' + self.baseAsset()];
    self.availableBalanceForSell(bal);
    self.obtainableForSell(mulFloat(bal, self.highestBidPrice()));
  })

  self.sellPrice.subscribe(function(price) {
    if (!self.sellPriceHasFocus() || !self.sellAmount()) return;
    self.sellTotal(noExponents(mulFloat(self.sellAmount(), price)));
  })

  self.sellAmount.subscribe(function(amount) {
    if (!self.sellAmountHasFocus() || !self.sellPrice()) return;
    self.sellTotal(noExponents(mulFloat(self.sellPrice(), amount)));
  })

  self.sellTotal.subscribe(function(total) {
    if (!self.sellTotalHasFocus() || !self.sellPrice()) return;
    if (total == 0) {
      self.sellAmount(0);
    } else {
      self.sellAmount(noExponents(divFloat(total, self.sellPrice())));
    }
  })

  self.sellAmount.extend({
    required: true,
    isValidPositiveQuantity: self,
    validation: {
      validator: function(val, self) {
        return parseFloat(val) <= self.availableBalanceForSell();
      },
      message: i18n.t('quantity_exceeds_balance'),
      params: self
    }
  });

  self.sellValidation = ko.validatedObservable({
    sellAmount: self.sellAmount,
    sellPrice: self.sellPrice,
    sellTotal: self.sellTotal,
    sellCustomFee: self.sellCustomFee
  });


  self.selectBuyOrder = function(order, notFromClick) {
    var price = new Decimal(cleanHtmlPrice(order.price));
    var amount1 = new Decimal(self.availableBalanceForSell());
    var amount2 = new Decimal(order.base_depth);
    var amount = amount1.compare(amount2) > 0 ? amount2 : amount1;
    var total;

    if (self.quoteAssetIsDivisible() == self.baseAssetIsDivisible()) {
      total = price.mul(amount);
    } else if (self.quoteAssetIsDivisible() && !self.baseAssetIsDivisible()) {
      amount = Math.floor(amount);
      total = mulFloat(amount, price);
    } else if (!self.quoteAssetIsDivisible() && self.baseAssetIsDivisible()) {
      total = Math.floor(price.mul(amount));
      amount = divFloat(total, price);
    }

    self.sellPrice(roundAmount(price));
    self.sellAmount(roundAmount(amount));
    self.sellTotal(roundAmount(total));

    if (typeof(notFromClick) != 'boolean' || notFromClick == false) {
      self.selectSellOrder(order, true);
    }
  }

  self.setMaxSellAmount = function() {
    var amount = self.availableBalanceForSell();
    if (self.sellPrice()) {
      if (self.quoteAssetIsDivisible()) {
        self.sellTotal(mulFloat(self.sellPrice(), amount));
      } else {
        var total = Math.floor(mulFloat(self.sellPrice(), amount));
        self.sellTotal(total);
        amount = divFloat(total, self.sellPrice());
      }
    }
    self.sellAmount(amount);
  }

  self.doSell = function() {
    var onSuccess = function(txHash, data, endpoint, addressType, armoryUTx) {
      trackEvent('Exchange', 'Sell', self.dispAssetPair());

      var message = "";
      if (armoryUTx) {
        message = i18n.t("you_sell_order_will_be_placed", self.sellAmount(), self.dispBaseAsset());
      } else {
        message = i18n.t("you_sell_order_has_been_placed", self.sellAmount(), self.dispBaseAsset());
      }

      WALLET.showTransactionCompleteDialog(message + " " + i18n.t(ACTION_PENDING_NOTICE), message, armoryUTx);
    }

    var params = self.buildSellTransactionData();

    WALLET.doTransactionWithTxHex(self.selectedAddressForSell(), "create_order", params, self.sellFeeController.getUnsignedTx(), onSuccess);
  }

  self.buildSellTransactionData = function() {
    var give_quantity = denormalizeQuantity(self.sellAmount(), self.baseAssetIsDivisible());
    var get_quantity = denormalizeQuantity(self.sellTotal(), self.quoteAssetIsDivisible());
    var fee_required = 0;
    var fee_provided = 0;
    var expiration = parseInt(WALLET_OPTIONS_MODAL.orderDefaultExpiration());

    return {
      source: self.selectedAddressForSell(),
      give_quantity: give_quantity,
      give_asset: self.baseAsset(),
      _give_asset_divisible: self.baseAssetIsDivisible(),
      _give_asset_longname: self.baseAssetLongname(),
      get_quantity: get_quantity,
      get_asset: self.quoteAsset(),
      _get_asset_divisible: self.quoteAssetIsDivisible(),
      _get_asset_longname: self.quoteAssetLongname(),
      fee_required: fee_required,
      fee_provided: fee_provided,
      expiration: expiration,
      _fee_option: 'custom',
      _custom_fee: self.sellFeeController.getCustomFee()
/*      _fee_option: self.sellFeeOption(),
      _custom_fee: self.sellCustomFee()*/
    }
  }

  // mix in shared fee calculation functions
  self.sellFeeController = CWFeeModelMixin(self, {
    prefix: 'sell_',
    action: "create_order",
    transactionParameters: [self.selectedAddressForSell, self.sellPrice, self.sellAmount, self.baseAsset, self.asset1, self.asset2],
    validTransactionCheck: function() {
      if (!self.sellValidation.isValid()) { return false; }
      if (!WALLET.canDoTransaction(self.selectedAddressForSell())) { return false; }
      return true;
    },
    buildTransactionData: self.buildSellTransactionData,
    address: self.selectedAddressForSell
  });
/*
    var onSuccess = function(txHash, data, endpoint, addressType, armoryUTx) {
      trackEvent('Exchange', 'Sell', self.dispAssetPair());

      var message = "";
      if (armoryUTx) {
        message = i18n.t("you_sell_order_will_be_placed", self.sellAmount(), self.dispBaseAsset());
      } else {
        message = i18n.t("you_sell_order_has_been_placed", self.sellAmount(), self.dispBaseAsset());
      }
*/



  self.sell = function() {
    if (!self.sellValidation.isValid()) {
      self.sellValidation.errors.showAllMessages();
      return false;
    }

    if (!WALLET.canDoTransaction(self.selectedAddressForSell()))
      return false;

    var buyOrders = self.bidBook();
    var amountCumul = 0;
    var estimatedTotalPrice = 0;
    for (var i = 0; i < buyOrders.length; i++) {
      if (buyOrders[i]['price'] >= self.sellPrice() && amountCumul < self.sellAmount()) {
        var vol = Math.min(self.sellAmount() - amountCumul, buyOrders[i]['amount']);
        estimatedTotalPrice += mulFloat(vol, buyOrders[i]['price']);
        amountCumul += vol;
      }
    }
    if (amountCumul < self.sellAmount()) {
      estimatedTotalPrice += mulFloat(self.sellAmount() - amountCumul, self.sellPrice());
    }

    estimatedTotalPrice = smartFormat(estimatedTotalPrice);

    var message = '<table class="confirmOrderBox">';
    message += '<tr><td><b>' + i18n.t('price') + ': </b></td><td style="text-align:right">' + self.sellPrice() + '</td><td>' + self.dispQuoteAsset() + '</td></tr>';
    message += '<tr><td><b>' + i18n.t('amount') + ': </b></td><td style="text-align:right">' + self.sellAmount() + '</td><td>' + self.dispBaseAsset() + '</td></tr>';
    message += '<tr><td><b>' + i18n.t('total') + ': </b></td><td style="text-align:right">' + self.sellTotal() + '</td><td>' + self.dispQuoteAsset() + '</td></tr>';
    message += '<tr><td><b>' + i18n.t('real_estimated_total') + ': </b></td><td style="text-align:right">' + estimatedTotalPrice + '</td><td>' + self.dispQuoteAsset() + '</td></tr>';
    message += '<tr><td><b>' + i18n.t('fee') + ': </b></td><td style="text-align:right">' + self.sellFeeController.getFeeInBTC() + '</td><td>' + KEY_ASSET.BTC + ' ('+self.sellFeeController.getFeeInFiat()+' ' + KEY_ASSET.USD + ')</td></tr>';
    message += '</table>';

    bootbox.dialog({
      title: i18n.t("confirm_your_order"),
      message: message,
      buttons: {
        "cancel": {
          label: i18n.t("close"),
          className: "btn-danger",
          callback: function() {
            bootbox.hideAll();
            return false;
          }
        },
        "confirm": {
          label: i18n.t("confirm_order"),
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
  self.buyPrice = ko.observable(0).extend({
    required: true,
    isValidPositiveQuantity: self
  });
  self.buyAmount = ko.observable(0).extend({
    required: true,
    isValidPositiveQuantity: self,
    baseDivisibilityIsOk: self
  });
  self.buyTotal = ko.observable(0).extend({
    required: true,
    isValidPositiveQuantity: self,
    quoteDivisibilityIsOk: self
  });
  self.buyFeeOption = ko.observable('optimal');
  self.buyCustomFee = ko.observable(null).extend({
    validation: [{
      validator: function(val, self) {
        return self.buyFeeOption() === 'custom' ? val : true;
      },
      message: i18n.t('field_required'),
      params: self
    }],
    isValidCustomFeeIfSpecified: self
  });

  self.buyPriceHasFocus = ko.observable();
  self.buyAmountHasFocus = ko.observable();
  self.buyTotalHasFocus = ko.observable();
  self.obtainableForBuy = ko.observable();
  self.selectedAddressForBuy = ko.observable();
  self.availableBalanceForBuy = ko.observable();

  self.buyFeeOption.subscribeChanged(function(newValue, prevValue) {
    if(newValue !== 'custom') {
      self.buyCustomFee(null);
      self.buyCustomFee.isModified(false);
    }
  });

  self.availableAddressesForBuy = ko.computed(function() { //stores BuySellAddressInDropdownItemModel objects
    if (!self.quoteAsset()) return null; //must have a sell asset selected
    //Get a list of all of my available addresses with the specified sell asset balance
    var addresses = WALLET.getAddressesList(true);
    var addressesWithBalance = [];
    var bal = null, address = null, addressObj = null;
    for (var i = 0; i < addresses.length; i++) {
      address = addresses[i][0];
      addressObj = WALLET.getAddressObj(address);
      bal = WALLET.getBalance(address, self.quoteAsset());
      if (addressObj.IS_WATCH_ONLY) continue; //don't list watch addresses, obviously
      if (bal) {
        addressesWithBalance.push(new BuySellAddressInDropdownItemModel(addresses[i][0], addresses[i][1], self.quoteAsset(), bal));
        self.balances[addresses[i][0] + '_' + self.quoteAsset()] = parseFloat(bal);
      }
    }

    addressesWithBalance.sort(function(left, right) {
      return left.BALANCE == right.BALANCE ? 0 : (left.BALANCE > right.BALANCE ? -1 : 1);
    });

    if (addressesWithBalance.length == 0) {
      $('#buyButton').addClass('disabled');
      $('div.buyForm').addClass('disabled');
      self.availableBalanceForBuy(0);
      self.obtainableForBuy(0);
    } else {
      $('#buyButton').removeClass('disabled');
      $('div.buyForm').removeClass('disabled');
    }

    return addressesWithBalance;
  }, self);

  self.selectedAddressForBuy.subscribe(function(value) {
    var bal = self.balances[value + '_' + self.quoteAsset()];
    self.availableBalanceForBuy(bal);
    if (self.lowestAskPrice()) {
      if (bal == 0) {
        self.obtainableForBuy(0);
      } else {
        self.obtainableForBuy(divFloat(bal, self.lowestAskPrice()));
      }
    }
  })

  self.buyPrice.subscribe(function(price) {
    if (!self.buyPriceHasFocus() || !self.buyAmount()) return;
    self.buyTotal(noExponents(mulFloat(self.buyAmount(), price)));
  })

  self.buyAmount.subscribe(function(amount) {
    if (!self.buyAmountHasFocus() || !self.buyPrice()) return;
    self.buyTotal(noExponents(mulFloat(self.buyPrice(), amount)));
  })

  self.buyTotal.subscribe(function(total) {
    if (!self.buyTotalHasFocus() || !self.buyPrice()) return;
    if (total == 0) {
      self.buyAmount(0);
    } else {
      self.buyAmount(noExponents(divFloat(total, self.buyPrice())));
    }
  })

  self.buyTotal.extend({
    required: true,
    isValidPositiveQuantity: self,
    validation: {
      validator: function(val, self) {
        return parseFloat(val) <= self.availableBalanceForBuy();
      },
      message: i18n.t('quantity_exceeds_balance'),
      params: self
    }
  });

  self.buyValidation = ko.validatedObservable({
    buyTotal: self.buyTotal,
    buyPrice: self.buyPrice,
    buyAmount: self.buyAmount,
    buyCustomFee: self.buyCustomFee
  });

  self.selectSellOrder = function(order, notFromClick) {
    var price = new Decimal(cleanHtmlPrice(order.price));
    var amount = new Decimal(order.base_depth);
    var total1 = price.mul(amount);
    var total2 = new Decimal(self.availableBalanceForBuy());
    var total = total1.compare(total2) > 0 ? total2 : total1;

    if (self.quoteAssetIsDivisible() == self.baseAssetIsDivisible()) {
      amount = total.div(price);
    } else if (self.quoteAssetIsDivisible() && !self.baseAssetIsDivisible()) {
      amount = Math.floor(total.div(price));
      total = mulFloat(amount, price);
    } else if (!self.quoteAssetIsDivisible() && self.baseAssetIsDivisible()) {
      total = Math.floor(total);
      amount = total.div(price);
    }

    self.buyPrice(roundAmount(price));
    self.buyTotal(roundAmount(total));
    self.buyAmount(roundAmount(amount));

    if (typeof(notFromClick) != 'boolean' || notFromClick == false) {
      self.selectBuyOrder(order, true);
    }
  }

  self.setMaxBuyAmount = function() {
    var total = self.availableBalanceForBuy();
    if (self.buyPrice()) {
      if (total == 0) {
        self.buyAmount(0);
      } else {
        if (self.baseAssetIsDivisible()) {
          self.buyAmount(divFloat(total, self.buyPrice()));
        } else {
          var amount = Math.floor(divFloat(total, self.buyPrice()));
          self.buyAmount(amount);
          total = mulFloat(amount, self.buyPrice());
        }
      }
    }
    self.buyTotal(total);
  }

  self.doBuy = function() {
    var onSuccess = function(txHash, data, endpoint, addressType, armoryUTx) {
      trackEvent('Exchange', 'Buy', self.dispAssetPair());

      var message = "";
      if (armoryUTx) {
        message = i18n.t("you_buy_order_will_be_placed", self.buyAmount(), self.dispBaseAsset());
      } else {
        message = i18n.t("you_buy_order_has_been_placed", self.buyAmount(), self.dispBaseAsset());
      }

      WALLET.showTransactionCompleteDialog(message + " " + i18n.t(ACTION_PENDING_NOTICE), message, armoryUTx);
    }

    var params = self.buildBuyTransactionData();

    WALLET.doTransactionWithTxHex(self.selectedAddressForBuy(), "create_order", params, self.buyFeeController.getUnsignedTx(), onSuccess);
  }

  self.buildBuyTransactionData = function() {
    var give_quantity = denormalizeQuantity(self.buyTotal(), self.quoteAssetIsDivisible());
    var get_quantity = denormalizeQuantity(self.buyAmount(), self.baseAssetIsDivisible());
    var fee_required = 0;
    var fee_provided = 0;
    var expiration = parseInt(WALLET_OPTIONS_MODAL.orderDefaultExpiration());

    var params = {
      source: self.selectedAddressForBuy(),
      give_quantity: give_quantity,
      give_asset: self.quoteAsset(),
      _give_asset_divisible: self.quoteAssetIsDivisible(),
      _give_asset_longname: self.quoteAssetLongname(),
      get_quantity: get_quantity,
      get_asset: self.baseAsset(),
      _get_asset_divisible: self.baseAssetIsDivisible(),
      _get_asset_longname: self.baseAssetLongname(),
      fee_required: fee_required,
      fee_provided: fee_provided,
      expiration: expiration,
      _fee_option: 'custom',
      _custom_fee: self.buyFeeController.getCustomFee()
    }

    return params;
  };

  // mix in shared fee calculation functions
  self.buyFeeController = CWFeeModelMixin(self, {
    prefix: 'buy_',
    action: "create_order",
    transactionParameters: [self.selectedAddressForBuy, self.buyPrice, self.buyAmount, self.baseAsset, self.asset1, self.asset2],
    validTransactionCheck: function() {
      if (!self.buyValidation.isValid()) { return false; }
      if (!WALLET.canDoTransaction(self.selectedAddressForBuy())) { return false; }
      return true;
    },
    buildTransactionData: self.buildBuyTransactionData,
    address: self.selectedAddressForBuy
  });

  self.buy = function() {
    if (!self.buyValidation.isValid()) {
      self.buyValidation.errors.showAllMessages();
      return false;
    }

    if (!WALLET.canDoTransaction(self.selectedAddressForBuy()))
      return false;

    var sellOrders = self.askBook();
    var amountCumul = 0;
    var estimatedTotalPrice = 0;
    for (var i = 0; i < sellOrders.length; i++) {
      if (sellOrders[i]['price'] <= self.buyPrice() && amountCumul < self.buyAmount()) {
        var vol = Math.min(self.buyAmount() - amountCumul, sellOrders[i]['amount']);
        estimatedTotalPrice += mulFloat(vol, sellOrders[i]['price']);
        amountCumul += vol;
      }
    }
    if (amountCumul < self.buyAmount()) {
      estimatedTotalPrice += mulFloat(self.buyAmount() - amountCumul, self.buyPrice());
    }

    estimatedTotalPrice = smartFormat(estimatedTotalPrice);

    var message = '<table class="confirmOrderBox">';
    message += '<tr><td><b>' + i18n.t('price') + ': </b></td><td style="text-align:right">' + self.buyPrice() + '</td><td>' + self.dispQuoteAsset() + '</td></tr>';
    message += '<tr><td><b>' + i18n.t('amount') + ': </b></td><td style="text-align:right">' + self.buyAmount() + '</td><td>' + self.dispBaseAsset() + '</td></tr>';
    message += '<tr><td><b>' + i18n.t('total') + ': </b></td><td style="text-align:right">' + self.buyTotal() + '</td><td>' + self.dispQuoteAsset() + '</td></tr>';
    message += '<tr><td><b>' + i18n.t('real_estimated_total') + ': </b></td><td style="text-align:right">' + estimatedTotalPrice + '</td><td>' + self.dispQuoteAsset() + '</td></tr>';
    message += '<tr><td><b>' + i18n.t('fee') + ': </b></td><td style="text-align:right">' + self.buyFeeController.getFeeInBTC() + '</td><td>' + KEY_ASSET.BTC +' ('+self.buyFeeController.getFeeInFiat()+' ' + KEY_ASSET.USD + ')</td></tr>';
    message += '</table>';

    bootbox.dialog({
      title: i18n.t("confirm_your_order"),
      message: message,
      buttons: {
        "cancel": {
          label: i18n.t("close"),
          className: "btn-danger",
          callback: function() {
            bootbox.hideAll();
            return false;
          }
        },
        "confirm": {
          label: i18n.t("confirm_order"),
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

  /* TOP USER PAIRS */
  self.topUserPairs = ko.observableArray([]);

  self.displayTopUserPairs = function(data) {
    for (var p in data) {
      var classes = ['top_user_pair'];

      if (data[p]['trend'] > 0) {
        classes.push('txt-color-greenDark');
      } else if (data[p]['trend'] < 0) {
        classes.push('txt-color-red');
      }

      if (parseFloat(data[p]['progression']) > 0) {
        classes.push('progression-up');
      } else if (parseFloat(data[p]['progression']) < 0) {
        classes.push('progression-down');
      }

      if (data[p]['my_order_count']) {
        classes.push('with-open-order');
      }

      classes.push("pair_" + data[p]['base_asset'] + data[p]['quote_asset']);
      data[p]['pair_classes'] = classes.join(' ');
    }
    self.topUserPairs(data);
  }

  self.fetchTopUserPairs = function() {
    var params = {
      'addresses': WALLET.getAddressesList(),
      'max_pairs': 12
    }
    failoverAPI('get_users_pairs', params, self.displayTopUserPairs);
  }

  /* USER OPEN ORDERS */
  self.userOpenOrders = ko.observableArray([]);

  self.displayOpenUserOrders = function(data) {
    for (var i in data) {

      data[i].amount = formatHtmlPrice(normalizeQuantity(data[i].amount, self.baseAssetIsDivisible()));
      data[i].total = formatHtmlPrice(normalizeQuantity(data[i].total, self.quoteAssetIsDivisible()));
      data[i].price = formatHtmlPrice(parseFloat(data[i].price));
      data[i].cancelled = WALLET.cancelOrders.indexOf(data[i].tx_hash) != -1;
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

  /* USER OPEN ORDERS */
  self.userLastTrades = ko.observableArray([]);

  self.displayUserLastTrades = function(data) {
    for (var i in data) {
      data[i].amount = formatHtmlPrice(normalizeQuantity(data[i].amount, self.baseAssetIsDivisible()));
      data[i].total = formatHtmlPrice(normalizeQuantity(data[i].total, self.quoteAssetIsDivisible()));
      data[i].block_time = moment(data[i].block_time * 1000).format('YYYY/MM/DD hh:mm:ss A Z');
      data[i].price = formatHtmlPrice(parseFloat(data[i].price));
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

  /* ALL PAIRS LIST */
  self.allPairs = ko.observableArray([]);

  self.displayAllPairs = function(data) {
    for (var i in data) {
      data[i].priceRaw = data[i].price;
      data[i].volumeRaw = normalizeQuantity(data[i].volume, data[i].quote_divisibility);
      data[i].supplyRaw = normalizeQuantity(data[i].supply, data[i].base_divisibility);
      data[i].marketCapRaw = normalizeQuantity(data[i].market_cap, data[i].quote_divisibility);
      data[i].progressionRaw = data[i].progression;

      data[i].volume = smartFormat(data[i].volumeRaw);
      data[i].supply = smartFormat(data[i].supplyRaw);
      data[i].market_cap = smartFormat(data[i].marketCapRaw);
      if (parseFloat(data[i].progression) > 0) {
        data[i].prog_class = 'UP';
        data[i].progression = '+' + data[i].progression;
      } else if (parseFloat(data[i].progression) < 0) {
        data[i].prog_class = 'DOWN'
      } else {
        data[i].prog_class = '';
      }
      data[i].progression += '%';

      if (parseFloat(data[i].trend) > 0) {
        data[i].price_class = 'UP';
      } else if (parseFloat(data[i].trend) < 0) {
        data[i].price_class = 'DOWN';
      } else {
        data[i].price_class = '';
      }
      data[i].price = smartFormat(parseFloat(data[i].price));
    }
    self.allPairs(data);
    if (self.allPairs().length) {
      runDataTables('#assetPairMarketInfo', true,
        {
          //"iDisplayLength": 15,
          "aaSorting": [[0, 'asc']],
          "aoColumns": [
            {"sType": "numeric"}, //#
            {"sType": "string"}, //asset/market
            {"sType": "natural", "iDataSort": 7}, //price
            {"sType": "natural", "iDataSort": 8}, //24h volume
            {"sType": "natural", "iDataSort": 9}, //supply
            {"sType": "natural", "iDataSort": 10}, //market cap
            {"sType": "natural", "iDataSort": 11}, //24h change
            null, //price RAW
            null, //24h volume RAW
            null, //supply RAW
            null, //market cap RAW
            null //24h change RAW
          ]
        });
    }
  }


  self.fetchAllPairs = function() {
    try {
      self.allPairs([]);
      $('#assetPairMarketInfo').dataTable().fnClearTable();
    } catch (e) {}
    failoverAPI('get_markets_list', [], self.displayAllPairs);
  }

  /* MARKET DETAILS */

  self.displayMarketDetails = function(data) {
    if (data['base_asset_infos'] && data['base_asset_infos']['valid_image']) {
      self.baseAssetImage(assetImageUrl(data['base_asset']));
    }

    if (self.asset1() == data['base_asset']) {
      self.asset1IsDivisible(data['base_asset_divisible']);
      self.asset2IsDivisible(data['quote_asset_divisible']);
    } else {
      self.asset1IsDivisible(data['quote_asset_divisible']);
      self.asset2IsDivisible(data['base_asset_divisible']);
    }

    self.currentMarketPrice(roundAmount(data['price']));
    self.marketProgression24h(data['progression']);

    self.bidBook([])
    self.askBook([])
    try { $('#asset1OpenBuyOrders').dataTable().fnClearTable(); } catch (err) { }
    try { $('#asset2OpenBuyOrders').dataTable().fnClearTable(); } catch (err) { }

    var base_depth = 0;
    var buy_orders = [];

    for (var i in data['buy_orders']) {
      if (data['sell_orders'].length > 0 && data['buy_orders'][i]['price'] >= data['sell_orders'][0]['price']) {
        data['buy_orders'][i]['exclude'] = true;
      } else {
        if (base_depth == 0) {
          self.highestBidPrice(data['buy_orders'][i]['price']);
          self.sellPrice(data['buy_orders'][i]['price']);
          var a = new Decimal(self.availableBalanceForSell());
          var h = new Decimal(self.highestBidPrice());
          var o = roundAmount(a.mul(h));
          self.obtainableForSell(o);
        }
        var amount = normalizeQuantity(data['buy_orders'][i]['amount'], data['base_asset_divisible']);
        var noHtmlAmount = roundAmount(amount);
        var noHtmlTotal = roundAmount(normalizeQuantity(data['buy_orders'][i]['total'], data['quote_asset_divisible']));
        data['buy_orders'][i]['exclude'] = false;

        data['buy_orders'][i]['amount'] = formatHtmlPrice(noHtmlAmount);
        data['buy_orders'][i]['total'] = formatHtmlPrice(noHtmlTotal);
        var a = new Decimal(noHtmlAmount);
        var t = new Decimal(noHtmlTotal);
        var p = roundAmount(t.div(a));
        data['buy_orders'][i]['price'] = formatHtmlPrice(p);
        data['buy_orders'][i]['base_depth'] = amount + base_depth;
        base_depth = data['buy_orders'][i]['base_depth'];
      }
    }
    base_depth = 0;
    for (var i in data['sell_orders']) {
      if (base_depth == 0) {
        self.lowestAskPrice(data['sell_orders'][i]['price']);
        self.buyPrice(data['sell_orders'][i]['price']);
        var a = new Decimal(self.availableBalanceForBuy());
        var l = new Decimal(self.lowestAskPrice());
        var o = roundAmount(a.div(l));
        self.obtainableForBuy(o);
      }
      var amount = normalizeQuantity(data['sell_orders'][i]['amount'], data['base_asset_divisible']);
      var noHtmlAmount = roundAmount(amount);
      var noHtmlTotal = roundAmount(normalizeQuantity(data['sell_orders'][i]['total'], data['quote_asset_divisible']));
      data['sell_orders'][i]['exclude'] = false;
      data['sell_orders'][i]['amount'] = formatHtmlPrice(noHtmlAmount);
      data['sell_orders'][i]['total'] = formatHtmlPrice(noHtmlTotal);
      var a = new Decimal(noHtmlAmount);
      var t = new Decimal(noHtmlTotal);
      var p = roundAmount(t.div(a));
      data['sell_orders'][i]['price'] = formatHtmlPrice(p);
      data['sell_orders'][i]['base_depth'] = amount + base_depth;
      base_depth = data['sell_orders'][i]['base_depth'];
    }

    self.bidBook(data['buy_orders'])
    self.askBook(data['sell_orders'])

    self.tradeHistory([]);
    try { $('#tradeHistory').dataTable().fnClearTable(); } catch (err) { }

    for (var i in data['last_trades']) {
      data['last_trades'][i]['price'] = formatHtmlPrice(roundAmount(data['last_trades'][i]['price']));
      data['last_trades'][i].amount = formatHtmlPrice(roundAmount(normalizeQuantity(data['last_trades'][i].amount, self.baseAssetIsDivisible())));
      data['last_trades'][i].total = formatHtmlPrice(roundAmount(normalizeQuantity(data['last_trades'][i].total, self.quoteAssetIsDivisible())));
      data['last_trades'][i].block_time = moment(data['last_trades'][i].block_time * 1000).format('YYYY/MM/DD hh:mm:ss A Z');
    }
    self.tradeHistory(data['last_trades']);
    if (self.tradeHistory().length) {
      runDataTables('#tradeHistory', true, {"aaSorting": [[1, 'desc']]});
    }

    self.fetchOpenUserOrders();
    self.fetchUserLastTrades();

  }

  self.selectMarket = function(item) {
    self.asset1Raw(item.base_asset_longname || item.base_asset);
    self.asset1Longname(item.base_asset_longname);
    if (item.quote_asset === KEY_ASSET.XCP) {
      self.selectedQuoteAsset(item.quote_asset);
    } else {
      self.selectedQuoteAsset('Other');
      self.asset2Raw(item.quote_asset_longname || item.quote_asset);
      self.asset2Longname(item.quote_asset_longname);
    }

    trackEvent('Exchange', 'MarketSelected', self.dispAssetPair());
  }

  self.fetchMarketDetails = function(item) {
    self.highestBidPrice(0);
    self.lowestAskPrice(0);
    self.sellPrice(0);
    self.buyPrice(0);
    self.obtainableForSell(0);
    self.obtainableForBuy(0);
    self.metricsRefreshPriceChart();
    var params = {
      'asset1': self.asset2(),
      'asset2': self.asset1()
    }
    failoverAPI('get_market_details', params, self.displayMarketDetails);
  }

  self.init = function() {
    self.fetchTopUserPairs();
    self.fetchAllPairs();

    //Get a list of all assets
    failoverAPI("get_assets_names_and_longnames", {}, function(data, endpoint) {
      //result is a list of tuples. each entry in the tuple is (asset, asset_longname)
      //XCP is already included
      self.allAssets(data);

      //Set up typeahead bindings manually for now (can't get knockout and typeahead playing well together...)
      var assets = new Bloodhound({
        //datumTokenizer: function (data) { return Bloodhound.tokenizers.whitespace(data[1] || data[0]); },
        datumTokenizer: function (data) { return Bloodhound.tokenizers.whitespace(data['asset_longname'] || data['asset']); },
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        local: self.allAssets()
      });
      assets.initialize();
      $('#asset1Raw, #asset2Raw').typeahead(null, {
        source: assets.ttAdapter(),
        displayKey: function(data) {
          return data['asset_longname'] || data['asset'];
        }
      }).on('typeahead:selected', function($e, data) {
        if ($($e.target).attr('name') == 'asset1Raw') {
          self.asset1Raw(data['asset_longname'] || data['asset']); //gotta do a manual update...doesn't play well with knockout
        } else if ($($e.target).attr('name') == 'asset2Raw') {
          self.asset2Raw(data['asset_longname'] || data['asset']); //gotta do a manual update...doesn't play well with knockout
        }
      });
    });
  }

  self.refresh = function() {
    if (self.dexHome()) {
      self.fetchTopUserPairs();
      self.fetchAllPairs();
    } else {
      self.fetchMarketDetails();
    }
  }

  self.metricsRefreshPriceChart = function() {
    var deferred = $.Deferred();
    //now that an asset pair is picked, we can show a price chart for that pair
    failoverAPI("get_market_price_history", {
      'asset1': self.asset1(),
      'asset2': self.asset2()
    }, function(data, endpoint) {
      deferred.resolve();
      if (data.length) {
        ExchangeViewModel.doChart(self.dispAssetPair(), $('#priceHistory'), data);
      }
    }, function(jqXHR, textStatus, errorThrown, endpoint) {
      deferred.resolve();
      return defaultErrorHandler(jqXHR, textStatus, errorThrown, endpoint);
    });
  }

  self.cancelOrder = function(order) {

    if (WALLET.cancelOrders.indexOf(order.tx_hash) != -1) {

      bootbox.alert(i18n.t('order_already_cancelled'));

    } else {

      var message = i18n.t('cancel_consume_btc');

      bootbox.dialog({
        title: i18n.t("confirm_cancellation_order"),
        message: message,
        buttons: {
          "cancel": {
            label: i18n.t("close"),
            className: "btn-danger",
            callback: function() {
              bootbox.hideAll();
              return false;
            }
          },
          "confirm": {
            label: i18n.t("confirm_cancellation"),
            className: "btn-primary",
            callback: function() {
              bootbox.hideAll();
              self.cancelOpenOrder(order);
              return true;
            }
          }

        }
      });

    }

  }

  self.cancelOpenOrder = function(order) {
    var params = {
      offer_hash: order.tx_hash,
      source: order.source,
      _type: 'order',
      _tx_index: order.tx_index
    }

    var onSuccess = function(txHash, data, endpoint, addressType, armoryUTx) {
      trackEvent('Exchange', 'OrderCanceled');
      WALLET.showTransactionCompleteDialog("<b>" + i18n.t("order_was_cancelled") + "</b> " + i18n.t(ACTION_PENDING_NOTICE),
        "<b>" + i18n.t("order_will_be_cancelled") + "</b>", armoryUTx);
    }

    WALLET.doTransaction(order.source, "create_cancel", params, onSuccess);
  }
}


ExchangeViewModel.doChart = function(dispAssetPair, chartDiv, data) {
  // split the data set into ohlc and volume
  var ohlc = [];
  var midline = [];
  var volume = [];

  for (var i = 0; i < data.length; i++) {
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
      /*enabled: false,
      inputEnabled: false,*/
      selected: 0
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
        style: {color: '#CC3300'}
      }
    }, {
      title: {
        text: 'Amount',
        style: {color: '#4572A7'}
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
        type: 'line',
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


function OpenOrdersViewModel() {
  var self = this;

  self.openOrders = ko.observableArray([]);
  self.addressesLabels = {};
  self.allAssets = ko.observableArray([]);

  self.init = function() {
    self.addressesLabels = {};
    var wallet_adressess = WALLET.getAddressesList(true);
    var addresses = [];
    for (var i = 0; i < wallet_adressess.length; i++) {
      addresses.push(wallet_adressess[i][0]);
      self.addressesLabels[wallet_adressess[i][0]] = wallet_adressess[i][1];
    }

    failoverAPI("get_assets_names_and_longnames", {}, function(data, endpoint) {
      //result is a list of tuples. each entry in the tuple is (asset, asset_longname)
      //XCP is already included
      self.allAssets(data);

      var params = {
        filters: [
          {'field': 'source', 'op': 'IN', 'value': addresses},
          {'field': 'give_remaining', 'op': '>', 'value': 0}
        ],
        status: 'open'
      };
      failoverAPI("get_orders", params, self.displayOpenOrders);
    });
  }

  self.displayOpenOrders = function(data) {
    self.openOrders([]);
    var assets = {};
    var orders = [];
    for (var i = 0; i < data.length; i++) {
      var order = {};
      order.tx_index = data[i].tx_index;
      order.tx_hash = data[i].tx_hash;
      order.source = data[i].source;
      order.address_label = self.addressesLabels[order.source];

      //TODO: yes this is essentially O(n^2) ... fix later
      var match = null;
      order.give_asset = data[i].give_asset;
      match = ko.utils.arrayFirst(self.allAssets(), function(item) {
        return order.give_asset == item['asset']; //matches asset name or asset longname
      });
      order.give_asset_disp = match['asset_longname'] || match['asset'];
      order.get_asset = data[i].get_asset;
      match = ko.utils.arrayFirst(self.allAssets(), function(item) {
        return order.get_asset == item['asset']; //matches asset name or asset longname
      });
      order.get_asset_disp = match['asset_longname'] || match['asset'];

      order.give_quantity = data[i].give_quantity;
      order.get_quantity = data[i].get_quantity;
      order.give_remaining = Math.max(data[i].give_remaining, 0);
      order.get_remaining = Math.max(data[i].get_remaining, 0);
      order.expire_index = data[i].expire_index;
      order.expire_date = expireDate(data[i].expire_index);
      order.cancelled = WALLET.cancelOrders.indexOf(order.tx_hash) != -1;
      orders.push(order);
      assets[data[i].give_asset] = true;
      assets[data[i].get_asset] = true;
    }
    assets = _.keys(assets);

    WALLET.getAssetsDivisibility(assets, function(assetsDivisibility) {
      for (var i = 0; i < orders.length; i++) {
        orders[i].give_quantity_str = smartFormat(normalizeQuantity(orders[i].give_quantity, assetsDivisibility[orders[i].give_asset])) + ' ' + orders[i].give_asset_disp;
        orders[i].get_quantity_str = smartFormat(normalizeQuantity(orders[i].get_quantity, assetsDivisibility[orders[i].get_asset])) + ' ' + orders[i].get_asset_disp;
        orders[i].give_remaining_str = smartFormat(normalizeQuantity(orders[i].give_remaining, assetsDivisibility[orders[i].give_asset])) + ' ' + orders[i].give_asset_disp;
        orders[i].get_remaining_str = smartFormat(normalizeQuantity(orders[i].get_remaining, assetsDivisibility[orders[i].get_asset])) + ' ' + orders[i].get_asset_disp;
      }
      self.openOrders(orders);
      var openOrdersTable = $('#openOrdersTable').dataTable();
    });
  }

  self.cancelOpenOrder = function(order) {

    if (WALLET.cancelOrders.indexOf(order.tx_hash) != -1) {

      bootbox.alert(i18n.t('order_already_cancelled'));

    } else {

      var message = i18n.t('cancel_consume_btc');

      bootbox.dialog({
        title: i18n.t("confirm_cancellation_order"),
        message: message,
        buttons: {
          "cancel": {
            label: i18n.t("close"),
            className: "btn-danger",
            callback: function() {
              bootbox.hideAll();
              return false;
            }
          },
          "confirm": {
            label: i18n.t("confirm_cancellation"),
            className: "btn-primary",
            callback: function() {
              bootbox.hideAll();
              self.cancelOrder(order);
              return true;
            }
          }
        }
      });

    }
  }

  self.cancelOrder = function(order) {
    var params = {
      offer_hash: order.tx_hash,
      source: order.source,
      _type: 'order',
      _tx_index: order.tx_index
    }

    var onSuccess = function(txHash, data, endpoint, addressType, armoryUTx) {
      trackEvent('OpenOrders', 'OrderCancelled');
      WALLET.showTransactionCompleteDialog("<b>" + i18n.t("order_was_cancelled") + "</b> " + i18n.t(ACTION_PENDING_NOTICE),
        "<b>" + i18n.t("order_will_be_cancelled") + "</b>", armoryUTx);
    }

    WALLET.doTransaction(order.source, "create_cancel", params, onSuccess);
  }
}

function OrderMatchesViewModel() {
  self = this;

  self.orderMatches = ko.observableArray([]);
  self.addressesLabels = {};
  self.allAssets = ko.observableArray([]);

  self.init = function() {
    self.addressesLabels = {};
    var wallet_adressess = WALLET.getAddressesList(true);
    var addresses = [];
    for (var i = 0; i < wallet_adressess.length; i++) {
      addresses.push(wallet_adressess[i][0]);
      self.addressesLabels[wallet_adressess[i][0]] = wallet_adressess[i][1];
    }

    failoverAPI("get_assets_names_and_longnames", {}, function(data, endpoint) {
      //result is a list of tuples. each entry in the tuple is (asset, asset_longname)
      //XCP is already included
      self.allAssets(data);

      var params = {
        filters: [
          {'field': 'tx0_address', 'op': 'IN', 'value': addresses},
          {'field': 'tx1_address', 'op': 'IN', 'value': addresses}
        ],
        filterop: 'OR',
        status: ['pending', 'completed', 'expired'],
        order_by: 'block_index',
        order_dir: 'DESC'
      };
      failoverAPI("get_order_matches", params, self.displayOrderMatches);
    });
  }

  self.displayOrderMatches = function(data) {
    self.orderMatches([]);
    var order_matches = [];
    var assets = {};

    for (var i = 0; i < data.length; i++) {
      var order_match = {};

      if (self.addressesLabels[data[i].tx0_address]) {
        order_match.address_label = self.addressesLabels[data[i].tx0_address];
        order_match.give_quantity = data[i].forward_quantity;
        order_match.get_quantity = data[i].backward_quantity;
        order_match.give_asset = data[i].forward_asset;
        order_match.get_asset = data[i].backward_asset;
      } else {
        order_match.address_label = self.addressesLabels[data[i].tx1_address];
        order_match.give_quantity = data[i].backward_quantity;
        order_match.get_quantity = data[i].forward_quantity;
        order_match.give_asset = data[i].backward_asset;
        order_match.get_asset = data[i].forward_asset;
      }

      //TODO: yes this is essentially O(n^2) ... fix later
      var match = null;
      match = ko.utils.arrayFirst(self.allAssets(), function(item) {
        return order_match.give_asset == item['asset']; //matches asset name or asset longname
      });
      order_match.give_asset_disp = match['asset_longname'] || match['asset'];
      match = ko.utils.arrayFirst(self.allAssets(), function(item) {
        return order_match.get_asset == item['asset']; //matches asset name or asset longname
      });
      order_match.get_asset_disp = match['asset_longname'] || match['asset'];

      order_match.status = data[i].status;
      order_match.block_index = data[i].block_index;

      assets[order_match.give_asset] = true;
      assets[order_match.get_asset] = true;

      var classes = {
        'completed': 'success',
        'pending': 'primary',
        'expired': 'danger'
      };
      var label_for_status = {
        'completed': i18n.t('completed'),
        'pending': i18n.t('pending'),
        'expired': i18n.t('expired')
      };
      order_match.status_html = '<span class="label label-' + classes[order_match.status] + '">' + label_for_status[order_match.status] + '</span>';

      order_matches.push(order_match);
    }

    assets = _.keys(assets);

    WALLET.getAssetsDivisibility(assets, function(assetsDivisibility) {
      for (var i = 0; i < order_matches.length; i++) {
        order_matches[i].give_quantity_str = smartFormat(normalizeQuantity(order_matches[i].give_quantity, assetsDivisibility[order_matches[i].give_asset])) + ' ' + order_matches[i].give_asset_disp;
        order_matches[i].get_quantity_str = smartFormat(normalizeQuantity(order_matches[i].get_quantity, assetsDivisibility[order_matches[i].get_asset])) + ' ' + order_matches[i].get_asset_disp;
      }
      $('#orderMatchesTable').dataTable().fnClearTable();
      self.orderMatches(order_matches);
      runDataTables('#orderMatchesTable', true, {
        "aaSorting": [[1, 'desc']]
      });
    });

  }

}


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
