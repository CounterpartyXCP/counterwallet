
/***********
 * GLOBAL STATE AND SETUP
 ***********/
var VERSION = "0.9.5 BETA";
var IS_MOBILE_OR_TABLET = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
var PREFERENCES = {}; //set when logging in

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

//Setup hosts to use
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


var cwURLs = ko.observableArray([]);
var cwBaseURLs = ko.observableArray([]);
var cwAPIUrls = ko.observableArray([]);
//Note that with the socket.io feeds, we supply the path in the socketio connect() call
if(location.hostname.endsWith('counterwallet.co')) { //Main counterwallet setup
  document.domain = "counterwallet.co"; //allow cross-subdomain access (e.g. www.counterwallet.co can AJAX to cw01.counterwallet.co)
  //cwURLs([ "https://cw01.counterwallet.co", "https://cw02.counterwallet.co",
  // "https://cw03.counterwallet.co", "https://cw04.counterwallet.co", "https://cw05.counterwallet.co" ]);
  cwURLs([ "https://cw01.counterwallet.co" ]);
  produceCWServerList();
} else {
  //Request for the servers.json file, which should contain an array of API backends for us to use
  $.getJSON("servers.json", function( data ) {
    assert(data && data instanceof Array, "Returned servers.json file is not an array");
    cwURLs(data);
    produceCWServerList();
  }).fail(function() {
    //File not found, just use the local box as the API server
    cwURLs([ location.origin ]);
    produceCWServerList();
  });
}

var BLOCKEXPLORER_URL = "http://live.bitcore.io";
if(USE_TESTNET) {
  BLOCKEXPLORER_URL = "http://test.bitcore.io";
}


/***********
 * GLOBAL CONSTANTS
 ***********/
var GOOGLE_ANALYTICS_UAID = !IS_DEV ? (!USE_TESTNET ? 'UA-47404711-2' : 'UA-47404711-4') : null;
var MAX_ADDRESSES = 20; //totall arbitrary :)
var MAX_INT = Math.pow(2, 63) - 1;
var UNIT = 100000000; //# satoshis in whole
var MIN_FEE = 10000; // in satoshis (== .0001 BTC)
var APPROX_SECONDS_PER_BLOCK = 8 * 60; //a *rough* estimate on how many seconds per each block (used for estimating open order time left until expiration, etc)
var MIN_PRIME_BALANCE = 50000; //in satoshis ... == .0005
var ASSET_CREATION_FEE_XCP = 0.5; //in normalized XCP
var MAX_ASSET_DESC_LENGTH = 41; //42, minus a null term character?
var ORDER_DEFAULT_BTCFEE_PCT = 1; //1% of total order
var ORDER_DEFAULT_EXPIRATION = 320; //num blocks until expiration (at ~9 min per block this is ~48hours)
var DEFAULT_NUM_ADDRESSES = 3; //default number of addresses to generate
var MARKET_INFO_REFRESH_EVERY = 5 * 60 * 1000; //refresh market info every 5 minutes while enabled 

//var NUM_BLOCKS_TO_WAIT_FOR_BTCPAY = 6; //number of blocks to wait until the user can make a BTCpay on an order match where they owe BTC
var NUM_BLOCKS_TO_WAIT_FOR_BTCPAY = 1;

var AUTOPRIME_AT_LESSTHAN_REMAINING = 10; //auto prime at less than this many txouts remaining
var AUTOPRIME_MAX_COUNT = 10; //max number of txns to add with an autoprime
var AUTOPRIME_MIN_CONFIRMED_BTC_BAL = 0.005; //don't autoprime if the account has less than this balance (too much churn)

var ACTION_PENDING_NOTICE = "<b><u>This action will take some time to complete</u></b>, and will appear as a Pending Action until"
  + " confirmed on the network. <b class='errorColor'>Until that time, the wallet will not reflect the change. Please be patient.</b>";

var DEFAULT_PREFERENCES = {
  'num_addresses_used': DEFAULT_NUM_ADDRESSES,
  'address_aliases': {},
  'selected_theme': 'ultraLight',
  'selected_lang': 'en-us',
  'watch_only_addresses': [],
  'auto_prime': true, //default to auto prime being enabled
  'auto_btcpay': true //default to auto BTC payments being enabled
};

var ENTITY_NAMES = {
  'burns': 'Burn',
  'debits': 'Debit',
  'credits': 'Credit',
  'sends': 'Send',
  'orders': 'Order',
  'order_matches': 'Order Match',
  'btcpays': 'BTCPay',
  'issuances': 'Issuance',
  'broadcasts': 'Broadcast',
  'bets': 'Bet',
  'bet_matches': 'Bet Match',
  'dividends': 'Dividend',
  'cancels': 'Cancel',
  'callbacks': 'Callback',
  'bet_expirations': 'Bet Expired',
  'order_expirations': 'Order Expired',
  'bet_match_expirations': 'Bet Match Exp',
  'order_match_expirations': 'Order Match Exp'
};

var ENTITY_ICONS = {
  'burns': 'fa-fire',
  'debits': 'fa-minus',
  'credits': 'fa-plus',
  'sends': 'fa-share',
  'orders': 'fa-bar-chart-o',
  'order_matches': 'fa-exchange',
  'btcpays': 'fa-btc',
  'issuances': 'fa-magic',
  'broadcasts': 'fa-rss',
  'bets': 'fa-bullseye',
  'bet_matches': 'fa-exchange',
  'dividends': 'fa-ticket',
  'cancels': 'fa-times',
  'callbacks': 'fa-retweet',
  'bet_expirations': 'fa-clock-o',
  'order_expirations': 'fa-clock-o',
  'bet_match_expirations': 'fa-clock-o',
  'order_match_expirations': 'fa-clock-o'
};

var ENTITY_NOTO_COLORS = {
  'burns': 'bg-color-yellow',
  'debits': 'bg-color-red',
  'credits': 'bg-color-green',
  'sends': 'bg-color-orangeDark',
  'orders': 'bg-color-blue',
  'order_matches': 'bg-color-blueLight',
  'btcpays': 'bg-color-orange',
  'issuances': 'bg-color-pinkDark',
  'broadcasts': 'bg-color-magenta',
  'bets': 'bg-color-teal',
  'bet_matches': 'bg-color-teal',
  'dividends': 'bg-color-pink',
  'cancels': 'bg-color-red',
  'callbacks': 'bg-color-pink',
  'bet_expirations': 'bg-color-grayDark',
  'order_expirations': 'bg-color-grayDark',
  'bet_match_expirations': 'bg-color-grayDark',
  'order_match_expirations': 'bg-color-grayDark'
};

var BET_TYPES = {
  0: "Bullish CFD",
  1: "Bearish CFD",
  2: "Equal",
  3: "Not Equal"
};

var MAINNET_UNSPENDABLE = '1CounterpartyXXXXXXXXXXXXXXXUWLpVr';
var TESTNET_UNSPENDABLE = 'mvCounterpartyXXXXXXXXXXXXXXW24Hef';
var TESTNET_BURN_START = 154908;
var TESTNET_BURN_END = 4017708;


/***********
 * PRIMARY SITE INIT
 ***********/
$(document).ready(function() {
  //Set up form validation
  //$("input,select,textarea").not("[type=submit]").jqBootstrapValidation();
  
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
    imagePath: './images/jquery.reject/', // Path where images are located    
  }); // Customized Text
});

//Knockout validation defaults (https://github.com/ericmbarnard/Knockout-Validation/wiki/Configuration)
ko.validation.init({
  decorateElement: true,
  errorMessageClass: 'invalid',
  errorElementClass: 'invalid'
});

//Allow future timestamps with timeago
$.timeago.settings.allowFuture = true;

