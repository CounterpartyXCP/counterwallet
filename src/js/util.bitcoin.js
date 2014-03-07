function normalizeAmount(amount, divisible) {
  //Converts from satoshi (int) to float (decimal form)
  if(typeof(divisible)==='undefined') divisible = true;
  return divisible ? Decimal.round(new Decimal(amount).div(UNIT), 8).toFloat() : parseInt(amount);
}

function hashToB64(content) {
  //used for storing address alias data, for instance
  return Bitcoin.convert.bytesToBase64(Bitcoin.Crypto.SHA256(content, {asBytes: true}));  
}

function denormalizeAmount(amount, divisible) {
  //Converts from float (decimal form) to satoshi (int) 
  if(typeof(divisible)==='undefined') divisible = true;
  return divisible ? Decimal.round(new Decimal(amount).mul(UNIT), 8).toFloat() : parseInt(amount);
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

function dumpScript(script) { /* orig from tx.js (public domain) */
    var out = [];
    for (var i = 0; i < script.chunks.length; i++) {
        var chunk = script.chunks[i];
        var op = new Bitcoin.Opcode(chunk);
        typeof chunk == 'number' ?  out.push(op.toString()) :
            out.push(Bitcoin.convert.bytesToHex(chunk));
    }
    return out.join(' ');
}

function parseUnspentTxnsList(txs) { 
  assert(txs);
  delete unspenttxs;
  var unspenttxs = {};
  var balance = Bitcoin.BigInteger.ZERO;
  for(var i = 0; i < txs.length; i++) {
      var o = txs[i];
      var lilendHash = o.txid;

      //convert script back to BBE-compatible text
      var script = dumpScript( new Bitcoin.Script(Bitcoin.convert.hexToBytes(o.scriptPubKey)) );

      var value = new Bitcoin.BigInteger('' + (o.amount * UNIT), 10);
      if (!(lilendHash in unspenttxs))
          unspenttxs[lilendHash] = {};
      unspenttxs[lilendHash][o.vout] = {amount: value, scriptText: script, script: o.scriptPubKey};
      balance = balance.add(value);
  }
  return {balance:balance, unspentTxs: unspenttxs};
}


function testnetBurnDetermineEarned(blockHeight, burned) {
  //burned is the amount of BTC to burn (as a float -- normalized value)
  //XCP amount returned is as a float -- normalized value
  burned = denormalizeAmount(burned);
  var total_time = TESTNET_BURN_END - TESTNET_BURN_START;
  var partial_time = TESTNET_BURN_END - blockHeight;
  var multiplier = 1000 * (1 + .5 * (partial_time / total_time)); //will be approximate
  var earned = Decimal.round(new Decimal(burned).mul(multiplier), 8).toFloat();
  return normalizeAmount(earned);
}
