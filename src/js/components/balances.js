ko.validation.rules['isValidAddressDescription'] = {
    validator: function (val, self) {
      return val.length <= 70; //arbitrary
    },
    message: 'Address description is more than 70 characters long.'
};
ko.validation.registerExtenders();

function CreateNewAddressModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.description = ko.observable('').extend({
    required: true,
    isValidAddressDescription: self,
  });
  
  self.validationModel = ko.validatedObservable({
    description: self.description
  });

  self.resetForm = function() {
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
    WALLET.BITCOIN_WALLET.generateAddress();
    var i = WALLET.BITCOIN_WALLET.getPrivateKeys().length - 1;
    var hd = WALLET.BITCOIN_WALLET.getPrivateKey(i);
    WALLET.addKey(hd.priv, self.description());

    //update PREFs and push
    var newAddress = hd.priv.getBitcoinAddress().toString();
    var newAddressHash = Bitcoin.convert.bytesToBase64(Bitcoin.Crypto.SHA256(newAddress, {asBytes: true}));
    $.jqlog.log("New address created: " + newAddress + " -- hash: " + newAddressHash);
    PREFERENCES['num_addresses_used'] += 1;
    PREFERENCES['address_aliases'][newAddressHash] = self.description();
    multiAPI("store_preferences", [WALLET.identifier(), PREFERENCES], function(data, endpoint) {
      self.shown(false);
      setTimeout(checkURL, 400); //necessary to use setTimeout so that the modal properly hides before we refresh the page
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
}


ko.validation.rules['isValidSendAmountForBalance'] = {
    validator: function (val, self) {
      if((self.divisible() ? self.balance() / UNIT : self.balance()) - parseFloat(val) < 0) {
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
  self.balance = ko.observable(null);
  self.divisible = ko.observable();
  
  self.destAddress = ko.observable('').trimmed().extend({
    required: true,
    isValidBitcoinAddress: self,
    isNotSameBitcoinAddress: self
  });
  self.quantity = ko.observable().extend({
    required: true,
    pattern: {
      message: 'Must be a valid number',
      params: '^[0-9]*\.?[0-9]{0,8}$' //not perfect ... additional checking required
    },
    isValidQtyForDivisibility: self,
    isValidSendAmountForBalance: self
  });
  
  self.normalizedBalance = ko.computed(function() {
    if(self.address() === null || self.balance() === null) return null;
    return normalizeAmount(self.balance(), self.divisible());
  }, self);
  
  self.normalizedBalRemaining = ko.computed(function() {
    if(!isNumber(self.quantity())) return null;
    var curBalance = normalizeAmount(self.balance(), self.divisible());
    var balRemaining = Decimal.round(new Decimal(curBalance).sub(parseFloat(self.quantity()))).toFloat();
    if(balRemaining < 0) return null;
    return balRemaining;
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

  self.doAction = function() {
    WALLET.doTransaction(self.address(), "create_send",
      { source: self.address(),
        destination: self.destAddress(),
        quantity: denormalizeAmount(parseFloat(self.quantity()), self.divisible()),
        asset: self.asset()
      },
      function() {
        bootbox.alert("<b>Your funds were sent successfully.</b><br/><br/>The action will take effect as soon as the network has processed it.");
      }
    );
    self.shown(false);
  }
  
  self.show = function(fromAddress, asset, balance, isDivisible, resetForm) {
    if(asset == 'BTC' && balance == null) {
      return bootbox.alert("Cannot send BTC as we cannot currently get in touch with the server to get your balance.");
    }
    assert(balance, "Balance is null or undefined?");
    
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.address(fromAddress);
    self.asset(asset);
    self.balance(balance);
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
var SweepAssetInDropdownItemModel = function(asset, balance, normalizedBalance) {
  this.ASSET = asset;
  this.BALANCE = balance; //raw
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
    var amount = adjustedBTCAmount || selectedAsset.BALANCE;
    var normalizedAmount = ((adjustedBTCAmount ? normalizeAmount(adjustedBTCAmount) : null)
      || selectedAsset.NORMALIZED_BALANCE);
    assert(selectedAsset);
    
    $.jqlog.log("Sweeping from: " + self.addressForPrivateKey() + " to " + self.destAddress() + " of amount "
      + normalizedAmount + " " + selectedAsset.ASSET);

    //dont use WALLET.doTransaction for this...
    multiAPIConsensus("create_send", //can send both BTC and counterparty assets
      { source: self.addressForPrivateKey(),
        destination: self.destAddress(),
        quantity: amount,
        asset: selectedAsset.ASSET,
        multisig: pubkey
      },
      function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {
        var sendTx = Bitcoin.Transaction.deserialize(unsignedTxHex);
        //Sign the TX inputs
        for (var i = 0; i < sendTx.ins.length; i++) { //sign each input with the key
          sendTx.sign(i, key);
        }
        WALLET.broadcastSignedTx(sendTx.serializeHex());
        sendsComplete.push({
          'result': true,
          'asset': selectedAsset.ASSET,
          'from': self.addressForPrivateKey(),
          'to': self.destAddress(),
          'normalized_amount': normalizedAmount
        });
        //TODO: show this sweep in pending actions
        return callback();
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
      var rawBTCBalance = self.availableAssetsToSweep()[hasBTC].BALANCE;
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
    
    //Get the most up to date # of primed txouts
    WALLET.retrieveNumPrimedTxouts(address, function(numPrimedTxouts, data) {
      WALLET.updateNumPrimedTxouts(address, numPrimedTxouts);
      self.rawUnspentTxResponse = data; //save for later (when creating the Tx itself)
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
    //construct a transaction
    var sendTx = new Bitcoin.Transaction();
    var unspent = parseUnspentTxnsList(self.rawUnspentTxResponse).unspentTxs;
    var inputAmount = (self.numNewPrimedTxouts() * MIN_PRIME_BALANCE) + MIN_FEE; //in satoshi
    var inputAmountRemaining = inputAmount;
    var txHash = null, txOutputN = null, txIn = null;
    //Create inputs
    for(txHash in unspent) {
      if(inputAmountRemaining <= 0)
        break;
      if (unspent.hasOwnProperty(txHash)) {
        for (txOutputN in unspent[txHash]) {
          if (unspent[txHash].hasOwnProperty(txOutputN)) {
            txIn = new Bitcoin.TransactionIn({
              outpoint: {
                hash: txHash,
                index: parseInt(txOutputN)
              }
            });
            sendTx.addInput(txIn);
            sendTx.ins[0].script = Bitcoin.Script.fromHex(unspent[txHash][txOutputN]['script']);
            inputAmountRemaining -= unspent[txHash][txOutputN]['amount'];
            if(inputAmountRemaining <= 0)
              break;
          }
        }
      }
    }
    if(inputAmountRemaining > 0) {
      bootbox.alert("Insufficient confirmed bitcoin balance to prime your account (require "
        + normalizeAmount(inputAmountRemaining) + " BTC @ 1 confirm or more)");
      return;
    }
    
    //Create outputs for the priming itself (x MIN_PRIME_BALANCE BTC outputs)
    for(var i=0; i < parseInt(self.numNewPrimedTxouts()); i++) {
      sendTx.addOutput(self.address(), MIN_PRIME_BALANCE);
    }
    //Create an output for change
    var changeAmount = Math.abs(inputAmountRemaining);
    sendTx.addOutput(self.address(), changeAmount);
    //^ The remaining should be MIN_FEE, which will of course go to the miners
    
    var rawTxHex = sendTx.serializeHex();
    WALLET.signAndBroadcastTx(self.address(), rawTxHex);
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
    //do the additional issuance (specify non-zero quantity, no transfer destination)
    WALLET.doTransaction(self.address(), "create_burn",
      { source: self.address(),
        quantity: denormalizeAmount(self.btcBurnAmount()),
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


var CREATE_NEW_ADDRESS_MODAL = new CreateNewAddressModalViewModel();
var SEND_MODAL = new SendModalViewModel();
var SWEEP_MODAL = new SweepModalViewModel();
var SIGN_MESSAGE_MODAL = new SignMessageModalViewModel();
var PRIME_ADDRESS_MODAL = new PrimeAddressModalViewModel();
var TESTNET_BURN_MODAL = new TestnetBurnModalViewModel();

$(document).ready(function() {
  ko.applyBindings({}, document.getElementById("gettingStartedNotice"));
  ko.applyBindingsWithValidation(CREATE_NEW_ADDRESS_MODAL, document.getElementById("createNewAddressModal"));
  ko.applyBindingsWithValidation(SEND_MODAL, document.getElementById("sendModal"));
  ko.applyBindingsWithValidation(SWEEP_MODAL, document.getElementById("sweepModal"));
  ko.applyBindingsWithValidation(SIGN_MESSAGE_MODAL, document.getElementById("signMessageModal"));
  ko.applyBindingsWithValidation(PRIME_ADDRESS_MODAL, document.getElementById("primeAddressModal"));
  ko.applyBindingsWithValidation(TESTNET_BURN_MODAL, document.getElementById("testnetBurnModal"));
  
  //Refresh BTC balances
  WALLET.refreshBTCBalances(false);
});

$('#createNewAddress').click(function() {
  if(WALLET.addresses.length >= MAX_ADDRESSES) { bootbox.alert("You already have the max number of addresses for a single wallet ("
    + MAX_ADDRESSES + "). Please create a new wallet for more."); return; }
  CREATE_NEW_ADDRESS_MODAL.show();
});

$('#sweepFunds').click(function() {
  SWEEP_MODAL.show();
});
