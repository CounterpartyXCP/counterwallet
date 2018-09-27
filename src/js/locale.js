/*
Current language is set:
- with "lang" query string. for instance (?lang=fr)  (**NOTE: not currently used anymore as it causes wallet loading issues.**)
- else if absent with first subdomain. for instance fr.counterwallet.io or testnet-fr.counterwallet.io
- else if absent with local storage (localStorage.getItem("LANG"))
- else if absent with DEFAULT_LANG

How to use:

In locale/en/translation.json:
{
  "key1": "Hello world",
  "key2": "Hello %s"
}

In html:

<span data-bind="locale: 'key1'"></span> => <span>Hello world</span>
<span data-bind="locale: 'key2', localeArgs: ['world']"></span> => <span>Hello world</span>
OR if only one arg
<span data-bind="locale: 'key2', localeArgs: 'world'"></span> => <span>Hello world</span>
<input data-bind="localeAttr: {'placeholder': 'key1'}" /> => <input placeholder="Hello world" />
<input data-bind="localeAttr: {'placeholder': 'key2'}, localeAttrArgs: {'placeholder': ['world']}" /> => <input placeholder="Hello world" /> 
OR if only one arg
<input data-bind="localeAttr: {'placeholder': 'key2'}, localeAttrArgs: {'placeholder': 'world'}" /> => <input placeholder="Hello world" />

Knockout bug workaround for variables args:

in the view model :
self.world = 'World'
in the html: 
<span data-bind="locale: 'key2', localeArgs: world"></span> => <span>Hello world</span>
OR if more than one args
<span data-bind="locale: 'key2', localeArgs: {0: world}"></span> => <span>Hello world</span>

In Javascript:

i18n.t('key1') => "Hello world"
i18n.t('key2', 'world') => "Hello world"


*/

var AVAILABLE_LANGUAGES;
var DEFAULT_LANG;
var LANG;

function localeInit(callback) {
  var options = {
    lng: LANG,
    fallbackLng: DEFAULT_LANG,
    lngWhitelist: AVAILABLE_LANGUAGES,
    resGetPath: (_.startsWith(location.pathname, "/src") ? '/src': '') + '/locales/__lng__/__ns__.json',
    shorcutFunction: 'sprintf'
  }
  i18n.init(options, function() {
    callback();
    createSharedKnockoutValidators();
    initDateTimePicker(options.lng);
  });
  switchTimeagoLocale(LANG);
  localStorage.setItem("LANG", LANG);
}

function loadLocaleConfig(callback) {
  $.getJSON(COUNTERWALLET_CONF_LOCATION, function(data) {

    if ($.isArray(data["AVAILABLE_LANGUAGES"]))
      AVAILABLE_LANGUAGES = data["AVAILABLE_LANGUAGES"];
    else
      AVAILABLE_LANGUAGES = ["en"];

    if (typeof data["DEFAULT_LANGUAGE"] === "string")
      DEFAULT_LANG = data["DEFAULT_LANGUAGE"];
    else
      DEFAULT_LANG = "en";

    LANG = getLanguage();
    localeInit(callback);
  }).fail(function() {
    AVAILABLE_LANGUAGES = ["en"];
    DEFAULT_LANG = "en";
    LANG = "en";
    localeInit(callback);
  });
}

function getLanguage() {
  if (qs('lang')) {
    return qs('lang').toLowerCase();
  } else {
    var subdomain = window.location.hostname.split(".").shift().toLowerCase();
    if (AVAILABLE_LANGUAGES.indexOf(subdomain) != -1) {
      return subdomain;
    } else {
      subdomain = subdomain.split("-").pop();
      if (AVAILABLE_LANGUAGES.indexOf(subdomain) != -1) {
        return subdomain;
      } else if (localStorage.getItem("LANG")) {
        return localStorage.getItem("LANG").toLowerCase();
      } else {
        var browserLang = navigator.language || navigator.userLanguage;
        browserLang = browserLang.replace("-", "_").toLowerCase();
        if (AVAILABLE_LANGUAGES.indexOf(browserLang) != -1) {
          return browserLang;
        } else {
          browserLang = browserLang.split("_")[0];
          if (AVAILABLE_LANGUAGES.indexOf(browserLang) != -1) {
            return browserLang;
          }
        }
      }
    }
  }
  return 'en';
}

function altnize(str) {
  return str
    .replace(/BTC/g, KEY_ASSET.BTC)
    .replace(/XCP/g, KEY_ASSET.XCP)
    .replace(/Bitcoin/g, KEY_ASSET.Bitcoin)
    .replace(/XCP/g, KEY_ASSET.Counterparty);
}

ko.bindingHandlers['locale'] = {
  update: function(element, valueAccessor, allBindings) {
    var key = ko.unwrap(valueAccessor());
    var localeArgs = ko.toJS(allBindings.get('localeArgs'));
    var args = [];
    var argsType = Object.prototype.toString.call(localeArgs)
    if (argsType == "[object Object]") {
      for (var k in localeArgs) {
        args.push(localeArgs[k]);
      }
    } else if (argsType == "[object Array]") {
      args = localeArgs;
    } else if (argsType == "[object String]" || argsType == "[object Number]") {
      args = [localeArgs];
    }
    var translation = i18n.t(altnize(key), {postProcess: 'sprintf', sprintf: args});
    element.innerHTML = translation;
  }
};

ko.bindingHandlers['localeAttr'] = {
  update: function(element, valueAccessor, allBindings) {
    var attributes = ko.toJS(valueAccessor());
    var attributesArgs = ko.toJS(allBindings.get('localeAttrArgs') || {});
    for (var attrName in attributes) {
      var args = [];
      if (attributesArgs[attrName]) {
        var attrArgs = ko.toJS(attributesArgs[attrName]);
        var argsType = Object.prototype.toString.call(attrArgs)
        if (argsType == "[object Object]") {
          for (var k in attrArgs) {
            args.push(attrArgs[k]);
          }
        } else if (argsType == "[object Array]") {
          args = attrArgs;
        } else if (argsType == "[object String]" || argsType == "[object Number]") {
          args = [attrArgs];
        }
      }
      var translation = i18n.t(altnize(attributes[attrName]), {postProcess: 'sprintf', sprintf: args});
      $(element).attr(attrName, translation);
    }
  }
};
