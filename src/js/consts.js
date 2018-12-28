/***********
 * GLOBAL CONSTANTS
 ***********/
var VERSION = "1.9.0";
var PREFERENCES = {}; //set when logging in

//Addresses
var DEFAULT_NUM_ADDRESSES = 1; //default number of addresses to generate. Go with 1 for now to be more newbie friendly
var MAX_ADDRESSES = 20; //arbitrary (but will generate more on login if they have activity...this just prevents
                        //additional addresses from being generated via the GUI)

//Order expiration
var ORDER_DEFAULT_EXPIRATION = 8064; //num blocks until expiration (~2 months)
var ORDER_MAX_EXPIRATION = 8064; //max expiration for order

var STATS_MAX_NUM_TRANSACTIONS = 100; //max # transactions to show in the table
var VIEW_PRICES_NUM_ASSET_PAIRS = 50; //show market info for this many pairs
var VIEW_PRICES_ASSET_PAIRS_REFRESH_EVERY = 5 * 60 * 1000; //refresh asset pair market info every 5 minutes
var VIEW_PRICES_NUM_LATEST_TRADES = 50; //show this many latest trades on the view prices page
var VIEW_PRICES_LATEST_TRADES_REFRESH_EVERY = 5 * 60 * 1000; //refresh latest trades every 5 minutes

var MARKET_INFO_REFRESH_EVERY = 5 * 60 * 1000; //refresh market info every 5 minutes while enabled (on buy/sell page, and view prices page)

var CHAT_NUM_USERS_ONLINE_REFRESH_EVERY = 5 * 60 * 1000; //refresh online user count every 5 minutes while enabled

var ALLOW_UNCONFIRMED_INPUTS = true;  // allow use unconfirmed unspents

// should be a i18n key
var ACTION_PENDING_NOTICE = "pending_notice";

var ARMORY_OFFLINE_TX_PREFIX = "=====TXSIGCOLLECT-";

var DEFAULT_PREFERENCES = {
  'num_addresses_used': DEFAULT_NUM_ADDRESSES,
  'num_segwit_addresses_used': DEFAULT_NUM_ADDRESSES,
  'address_aliases': {},
  'selected_theme': 'ultraLight',
  'selected_lang': 'en-us',
  'watch_only_addresses': [],
  'armory_offline_addresses': [],
  'multisig_addresses': [],
  'has_accepted_license': false
};

var COUNTERWALLET_CONF_LOCATION = "/counterwallet.conf.json";

var NUMERIC_ASSET_ID_MIN = bigInt(26).pow(12).add(1);
var NUMERIC_ASSET_ID_MAX = bigInt(256).pow(8);

var SUBASSET_MAX_DISP_LENGTH = 20;

var IS_MOBILE_OR_TABLET = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
var MAX_INT = Math.pow(2, 63) - 1;
var UNIT = 100000000; //# satoshis in whole
var MIN_FEE = 20000; // in satoshis (== .0002 BTC)
var REGULAR_DUST_SIZE = 5430;
var MULTISIG_DUST_SIZE = 7800;
var MIN_BALANCE_FOR_ACTION = 50000; //in satoshis ... == .0005
var ASSET_CREATION_FEE_XCP = 0.5; //in normalized XCP
var SUBASSET_CREATION_FEE_XCP = 0.25; //in normalized XCP
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
var REGTEST_UNSPENDABLE = 'mvCounterpartyXXXXXXXXXXXXXXW24Hef';
var TESTNET_BURN_START = 154908;
var TESTNET_BURN_END = 4017708;
var REGTEST_BURN_START = 101;
var REGTEST_BURN_END = 150000000;

/***********
 * DYNAMICALLY SET
 ***********/
var TESTNET_PASSPHRASE = qs("passphrase");

var CRYPTED_PASSPHRASE;
if (location.hash.indexOf('cp=') == 1) {
  CRYPTED_PASSPHRASE = location.hash.substr(4);
  location.hash = '';
}
location.hash = '';

//CONSTANTS THAT DEPEND ON IS_DEV / USE_TESTNET
var USER_COUNTRY = ''; //set in logon.js
var CURRENT_PAGE_URL = ''; // set in loadUrl()

//selective disablement
var DISABLED_FEATURES_SUPPORTED = ['betting', 'dividend', 'exchange', 'leaderboard', 'portfolio', 'stats', 'history']; //what can be disabled
var DISABLED_FEATURES = []; //set in counterwallet.js

// restricted action
var RESTRICTED_AREA = {} // set in counterwallet.js

var RESTRICTED_AREA_MESSAGE = {
  'pages/simplebuy.html': 'buy_xcp_if_legal'
}

var MAX_SUPPORT_CASE_PROBLEM_LEN = 4096;
var QUOTE_ASSETS = []; // initalized with counterblock is_ready()

var QUICK_BUY_ENABLE = false;
var BETTING_ENABLE = true;
var GAMING_ENABLE = true;

function qs(key) {
  //http://stackoverflow.com/a/7732379
  key = key.replace(/[*+?^$.\[\]{}()|\\\/]/g, "\\$&"); // escape RegEx meta chars
  var match = location.search.match(new RegExp("[?&]" + key + "=([^&]+)(&|$)"));
  return match && decodeURIComponent(match[1].replace(/\+/g, " "));
}

//Allow the site root to specify "dev" and "testnet" parameters...
// IS_DEV is enabled if the initial (root) URL access has ?dev=1
// USE_TESTNET is enabled if the initial (root) URL access has ?testnet=1, OR the hostname visited starts with 'testnet' (e.g. testnet.myhost.com)
var IS_DEV = (location.pathname == "/" && qs("dev") && qs("dev") != '0' ? true : false);
var USE_REGTEST = (location.pathname == "/" && qs("regtest") && qs("regtest") != '0' ? true : false);
var USE_TESTNET = (   (((location.pathname == "/" || location.pathname == "/src/" || location.pathname == "/build/") && qs("testnet") && qs("testnet") != '0')
  || location.hostname.indexOf('testnet') != -1) ? true : false
);

var BLOCKEXPLORER_URL = USE_TESTNET ? "https://testnet.xchain.io" : "https://xchain.io";
var GOOGLE_ANALYTICS_UAID = null; //will be set in counterwallet.js
var ROLLBAR_ACCESS_TOKEN = null; //will be set in counterwallet.js

var TRANSACTION_DELAY = 5000; // delay between transaction to avoid error -22 (vin reused)
var TRANSACTION_MAX_RETRY = 5; // max retry when transaction failed (don't include first transaction, so 3 retry means 4 queries)

var DONATION_ADDRESS = USE_TESTNET ? 'n4MGGJBkW9RjRKBbZfBAceHDndhywvVPV9' : '19U6MmLLumsqxXSBMB5FgYXbezgXYC6Gpe';

var APPROX_SECONDS_PER_BLOCK = USE_TESTNET ? 20 * 60 : 8 * 60; //a *rough* estimate on how many seconds per each block (used for estimating open order time left until expiration, etc)

var KEY_ASSET = {
  'BTC': 'BTC',
  'XCP': 'XCP',
  'USD': 'USD',
  'Bitcoin': 'Bitcoin',
  'Counterparty': 'Counterparty'
};

var KEY_ASSET_WEBSITE = {
  'BTC': 'https://bitcoin.org/',
  'XCP': 'https://counterparty.io/'
};

bitcoinjs.networks.regtest = {
    messagePrefix: '\x18Bitcoin Signed Message:\n',
    bech32: 'bcrt',
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef
  }

bitcoinjs.networks.mainnet = bitcoinjs.networks.bitcoin // support for bitcore's name
