
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
    var label = $("<div/>").html(self.newLabel()).text().stripTags();
    //^ remove any HTML tags from the text
    PREFERENCES.address_aliases[addressHash] = label;
    //^ update the preferences on the server 
    multiAPI("store_preferences", [WALLET.identifier(), PREFERENCES], function(data, endpoint) {
      WALLET.getAddressObj(self.address()).label(label); //update was a success
      self.shown(false);
    });
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
  }  

  self.hide = function() {
    self.shown(false);
  }  
}


function CreateNewAddressModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);

  self.forWatchOnly = ko.observable(null);
  self.watchAddress = ko.observable('').extend({
    validation: [{
      validator: function (val, self) {
        return self.forWatchOnly() ? val : true;
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
    isValidBitcoinAddressIfSpecified: self,
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
    return self.forWatchOnly() ? 'Add Watch Address' : 'Create New Address';
  }, self);

  self.resetForm = function() {
    self.forWatchOnly(null);
    self.watchAddress('');
    self.description('');
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    //data entry is valid...submit to trigger doAction()
    $('#createNewAddressModal form').submit();
  }

  self.doAction = function() {
    var newAddress = null;

    if(!self.forWatchOnly()) {
      newAddress = WALLET.addAddress();
    } else {
      newAddress = self.watchAddress();
      WALLET.addWatchOnlyAddress(newAddress);
    }

    //update PREFs
    var newAddressHash = hashToB64(newAddress);
    if(!self.forWatchOnly()) {
      PREFERENCES['num_addresses_used'] += 1;
    } else {
      PREFERENCES['watch_only_addresses'].push(newAddress); //can't use the hash here, unfortunately
    }
    var sanitizedDescription = self.description().stripTags();
    PREFERENCES['address_aliases'][newAddressHash] = sanitizedDescription;
    
    //manually set the address in this case to get around the chicken and egg issue here (and have client side match the server)
    WALLET.getAddressObj(newAddress).label(sanitizedDescription);

    //save prefs to server
    multiAPI("store_preferences", [WALLET.identifier(), PREFERENCES], function(data, endpoint) {
      self.shown(false);
      
      if(self.forWatchOnly()) {
        //If we created a watch address, refresh the counterparty balances with this new address
        //btc address balances will refresh on the refresh of the balances page itself
        setTimeout(function() { WALLET.refreshCounterpartyBalances([newAddress], checkURL)});
      } else {
        //Otherwise (a new non-watch address), just refresh the page
        setTimeout(checkURL, 400); //necessary to use setTimeout so that the modal properly hides before we refresh the page
      }
    });
  }
  
  self.show = function(forWatchOnly, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.forWatchOnly(forWatchOnly);
    self.shown(true);
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
    if(self.asset() == 'BTC')
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
      function(txHash, data, endpoint) {
        bootbox.alert("<b>Your funds were sent successfully.</b> " + ACTION_PENDING_NOTICE);
      }
    );
    self.shown(false);
  }
  
  self.show = function(fromAddress, asset, rawBalance, isDivisible, resetForm) {
    if(asset == 'BTC' && rawBalance == null) {
      return bootbox.alert("Cannot send <b class='notoAssetColor'>BTC</b> right now, as we cannot currently get"
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
  }  

  self.hide = function() {
    self.shown(false);
  }  
}


var BalancesAddressInDropdownItemModel = function(address, label) {
  this.ADDRESS = address;
  this.LABEL = label;
  this.SELECT_LABEL = label ? ("<b>" + label + "</b><br/>" + address) : (address);
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
          //https://en.bitcoin.it/wiki/Scalability:
          // Transactions vary in size from about 0.2 kilobytes to over 1 kilobyte, but it's averaging half a kilobyte today.
          var mergeCost = Math.ceil(self.txoutsCountForPrivateKey / 2) * MIN_FEE;
          sweepingCost += parseInt(mergeCost); // if outputs merging needed
          //$.jqlog.debug('Cost for output merging : ' + mergeCost);
        }

        //$.jqlog.debug('Total sweeping cost : ' + sweepingCost);

        // here we assume that the transaction cost to send BTC from addressForFees is MIN_FEE
        var totalBtcBalanceForSweeep = self.btcBalanceForPrivateKey() + Math.max(0, (self.addressForFeesBalance()-MIN_FEE));
        self.missingBtcForFees = Math.max(0, sweepingCost - self.btcBalanceForPrivateKey());


        if  (totalBtcBalanceForSweeep < sweepingCost) {
          
          this.message = "We're not able to sweep all of the assets you selected. Please send "
                        + normalizeQuantity(self.missingBtcForFees)
                        + " BTC transactions to address " + self.addressForPrivateKey() + " and try again."
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
  self.sweepBtc = false;
  self.sweepAssetsCost = {};
  
  self.validationModel = ko.validatedObservable({
    privateKey: self.privateKey,
    selectedAssetsToSweep: self.selectedAssetsToSweep,
    destAddress: self.destAddress
  });  

  self.addressForPrivateKey.subscribe(function(address) {
    //set up handler on changes in private key to generate a list of balances
    self.sweepAssetsCost = {'BTC': MIN_FEE+REGULAR_DUST_SIZE};
    if(!address || address=='') return;

    //Get the balance of ALL assets at this address
    failoverAPI("get_normalized_balances", [[address]], function(balancesData, endpoint) {
      var assets = [], assetInfo = null;
      for(var i=0; i < balancesData.length; i++) {
        assets.push(balancesData[i]['asset']);
      }
      //get info on the assets, since we need this for the create_issuance call during the sweep (to take ownership of the asset)
      failoverAPI("get_asset_info", [assets], function(assetsData, endpoint) {
        //Create an SweepAssetInDropdownItemModel item
        for(var i=0; i < balancesData.length; i++) {
          assetInfo = $.grep(assetsData, function(e) { return e['asset'] == balancesData[i]['asset']; })[0]; //O(n^2)
          self.availableAssetsToSweep.push(new SweepAssetInDropdownItemModel(
            balancesData[i]['asset'], balancesData[i]['quantity'], balancesData[i]['normalized_quantity'], assetInfo));

          var txcost = MIN_FEE + (2 * MULTISIG_DUST_SIZE);
          var cost = 0;
          if (balancesData[i]['quantity']>0) {
            cost += txcost;
          }
          // need ownership transfer
          if (assetInfo['owner'] == self.addressForPrivateKey()) {
            cost += txcost;
          }
          self.sweepAssetsCost[balancesData[i]['asset']] = cost;          
        }

        //Also get the BTC balance at this address and put at head of the list
        //We just check if unconfirmed balance > 0.      
        WALLET.retriveBTCAddrsInfo([address], function(data) {
          self.btcBalanceForPrivateKey(0);
          self.txoutsCountForPrivateKey = 0;
          //TODO: counterwalletd return unconfirmedRawBal==0, after fixing we need use unconfirmedRawBal
          var unconfirmedRawBal = data[0]['confirmedRawBal']; 
          if(unconfirmedRawBal > 0) {
            //We don't need to supply asset info to the SweepAssetInDropdownItemModel constructor for BTC
            // b/c we won't be transferring any asset ownership with it
            var viewModel = new SweepAssetInDropdownItemModel("BTC", unconfirmedRawBal, normalizeQuantity(unconfirmedRawBal));
            self.availableAssetsToSweep.unshift(viewModel);
            assets.push("BTC");
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
      self.addressForFeesBalanceMessage(normalizeQuantity(data[0]['confirmedRawBal'])+' BTC in '+address);
      self.addressForFeesBalance(data[0]['confirmedRawBal']); 
    });
  });
 
  self.resetForm = function() {
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
    self.sweepBtc = false;
    
    //populate the list of addresseses again
    self.availableAddresses([]);
    var addresses = WALLET.getAddressesList(true);
    for(var i = 0; i < addresses.length; i++) {
        self.availableAddresses.push(new BalancesAddressInDropdownItemModel(addresses[i][0], addresses[i][1]));
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
    bootbox.alert("The sweep from address <b class='notoAddrColor'>" + self.addressForPrivateKey()
      + "</b> is complete.<br/>Sweep results:<br/><br/><ul>" + assetDisplayList.join('') + "</ul>"
      + ACTION_PENDING_NOTICE);
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
      self.missingBtcForFees += MIN_FEE;
    }
    $.jqlog.debug('missingBtcForFees: '+self.missingBtcForFees);

    var sendData = {
      source: self.addressForPrivateKeyForFees(),
      destination: self.addressForPrivateKey(),
      quantity: self.missingBtcForFees,
      asset: 'BTC',
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

    var message = "Sending " + normalizeQuantity(self.missingBtcForFees) + " BTC from "
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

      fees = (typeof fees === "undefined") ? MIN_FEE : fees;

      var sendData = {
        source: self.addressForPrivateKey(),
        destination: self.addressForPrivateKey(),
        quantity: self.btcBalanceForPrivateKey()-fees,
        asset: 'BTC',
        encoding: 'multisig',
        pubkey: pubkey,
        allow_unconfirmed_inputs: true
      };

      var onTransactionError = function() {
        if (arguments.length==4) {
          var match = arguments[1].match(/Insufficient bitcoins at address [^\s]+\. \(Need approximately ([\d]+\.[\d]+) BTC/);
          if (match!=null) {
            // if insufficient bitcoins we retry with estimated fees return by counterpartyd
            var minEstimateFee = denormalizeQuantity(parseFloat(match[1])) - (self.btcBalanceForPrivateKey() - fees);
            $.jqlog.debug('Insufficient fees. Need approximately ' + minEstimateFee);
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
      call_date: selectedAsset.ASSET_INFO['call_date'],
      call_price: parseFloat(selectedAsset.ASSET_INFO['call_price']) || null,
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
          $.jqlog.debug("New BTC balance: "+newBtcBalance);
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
    if(asset == 'BTC') assert(adjustedBTCQuantity !== null);
    else assert(adjustedBTCQuantity === null);
    
    var selectedAsset = ko.utils.arrayFirst(self.availableAssetsToSweep(), function(item) {
      return asset == item.ASSET;
    });
    var sendTx = null, i = null;

    $.jqlog.debug("btcBalanceForPrivateKey: " + self.btcBalanceForPrivateKey());
    var quantity = (asset == 'BTC') ? (self.btcBalanceForPrivateKey() - MIN_FEE) : selectedAsset.RAW_BALANCE;
    var normalizedQuantity = (asset == 'BTC') ? normalizeQuantity(quantity) : selectedAsset.NORMALIZED_BALANCE;
    
    assert(selectedAsset);
    
    if(!quantity) { //if there is no quantity to send for the asset, only do the transfer
      if(asset == 'XCP' || asset == 'BTC') { //nothing to send, and no transfer to do
        return callback(); //my valuable work here is done!
      } else {
        self._doTransferAsset(selectedAsset, key, pubkey, opsComplete, callback); //will trigger callback() once done
        return;
      }
    }

    self.showNextMessage("Sweeping from: " + self.addressForPrivateKey() + " to " + self.destAddress() + " of quantity "
      + normalizedQuantity + " " + selectedAsset.ASSET);
      
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
          if (selectedAsset.ASSET != 'BTC') {
            var newBtcBalance = CWBitcore.extractChangeTxoutValue(sendData.source, unsignedTxHex);
            $.jqlog.debug("New BTC balance: " + newBtcBalance);
            self.btcBalanceForPrivateKey(newBtcBalance);
          }

          //For non BTC/XCP assets, also take ownership (iif the address we are sweeping from is the asset's owner')
          if (selectedAsset.ASSET != 'XCP'
             && selectedAsset.ASSET != 'BTC'
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
      if(selectedAsset == 'BTC') {
        hasBTC = i; //send BTC last so the sweep doesn't randomly eat our primed txouts for the other assets
      } else {
        sendsToMake.push([selectedAsset, cwk, pubkey, opsComplete, null]);
      }
    }
    if(hasBTC !== false) {
      //This balance is adjusted after each asset transfert with the change output.
      sendsToMake.push(["BTC", cwk, pubkey, opsComplete, self.btcBalanceForPrivateKey()]);
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
            $.jqlog.debug("waiting "+TRANSACTION_DELAY+"ms");
            setTimeout(function() {
              doSweep(retry, failedTx);
            }, TRANSACTION_DELAY);
          });

        } else {

          self._doSendAsset(sendParams[0], sendParams[1], sendParams[2], sendParams[3], sendParams[4], function(retry, failedTx) {
            $.jqlog.debug("waiting "+TRANSACTION_DELAY+"ms");
            setTimeout(function() {
              doSweep(retry, failedTx);
            }, TRANSACTION_DELAY);
          });

        }
        
      }
    }

    var launchSweep = function() {
      if (sendsToMake.length==1 && sendsToMake[0][0]=='BTC') {
        doSweep();
      } else {
        // merge output then start sweeping.
        self.mergeOutputs(cwk, pubkey, doSweep);
      }
    }

    if (self.missingBtcForFees>0 && self.privateKeyForFeesValidated.isValid()!='') {
      // send btc to pay fees then launch sweeping
      self.sendBtcForFees(launchSweep);
    } else {
      launchSweep();
    }
    
    
  
  }
  
  self.show = function(resetForm) {
    if(typeof(resetForm) === 'undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.shown(true);
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
        return parseFloat(val) > 0 && parseFloat(val) <= 1;
      },
      message: 'Quantity entered must be between 0 and 1 BTC.',
      params: self
    },{
      validator: function (val, self) {
        return parseFloat(val) <= WALLET.getBalance(self.address(), 'BTC') - normalizeQuantity(MIN_FEE);
      },
      message: 'The quantity of BTC entered exceeds your available balance.',
      params: self
    },{
      validator: function (val, self) {
        return !(parseFloat(val) > 1 - self.btcAlreadyBurned());
      },
      message: 'You can only burn <b>1 BTC</b> total for any given address. Even over multiple burns, the total quantity must be less than <b>1 BTC</b>.',
      params: self
    }]
  });
  
  self.quantityXCPToBeCreated = ko.computed(function() { //normalized
    if(!self.btcBurnQuantity() || !parseFloat(self.btcBurnQuantity())) return null;
    return testnetBurnDetermineEarned(WALLET.networkBlockHeight(), self.btcBurnQuantity());
  }, self);
  
  self.dispQuantityXCPToBeCreated = ko.computed(function() { 
    return numberWithCommas(self.quantityXCPToBeCreated());
  }, self);
  
  self.maxPossibleBurn = ko.computed(function() { //normalized
    if(self.btcAlreadyBurned() === null) return null;
    return Math.min(1 - self.btcAlreadyBurned(), WALLET.getAddressObj(self.address()).getAssetObj('BTC').normalizedBalance()) 
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
      function(txHash, data, endpoint) {
        self.shown(false);
        bootbox.alert("You have burned <b class='notoQuantityColor'>" + self.btcBurnQuantity() + "</b>"
          + " <b class='notoAssetColor'>BTC</b> for approximately"
          + " <b class='notoQuantityColor'>" + self.quantityXCPToBeCreated() + "</b>"
          + " <b class='notoAssetColor'>XCP</b>. " + ACTION_PENDING_NOTICE);
      }
    );
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
  }  

  self.hide = function() {
    self.shown(false);
  }
  
  self.displayPrivateKey = function() {
    var wif = WALLET.getAddressObj(self.address()).KEY.getWIF();
    self.privateKeyText(wif); 
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
