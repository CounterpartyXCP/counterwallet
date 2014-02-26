var PREFERENCES = {}; //set when logging in

var MAX_ADDRESSES = 20; //totall arbitrary :)
var MAX_INT = Math.pow(2, 63) - 1;
var UNIT = 100000000; //# satoshis in whole
var MIN_PRIME_BALANCE = 50000; //in satoshis ... == .0005
var IS_DEV = document.URL.indexOf("counterwallet.com") < 0;
var USE_TESTNET = null; //populated on login (from is_ready API call response)

var counterwalletd_urls = null;

if(!IS_DEV) { //Production setup
  counterwalletd_urls = [
    {'api': "https://cw01.counterparty.co/_api/", 'feed': "https://cw01.counterparty.co/_feed/", 'chat': "https://cw01.counterparty.co/_chat/"},
    {'api': "https://cw02.counterparty.co/_api/", 'feed': "https://cw02.counterparty.co/_feed/", 'chat': "https://cw02.counterparty.co/_chat/"},
    {'api': "https://cw03.counterparty.co/_api/", 'feed': "https://cw03.counterparty.co/_feed/", 'chat': "https://cw03.counterparty.co/_chat/"}
  ];
} else { //Development setup
  counterwalletd_urls = [
    {'api': "http://xcpdev01/_api/", 'feed': "http://xcpdev01/_feed/", 'chat': "http://xcpdev01/_chat/"}
    // ^ NOTE to developers: No need to modify the above, just insert an entry in your hosts file for xcpdev01
  ];
}

//randomly shuffle the list to decide the server try order...
counterwalletd_urls = shuffle(counterwalletd_urls);
//console.log("Server list: " + JSON.stringify(counterwalletd_urls));
var counterwalletd_api_urls = jQuery.map(counterwalletd_urls, function(element) { return jQuery(element).attr('api'); });
var counterwalletd_feed_urls = jQuery.map(counterwalletd_urls, function(element) { return jQuery(element).attr('feed'); });
var counterwalletd_chat_urls = jQuery.map(counterwalletd_urls, function(element) { return jQuery(element).attr('chat'); });

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


/*
 * Primary site init (thanks to knockout.js, this is where all the "magic" does NOT happen :)
 */
$(document).ready(function() {
  //Set up logging (jqlog)
  $.jqlog.enabled(true);
  
  //Set up form validation
  //$("input,select,textarea").not("[type=submit]").jqBootstrapValidation();
  
  //Reject cruddy old browsers
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
