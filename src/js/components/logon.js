function WalletCreationViewModel() {

  var self = this;

  self.shown = ko.observable(false);
  self.generatedPassphrase = ko.observable('');
  self.passphraseSaved = ko.observable(false);
  self.step = ko.observable(1);

  self.quickAccessPassword = ko.observable('');
  self.showQuickAccessFrame = ko.observable(false);

  self.quickAccessUrl = ko.computed(function() {
    if (self.generatedPassphrase().length > 0 && self.quickAccessPassword().length > 0) {
      return CWBitcore.getQuickUrl(self.generatedPassphrase(), self.quickAccessPassword());
    }
  });

  self.show = function() {
    self.step(1);
    self.generatePassphrase();
    self.passphraseSaved(false);
    self.quickAccessPassword('');
    self.showQuickAccessFrame(false);
    self.shown(true);
    setTimeout(function() { selectText('generated') }, 200); //necessary due to fade in effect
  }

  self.hide = function() {
    self.shown(false);
  }

  self.generatePassphrase = function() {
    var m = new Mnemonic(128); //128 bits of entropy (12 word passphrase)

    var words = m.toWords();
    self.generatedPassphrase(words.join(' '));

    //select the generated passphrase text
    selectText('generated');
  }

  self.goToStep2 = function() {
    self.step(2);
  }

  self.showQuickAccessURLGUI = function() {
    self.showQuickAccessFrame(true);
  }

  self.createWallet = function() {
    self.hide();
    bootbox.alert(i18n.t("your_wallet_is_ready"));
    //WALLET.isExplicitlyNew(true);
    //LOGON_VIEW_MODEL.enteredPassphrase(self.generatedPassphrase());
    //LOGON_VIEW_MODEL.openWallet();
  }

}

function LogonViewModel() {
  //JS used when the user is not yet logged on
  var self = this;

  self.enteredPassphrase = ko.observable('');
  self.walletGenProgressVal = ko.observable(0);
  self.passwordDecrypt = ko.observable('');
  self.cryptedPassphraseUsed = ko.observable(CRYPTED_PASSPHRASE ? true : false);
  self.cryptedPassphrase = ko.observable(CRYPTED_PASSPHRASE);

  self.USE_TESTNET = USE_TESTNET;
  self.USE_REGTEST = USE_REGTEST;
  self.IS_DEV = IS_DEV;

  self.sanitizedEnteredPassphrase = ko.computed(function() { //cleans whitespace and gunk off the passphrase
    return $.trim(self.enteredPassphrase().toLowerCase());
  }, self);

  self.walletGenProgressWidth = ko.computed(function() {
    return self.walletGenProgressVal() + '%';
  }, self);

  self.isPassphraseValid = ko.computed(function() {
    var words = self.sanitizedEnteredPassphrase().split(' ');

    if (words.length != 12 && (words.length != 13 || words[0] != 'old')) {
      return false;
    }

    if (words.length == 13) {
      words.shift();
    }

    var valid = true;
    words.forEach(function(word) {
      if (Mnemonic.words.indexOf(word) == -1) {
        valid = false;
      }
    });
    return valid;
  }, self);

  self.decryptEnteredPassphrase = function() {
    if (!self.cryptedPassphraseUsed() || !self.passwordDecrypt() || !self.cryptedPassphrase()) return;
    try {
      var decryptedPassphrase = CWBitcore.decrypt(self.cryptedPassphrase(), self.passwordDecrypt());
      self.enteredPassphrase(decryptedPassphrase);
    } catch (e) {
      $.jqlog.debug('error: ' + e)
    }
  }
  self.cryptedPassphrase.subscribe(self.decryptEnteredPassphrase);
  self.passwordDecrypt.subscribe(self.decryptEnteredPassphrase);

  self.generatePassphrase = function() {

    WALLET_CREATION_MODAL.show();
  }

  self.showSecureKeyboard = function() {
    LOGON_PASSWORD_MODAL.show();
  }

  self.setExtraInfoOpacity = function(opacity) {
    $('#newAccountInfoPane').animate({opacity: opacity}); //fade out the new account pane if visible
    $('#createNewAcctBtnPane').animate({opacity: opacity}); //fade out the new account button pane if visible
    $('#extra-info').animate({opacity: opacity});
    $('#disclaimer').animate({opacity: opacity});
  }

  self.openWallet = function() {
    //Start with a gate check to make sure at least one of the servers is ready and caught up before we try to log in
    multiAPI("is_ready", {}, function(data, endpoint) {
        assert(data['caught_up'], "Invalid is_ready result"); //otherwise we should have gotten a 525 error
        assert(USE_TESTNET == data['testnet'], "USE_TESTNET is " + USE_TESTNET + " from URL-based detection, but the server API disagrees!");
        $.jqlog.log("Backend is ready. Testnet status: " + USE_TESTNET + ". Regtest status: " + USE_REGTEST + "Last message feed index: " + data['last_message_index'] + ". CW last message seq: " + data['cw_last_message_seq']);
        assert(data['last_message_index'] > 0);

        //User is logging in...
        self.walletGenProgressVal(0); //reset so the progress bar hides again...
        self.setExtraInfoOpacity(0);

        //generate the wallet ID from a double SHA256 hash of the passphrase and the network (if testnet)
        var network = USE_TESTNET ? '_testnet' : (USE_REGTEST ? '_regtest' : '');
        var hashBase = CryptoJS.SHA256(self.sanitizedEnteredPassphrase() + network);
        var hash = CryptoJS.SHA256(hashBase).toString(CryptoJS.enc.Base64);
        //var hashBase = self.sanitizedEnteredPassphrase() + (USE_TESTNET ? '_testnet' : '');

        WALLET.identifier(hash);
        $.jqlog.log("My wallet ID: " + WALLET.identifier());

        //Set initial block height (will be updated again on each periodic refresh of BTC account balances)
        WALLET.networkBlockHeight(data['block_height']);

        //Initialize the message feed (polls the server and notifies us of new
        //events, as counterparty processes confirmed blocks and tx in mempool)
        MESSAGE_FEED.init(data['last_message_index'], data['cw_last_message_seq']);
        //^ set the "starting" message_index, under which we will ignore if received on the messages feed

        // set user country
        USER_COUNTRY = data['country'];
        if (restrictedAreas['pages/betting.html'] && restrictedAreas['pages/betting.html'].indexOf(USER_COUNTRY) != -1) {
          BETTING_ENABLE = false;
        }

        // set quote assets
        QUOTE_ASSETS = data['quote_assets']

        QUICK_BUY_ENABLE = data['quick_buy_enable'];

        //Grab preferences
        multiAPINewest("get_preferences", {
          'wallet_id': WALLET.identifier(),
          'network': USE_TESTNET ? 'testnet' : (USE_REGTEST ? 'regtest' : 'mainnet'),
          'for_login': true
        }, 'last_updated', self.onReceivedPreferences);

      },
      function(jqXHR, textStatus, errorThrown, endpoint) {
        var message = describeError(jqXHR, textStatus, errorThrown);
        bootbox.alert(i18n.t("no_counterparty_error", message));
      });
  }


  self.onReceivedPreferences = function(data) {
    $.jqlog.debug('PREFERENCES:');
    $.jqlog.debug(data);

    var mustSavePreferencesToServer = false;

    // check if there is preferences stored in local storage
    var localPref = localStorage.getObject(WALLET.identifier() + '_preferences');

    if (data) { //user stored preferences located successfully
      assert(data && data.hasOwnProperty('preferences'), "Invalid stored preferences");

      PREFERENCES = data['preferences'];
      // check if local storage pref are more recent
      if (localPref && localPref['last_updated'] && localPref['last_updated'] > data['last_updated']) {
        PREFERENCES = localPref['preferences'];
      }
      // restore lost local storage
      if (!localPref) {
        mustSavePreferencesToServer = true;
      }

      //Provide defaults for any missing fields in the stored preferences object
      for (var prop in DEFAULT_PREFERENCES) {
        if (DEFAULT_PREFERENCES.hasOwnProperty(prop)) {
          if (PREFERENCES[prop] === undefined) {
            $.jqlog.info("Providing default for preferences property: " + prop);
            PREFERENCES[prop] = DEFAULT_PREFERENCES[prop];
            mustSavePreferencesToServer = true;
          }
        }
      }

    } else { //could not find user stored preferences
      //No server had the preferences
      $.jqlog.log("Stored preferences NOT found on server(s). Creating new...");
      trackEvent("Login", "NewWallet", USE_TESTNET ? "Testnet" : (USE_REGTEST ? "Regtest" : "Mainnet"));
      WALLET.isNew(true);
      //no stored preferences on any server(s) in the federation, go with the local storage preferences or default...
      if (localPref && localPref['preferences']) {
        PREFERENCES = localPref['preferences'];
      } else {
        PREFERENCES = DEFAULT_PREFERENCES;
      }
      mustSavePreferencesToServer = true;
    }
    PREFERENCES['num_addresses_used'] = Math.min(MAX_ADDRESSES, PREFERENCES['num_addresses_used']);
    PREFERENCES['num_segwit_addresses_used'] = Math.min(MAX_ADDRESSES, PREFERENCES['num_segwit_addresses_used']);

    WALLET_OPTIONS_MODAL.selectedTheme(PREFERENCES['selected_theme']);

    self.displayLicenseIfNecessary(mustSavePreferencesToServer);
  }

  self.displayLicenseIfNecessary = function(mustSavePreferencesToServer) {
    if (!PREFERENCES['has_accepted_license']) {
      LICENSE_MODAL.show(mustSavePreferencesToServer); //User must accept the license before moving on
    } else {
      //Generate the wallet addresses
      self.openWalletPt2(mustSavePreferencesToServer);
    }
  }

  self.openWalletPt2 = function(mustSavePreferencesToServer) {
    //generate the appropriate number of addresses
    WALLET.BITCOIN_WALLET = new CWHierarchicalKey(self.enteredPassphrase());
    WALLET.isOldWallet(WALLET.BITCOIN_WALLET.useOldHierarchicalKey);
    //kick off address generation (we have to take this hacky approach of using setTimeout, otherwise the
    // progress bar does not update correctly through the HD wallet build process....)
    setTimeout(function() { self.genAddress(mustSavePreferencesToServer, PREFERENCES['num_addresses_used']) }, 1);
  }

  self.genAddress = function(mustSavePreferencesToServer, addressCount) {

    var moreAddresses = [];

    for (var i = 0; i < addressCount; i++) {

      var address = WALLET.addAddress('normal');
      var addressHash = hashToB64(address);
      var len = WALLET.addresses().length;
      moreAddresses.push(address);

      if (PREFERENCES.address_aliases[addressHash] === undefined) { //no existing label. we need to set one
        mustSavePreferencesToServer = true; //if not already true
        PREFERENCES.address_aliases[addressHash] = i18n.t("default_address_label", len);
      }

      $.jqlog.info("Address discovery: Generating address " + len + " of " + PREFERENCES['num_addresses_used']
        + " (num_addresses_used) (" + self.walletGenProgressVal() + "%) -- " + address);

      if (len <= PREFERENCES['num_addresses_used']) { //for visual effect
        var progress = len * (100 / PREFERENCES['num_addresses_used']);
        self.walletGenProgressVal(progress);
      }

    }

    WALLET.refreshBTCBalances(false, moreAddresses, function() {

      var generateAnotherAddress = false;
      var totalAddresses = WALLET.addresses().length;
      var lastAddressWithMovement = WALLET.addresses()[totalAddresses - 1].withMovement();

      if (lastAddressWithMovement) {
        generateAnotherAddress = true;
      } else if (totalAddresses > PREFERENCES['num_addresses_used'] && !lastAddressWithMovement && WALLET.addresses.length > 1) {
        WALLET.addresses.pop();
      }

      if (generateAnotherAddress) {

        $.jqlog.info("Address discovery: Generating another address...");
        setTimeout(function() { self.genAddress(mustSavePreferencesToServer, 1) }, 1);

      } else {
        $.jqlog.info("Address discovery: Done with standard addresses...");

        if (PREFERENCES['num_addresses_used'] != WALLET.addresses().length) {
          PREFERENCES['num_addresses_used'] = WALLET.addresses().length;
          mustSavePreferencesToServer = true;
        }
        return self.genSegwitAddress(mustSavePreferencesToServer, PREFERENCES['num_segwit_addresses_used']);

      }
    });
  }

  self.genSegwitAddress = function(mustSavePreferencesToServer, addressCount) {
    if (!WALLET.isSegwitEnabled) {
      return self.openWalletPt3(mustSavePreferencesToServer);
    }

    var moreAddresses = [];
    $.jqlog.info("Address discovery: Generating " + addressCount + " segwit addresses...");

    for (var i = 0; i < addressCount; i++) {

      var address = WALLET.addAddress('segwit');
      var addressHash = hashToB64(address);
      var len = WALLET.addresses().length;
      moreAddresses.push(address);

      if (PREFERENCES.address_aliases[addressHash] === undefined) { //no existing label. we need to set one
        mustSavePreferencesToServer = true; //if not already true
        PREFERENCES.address_aliases[addressHash] = i18n.t("default_address_label", len);
      }

      $.jqlog.info("Address discovery: Generating segwit address " + (len - PREFERENCES['num_addresses_used']) + " of " + PREFERENCES['num_segwit_addresses_used']
        + " (num_segwit_addresses_used) (" + self.walletGenProgressVal() + "%) -- " + address);

      if (len <= PREFERENCES['num_segwit_addresses_used']) { //for visual effect
        var progress = len * (100 / PREFERENCES['num_segwit_addresses_used']);
        self.walletGenProgressVal(progress);
      }

    }

    if (moreAddresses.length > 0) {
      WALLET.refreshBTCBalances(false, moreAddresses, function() {

        var generateAnotherAddress = false;
        var totalAddresses = WALLET.addresses().length;
        var lastAddressWithMovement = WALLET.addresses()[totalAddresses - 1].withMovement();

        if (lastAddressWithMovement) {
          generateAnotherAddress = true;
        } else if ((totalAddresses - PREFERENCES['num_addresses_used']) >= PREFERENCES['num_segwit_addresses_used'] && !lastAddressWithMovement) {
          if (WALLET.addresses.length > 1) {
            WALLET.addresses.pop();
          }
          generateAnotherAddress = false;
        }

        if (generateAnotherAddress) {

          $.jqlog.info("Address discovery: Generating another segwit address...");
          setTimeout(function() { self.genSegwitAddress(mustSavePreferencesToServer, 1) }, 1);

        } else {
          $.jqlog.info("Address discovery: Done with segwit addresses...");

          if (PREFERENCES['num_segwit_addresses_used'] != (WALLET.addresses().length - PREFERENCES['num_addresses_used'])) {
            PREFERENCES['num_segwit_addresses_used'] = (WALLET.addresses().length - PREFERENCES['num_addresses_used']);
            mustSavePreferencesToServer = true;
          }
          return self.openWalletPt3(mustSavePreferencesToServer);

        }
      });
    } else {
      return self.openWalletPt3(mustSavePreferencesToServer);
    }
  }

  self.updateBalances = function(additionalBTCAddresses, onSuccess) {
    //updates all balances for all addesses, creating the asset objects on the address if need be
    WALLET.refreshBTCBalances(true, additionalBTCAddresses, function() {
      //^ specify true here to start a recurring get BTC balances timer chain
      WALLET.refreshCounterpartyBalances(WALLET.getAddressesList(), onSuccess);
    });
  }

  self.openWalletPt3 = function(mustSavePreferencesToServer) {
    //add in the armory and watch only addresses
    var additionalBTCAddresses = [], i = null;
    for (i in PREFERENCES['armory_offline_addresses']) {
      try {
        WALLET.addAddress('armory',
          PREFERENCES['armory_offline_addresses'][i]['address'],
          PREFERENCES['armory_offline_addresses'][i]['pubkey_hex']);
        additionalBTCAddresses.push(PREFERENCES['armory_offline_addresses'][i]['address']);
      } catch (e) {
        $.jqlog.error("Could not generate armory address: " + e);
      }
    }
    for (i in PREFERENCES['watch_only_addresses']) {
      try {
        WALLET.addAddress('watch', PREFERENCES['watch_only_addresses'][i]);
        additionalBTCAddresses.push(PREFERENCES['watch_only_addresses'][i]);
      } catch (e) {
        $.jqlog.error("Could not generate watch only address: " + e);
      }
    }
    for (i in PREFERENCES['multisig_addresses']) {
      try {
        WALLET.addAddress('multisig',
          PREFERENCES['multisig_addresses'][i]['address'],
          PREFERENCES['multisig_addresses'][i]['pubkeys_hex']);
        additionalBTCAddresses.push(PREFERENCES['multisig_addresses'][i]['address']);
      } catch (e) {
        $.jqlog.error("Could not generate multisig only address: " + e);
      }
    }

    //store the preferences on the server(s) for future use
    if (mustSavePreferencesToServer) {
      $.jqlog.info("Preferences updated/generated during login. Updating on server(s)...");
      WALLET.storePreferences(null, true);
    }

    //Update the wallet balances (isAtLogon = true)
    self.updateBalances(additionalBTCAddresses, self.openWalletPt4);
  }

  self.openWalletPt4 = function() {
    /* hide the login div and show the other divs */
    $('#logon').hide();
    $('#header').show();
    $('#left-panel').show();
    $('#main').show();

    PENDING_ACTION_FEED.restoreFromLocalStorage(function() {});
    MESSAGE_FEED.restoreOrder();

    //record some metrics...
    trackEvent("Login", "Wallet", "Size", PREFERENCES['num_addresses_used'] + PREFERENCES['num_segwit_addresses_used']);
    trackEvent("Login", "Network", USE_TESTNET ? "Testnet" : (USE_REGTEST ? "Regtest" : "Mainnet"));
    trackEvent("Login", "Country", USER_COUNTRY || 'UNKNOWN');
    trackEvent("Login", "Language", PREFERENCES['selected_lang']);
    trackEvent("Login", "Theme", PREFERENCES['selected_theme']);

    //all done. load the balances screen
    $.jqlog.debug("Login complete. Directing to balances page...");
    window.location.hash = 'pages/balances.html';
  }
}


function LicenseModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);

  self.show = function() {
    self.shown(true);

    //Load in the license file text into the textarea
    $("#licenseAgreementText").val(i18n.t('license'));
  }

  self.hide = function() {
    self.shown(false);
  }

  self.rejectTerms = function() {
    self.hide();
    LOGON_VIEW_MODEL.setExtraInfoOpacity(100);
  }

  self.acceptTerms = function() {
    //Continue on to generate the wallet addresses
    PREFERENCES['has_accepted_license'] = true;
    self.shown(false);
    LOGON_VIEW_MODEL.openWalletPt2(true); //save the prefs to the server as we updated them
  }
}


ko.validation.rules['isValidPassphrasePart'] = {
  validator: function(val, self) {
    return Mnemonic.words.indexOf(val) != -1;
  },
  message: 'Invalid phrase word.'
};
ko.validation.registerExtenders();
function LogonPasswordModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.pwPart01 = ko.observable().extend({required: true, isValidPassphrasePart: self});
  self.pwPart02 = ko.observable().extend({required: true, isValidPassphrasePart: self});
  self.pwPart03 = ko.observable().extend({required: true, isValidPassphrasePart: self});
  self.pwPart04 = ko.observable().extend({required: true, isValidPassphrasePart: self});
  self.pwPart05 = ko.observable().extend({required: true, isValidPassphrasePart: self});
  self.pwPart06 = ko.observable().extend({required: true, isValidPassphrasePart: self});
  self.pwPart07 = ko.observable().extend({required: true, isValidPassphrasePart: self});
  self.pwPart08 = ko.observable().extend({required: true, isValidPassphrasePart: self});
  self.pwPart09 = ko.observable().extend({required: true, isValidPassphrasePart: self});
  self.pwPart10 = ko.observable().extend({required: true, isValidPassphrasePart: self});
  self.pwPart11 = ko.observable().extend({required: true, isValidPassphrasePart: self});
  self.pwPart12 = ko.observable().extend({required: true, isValidPassphrasePart: self});

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
    if (typeof(resetForm) === 'undefined') resetForm = true;
    if (resetForm) self.resetForm();

    //TODO: choose a random X/Y coords for the modal

    $('#logonPassphaseModal input').click(function(e) {
      $(e.currentTarget).val(''); //clear the field on click
    });

    //Set up keyboard
    $('#logonPassphaseModal input').keyboard({
      display: {
        'bksp': "\u2190",
        'accept': i18n.t('accept')
      },
      layout: 'custom',
      customLayout: {
        'default': [
          'q w e r t y u i o p {bksp}',
          'a s d f g h j k l',
          ' z x c v b n m {accept}'
        ]
      },
      autoAccept: true,
      usePreview: true,
      initialFocus: false,
      restrictInput: true,
      preventPaste: true
      /*acceptValue: true,
      validate: function(keyboard, value, isClosing) {
        return Mnemonic.words.indexOf(value)!=-1;
      }*/
    }).autocomplete({
      source: Mnemonic.words
    }).addAutocomplete();

    // Overrides the default autocomplete filter function to search only from the beginning of the string
    $.ui.autocomplete.filter = function(array, term) {
      var matcher = new RegExp("^" + $.ui.autocomplete.escapeRegex(term), "i");
      return $.grep(array, function(value) {
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
    $('#password').change();
    self.resetForm(); //clear out the dialog too, for security
    self.shown(false);
    LOGON_VIEW_MODEL.openWallet();
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
