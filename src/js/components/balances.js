
ko.validation.rules['isAddressSpecifiedIfRequired'] = {
    validator: function (val, self) {
      return self.forWatchOnly() ? val : true;
    },
    message: 'This field is required.'
};
ko.validation.rules['isValidAddressDescription'] = {
    validator: function (val, self) {
      return val.length <= 70; //arbitrary
    },
    message: 'Address description is more than 70 characters long.'
};
ko.validation.rules['addressIsNotInWallet'] = {
    validator: function (val, self) {
      if(!val) return true; //isAddressSpecifiedIfRequired will cover it
      return !WALLET.getAddressObj(val);
    },
    message: 'This address is already in your wallet.'
};
ko.validation.registerExtenders();

function CreateNewAddressModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);

  self.forWatchOnly = ko.observable(null);
  self.watchAddress = ko.observable('').extend({
    isAddressSpecifiedIfRequired: self,
    isValidBitcoinAddressIfSpecified: self,
    addressIsNotInWallet: self
  });
  self.description = ko.observable('').extend({
    required: true,
    isValidAddressDescription: self,
  });
  
  self.validationModel = ko.validatedObservable({
    description: self.description,
    watchAddress: self.watchAddress
  });

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

    //update PREFs
    var newAddressHash = hashToB64(newAddress);
    if(!self.forWatchOnly()) {    
      PREFERENCES['num_addresses_used'] += 1;
    } else {
      if(PREFERENCES['watch_only_addresses'] === undefined) PREFERENCES['watch_only_addresses'] = []; //init if not in prefs
      PREFERENCES['watch_only_addresses'].push(newAddress); //can't use the hash here, unfortunately
    }
    PREFERENCES['address_aliases'][newAddressHash] = self.description();

    if(!self.forWatchOnly()) {
      WALLET.BITCOIN_WALLET.generateAddress();
      var i = WALLET.BITCOIN_WALLET.getPrivateKeys().length - 1;
      var hd = WALLET.BITCOIN_WALLET.getPrivateKey(i);
      newAddress = hd.priv.getBitcoinAddress().toString();
      WALLET.addAddress(hd.priv);
    } else {
      newAddress = self.watchAddress();
      WALLET.addWatchOnlyAddress(newAddress);
    }

    //save prefs to server
    multiAPI("store_preferences", [WALLET.identifier(), PREFERENCES], function(data, endpoint) {
      self.shown(false);
      setTimeout(checkURL, 400); //necessary to use setTimeout so that the modal properly hides before we refresh the page
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


ko.validation.rules['isValidSendAmountForBalance'] = {
    validator: function (val, self) {
      if(normalizeAmount(self.rawBalance(), self.divisible()) - parseFloat(val) < 0) {
        return false;
      }
      return true;
    },
    message: 'Entered amount exceeds your current balance.'
};
ko.validation.registerExtenders();

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
  self.amount = ko.observable().extend({
    required: true,
    pattern: {
      message: 'Must be a valid number',
      params: '^[0-9]*\.?[0-9]{0,8}$' //not perfect ... additional checking required
    },
    isValidQtyForDivisibility: self,
    isValidSendAmountForBalance: self
  });
  
  self.normalizedBalance = ko.computed(function() {
    if(self.address() === null || self.rawBalance() === null) return null;
    return normalizeAmount(self.rawBalance(), self.divisible());
  }, self);
  
  self.normalizedBalRemaining = ko.computed(function() {
    if(!isNumber(self.amount())) return null;
    var curBalance = normalizeAmount(self.rawBalance(), self.divisible());
    var balRemaining = Decimal.round(new Decimal(curBalance).sub(parseFloat(self.amount()))).toFloat();
    if(balRemaining < 0) return null;
    return balRemaining;
  }, self);
  
  self.validationModel = ko.validatedObservable({
    destAddress: self.destAddress,
    amount: self.amount
  });  
  
  self.resetForm = function() {
    self.destAddress('');
    self.amount(null);
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

  self.doAction = function() {
    WALLET.doTransaction(self.address(), "create_send",
      { source: self.address(),
        destination: self.destAddress(),
        amount: denormalizeAmount(parseFloat(self.amount()), self.divisible()),
        asset: self.asset()
      },
      function() {
        bootbox.alert("<b>Your funds were sent successfully.</b><br/><br/>The action will take effect as soon as the network has processed it.");
      }
    );
    self.shown(false);
  }
  
  self.show = function(fromAddress, asset, rawBalance, isDivisible, resetForm) {
    if(asset == 'BTC' && rawBalance == null) {
      return bootbox.alert("Cannot send BTC as we cannot currently get in touch with the server to get your balance.");
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


ko.validation.rules['isValidPrivateKey'] = {
  validator: function (val, self) {
    var key = new Bitcoin.ECKey(self.privateKey());
    var doesVersionMatch = (key.version == USE_TESTNET ?
      Bitcoin.network.testnet.addressVersion : Bitcoin.network.mainnet.addressVersion);
    return key.priv !== null && key.compressed !== null && key.version !== null && doesVersionMatch;
  },
  message: 'Not a valid' + (USE_TESTNET ? ' TESTNET ' : ' ') + 'private key.'
};
ko.validation.rules['addressHasEnoughUnspentTxoutsForSelectedAssets'] = {
  validator: function (val, self, callback) {
    var numAssets = val.length;
    if(self.numPrimedTxoutsForPrivateKey() === null) return false; //priv key not set yet??
    return self.numPrimedTxoutsForPrivateKey() >= numAssets;
  },
  message: 'The address for the private key specified does not have enough confirmed unspent outputs to sweep everything selected.'
};
ko.validation.registerExtenders();

var AddressInDropdownItemModel = function(address, label) {
  this.ADDRESS = address;
  this.LABEL = label;
  this.SELECT_LABEL = label ? ("<b>" + label + "</b><br/>" + address) : (address);
};
var SweepAssetInDropdownItemModel = function(asset, rawBalance, normalizedBalance) {
  this.ASSET = asset;
  this.RAW_BALANCE = rawBalance; //raw
  this.NORMALIZED_BALANCE = normalizedBalance; //normalized
  this.SELECT_LABEL = asset + " (bal: " + normalizedBalance + ")";
};

function SweepModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.privateKey = ko.observable('').trimmed().extend({
    required: true,
    isValidPrivateKey: self
  });
  self.availableAssetsToSweep = ko.observableArray([]);
  //^ used for select box entries (composed dynamically on privateKey update)
  self.selectedAssetsToSweep = ko.observableArray([]).extend({
    required: true,
    addressHasEnoughUnspentTxoutsForSelectedAssets: self
  });
  self.destAddress = ko.observable('').trimmed().extend({
    required: true,
    isValidBitcoinAddress: self
  });
  
  self.availableAddresses = ko.observableArray([]);

  self.privateKeyValidated = ko.validatedObservable({
    privateKey: self.privateKey,
  });
  self.addressForPrivateKey = ko.computed(function() {
    if(!self.privateKeyValidated.isValid()) return null;
    //Get the address for this privatekey
    var key = new Bitcoin.ECKey(self.privateKey());
    assert(key.priv !== null && key.compressed !== null, "Private key not valid!"); //should have been checked already
    return key.getBitcoinAddress().toString();
  }, self);
  self.numPrimedTxoutsForPrivateKey = ko.observable(null);
  
  self.validationModel = ko.validatedObservable({
    privateKey: self.privateKey,
    selectedAssetsToSweep: self.selectedAssetsToSweep,
    destAddress: self.destAddress
  });  
  
  self.resetForm = function() {
    self.privateKey('');
    self.availableAssetsToSweep([]);
    self.selectedAssetsToSweep([]);
    self.destAddress('');
    
    //populate the list of addresseses again
    self.availableAddresses([]);
    var addresses = WALLET.getAddressesList(true);
    for(var i = 0; i < addresses.length; i++) {
        self.availableAddresses.push(new AddressInDropdownItemModel(addresses[i][0], addresses[i][1]));
    }        
    
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }

    //data entry is valid...submit to trigger doAction()
    $('#sweepModal form').submit();
  }
  
  self._sweepCompleteDialog = function(sendsComplete) {
    var assetDisplayList = [];
    for(var i = 0; i < sendsComplete.length; i++) {
      if(sendsComplete[i]['result']) {
        assetDisplayList.push("<li><b>" + sendsComplete[i]['asset'] + ":</b> Sent "
          + "<b>" + sendsComplete[i]['normalized_amount'] + " " + sendsComplete[i]['asset'] + "</b>"
          + " to <b>" + sendsComplete[i]['to'] + "</b></li>");  
      } else {
        assetDisplayList.push("<li><b>" + sendsComplete[i]['asset'] + "</b>: Funds not sent due to failure.</li>");  
      }
    }
    bootbox.alert("The sweep from address <b>" + self.addressForPrivateKey()
      + "</b> is complete.<br/>Sweep results:<br/><br/><ul>" + assetDisplayList.join('') + "</ul><br/>"
      + "Please note that it may take a bit of time for the swept funds to show up in your account.");
  }
  
  self._signInputs = function(unsignedTxHex) {
    var sendTx = Bitcoin.Transaction.deserialize(unsignedTxHex);
    var txInHash = null, signature = null, SIGHASH_ALL = 1;
    var key = new Bitcoin.ECKey(self.privateKey());
    for(var i = 0; i < sendTx.ins.length; i++) {
      txInHash = txIn.hashTransactionForSignature(sendTx.ins[i].script, i, SIGHASH_ALL);
      signature = key.sign(txInHash);
      signature.push(parseInt(SIGHASH_ALL, 10));
      sendTx.ins[i].script = Bitcoin.Script.createInputScript(signature, key.getPub());
    }    
  }
  
  self._doSendAsset = function(asset, key, pubkey, sendsComplete, adjustedBTCAmount, callback) {
    if(asset == 'BTC') assert(adjustedBTCAmount !== null);
    else assert(adjustedBTCAmount === null);
    var selectedAsset = ko.utils.arrayFirst(self.availableAssetsToSweep(), function(item) {
      return asset == item.ASSET;
    });
    var amount = adjustedBTCAmount || selectedAsset.RAW_BALANCE;
    var normalizedAmount = ((adjustedBTCAmount ? normalizeAmount(adjustedBTCAmount) : null)
      || selectedAsset.NORMALIZED_BALANCE);
    assert(selectedAsset);
    
    $.jqlog.log("Sweeping from: " + self.addressForPrivateKey() + " to " + self.destAddress() + " of amount "
      + normalizedAmount + " " + selectedAsset.ASSET);

    //dont use WALLET.doTransaction for this...
    multiAPIConsensus("create_send", //can send both BTC and counterparty assets
      { source: self.addressForPrivateKey(),
        destination: self.destAddress(),
        amount: amount,
        asset: selectedAsset.ASSET,
        multisig: pubkey
      },
      function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {
        var sendTx = Bitcoin.Transaction.deserialize(unsignedTxHex);
        //Sign the TX inputs
        for (var i = 0; i < sendTx.ins.length; i++) { //sign each input with the key
          sendTx.sign(i, key);
        }
        WALLET.broadcastSignedTx(sendTx.serializeHex(), function(data, endpoint) { //transmit was successful
          sendsComplete.push({
            'result': true,
            'asset': selectedAsset.ASSET,
            'from': self.addressForPrivateKey(),
            'to': self.destAddress(),
            'normalized_amount': normalizedAmount
          });
          //TODO: show this sweep in pending actions
          return callback();
        }, function() { //on error transmitting tx
          sendsComplete.push({
            'result': false,
            'asset': selectedAsset.ASSET
          });
        });
      }, function(unmatchingResultsList) { //onConsensusError
        sendsComplete.push({
          'result': false,
          'asset': selectedAsset.ASSET
        });
        return callback();
      }, function(jqXHR, textStatus, errorThrown, endpoint) { //onSysError
        sendsComplete.push({
          'result': false,
          'asset': selectedAsset.ASSET
        });
        return callback();
      }
    );
  }
  
  self.doAction = function() {
    var key = new Bitcoin.ECKey(self.privateKey());
    assert(key.priv !== null && key.compressed !== null, "Private key not valid!"); //should have been checked already
    var pubkey = key.getPub().toHex();
    var sendsToMake = [];
    var sendsComplete = [];
    
    var selectedAsset = null, hasBTC = false;
    for(var i = 0; i < self.selectedAssetsToSweep().length; i++) {
      selectedAsset = self.selectedAssetsToSweep()[i];
      if(selectedAsset == 'BTC') {
        hasBTC = i; //send BTC last so the sweep doesn't randomly eat our primed txouts for the other assets
      } else {
        sendsToMake.push([selectedAsset, key, pubkey, sendsComplete, null]);
      }
    }
    if(hasBTC !== false) {
      //adjust the balance of BTC to sweep out to account for the primed TXouts being consumed
      var rawBTCBalance = self.availableAssetsToSweep()[hasBTC].RAW_BALANCE;
      var adjustedBTCAmount = rawBTCBalance - (self.selectedAssetsToSweep().length * MIN_PRIME_BALANCE);
      //^ the adjusted BTC balance is what we will end up sweeping out of the account.
      //  BTW...this includes the BTC fee for the BTC sweep itself as a primed TXout size (.0005 instead of .0001...no biggie (I think)
      sendsToMake.push(["BTC", key, pubkey, sendsComplete, adjustedBTCAmount]);
    }
    
    //Make send calls sequentially
    function makeSweeps(){
      var d = jQuery.Deferred();
      var doSweep = function() {
        var sendParams = sendsToMake.shift();
        if(sendParams === undefined) return d.resolve();
        self._doSendAsset(sendParams[0], sendParams[1], sendParams[2], sendParams[3], sendParams[4], function() {
          return doSweep();
        });
      };
      doSweep();
      return d.promise();
    };
    makeSweeps().then(function() {
      self.shown(false);
      assert(sendsComplete.length == self.selectedAssetsToSweep().length);
      self._sweepCompleteDialog(sendsComplete);
    });    
  }
  
  self.show = function(resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.shown(true);
  }  

  self.hide = function() {
    self.shown(false);
  }
  
  self.addressForPrivateKey.subscribe(function(address) {
    //set up handler on changes in private key to generate a list of balances
    if(!address) return;

    //Get the balance of ALL assets at this address
    failoverAPI("get_normalized_balances", [address], function(data, endpoint) {
      for(var i=0; i < data.length; i++) {
        self.availableAssetsToSweep.push(new SweepAssetInDropdownItemModel(data[i]['asset'], data[i]['amount'], data[i]['normalized_amount']));
      }
      
      //Also get the BTC balance at this address and put at head of the list
      WALLET.retrieveBTCBalance(address, function(balance) {
        if(balance) {
          self.availableAssetsToSweep.unshift(new SweepAssetInDropdownItemModel("BTC", balance, normalizeAmount(balance)));
        }
      });
    });
    
    //Also record the number of primed txouts for the address
    //Note that if BTC is one of the things we're sweeping, technically we don't need a full primed output amount
    // for that (we just need an available out of > MIN_FEE... but let's just require a primed out for a BTC send to keep things simple)
    WALLET.retrieveNumPrimedTxouts(address, function(numPrimedTxouts) {
      self.numPrimedTxoutsForPrivateKey(numPrimedTxouts);
    }, function(jqXHR, textStatus, errorThrown) {
      bootbox.alert("Cannot fetch the number of unspent txouts. Please try again later.");
      self.numPrimedTxoutsForPrivateKey(0);
    });
  });  
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
    var hexSignedMessage = Bitcoin.Message.signMessage(key, self.message(), key.compressed);
    self.signedMessage(self.signatureFormat() == 'base64'
      ? Bitcoin.convert.bytesToBase64(Bitcoin.convert.hexToBytes(hexSignedMessage)) : hexSignedMessage);
    $("#signedMessage").effect("highlight", {}, 1500);
    //Keep the form up after signing, the user will manually press Close to close it...
  }
}

function PrimeAddressModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(); //address string, not an Address object
  self.showNoPrimedInputsError = ko.observable(false);
  self.numNewPrimedTxouts = ko.observable(10).extend({  //default to 10
    required: true,
    number: true,
    min: 3,
    max: 25
  });
  self.autoPrime = ko.observable(false); //set in show() to whatever the current value from PREFs is
  self.rawUnspentTxResponse = null;
  
  self.validationModel = ko.validatedObservable({
    numNewPrimedTxouts: self.numNewPrimedTxouts
  });
  
  self.dispNumPrimedTxouts = ko.computed(function() {
    return WALLET.getNumPrimedTxouts(self.address());
  }, self);
  
  self.resetForm = function() {
    self.numNewPrimedTxouts(10);
    self.showNoPrimedInputsError(false);
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    //data entry is valid...submit to trigger doAction()
    $('#primeAddressModal form').submit();
  }
  
  self.show = function(address, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.address(address);
    self.autoPrime(PREFERENCES['auto_prime']);
    
    //Get the most up to date # of primed txouts
    WALLET.retrieveNumPrimedTxouts(address, function(numPrimedTxouts, utxosData) {
      WALLET.updateNumPrimedTxouts(address, numPrimedTxouts);
      self.rawUnspentTxResponse = utxosData; //save for later (when creating the Tx itself)
      WALLET.updateNumPrimedTxouts(address, numPrimedTxouts);
      if(numPrimedTxouts == 0) {
        bootbox.alert("Your wallet has no available BTC to prime this account with. Please deposit BTC and try again.");
      } else {
        self.shown(true);
      }
    }, function(jqXHR, textStatus, errorThrown) {
      WALLET.updateNumPrimedTxouts(address, null);
      bootbox.alert("Cannot fetch the number of unspent txouts. Please try again later.");
    });
  }  

  self.hide = function() {
    self.shown(false);
  }
  
  self.doAction = function() {
    primeAddress(self.address(), parseInt(self.numNewPrimedTxouts()), self.rawUnspentTxResponse,
      function(address, numNewPrimedTxouts) {
        self.shown(false);
        bootbox.alert("Your account has successfully been primed with <b>" + numNewPrimedTxouts
          + "</b> additional outputs. This action may take a bit to take effect.");
      }
    );
  }
}


ko.validation.rules['isInBurnRange'] = {
    validator: function (val, self) {
      return parseFloat(val) > 0 && parseFloat(val) <= 1;
    },
    message: 'Amount must be between 0 and 1 BTC.'
};
ko.validation.rules['doesNotExceedBTCBalance'] = {
    validator: function (val, self) {
      return parseFloat(val) <= WALLET.getBalance(self.address(), 'BTC') - normalizeAmount(MIN_FEE);
    },
    message: 'The amount BTC entered exceeds your available balance.'
};
ko.validation.rules['doesNotExceedAlreadyBurned'] = {
    validator: function (val, self) {
      return !(parseFloat(val) > 1 - self.btcAlreadyBurned());
    },
    message: 'You can only burn 1 BTC total for any given address. Even over multiple burns, the total amount must be less than 1 BTC.'
};
ko.validation.registerExtenders();

function TestnetBurnModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(''); // SOURCE address (supplied)

  self.networkBlockHeight = ko.observable(0);
  self.btcAlreadyBurned = ko.observable(null); // amount BTC already burned from this address (normalized)
  
  self.btcBurnAmount = ko.observable('').extend({
    required: true,
    //not using min, max and number validators here because they don't like things like ".4"
    pattern: {
      message: 'Must be a valid number',
      params: '^[0-9]*\.?[0-9]{0,8}$' //not perfect ... will convert divisible assets to satoshi before sending to API
    },
    isInBurnRange: self,
    doesNotExceedBTCBalance: self,
    doesNotExceedAlreadyBurned: self
  });
  
  self.amountXCPToBeCreated = ko.computed(function() { //normalized
    if(!self.btcBurnAmount() || !parseFloat(self.btcBurnAmount())) return null;
    return testnetBurnDetermineEarned(self.networkBlockHeight(), self.btcBurnAmount());
  }, self);
  
  self.validationModel = ko.validatedObservable({
    btcBurnAmount: self.btcBurnAmount
  });

  self.resetForm = function() {
    self.btcBurnAmount('');
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }
    console.log("Submitting form...");
    $('#testnetBurnModal form').submit();
  }

  self.doAction = function() {
    //do the additional issuance (specify non-zero amount, no transfer destination)
    WALLET.doTransaction(self.address(), "create_burn",
      { source: self.address(),
        amount: denormalizeAmount(self.btcBurnAmount()),
      },
      function() {
        self.shown(false);
        bootbox.alert("You have burned <b>" + self.btcBurnAmount() + " BTC</b> for approximately <b>"
          + self.amountXCPToBeCreated() + " XCP</b>. It may take a bit for this to reflect.");
      }
    );
  }
  
  self.show = function(address, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.address(address);
    
    //get the current block height, to calculate the XCP burn payout
    WALLET.getBTCBlockHeight(function(blockHeight) {
      self.networkBlockHeight(blockHeight);
      
      //determine whether the selected address has burned before, and if so, how much
      failoverAPI("get_burns", {filters: {'field': 'source', 'op': '==', 'value': address}}, function(data, endpoint) {
        var totalBurned = 0;
        for(var i=0; i < data.length; i++) {
          totalBurned += data[i]['burned'];
        }
        
        self.btcAlreadyBurned(normalizeAmount(totalBurned));
        self.shown(true);
      });
    });
  }  

  self.hide = function() {
    self.shown(false);
  }  
}


//Some misc jquery event handlers
$('#createAddress, #createWatchOnlyAddress').click(function() {
  if(WALLET.addresses().length >= MAX_ADDRESSES) {
    bootbox.alert("You already have the max number of addresses for a single wallet ("
      + MAX_ADDRESSES + "). Please create a new wallet for more.");
    return false;
  }
  CREATE_NEW_ADDRESS_MODAL.show($(this).attr('id') == 'createWatchOnlyAddress');
});

$('#sweepFunds').click(function() {
  SWEEP_MODAL.show();
});


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
