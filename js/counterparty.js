
/*
 * Basic counterparty Javascript implementation
 * 
 * Requires: struct.js (modified to add support for unsigned long long - 'Q')
 * 
 * NOTE: currently incomplete!!
 */

//Some protocol constants
var TESTNET = false; //work on mainnet
var PREFIX = 'XX';
var ADDRESSVERSION = '\x00';
var BLOCK_FIRST = 278270;
var BURN_START = 278310;
var BURN_END = 283810;
var UNSPENDABLE = '1CounterpartyXXXXXXXXXXXXXXXUWLpVr';
if(TESTNET) {
  PREFIX = 'CNTRPRTY';
  ADDRESSVERSION = '\x6f';
  BLOCK_FIRST = 154908;
  BURN_START = 154908;
  BURN_END = 4017708;    //Fifty years, at ten minutes per block.
  UNSPENDABLE = 'mvCounterpartyXXXXXXXXXXXXXXW24Hef';
}

var TXTYPE_FORMAT = '>I';
var B26_DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';


function is_valid_asset_name(asset_name) {
  if(!asset_name) return false;
  if(asset_name == 'BTC' || asset_name == 'XCP') return false;
  return asset_name.match(/[A-Z]{4,25}/g);
}

function get_asset_id(asset_name) {
  if(!is_valid_asset_name(asset)) return null;
  if(asset == 'BTC') return 0
  if(asset == 'XCP') return 1
  
  //convert base 26 string into an integer
  var n = 0;
  var s = asset_name;
  var digit = null;
  for(var i=0;i<asset_name.length;i++) {
    n *= 26;
    digit = B26_DIGITS.indexOf(asset_name.charAt(i));
    n += digit;
  }
  return n;
}

/*
 * These functions compose Counterparty do_ type transactions, with some sanity checking.
 * (Not all sanity checking is present -- specifically, most server-side checks are not present. For those,
 *   we'll have to rely on the check logic in counterpartyd itself, which is fine and probably proper)
 */
function create_issuance(source, quantity, asset, divisible, transfer_destination, unsigned) {
  var FORMAT = '>QQ?';
  var ID = 20;
  var LENGTH = 8 + 8 + 1;
  
  if(!is_valid_asset_name(asset)) return false;
  
  var asset_id = get_asset_id(asset);
  var data = PREFIX + Pack(TXTYPE_FORMAT, ID); 
  data += Pack(FORMAT, asset_id, amount, divisible);
  
}
