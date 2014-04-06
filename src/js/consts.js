
/***********
 * GLOBAL CONSTANTS
 ***********/
var VERSION = "1.0.0 BETA";

var IS_MOBILE_OR_TABLET = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
var PREFERENCES = {}; //set when logging in
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

var NUM_BLOCKS_TO_WAIT_FOR_BTCPAY = 6; //number of blocks to wait until the user can make a BTCpay on an order match where they owe BTC

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
 * IS_DEV / USE_TESTNET
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
var USE_TESTNET = (   ((location.pathname == "/" || location.pathname == "/src/" || location.pathname == "/build/") && qs("testnet") && qs("testnet") != '0')
                   || location.hostname.indexOf('testnet') == 0 ? true : false
                  );

//CONSTANTS THAT DEPEND ON IS_DEV / USE_TESTNET
var BLOCKEXPLORER_URL = USE_TESTNET ? "http://test.bitcore.io" : "http://live.bitcore.io";
var GOOGLE_ANALYTICS_UAID = null; //will be set in counterwallet.js
var ROLLBAR_ACCESS_TOKEN = null; //will be set in counterwallet.js

