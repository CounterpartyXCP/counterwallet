/***********
 * GLOBAL CONSTANTS
 ***********/
var IS_MOBILE_OR_TABLET = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
var MAX_INT = Math.pow(2, 63) - 1;
var UNIT = 100000000; //# satoshis in whole
var MIN_FEE = 20000; // in satoshis (== .0002 BTC)
var REGULAR_DUST_SIZE = 5430;
var MULTISIG_DUST_SIZE = 7800;
var MIN_PRIME_BALANCE = 50000; //in satoshis ... == .0005
var ASSET_CREATION_FEE_XCP = 0.5; //in normalized XCP
var DIVIDEND_FEE_PER_HOLDER = 0.0002
var MAX_ASSET_DESC_LENGTH = 41; //42, minus a null term character?
var FEE_FRACTION_REQUIRED_DEFAULT_PCT = .9;   //0.90% of total order
var FEE_FRACTION_PROVIDED_DEFAULT_PCT = 1;   //1.00% of total order
var FEE_FRACTION_DEFAULT_FILTER = .95;
var BTC_ORDER_MIN_AMOUNT = 0.01;
var B26_DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
var ORIG_REFERER = document.referrer;

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
  'dividends': 'Distribution',
  'cancels': 'Cancel',
  'callbacks': 'Callback',
  'bet_expirations': 'Bet Expired',
  'order_expirations': 'Order Expired',
  'bet_match_expirations': 'Bet Match Exp',
  'order_match_expirations': 'Order Match Exp',
  'rps': 'Rock-Paper-Scissors',
  'rps_matches': 'RPS Match',
  'rpsresolves': 'RPS Confirmed',
  'rps_expirations': 'RPS Expired',
  'rps_match_expirations': 'RPS Match Expired'
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
  'order_match_expirations': 'fa-clock-o',
  'rps': 'fa-trophy',
  'rps_matches': 'fa-trophy',
  'rpsresolves': 'fa-trophy',
  'rps_expirations': 'fa-trophy',
  'rps_match_expirations': 'fa-trophy'
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
  'order_match_expirations': 'bg-color-grayDark',
  'rps': 'bg-color-blue',
  'rps_matches': 'bg-color-blueLight',
  'rpsresolves': 'bg-color-blue',
  'rps_expirations': 'bg-color-blueLight',
  'rps_match_expirations': 'bg-color-blueLight'
};

var BET_TYPES = {
  0: "Bullish CFD",
  1: "Bearish CFD",
  2: "Equal",
  3: "Not Equal"
};

var BET_TYPES_SHORT = {
  0: "BullCFD",
  1: "BearCFD",
  2: "Equal",
  3: "NotEqual"
}

var BET_TYPES_ID = {
  "BullCFD": 0,
  "BearCFD": 1,
  "Equal": 2,
  "NotEqual": 3
}

var COUNTER_BET = {
  "Equal": 3,
  "NotEqual": 2,
  "BullCFD": 1,
  "BearCFD": 0
}

var BET_MATCHES_STATUS = {
  "settled: liquidated for bear": 0,
  "settled: liquidated for bull": 1,
  "settled: for equal": 2,
  "settled: for notequal": 3
}

var LEVERAGE_UNIT = 5040;

var MAINNET_UNSPENDABLE = '1CounterpartyXXXXXXXXXXXXXXXUWLpVr';
var TESTNET_UNSPENDABLE = 'mvCounterpartyXXXXXXXXXXXXXXW24Hef';
var TESTNET_BURN_START = 154908;
var TESTNET_BURN_END = 4017708;

/***********
 * DYNAMICALLY SET
 ***********/
function qs(key) {
  //http://stackoverflow.com/a/7732379
  key = key.replace(/[*+?^$.\[\]{}()|\\\/]/g, "\\$&"); // escape RegEx meta chars
  var match = location.search.match(new RegExp("[?&]"+key+"=([^&]+)(&|$)"));
  return match && decodeURIComponent(match[1].replace(/\+/g, " "));
}

//Allow the site root to specify "dev" and "testnet" parameters...
// IS_DEV is enabled if the initial (root) URL access has ?dev=1
// USE_TESTNET is enabled if the initial (root) URL access has ?testnet=1, OR the hostname visited starts with 'testnet' (e.g. testnet.myhost.com)
var IS_DEV = (location.pathname == "/" && qs("dev") && qs("dev") != '0' ? true : false);
var USE_TESTNET = (   (((location.pathname == "/" || location.pathname == "/src/" || location.pathname == "/build/") && qs("testnet") && qs("testnet") != '0')
                   || location.hostname.indexOf('testnet') != -1) ? true : false
                  );

var BLOCKEXPLORER_URL = USE_TESTNET ? "http://test.bitcore.io" : "http://live.bitcore.io";
var GOOGLE_ANALYTICS_UAID = null; //will be set in counterwallet.js
var ROLLBAR_ACCESS_TOKEN = null; //will be set in counterwallet.js

var TRANSACTION_DELAY = 5000; // delay between transaction to avoid error -22 (vin reused)
var TRANSACTION_MAX_RETRY = 5; // max retry when transaction failed (don't include first transaction, so 3 retry means 4 queries)

var DONATION_ADDRESS = USE_TESTNET ? 'n4MGGJBkW9RjRKBbZfBAceHDndhywvVPV9' : '19U6MmLLumsqxXSBMB5FgYXbezgXYC6Gpe';

var APPROX_SECONDS_PER_BLOCK = USE_TESTNET ? 20 * 60 : 8 * 60; //a *rough* estimate on how many seconds per each block (used for estimating open order time left until expiration, etc)



