
function WalletViewModel() {
  //The user's wallet
  var self = this;
  self.DEFAULT_NUMADDRESSES = 3; //default number of addresses to generate
  self.ELECTRUM_PRIV_KEY = null; //the master private key from electrum (from which the address priv keys are derived)
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
    var address = key.getBitcoinAddress(USE_TESTNET ? address_types['testnet'] : address_types['prod']).toString();
    
    //Make sure this address doesn't already exist in the wallet (sanity check)
    assert(!self.getAddressObj(address), "Cannot addKey: address already exists in wallet!");
    
    //see if there's a label already for this address that's stored in PREFERENCES, and use that if so
    var label = defaultLabel || '';
    var addressHash = Crypto.util.bytesToBase64(Crypto.SHA256(address, {asBytes: true}));
    if(addressHash in PREFERENCES.address_aliases) {
      label = PREFERENCES.address_aliases[addressHash];
    }
    
    //make sure this address doesn't already exist in the wallet
    var match = ko.utils.arrayFirst(self.addresses(), function(item) {
        return item.ADDRESS === address;
    });
    if (!match) {
      self.addresses.push(new AddressViewModel(key, address, label)); //add new
    } else { //just update the label, since it already exists
      match.label = label; //modify existing
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

  self.getNumUnspentTxouts = function(address) {
    var addressObj = self.getAddressObj(address);
    if(!addressObj) return null;
    return addressObj.numUnspentTxouts();
  }
  
  self.updateNumUnspentTxouts = function(address, numUnspentTxouts) {
    var addressObj = self.getAddressObj(address);
    if(!addressObj) return false;
    addressObj.numUnspentTxouts(numUnspentTxouts);
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
        
        //Also refresh BTC unspent txouts (to know when to "reprime" the account)
        self.getUnspentBTCOutputs(data[i]['address'], function(numUnspentTxouts) {
          self.updateNumUnspentTxouts(data[i]['address'], numUnspentTxouts); //null if unknown
        }, function(jqXHR, textStatus, errorThrown) {
          self.updateNumUnspentTxouts(data[i]['address'], "BTC", null); //null = UNKNOWN
        });
      }
      
      if(isRecurring && self.autoRefreshBTCBalances) {
        setTimeout(function() {
          if(self.autoRefreshBTCBalances) {
            self.refreshBTCBalances(true);
          }
        }, 60000 * 5);
      }
    }, function(jqXHR, textStatus, errorThrown) {
      //blockchain down or spazzing
      var addresses = self.getAddressesList();
      for(var i=0; i < addresses.length; i++) {
        self.updateBalance(addresses[i], "BTC", null); //null = UNKNOWN
        self.updateNumUnspentTxouts(addresses[i], "BTC", null); //null = UNKNOWN
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
  self.signAndBroadcastTxRaw = function(key, unsigned_tx_hex) {
    //Sign and broadcast a multisig transaction that we got back from counterpartyd (as a raw unsigned tx in hex)
    //http://bitcoin.stackexchange.com/a/5241
    //http://procbits.com/2013/08/27/generating-a-bitcoin-address-with-javascript
    //https://github.com/BitGo/bitcoinjs-lib/blob/master/src/transaction.js#L576
    //https://github.com/BitGo/bitcoinjs-lib/blob/master/src/script.js
    //https://github.com/BitGo/bitcoinjs-lib/blob/master/src/address.js
    //helpful: https://www.bitgo.com/bitgo.js
    //multisig: https://gist.github.com/gavinandresen/3966071
    var bytes = Crypto.util.hexToBytes(unsigned_tx_hex);
    var sendTx = TX.deserialize(bytes);
    $.jqlog.log("RAW UNSIGNED HEX: " + unsigned_tx_hex);
    $.jqlog.log("RAW UNSIGNED TX: " + TX.toBBE(sendTx));

    //Sign the output
    var hashType = 1;
    for (var i = 0; i < sendTx.ins.length; i++) { //sign each input with the key
      var hash = sendTx.hashTransactionForSignature(sendTx.ins[0].script, 0, 1 ); // hashtype = SIGHASH_ALL
      var signature = key.sign(hash);
      signature.push(parseInt(hashType, 10));
      var pubKey = key.getPub();
      var script = new Bitcoin.Script();
      script.writeBytes(signature);
      script.writeBytes(pubKey);
      sendTx.ins[i].script = script;
    }
    
    //take out to hex and broadcast
    var signed_tx_hex = Crypto.util.bytesToHex(sendTx.serialize());
    $.jqlog.log("RAW SIGNED TX: " + TX.toBBE(sendTx));
    $.jqlog.log("RAW SIGNED HEX: " + signed_tx_hex);
    
    if(IS_DEV) {
      $.jqlog.log("SKIPPING SEND AS IS_DEV == 1");
      return;
    }
    
    self.sendTX(signed_tx_hex, function(data) {
      $.jqlog.log("Transaction send finished.");
    });
  }
  
  self.signAndBroadcastTx = function(address, unsigned_tx_hex) {
    var key = WALLET.getAddressObj(address).KEY;    
    return self.signAndBroadcastTxRaw(key, unsigned_tx_hex);
  }
  
  self.retrieveBTCBalance = function(address, callback, errorHandler) {
    //If you are requesting more than one balance, use retrieveBTCBalances instead
    $.get('http://blockchain.info/q/addressbalance/' + address,
      {cors: 'true'}, callback).error(errorHandler || defaultErrorHandler);
  }

  self.retrieveBTCBalances = function(addresses, callback, errorHandler) {
    //addresses is a list of one or more bitcoin addresses
    $.getJSON('https://blockchain.info/multiaddr',
      {cors: 'true', active: addresses.join('|')},
      function(data) {
        var balances = [];
        for(var i=0; i<data['addresses'].length; i++) {
          balances.push({
            'address': data['addresses'][i]['address'],
            'balance': parseInt(data['addresses'][i]['final_balance'])
          }); 
        }
        return callback(balances);
      }
    ).error(errorHandler || defaultErrorHandler);
  }
  
  self.getUnspentBTCOutputs = function(address, callback, errorHandler) {
    $.getJSON('http://blockchain.info/unspent',
      {cors: 'true', address: address}, callback).error(errorHandler || defaultErrorHandler);
  }
  
  self.getNumPrimedTxoutsOnAccount = function(address, callback) {
      return self.getUnspentBTCOutputs(address, function(data) {
        var numSuitableUnspentTxouts = 0;
        for(var i=0; i < data["unspent_outputs"].length; i++) {
          if(data[i]['value'] >= MIN_PRIME_BALANCE) numSuitableUnspentTxouts++;
        }
        //final number of primed txouts is lesser of either the # of txouts that are >= .0005 BTC, OR the floor(total balance / .0005 BTC)
        return callback(Math.min(numSuitableUnspentTxouts, Math.floor(data[i]['balance'] / MIN_PRIME_BALANCE)), data);
      },
      function(jqXHR, textStatus, errorThrown) {
        return callback(null); //blockchain down/error?
      });
  }
  
  self.sendTX = function(tx, callback) {
    var postdata = 'tx=' + tx;
    
    //use Yahoo Query Language (YQL) to get around cross-domain issues
    /*var q = 'use "http://brainwallet.github.com/js/htmlpost.xml" as htmlpost; ';
    q += 'select * from htmlpost where url="' + url + '" ';
    q += 'and postdata="' + postdata + '" and xpath="//p"';
    $.queryYQL(q, callback).error(defaultErrorHandler);*/
   
    $.post('http://blockchain.info/pushtx', postdata, callback).error(defaultErrorHandler);
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
