function ChangeAddressLabelModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(null); //address string, not an Address object
  self.existingLabel = ko.observable(null);

  self.newLabel = ko.observable('').trimmed().extend({
    required: true,
    validation: {
      validator: function(val, self) {
        return val.length <= 75;
      },
      message: i18n.t('invalid_address_label'),
      params: self
    }
  });

  self.validationModel = ko.validatedObservable({
    newLabel: self.newLabel
  });

  self.dispAddress = ko.computed(function() {
    if (!self.address()) return "";
    if (self.address().indexOf("_") == -1) {
      return self.address();
    } else {
      var addresses = self.address().split("_");
      var sigRequired = addresses.shift();
      addresses.pop();
      return sigRequired + '_' + addresses.join("_") + '_' + addresses.length;
    }
  });

  self.resetForm = function() {
    self.newLabel('');
    self.validationModel.errors.showAllMessages(false);
  }

  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }
    //data entry is valid...submit to the server
    $('#changeAddressLabelModal form').submit();
  }

  self.doAction = function() {
    var addressHash = hashToB64(self.address());
    var label = _.stripTags($("<div/>").html(self.newLabel()).text());
    //^ remove any HTML tags from the text
    PREFERENCES.address_aliases[addressHash] = label;
    //^ update the preferences on the server
    WALLET.storePreferences(function(data, endpoint) {
      WALLET.getAddressObj(self.address()).label(label); //update was a success
      self.shown(false);
    });
    trackEvent('Balances', 'ChangeAddressLabel');
  }

  self.show = function(address, existingLabel, resetForm) {
    if (typeof(resetForm) === 'undefined') resetForm = true;
    if (resetForm) self.resetForm();
    self.address(address);
    self.existingLabel(existingLabel);

    //set new label to existing label (to provide a default) and highlight the box
    self.newLabel(existingLabel);
    self.shown(true);
    selectText('newAddressLabel');
    trackDialogShow('ChangeAddressLabel');
  }

  self.hide = function() {
    self.shown(false);
  }
}

function CreateNewAddressModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);

  self.addressType = ko.observable(null); //addressType is one of: normal, watch, armory or multisig
  self.armoryPubKey = ko.observable(null); //only set with armory offline addresses
  self.watchAddress = ko.observable('').extend({
    isValidMonosigAddressIfSpecified: self,
    validation: [{
      validator: function(val, self) {
        return (self.addressType() == 'watch' || self.addressType() == 'armory') ? val : true;
      },
      message: i18n.t('field_required'),
      params: self
    }, {
      validator: function(val, self) {
        if (!val) return true; //the check above will cover it
        return !WALLET.getAddressObj(val);
      },
      message: i18n.t('address_already_in_wallet'),
      params: self
    }],
    canGetAddressPubKey: self
  });

  self.multisigAddressType = ko.observable(null);
  self.multisigRequired = ko.computed(function() {
    if (self.multisigAddressType()) {
      return self.multisigAddressType().split("_").shift();
    }
    return;
  });
  self.multisigProvided = ko.computed(function() {
    if (self.multisigAddressType()) {
      return self.multisigAddressType().split("_").pop();
    }
    return;
  });


  self.multisigAddress1 = ko.observable('').extend({
    isValidMonosigAddress: self,
    required: true
  });
  self.multisigAddress1.subscribe(function(val) {
    if (val && CWBitcore.isValidAddress(val)) {
      getPubkeyForAddress(val, function(data) {
        if (data[0]) {
          self.multisigPubkeyAddress1(data[0]);
        } else {
          self.needPubkey1(true);
        }
      });
    }
  });
  self.multisigPubkeyAddress1 = ko.observable('').extend({
    validation: [{
      validator: function(val, self) {
        return (self.addressType() == 'multisig') ? val : true;
      },
      message: i18n.t('field_required'),
      params: self
    }, {
      validator: function(val, self) {
        if (!val) return true;
        try {
          return pubkeyToPubkeyhash(val) == self.multisigAddress1();
        } catch (e) {
          return false;
        }
      },
      message: i18n.t('pubkey_not_match'),
      params: self
    }]
  });
  self.needPubkey1 = ko.observable(false);

  self.multisigAddress2 = ko.observable('').extend({
    isValidMonosigAddress: self,
    required: true
  });
  self.multisigAddress2.subscribe(function(val) {
    if (val && CWBitcore.isValidAddress(val)) {
      getPubkeyForAddress(val, function(data) {
        if (data[0]) {
          self.multisigPubkeyAddress2(data[0]);
        } else {
          self.needPubkey2(true);
        }
      });
    }
  });
  self.multisigPubkeyAddress2 = ko.observable('').extend({
    validation: [{
      validator: function(val, self) {
        return (self.addressType() == 'multisig') ? val : true;
      },
      message: i18n.t('field_required'),
      params: self
    }, {
      validator: function(val, self) {
        if (!val) return true;
        try {
          return pubkeyToPubkeyhash(val) == self.multisigAddress2();
        } catch (e) {
          return false;
        }
      },
      message: i18n.t('pubkey_not_match'),
      params: self
    }]
  });
  self.needPubkey2 = ko.observable(false);

  self.multisigAddress3 = ko.observable('').extend({
    validation: [{
      validator: function(val, self) {
        return (self.addressType() == 'multisig' && self.multisigProvided() == 3) ? val : true;
      },
      message: i18n.t('field_required'),
      params: self
    }],
    isValidMonosigAddressIfSpecified: self
  });
  self.multisigAddress3.subscribe(function(val) {
    if (val && CWBitcore.isValidAddress(val)) {
      getPubkeyForAddress(val, function(data) {
        if (data[0]) {
          self.multisigPubkeyAddress3(data[0]);
        } else {
          self.needPubkey3(true);
        }
      });
    }
  });
  self.multisigPubkeyAddress3 = ko.observable('').extend({
    validation: [{
      validator: function(val, self) {
        return (self.addressType() == 'multisig' && self.multisigProvided() == 3) ? val : true;
      },
      message: i18n.t('field_required'),
      params: self
    }, {
      validator: function(val, self) {
        if (!val) return true;
        try {
          return pubkeyToPubkeyhash(val) == self.multisigAddress3();
        } catch (e) {
          return false;
        }
      },
      message: i18n.t('pubkey_not_match'),
      params: self
    }]
  });
  self.needPubkey3 = ko.observable(false);

  self.multisigAddress = ko.computed(function() {
    var newAddress = self.multisigRequired() + '_' + self.multisigAddress1() + '_' + self.multisigAddress2() + '_';
    if (self.multisigProvided() == 3) {
      newAddress += self.multisigAddress3() + '_';
    }
    newAddress += self.multisigProvided();
    newAddress = orderMultisigAddress(newAddress);
    return newAddress;
  });

  self.multisigPubkeys = ko.computed(function() {
    var pubKeys = [];
    var orderedAddress = self.multisigAddress().split('_');
    orderedAddress.pop();
    orderedAddress.shift();
    for (var a in orderedAddress) {
      for (var i = 1; i <= 3; i++) {
        if (orderedAddress[a] == self['multisigAddress' + i]()) {
          pubKeys.push(self['multisigPubkeyAddress' + i]())
        }
      }
    }
    return pubKeys;
  });

  self.description = ko.observable('').extend({
    required: true,
    validation: {
      validator: function(val, self) {
        return val.length <= 70; //arbitrary
      },
      message: i18n.t('address_desc_too_long'),
      params: self
    }
  });

  self.validationModel = ko.validatedObservable({
    description: self.description,
    watchAddress: self.watchAddress
  });

  self.validationModelMultisig = ko.validatedObservable({
    description: self.description,
    multisigAddress1: self.multisigAddress1,
    multisigPubkeyAddress1: self.multisigPubkeyAddress1,
    multisigAddress2: self.multisigAddress2,
    multisigPubkeyAddress2: self.multisigPubkeyAddress2,
    multisigAddress3: self.multisigAddress3,
    multisigPubkeyAddress3: self.multisigPubkeyAddress3
  });

  self.dispWindowTitle = ko.computed(function() {
    var title = {
      'segwit': i18n.t('create_segwit_address'),
      'normal': i18n.t('create_new_address'),
      'watch': i18n.t('add_watch_address'),
      'armory': i18n.t('add_armory_adress'),
      'multisig': i18n.t('add_multisig_adress')
    }
    return title[self.addressType()];
  }, self);

  self.resetForm = function() {
    self.addressType(null);
    self.watchAddress('');
    self.description('');
    self.needPubkey1(false);
    self.multisigAddress1('');
    self.multisigPubkeyAddress1('');
    self.needPubkey2(false);
    self.multisigAddress2('');
    self.multisigPubkeyAddress2('');
    self.needPubkey3(false);
    self.multisigAddress3('');
    self.multisigPubkeyAddress3('');
    self.validationModel.errors.showAllMessages(false);
  }

  self.submitForm = function() {
    if (self.addressType() == 'armory' && self.watchAddress.isValidating()) {
      setTimeout(function() { //wait a bit and call again
        self.submitForm();
      }, 50);
      return;
    }

    if (self.addressType() == 'multisig') {
      if (!self.validationModelMultisig.isValid()) {
        self.validationModelMultisig.errors.showAllMessages();
        return false;
      }
    } else {
      if (!self.validationModel.isValid()) {
        self.validationModel.errors.showAllMessages();
        return false;
      }
    }

    //data entry is valid...submit to trigger doAction()
    $('#createNewAddressModal form').submit();
  }

  self.eventName = {
    'segwit': 'CreateNewSegwitAddress',
    'normal': 'CreateNewAddress',
    'watch': 'CreateNewWatchAddress',
    'armory': 'CreateNewArmoryOfflineAddress',
    'multisig': 'CreateMultisigAddress'
  };

  self.doAction = function() {
    $('#createNewAddressButtons button').addClass('disabled');

    var newAddress;
    var pubKeys;
    if (self.addressType() == 'multisig') {
      newAddress = self.multisigAddress();
      pubKeys = self.multisigPubkeys();
    } else if (self.addressType() == 'armory') {
      newAddress = self.watchAddress();
      pubKeys = self.armoryPubKey();
    } else if (self.addressType() == 'watch') {
      newAddress = self.watchAddress();
    }

    newAddress = WALLET.addAddress(self.addressType(), newAddress, pubKeys);

    //update PREFs
    var newAddressHash = hashToB64(newAddress);
    if (self.addressType() == 'normal') {
      PREFERENCES['num_addresses_used'] = parseInt(PREFERENCES['num_addresses_used']) + 1;
    } else if (self.addressType() == 'segwit') {
      if (!(PREFERENCES['num_segwit_addresses_used'] instanceof Array)) PREFERENCES['num_segwit_addresses_used'] = 0;
      PREFERENCES['num_segwit_addresses_used'] = parseInt(PREFERENCES['num_segwit_addresses_used']) + 1
    } else if (self.addressType() == 'watch') {
      if (!(PREFERENCES['watch_only_addresses'] instanceof Array)) PREFERENCES['watch_only_addresses'] = [];
      PREFERENCES['watch_only_addresses'].push(newAddress); //can't use the hash here, unfortunately
    } else if (self.addressType() == 'multisig') {
      if (!(PREFERENCES['multisig_addresses'] instanceof Array)) PREFERENCES['multisig_addresses'] = [];
      PREFERENCES['multisig_addresses'].push({'address': newAddress, 'pubkeys_hex': self.multisigPubkeys()}); //can't use the hash here, unfortunately
    } else {
      assert(self.addressType() == 'armory');
      if (!(PREFERENCES['armory_offline_addresses'] instanceof Array)) PREFERENCES['armory_offline_addresses'] = [];
      PREFERENCES['armory_offline_addresses'].push({'address': newAddress, 'pubkey_hex': self.armoryPubKey()}); //can't use the hash here, unfortunately
    }
    var sanitizedDescription = _.stripTags(self.description());
    PREFERENCES['address_aliases'][newAddressHash] = sanitizedDescription;

    //manually set the address in this case to get around the chicken and egg issue here (and have client side match the server)
    WALLET.getAddressObj(newAddress).label(sanitizedDescription);

    //save prefs to server
    WALLET.storePreferences(function(data, endpoint) {
      WALLET.refreshCounterpartyBalances([newAddress], function() {
        WALLET.refreshBTCBalances(false, null, function() {
          self.shown(false);
          setTimeout(checkURL, 300);
        });
      });
    });

    trackEvent('Balances', self.eventName[self.addressType()]);

  }

  self.show = function(addressType, resetForm) {
    $('#createNewAddressButtons button').removeClass('disabled');
    if (typeof(resetForm) === 'undefined') resetForm = true;
    if (resetForm) self.resetForm();
    self.addressType(addressType);
    self.shown(true);
    trackDialogShow(self.eventName[self.addressType()]);
  }

  self.hide = function() {
    self.shown(false);
  }
}

function SendModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(null); //address string, not an Address object
  self.asset = ko.observable();
  self.assetDisp = ko.observable();
  self.rawBalance = ko.observable(null);
  self.divisible = ko.observable();
  self.feeOption = ko.observable('optimal');
  self.customFee = ko.observable(null).extend({
    validation: [{
      validator: function(val, self) {
        return self.feeOption() === 'custom' ? val : true;
      },
      message: i18n.t('field_required'),
      params: self
    }],
    isValidCustomFeeIfSpecified: self
  });

  self.feeOption.subscribeChanged(function(newValue, prevValue) {
    if(newValue !== 'custom') {
      self.customFee(null);
      self.customFee.isModified(false);
    }
  });

  self.destAddress = ko.observable('').extend({
    required: true,
    isValidBitcoinAddress: self,
    isNotSameBitcoinAddress: self
  });

  self.missingPubkey1 = ko.observable(false);
  self.missingPubkey1Address = ko.observable('');
  self.pubkey1 = ko.observable('').extend({
    validation: [{
      validator: function(val, self) {
        return self.missingPubkey1() ? val : true;
      },
      message: i18n.t('field_required'),
      params: self
    }, {
      validator: function(val, self) {
        if (!val) return true;
        try {
          return pubkeyToPubkeyhash(val) == self.missingPubkey1Address();
        } catch (e) {
          return false;
        }
      },
      message: i18n.t('pubkey_not_match'),
      params: self
    }]
  });
  self.missingPubkey2 = ko.observable(false);
  self.missingPubkey2Address = ko.observable('');
  self.pubkey2 = ko.observable('').extend({
    validation: [{
      validator: function(val, self) {
        return self.missingPubkey2() ? val : true;
      },
      message: i18n.t('field_required'),
      params: self
    }, {
      validator: function(val, self) {
        if (!val) return true;
        try {
          return pubkeyToPubkeyhash(val) == self.missingPubkey2Address();
        } catch (e) {
          return false;
        }
      },
      message: i18n.t('pubkey_not_match'),
      params: self
    }]
  });
  self.missingPubkey3 = ko.observable(false);
  self.missingPubkey3Address = ko.observable('');
  self.pubkey3 = ko.observable('').extend({
    validation: [{
      validator: function(val, self) {
        return self.missingPubkey3() ? val : true;
      },
      message: i18n.t('field_required'),
      params: self
    }, {
      validator: function(val, self) {
        if (!val) return true;
        try {
          return pubkeyToPubkeyhash(val) == self.missingPubkey3Address();
        } catch (e) {
          return false;
        }
      },
      message: i18n.t('pubkey_not_match'),
      params: self
    }]
  });

  self._additionalPubkeys = [];
  self.destAddress.subscribe(function(val) {

    self.missingPubkey1(false);
    self.missingPubkey1Address('');
    self.missingPubkey2(false);
    self.missingPubkey2Address('');
    self.missingPubkey3(false);
    self.missingPubkey3Address('');

    if (!self.destAddress()) return;
    if (!CWBitcore.isValidMultisigAddress(self.destAddress())) return;

    getPubkeyForAddress(val, function(data) {
      var addresses = []
      if (CWBitcore.isValidMultisigAddress(self.destAddress())) {
        addresses = self.destAddress().split('_');
        addresses.pop();
        addresses.shift();
      } else {
        addresses.push(self.destAddress())
      }
      var missingPubkeys = []
      for (var a in addresses) {
        var address = addresses[a];
        var missing = true;
        for (var k in data) {
          if (pubkeyToPubkeyhash(data[k]) == address) {
            missing = false;
            self._additionalPubkeys.push(data[k]);
          }
        }
        if (missing) {
          missingPubkeys.push(address);
        }
      }
      if (missingPubkeys.length >= 1) {
        self.missingPubkey1(true);
        self.missingPubkey1Address(missingPubkeys[0]);
      }
      if (missingPubkeys.length >= 2) {
        self.missingPubkey2(true);
        self.missingPubkey2Address(missingPubkeys[1]);
      }
      if (missingPubkeys.length == 3) {
        self.missingPubkey3(true);
        self.missingPubkey3Address(missingPubkeys[2]);
      }
    });
  });

  self.quantity = ko.observable().extend({
    required: true,
    isValidPositiveQuantity: self,
    isValidQtyForDivisibility: self,
    validation: {
      validator: function(val, self) {
        if (normalizeQuantity(self.rawBalance(), self.divisible()) - parseFloat(val) < 0) {
          return false;
        }
        return true;
      },
      message: i18n.t('quantity_exceeds_balance'),
      params: self
    }
  });

  self.normalizedBalance = ko.computed(function() {
    if (self.address() === null || self.rawBalance() === null) return null;
    return normalizeQuantity(self.rawBalance(), self.divisible());
  }, self);

  self.dispNormalizedBalance = ko.computed(function() {
    return smartFormat(self.normalizedBalance(), null, 8);
  }, self);

  self.normalizedBalRemaining = ko.computed(function() {
    if (!isNumber(self.quantity())) return null;
    var curBalance = normalizeQuantity(self.rawBalance(), self.divisible());
    var balRemaining = Decimal.round(new Decimal(curBalance).sub(parseFloat(self.quantity())), 8, Decimal.MidpointRounding.ToEven).toFloat();
    if (self.asset() === KEY_ASSET.BTC)
      balRemaining = subFloat(balRemaining, normalizeQuantity(MIN_FEE))  // include the fee
    if (balRemaining < 0) return null;
    return balRemaining;
  }, self);

  self.dispNormalizedBalRemaining = ko.computed(function() {
    return smartFormat(self.normalizedBalRemaining(), null, 8);
  }, self);

  self.normalizedBalRemainingIsSet = ko.computed(function() {
    return self.normalizedBalRemaining() !== null;
  }, self);

  // memo
  self.memoType = ko.observable('');
  var hexRegex = /^[0-9a-f]+$/i;
  self.memoValue = ko.observable('').extend({
    validation: [{
      validator: function(val, self) {
        if (self.memoType() == 'hex') {
          if (!val.match(hexRegex)) { return false; }
        }
        return true;
      },
      message: i18n.t('memo_data_invalid_hex'),
      params: self
    }, {
      validator: function(val, self) {
        if (self.memoType() == 'hex') {
          if (val.length > 68) { return false; }
        } else if (self.memoType() == 'text') {
          if (val.length > 34) { return false; }
        }
        return true;
      },
      message: i18n.t('memo_data_too_long'),
      params: self
    }]
  });
  self.memoHelpTextLocale = ko.computed(function() {
    if (self.memoType() == 'text') {
      return 'memo_data_note_text';
    }
    return 'memo_data_note_hex';
  });
  shouldShowMemoFields = ko.computed(function() {
    return self.asset() && self.asset() !== KEY_ASSET.BTC;
  })

  self.validationModel = ko.validatedObservable({
    destAddress: self.destAddress,
    quantity: self.quantity,
    customFee: self.customFee,
    pubkey1: self.pubkey1,
    pubkey2: self.pubkey2,
    pubkey3: self.pubkey3,
    memoValue: self.memoValue
  });

  self.resetForm = function() {
    self.destAddress('');
    self.quantity(null);

    self.missingPubkey1(false);
    self.missingPubkey1Address('');
    self.missingPubkey2(false);
    self.missingPubkey2Address('');
    self.missingPubkey3(false);
    self.missingPubkey3Address('');

    self.memoType('');
    self.memoValue('');

    self.feeController.reset();

    self.validationModel.errors.showAllMessages(false);
  }

  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }
    //data entry is valid...submit to the server
    $('#sendModal form').submit();
  }

  self.maxAmount = function() {
    assert(self.normalizedBalance(), "No balance present?");
    if (self.asset() === KEY_ASSET.BTC)
      self.quantity(subFloat(self.normalizedBalance(), normalizeQuantity(MIN_FEE)));
    else
      self.quantity(self.normalizedBalance());
  }

  self.doAction = function() {
    WALLET.doTransactionWithTxHex(self.address(), "create_send", self.buildSendTransactionData(), self.feeController.getUnsignedTx(),
      function(txHash, data, endpoint, addressType, armoryUTx) {
        var message = "<b>" + (armoryUTx ? i18n.t("will_be_sent") : i18n.t("were_sent")) + " </b>";
        WALLET.showTransactionCompleteDialog(message + " " + i18n.t(ACTION_PENDING_NOTICE), message, armoryUTx);
      }
    );
    self.shown(false);
    trackEvent('Balances', 'Send', self.asset());
  }

  self.buildSendTransactionData = function() {
    var additionalPubkeys = [];

    if (self.pubkey1()) {
      additionalPubkeys.push(self.pubkey1())
    }
    if (self.pubkey2()) {
      additionalPubkeys.push(self.pubkey2())
    }
    if (self.pubkey3()) {
      additionalPubkeys.push(self.pubkey3())
    }

    params = {
      source: self.address(),
      destination: self.destAddress(),
      quantity: denormalizeQuantity(parseFloat(self.quantity()), self.divisible()),
      asset: self.asset(),
      _asset_divisible: self.divisible(),
      _pubkeys: additionalPubkeys.concat(self._additionalPubkeys),
      _fee_option: 'custom',
      _custom_fee: self.feeController.getCustomFee()
    };

    switch (self.memoType()) {
      case 'hex':
        params.memo = self.memoValue();
        params.memo_is_hex = true;
        break;
      case 'text':
        params.memo = self.memoValue();
        params.memo_is_hex = false;
        break;
    }

    return params
  }

  // mix in shared fee calculation functions
  self.feeController = CWFeeModelMixin(self, {
    action: "create_send",
    transactionParameters: [self.destAddress, self.quantity, self.memoType, self.memoValue],
    validTransactionCheck: function() {
      return self.validationModel.isValid();
    },
    buildTransactionData: self.buildSendTransactionData
  });

  self.show = function(fromAddress, asset, assetDisp, rawBalance, isDivisible, resetForm) {
    if (asset === KEY_ASSET.BTC && rawBalance === null) {
    /*WALLET.doTransaction(self.address(), "create_send",
      {
        source: self.address(),
        destination: self.destAddress(),
        quantity: denormalizeQuantity(parseFloat(self.quantity()), self.divisible()),
        asset: self.asset(),
        _asset_divisible: self.divisible(),
        _pubkeys: additionalPubkeys.concat(self._additionalPubkeys),
        _fee_option: self.feeOption(),
        _custom_fee: self.customFee()
      },
      function(txHash, data, endpoint, addressType, armoryUTx) {
        var message = "<b>" + (armoryUTx ? i18n.t("will_be_sent") : i18n.t("were_sent")) + " </b>";
        WALLET.showTransactionCompleteDialog(message + " " + i18n.t(ACTION_PENDING_NOTICE), message, armoryUTx);
      }
    );
    self.shown(false);
    trackEvent('Balances', 'Send', self.asset());
  }

  self.show = function(fromAddress, asset, assetDisp, rawBalance, isDivisible, resetForm) {
    if (asset == 'BTC' && rawBalance == null) {*/

      return bootbox.alert(i18n.t("cannot_send_server_unavailable"));
    }
    assert(rawBalance, "Balance is null or undefined?");

    if (typeof(resetForm) === 'undefined') resetForm = true;
    if (resetForm) self.resetForm();
    self.address(fromAddress);
    self.asset(asset);
    self.assetDisp(assetDisp);
    self.rawBalance(rawBalance);
    self.divisible(isDivisible);
    $('#sendFeeOption').select2("val", self.feeOption()); //hack
    self.shown(true);

    $('#MemoType').select2("val", self.memoType()); // hack to set select2 value
    trackDialogShow('Send');
  }

  self.hide = function() {
    self.shown(false);
  }
}


var BalancesAddressInDropdownItemModel = function(address, label, wif) {
  this.ADDRESS = address;
  this.LABEL = label;
  this.SELECT_LABEL = label ? ("<b>" + label + "</b><br/>" + address) : (address);
  this.WIF = wif;
};
var SweepAssetInDropdownItemModel = function(asset, rawBalance, normalizedBalance, assetInfo) {
  this.ASSET = asset;
  this.RAW_BALANCE = rawBalance; //raw
  this.NORMALIZED_BALANCE = normalizedBalance; //normalized
  this.SELECT_LABEL = asset + " (" + i18n.t("bal") + " " + normalizedBalance + ")";
  this.ASSET_INFO = assetInfo;
};


var privateKeyValidator = function(required) {
  var translationKeyIdx = USE_TESTNET ? 'not_valid_testnet_pk' : (USE_REGTEST ? 'not_valid_regtest_pk' : 'not_valid_pk');
  return {
    required: required,
    validation: {
      validator: function(val, self) {
        return (new CWPrivateKey(val)).isValid();
      },
      message: translationKeyIdx,
      params: self
    },
    rateLimit: {timeout: 500, method: "notifyWhenChangesStop"}
  }
}

function SweepModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.notEnoughBTC = ko.observable(false);

  self.privateKey = ko.observable('').trimmed().extend(privateKeyValidator(true));
  self.privateKeyForFees = ko.observable('').trimmed().extend(privateKeyValidator(false));

  self.addressForFeesBalanceMessage = ko.observable('');
  self.addressForFeesBalance = ko.observable(0);

  self.availableAssetsToSweep = ko.observableArray([]);
  //^ used for select box entries (composed dynamically on privateKey update)
  self.selectedAssetsToSweep = ko.observableArray([]).extend({
    required: true,
    validation: {
      validator: function(val, self, callback) {

        var sweepingCost = 0;

        for (var i = 0; i < self.selectedAssetsToSweep().length; i++) {
          var assetName = self.selectedAssetsToSweep()[i];
          var assetCost = self.sweepAssetsCost[assetName];
          sweepingCost += parseInt(assetCost);
          //$.jqlog.debug('Cost for ' + assetName + " : "+assetCost);
        }
        // output merging cost
        if (self.txoutsCountForPrivateKey > 1) {
          // MIN_FEE for 4 outputs.
          self.mergeCost = Math.ceil(self.txoutsCountForPrivateKey / 4) * MIN_FEE;
          sweepingCost += self.mergeCost;
        }

        //$.jqlog.debug('Total sweeping cost : ' + sweepingCost);

        // here we assume that the transaction cost to send BTC from addressForFees is MIN_FEE
        var totalBtcBalanceForSweeep = self.btcBalanceForPrivateKey() + Math.max(0, (self.addressForFeesBalance() - MIN_FEE));
        self.missingBtcForFees = Math.max(MULTISIG_DUST_SIZE, sweepingCost - self.btcBalanceForPrivateKey());


        if (totalBtcBalanceForSweeep < sweepingCost) {

          this.message = i18n.t("not_able_to_sweep", normalizeQuantity(self.missingBtcForFees), self.addressForPrivateKey());
          self.notEnoughBTC(true);
          return false;

        } else if (self.btcBalanceForPrivateKey() >= sweepingCost) {
          self.privateKeyForFees('');
          self.addressForFeesBalance(0);
        }

        self.notEnoughBTC(false);
        return true;
      },
      params: self
    }
  });
  self.destAddress = ko.observable('').trimmed().extend({
    required: true,
    isValidBitcoinAddress: self
  });

  self.availableAddresses = ko.observableArray([]);
  self.availableOldAddresses = ko.observableArray([]);
  self.excludedOldAddresses = ko.observableArray([]);

  self.privateKeyValidated = ko.validatedObservable({
    privateKey: self.privateKey
  });

  self.privateKeyForFeesValidated = ko.validatedObservable({
    privateKeyForFees: self.privateKeyForFees
  });

  self.addressForPrivateKey = ko.computed(function() {
    if (!self.privateKeyValidated.isValid()) return null;
    //Get the address for this privatekey
    return (new CWPrivateKey(self.privateKey())).getAddress();
  }, self);

  self.addressForPrivateKeyForFees = ko.computed(function() {
    if (!self.privateKeyForFeesValidated.isValid() || self.privateKeyForFees() == '') {
      self.addressForFeesBalanceMessage('');
      self.addressForFeesBalance(0);
      return null;
    }
    //Get the address for this privatekey
    return (new CWPrivateKey(self.privateKeyForFees())).getAddress();
  }, self);

  self.btcBalanceForPrivateKey = ko.observable(0);
  self.sweepingProgressionMessage = ko.observable("");
  self.sweepingProgressWidth = ko.observable('0%');

  self.txoutsCountForPrivateKey = 0; // no need observable
  self.sweepingCurrentStep = 1;
  self.missingBtcForFees = 0;
  self.sweepAssetsCost = {};
  self.mergeCost = 0;
  self.fromOldWallet = ko.observable(false);
  self.oldPrivateKey = ko.observable('');
  self.oldPrivateKey.subscribe(function(value) {
    if (self.fromOldWallet()) {
      self.privateKey(value);
    }
  });

  self.validationModel = ko.validatedObservable({
    privateKey: self.privateKey,
    selectedAssetsToSweep: self.selectedAssetsToSweep,
    destAddress: self.destAddress
  });

  self.addressForPrivateKey.subscribe(function(address) {
    //set up handler on changes in private key to generate a list of balances
    var hash = {};
    hash[KEY_ASSET.BTC] = MIN_FEE + REGULAR_DUST_SIZE;
    self.sweepAssetsCost = hash;
    if (!address || address == '') return;

    //Get the balance of ALL assets at this address
    $.jqlog.debug('Updating normalized balances for a single address at balances ' + address)
    failoverAPI("get_normalized_balances", {'addresses': [address]}, function(balancesData, endpoint) {
      var assets = [], assetInfo = null;
      for (var i = 0; i < balancesData.length; i++) {
        assets.push(balancesData[i]['asset']);
      }
      //get info on the assets, since we need this for the create_issuance call during the sweep (to take ownership of the asset)
      failoverAPI("get_assets_info", {'assetsList': assets}, function(assetsData, endpoint) {
        //Create an SweepAssetInDropdownItemModel item
        for (var i = 0; i < balancesData.length; i++) {
          assetInfo = $.grep(assetsData, function(e) { return e['asset'] == balancesData[i]['asset']; })[0]; //O(n^2)
          self.availableAssetsToSweep.push(new SweepAssetInDropdownItemModel(
            balancesData[i]['asset'], balancesData[i]['quantity'], balancesData[i]['normalized_quantity'], assetInfo));

          var cost = 0;
          if (balancesData[i]['quantity'] > 0) {
            cost += MIN_FEE + (2 * MULTISIG_DUST_SIZE);
          }
          // need ownership transfer
          if (assetInfo['owner'] == self.addressForPrivateKey()) {
            cost += MIN_FEE + (4 * MULTISIG_DUST_SIZE);
          }
          self.sweepAssetsCost[balancesData[i]['asset']] = cost;
        }

        //Also get the BTC balance at this address and put at head of the list
        //We just check if unconfirmed balance > 0.
        WALLET.retrieveBTCAddrsInfo([address], function(data) {
          self.btcBalanceForPrivateKey(0);
          self.txoutsCountForPrivateKey = 0;
          //TODO: counterblockd return unconfirmedRawBal==0, after fixing we need use unconfirmedRawBal
          var unconfirmedRawBal = data[0]['confirmedRawBal'];
          if (unconfirmedRawBal > 0) {
            //We don't need to supply asset info to the SweepAssetInDropdownItemModel constructor for BTC
            // b/c we won't be transferring any asset ownership with it
            var viewModel = new SweepAssetInDropdownItemModel(KEY_ASSET.BTC, unconfirmedRawBal, normalizeQuantity(unconfirmedRawBal));
            self.availableAssetsToSweep.unshift(viewModel);
            assets.push(KEY_ASSET.BTC);
            self.btcBalanceForPrivateKey(data[0]['confirmedRawBal']);
            self.txoutsCountForPrivateKey = data[0]['rawUtxoData'].length;

          }
          // select all assets by default
          $('#availableAssetsToSweep').val(assets);
          $('#availableAssetsToSweep').change();
        });

      });

    });
  });

  self.addressForPrivateKeyForFees.subscribe(function(address) {
    if (!address || address == '') {
      self.addressForFeesBalanceMessage('');
      self.addressForFeesBalance(0);
      return;
    }
    WALLET.retrieveBTCAddrsInfo([address], function(data) {
      self.addressForFeesBalanceMessage([normalizeQuantity(data[0]['confirmedRawBal']), KEY_ASSET.BTC, 'in', address].join(' '));
      self.addressForFeesBalance(data[0]['confirmedRawBal']);
    });
  });

  self.resetForm = function(fromOldWallet) {
    self.fromOldWallet(fromOldWallet);
    self.privateKey('');
    self.availableAssetsToSweep([]);
    self.selectedAssetsToSweep([]);
    self.destAddress('');
    self.sweepingProgressionMessage('');
    self.sweepingProgressWidth('0%');
    self.addressForFeesBalanceMessage('');
    self.addressForFeesBalance(0);
    self.privateKeyForFees('');
    self.notEnoughBTC(false);
    self.txoutsCountForPrivateKey = 0;
    self.sweepingCurrentStep = 1;
    self.missingBtcForFees = 0;
    self.mergeCost = 0;

    //populate the list of addresseses again
    self.availableAddresses([]);
    var addresses = WALLET.getAddressesList(true);
    for (var i = 0; i < addresses.length; i++) {
      self.availableAddresses.push(new BalancesAddressInDropdownItemModel(addresses[i][0], addresses[i][1]));
    }

    self.availableOldAddresses([]);
    if (self.fromOldWallet()) {
      WALLET.BITCOIN_WALLET.getOldAddressesInfos(function(data) {
        for (var address in data) {
          if (self.excludedOldAddresses.indexOf(address) == -1) {
            self.availableOldAddresses.push(new BalancesAddressInDropdownItemModel(address, address, data[address][KEY_ASSET.BTC]['privkey']));
          }
        }
      });
    }

    self.validationModel.errors.showAllMessages(false);
  }

  self.showNextMessage = function(message) {
    var width = self.sweepingCurrentStep * (100 / self.availableAssetsToSweep().length);
    self.sweepingProgressWidth(width + '%');
    var message = i18n.t('step_x_of_y_message', self.sweepingCurrentStep, self.availableAssetsToSweep().length, message);
    self.sweepingProgressionMessage(message);
    $.jqlog.debug(message);
  }

  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }

    //data entry is valid...submit to trigger doAction()
    $('#sweepModal form').submit();
  }

  self._sweepCompleteDialog = function(opsComplete) {
    var assetDisplayList = [];
    for (var i = 0; i < opsComplete.length; i++) {
      if (opsComplete[i]['result']) {
        if (opsComplete[i]['type'] == 'send') {
          assetDisplayList.push("<li><b class='notoAssetColor'>" + opsComplete[i]['asset'] + ":</b> " +
            i18n.t('asset_sent_to', opsComplete[i]['normalized_quantity'], opsComplete[i]['asset'], getAddressLabel(opsComplete[i]['to'])) + "</b>"
            + "</li>");
        } else {
          assert(opsComplete[i]['type'] == 'transferOwnership');
          assetDisplayList.push("<li><b class='notoAssetColor'>" + opsComplete[i]['asset'] + ":</b> " +
            i18n.t('transferred_ownership', getAddressLabel(opsComplete[i]['to'])) + "</b>"
            + "</li>");
        }
      } else {
        if (opsComplete[i]['type'] == 'send') {
          assetDisplayList.push("<li><b class='notoAssetColor'>" + opsComplete[i]['asset'] + "</b>: " + i18n.t("funds_sent_failure") + "</li>");
        } else {
          assert(opsComplete[i]['type'] == 'transferOwnership');
          assetDisplayList.push("<li><b class='notoAssetColor'>" + opsComplete[i]['asset'] + "</b>: " + i18n.t("ownership_transfer_failure") + "</li>");
        }
      }
    }
    var alertCallback = null;
    if (self.fromOldWallet() && self.availableOldAddresses().length > 1) {
      alertCallback = function() {
        self.show(true, true, self.addressForPrivateKey());
      }
    }
    bootbox.alert(i18n.t("sweep_from_completed", self.addressForPrivateKey()) + "<br/><br/><ul>" + assetDisplayList.join('') + "</ul>"
      + " " + i18n.t(ACTION_PENDING_NOTICE), alertCallback);
  }


  self.waitTxoutCountIncrease = function(callback) {
    setTimeout(function() {
      WALLET.retrieveBTCAddrsInfo([self.addressForPrivateKey()], function(data) {
        $.jqlog.debug('initial txo count: ' + self.txoutsCountForPrivateKey);
        $.jqlog.debug('new txo count: ' + data[0]['rawUtxoData'].length);
        if (self.txoutsCountForPrivateKey < data[0]['rawUtxoData'].length) {
          self.txoutsCountForPrivateKey = data[0]['rawUtxoData'].length;
          callback();
        } else {
          self.waitTxoutCountIncrease(callback);
        }
      });
    }, TRANSACTION_DELAY);
  }

  self.sendBtcForFees = function(callback) {
    var cwk = new CWPrivateKey(self.privateKeyForFees());
    var pubkey = cwk.getPub();

    // if address has one ouptut, it will has two after this transaction..
    // ..so need output merging
    if (self.txoutsCountForPrivateKey == 1) {
      self.missingBtcForFees += 2 * MIN_FEE;
    }
    // To avoid "Destination output is below the dust target value" error
    var sweepBTC = false;
    for (var i = 0; i < self.selectedAssetsToSweep().length; i++) {
      var assetName = self.selectedAssetsToSweep()[i];
      if (assetName === KEY_ASSET.BTC) sweepBTC = true;
    }
    if (sweepBTC) {
      self.missingBtcForFees += REGULAR_DUST_SIZE;
    }
    $.jqlog.debug('missingBtcForFees: ' + self.missingBtcForFees);

    var sendData = {
      source: self.addressForPrivateKeyForFees(),
      destination: self.addressForPrivateKey(),
      quantity: self.missingBtcForFees,
      asset: KEY_ASSET.BTC,
      encoding: 'auto',
      pubkey: pubkey,
      allow_unconfirmed_inputs: true
    };

    var onTransactionBroadcasted = function(sendTxHash, endpoint) { //broadcast was successful
      // No need to display this transaction in notifications
      $.jqlog.debug("waiting " + TRANSACTION_DELAY + "ms");
      var newBalance = self.btcBalanceForPrivateKey() + self.missingBtcForFees;
      self.btcBalanceForPrivateKey(newBalance);
      // waiting for transaction is correctly broadcasted
      self.waitTxoutCountIncrease(callback);
    }

    var onTransactionCreated = function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {
      cwk.checkAndSignRawTransaction(unsignedTxHex, [self.addressForPrivateKey()], function(err, signedHex) {
        if (err) {
          return onTransactionSignError(err);
        }

        WALLET.broadcastSignedTx(signedHex, onTransactionBroadcasted, onBroadcastError);
      });
    }

    var onTransactionError = function() {
      if (arguments.length == 4) {
        self.shown(false);
        bootbox.alert(arguments[1]);
      } else {
        self.shown(false);
        bootbox.alert(i18n.t('consensus_error'));
      }
    }
    var onConsensusError = onTransactionError;
    var onSysError = onTransactionError;
    var onBroadcastError = onTransactionError;
    var onTransactionSignError = function(err) {
      bootbox.alert(err.message || err);
    };

    var message = i18n.t("sending_btc_for_sweeping_fees", normalizeQuantity(self.missingBtcForFees), self.addressForPrivateKeyForFees());
    self.sweepingProgressionMessage(message);
    $.jqlog.debug(message);
    multiAPIConsensus("create_send", sendData, onTransactionCreated, onConsensusError, onSysError);
  }

  // in first step, we merge all outputs for chaining: each change output serve as input for next transaction.
  // so the final balance for btc transfert is the value of last change that we get with extractChangeTxoutValue()
  // TODO: think for a more economic way to have a reliable amount for the final tx (BTC).
  self.mergeOutputs = function(key, pubkey, callback, fees) {
    if (self.txoutsCountForPrivateKey > 1) {

      var message = i18n.t("peparing_transaction_chaining");
      self.sweepingProgressionMessage(message);
      $.jqlog.debug(message);

      fees = (typeof fees === "undefined") ? self.mergeCost : fees;

      $.jqlog.debug("MERGE COST: " + normalizeQuantity(fees));

      var sendData = {
        source: self.addressForPrivateKey(),
        destination: self.addressForPrivateKey(),
        quantity: self.btcBalanceForPrivateKey() - fees,
        asset: KEY_ASSET.BTC,
        encoding: 'auto',
        pubkey: pubkey,
        allow_unconfirmed_inputs: true,
        fee: fees
      };

      var onTransactionError = function() {
        if (arguments.length == 4) {
          var match = arguments[1].match(/Insufficient [^\s]+ at address [^\s]+\. \(Need approximately ([\d]+\.[\d]+) [^\s]+/);

          if (match != null) {
            $.jqlog.debug(arguments[1]);
            // if insufficient bitcoins we retry with estimated fees return by counterpartyd
            var minEstimateFee = denormalizeQuantity(parseFloat(match[1])) - (self.btcBalanceForPrivateKey() - self.mergeCost);
            $.jqlog.debug('Insufficient fees. Need approximately ' + normalizeQuantity(minEstimateFee));

            if (minEstimateFee > self.btcBalanceForPrivateKey()) {
              self.shown(false);
              bootbox.alert(arguments[1]);
            } else {
              $.jqlog.debug('Retry with estimated fees.');
              setTimeout(function() {
                self.mergeOutputs(key, pubkey, callback, minEstimateFee);
              }, 500); //wait 0.5s by courtesy
            }
          } else {
            self.shown(false);
            bootbox.alert(arguments[1]);
          }
        } else {
          bootbox.alert(i18n.t('consensus_error'));
        }
      }

      var onConsensusError = onTransactionError;
      var onSysError = onTransactionError;
      var onBroadcastError = onTransactionError;
      var onTransactionSignError = function(err) {
        bootbox.alert(err.message || err);
      };

      var onTransactionBroadcasted = function(sendTxHash, endpoint) { //broadcast was successful
        // No need to display this transaction in notifications
        $.jqlog.debug("waiting " + TRANSACTION_DELAY + "ms");
        setTimeout(function() {
          callback(); //will trigger callback() once done
        }, TRANSACTION_DELAY);
      }

      var onTransactionCreated = function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {
        key.checkAndSignRawTransaction(unsignedTxHex, [self.addressForPrivateKey()], function(err, signedHex) {
          if (err) {
            return onTransactionSignError(err);
          }

          WALLET.broadcastSignedTx(signedHex, onTransactionBroadcasted, onBroadcastError);
        });
      }

      $.jqlog.debug("Create merge outputs transactions");
      multiAPIConsensus("create_send", sendData, onTransactionCreated, onConsensusError, onSysError);

    } else {
      // Only one input, nothing to do
      callback();
    }
  }

  self._doTransferAsset = function(selectedAsset, key, pubkey, opsComplete, callback) {
    assert(selectedAsset.ASSET && selectedAsset.ASSET_INFO);

    self.showNextMessage(i18n.t("transferring_asset_from_to", selectedAsset.ASSET, self.addressForPrivateKey(), self.destAddress()));

    var transferData = {
      source: self.addressForPrivateKey(),
      quantity: 0,
      asset: selectedAsset.ASSET,
      divisible: selectedAsset.ASSET_INFO['divisible'],
      description: selectedAsset.ASSET_INFO['description'],
      transfer_destination: self.destAddress(),
      encoding: 'auto',
      pubkey: pubkey,
      allow_unconfirmed_inputs: true
    };
    multiAPIConsensus("create_issuance", transferData,
      function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {

        key.checkAndSignRawTransaction(unsignedTxHex, [self.destAddress()], function(err, signedHex) {
          if (err) {
            // @TODO: is this the correct way of handling err?
            $.jqlog.debug('sign raw error: ' + (err.message || err));
            // retry..
            return callback(true, {
              'type': 'transferOwnership',
              'result': false,
              'asset': selectedAsset.ASSET,
              'selectedAsset': selectedAsset //TODO: we only need selectedAsset
            });
          }

          WALLET.broadcastSignedTx(signedHex, function(issuanceTxHash, endpoint) { //broadcast was successful
            opsComplete.push({
              'type': 'transferOwnership',
              'result': true,
              'asset': selectedAsset.ASSET,
              'from': self.addressForPrivateKey(),
              'to': self.destAddress()
            });
            PENDING_ACTION_FEED.add(issuanceTxHash, "issuances", transferData);

            // here we adjust the BTC balance whith the change output
            var newBtcBalance = CWBitcore.extractChangeTxoutValue(transferData.source, unsignedTxHex);
            $.jqlog.debug(['New', KEY_ASSET.BTC, 'balance:', newBtcBalance].join(' '));
            self.btcBalanceForPrivateKey(newBtcBalance);

            self.sweepingCurrentStep++;
            return callback();

          }, function(jqXHR, textStatus, errorThrown, endpoint) { //on error broadcasting tx

            $.jqlog.debug('broadcasting error: ' + textStatus);
            // retry..
            return callback(true, {
              'type': 'transferOwnership',
              'result': false,
              'asset': selectedAsset.ASSET,
              'selectedAsset': selectedAsset //TODO: we only need selectedAsset
            });

          });
        });
      }, function(unmatchingResultsList) { //onConsensusError
        opsComplete.push({
          'type': 'transferOwnership',
          'result': false,
          'asset': selectedAsset.ASSET,
          'selectedAsset': selectedAsset
        });
        return self.showSweepError(selectedAsset.ASSET, opsComplete);
      }, function(jqXHR, textStatus, errorThrown, endpoint) { //onSysError

        $.jqlog.debug('onSysError: ' + textStatus);
        // retry..
        return callback(true, {
          'type': 'transferOwnership',
          'result': false,
          'asset': selectedAsset.ASSET,
          'selectedAsset': selectedAsset
        });

      }
    );
  }

  self._doSendAsset = function(asset, key, pubkey, opsComplete, adjustedBTCQuantity, callback) {
    $.jqlog.debug('_doSendAsset: ' + asset);

    //TODO: remove this
    if (asset === KEY_ASSET.BTC) assert(adjustedBTCQuantity !== null);
    else assert(adjustedBTCQuantity === null);

    var selectedAsset = ko.utils.arrayFirst(self.availableAssetsToSweep(), function(item) {
      return asset == item.ASSET;
    });
    var sendTx = null, i = null;

    $.jqlog.debug("btcBalanceForPrivateKey: " + self.btcBalanceForPrivateKey());
    var quantity = (asset === KEY_ASSET.BTC) ? (self.btcBalanceForPrivateKey() - MIN_FEE) : selectedAsset.RAW_BALANCE;
    var normalizedQuantity = (asset === KEY_ASSET.BTC) ? normalizeQuantity(quantity) : selectedAsset.NORMALIZED_BALANCE;

    assert(selectedAsset);

    if (!quantity) { //if there is no quantity to send for the asset, only do the transfer
      if (asset === KEY_ASSET.XCP || asset === KEY_ASSET.BTC) { //nothing to send, and no transfer to do
        return callback(); //my valuable work here is done!
      } else {
        self._doTransferAsset(selectedAsset, key, pubkey, opsComplete, callback); //will trigger callback() once done
        return;
      }
    }

    self.showNextMessage(i18n.t('sweeping_x_assets_from_to',
      normalizedQuantity, selectedAsset.ASSET, self.addressForPrivateKey(), self.destAddress()));

    //dont use WALLET.doTransaction for this...
    var sendData = {
      source: self.addressForPrivateKey(),
      destination: self.destAddress(),
      quantity: quantity,
      asset: selectedAsset.ASSET,
      encoding: 'auto',
      pubkey: pubkey,
      allow_unconfirmed_inputs: true
    };
    multiAPIConsensus("create_send", sendData, //can send both BTC and counterparty assets
      function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {

        key.checkAndSignRawTransaction(unsignedTxHex, [self.destAddress()], function(err, signedHex) {
          if (err) {
            // @TODO: is this the correct way of handling err?
            $.jqlog.debug('sign raw error: ' + (err.message || err));
            // retry..
            return callback(true, {
              'type': 'send',
              'result': false,
              'asset': selectedAsset.ASSET,
              'selectedAsset': selectedAsset
            });
          }

          WALLET.broadcastSignedTx(signedHex, function(sendTxHash, endpoint) { //broadcast was successful
            opsComplete.push({
              'type': 'send',
              'result': true,
              'asset': selectedAsset.ASSET,
              'from': self.addressForPrivateKey(),
              'to': self.destAddress(),
              'normalized_quantity': normalizedQuantity
            });
            sendData['_assset_divisible'] = !(selectedAsset.RAW_BALANCE == selectedAsset.NORMALIZED_BALANCE); //if the balances match, the asset is NOT divisible
            PENDING_ACTION_FEED.add(sendTxHash, "sends", sendData);

            // here we adjust the BTC balance whith the change output
            if (selectedAsset.ASSET !== KEY_ASSET.BTC) {
              var newBtcBalance = CWBitcore.extractChangeTxoutValue(sendData.source, unsignedTxHex);
              $.jqlog.debug(['New', KEY_ASSET.BTC, 'balance:', newBtcBalance].join(' '));
              self.btcBalanceForPrivateKey(newBtcBalance);
            }

            //For non BTC/XCP assets, also take ownership (iif the address we are sweeping from is the asset's owner')
            if (selectedAsset.ASSET !== KEY_ASSET.XCP
              && selectedAsset.ASSET !== KEY_ASSET.BTC
              && selectedAsset.ASSET_INFO['owner'] == self.addressForPrivateKey()) {
              $.jqlog.debug("waiting " + TRANSACTION_DELAY + "ms");
              setTimeout(function() {
                self._doTransferAsset(selectedAsset, key, pubkey, opsComplete, callback); //will trigger callback() once done
              }, TRANSACTION_DELAY);
            } else { //no transfer, just an asset send for this asset
              self.sweepingCurrentStep++;
              return callback();
            }
            // TODO: add param response in json format for error callback
          }, function(jqXHR, textStatus, errorThrown, endpoint) { //on error broadcasting tx

            $.jqlog.debug('Transaction error: ' + textStatus);
            // retry..
            return callback(true, {
              'type': 'send',
              'result': false,
              'asset': selectedAsset.ASSET,
              'selectedAsset': selectedAsset
            });

          });
        });
      }, function(unmatchingResultsList) { //onConsensusError
        opsComplete.push({
          'type': 'send',
          'result': false,
          'asset': selectedAsset.ASSET,
          'selectedAsset': selectedAsset
        });
        self.showSweepError(selectedAsset.ASSET, opsComplete);
      }, function(jqXHR, textStatus, errorThrown, endpoint) { //onSysError

        $.jqlog.debug('onSysError error: ' + textStatus);
        // retry..
        return callback(true, {
          'type': 'send',
          'result': false,
          'asset': selectedAsset.ASSET,
          'selectedAsset': selectedAsset
        });

      }
    );
  }

  self.showSweepError = function(asset, opsComplete) {
    $.jqlog.debug("Error sweeping " + asset);
    self.shown(false);
    self._sweepCompleteDialog(opsComplete);
  }

  self.doAction = function() {
    var cwk = new CWPrivateKey(self.privateKey());
    var pubkey = cwk.getPub();

    var sendsToMake = [];
    var opsComplete = [];

    var selectedAsset = null, hasBTC = false;
    for (var i = 0; i < self.selectedAssetsToSweep().length; i++) {
      selectedAsset = self.selectedAssetsToSweep()[i];
      if (selectedAsset === KEY_ASSET.BTC) {
        hasBTC = i; //send BTC last so the sweep doesn't randomly eat our primed txouts for the other assets
      } else {
        sendsToMake.push([selectedAsset, cwk, pubkey, opsComplete, null]);
      }
    }
    if (hasBTC !== false) {
      //This balance is adjusted after each asset transfert with the change output.
      sendsToMake.push([KEY_ASSET.BTC, cwk, pubkey, opsComplete, self.btcBalanceForPrivateKey()]);
    }

    var total = sendsToMake.length;
    var sendParams = false;
    var retryCounter = {};

    var doSweep = function(retry, failedTx) {
      // if retry we don't take the next sendsToMake item
      if (retry !== true || sendParams === false) {

        sendParams = sendsToMake.shift();

      } else if (retry) {

        if (sendParams[0] in retryCounter) {
          if (retryCounter[sendParams[0]] < TRANSACTION_MAX_RETRY) {
            retryCounter[sendParams[0]]++;
            $.jqlog.debug("retry count: " + retryCounter[sendParams[0]]);
          } else {
            sendParams = undefined;
            opsComplete.push(failedTx);
            $.jqlog.debug("max retry.. stopping");
          }
        } else {
          retryCounter[sendParams[0]] = 1;
          $.jqlog.debug("retry count: 1");
        }

      }

      if (sendParams === undefined) {

        // No more asset or max retry occur
        self.shown(false);
        self._sweepCompleteDialog(opsComplete);

      } else {

        if (retry && failedTx['type'] == 'transferOwnership') {

          //TODO: this is ugly. transfert asset must be include in sendsToMake array
          self._doTransferAsset(failedTx['selectedAsset'], sendParams[1], sendParams[2], opsComplete, function(retry, failedTx) {
            $.jqlog.debug("waiting " + TRANSACTION_DELAY + "ms");
            setTimeout(function() {
              doSweep(retry, failedTx);
            }, TRANSACTION_DELAY);
          });

        } else {

          self._doSendAsset(sendParams[0], sendParams[1], sendParams[2], sendParams[3], sendParams[4], function(retry, failedTx) {
            $.jqlog.debug("waiting " + TRANSACTION_DELAY + "ms");
            setTimeout(function() {
              doSweep(retry, failedTx);
            }, TRANSACTION_DELAY);
          });

        }

      }
    }

    var launchSweep = function() {
      if (sendsToMake.length === 1 && sendsToMake[0][0] === KEY_ASSET.BTC) {
        doSweep();
      } else {
        // merge output then start sweeping.
        self.mergeOutputs(cwk, pubkey, doSweep);
      }
    }

    trackEvent('Balances', self.fromOldWallet() ? 'SweepFromOldWallet' : 'Sweep');

    if (self.missingBtcForFees > 0 && self.privateKeyForFeesValidated.isValid() != '') {
      // send btc to pay fees then launch sweeping
      self.sendBtcForFees(launchSweep);
    } else {
      launchSweep();
    }
  }

  self.show = function(resetForm, fromOldWallet, excludeOldAddress) {
    if (typeof(resetForm) === 'undefined') resetForm = true;
    if (typeof(fromOldWallet) === 'undefined') fromOldWallet = false;
    if (typeof(excludeOldAddress) !== 'undefined') self.excludedOldAddresses.push(excludeOldAddress);

    if (resetForm) self.resetForm(fromOldWallet);
    self.shown(true);
    trackDialogShow(fromOldWallet ? 'SweepFromOldWallet' : 'Sweep');
  }

  self.hide = function() {
    self.shown(false);
  }
}


function SignMessageModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(null); //address string, not an Address object
  self.message = ko.observable('').extend({
    required: true
  });
  self.signatureFormat = ko.observable('base64');

  self.signedMessage = ko.observable();

  self.validationModel = ko.validatedObservable({
    message: self.message
  });

  self.resetForm = function() {
    self.address(null);
    self.message('');
    self.signedMessage('');
    self.validationModel.errors.showAllMessages(false);
  }

  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }
    //data entry is valid...submit to trigger doAction()
    $('#signMessageModal form').submit();
  }

  self.show = function(address, resetForm) {
    if (typeof(resetForm) === 'undefined') resetForm = true;
    if (resetForm) self.resetForm();
    self.address(address);
    self.shown(true);
    trackDialogShow('SignMessage');
  }

  self.hide = function() {
    self.shown(false);
  }

  self.doAction = function() {
    assert(self.validationModel.isValid(), "Cannot sign");
    var key = WALLET.getAddressObj(self.address()).KEY;
    var format = self.signatureFormat() == 'base64' ? 'base64' : 'hex';
    var signedMessage = key.signMessage(self.message(), format);
    self.signedMessage(signedMessage);
    $("#signedMessage").effect("highlight", {}, 1500);
    trackEvent('Balances', 'SignMessage');
    //Keep the form up after signing, the user will manually press Close to close it...
  }
}

function TestnetBurnModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(''); // SOURCE address (supplied)
  self.btcAlreadyBurned = ko.observable(null); // quantity BTC already burned from this address (normalized)

  self.btcBurnQuantity = ko.observable('').extend({
    required: true,
    isValidPositiveQuantity: self,
    validation: [{
      validator: function(val, self) {
        return parseFloat(val) > 0 && parseFloat(val) <= 1;
      },
      message: i18n.t('quantity_must_be_between_0_and_1'),
      params: self
    }, {
      validator: function(val, self) {
        return parseFloat(val) <= WALLET.getBalance(self.address(), KEY_ASSET.BTC) - normalizeQuantity(MIN_FEE);
      },
      message: i18n.t('quantity_of_exceeds_balance', KEY_ASSET.BTC),
      params: self
    }, {
      validator: function(val, self) {
        return !(parseFloat(val) > 1 - self.btcAlreadyBurned());
      },
      message: i18n.t('you_can_only_burn'),
      params: self
    }]
  });

  self.quantityXCPToBeCreated = ko.computed(function() { //normalized
    if (!self.btcBurnQuantity() || !parseFloat(self.btcBurnQuantity())) return null;
    return testnetBurnDetermineEarned(WALLET.networkBlockHeight(), self.btcBurnQuantity());
  }, self);

  self.dispQuantityXCPToBeCreated = ko.computed(function() {
    return numberWithCommas(self.quantityXCPToBeCreated());
  }, self);

  self.maxPossibleBurn = ko.computed(function() { //normalized
    if (self.btcAlreadyBurned() === null) return null;
    return Math.min(1 - self.btcAlreadyBurned(), WALLET.getAddressObj(self.address()).getAssetObj(KEY_ASSET.BTC).normalizedBalance())
  }, self);

  self.validationModel = ko.validatedObservable({
    btcBurnQuantity: self.btcBurnQuantity
  });

  self.resetForm = function() {
    self.btcBurnQuantity('');
    self.validationModel.errors.showAllMessages(false);
  }

  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }
    $('#testnetBurnModal form').submit();
  }

  self.doAction = function() {
    //do the additional issuance (specify non-zero quantity, no transfer destination)
    WALLET.doTransaction(self.address(), "create_burn",
      {
        source: self.address(),
        quantity: denormalizeQuantity(self.btcBurnQuantity())
      },
      function(txHash, data, endpoint, addressType, armoryUTx) {
        self.shown(false);

        var message;
        if (armoryUTx) {
          message = i18n.t("you_will_be_burning", self.btcBurnQuantity(), self.quantityXCPToBeCreated());
        } else {
          message = i18n.t("you_have_burned", self.btcBurnQuantity(), self.quantityXCPToBeCreated());
        }
        WALLET.showTransactionCompleteDialog(message + " " + i18n.t(ACTION_PENDING_NOTICE), message, armoryUTx);
      }
    );
    trackEvent('Balances', 'TestnetBurn');
  }

  self.show = function(address, resetForm) {
    if (typeof(resetForm) === 'undefined') resetForm = true;
    if (resetForm) self.resetForm();
    self.address(address);

    //get the current block height, to calculate the XCP burn payout
    //determine whether the selected address has burned before, and if so, how much
    failoverAPI("get_burns", {filters: {'field': 'source', 'op': '==', 'value': address}}, function(data, endpoint) {
      var totalBurned = 0;
      for (var i = 0; i < data.length; i++) {
        totalBurned += data[i]['burned'];
      }

      self.btcAlreadyBurned(normalizeQuantity(totalBurned));
      self.shown(true);
      trackDialogShow('TestnetBurn');
    });
  }

  self.hide = function() {
    self.shown(false);
  }
}

function DisplayPrivateKeyModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(null); //address string, not an Address object
  self.privateKeyText = ko.observable(null);

  self.resetForm = function() {
    self.address(null);
    self.privateKeyText(null);
  }

  self.show = function(address, resetForm) {
    if (typeof(resetForm) === 'undefined') resetForm = true;
    if (resetForm) self.resetForm();
    self.address(address);
    self.shown(true);
    trackDialogShow('DisplayPrivateKey');
  }

  self.hide = function() {
    self.shown(false);
  }

  self.displayPrivateKey = function() {
    var wif = WALLET.getAddressObj(self.address()).KEY.getWIF();
    self.privateKeyText(wif);
    trackEvent('Balances', 'DisplayPrivateKey');
  }
}


function BroadcastModalViewModel() {
  var self = this;

  self.addressObj = null;

  self.shown = ko.observable(false);

  self.address = ko.observable(null).extend({
    required: true
  });

  self.textValue = ko.observable('').extend({
    required: true
  });

  self.numericalValue = ko.observable(-1).extend({
    number: true
  });

  self.feeFraction = ko.observable(0).extend({
    max: 42.94967295,
    isValidPositiveQuantityOrZero: self

  });

  self.broadcastDate = ko.observable(new Date()).extend({
    date: true
  });

  self.validationModel = ko.validatedObservable({
    address: self.address,
    textValue: self.textValue,
    numericalValue: self.numericalValue,
    feeFraction: self.feeFraction,
    broadcastDate: self.broadcastDate
  });

  self.resetForm = function() {
    self.addressObj = null;
    self.address(null);
    self.textValue('');
    self.numericalValue(-1);
    self.feeFraction(0);
    self.broadcastDate(new Date());
    self.validationModel.errors.showAllMessages(false);
  }

  self.show = function(addressObj, resetForm) {
    if (typeof(resetForm) === 'undefined') resetForm = true;
    if (resetForm) self.resetForm();
    self.addressObj = addressObj;
    self.address(self.addressObj.ADDRESS);
    self.shown(true);
    trackDialogShow('Broadcast');
  }

  self.hide = function() {
    self.shown(false);
  }

  self.submitForm = function() {
    //Update the date in the model from what the date/time widget says
    self.broadcastDate($("input[name='broadcastTimestamp']").data("DateTimePicker").date.toDate())

    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }
    //data entry is valid...submit to the server
    $('#broadcastModal form').submit();
  }

  self.doAction = function() {
    var params = self.buildBroadcastTransactionData()

    var onSuccess = function(txHash, data, endpoint, addressType, armoryUTx) {
      self.hide();
      WALLET.showTransactionCompleteDialog(i18n.t("broadcast_transmitted") + " " + i18n.t(ACTION_PENDING_NOTICE),
        i18n.t("broadcast_to_be_transmitted"), armoryUTx);
    }

    var onError = function(jqXHR, textStatus, errorThrown, endpoint) {
      self.hide();
      bootbox.alert(textStatus);
    }

    WALLET.doTransactionWithTxHex(self.address(), "create_broadcast", params, self.feeController.getUnsignedTx(), onSuccess, onError);
    trackEvent('Balances', 'Broadcast');
  }

  self.buildBroadcastTransactionData = function() {
    return {
      source: self.address(),
      fee_fraction: Decimal.round(new Decimal(self.feeFraction()).div(100), 8, Decimal.MidpointRounding.ToEven).toFloat(),
      text: self.textValue(),
      timestamp: self.broadcastDate() ? parseInt(self.broadcastDate().getTime() / 1000) : null,
      value: parseFloat(self.numericalValue()),
      _fee_option: 'custom',
      _custom_fee: self.feeController.getCustomFee()
    };
  }

  // mix in shared fee calculation functions
  self.feeController = CWFeeModelMixin(self, {
    action: "create_broadcast",
    transactionParameters: [self.address, self.textValue, self.numericalValue, self.feeFraction, self.broadcastDate],
    validTransactionCheck: function() {
      return self.validationModel.isValid();
    },
    buildTransactionData: self.buildBroadcastTransactionData
  });
}

function SignTransactionModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(null); //address string, not an Address object
  self.unsignedTx = ko.observable('').extend({
    required: true
  });
  self.signedTx = ko.observable();
  self.validTx = ko.observable(false);

  self.validationModel = ko.validatedObservable({
    unsignedTx: self.unsignedTx
  });

  self.resetForm = function() {
    self.address(null);
    self.unsignedTx('');
    self.signedTx('');
    self.validTx(false);
    self.validationModel.errors.showAllMessages(false);
  }

  self.show = function(address, resetForm) {
    if (typeof(resetForm) === 'undefined') resetForm = true;
    if (resetForm) self.resetForm();
    self.address(address);
    self.shown(true);
    trackDialogShow('SignTransaction');
  }

  self.hide = function() {
    self.shown(false);
  }

  self.signTransaction = function() {
    assert(self.validationModel.isValid(), "Cannot sign");
    var cwk = WALLET.getAddressObj(self.address()).KEY;
    var signedHex = '';
    try {

      CWBitcore.signRawTransaction(self.unsignedTx(), cwk, true, function(err, signedHex) {
        if (err) {
          self.signedTx(err.message);
          self.validTx(false);
          return;
        }

        self.signedTx(signedHex);
        $("#signedMessage").effect("highlight", {}, 1500);
        trackEvent('Balances', 'SignTransaction');
        //Keep the form up after signing, the user will manually press Close to close it...
      });

    } catch (e) {
      self.signedTx(e.message);
      self.validTx(false);
    }

  }

  self.signAndBroadcastTransaction = function() {
    var cwk = WALLET.getAddressObj(self.address()).KEY;

    try {
      CWBitcore.signRawTransaction(self.unsignedTx(), cwk, true, function(err, signedHex) {
        if (err) {
          self.signedTx(err.message);
          self.validTx(false);
          return;
        }

        self.signedTx(signedHex);
        $("#signedMessage").effect("highlight", {}, 1500);
        trackEvent('Balances', 'SignTransaction');

        var onSuccess = function(txHash, endpoint) {
          trackEvent('Balances', 'BroadcastTransaction');
          self.shown(false);
          bootbox.alert(i18n.t("your_tx_broadcast_success") + "<br /><br /><b>" + txHash + "</b>");
        }
        WALLET.broadcastSignedTx(self.signedTx(), onSuccess, defaultErrorHandler);
      });

    } catch (e) {
      self.signedTx(e.message);
      self.validTx(false);
    }

  }

}

function ArmoryBroadcastTransactionModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(null); //address string, not an Address object
  self.signedTx = ko.observable('').extend({
    required: true
  });

  self.validationModel = ko.validatedObservable({
    signedTx: self.signedTx
  });

  self.resetForm = function() {
    self.address(null);
    self.signedTx('');
    self.validationModel.errors.showAllMessages(false);
  }

  self.show = function(address, resetForm) {
    if (typeof(resetForm) === 'undefined') resetForm = true;
    if (resetForm) self.resetForm();
    self.address(address);
    self.shown(true);
    trackDialogShow('ArmoryBroadcastTransaction');
  }

  self.hide = function() {
    self.shown(false);
  }

  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }
    //data entry is valid...submit to the server
    $('#armoryBroadcastTransactionModal form').submit();
  }

  self.doAction = function() {
    var onSuccess = function(txHash, data, endpoint, addressType, armoryUTx) {
      self.hide();
      var message = i18n.t("your_tx_broadcast_success") + "<br /><br /><b>" + txHash + "</b>";
      WALLET.showTransactionCompleteDialog(message, message, armoryUTx);
    }

    failoverAPI("convert_armory_signedtx_to_raw_hex", {'signed_tx_ascii': self.signedTx()},
      function(data, endpoint) {
        WALLET.broadcastSignedTx(data, onSuccess);
      }
    );

    trackEvent('Balances', 'ArmoryBroadcastTransaction');
  }
}


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
