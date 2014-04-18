
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
    var label = $("<div/>").html(self.newLabel()).text();
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
      newAddress = WALLET.BITCOIN_WALLET.generateAddress();
      var i = WALLET.BITCOIN_WALLET.addresses.length - 1;
      var privkey = WALLET.BITCOIN_WALLET.getPrivateKey(i);
      WALLET.addAddress(privkey);
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
    PREFERENCES['address_aliases'][newAddressHash] = self.description();
    
    //manually set the address in this case to get around the chicken and egg issue here (and have client side match the server)
    WALLET.getAddressObj(newAddress).label(self.description());

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
  
  self.normalizedBalRemaining = ko.computed(function() {
    if(!isNumber(self.quantity())) return null;
    var curBalance = normalizeQuantity(self.rawBalance(), self.divisible());
    var balRemaining = Decimal.round(new Decimal(curBalance).sub(parseFloat(self.quantity())), 8, Decimal.MidpointRounding.ToEven).toFloat();
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
  
  self.maxAmount = function() {
    assert(self.normalizedBalance(), "No balance present?");
    if(self.asset() == 'BTC')
      self.quantity(self.normalizedBalance() - normalizeQuantity(MIN_FEE));
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

function SweepModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.privateKey = ko.observable('').trimmed().extend({
    required: true,
    validation: {
      validator: function (val, self) {
  
        var key = BitcoinECKey(self.privateKey());      
        
        /*$.jqlog.debug('adress:'+key.getBitcoinAddress());
        $.jqlog.debug('compressed:'+key.compressed);
        $.jqlog.debug('version:'+key.version);
        $.jqlog.debug('priv:'+key.priv);*/

        return key.priv !== null && key.compressed !== null;
      },
      message: 'Not a valid' + (USE_TESTNET ? ' TESTNET ' : ' ') + 'private key.',
      params: self
    }    
  });
  self.availableAssetsToSweep = ko.observableArray([]);
  //^ used for select box entries (composed dynamically on privateKey update)
  self.selectedAssetsToSweep = ko.observableArray([]).extend({
    required: true,
    validation: {
      validator: function (val, self, callback) {
        var numAssets = val.length;
        var minBtcBalance = numAssets*MIN_PRIME_BALANCE;

        if(self.numPrimedTxoutsForPrivateKey() === null) {
          return false; //priv key not set yet??
        }
        
        if(self.btcBalanceForPrivateKey() < minBtcBalance) {
          var missingBtc = minBtcBalance-self.btcBalanceForPrivateKey();

          this.message = "We're not able to sweep all of the assets you selected. Please send "
            + normalizeQuantity(missingBtc)
            + " BTC transactions to address " + self.addressForPrivateKey() + " and try again."
          return false;

        }
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
  self.addressForPrivateKey = ko.computed(function() {
    if(!self.privateKeyValidated.isValid()) return null;
    //Get the address for this privatekey
    var key = BitcoinECKey(self.privateKey());
    assert(key.priv !== null && key.compressed !== null, "Private key not valid!"); //should have been checked already
    return key.getAddress(NETWORK_VERSION).toString();
  }, self);
  self.numPrimedTxoutsForPrivateKey = ko.observable(null);
  self.btcBalanceForPrivateKey = ko.observable(null);
  
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
        self.availableAddresses.push(new BalancesAddressInDropdownItemModel(addresses[i][0], addresses[i][1]));
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
  
  self._signInputs = function(unsignedTxHex) {
    var sendTx = Bitcoin.Transaction.deserialize(unsignedTxHex);
    var txInHash = null, signature = null, SIGHASH_ALL = 1;
    var key = new BitcoinECKey(self.privateKey());
    for(var i = 0; i < sendTx.ins.length; i++) {
      txInHash = txIn.hashTransactionForSignature(sendTx.ins[i].script, i, SIGHASH_ALL);
      signature = key.sign(txInHash);
      signature.push(parseInt(SIGHASH_ALL, 10));
      sendTx.ins[i].script = Bitcoin.Script.createInputScript(signature, key.getPub());
    }    
  }
  
  self._doTransferAsset = function(selectedAsset, key, pubkey, opsComplete, callback) {
    assert(selectedAsset.ASSET && selectedAsset.ASSET_INFO);
    $.jqlog.debug("Transferring asset " + selectedAsset.ASSET + " from " + self.addressForPrivateKey() + " to " + self.destAddress());
    
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
        var sendTx = Bitcoin.Transaction.deserialize(unsignedTxHex);
        for (i = 0; i < sendTx.ins.length; i++) { //sign each input with the key
          sendTx.sign(i, key);
        }
        WALLET.broadcastSignedTx(sendTx.serializeHex(), function(issuanceTxHash, endpoint) { //broadcast was successful
          opsComplete.push({
            'type': 'transferOwnership',
            'result': true,
            'asset': selectedAsset.ASSET,
            'from': self.addressForPrivateKey(),
            'to': self.destAddress()
          });
          PENDING_ACTION_FEED.add(issuanceTxHash, "issuances", transferData);
          return callback();

        }, function(jqXHR, textStatus, errorThrown, endpoint) { //on error broadcasting tx

          $.jqlog.debug('Transaction error: '+textStatus);
          // retry..
          return callback(true, {
            'type': 'transferOwnership',
            'result': false,
            'asset': selectedAsset.ASSET
          });
          
        });
      }, function(unmatchingResultsList) { //onConsensusError
        opsComplete.push({
          'type': 'transferOwnership',
          'result': false,
          'asset': selectedAsset.ASSET
        });
        return self.showSweepError(selectedAsset.ASSET, opsComplete);
      }, function(jqXHR, textStatus, errorThrown, endpoint) { //onSysError

        $.jqlog.debug('onSysError error: '+textStatus);
        // retry..
        return callback(true, {
          'type': 'transferOwnership',
          'result': false,
          'asset': selectedAsset.ASSET
        });

      }
    );
  }
  
  self._doSendAsset = function(asset, key, pubkey, opsComplete, adjustedBTCQuantity, callback) {
    $.jqlog.debug('_doSendAsset: '+asset);
    if(asset == 'BTC') assert(adjustedBTCQuantity !== null);
    else assert(adjustedBTCQuantity === null);
    var selectedAsset = ko.utils.arrayFirst(self.availableAssetsToSweep(), function(item) {
      return asset == item.ASSET;
    });
    var sendTx = null, i = null;
    var quantity = adjustedBTCQuantity || selectedAsset.RAW_BALANCE;
    var normalizedQuantity = ((adjustedBTCQuantity ? normalizeQuantity(adjustedBTCQuantity) : null)
      || selectedAsset.NORMALIZED_BALANCE);
    assert(selectedAsset);
    
    if(!quantity) { //if there is no quantity to send for the asset, only do the transfer
      if(asset == 'XCP' || asset == 'BTC') { //nothing to send, and no transfer to do
        return callback(); //my valuable work here is done!
      } else {
        self._doTransferAsset(selectedAsset, key, pubkey, opsComplete, callback); //will trigger callback() once done
        return;
      }
    }

    $.jqlog.debug("Sweeping from: " + self.addressForPrivateKey() + " to " + self.destAddress() + " of quantity "
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
        var sendTx = Bitcoin.Transaction.deserialize(unsignedTxHex);
        for (i = 0; i < sendTx.ins.length; i++) { //sign each input with the key
          sendTx.sign(i, key);
        }
        WALLET.broadcastSignedTx(sendTx.serializeHex(), function(sendTxHash, endpoint) { //broadcast was successful
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
          
          //For non BTC/XCP assets, also take ownership (iif the address we are sweeping from is the asset's owner')
          if(   selectedAsset.ASSET != 'XCP'
             && selectedAsset.ASSET != 'BTC'
             && selectedAsset.ASSET_INFO['owner'] == self.addressForPrivateKey()) {
            $.jqlog.debug("waiting "+TRANSACTION_DELAY+"ms");
            setTimeout(function() {
              self._doTransferAsset(selectedAsset, key, pubkey, opsComplete, callback); //will trigger callback() once done
            }, TRANSACTION_DELAY);
          } else { //no transfer, just an asset send for this asset
            return callback();  
          }
          // TODO: add param response in json format for error callback
        }, function(jqXHR, textStatus, errorThrown, endpoint) { //on error broadcasting tx

          $.jqlog.debug('Transaction error: '+textStatus);
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
          'asset': selectedAsset.ASSET
        });
        self.showSweepError(selectedAsset.ASSET, opsComplete);
      }, function(jqXHR, textStatus, errorThrown, endpoint) { //onSysError

        $.jqlog.debug('onSysError error: '+textStatus);
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
    var key = new BitcoinECKey(self.privateKey());
    assert(key.priv !== null && key.compressed !== null, "Private key not valid!"); //should have been checked already
    var pubkey = key.getPub().toHex();
    var sendsToMake = [];
    var opsComplete = [];
    
    var selectedAsset = null, hasBTC = false;
    for(var i = 0; i < self.selectedAssetsToSweep().length; i++) {
      selectedAsset = self.selectedAssetsToSweep()[i];
      if(selectedAsset == 'BTC') {
        hasBTC = i; //send BTC last so the sweep doesn't randomly eat our primed txouts for the other assets
      } else {
        sendsToMake.push([selectedAsset, key, pubkey, opsComplete, null]);
      }
    }
    if(hasBTC !== false) {
      //adjust the balance of BTC to sweep out to account for the primed TXouts being consumed
      var rawBTCBalance = self.availableAssetsToSweep()[hasBTC].RAW_BALANCE;
      var adjustedBTCQuantity = rawBTCBalance - (self.selectedAssetsToSweep().length * MIN_PRIME_BALANCE);
      //^ the adjusted BTC balance is what we will end up sweeping out of the account.
      //  BTW...this includes the BTC fee for the BTC sweep itself as a primed TXout size (.0005 instead of .0001...no biggie (I think)
      sendsToMake.push(["BTC", key, pubkey, opsComplete, adjustedBTCQuantity]);
    }
    
    var total = sendsToMake.length;
    var progress = 0;
    var sendParams = false;
    var retryCounter = {};

    var doSweep = function(retry, failedTx) {

      // if retry we don't take the next sendsToMake item
      if (retry!==true || sendParams===false) {

        sendParams = sendsToMake.shift();
        progress++;

      } else if (retry) {

        $.jqlog.debug("RETRY"); 

        if (sendParams[0] in retryCounter) {
          if (retryCounter[sendParams[0]]<TRANSACTION_MAX_RETRY) {
            retryCounter[sendParams[0]]++;    
            $.jqlog.debug("retry count: "+retryCounter[sendParams[0]]);        
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

      $.jqlog.debug(sendParams); 
       
      if(sendParams === undefined) {
        self.shown(false);
        self._sweepCompleteDialog(opsComplete);
      } else {
        $.jqlog.debug("processing tx "+progress+" / "+total+" ("+sendParams[0]+")");
        if (retry && failedTx['type']=='transferOwnership') {

          //TODO: this is ugly. transfert asset must be include in sendsToMake array
          self._doTransferAsset(failedTx['selectedAsset'], sendParams[1], sendParams[2], sendParams[4], function(retry, failedTx) {
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
    doSweep();

    //Make send calls sequentially
    /*function makeSweeps(){
      var d = jQuery.Deferred();
      var doSweep = function() {
        var sendParams = sendsToMake.shift();
        if(sendParams === undefined) return d.resolve();
        //delay for 250ms between each asset send to avoid -22 tx errors (I'm guessing that what causes them in this case)
        setTimeout(function() {
          self._doSendAsset(sendParams[0], sendParams[1], sendParams[2], sendParams[3], sendParams[4], function() {
            return doSweep();
          }); 
        }, 300);
      };
      doSweep();
      return d.promise();
    };
    makeSweeps().then(function() {
      self.shown(false);
      self._sweepCompleteDialog(opsComplete);
    }); */   
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
        }
      });
      
      //Also get the BTC balance at this address and put at head of the list
      //and also record the number of primed txouts for the address
      //Note that if BTC is one of the things we're sweeping, technically we don't need a full primed output quantity
      // for that (we just need an available out of > MIN_FEE... but let's just require a primed out for a BTC send to keep things simple)
      WALLET.retriveBTCAddrsInfo([address], function(data) {
        if(data[0]['confirmedRawBal'] && data[0]['numPrimedTxouts'] >= 1) {
          //We don't need to supply asset info to the SweepAssetInDropdownItemModel constructor for BTC
          // b/c we won't be transferring any asset ownership with it
          self.availableAssetsToSweep.unshift(new SweepAssetInDropdownItemModel(
            "BTC", data[0]['confirmedRawBal'], normalizeQuantity(data[0]['confirmedRawBal'])));
        }
        self.numPrimedTxoutsForPrivateKey(data[0]['numPrimedTxouts']);
        self.btcBalanceForPrivateKey(data[0]['confirmedRawBal']);
      });
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
    var hexSignedMessage = Bitcoin.Message.sign(key, self.message());
    $.jqlog.debug('hexSignedMessage: '+hexSignedMessage);
    self.signedMessage(self.signatureFormat() == 'base64'
      ? Bitcoin.convert.bytesToBase64(hexSignedMessage) : Bitcoin.convert.bytesToHex(hexSignedMessage));
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

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
