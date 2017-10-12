function normalizeQuantity(quantity, divisible) {
  //Converts from satoshi (int) to float (decimal form)
  if (typeof(divisible) === 'undefined') divisible = true;
  return divisible && quantity !== 0 ? Decimal.round(new Decimal(quantity).div(UNIT), 8, Decimal.MidpointRounding.ToEven).toFloat() : parseInt(quantity);
  //^ we have the quantity !== 0 check due to a bug in Decimal (https://github.com/hiroshi-manabe/JSDecimal/issues/2)
}

function denormalizeQuantity(quantity, divisible) {
  //Converts from float (decimal form) to satoshi (int) 
  if (typeof(divisible) === 'undefined') divisible = true;
  return divisible && quantity !== 0 ? Decimal.round(new Decimal(quantity).mul(UNIT), 8, Decimal.MidpointRounding.ToEven).toFloat() : parseInt(quantity);
  //^ we have the quantity !== 0 check due to a bug in Decimal (https://github.com/hiroshi-manabe/JSDecimal/issues/2)
}

function roundAmount(amount) {
  return Decimal.round(new Decimal(amount), 8, Decimal.MidpointRounding.ToEven).toString();
}

function addFloat(floatA, floatB) {
  var a = new Decimal(floatA);
  var b = new Decimal(floatB);
  return Decimal.round(a.add(b), 8, Decimal.MidpointRounding.ToEven).toFloat();
}

function subFloat(floatA, floatB) {
  return addFloat(floatA, -floatB);
}

function mulFloat(floatA, floatB) {
  var a = new Decimal(floatA);
  var b = new Decimal(floatB);
  return Decimal.round(a.mul(b), 8, Decimal.MidpointRounding.ToEven).toFloat();
}

function divFloat(floatA, floatB) {
  var a = new Decimal(floatA);
  var b = new Decimal(floatB);
  return Decimal.round(a.div(b), 8, Decimal.MidpointRounding.ToEven).toFloat();
}

function hashToB64(content) {
  //used for storing address alias data, for instance
  return CryptoJS.SHA256(content).toString(CryptoJS.enc.Base64);
}

function smartFormat(num, truncateDecimalPlacesAtMin, truncateDecimalPlacesTo) { //arbitrary rules to make quantities formatted a bit more friendly
  if (num === null || isNaN(num)) return '??';
  if (num === 0) return num; //avoid Decimal class issue dealing with 0
  if (typeof(truncateDecimalPlacesAtMin) === 'undefined' || truncateDecimalPlacesAtMin === null) truncateDecimalPlacesAtMin = null;
  if (typeof(truncateDecimalPlacesTo) === 'undefined') truncateDecimalPlacesTo = 4;
  if (truncateDecimalPlacesAtMin === null || num > truncateDecimalPlacesAtMin) {
    num = Decimal.round(new Decimal(num), truncateDecimalPlacesTo, Decimal.MidpointRounding.ToEven).toFloat();
  }
  return numberWithCommas(noExponents(num));
}

function formatFiat(num) {
  if (num === null || isNaN(num)) return '??';

  return num.toFixed(2).replace(/./g, function(c, i, a) {
      return i && c !== "." && ((a.length - i) % 3 === 0) ? ',' + c : c;
  });
}

function assetsToAssetPair(asset1, asset2) {
  //NOTE: This MUST use the same logic/rules as counterblockd's assets_to_asset_pair() function in lib/util.py
  var base = null;
  var quote = null;

  for (var i in QUOTE_ASSETS) {
    if (asset1 == QUOTE_ASSETS[i] || asset2 == QUOTE_ASSETS[i]) {
      base = asset1 == QUOTE_ASSETS[i] ? asset2 : asset1;
      quote = asset1 == QUOTE_ASSETS[i] ? asset1 : asset2;
      break;
    }
  }

  if (!base) {
    base = asset1 < asset2 ? asset1 : asset2;
    quote = asset1 < asset2 ? asset2 : asset1;
  }

  return [base, quote];
}

function makeQRCode(addr) {
  $.jqlog.debug('Generate Qrcode: ' + addr);

  addr = addr.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');

  var qr = qrcode(3, 'M');
  qr.addData(addr);
  qr.make();

  return qr.createImgTag(4);
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

// from bitcoinjs-lib
function bytesToBase64(bytes) {
  var base64map = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  var base64 = []

  for (var i = 0; i < bytes.length; i += 3) {
    var triplet = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    for (var j = 0; j < 4; j++) {
      if (i * 8 + j * 6 <= bytes.length * 8) {
        base64.push(base64map.charAt((triplet >>> 6 * (3 - j)) & 0x3F))
      } else {
        base64.push('=')
      }
    }
  }

  return base64.join('')
}

function stringToBytes(string) {
  return string.split('').map(function(x) {
    return x.charCodeAt(0)
  })
}

function bytesToWords(bytes) {
  var words = []
  for (var i = 0, b = 0; i < bytes.length; i++, b += 8) {
    words[b >>> 5] |= bytes[i] << (24 - b % 32)
  }
  return words
}

function wordsToBytes(words) {
  var bytes = []
  for (var b = 0; b < words.length * 32; b += 8) {
    bytes.push((words[b >>> 5] >>> (24 - b % 32)) & 0xFF)
  }
  return bytes
}

function bytesToWordArray(bytes) {
  return new CryptoJS.lib.WordArray.init(bytesToWords(bytes), bytes.length)
}

function wordArrayToBytes(wordArray) {
  return wordsToBytes(wordArray.words)
}

