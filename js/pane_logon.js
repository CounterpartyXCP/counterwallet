//JS used when the user is not yet logged on

function init_pane_logon() {
  //Called during document.ready
  $('#password').keyup(checkValidPassword);
  $('#generate-password').click(generatePassword);
  $('#regenerate-password').click(regeneratePassword);
  $('#regenerate-password').tooltip();
  $('#open-sesame').click();
}

function openSesame() {
  //Handler for "Open Wallet" button
  var seed = $('#password').val();
  
  //generate the wallet ID from the seed
  WALLET.id = Crypto.util.bytesToBase64(Crypto.SHA256(Crypto.SHA256(seed, {asBytes: true}), {asBytes: true}));
  $.jqlog.log("Wallet ID: ", WALLET.id);

  //Grab preferences
  makeJSONAPICall("counterwalletd", "get_preferences", [WALLET.id], function(prefs) {
    if(!prefs) {
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
    seed = mn_decode(seed);
    Electrum.init(seed, function(r) {
        if(r % 20 == 0)
          $('#seed-progress').css('width', (r + 19) + '%'); 
      },
      function(privKey) {
        Electrum.gen(PREFERENCES.num_addresses_used, function(r) { 
          WALLET.addKey(new Bitcoin.ECKey(r[1])); //blank label for now (we'll get it from the server) 
          if(WALLET.getAddresses().length == PREFERENCES.num_addresses_used)
            login_success(); //in counterwallet.js
        });
      }
    );
  });
  return true;
}

function regeneratePassword() {
  $('#generated').val('');
  return generatePassword();
}

function generatePassword() {
  $('#pre-create-wallet').hide();
  $('#create-wallet').show();    

  $('#generated').focus();
  
  if($('#generated').val() != '')
    return true;

  var pk = new Array(32);
  rng_get_bytes(pk);
  var seed = Crypto.util.bytesToHex(pk.slice(0,16));
  //nb! electrum doesn't handle trailing zeros very well
  // and we want to stay compatible.
  if (seed.charAt(0) == '0') seed = seed.substr(1);
  var codes = mn_encode(seed);
  $('#generated').val(codes);
  
  return true;
}

function checkValidPassword(){
  var password = $('#password').val();
  var valid = true;
  
  if(password.split(' ').length != 12)
    valid = false;
    
  if(valid)
  {
    $('#open-sesame').addClass('btn-primary');
    $('#open-sesame').removeAttr('disabled');
  }
  else
  {
    $('#open-sesame').removeClass('btn-primary');
    $('#open-sesame').attr('disabled', 'disabled');
  }
}
