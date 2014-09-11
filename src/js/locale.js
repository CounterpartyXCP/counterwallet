/*
Current language is set:
- with "lang" query string. for instance (?lang=fr)
- else if absent with first subdomain. for instance fr.counterwallet.co or testnet-fr.counterwallet.co
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
var AVAILABLE_LANGUAGES = ['en', 'fr'];
var DEFAULT_LANG = 'en';
var LANG = getLanguage();

function localeInit(callback) {
  var options = { 
    lng: LANG,
    fallbackLng: DEFAULT_LANG,
    lngWhitelist: AVAILABLE_LANGUAGES,
    resGetPath: 'locales/__lng__/__ns__.json', 
    shorcutFunction: 'sprintf'
  }
  i18n.init(options, function() {
    callback();
  });
  localStorage.setItem("LANG", LANG);
}

function getLanguage() {
  if (qs('lang')) {
    return qs('lang').toLowerCase();  
  } else {
    var subdomain = window.location.hostname.split(".").shift().toLowerCase();
    if (subdomain.length == 2) {
      return subdomain;
    } else {
      subdomain = subdomain.split("-").pop();
      if (subdomain.length == 2) {
        return subdomain;
      } else if (localStorage.getItem("LANG")) {
        return localStorage.getItem("LANG").toLowerCase();
      } 
    }
  }
  return 'en';
}

ko.bindingHandlers['locale'] = {
  update: function(element, valueAccessor, allBindings){
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
    var translation = i18n.t(key, {postProcess: 'sprintf', sprintf: args});
    element.innerHTML = translation;
  }
};

ko.bindingHandlers['localeAttr'] = {
  update: function(element, valueAccessor, allBindings){
    var attributes = ko.toJS(valueAccessor());
    var attributesArgs = ko.toJS(allBindings.get('localeAttrArgs') || {});
    for (var attrName in attributes) {
      var args = [];
      if (attributesArgs[attrName]) {
        attrArgs = ko.toJS(attributesArgs[attrName]);
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
      var translation = i18n.t(attributes[attrName], {postProcess: 'sprintf', sprintf: args}); 
      $(element).attr(attrName, translation);
    }
  }
};
