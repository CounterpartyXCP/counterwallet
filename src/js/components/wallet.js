
function WalletViewModel() {
  //The user's wallet
  var self = this;
  self.DEFAULT_NUMADDRESSES = 3; //default number of addresses to generate
  self.BITCOIN_WALLET = null; //Bitcoin.Wallet() BIP0032 wallet instance
  self.autoRefreshBTCBalances = true; //auto refresh BTC balances every 5 minutes
  
  self.identifier = ko.observable(null); //set when logging in
  self.addresses = ko.observableArray(); //AddressViewModel objects -- populated at login
  
  self.initBTCBalanceAutoRefresh = function() {
    assert(self.autoRefreshBTCBalances, "initBTCBalanceAutoRefresh called but autoRefreshBTCBalances != true");
    setInterval(function() { self.refreshBTCBalances(true) }, 60000 * 5); //every 5 minutes
  }
  
  self.addKey = function(key, defaultLabel) {
    //adds a key to the wallet, making a new address object on the wallet in the process
    //(assets must still be added to this address, with updateBalances() or other means...)

    //derive an address from the key (for the appropriate network)
    var address = key.getBitcoinAddress().toString();
    //Make sure this address doesn't already exist in the wallet (sanity check)
    assert(!self.getAddressObj(address), "Cannot addKey: address already exists in wallet!");
    //see if there's a label already for this address that's stored in PREFERENCES, and use that if so
    var addressHash = Bitcoin.convert.bytesToBase64(Bitcoin.Crypto.SHA256(address, {asBytes: true}));
    //^ we store in prefs by a hash of the address so that the server data (if compromised) cannot reveal address associations

    var label = PREFERENCES.address_aliases[addressHash] || defaultLabel || "UNKNOWN LABEL";
    $.jqlog.log("Label for " + address + " is " + label);
    
    //make sure this address doesn't already exist in the wallet
    var match = ko.utils.arrayFirst(self.addresses(), function(item) {
        return item.ADDRESS === address;
    });
    if (!match) {
      self.addresses.push(new AddressViewModel(key, address, label)); //add new
    } else { //just update the label, since it already exists
      match.label(label); //modify existing
    }
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
  self.broadcastSignedTx = function(signedTxHex) {
    
    //$.jqlog.log("RAW SIGNED Tx: " + TX.toBBE(sendTx));
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
    var bytes = Bitcoin.convert.hexToBytes(unsignedTxHex);
    var sendTx = Bitcoin.Transaction.deserialize(bytes);
    $.jqlog.log("RAW UNSIGNED HEX: " + unsignedTxHex);
    //$.jqlog.log("RAW UNSIGNED Tx: " + TX.toBBE(sendTx));
    
    //Sign the inputs
    for (var i = 0; i < sendTx.ins.length; i++) { //sign each input with the key
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
        return callback(parseInt($.parseJSON(data)['balanceSat']));
      },
      errorHandler || defaultErrorHandler);
  }

  self.retrieveBTCBalances = function(addresses, callback, errorHandler) {
    //addresses is a list of one or more bitcoin addresses
    var balances = [];
    for(var i = 0; i < addresses.length; i++) {
      self.retrieveBTCBalance(addresses[i],
        function(data, endpoint) {
          data = $.parseJSON(data);
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
    fetchData(urlsWithPath(counterwalletd_insight_api_urls, '/addr/' + address + '/utxo'),
      function(data, endpoint) {
        data = $.parseJSON(data);
        var numSuitableUnspentTxouts = 0;
        var totalBalance = 0;
        for(var i=0; i < data.length; i++) {
          if(data[i]['value'] * UNIT >= MIN_PRIME_BALANCE && data[i]['confirmations'] >= 1) numSuitableUnspentTxouts++;
          totalBalance += data[i]['value'] * UNIT;
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
  
  self.assetsToAssetPair = function(asset1, asset2) {
    //NOTE: This MUST use the same logic/rules as counterwalletd's assets_to_asset_pair() function in lib/util.py
    var base = null;
    var quote = null;
    if(asset1 == 'XCP' || asset2 == 'XCP') {
        base = asset1 == 'XCP' ? asset1 : asset2;
        quote = asset1 == 'XCP' ? asset2 : asset1;
    } else if(asset1 == 'BTC' || asset2 == 'BTC') {
        base = asset1 == 'BTC' ? asset1 : asset2;
        quote = asset1 == 'BTC' ? asset2 : asset1;
    } else {
        base = asset1 < asset2 ? asset1 : asset2;
        quote = asset1 < asset2 ? asset2 : asset1;
    }
    return [base, quote];
  }
}

var WALLET = new WalletViewModel();
