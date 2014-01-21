var WALLET = new function ()
{
  this.addresses = {};
  this.NUMADDRESSES = 10; //number of addresses to generate
  //dict of string bitcoin addresses that map to dicts, with each dict having the following fields:
  //  label
  //  key : the ECKeyObj (eckey.js)
  //  balances: a dict in the format of {assetID: balance, assetID2: balance2}
  
  // Methods
  this.textToBytes = function(text) {
    return Crypto.SHA256(text, { asBytes: true });
  };
  
  this.addKey = function(key, label) {
    var address = key.getBitcoinAddress().toString();
    if(typeof(label)==='undefined') label = '';
    if(address in this.addresses)
       return false; //already exists
    this.addresses[address] = {"label": label, "key": key};
    return address;
  }

  this.getKey = function(address) {
    if(!(address in this.addresses))
       return null;
    return this.addresses[address]['key'];
  };

  this.getLabel = function(address) {
    if(!(address in this.addresses))
       return null;
    return this.addresses[address]['label'];
  };
  
  this.getBalance = function(address, asset) {
    if(!(address in this.addresses))
       return false;
    if(typeof(label)==='undefined') { //get balance for all assets
       return this.addresses[address]['balances']
    } else { //get balance for a specific asset
      if(!(asset in this.addresses[address]['balances']))
         return false;
      return this.addresses[address]['balances'][asset]
    }
  }

  this.setLabel = function(address, label) {
    if(!(address in this.addresses))
       return false;
    this.addresses[address]['label'] = label;
  }
  
  this.updateBalances = function(address) {
     //update balance for BTC
     BLOCKCHAIN.retrieveBTCBalance(this.addresses[address], function(data) {
       this.addresses[address]['balances']['BTC'] = parseInt(data);
     });
     
     //update balance for each asset
     
  }

  this.updateAll = function() {
    for(var a in this.addresses) {
      //update all balances
      this.updateBalances(a);

      //update all labels
      var url = 'http://blockchain.info/unspent?address=' + address;
      fetchData(url, callback);
      
      
    }
  }
  
}
