
function WalletViewModel() {
  //The user's wallet
  var self = this;
  self.DEFAULT_NUMADDRESSES = 5; //default number of addresses to generate
  
  self.identifier = ko.observable(null); //set when logging in
  self.addresses = ko.observableArray(); //AddressViewModel objects -- populated at login
  
  self.addKey = function(key, defaultLabel) {
    //adds a key to the wallet, making a new address object on the wallet in the process
    //(assets must still be added to this address, with updateBalances() or other means...)

    //derive an address from the key
    var address = key.getBitcoinAddress().toString();
    
    //see if there's a label already for this address that's stored in PREFERENCES, and use that if so
    var label = defaultLabel || '';
    if(address in PREFERENCES.address_aliases) {
      label = PREFERENCES.address_aliases[address];
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
  
  self.getAddressObj = function(address) {
    //given an address string, return a reference to the cooresponding AddressViewModel object
    return ko.utils.arrayFirst(this.addresses(), function(a) {
      return a.ADDRESS == address;
    });
  }
  
  self.updateBalance = function(address, asset, balance) {
    //Update a balance for a specific asset on a specific address
    var match = ko.utils.arrayFirst(self.addresses(), function(item) {
        return item.ADDRESS === address;
    });
    if (!match) {
      return false;
    } else {
      match.addOrUpdateAsset(asset, balance);
    }
  }
  
  self.updateBalances = function() {
    //updates all balances for all addesses, creating the asset objects on the address if need be
    ko.utils.arrayForEach(self.addresses(), function(address) {
      //update all BTC balances
      self.retrieveBTCBalance(address.ADDRESS, function(data) {
        address.addOrUpdateAsset("BTC", parseInt(data));
      });
    });

    //update all counterparty XCP/asset balances
    var filters = [];
    ko.utils.arrayForEach(self.addresses(), function(address) {
      filters.push({'field': 'address', 'op': '==', 'value': address.ADDRESS});
    });
    makeJSONAPICall("counterpartyd", "get_balances", {"filters": filters, "filterop": "or"},
      function(response) {
        $.jqlog.log("Got initial balances: " + JSON.stringify(response));
        for(var i=0;i<response.length;i++) {
          self.updateBalance(response[i]['address'], response[i]['asset'], response[i]['amount']);  
        }
      }
    );
  }
  
  self.removeKeys = function() {
    //removes all keys (addresses) from the wallet. Normally called when logging out
    
    //stop BTC balance timer on each address
    ko.utils.arrayForEach(this.addresses(), function(a) {
        a.doBTCBalanceRefresh = false;
    });    
    
    //clear addresses
    self.addresses([]);
  } 
  
  
  /////////////////////////
  //BTC-related
  self.signAndBroadcastTx = function(address, unsigned_tx_hex) {
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
    $.jqlog.log("RAW UNSIGNED JSON: " + TX.toBBE(sendTx));
    
    //Sign the output
    var hashType = 1;
    var key = WALLET.getAddressObj(address).KEY;
    //key.compressed = true; //generate compressed public keys
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
    $.jqlog.log("RAW SIGNED JSON: " + TX.toBBE(sendTx));
    $.jqlog.log("RAW SIGNED HEX: " + signed_tx_hex);
    self.sendTX(signed_tx_hex);
  }
  
  self.retrieveBTCBalance = function(address, callback) {
    url = 'http://blockchain.info/q/addressbalance/';
    fetchData(url + address, callback, null, null, {}, true);
  }
  
  self.getUnspentBTCOutputs = function(address, callback) {
    var url = 'http://blockchain.info/unspent?address=' + address;
    fetchData(url, callback, null, null, {}, true);
  }
  
  self.sendTX = function(tx, callback) {
    url = 'http://blockchain.info/pushtx';
    postdata = 'tx=' + tx;
    if (url != null && url != "") {
        fetchData(url, callback, callback, postdata, {}, true);
    }
  }
}

var WALLET = new WalletViewModel();
