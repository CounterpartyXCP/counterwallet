var WALLET = new function ()
{
  this.addresses = {};
  this.id = null; //set when logging in
  this.DEFAULT_NUMADDRESSES = 5; //default number of addresses to generate
  //dict of string bitcoin addresses that map to dicts, with each dict having the following fields:
  //  label
  //  key : the ECKeyObj (eckey.js)
  //  balances: a dict in the format of {assetID: balance, assetID2: balance2}
  
  // Methods
  this.textToBytes = function(text) {
    return Crypto.SHA256(text, { asBytes: true });
  };
  
  this.getAddresses = function() {
    var addresses = [];
    for(var a in this.addresses) {
      addresses.push(a);
    }
    return addresses;
  }
  
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

  this.updateBalances = function(balance_callback) {
     //updates all balances and labels for all addesses.
     // balance_callback is passed args (address, asset, newbalance), and called after each balance is updated
    var addrs = this.getAddresses();

    for (var i=0; i<addrs.length; i++) {
      //update all BTC balances
      BLOCKCHAIN.retrieveBTCBalance(addrs[i], function(data) {
         this.addresses[addrs[i]]['balances']['BTC'] = parseInt(data);
         balance_callback(addrs[i], 'BTC', this.addresses[addrs[i]]['balances']['BTC'])
      });
    }
      
    //update all counterparty XCP/asset balances
    var filters = [];
    for (var i=0; i<addrs.length; i++) {
      filters.push({'field': 'address', 'op': '==', 'value': addrs[i]});
    }
    makeJSONAPICall("counterpartyd", "get_balances", {"filters": filters, "filterop": "or"},
      function(response) {
        balance_callback(response['result']['address'], response['result']['asset'], response['result']['amount']);
      });
  }
  
}
