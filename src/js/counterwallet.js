var PREFERENCES = {}; //set when logging in
var MAX_ADDRESSES = 20; //totall arbitrary :)

var MAX_INT = Math.pow(2, 63) - 1;
var UNIT = 100000000; //# satoshis in whole

var counterwalletd_urls = null;
var IS_DEV = document.URL.indexOf("counterwallet.com") < 0;

if(!IS_DEV) { //Production setup
  counterwalletd_urls = [
    {'api': "https://cw01.counterparty.co/_/api/", 'feed': "https://cw01.counterparty.co/_/feed/", 'chat': "https://cw01.counterparty.co/_/chat/"},
    {'api': "https://cw02.counterparty.co/_/api/", 'feed': "https://cw02.counterparty.co/_/feed/", 'chat': "https://cw02.counterparty.co/_/chat/"}
  ];
} else { //Development setup
  counterwalletd_urls = [
    {'api': "http://10.10.20.89:4100/jsonrpc/", 'feed': "http://10.10.20.89:4101/", 'chat': "http://10.10.20.89:4102/"}
  ];
}

//randomly shuffle the list to decide the server try order...
counterwalletd_urls = shuffle(counterwalletd_urls);
console.log("Server list: " + JSON.stringify(counterwalletd_urls));
var counterwalletd_api_urls = jQuery.map(counterwalletd_urls, function(element) { return jQuery(element).attr('api'); });
var counterwalletd_feed_urls = jQuery.map(counterwalletd_urls, function(element) { return jQuery(element).attr('feed'); });
var counterwalletd_chat_urls = jQuery.map(counterwalletd_urls, function(element) { return jQuery(element).attr('chat'); });

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


