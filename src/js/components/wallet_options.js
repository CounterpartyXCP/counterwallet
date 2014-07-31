
function WalletOptionsModalViewModel() {
  var self = this;
  
  self.shown = ko.observable(false);
  self.availableThemes = ko.observableArray([
    {'id': 'ultraLight',   'name': 'Ultra Light',   'styleName': 'smart-style-2'},
    {'id': 'simpleGrey',   'name': 'Simple Grey',   'styleName': 'smart-style-0'},
    {'id': 'darkElegance', 'name': 'Dark Elegance', 'styleName': 'smart-style-1'},
    {'id': 'googleSkin',   'name': 'Google Skin',   'styleName': 'smart-style-3'}
  ]);
  self.availableLangs = ko.observableArray([
    {'id': 'en-us', 'name': 'English'}
    //additional languages in the future
  ]);
  
  //set these properties to null as PREFERENCES is not available until login happens (they will be formally set on login)
  self.autoBTCPayEnabled = ko.observable(null);
  self.selectedTheme = ko.observable(null);
  self.selectedLang = ko.observable(null);
  self.ORIG_PREFERENCES_JSON = null;
  
  //Info table related props
  self.infoTableShown = ko.observable(false);
  self.myIPAddr = ko.observable('');
  self.myCookie = ko.observable('');
  self.myCountry = ko.observable('');

  var pctValidator = {
    required: true,
    isValidPositiveQuantityOrZero: self,
    max: 100
  }
  self.minBTCFeeProvidedPct = ko.observable(FEE_FRACTION_DEFAULT_FILTER).extend(pctValidator);
  self.maxBTCFeeRequiredPct = ko.observable(FEE_FRACTION_DEFAULT_FILTER).extend(pctValidator);
  self.defaultBTCFeeProvidedPct = ko.observable(FEE_FRACTION_PROVIDED_DEFAULT_PCT).extend(pctValidator);
  self.defaultBTCFeeRequiredPct = ko.observable(FEE_FRACTION_REQUIRED_DEFAULT_PCT).extend(pctValidator);

  self.showAdvancedOptions = ko.observable(false);
  self.urlPassword = ko.observable('');
  self.walletUrl = ko.computed(function() {
    if (self.urlPassword().length > 0 && WALLET.BITCOIN_WALLET) {
      return WALLET.BITCOIN_WALLET.getQuickUrl(self.urlPassword());
    }
  });
  
  self.dispMyCookiePresent = ko.computed(function() {
    return self.myCookie() ? 'Present' : 'None';
  }, self);
  
  self.dispCWURLS = ko.computed(function() {
    return cwURLs() ? cwURLs().join(', ') : 'UNKNOWN';
  }, self);

  self.autoBTCPayEnabled.subscribeChanged(function(newVal, prevVal) {
    assert(newVal === true || newVal === false);
    PREFERENCES['auto_btcpay'] = newVal;
  });
  
  self.selectedTheme.subscribeChanged(function(newSelection, prevSelection) {
    newSelection = ko.utils.arrayFirst(self.availableThemes(), function(item) { return newSelection === item.id; });
    prevSelection = (prevSelection
      ? ko.utils.arrayFirst(self.availableThemes(), function(item) { return prevSelection === item.id; }) : self.availableThemes()[0]);
    
    $.jqlog.debug("Changing theme from " + prevSelection['name'] + " to " + newSelection['name']);
    $('body').removeClass(prevSelection['styleName']);
    $('body').addClass(newSelection['styleName']);
    if(PREFERENCES['selected_theme'] != newSelection['id']) {
      PREFERENCES['selected_theme'] = newSelection['id'];
    }
  });

  self.selectedLang.subscribe(function(newSelection) {
    newSelection = (newSelection
      ? ko.utils.arrayFirst(self.availableLangs(), function(item) { return newSelection === item.id; }) : self.availableLangs()[0]);

    $.jqlog.debug("Changing lang to " + newSelection['name']);
    //TODO: Code to change the selected language
    if(PREFERENCES['selected_lang'] != newSelection['id']) {
      PREFERENCES['selected_lang'] = newSelection['id'];
    }
  });
  
  self.show = function(resetForm) {
    document.getElementById('urlPassword').autocomplete = 'off';
    self.urlPassword('');

    if(typeof(resetForm) === 'undefined') resetForm = true;
    self.ORIG_PREFERENCES_JSON = JSON.stringify(PREFERENCES); //store to be able to tell if we need to update prefs on the server

    //display current settings into the options UI
    self.autoBTCPayEnabled(PREFERENCES['auto_btcpay']);
    self.selectedTheme(PREFERENCES['selected_theme']);
    self.selectedLang(PREFERENCES['selected_lang']);
    
    //ghetto ass hack -- select2 will not set itself properly when using the 'optionsValue' option, but it will
    // not fire off events when NOT using this option. wtf... o_O
    $('#themeSelector').select2("val", self.selectedTheme());
    $('#langSelector').select2("val", self.selectedLang());

    self.getReflectedHostInfo();
    
    self.shown(true);
  }  

  self.getReflectedHostInfo = function() {
    failoverAPI("get_reflected_host_info", {}, function(data, endpoint) {
      $.jqlog.debug(data);

      self.myIPAddr(data['ip']);
      self.myCookie(data['cookie']);
      self.myCountry(data['country']);
    });
  }

  self.showInfoTable = function() {
    self.infoTableShown(true);
  }

  self.hide = function() {
    if(self.ORIG_PREFERENCES_JSON != JSON.stringify(PREFERENCES)) { //only update the preferences if they have changed
      WALLET.storePreferences();
    }
    self.shown(false);
  }  
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
