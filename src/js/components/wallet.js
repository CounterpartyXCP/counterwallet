
function WalletViewModel() {
  //The user's wallet
  var self = this;
  self.DEFAULT_NUMADDRESSES = 3; //default number of addresses to generate
  self.BITCOIN_WALLET = null; //Bitcoin.Wallet() BIP0032 wallet instance
  self.autoRefreshBTCBalances = true; //auto refresh BTC balances every 5 minutes
  
  self.identifier = ko.observable(null); //set when logging in
  self.addresses = ko.observableArray(); //AddressViewModel objects -- populated at login
  
  self.isNew = ko.observable(false); //set to true if we can't find the user's prefs when logging on. if set, we'll show some intro text on their login, etc.
  
  self.initBTCBalanceAutoRefresh = function() {
    assert(self.autoRefreshBTCBalances, "initBTCBalanceAutoRefresh called but autoRefreshBTCBalances != true");
    setInterval(function() { self.refreshBTCBalances(true) }, 60000 * 5); //every 5 minutes
  }
  
  self.addAddress = function(key) {
    //adds a key to the wallet, making a new address object on the wallet in the process
    //(assets must still be attached to this address, with updateBalances() or other means...)
    //also, a label should already exist for the address in PREFERENCES.address_aliases by the time this is called

    //derive an address from the key (for the appropriate network)
    var address = key.getBitcoinAddress().toString();
    //Make sure this address doesn't already exist in the wallet (sanity check)
    assert(!self.getAddressObj(address), "Cannot addAddress: address already exists in wallet!");
    //see if there's a label already for this address that's stored in PREFERENCES, and use that if so
    var addressHash = hashToB64(address);
    //^ we store in prefs by a hash of the address so that the server data (if compromised) cannot reveal address associations
    var label = PREFERENCES.address_aliases[addressHash] || "UNKNOWN LABEL";
    //^ an alias is made when a watch address is made, so this should always be found

    self.addresses.push(new AddressViewModel(key, address, label)); //add new
    $.jqlog.log("Wallet address added: " + address + " -- hash: " + addressHash + " -- label: " + label);
  }
  
  self.addWatchOnlyAddress = function(address) {
    //adds a watch only address to the wallet
    //a label should already exist for the address in PREFERENCES.address_aliases by the time this is called
    assert(!self.getAddressObj(address), "Cannot addWatchOnlyAddress: address already exists in wallet!");
    var addressHash = hashToB64(address);
    var label = PREFERENCES.address_aliases[addressHash] || "UNKNOWN LABEL";

    self.addresses.push(new AddressViewModel(null, address, label)); //add new
    $.jqlog.log("Watch-only wallet address added: " + address + " -- hash: " + addressHash + " -- label: " + label);
  }

  self.getAddressesList = function(withLabel) {
    if(typeof(withLabel)==='undefined') withLabel = false;
    var addresses = [];
    
    ko.utils.arrayForEach(self.addresses(), function(address) {
      if(withLabel) {
        addresses.push([address.ADDRESS, address.label()]);
      } else {
        addresses.push(address.ADDRESS);
      }
    });
    return addresses;
  }
  
  self.getAddressObj = function(address) {
    //given an address string, return a reference to the cooresponding AddressViewModel object
    return ko.utils.arrayFirst(self.addresses(), function(a) {
      return a.ADDRESS == address;
    });
    return null;
  }
  
  self.getBalance = function(address, asset, normalized) {
    if(typeof(normalized)==='undefined') normalized = true;
    var addressObj = self.getAddressObj(address);
    if(!addressObj) return false;
    var assetObj = addressObj.getAssetObj(asset);
    if(!assetObj) return false;
    return normalized ? assetObj.normalizedBalance() : assetObj.balance();
  }

  self.updateBalance = function(address, asset, balance) {
    //Update a balance for a specific asset on a specific address
    var addressObj = self.getAddressObj(address);
    if(!addressObj) return false;
    addressObj.addOrUpdateAsset(asset, balance);
    return true;
  }

  self.getNumPrimedTxouts = function(address) {
    var addressObj = self.getAddressObj(address);
    if(!addressObj) return null;
    return addressObj.numPrimedTxouts();
  }
  
  self.updateNumPrimedTxouts = function(address, n) {
    var addressObj = self.getAddressObj(address);
    if(!addressObj) return false;
    addressObj.numPrimedTxouts(n);
    return true;
  }

  self.updateBalances = function(isAtLogon) {
    //updates all balances for all addesses, creating the asset objects on the address if need be
    if(typeof(isAtLogon)==='undefined') isAtLogon = false; //this field should only be used during login
    
    self.refreshBTCBalances(isAtLogon);
    //^ if isAtLogon is true, we will start a recurring get BTC balances timer chain 

    //update all counterparty XCP/asset balances
    var filters = [];
    ko.utils.arrayForEach(self.addresses(), function(address) {
      filters.push({'field': 'address', 'op': '==', 'value': address.ADDRESS});
    });
    failoverAPI("get_balances", {"filters": filters, "filterop": "or"},
      function(data, endpoint) {
        $.jqlog.log("Got initial balances: " + JSON.stringify(data));
        for(var i=0;i<data.length;i++) {
          self.updateBalance(data[i]['address'], data[i]['asset'], data[i]['amount']);  
        }
      }
    );
  }
  
  self.refreshBTCBalances = function(isRecurring) {
    if(typeof(isRecurring)==='undefined') isRecurring = false; //this field should only be used by initBTCBalanceAutoRefresh
    //^ if isRecurring is set to true, we will update BTC balances every 5 min as long as self.autoRefreshBTCBalances == true
    
    //update all BTC balances
    self.retrieveBTCBalances(self.getAddressesList(), function(data) {
      for(var i=0; i < data.length; i++) {
        self.updateBalance(data[i]['address'], "BTC", data[i]['balance']);
        
        function _retrNumPrimed(num) {
          //Also refresh BTC unspent txouts (to know when to "reprime" the account)
          var address = data[i]['address'];
          self.retrieveNumPrimedTxouts(address, function(numPrimedTxouts) {
            self.updateNumPrimedTxouts(address, numPrimedTxouts); //null if unknown
          }, function(jqXHR, textStatus, errorThrown) {
            self.updateNumPrimedTxouts(address, null); //null = UNKNOWN
          });
        }
        if(data[i]['balance']) _retrNumPrimed(i); //closure
        else self.updateNumPrimedTxouts(data[i]['address'], 0); //zero balance == no primed txouts (no need to even try and get a 500 error)
      }
      
      if(isRecurring && self.autoRefreshBTCBalances) {
        setTimeout(function() {
          if(self.autoRefreshBTCBalances) {
            self.refreshBTCBalances(true);
          }
        }, 60000 * 5);
      }
    }, function(jqXHR, textStatus, errorThrown) {
      //insight down or spazzing
      var addresses = self.getAddressesList();
      for(var i=0; i < addresses.length; i++) {
        self.updateBalance(addresses[i], "BTC", null); //null = UNKNOWN
        self.updateNumPrimedTxouts(addresses[i], null); //null = UNKNOWN
      }
    });
  }

  self.removeKeys = function() {
    //removes all keys (addresses) from the wallet. Normally called when logging out
    //stop BTC balance timer on each address
    ko.utils.arrayForEach(this.addresses(), function(a) {
        a.doBTCBalanceRefresh = false;
    });    
    self.addresses([]); //clear addresses
  } 
  
  
  /////////////////////////
  //BTC-related
  self.getBTCBlockHeight = function(callback) {
    fetchData(urlsWithPath(counterwalletd_insight_api_urls, '/sync/'),
      function(data, endpoint) {
        if(data['syncPercentage'] < 100) {
          $.jqlog.warn("Blockchain not fully synched in insight when trying to get BTC block height!");
        }
        return callback(data['blockChainHeight']);
      }
    );
  }
  
  self.broadcastSignedTx = function(signedTxHex) {
    $.jqlog.log("RAW SIGNED HEX: " + signedTxHex);
    
    if(IS_DEV) {
      $.jqlog.log("SKIPPING SEND AS IS_DEV == 1");
      return;
    }
    failoverAPI("transmit", {"tx_hex": signedTxHex, "is_signed": true},
      function(data, endpoint) {
        $.jqlog.log("Transaction broadcast from: " + endpoint);
      }
    );
  }

  self.signAndBroadcastTxRaw = function(key, unsignedTxHex) {
    //Sign and broadcast a multisig transaction that we got back from counterpartyd (as a raw unsigned tx in hex)
    var sendTx = Bitcoin.Transaction.deserialize(unsignedTxHex), i = null;
    $.jqlog.log("RAW UNSIGNED HEX: " + unsignedTxHex);
    //$.jqlog.log("RAW UNSIGNED Tx: " + TX.toBBE(sendTx));
    
    //Sanity check that the first regular output before the first data output is an address in our wallet
    /*var address = null, addr = null;
    for (i=0; i < sendTx.outs.length; i++) {
      address = sendTx.outs[1].address;
      address.version = !USE_TESTNET ? Bitcoin.network.mainnet.addressVersion : Bitcoin.network.testnetnet.addressVersion;
      addr = address.toString();
      if(USE_TESTNET && addr == TESTNET_UNSPENDABLE) continue;  //this is a testnet burn (skip validation of this out)
      if(addr[0] != '1' || addr[0] != 'm' || addr[0] != 'n') continue; //not a pubkey hash address, skip
    }*/
    
    //Sign the input(s)
    for (i=0; i < sendTx.ins.length; i++) {
      sendTx.sign(i, key);
    }
    
    return self.broadcastSignedTx(sendTx.serializeHex());
  }
  
  self.signAndBroadcastTx = function(address, unsignedTxHex) {
    var key = WALLET.getAddressObj(address).KEY;    
    return self.signAndBroadcastTxRaw(key, unsignedTxHex);
  }
  
  self.retrieveBTCBalance = function(address, callback, errorHandler) {
    //If you are requesting more than one balance, use retrieveBTCBalances instead
    fetchData(urlsWithPath(counterwalletd_insight_api_urls, '/addr/' + address),
      function(data, endpoint) {
        return callback(parseInt(data['balanceSat']));
      },
      errorHandler || defaultErrorHandler);
  }

  self.retrieveBTCBalances = function(addresses, callback, errorHandler) {
    //addresses is a list of one or more bitcoin addresses
    var balances = [];
    for(var i = 0; i < addresses.length; i++) {
      fetchData(urlsWithPath(counterwalletd_insight_api_urls, '/addr/' + addresses[i]),
        function(data, endpoint) {
          balances.push({
            'address': data['addrStr'],
            'balance': parseInt(data['balanceSat'])
          }); 
          if(balances.length == addresses.length) {
            return callback(balances);
          }
        },
        errorHandler || defaultErrorHandler);
    }
  }
  
  self.retrieveNumPrimedTxouts = function(address, callback) {
    assert(callback, "callback must be defined");
    fetchData(urlsWithPath(counterwalletd_insight_api_urls, '/addr/' + address + '/utxo'),
      function(data, endpoint) {
        var numSuitableUnspentTxouts = 0;
        var totalBalance = 0;
        for(var i=0; i < data.length; i++) {
          if(denormalizeAmount(data[i]['amount']) >= MIN_PRIME_BALANCE && data[i]['confirmations'] >= 1) numSuitableUnspentTxouts++;
          totalBalance += denormalizeAmount(data[i]['amount']);
        }
        //final number of primed txouts is lesser of either the # of txouts that are >= .0005 BTC, OR the floor(total balance / .0005 BTC)
        return callback(Math.min(numSuitableUnspentTxouts, Math.floor(totalBalance / MIN_PRIME_BALANCE)), data);
      },
      function(jqXHR, textStatus, errorThrown) {
      if(jqXHR.responseText == 'No free outputs to spend') {
        return callback(0, null);
      } else {
        return callback(null, null); //some other error
      }
    });
  }
  
  /////////////////////////
  //Counterparty transaction-related
  self.canDoTransaction = function(addr) {
    /* ensures that the specified address can perform a counterparty transaction */
    var address = self.getAddressObj(addr);
    assert(!address.IS_WATCH_ONLY, "Cannot perform this action on a watch only address!");
    if(address.numPrimedTxouts() == 0) { //no primed txouts
      if(self.getBalance(address, "BTC") == 0) {
        bootbox.alert("Can't do this action as you have no BTC at this address, and Counterparty actions require a"
          + " small amount of BTC to perform.<br/><br/>Please deposit some BTC into address <b>" + addr + "</b> and try again.");
        return false;
      }
      
      //Otherwise, we DO have a balance, we just don't have any suitable primed outputs
      PRIME_ADDRESS_MODAL.show(addr);
      PRIME_ADDRESS_MODAL.showNoPrimedInputsError(true);
      return false;
    }
    return true;
  }
  
  self.doTransaction = function(address, action, data, onSuccess) {
    assert(data['multisig'] === undefined);
    data['multisig'] = WALLET.getAddressObj(address).PUBKEY;
    multiAPIConsensus(action, data,
      function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {
        WALLET.signAndBroadcastTx(address, unsignedTxHex);
        //TODO: register this as a pending transaction 
        return onSuccess();
    });
  }
  
}

window.WALLET = new WalletViewModel();
