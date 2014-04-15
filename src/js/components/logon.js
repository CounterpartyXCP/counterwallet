
function LogonViewModel() {
  //JS used when the user is not yet logged on
  var self = this;

  self.enteredPassphrase = ko.observable('');
  self.generatedPassphrase = ko.observable('');
  self.walletGenProgressVal = ko.observable(0);
  
  self.USE_TESTNET = USE_TESTNET;
  self.IS_DEV = IS_DEV;

  self.sanitizedEnteredPassphrase = ko.computed(function(){ //cleans whitespace and gunk off the passphrase
    return $.trim(self.enteredPassphrase().toLowerCase());
  }, self);

  self.walletGenProgressWidth = ko.computed(function(){
    return self.walletGenProgressVal() + '%';
  }, self);

  self.isPassphraseValid = ko.computed(function() {
     if(self.sanitizedEnteredPassphrase().split(' ').length != 12) return false;
     
     var valid = true;
     self.sanitizedEnteredPassphrase().split(' ').forEach(function (word) {
       if (mn_words.indexOf(word) == -1) {
         valid = false;
       }
     });
     return valid;
  }, self);
  
  self.generatePassphrase = function() {
    //Generate (or regenerate) a random, new passphrase
    var pk = randomGetBytes(32);
    var seed = null;
    try { //Eh, this is hackish...
      seed = pk.subarray(0,16);
      var convSeed = Array(16);
      for(var i=0; i < seed.length; i++) { convSeed[i] = seed[i]; }
      seed = Bitcoin.convert.bytesToHex(convSeed);
    } catch(err) {
      seed = Bitcoin.convert.bytesToHex(pk.slice(0,16));  
    }

    // Original node:
    // "nb! electrum doesn't handle leading zeros very well
    // and we want to stay compatible."
    // 
    // (Counterwallet addendum: this probably doesn't
    // apply to BIP0032 wallets, but I'll leave it in here for
    // now until an audit clears it to be removed)
    if (seed.charAt(0) == '0') seed = seed.substr(1);

    self.generatedPassphrase(mn_encode(seed));
    
    //select the generated passphrase text
    selectText('generated');
  }
  
  self.showSecureKeyboard = function() {
    LOGON_PASSWORD_MODAL.show(); 
  }
  
  self.openWallet = function() {
    //Start with a gate check to make sure at least one of the servers is ready and caught up before we try to log in
    multiAPI("is_ready", [], function(data, endpoint) {
      assert(data['caught_up'], "Invalid is_ready result"); //otherwise we should have gotten a 525 error
      assert(USE_TESTNET == data['testnet'], "USE_TESTNET is " + USE_TESTNET + " from URL-based detection, but the server API disagrees!");
      
      $.jqlog.log("Backend is ready. Testnet status: " + USE_TESTNET + ". Last message feed index: " + data['last_message_index']);
      assert(data['last_message_index'] > 0);

      //User is logging in...
      self.walletGenProgressVal(0); //reset so the progress bar hides again...
      $('#newAccountInfoPane').animate({opacity:0}); //fade out the new account pane if visible
      $('#createNewAcctBtnPane').animate({opacity:0}); //fade out the new account button pane if visible
      $('#extra-info').animate({opacity:0});
      
      //generate the wallet ID from a double SHA256 hash of the passphrase and the network (if testnet)
      //var hash1 = Bitcoin.Crypto.SHA256(self.sanitizedEnteredPassphrase() + (USE_TESTNET ? '_testnet' : ''));
      //var hash2 = Bitcoin.Crypto.SHA256(hash1).toString(Bitcoin.Crypto.enc.Base64);
      //WALLET.identifier(hash2);
      var ident;
      ident = self.sanitizedEnteredPassphrase() + (USE_TESTNET ? '_testnet' : '');
      ident = Bitcoin.Crypto.SHA256(ident).toString();
      ident = Bitcoin.Crypto.SHA256(ident).toString();
      ident = Bitcoin.convert.stringToBytes(ident);
      ident = Bitcoin.convert.bytesToBase64(ident);
      WALLET.identifier(ident);

      $.jqlog.log("My wallet ID: " + WALLET.identifier());

      //Set initial block height (will be updated again on each periodic refresh of BTC account balances)
      WALLET.networkBlockHeight(data['block_height']);
      
      //Initialize the socket.io-driven event feed (notifies us in realtime of new events, as counterparty processes confirmed blocks)
      MESSAGE_FEED.init(data['last_message_index']);
      //^ set the "starting" message_index, under which we will ignore if received on the messages feed
      
      //Initialize chat feeds (even through the chat pane will remain closed by default and the user has not started chatting)
      CHAT_FEED.init();
      
      //Grab preferences
      multiAPINewest("get_preferences", [WALLET.identifier()], 'last_updated', function(data) {
        var mustSavePreferencesToServer = false;
        
        if(data) { //user stored preferences located successfully
          assert(data && data.hasOwnProperty('preferences'), "Invalid stored preferences");
          PREFERENCES = data['preferences'];
          
          //Provide defaults for any missing fields in the stored preferences object
          for(var prop in DEFAULT_PREFERENCES) {
            if(DEFAULT_PREFERENCES.hasOwnProperty(prop)) {
              if(PREFERENCES[prop] === undefined) {
                $.jqlog.info("Providing default for preferences property: " + prop);
                PREFERENCES[prop] = DEFAULT_PREFERENCES[prop];
                mustSavePreferencesToServer = true;
              }
            }
          }
        } else { //could not find user stored preferences
          //No server had the preferences
          $.jqlog.log("Stored preferences NOT found on server(s). Creating new...");
          WALLET.isNew(true);
          
          //no stored preferences on any server(s) in the federation, go with the default...
          PREFERENCES = DEFAULT_PREFERENCES;
          mustSavePreferencesToServer = true;
        }
        
        WALLET_OPTIONS_MODAL.selectedTheme(PREFERENCES['selected_theme']);
        WALLET_OPTIONS_MODAL.selectedLang(PREFERENCES['selected_lang']);
        
        self.openWalletPt2(mustSavePreferencesToServer);
      });
    },
    function(jqXHR, textStatus, errorThrown, endpoint) {
      var message = describeError(jqXHR, textStatus, errorThrown);
      bootbox.alert("No counterparty servers are currently available. Please try again later. ERROR: " + message);
    });
  }
  
  self.openWalletPt2 = function(mustSavePreferencesToServer) {
      //generate the appropriate number of addresses
      var seed = mn_decode(self.sanitizedEnteredPassphrase());
      var options = {
        network: USE_TESTNET ? "testnet" : "mainnet",
        derivationMethod: 'private'
      }
      
      WALLET.BITCOIN_WALLET = Bitcoin.Wallet(seed, options);

      //kick off address generation (we have to take this hacky approach of using setTimeout, otherwise the
      // progress bar does not update correctly through the HD wallet build process....)
      setTimeout(function() { self.genAddress(mustSavePreferencesToServer) }, 1);
  }
  
  self.genAddress = function(mustSavePreferencesToServer) {
    
    var address = WALLET.BITCOIN_WALLET.generateAddress();
    var i = WALLET.BITCOIN_WALLET.addresses.length - 1;
    var privkey = WALLET.BITCOIN_WALLET.getPrivateKey(i);
    var addressHash = hashToB64(address);

    if(PREFERENCES.address_aliases[addressHash] === undefined) { //no existing label. we need to set one
      mustSavePreferencesToServer = true; //if not already true
      PREFERENCES.address_aliases[addressHash] = "My Address #" + (WALLET.addresses().length + 1).toString();
    }
    WALLET.addAddress(privkey);

    var progress = (i + 1) * (100 / PREFERENCES['num_addresses_used']);
    self.walletGenProgressVal(progress);
    $.jqlog.debug("Progress: Address " + (i + 1) + " of " + PREFERENCES['num_addresses_used']
      + " (" + self.walletGenProgressVal() + "%) -- " + address);

    if(i + 1 < PREFERENCES['num_addresses_used']) {
      setTimeout(function() { self.genAddress(mustSavePreferencesToServer) }, 1);
    } else {
      return self.openWalletPt3(mustSavePreferencesToServer);
    }
  }
  
  self.updateBalances = function(onSuccess) {
    //updates all balances for all addesses, creating the asset objects on the address if need be
    WALLET.refreshBTCBalances(true);
    //^ specify true here to start a recurring get BTC balances timer chain 

    WALLET.refreshCounterpartyBalances(WALLET.getAddressesList(), onSuccess);
  }
  
  self.openWalletPt3 = function(mustSavePreferencesToServer) {
    var i = null;
    
    //add in the watch only addresses
    if(PREFERENCES['watch_only_addresses'] === undefined) {
      PREFERENCES['watch_only_addresses'] = [];
      mustSavePreferencesToServer = true;
    }
    for(i=0; i < PREFERENCES['watch_only_addresses'].length; i++) {
      WALLET.addWatchOnlyAddress(PREFERENCES['watch_only_addresses'][i]);
    }
    
    /* hide the login div and show the other divs */
    $('#logon').hide();
    $('#header').show();
    $('#left-panel').show();
    $('#main').show();
    
    //store the preferences on the server(s) for future use
    if(mustSavePreferencesToServer) {
      $.jqlog.info("Preferences updated/generated during login. Updating on server(s)...");
      multiAPI("store_preferences", [WALLET.identifier(), PREFERENCES]);
    }
    
    //Update the wallet balances (isAtLogon = true)
    self.updateBalances(self.openWalletPt4);
  }
    
  self.openWalletPt4 = function() {
    PENDING_ACTION_FEED.restoreFromLocalStorage(function() {
      //load the waiting btc feed after the pending action feed is all done loading, as we look at the pending action
      // feed to determine whether a btcpay process is in progress (pending) or not
      WAITING_BTCPAY_FEED.restore();   
    });
    OPEN_ORDER_FEED.restore();
    

    //all done. load the balances screen
    $.jqlog.debug("Login complete. Directing to balances page...");
    window.location.hash = 'pages/balances.html';
  }  
}

ko.validation.rules['isValidPassphrasePart'] = {
    validator: function (val, self) {
      return mn_words.contains(val);
    },
    message: 'Invalid phrase word.'
};
ko.validation.registerExtenders();

function LogonPasswordModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.pwPart01 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart02 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart03 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart04 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart05 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart06 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart07 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart08 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart09 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart10 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart11 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart12 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  
  self.validationModel = ko.validatedObservable({
    pwPart01: self.pwPart01,
    pwPart02: self.pwPart02,
    pwPart03: self.pwPart03,
    pwPart04: self.pwPart04,
    pwPart05: self.pwPart05,
    pwPart06: self.pwPart06,
    pwPart07: self.pwPart07,
    pwPart08: self.pwPart08,
    pwPart09: self.pwPart09,
    pwPart10: self.pwPart10,
    pwPart11: self.pwPart11,
    pwPart12: self.pwPart12
  });
  
  self.dispFullPassphrase = ko.computed(function() {
    return [
      self.pwPart01(), self.pwPart02(), self.pwPart03(), self.pwPart04(),
      self.pwPart05(), self.pwPart06(), self.pwPart07(), self.pwPart08(),
      self.pwPart09(), self.pwPart10(), self.pwPart11(), self.pwPart12()
    ].join(' ');
  }, self);
  
  self.resetForm = function() {
    self.pwPart01('');
    self.pwPart02('');
    self.pwPart03('');
    self.pwPart04('');
    self.pwPart05('');
    self.pwPart06('');
    self.pwPart07('');
    self.pwPart08('');
    self.pwPart09('');
    self.pwPart10('');
    self.pwPart11('');
    self.pwPart12('');
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    //data entry is valid...submit to trigger doAction()
    $('#logonPassphaseModal form').submit();
  }
  
  self.show = function(resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    
    //TODO: choose a random X/Y coords for the modal
    
    $('#logonPassphaseModal input').click(function(e) {
      $(e.currentTarget).val(''); //clear the field on click
    });
    
    //Set up keyboard
    $('#logonPassphaseModal input').keyboard({
      display: {
        'bksp'   :  "\u2190",
        'accept' : 'Accept',
      },
      layout: 'custom',
      customLayout: {
        'default': [
          'q w e r t y u i o p {bksp}',
          'a s d f g h j k l',
          ' z x c v b n m {accept}'
        ],
      },
      autoAccept: true,
      usePreview: true,
      initialFocus : false,
      restrictInput: true,
      preventPaste: true
      /*acceptValue: true,
      validate: function(keyboard, value, isClosing) {
        return mn_words.contains(value);
      }*/
    }).autocomplete({
      source: mn_words
    }).addAutocomplete();
    
    // Overrides the default autocomplete filter function to search only from the beginning of the string
    $.ui.autocomplete.filter = function (array, term) {
        var matcher = new RegExp("^" + $.ui.autocomplete.escapeRegex(term), "i");
        return $.grep(array, function (value) {
            return matcher.test(value.label || value.value || value);
        });
    };    
    
    self.shown(true);
  }  

  self.hide = function() {
    self.shown(false);
  }
  
  self.doAction = function() {
    //simply fill in the data back into the passphrase field and close the dialog
    $('#password').val(self.dispFullPassphrase());
    self.resetForm(); //clear out the dialog too, for security
    self.shown(false);
    $('#walletLogin').click();
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
