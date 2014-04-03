/***********
 * GLOBAL INITALIZATION
 ***********/
function assert(condition, message) { if (!condition) throw message || "Assertion failed"; }

//Set up logging (jqlog) and monkey patch jqlog with a debug function
$.jqlog.enabled(true);
$.jqlog.debug = function(object, options) {
  if(IS_DEV || USE_TESTNET) //may change to just IS_DEV in the future
    $.jqlog.info(object, options);
}

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
  history.replaceState({}, '', '/');
}

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

function produceCWServerList() {
  cwURLs(shuffle(cwURLs())); //randomly shuffle the list to decide the server try order...
  $.jqlog.debug("MultiAPI Backends: " + JSON.stringify(cwURLs()));
  
  cwBaseURLs(jQuery.map(cwURLs(), function(element) {
    return element;
  }));
  cwAPIUrls(jQuery.map(cwURLs(), function(element) {
    return element + (USE_TESTNET ? '/_t_api' : '/_api');
  }));
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
  !function(a,b){function c(b){this.shimId=++f,this.notifier=null,this.parentShim=b,this.logger=function(){},a.console&&void 0===a.console.shimId&&(this.logger=a.console.log)}function d(b){var d=c;return e(function(){if(this.notifier)return this.notifier[b].apply(this.notifier,arguments);var c=this,e="scope"===b;e&&(c=new d(this));var f=Array.prototype.slice.call(arguments,0),g={shim:c,method:b,args:f,ts:new Date};return a._rollbarShimQueue.push(g),e?c:void 0})}function e(a,b){return b=b||this.logger,function(){try{return a.apply(this,arguments)}catch(c){b("Rollbar internal error:",c)}}}var f=0;c.init=function(a,b){var d=b.globalAlias||"Rollbar";if("object"==typeof a[d])return a[d];a._rollbarShimQueue=[],b=b||{};var f=new c;return e(function(){if(f.configure(b),b.captureUncaught){var c=a.onerror;a.onerror=function(){f.uncaughtError.apply(f,arguments),c&&c.apply(a,arguments)}}return a[d]=f,f},f.logger)()},c.prototype.loadFull=function(a,b,c,d){var f=e(function(){var a=b.createElement("script"),e=b.getElementsByTagName("script")[0];a.src=d.rollbarJsUrl,a.async=!c,a.onload=g,e.parentNode.insertBefore(a,e)},this.logger),g=e(function(){if(void 0===a._rollbarPayloadQueue)for(var b,c,d,e,f=new Error("rollbar.js did not load");b=a._rollbarShimQueue.shift();)for(d=b.args,e=0;e<d.length;++e)if(c=d[e],"function"==typeof c){c(f);break}},this.logger);e(function(){c?f():a.addEventListener?a.addEventListener("load",f,!1):a.attachEvent("onload",f)},this.logger)()};for(var g="log,debug,info,warn,warning,error,critical,global,configure,scope,uncaughtError".split(","),h=0;h<g.length;++h)c.prototype[g[h]]=d(g[h]);var i="//d37gvrvc0wt4s1.cloudfront.net/js/v1.0/rollbar.min.js";_rollbarConfig.rollbarJsUrl=_rollbarConfig.rollbarJsUrl||i;var j=c.init(a,_rollbarConfig);j.loadFull(a,b,!1,_rollbarConfig)}(window,document);
}

function loadServersListAndSettings() {
  //Request for the servers.json file, which should contain an array of API backends for us to use
  $.getJSON("/servers.json", function(data) {
    assert(data && typeof data == "object" && data.hasOwnProperty("servers"), "Returned servers.json file does not contain valid JSON object");
    assert(data['servers'] && data['servers'] instanceof Array, "'servers' field in returned servers.json file is not an array");
    ROLLBAR_ACCESS_TOKEN = data['rollbarAccessToken'] || ''; 
    GOOGLE_ANALYTICS_UAID = (USE_TESTNET ? data['googleAnalyticsUA'] : data['googleAnalyticsUA-testnet']) || '';
    cwURLs(data['servers']);
    produceCWServerList();
    initRollbar();
  }).fail(function() {
    //File not found, just use the local box as the API server
    cwURLs([ location.origin ]);
    produceCWServerList();
  });
}


/***********
 * POST-JQUERY INIT
 ***********/
$(document).ready(function() {
  //Reject cruddy old browsers (we need IE v9 and higher!)
  $.reject({  
    reject: {
      msie5: true, //die die die!
      msie6: true, //die die die!
      msie7: true, //die die die!
      msie8: true, //die die die!
      firefox1: true,
      firefox2: true
    },
    imagePath: 'assets/', // Path where images are located    
  });
  
  loadServersListAndSettings();
});
