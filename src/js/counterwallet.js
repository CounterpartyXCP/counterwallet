/***********
 * GLOBAL INITALIZATION
 ***********/

//Set up logging (jqlog) and monkey patch jqlog with a debug function
$.jqlog.enabled(true);
$.jqlog.debug = function(object, options) {
  if(IS_DEV || USE_TESTNET) //may change to just IS_DEV in the future
    $.jqlog.info(object, options);
}

//Mix-in underscore.string to underscore namespace
_.mixin(_.string.exports());

//IE does not include support for location.origin ...
if (!window.location.origin) {
  window.location.origin = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '');
}

//if in dev or testnet mode (both of which are specified based on a URL querystring being present), IF a query string is
// provided clear the query string so that our hash-based AJAX navigation works after logging in...
if((IS_DEV || USE_TESTNET) && location.search) {
  //history.replaceState is NOT supported on IE 9...ehh
  assert($.layout.className !== 'trident9',
    "Use of 'dev' or 'testnet' flags NOT supported on IE 9, due to lack of history.replaceState() support.");
  history.replaceState({}, '', location.pathname);
}

//Knockout secure binding drop-in initialization
var options = {
   attribute: "data-bind",        // default "data-sbind"
   globals: window,               // default {}
   bindings: ko.bindingHandlers,  // default ko.bindingHandlers
   noVirtualElements: false       // default true
};
ko.bindingProvider.instance = new ko.secureBindingsProvider(options);

//Knockout validation defaults (https://github.com/ericmbarnard/Knockout-Validation/wiki/Configuration)
ko.validation.init({
  decorateElement: true,
  errorMessageClass: 'invalid',
  errorElementClass: 'invalid'
});

//Allow future timestamps with timeago
$.timeago.settings.allowFuture = true;


/***********
 * SERVERS.JSON LOADING AND SERVICES INITIALIZATION
 ***********/
var cwURLs = ko.observableArray([]);
var cwBaseURLs = ko.observableArray([]);
var cwAPIUrls = ko.observableArray([]);
var disabledFeatures = ko.observableArray([]);

function produceCWServerList() {
  cwURLs(_.shuffle(cwURLs())); //randomly shuffle the list to decide the server try order...
  $.jqlog.debug("MultiAPI Backends: " + JSON.stringify(cwURLs()));
  
  cwBaseURLs(jQuery.map(cwURLs(), function(element) {
    return element;
  }));
  cwAPIUrls(jQuery.map(cwURLs(), function(element) {
    return element + (USE_TESTNET ? '/_t_api' : '/_api');
  }));
}

function initGoogleAnalytics() {
  $.jqlog.debug("Initializing Google Analytics for UA: " + GOOGLE_ANALYTICS_UAID);
  if(!GOOGLE_ANALYTICS_UAID) return;
  
  window._gaq=[["_setAccount", GOOGLE_ANALYTICS_UAID], ["_trackPageview"]]; 
  (function(d,t){var g=d.createElement(t),s=d.getElementsByTagName(t)[0];g.async=1;
  g.src=("https:"==location.protocol?"//ssl":"//www")+".google-analytics.com/ga.js";
  s.parentNode.insertBefore(g,s)}(document,"script"));  
}

function initRollbar() {
  /* TODO: Try to load rollbar earlier, possibly... (However, as we get the accessToken from servers.json, we'd have
   * to put all of that logic in <head> for instance to be able to do that. So this should hopefully work fine.) 
   */
  if(!ROLLBAR_ACCESS_TOKEN) return;
  var _rollbarConfig = {
      accessToken: ROLLBAR_ACCESS_TOKEN,
      captureUncaught: true,
      payload: {
          environment: USE_TESTNET ? "testnet" : "mainnet"
      }
  };
  !function(a,b){function c(b){this.shimId=++f,this.notifier=null,this.parentShim=b,this.logger=function(){},a.console&&void 0===a.console.shimId&&(this.logger=a.console.log)}function d(b){var d=c;return e(function(){if(this.notifier)return this.notifier[b].apply(this.notifier,arguments);var c=this,e="scope"===b;e&&(c=new d(this));var f=Array.prototype.slice.call(arguments,0),g={shim:c,method:b,args:f,ts:new Date};return a._rollbarShimQueue.push(g),e?c:void 0})}function e(a,b){return b=b||this.logger,function(){try{return a.apply(this,arguments)}catch(c){b("Rollbar internal error:",c)}}}var f=0;c.init=function(a,b){var d=b.globalAlias||"Rollbar";if("object"==typeof a[d])return a[d];a._rollbarShimQueue=[],b=b||{};var f=new c;return e(function(){if(f.configure(b),b.captureUncaught){var c=a.onerror;a.onerror=function(){f.uncaughtError.apply(f,arguments),c&&c.apply(a,arguments)}}return a[d]=f,f},f.logger)()},c.prototype.loadFull=function(a,b,c,d){var f=e(function(){var a=b.createElement("script"),e=b.getElementsByTagName("script")[0];a.src=d.rollbarJsUrl,a.async=!c,a.onload=g,e.parentNode.insertBefore(a,e)},this.logger),g=e(function(){if(void 0===a._rollbarPayloadQueue)for(var b,c,d,e,f=new Error("rollbar.js did not load");b=a._rollbarShimQueue.shift();)for(d=b.args,e=0;e<d.length;++e)if(c=d[e],"function"==typeof c){c(f);break}},this.logger);e(function(){c?f():a.addEventListener?a.addEventListener("load",f,!1):a.attachEvent("onload",f)},this.logger)()};for(var g="log,debug,info,warn,warning,error,critical,global,configure,scope,uncaughtError".split(","),h=0;h<g.length;++h)c.prototype[g[h]]=d(g[h]);var i="assets/rollbar.min.js";_rollbarConfig.rollbarJsUrl=_rollbarConfig.rollbarJsUrl||i;var j=c.init(a,_rollbarConfig);j.loadFull(a,b,!1,_rollbarConfig)}(window,document);
}

function loadCounterwalletConfigFromServer() {
  //Request for the servers.json file, which should contain an array of API backends for us to use
  $.getJSON("/counterwallet.conf.json", function(data) {
    assert(data && typeof data == "object" && data.hasOwnProperty("servers"), "Returned servers.json file does not contain valid JSON object");
    assert(data['servers'] && data['servers'] instanceof Array, "'servers' field in returned servers.json file is not an array");
    ROLLBAR_ACCESS_TOKEN = data['rollbarAccessToken'] || ''; 
    GOOGLE_ANALYTICS_UAID = (!USE_TESTNET ? data['googleAnalyticsUA'] : data['googleAnalyticsUA-testnet']) || '';
    
    if(!data['servers'].length)
      cwURLs([ location.origin ]);
    else
      cwURLs(data['servers']);
    produceCWServerList();
    initGoogleAnalytics();
    initRollbar();
    
    //Init list of disabled features
    if(data['disabledFeatures']) {
      assert(data['disabledFeatures'] instanceof Array, "'disabledFeatures' field in returned servers.json file is not an array");
      for(var i=0; i < data['disabledFeatures']; i++) {
        if(DISABLED_FEATURES_SUPPORTED.indexOf(data['disabledFeatures'][i]) == -1) {
          assert(data['disabledFeatures'] instanceof Array, "'disabledFeatures' field has invalid entry '" + data['disabledFeatures'][i]
            + "'. Supported entries are: " + DISABLED_FEATURES_SUPPORTED.join(', '));
        }
      }
      $.jqlog.debug("Disabled features: " + data['disabledFeatures']);
    }
    disabledFeatures(data['disabledFeatures'] || []);
  }).fail(function() {
    //File not found, just use the local box as the API server
    cwURLs([ location.origin ]);
    produceCWServerList();
  });
}

function needWarningOnExit() {
  return (window.WALLET && WALLET.isSellingBTC()) ||
         window.MESSAGE_FEED.sellBTCOrdersCount() ||
         window.PENDING_ACTION_FEED.pendingSellBTCOrdersCount();
}

function warningOnExit() {
  if (needWarningOnExit()) {
    return i18n.t("exit_warning");
  }
}

function autoDropUpDropdowns() {
  //FROM: http://stackoverflow.com/a/22263501
  //USAGE: Add 'btn-group-dropup' class to any 'btn-group' div that contains
  // a dropdown that should automatically drop-up if necessary
  (function() {
    // require menu height + margin, otherwise convert to drop-up
    var dropUpMarginBottom = 100;
  
    function dropUp() {
      var windowHeight = $(window).height();
      $(".btn-group-dropup").each(function() {
        var dropDownMenuHeight, 
            rect = this.getBoundingClientRect();
        // only toggle menu's that are visible on the current page
        if (rect.top > windowHeight) {
          return;
        }
        // if you know height of menu - set on parent, eg. `data-menu="100"`
        dropDownMenuHeight = $(this).data('menu');
        if (dropDownMenuHeight == null) {
          dropDownMenuHeight = $(this).children('.dropdown-menu').height();
        }
        $(this).toggleClass("dropup", ((windowHeight - rect.bottom) < (dropDownMenuHeight + dropUpMarginBottom)) && (rect.top > dropDownMenuHeight));
      });
    };
  
    // bind to load & scroll - but debounce scroll with `underscorejs`
    $(window).bind({
      "resize scroll touchstart touchmove mousewheel": _.debounce(dropUp, 100),
      "load": dropUp
    });
  }).call(this);  
}


/***********
 * POST-JQUERY INIT
 ***********/
$(document).ready(function() {
  //Reject browsers that don't support the features we need (especially CSP 1.0 and window.crypto)
  // See http://caniuse.com/contentsecuritypolicy and https://developer.mozilla.org/en-US/docs/Web/API/window.crypto.getRandomValues
  $.reject({  
    reject: {
      msie1: true,
      msie2: true,
      msie3: true,
      msie4: true,
      msie5: true, 
      msie6: true, //kill it with fire
      msie7: true, //kill it with fire
      msie8: true, //kill it with fire
      msie9: true, //DOES NOT SUPPORT FULL Content-Security-Policy, as well as Window.msCrypto
      msie10: true, //DOES NOT SUPPORT FULL Content-Security-Policy
      msie11: true, //this is IE11, which, yes, DOES NOT SUPPORT FULL Content-Security-Policy (fuuuckkkkkk)
      firefox1: true,
      firefox2: true,
      firefox3: true,
      firefox4: true,
      firefox5: true,
      firefox6: true,
      firefox7: true,
      firefox8: true,
      firefox9: true,
      firefox10: true,
      firefox11: true,
      firefox12: true,
      firefox13: true,
      firefox14: true,
      firefox15: true,
      firefox16: true,
      firefox17: true,
      firefox18: true,
      firefox19: true,
      firefox20: true,
      firefox21: true,
      firefox22: true,
      chrome1: true,
      chrome2: true,
      chrome3: true,
      chrome4: true,
      chrome5: true,
      chrome6: true,
      chrome7: true,
      chrome8: true,
      chrome9: true,
      chrome10: true,
      chrome11: true,
      chrome12: true,
      chrome13: true,
      chrome14: true,
      chrome15: true,
      chrome16: true,
      chrome17: true,
      chrome18: true,
      chrome19: true,
      chrome20: true,
      chrome21: true,
      chrome22: true,
      chrome23: true,
      chrome24: true,
      opera1: true,
      opera2: true,
      opera3: true,
      opera4: true,
      opera5: true,
      opera6: true,
      opera7: true,
      opera8: true,
      opera9: true,
      opera10: true,
      opera11: true,
      opera12: true,
      opera13: true,
      opera14: true,
      safari1: true,
      safari2: true,
      safari3: true,
      safari4: true,
      safari5: true,
      safari5: true,
      safari6: true
    },
    imagePath: 'assets/', // Path where images are located
    display: ['chrome', 'firefox', 'safari'],
    browserInfo: { // Settings for which browsers to display
      chrome: {
        text: 'Chrome',
        url: 'https://www.google.com/intl/en/chrome/browser/'
      },
      firefox: {
        text: 'Firefox',
        url: 'http://http://www.mozilla.org/'
      },
      safari: {
        text: 'Safari (Mac Users)',
        url: 'http://www.apple.com/safari/download/'
      },
      opera: {
        text: 'Opera',
        url: 'http://www.opera.com/download/'
      }      
    },
    header: i18n.t('brower_not_supported_header'),
    paragraph1: i18n.t("brower_not_supported_text"),
    close: false,
    closeESC: false
  });
  
  autoDropUpDropdowns();
  
  loadCounterwalletConfigFromServer();

  window.onbeforeunload = warningOnExit;
});
