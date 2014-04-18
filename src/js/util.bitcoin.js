
function normalizeQuantity(quantity, divisible) {
  //Converts from satoshi (int) to float (decimal form)
  if(typeof(divisible)==='undefined') divisible = true;
  return divisible && quantity !== 0 ? Decimal.round(new Decimal(quantity).div(UNIT), 8, Decimal.MidpointRounding.ToEven).toFloat() : parseInt(quantity);
  //^ we have the quantity !== 0 check due to a bug in Decimal (https://github.com/hiroshi-manabe/JSDecimal/issues/2)
}

function denormalizeQuantity(quantity, divisible) {
  //Converts from float (decimal form) to satoshi (int) 
  if(typeof(divisible)==='undefined') divisible = true;
  return divisible && quantity !== 0 ? Decimal.round(new Decimal(quantity).mul(UNIT), 8, Decimal.MidpointRounding.ToEven).toFloat() : parseInt(quantity);
  //^ we have the quantity !== 0 check due to a bug in Decimal (https://github.com/hiroshi-manabe/JSDecimal/issues/2)
}

function hashToB64(content) {
  //used for storing address alias data, for instance
  //return Bitcoin.Crypto.SHA256(content).toString(Bitcoin.Crypto.enc.Base64);  
  return Bitcoin.convert.bytesToBase64(Bitcoin.crypto.sha256(content));
}

function smartFormat(num, truncateDecimalPlacesAtMin, truncateDecimalPlacesTo) { //arbitrary rules to make quantities formatted a bit more friendly
  if(num === null || isNaN(num)) return '??';
  if(num === 0) return num; //avoid Decimal class issue dealing with 0
  if(typeof(truncateDecimalPlacesMin)==='undefined' || truncateDecimalPlacesMin === null) truncateDecimalPlacesMin = null;
  if(typeof(truncateDecimalPlacesTo)==='undefined') truncateDecimalPlacesTo = 4;
  if(truncateDecimalPlacesAtMin === null || num > truncateDecimalPlacesAtMin) {
    num = Decimal.round(new Decimal(num), truncateDecimalPlacesTo, Decimal.MidpointRounding.ToEven).toFloat();
  }
  return numberWithCommas(noExponents(num));
}

function assetsToAssetPair(asset1, asset2) {
  //NOTE: This MUST use the same logic/rules as counterwalletd's assets_to_asset_pair() function in lib/util.py
  var base = null;
  var quote = null;
  if(asset1 == 'XCP' || asset2 == 'XCP') {
      base = asset1 == 'XCP' ? asset1 : asset2;
      quote = asset1 == 'XCP' ? asset2 : asset1;
  } else if(asset1 == 'BTC' || asset2 == 'BTC') {
      base = asset1 == 'BTC' ? asset1 : asset2;
      quote = asset1 == 'BTC' ? asset2 : asset1;
  } else {
      base = asset1 < asset2 ? asset1 : asset2;
      quote = asset1 < asset2 ? asset2 : asset1;
  }
  return [base, quote];
}

function makeQRCode(addr) {
  $.jqlog.debug('Generate Qrcode: '+addr);

  addr = addr.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');

  var qr = qrcode(3, 'M');
  qr.addData(addr);
  qr.make();

  return qr.createImgTag(4);  
}

function getLinkForCPData(type, dataID, dataTitle, htmlize) {
  if(typeof(dataTitle)==='undefined' || dataTitle === null) dataTitle = dataID;
  if(typeof(htmlize)==='undefined' || htmlize === null) htmlize = true;
  if(typeof(type)==='undefined') type = 'tx';
  var url = null;
  if(type == 'address') { //dataID is an address
    url = "http://blockscan.com/address.aspx?q=" + dataID;
  } else if(type == 'order') { //txID is an order ID
    url = "http://blockscan.com/order.aspx?q=" + dataID;
  } else if(type == 'tx') { //generic TX
    url = "http://blockscan.com/tx.aspx?q=" + dataID;
  } else {
    assert(false, "Unknown type of " + type);
  }
  if(USE_TESTNET) {
    return dataTitle ? dataTitle : dataID; //blockscan not for testnet currently
  } else {
    return htmlize ? ('<a href="' + url + '" target="_blank">' + dataTitle + '</a>') : url;  
  }
}

function getTxHashLink(hash) {
  // TODO: add link to blockscan when possible
  var shortHash = hash.substr(hash.length-5);
  var link = '<span rel="tooltip" title="'+hash+'" data-placement="top" data-container="body" class="shortHash">'+shortHash+'</span>';

  return link;
}

function getLinkForBlock(blockIndex, dataTitle, htmlize) {
  if(typeof(dataTitle)==='undefined' || dataTitle === null) dataTitle = blockIndex;
  if(typeof(htmlize)==='undefined' || htmlize === null) htmlize = true;
  var url = BLOCKEXPLORER_URL + '/block-index/' + blockIndex;
  return htmlize ? '<a href="' + url + '" target="_blank">' + dataTitle + '</a>' : url;
}

function getAddressLabel(address) {
  //gets the address label if the address is in this wallet
  return PREFERENCES['address_aliases'][hashToB64(address)] || address;
}

function testnetBurnDetermineEarned(blockHeight, burned) {
  //burned is the quantity of BTC to burn (as a float -- normalized value)
  //XCP quantity returned is as a float -- normalized value
  burned = denormalizeQuantity(burned);
  var total_time = TESTNET_BURN_END - TESTNET_BURN_START;
  var partial_time = TESTNET_BURN_END - blockHeight;
  var multiplier = 1000 * (1 + .5 * (partial_time / total_time)); //will be approximate
  var earned = Decimal.round(new Decimal(burned).mul(multiplier), 8, Decimal.MidpointRounding.ToEven).toFloat();
  return normalizeQuantity(earned);
}

/*
Blockchain info uses a simple Base58.encode as defaut format.
Bitcoinjs-lib detect a Base64 format because length is also 44
Here we assume that if key length is 44 and not end by = we have
a blockchain.info base58 encoded key.
TODO: it's true also for the last bitcoinjs version=> make a PR
*/
function isBase58BlockchainInfoKey(privateKey) {
  return privateKey.length==44 && privateKey.indexOf("=")==-1;
}

function BitcoinECKey(privateKey) {
  if (isBase58BlockchainInfoKey(privateKey)) {
    privateKey = Bitcoin.base58.decode(privateKey);
    return Bitcoin.ECKey(privateKey);
  }
  return Bitcoin.ECKey(privateKey);
}

