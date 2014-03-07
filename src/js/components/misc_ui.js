
function ThemeSelectorViewModel() {
  var STORAGE_KEY = 'selectedTheme';
  var self = this;
  self.availableThemes = ko.observableArray([
    {'id': 'simpleGrey',   'name': 'Simple Grey',   'styleName': 'smart-style-0', 'selectorStyleName': 'themeBoxStyle0'},
    {'id': 'darkElegance', 'name': 'Dark Elegance', 'styleName': 'smart-style-1', 'selectorStyleName': 'themeBoxStyle1'},
    {'id': 'ultraLight',   'name': 'Ultra Light',   'styleName': 'smart-style-2', 'selectorStyleName': 'themeBoxStyle2'},
    {'id': 'googleSkin',   'name': 'Google Skin',   'styleName': 'smart-style-3', 'selectorStyleName': 'themeBoxStyle3'}
  ]);
  
  //consult PREFERENCES to find the saved theme (if any -- will set to null if no theme is stored)
  //if no theme provided via prefs, default to theme style 2 (ultra light)
  self.selectedTheme = ko.observable(PREFERENCES['selected_theme'] || self.availableThemes()[2]);
  
  self.selectedTheme.subscribeChanged(function(newSelection, prevSelection) {
    if(newSelection == prevSelection) return; //e.g., logging in with default theme settings
    $.jqlog.log("Changing theme from " + prevSelection['name'] + " to " + newSelection['name']);
    $('body').removeClass(prevSelection['styleName']);
    $('body').addClass(newSelection['styleName']);
    if(PREFERENCES['selected_theme'] != newSelection['id']) {
      //Update on the server
      PREFERENCES['selected_theme'] = newSelection['id'];
      multiAPI("store_preferences", [WALLET.identifier(), PREFERENCES]);
    }
  });
  
  self.changeTheme = function(newTheme) {
    self.selectedTheme(newTheme);
  }

  self.changeThemeByID = function(newThemeID) {
    var match = ko.utils.arrayFirst(self.availableThemes(), function(item) {
      return item['id'] == newThemeID;
    });
    if(!match) return false;
    self.selectedTheme(match);
    return true;
  }
}

function LangSelectorViewModel() {
  var STORAGE_KEY = 'selectedLang';
  var self = this;
  self.availableLangs = ko.observableArray([
    {'id': 'en-us', 'name': 'English', 'selectorImage': 'img/flags/us.png'}
    //additional languages in the future
  ]);
  
  //consult PREFERENCES to find the saved theme (if any -- will set to null if no theme is stored)
  //if no theme provided via prefs, default to theme style 2 (ultra light)
  self.selectedLang = ko.observable(PREFERENCES['selected_lang'] || self.availableLangs()[0]);
  
  self.selectedLang.subscribeChanged(function(newSelection, prevSelection) {
    if(newSelection == prevSelection) return; //e.g., logging in with default theme settings
    $.jqlog.log("Changing lang from " + prevSelection['name'] + " to " + newSelection['name']);
    //TODO: Code to change the selected language
    //Update on the server
    if(PREFERENCES['selected_lang'] != newSelection['id']) {
      PREFERENCES['selected_lang'] = newSelection['id'];
      multiAPI("store_preferences", [WALLET.identifier(), PREFERENCES]);
    }
  });
  
  self.changeLang = function(newLang) {
    self.selectedLang(newLang);
  }
  
  self.changeLangByID = function(newLangID) {
    var match = ko.utils.arrayFirst(self.availableLangs(), function(item) {
      return item['id'] == newLangID;
    });
    if(!match) return false;
    self.selectedLang(match);
    return true;
  }
}

window.THEME_SELECTOR = new ThemeSelectorViewModel();
window.LANG_SELECTOR = new LangSelectorViewModel();

$(document).ready(function() {
  ko.applyBindings(THEME_SELECTOR, document.getElementById("themeSelector"));
  ko.applyBindings(LANG_SELECTOR, document.getElementById("langSelector"));
});
