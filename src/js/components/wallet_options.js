
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
  self.autoPrimeEnabled = ko.observable(true); //enabled by default
  self.autoBTCPayEnabled = ko.observable(true); //enabled by default
  self.selectedTheme = ko.observable(self.availableThemes()[0]['id']);
  self.selectedLang = ko.observable(self.availableLangs()[0]['id']);
  self.ORIG_PREFERENCES = null;

  self.autoPrimeEnabled.subscribeChanged(function(newVal, prevVal) {
    assert(newVal === true || newVal === false);
    PREFERENCES['auto_prime'] = newVal;
  });

  self.autoBTCPayEnabled.subscribeChanged(function(newVal, prevVal) {
    assert(newVal === true || newVal === false);
    PREFERENCES['auto_btcpay'] = newVal;
  });
  
  self.selectedTheme.subscribeChanged(function(newSelection, prevSelection) {
    newSelection = ko.utils.arrayFirst(self.availableThemes(), function(item) { return newSelection === item.id; });
    prevSelection = (prevSelection
      ? ko.utils.arrayFirst(self.availableThemes(), function(item) { return prevSelection === item.id; }) : self.availableThemes()[0]);
    
    $.jqlog.log("Changing theme from " + prevSelection['name'] + " to " + newSelection['name']);
    $('body').removeClass(prevSelection['styleName']);
    $('body').addClass(newSelection['styleName']);
    if(PREFERENCES['selected_theme'] != newSelection['id']) {
      PREFERENCES['selected_theme'] = newSelection['id'];
    }
  });

  self.selectedLang.subscribe(function(newSelection) {
    newSelection = (newSelection
      ? ko.utils.arrayFirst(self.availableLangs(), function(item) { return newSelection === item.id; }) : self.availableLangs()[0]);

    $.jqlog.log("Changing lang to " + newSelection['name']);
    //TODO: Code to change the selected language
    if(PREFERENCES['selected_lang'] != newSelection['id']) {
      PREFERENCES['selected_lang'] = newSelection['id'];
    }
  });
  
  self.show = function(resetForm) {
    if(typeof(resetForm) === 'undefined') resetForm = true;
    self.ORIG_PREFERENCES = JSON.stringify(PREFERENCES);
    
    //ghetto ass hack -- select2 will not set itself properly when using the 'optionsValue' option, but it will
    // not fire off events when NOT using this option. wtf... o_O
    $('#themeSelector').select2("val", self.selectedTheme());
    $('#langSelector').select2("val", self.selectedLang());
    
    self.shown(true);
  }  

  self.hide = function() {
    if(self.ORIG_PREFERENCES != JSON.stringify(PREFERENCES)) { //only update the preferences if they have changed
      multiAPI("store_preferences", [WALLET.identifier(), PREFERENCES]);  
    }
    self.shown(false);
  }  
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
