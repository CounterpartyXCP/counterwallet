
function WalletViewModel() {
  //The user's wallet
  var self = this;
  self.DEFAULT_NUMADDRESSES = 5; //default number of addresses to generate
  
  self.id = null; //set when logging in
  self.addresses = ko.observableArray(); //Address objects (pane_balances) -- populated at login
  
  self.addKey = function(key, defaultLabel) {
    //adds a key to the wallet, making a new address object on the wallet in the process
    //(assets must still be added to this address, with updateBalances() or other means...)
    
    //derive the address from the key
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
        for(var i=0;i<response.length;i++) {
          self.updateBalance(response[i]['address'], response[i]['asset'], response[i]['balance']);  
        }
      }
    );
  }
  
  /////////////////////////
  //BTC-related
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

$(document).ready(function() {
  $.jqlog.enabled(true);
  ko.applyBindings(WALLET, document.getElementById("balancesContainer"));
});

