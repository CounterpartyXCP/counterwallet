/***********
 * GLOBAL CONSTANTS
 ***********/
var VERSION = "1.5.0 PRE5 BETA";
var PREFERENCES = {}; //set when logging in

//Addresses
var DEFAULT_NUM_ADDRESSES = 1; //default number of addresses to generate. Go with 1 for now to be more newbie friendly
var MAX_ADDRESSES = 20; //arbitrary (but will generate more on login if they have activity...this just prevents
                        //additional addresses from being generated via the GUI)

//Order expiration
var ORDER_DEFAULT_EXPIRATION = 1000; //num blocks until expiration (at ~9 min per block this is ~6.75 days)
var ORDER_BTCSELL_DEFAULT_EXPIRATION = 2000; //num blocks until expiration for selling BTC order
var ORDER_MAX_EXPIRATION = 3000; //max expiration for order

var STATS_MAX_NUM_TRANSACTIONS = 100; //max # transactions to show in the table
var VIEW_PRICES_NUM_ASSET_PAIRS = 50; //show market info for this many pairs
var VIEW_PRICES_ASSET_PAIRS_REFRESH_EVERY = 5 * 60 * 1000; //refresh asset pair market info every 5 minutes
var VIEW_PRICES_NUM_LATEST_TRADES = 50; //show this many latest trades on the view prices page
var VIEW_PRICES_LATEST_TRADES_REFRESH_EVERY = 5 * 60 * 1000; //refresh latest trades every 5 minutes

var MARKET_INFO_REFRESH_EVERY = 5 * 60 * 1000; //refresh market info every 5 minutes while enabled (on buy/sell page, and view prices page) 

var CHAT_NUM_USERS_ONLINE_REFRESH_EVERY = 5 * 60 * 1000; //refresh online user count every 5 minutes while enabled

var NUM_BLOCKS_TO_WAIT_FOR_BTCPAY = 6; //number of blocks to wait until the user can make a BTCpay on an order match where they owe BTC

var ALLOW_UNCONFIRMED_INPUTS = true;  // allow use unconfirmed unspents

var ACTION_PENDING_NOTICE = "<b><u>This action will take some time to complete</u></b>, and will appear as a Pending Action until"
  + " confirmed on the network. <b class='errorColor'>Until that time, the wallet will not reflect the change. Please be patient.</b>";

var ARMORY_OFFLINE_TX_PREFIX = "=====TXSIGCOLLECT-";

var DEFAULT_PREFERENCES = {
  'num_addresses_used': DEFAULT_NUM_ADDRESSES,
  'address_aliases': {},
  'selected_theme': 'ultraLight',
  'selected_lang': 'en-us',
  'watch_only_addresses': [],
  'armory_offline_addresses': [],
  'auto_btcpay': true, //default to auto BTC payments being enabled
  'has_accepted_license': false
};

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
var USER_COUNTRY = ''; //set in login.js
var CURRENT_PAGE_URL = ''; // set in loadUrl()

//selective disablement
var DISABLED_FEATURES_SUPPORTED = ['betting', 'rps', 'dividend', 'exchange', 'leaderboard', 'portfolio', 'stats', 'history']; //what can be disabled
var DISABLED_FEATURES = []; //set in counterwallet.js

// restricted action
var RESTRICTED_AREA = {
  'pages/betting.html': ['US'],
  'pages/openbets.html': ['US'],
  'pages/matchedbets.html': ['US'],
  'pages/rps.html': ['US'],
  'dividend': ['US']
}

var MAX_SUPPORT_CASE_PROBLEM_LEN = 4096;
var QUOTE_ASSETS = []; // initalized with counterblock is_ready()
