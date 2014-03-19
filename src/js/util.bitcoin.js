
function normalizeQuantity(quantity, divisible) {
  //Converts from satoshi (int) to float (decimal form)
  if(typeof(divisible)==='undefined') divisible = true;
  return divisible && quantity !== 0 ? Decimal.round(new Decimal(quantity).div(UNIT), 8).toFloat() : parseInt(quantity);
  //^ we have the quantity !== 0 check due to a bug in Decimal (https://github.com/hiroshi-manabe/JSDecimal/issues/2)
}

function denormalizeQuantity(quantity, divisible) {
  //Converts from float (decimal form) to satoshi (int) 
  if(typeof(divisible)==='undefined') divisible = true;
  return divisible && quantity !== 0 ? Decimal.round(new Decimal(quantity).mul(UNIT), 8).toFloat() : parseInt(quantity);
  //^ we have the quantity !== 0 check due to a bug in Decimal (https://github.com/hiroshi-manabe/JSDecimal/issues/2)
}

function hashToB64(content) {
  //used for storing address alias data, for instance
  //return Bitcoin.Crypto.SHA256(content).toString(Bitcoin.Crypto.enc.Base64);
  return Bitcoin.convert.bytesToBase64(Bitcoin.Crypto.SHA256(content, {asBytes: true}));  
}

function smartFormat(num) { //arbitrary rules to make quantities formatted a bit more friendly
  //if(num > 10) num = Decimal.round(new Decimal(num), 4).toFloat();
  if(num > 10) num = +num.toFixed(4); //use + sign to lob off any trailing zeros...
  return numberWithCommas(num);
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
  var qr = qrcode(3, 'M');
  addr = addr.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
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

function randomGetBytes(numBytes) {
     var randomBytes = null;
    if (window.crypto && window.crypto.getRandomValues) {
        // First we're going to try to use a built-in CSPRNG (newer Chrome, Firefox, etc)
        randomBytes = new Uint8Array(numBytes);
        window.crypto.getRandomValues(randomBytes);
    } else if (window.msCrypto && window.msCrypto.getRandomValues) {
        // Because of course IE calls it msCrypto instead of being standard
        randomBytes = new Uint8Array(numBytes);
        window.msCrypto.getRandomValues(randomBytes);
    } else {
        //Fallback to SecureRandom, for older browsers
        randomBytes = new Array(numBytes);
        rng_get_bytes(randomBytes);
    }
    return randomBytes;
}

function testnetBurnDetermineEarned(blockHeight, burned) {
  //burned is the quantity of BTC to burn (as a float -- normalized value)
  //XCP quantity returned is as a float -- normalized value
  burned = denormalizeQuantity(burned);
  var total_time = TESTNET_BURN_END - TESTNET_BURN_START;
  var partial_time = TESTNET_BURN_END - blockHeight;
  var multiplier = 1000 * (1 + .5 * (partial_time / total_time)); //will be approximate
  var earned = Decimal.round(new Decimal(burned).mul(multiplier), 8).toFloat();
  return normalizeQuantity(earned);
}

function primeAddress(address, numNewPrimedTxouts, utxosData, onSuccess) {
  //construct a transaction
  var sendTx = new Bitcoin.Transaction();
  var inputQuantity = (numNewPrimedTxouts * MIN_PRIME_BALANCE) + MIN_FEE; //in satoshi
  var inputQuantityRemaining = inputQuantity;
  var txHash = null, txOutputN = null, txIn = null;
  //Create inputs, using smallest quantity of the highest value UTXOs possible (to avoid
  // consuming our small primed inputs, which would be counterproductive :)
  utxosData.sort(function(a, b) { return b['amount'] - a['amount']; }); //sort descending on output value  
  for(var i=0; i < utxosData.length; i++) {
      txIn = new Bitcoin.TransactionIn({
        outpoint: {
          hash: utxosData[i]['txid'],
          index: utxosData[i]['vout']
        }
      });
      sendTx.addInput(txIn);
      sendTx.ins[i].script = Bitcoin.Script.fromHex(utxosData[i]['scriptPubKey']);
      inputQuantityRemaining -= denormalizeQuantity(utxosData[i]['amount']);
      if(inputQuantityRemaining <= 0)
        break;
  } 
  assert(inputQuantityRemaining <= 0, "Insufficient confirmed bitcoin balance to prime account: " + address);
  
  //Create outputs for the priming itself (x MIN_PRIME_BALANCE BTC outputs)
  for(var i=0; i < numNewPrimedTxouts; i++) {
    sendTx.addOutput(address, MIN_PRIME_BALANCE);
  }
  //Create an output for change
  var changeQuantity = Math.abs(inputQuantityRemaining);
  sendTx.addOutput(address, changeQuantity);
  //^ The remaining should be MIN_FEE, which will of course go to the miners
  
  var rawTxHex = sendTx.serializeHex();
  WALLET.signAndBroadcastTx(address, rawTxHex, function(primingTxHash, endpoint) {
    PENDING_ACTION_FEED.add(primingTxHash, "_primeaddrs", {
      'source': address,
      'numNewPrimedTxouts': numNewPrimedTxouts
    });
    return onSuccess(address, numNewPrimedTxouts);
  });
}
