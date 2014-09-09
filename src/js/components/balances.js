
function ChangeAddressLabelModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(null); //address string, not an Address object
  self.existingLabel = ko.observable(null);
  
  self.newLabel = ko.observable('').trimmed().extend({
    required: true,
    validation: {
      validator: function (val, self) {
        return val.length <= 75;
      },
      message: 'Invalid label (max 75 characters)',
      params: self
    }    
  });
  
  self.validationModel = ko.validatedObservable({
    newLabel: self.newLabel
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
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
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


ko.validation.rules['canGetAddressPubKey'] = {
      async: true,
      message: 'Can\'t find the public key for this address. Please make a transaction with it and try again.',
      validator: function (val, self, callback) {
        if(self.addressType() != 'armory') return true; //only necessary for armory offline addresses
        failoverAPI("get_pubkey_for_address", {'address': val},
          function(data, endpoint) {
            self.armoryPubKey(data);
            return data ? callback(true) : callback(false)
          }
        );   
      }
    };

function CreateNewAddressModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);

  self.addressType = ko.observable(null); //addressType is one of: normal, watch, or armory
  self.armoryPubKey = ko.observable(null); //only set with armory offline addresses
  self.watchAddress = ko.observable('').extend({
    isValidBitcoinAddressIfSpecified: self,
    validation: [{
      validator: function (val, self) {
        return (self.addressType() == 'watch' || self.addressType() == 'armory') ? val : true;
      },
      message: 'This field is required.',
      params: self
    },{
      validator: function (val, self) {
        if(!val) return true; //the check above will cover it
        return !WALLET.getAddressObj(val);
      },
      message: 'This address is already in your wallet.',
      params: self
    }],
    canGetAddressPubKey: self
  });
  self.description = ko.observable('').extend({
    required: true,
    validation: {
      validator: function (val, self) {
        return val.length <= 70; //arbitrary
      },
      message: 'Address description is more than 70 characters long.',
      params: self
    }    
  });
  
  self.validationModel = ko.validatedObservable({
    description: self.description,
    watchAddress: self.watchAddress
  });
  
  self.dispWindowTitle = ko.computed(function() {
    return self.addressType() == 'normal' ? 'Create New Address' : (
      self.addressType() == 'watch' ? 'Add Watch Address' : 'Add Armory Offline Address');
  }, self);

  self.resetForm = function() {
    self.addressType(null);
    self.watchAddress('');
    self.description('');
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if(self.addressType() == 'armory' && self.watchAddress.isValidating()) {
      setTimeout(function() { //wait a bit and call again
        self.submitForm();
      }, 50);
      return;
    }
    
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    //data entry is valid...submit to trigger doAction()
    $('#createNewAddressModal form').submit();
  }

  self.doAction = function() {
    var newAddress = null;
    
    if(self.addressType() == 'normal') {
      newAddress = WALLET.addAddress(self.addressType());
    } else {
      newAddress = self.watchAddress(); //watch or armory
      newAddress = WALLET.addAddress(self.addressType(), newAddress, self.armoryPubKey());
    }

    //update PREFs
    var newAddressHash = hashToB64(newAddress);
    if(self.addressType() == 'normal') {
      PREFERENCES['num_addresses_used'] += 1;
    } else if(self.addressType() == 'watch') {
      PREFERENCES['watch_only_addresses'].push(newAddress); //can't use the hash here, unfortunately
    } else {
      assert(self.addressType() == 'armory');
      PREFERENCES['armory_offline_addresses'].push({'address': newAddress, 'pubkey_hex': self.armoryPubKey()}); //can't use the hash here, unfortunately
    }
    var sanitizedDescription = _.stripTags(self.description());
    PREFERENCES['address_aliases'][newAddressHash] = sanitizedDescription;
    
    //manually set the address in this case to get around the chicken and egg issue here (and have client side match the server)
    WALLET.getAddressObj(newAddress).label(sanitizedDescription);

    //save prefs to server
    WALLET.storePreferences(function(data, endpoint) {
      self.shown(false);
      
      if(self.addressType() != 'normal') {
        //If we created a watch or armory address, refresh the counterparty balances with this new address
        //btc address balances will refresh on the refresh of the balances page itself
        setTimeout(function() { WALLET.refreshCounterpartyBalances([newAddress], checkURL)});
      } else {
        //Otherwise (a new non-watch address), just refresh the page
        setTimeout(checkURL, 800); //necessary to use setTimeout so that the modal properly hides before we refresh the page
      }
    });
    trackEvent('Balances', self.addressType() == 'normal' ? 'CreateNewAddress' : (
      self.addressType() == 'watch' ? 'CreateNewWatchAddress' : 'CreateNewArmoryOfflineAddress'));
  }
  
  self.show = function(addressType, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.addressType(addressType);
    self.shown(true);
    trackDialogShow(self.addressType() == 'normal' ? 'CreateNewAddress' : (
      self.addressType() == 'watch' ? 'CreateNewWatchAddress' : 'CreateNewArmoryOfflineAddress'));
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
  self.rawBalance = ko.observable(null);
  self.divisible = ko.observable();
  
  self.destAddress = ko.observable('').trimmed().extend({
    required: true,
    isValidBitcoinAddress: self,
    isNotSameBitcoinAddress: self
  });
  self.quantity = ko.observable().extend({
    required: true,
    isValidPositiveQuantity: self,
    isValidQtyForDivisibility: self,
    validation: {
      validator: function (val, self) {
        if(normalizeQuantity(self.rawBalance(), self.divisible()) - parseFloat(val) < 0) {
          return false;
        }
        return true;
      },
      message: 'Quantity entered exceeds your current balance.',
      params: self
    }    
  });
  
  self.normalizedBalance = ko.computed(function() {
    if(self.address() === null || self.rawBalance() === null) return null;
    return normalizeQuantity(self.rawBalance(), self.divisible());
  }, self);
  
  self.dispNormalizedBalance = ko.computed(function() {
    return smartFormat(self.normalizedBalance());
  }, self);
  
  self.normalizedBalRemaining = ko.computed(function() {
    if(!isNumber(self.quantity())) return null;
    var curBalance = normalizeQuantity(self.rawBalance(), self.divisible());
    var balRemaining = Decimal.round(new Decimal(curBalance).sub(parseFloat(self.quantity())), 8, Decimal.MidpointRounding.ToEven).toFloat();
    if(balRemaining < 0) return null;
    return balRemaining;
  }, self);

  self.dispNormalizedBalRemaining = ko.computed(function() {
    return smartFormat(self.normalizedBalRemaining());
  }, self);
  
  self.normalizedBalRemainingIsSet = ko.computed(function() {
    return self.normalizedBalRemaining() !== null;
  }, self);
  
  self.validationModel = ko.validatedObservable({
    destAddress: self.destAddress,
    quantity: self.quantity
  });  
  
  self.resetForm = function() {
    self.destAddress('');
    self.quantity(null);
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
    if(self.asset() == BTC)
      self.quantity(subFloat(self.normalizedBalance(), normalizeQuantity(MIN_FEE)));
    else
      self.quantity(self.normalizedBalance());
  }

  self.doAction = function() {
    WALLET.doTransaction(self.address(), "create_send",
      { source: self.address(),
        destination: self.destAddress(),
        quantity: denormalizeQuantity(parseFloat(self.quantity()), self.divisible()),
        asset: self.asset(),
        _divisible: self.divisible()
      },
      function(txHash, data, endpoint, addressType, armoryUTx) {
        var message = "<b>Your funds " + (armoryUTx ? "will be" : "were") + " sent. ";
        WALLET.showTransactionCompleteDialog(message + ACTION_PENDING_NOTICE, message, armoryUTx);
      }
    );
    self.shown(false);
    trackEvent('Balances', 'Send', self.asset());
  }
  
  self.show = function(fromAddress, asset, rawBalance, isDivisible, resetForm) {
    if(asset == BTC && rawBalance == null) {
      return bootbox.alert("Cannot send <b class='notoAssetColor'>" + BTC + "</b> right now, as we cannot currently get"
        + " in touch with the server to get your balance. Please try again later.");
    }
    assert(rawBalance, "Balance is null or undefined?");
    
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.address(fromAddress);
    self.asset(asset);
    self.rawBalance(rawBalance);
    self.divisible(isDivisible);
    self.shown(true);
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
  this.SELECT_LABEL = asset + " (bal: " + normalizedBalance + ")";
  this.ASSET_INFO = assetInfo;
};


var privateKeyValidator = function(required) {
  return {
    required: required,
    validation: {
      validator: function (val, self) {       
        return (new CWPrivateKey(val)).isValid();
      },
      message: 'Not a valid' + (USE_TESTNET ? ' TESTNET ' : ' ') + 'private key.',
      params: self
    }, 
    rateLimit: { timeout: 500, method: "notifyWhenChangesStop" }
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
      validator: function (val, self, callback) {

        var sweepingCost = 0;

        for(var i = 0; i < self.selectedAssetsToSweep().length; i++) {
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
        var totalBtcBalanceForSweeep = self.btcBalanceForPrivateKey() + Math.max(0, (self.addressForFeesBalance()-MIN_FEE));
        self.missingBtcForFees = Math.max(MULTISIG_DUST_SIZE, sweepingCost - self.btcBalanceForPrivateKey());
   

        if  (totalBtcBalanceForSweeep < sweepingCost) {
          
          this.message = "We're not able to sweep all of the tokens you selected. Please send "
                        + normalizeQuantity(self.missingBtcForFees)
                        + " " + BTC + " transactions to address " + self.addressForPrivateKey() + " and try again."
                        + " OR use the following fields to pay fees with another address";
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
    privateKey: self.privateKey,
  });

  self.privateKeyForFeesValidated = ko.validatedObservable({
    privateKeyForFees: self.privateKeyForFees,
  });

  self.addressForPrivateKey = ko.computed(function() {
    if(!self.privateKeyValidated.isValid()) return null;
    //Get the address for this privatekey
    return (new CWPrivateKey(self.privateKey())).getAddress();
  }, self);

  self.addressForPrivateKeyForFees = ko.computed(function() {
    if(!self.privateKeyForFeesValidated.isValid() || self.privateKeyForFees()=='') {
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
    self.sweepAssetsCost = {};
    self.sweepAssetsCost[BTC] = MIN_FEE + REGULAR_DUST_SIZE;
    if(!address || address=='') return;

    //Get the balance of ALL assets at this address
    failoverAPI("get_normalized_balances", {'addresses': [address]}, function(balancesData, endpoint) {
      var assets = [], assetInfo = null;
      for(var i=0; i < balancesData.length; i++) {
        assets.push(balancesData[i]['asset']);
      }
      //get info on the assets, since we need this for the create_issuance call during the sweep (to take ownership of the asset)
      getAssetInfo(assets).then(function (assetsInfo) {
        //Create an SweepAssetInDropdownItemModel item
        for(var i=0; i < balancesData.length; i++) {
          assetInfo = $.grep(assetsInfo, function(e) { return e['asset'] == balancesData[i]['asset']; })[0]; //O(n^2)
          self.availableAssetsToSweep.push(new SweepAssetInDropdownItemModel(
            balancesData[i]['asset'], balancesData[i]['quantity'], balancesData[i]['normalized_quantity'], assetInfo));

          var cost = 0;
          if (balancesData[i]['quantity']>0) {
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
        WALLET.retriveBTCAddrsInfo([address], function(data) {
          self.btcBalanceForPrivateKey(0);
          self.txoutsCountForPrivateKey = 0;
          //TODO: counterblockd return unconfirmedRawBal==0, after fixing we need use unconfirmedRawBal
          var unconfirmedRawBal = data[0]['confirmedRawBal']; 
          if(unconfirmedRawBal > 0) {
            //We don't need to supply asset info to the SweepAssetInDropdownItemModel constructor for BTC
            // b/c we won't be transferring any asset ownership with it
            var viewModel = new SweepAssetInDropdownItemModel(BTC, unconfirmedRawBal, normalizeQuantity(unconfirmedRawBal));
            self.availableAssetsToSweep.unshift(viewModel);
            assets.push(BTC);
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
    if(!address || address=='') {
      self.addressForFeesBalanceMessage('');
      self.addressForFeesBalance(0);
      return;
    }
    WALLET.retriveBTCAddrsInfo([address], function(data) {
      $.jqlog.debug(data);
      self.addressForFeesBalanceMessage(normalizeQuantity(data[0]['confirmedRawBal']) + ' ' + BTC + ' in ' + address);
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
    for(var i = 0; i < addresses.length; i++) {
        self.availableAddresses.push(new BalancesAddressInDropdownItemModel(addresses[i][0], addresses[i][1]));
    }  

    self.availableOldAddresses([]);
    if (self.fromOldWallet()) {
      WALLET.BITCOIN_WALLET.getOldAddressesInfos(function(data) {
        for (var address in data) {
          if (self.excludedOldAddresses.indexOf(address) == -1) {
            self.availableOldAddresses.push(new BalancesAddressInDropdownItemModel(address, address, data[address][BTC]['privkey']));
          }       
        }
      }); 
    }    
    
    self.validationModel.errors.showAllMessages(false);
  }

  self.showNextMessage = function(message) {      
    var width = self.sweepingCurrentStep * (100 / self.availableAssetsToSweep().length);
    self.sweepingProgressWidth(width+'%');
    var message = "Step "+self.sweepingCurrentStep+"/"+self.availableAssetsToSweep().length+" : "+message;
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
    for(var i = 0; i < opsComplete.length; i++) {
      if(opsComplete[i]['result']) {
        if(opsComplete[i]['type'] == 'send') {
          assetDisplayList.push("<li><b class='notoAssetColor'>" + opsComplete[i]['asset'] + ":</b> Sent"
            + " <b class='notoQuantityColor'>" + opsComplete[i]['normalized_quantity'] + "</b>"
            + " <b class='notoAssetColor'>" + opsComplete[i]['asset'] + "</b>"
            + " to <b class='notoAddrColor'>" + getAddressLabel(opsComplete[i]['to']) + "</b></li>");  
        } else {
          assert(opsComplete[i]['type'] == 'transferOwnership');
          assetDisplayList.push("<li><b class='notoAssetColor'>" + opsComplete[i]['asset'] + ":</b> Transferred ownership"
            + " to <b class='notoAddrColor'>" + getAddressLabel(opsComplete[i]['to']) + "</b></li>");  
        }
      } else {
        if(opsComplete[i]['type'] == 'send') {
          assetDisplayList.push("<li><b class='notoAssetColor'>" + opsComplete[i]['asset'] + "</b>: Funds not sent due to failure.</li>");
        } else {
          assert(opsComplete[i]['type'] == 'transferOwnership');
          assetDisplayList.push("<li><b class='notoAssetColor'>" + opsComplete[i]['asset'] + "</b>: Ownership not transferred due to failure.</li>");
        }  
      }
    }
    var alertCallback = null;
    if (self.fromOldWallet() && self.availableOldAddresses().length>1) {
      alertCallback = function() {
        self.show(true, true, self.addressForPrivateKey());
      }
    }
    bootbox.alert("The sweep from address <b class='notoAddrColor'>" + self.addressForPrivateKey()
      + "</b> is complete.<br/>Sweep results:<br/><br/><ul>" + assetDisplayList.join('') + "</ul>"
      + ACTION_PENDING_NOTICE, alertCallback);
  }
  

  self.waitTxoutCountIncrease = function(callback) {
    setTimeout(function() {
      WALLET.retriveBTCAddrsInfo([self.addressForPrivateKey()], function(data) {
        $.jqlog.debug('initial txo count: ' + self.txoutsCountForPrivateKey);
        $.jqlog.debug('new txo count: ' + data[0]['rawUtxoData'].length);
        if (self.txoutsCountForPrivateKey<data[0]['rawUtxoData'].length) {
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
    if (self.txoutsCountForPrivateKey==1) {
      self.missingBtcForFees += 2 * MIN_FEE;
    }
    // To avoid "Destination output is below the dust target value" error
    var sweepBTC = false;
    for(var i = 0; i < self.selectedAssetsToSweep().length; i++) {
      var assetName = self.selectedAssetsToSweep()[i];
      if (assetName==BTC) sweepBTC = true;
    }
    if (sweepBTC) {
      self.missingBtcForFees += REGULAR_DUST_SIZE;
    }
    $.jqlog.debug('missingBtcForFees: '+self.missingBtcForFees);

    var sendData = {
      source: self.addressForPrivateKeyForFees(),
      destination: self.addressForPrivateKey(),
      quantity: self.missingBtcForFees,
      asset: BTC,
      encoding: 'multisig',
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
      var signedHex = cwk.checkAndSignRawTransaction(unsignedTxHex, self.addressForPrivateKey());
      WALLET.broadcastSignedTx(signedHex, onTransactionBroadcasted, onBroadcastError);
    }

    var onTransactionError = function() {
      if (arguments.length==4) {
        self.shown(false);
        bootbox.alert(arguments[1]);
      } else {
        self.shown(false);
        bootbox.alert('Consensus Error!');
      }
    }
    var onConsensusError = onTransactionError;
    var onSysError = onTransactionError;
    var onBroadcastError = onTransactionError;

    var message = "Sending " + normalizeQuantity(self.missingBtcForFees) + " " + BTC + " from "
                  + self.addressForPrivateKeyForFees() + " to pay sweeping fees.";
    self.sweepingProgressionMessage(message);
    $.jqlog.debug(message);
    multiAPIConsensus("create_send", sendData, onTransactionCreated, onConsensusError, onSysError);
  }

  // in first step, we merge all outputs for chaining: each change output serve as input for next transaction.
  // so the final balance for btc transfert is the value of last change that we get with extractChangeTxoutValue()
  // TODO: think for a more economic way to have a reliable amount for the final tx (BTC).
  self.mergeOutputs = function(key, pubkey, callback, fees) {
    if (self.txoutsCountForPrivateKey>1) {

      var message = "Preparing output for transactions chaining";
      self.sweepingProgressionMessage(message);
      $.jqlog.debug(message);

      fees = (typeof fees === "undefined") ? self.mergeCost : fees;

      $.jqlog.debug("MERGE COST: " + normalizeQuantity(fees));

      var sendData = {
        source: self.addressForPrivateKey(),
        destination: self.addressForPrivateKey(),
        quantity: self.btcBalanceForPrivateKey()-fees,
        asset: BTC,
        encoding: 'multisig',
        pubkey: pubkey,
        allow_unconfirmed_inputs: true,
        fee: fees
      };

      var onTransactionError = function() {
        if (arguments.length==4) {
          var match = arguments[1].match(new RegExp("Insufficient " + BTC_NAME + "s at address [^\\s]+\. \\(Need approximately ([\\d]+\\.[\\d]+) " + BTC + "\\)"));
          if (match!=null) {
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
          bootbox.alert('Consensus Error!');
        }
      }
      var onConsensusError = onTransactionError;
      var onSysError = onTransactionError;
      var onBroadcastError = onTransactionError;

      var onTransactionBroadcasted = function(sendTxHash, endpoint) { //broadcast was successful
        // No need to display this transaction in notifications
        $.jqlog.debug("waiting " + TRANSACTION_DELAY + "ms");
        setTimeout(function() {
          callback(); //will trigger callback() once done
        }, TRANSACTION_DELAY);
      }

      var onTransactionCreated = function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {
        var signedHex = key.checkAndSignRawTransaction(unsignedTxHex, self.addressForPrivateKey());
        WALLET.broadcastSignedTx(signedHex, onTransactionBroadcasted, onBroadcastError);
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

    self.showNextMessage("Transferring asset " + selectedAsset.ASSET + " from " + self.addressForPrivateKey() + " to " + self.destAddress());
    
    var transferData = {
      source: self.addressForPrivateKey(),
      quantity: 0,
      asset: selectedAsset.ASSET,
      divisible: selectedAsset.ASSET_INFO['divisible'],
      description: selectedAsset.ASSET_INFO['description'],
      callable_: selectedAsset.ASSET_INFO['callable'],
      call_date: selectedAsset.ASSET_INFO['call_date'] ? selectedAsset.ASSET_INFO['call_date'] : null,
      call_price: selectedAsset.ASSET_INFO['call_price'] ? parseFloat(selectedAsset.ASSET_INFO['call_price']) : null,
      transfer_destination: self.destAddress(),
      encoding: 'multisig',
      pubkey: pubkey,
      allow_unconfirmed_inputs: true
    };
    multiAPIConsensus("create_issuance", transferData,
      function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {
        
        var signedHex = key.checkAndSignRawTransaction(unsignedTxHex, self.destAddress());
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
          $.jqlog.debug("New " + BTC + " balance: " + newBtcBalance);
          self.btcBalanceForPrivateKey(newBtcBalance);

          self.sweepingCurrentStep++; 
          return callback();

        }, function(jqXHR, textStatus, errorThrown, endpoint) { //on error broadcasting tx

          $.jqlog.debug('broadcasting error: '+textStatus);
          // retry..
          return callback(true, {
            'type': 'transferOwnership',
            'result': false,
            'asset': selectedAsset.ASSET,
            'selectedAsset': selectedAsset //TODO: we only need selectedAsset
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

        $.jqlog.debug('onSysError: '+textStatus);
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
    if(asset == BTC) assert(adjustedBTCQuantity !== null);
    else assert(adjustedBTCQuantity === null);
    
    var selectedAsset = ko.utils.arrayFirst(self.availableAssetsToSweep(), function(item) {
      return asset == item.ASSET;
    });
    var sendTx = null, i = null;

    $.jqlog.debug("btcBalanceForPrivateKey: " + self.btcBalanceForPrivateKey());
    var quantity = (asset == BTC) ? (self.btcBalanceForPrivateKey() - MIN_FEE) : selectedAsset.RAW_BALANCE;
    var normalizedQuantity = (asset == BTC) ? normalizeQuantity(quantity) : selectedAsset.NORMALIZED_BALANCE;
    
    assert(selectedAsset);
    
    if(!quantity) { //if there is no quantity to send for the asset, only do the transfer
      if(asset == XCP || asset == BTC) { //nothing to send, and no transfer to do
        return callback(); //my valuable work here is done!
      } else {
        self._doTransferAsset(selectedAsset, key, pubkey, opsComplete, callback); //will trigger callback() once done
        return;
      }
    }

    self.showNextMessage("Sweeping " + normalizedQuantity + " " + selectedAsset.ASSET + " from "
      + self.addressForPrivateKey() + " to " + self.destAddress());
      
    //dont use WALLET.doTransaction for this...
    var sendData = {
      source: self.addressForPrivateKey(),
      destination: self.destAddress(),
      quantity: quantity,
      asset: selectedAsset.ASSET,
      encoding: 'multisig',
      pubkey: pubkey,
      allow_unconfirmed_inputs: true
    };
    multiAPIConsensus("create_send", sendData, //can send both BTC and counterparty assets
      function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {
        
        var signedHex = key.checkAndSignRawTransaction(unsignedTxHex, self.destAddress());

        WALLET.broadcastSignedTx(signedHex, function(sendTxHash, endpoint) { //broadcast was successful
          opsComplete.push({
            'type': 'send',
            'result': true,
            'asset': selectedAsset.ASSET,
            'from': self.addressForPrivateKey(),
            'to': self.destAddress(),
            'normalized_quantity': normalizedQuantity
          });
          sendData['_divisible'] = !(selectedAsset.RAW_BALANCE == selectedAsset.NORMALIZED_BALANCE); //if the balances match, the asset is NOT divisible
          PENDING_ACTION_FEED.add(sendTxHash, "sends", sendData);
          
          // here we adjust the BTC balance whith the change output
          if (selectedAsset.ASSET != BTC) {
            var newBtcBalance = CWBitcore.extractChangeTxoutValue(sendData.source, unsignedTxHex);
            $.jqlog.debug("New " + BTC + " balance: " + newBtcBalance);
            self.btcBalanceForPrivateKey(newBtcBalance);
          }

          //For non BTC/XCP assets, also take ownership (if the address we are sweeping from is the asset's owner')
          if (selectedAsset.ASSET != XCP
             && selectedAsset.ASSET != BTC
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
    $.jqlog.debug("Error sweeping "+asset);
    self.shown(false);
    self._sweepCompleteDialog(opsComplete);
  }
  
  self.doAction = function() {
    var cwk = new CWPrivateKey(self.privateKey());
    var pubkey = cwk.getPub();

    var sendsToMake = [];
    var opsComplete = [];
    
    var selectedAsset = null, hasBTC = false;
    for(var i = 0; i < self.selectedAssetsToSweep().length; i++) {
      selectedAsset = self.selectedAssetsToSweep()[i];
      if(selectedAsset == BTC) {
        hasBTC = i; //send BTC last so the sweep doesn't randomly eat our primed txouts for the other assets
      } else {
        sendsToMake.push([selectedAsset, cwk, pubkey, opsComplete, null]);
      }
    }
    if(hasBTC !== false) {
      //This balance is adjusted after each asset transfert with the change output.
      sendsToMake.push([BTC, cwk, pubkey, opsComplete, self.btcBalanceForPrivateKey()]);
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
       
      if(sendParams === undefined) {

        // No more asset or max retry occur
        self.shown(false);
        self._sweepCompleteDialog(opsComplete);

      } else {

        if (retry && failedTx['type']=='transferOwnership') {

          //TODO: this is ugly. transfert asset must be include in sendsToMake array
          self._doTransferAsset(failedTx['selectedAsset'], sendParams[1], sendParams[2], opsComplete, function(retry, failedTx) {
            $.jqlog.debug("waiting "+TRANSACTION_DELAY + "ms");
            setTimeout(function() {
              doSweep(retry, failedTx);
            }, TRANSACTION_DELAY);
          });

        } else {

          self._doSendAsset(sendParams[0], sendParams[1], sendParams[2], sendParams[3], sendParams[4], function(retry, failedTx) {
            $.jqlog.debug("waiting "+TRANSACTION_DELAY + "ms");
            setTimeout(function() {
              doSweep(retry, failedTx);
            }, TRANSACTION_DELAY);
          });

        }
        
      }
    }

    var launchSweep = function() {
      if (sendsToMake.length==1 && sendsToMake[0][0]==BTC) {
        doSweep();
      } else {
        // merge output then start sweeping.
        self.mergeOutputs(cwk, pubkey, doSweep);
      }
    }
    
    trackEvent('Balances', self.fromOldWallet() ? 'SweepFromOldWallet' : 'Sweep');

    if (self.missingBtcForFees>0 && self.privateKeyForFeesValidated.isValid()!='') {
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
    required: true,
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
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
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
      validator: function (val, self) {
        return parseFloat(val) > 0 && parseFloat(val) <= MAX_BURN_PER_ADDRESS;
      },
      message: 'Quantity entered must be between 0 and ' + MAX_BURN_PER_ADDRESS + ' ' + BTC + '.',
      params: self
    },{
      validator: function (val, self) {
        return parseFloat(val) <= WALLET.getBalance(self.address(), BTC) - normalizeQuantity(MIN_FEE);
      },
      message: 'The quantity of ' + BTC + ' entered exceeds your available balance.',
      params: self
    },{
      validator: function (val, self) {
        return !(parseFloat(val) > MAX_BURN_PER_ADDRESS - self.btcAlreadyBurned());
      },
      message: 'You can only burn <b>' + MAX_BURN_PER_ADDRESS + ' ' + BTC + '</b> total for any given address. Even over multiple burns, the total quantity must be less than <b>' + MAX_BURN_PER_ADDRESS + ' ' + BTC + '</b>.',
      params: self
    }]
  });
  
  self.quantityXCPToBeCreated = ko.computed(function() { //normalized
    if(!self.btcBurnQuantity() || !parseFloat(self.btcBurnQuantity())) return null;
    return burnDetermineEarned(WALLET.networkBlockHeight(), self.btcBurnQuantity());
  }, self);
  
  self.dispQuantityXCPToBeCreated = ko.computed(function() { 
    return numberWithCommas(self.quantityXCPToBeCreated());
  }, self);
  
  self.maxPossibleBurn = ko.computed(function() { //normalized
    if(self.btcAlreadyBurned() === null) return null;
    return Math.min(MAX_BURN_PER_ADDRESS - self.btcAlreadyBurned(), WALLET.getAddressObj(self.address()).getAssetObj(BTC).normalizedBalance())
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
      { source: self.address(),
        quantity: denormalizeQuantity(self.btcBurnQuantity()),
      },
      function(txHash, data, endpoint, addressType, armoryUTx) {
        self.shown(false);

        var message = "You " + (armoryUTx ? "will be burning" : "have burned") + " <b class='notoQuantityColor'>" + self.btcBurnQuantity() + "</b>"
          + " <b class='notoAssetColor'>" + BTC + "</b> for approximately"
          + " <b class='notoQuantityColor'>" + self.quantityXCPToBeCreated() + "</b>"
          + " <b class='notoAssetColor'>" + XCP + "</b>. ";
        WALLET.showTransactionCompleteDialog(message + ACTION_PENDING_NOTICE, message, armoryUTx);
      }
    );
    trackEvent('Balances', 'TestnetBurn');
  }
  
  self.show = function(address, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.address(address);
    
    //get the current block height, to calculate the XCP burn payout
    //determine whether the selected address has burned before, and if so, how much
    failoverAPI("get_burns", {filters: {'field': 'source', 'op': '==', 'value': address}}, function(data, endpoint) {
      var totalBurned = 0;
      for(var i=0; i < data.length; i++) {
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
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
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
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.addressObj = addressObj;
    self.address(self.addressObj.ADDRESS);
    self.shown(true);
    trackDialogShow('Broadcast');
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
    $('#broadcastModal form').submit();
  }

  self.doAction = function() {
    var params = {
      source: self.address(),
      fee_fraction: Decimal.round(new Decimal(self.feeFraction()).div(100), 8, Decimal.MidpointRounding.ToEven).toFloat(),
      text: self.textValue(),
      timestamp: self.broadcastDate() ? parseInt(self.broadcastDate().getTime() / 1000) : null,
      value: parseFloat(self.numericalValue())
    }
    //$.jqlog.debug(params); 
    
    var onSuccess = function(txHash, data, endpoint, addressType, armoryUTx) {
      self.hide();
      WALLET.showTransactionCompleteDialog("Broadcast transmitted. " + ACTION_PENDING_NOTICE,
        "Broadcast to be transmitted", armoryUTx);
    }

    var onError = function(jqXHR, textStatus, errorThrown, endpoint) {
      self.hide();
      bootbox.alert(textStatus);
    }

    WALLET.doTransaction(self.address(), "create_broadcast", params, onSuccess, onError);
    trackEvent('Balances', 'Broadcast');
  }
}

function SignTransactionModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(null); //address string, not an Address object
  self.unsignedTx = ko.observable('').extend({
    required: true,
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
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
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
    var signed = '';
    try {
      signed = cwk.signRawTransaction(self.unsignedTx());
      self.validTx(true);
    } catch (e) {
      signed = e.message;
      self.validTx(false);
    }   
    self.signedTx(signed);
    $("#signedMessage").effect("highlight", {}, 1500);
    trackEvent('Balances', 'SignTransaction');
    //Keep the form up after signing, the user will manually press Close to close it...
  }

  self.signAndBroadcastTransaction = function() {
    self.signTransaction();
    trackEvent('Balances', 'BroadcastTransaction');
    if (self.validTx()) {
      var onSuccess = function(txHash, endpoint) {
        self.shown(false);
        bootbox.alert("Your transaction were broacasted successfully:<br /><br /><b>"+txHash+"</b>");
      }

      WALLET.broadcastSignedTx(self.signedTx(), onSuccess, defaultErrorHandler);
    }
  }
}

function ArmoryBroadcastTransactionModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(null); //address string, not an Address object
  self.signedTx = ko.observable('').extend({
    required: true,
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
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
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
      var message = "Transaction successful broadcast!<br/><br/>Transaction ID: " + txHash;
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
