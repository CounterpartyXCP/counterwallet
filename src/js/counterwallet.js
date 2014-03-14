
/***********
 * GLOBAL STATE AND SETUP
 ***********/
var PREFERENCES = {}; //set when logging in

//if in dev or testnet mode (both of which are specified based on a URL querystring being present) clear the
// query string so that our hash-based AJAX navigation works after logging in...
if(IS_DEV || USE_TESTNET) {
  //history.replaceState is NOT supported on IE 9...ehh
  assert($.layout.className !== 'msie9',
    "Use of 'dev' or 'testnet' flags NOT supported on IE 9, due to lack of history.replaceState() support.");
  history.replaceState({}, '', '/');
}

//Setup hosts to use
var counterwalletd_urls = null;
//Note that with the socket.io feeds, we supply the path in the socketio connect() call
if(!IS_DEV) { //Production setup
  document.domain = "counterwallet.co"; //allow cross-subdomain access (e.g. www.counterwallet.co can AJAX to cw01.counterwallet.co)
  //counterwalletd_urls = [ "https://cw01.counterwallet.co", "https://cw02.counterwallet.co", "https://cw03.counterwallet.co" ];
  counterwalletd_urls = [ "https://cw01.counterwallet.co" ];
} else { //Development setup
  counterwalletd_urls = [ "https://xcpdev01" ];
  // ^ NOTE to developers: No need to modify the above, just insert an entry in your hosts file for xcpdev01
  // Just have a host entry for both xcpdev01 and testxcpdev01 going to the same server, which has a federated node setup running
}
counterwalletd_urls = shuffle(counterwalletd_urls); //randomly shuffle the list to decide the server try order...
var counterwalletd_base_urls = jQuery.map(counterwalletd_urls, function(element) {
  return element;
});
var counterwalletd_api_urls = jQuery.map(counterwalletd_urls, function(element) {
  return element + (USE_TESTNET ? '/_t_api' : '/_api');
});
var counterwalletd_insight_api_urls = jQuery.map(counterwalletd_urls, function(element) {
  return element + (USE_TESTNET ? '/_t_insight_api' : '/_insight_api');
});

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
var MIN_PRIME_BALANCE = 50000; //in satoshis ... == .0005
var ASSET_CREATION_FEE_XCP = 5; //in normalized XCP
var MAX_ASSET_DESC_LENGTH = 41; //42, minus a null term character?
var ORDER_DEFAULT_BTCFEE_PCT = 1; //1% of total order
var ORDER_DEFAULT_EXPIRATION = 100; //num blocks until expiration
var DEFAULT_NUM_ADDRESSES = 3; //default number of addresses to generate

var AUTOPRIME_AT_LESSTHAN_REMAINING = 10; //auto prime at less than this many txouts remaining
var AUTOPRIME_MAX_AMOUNT = 10; //max number of txns to add with an autoprime
var AUTOPRIME_MIN_CONFIRMED_BTC_BAL = 0.005; //don't autoprime if the account has less than this balance (too much churn)

var ACTION_PENDING_NOTICE = "This action will appear as a Pending Action until confirmed on the network.";
var ACTION_PENDING_NOTICE_NO_UI = "This will reflect once the network has confirmed the transaction.";

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
  //Set up logging (jqlog)
  $.jqlog.enabled(true);
  
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
    imagePath: './xcp/images/jquery.reject/', // Path where images are located    
  }); // Customized Text
});

//Knockout validation defaults (https://github.com/ericmbarnard/Knockout-Validation/wiki/Configuration)
ko.validation.init({
  decorateElement: true,
  errorMessageClass: 'invalid',
  errorElementClass: 'invalid'
});
