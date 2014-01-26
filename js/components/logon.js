//JS used when the user is not yet logged on
function LogonViewModel() {
  var self = this;

  self.enteredPassphrase = ko.observable('');
  self.generatedPassphrase = ko.observable('');
  self.walletGenProgressVal = ko.observable(0);

  self.walletGenProgressWidth = ko.computed(function(){
    return self.walletGenProgressVal() + '%';
  }, self);

  self.isPassphraseValid = ko.computed(function() {
    return self.enteredPassphrase().split(' ').length == 12;
  }, self);
  
  self.generatePassphrase = function() {
    //Generate (or regenerate) a random, new passphrase
    var pk = new Array(32);
    rng_get_bytes(pk);
    var seed = Crypto.util.bytesToHex(pk.slice(0,16));
    //nb! electrum doesn't handle trailing zeros very well
    // and we want to stay compatible.
    if (seed.charAt(0) == '0') seed = seed.substr(1);
    self.generatedPassphrase(mn_encode(seed));
  }
  
  self.openWallet = function() {
    //User is logging in...
    self.walletGenProgressVal(0); //reset so the progress bar hides again...
    
    //Initialize the socket.io data feed
    initDataFeed();
    
    //generate the wallet ID from the seed
    WALLET.id = Crypto.util.bytesToBase64(Crypto.SHA256(Crypto.SHA256(self.enteredPassphrase(),
      {asBytes: true}), {asBytes: true}));
    $.jqlog.log("Wallet ID: " + WALLET.id);
  
    //Grab preferences
    makeJSONAPICall("counterwalletd", "get_preferences", [WALLET.id], function(prefs) {
      if($.isEmptyObject(prefs)) {
        //no stored preferences, go with the default
        prefs = {
          'num_addresses_used': WALLET.DEFAULT_NUMADDRESSES,
          'address_aliases': {}
        };
  
        //store the preferences on the server for future use
        makeJSONAPICall("counterwalletd", "store_preferences", [WALLET.id, prefs]);
      }
      PREFERENCES = prefs;
      
      //generate the appropriate number of addresses
      var seed = mn_decode(self.enteredPassphrase());
      Electrum.init(seed, function(r) {
          if(r % 20 == 0)
            self.walletGenProgressVal(r + 19);
        },
        function(privKey) {
          Electrum.gen(PREFERENCES.num_addresses_used, function(r) { 
            WALLET.addKey(
              new Bitcoin.ECKey(r[1]),
              "My Address #" + (WALLET.addresses().length + 1).toString()
            );
            
            //$.jqlog.log("WALLET.addresses().length: " + WALLET.addresses().length);
            //$.jqlog.log("PREFERENCES.num_addresses_used: " + PREFERENCES.num_addresses_used);
            if(WALLET.addresses().length == PREFERENCES.num_addresses_used) {
              $('#logon').hide();
              $('#site').show();
              WALLET.updateBalances(); //Update the wallet balances
              return;
            }
          });
        }
      );
    });
  }
}

LOGON_VIEW_MODEL = new LogonViewModel();

$(document).ready(function() {
  $.jqlog.enabled(true);
  ko.applyBindings(LOGON_VIEW_MODEL, document.getElementById("logon"));
});
