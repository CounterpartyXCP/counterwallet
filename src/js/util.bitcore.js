/* globals async */ // async binds itself to window

var bitcore = require('bitcore-lib');
var bitcoreMessage = require('bitcore-message'); // this also binds itself to bitcore.Message as soon as it's require'd

// this 'global' is overwritten by tests!
var NETWORK = USE_TESTNET ? bitcore.Networks.testnet : bitcore.Networks.livenet;

var CWHierarchicalKey = function(passphrase, password) {
  checkArgType(passphrase, "string");
  if (password) {
    checkArgType(password, "string");
    passphrase = CWBitcore.decrypt(passphrase, password);
  }
  // same as bitcoinjs-lib :
  // m : masterkery / 0' : first private derivation / 0 : external account / i : index
  this.basePath = 'm/0\'/0/';
  this.useOldHierarchicalKey = false;
  this.init(passphrase);
}

CWHierarchicalKey.prototype.init = function(passphrase) {
  this.passphrase = passphrase;

  var words = $.trim(passphrase.toLowerCase()).split(' ');

  // if first word == 'old' then use the  oldHierarchicalKey
  if (words.length == 13) {
    var first = words.shift();
    if (first == 'old') {
      this.useOldHierarchicalKey = true;
    } else {
      throw new Error("mnemonic was 13 words but fist was not 'old'");
    }
  }

  var seed = CWHierarchicalKey.wordsToSeed(words);

  /*
   * for historical reasons we create an 'old' HDPrivateKey where the seed is used as a string and wrangled a bit
   * this is used for sweeping the old wallet into the new wallet
   */
  this.oldHierarchicalKey = bitcore.HDPrivateKey.fromSeed(bitcore.deps.Buffer(wordArrayToBytes(bytesToWordArray(seed)), 'ascii'), NETWORK);
  this.HierarchicalKey = this.useOldHierarchicalKey ? this.oldHierarchicalKey : bitcore.HDPrivateKey.fromSeed(seed, NETWORK);
}

CWHierarchicalKey.wordsToSeed = function(words) {
  var m = new Mnemonic(words);
  return m.toHex();
}

CWHierarchicalKey.prototype.getOldAddressesInfos = function(callback) {
  var addresses = [];
  var cwkeys = {};

  for (var i = 0; i <= 9; i++) {

    var derivedKey = this.oldHierarchicalKey.derive(this.basePath + i);

    var cwk = new CWPrivateKey(derivedKey.privateKey);
    var address = cwk.getAddress();
    addresses.push(address);
    cwkeys[address] = cwk;
  }

  Counterblock.getBalances(addresses, cwkeys, callback);
}

CWHierarchicalKey.prototype.getAddressKey = function(index) {
  checkArgType(index, "number");
  var derivedKey = this.HierarchicalKey.derive(this.basePath + index);
  return new CWPrivateKey(derivedKey.privateKey);
}

CWHierarchicalKey.prototype.cryptPassphrase = function(password) {
  return CWBitcore.encrypt(this.passphrase, password);
}

CWHierarchicalKey.prototype.getQuickUrl = function(password) {
  var url = location.protocol + '//' + location.hostname + '/#cp=';
  url += this.cryptPassphrase(password);
  return url;
}


// priv: private key wif or hex
var CWPrivateKey = function(priv) {
  this.priv = null;
  this.init(priv);
}

CWPrivateKey.prototype.init = function(priv) {
  try {
    if (typeof priv === "string") {
      priv = bitcore.PrivateKey(priv, NETWORK);
    }
    this.priv = priv;
  } catch (err) {
    this.priv = null;
  }
}

CWPrivateKey.prototype.getAddress = function() {
  return this.priv.toAddress(NETWORK).toString();
}

CWPrivateKey.prototype.getAltAddress = function() {
  var tmpPriv = this.priv.toObject();
  tmpPriv.compressed = !tmpPriv.compressed;

  return bitcore.PrivateKey(tmpPriv).toAddress(NETWORK).toString();
}

CWPrivateKey.prototype.getAddresses = function() {
  return [
    this.getAddress(),
    this.getAltAddress()
  ];
}

CWPrivateKey.prototype.isValid = function() {
  try {
    return bitcore.Address.isValid(this.getAddress(), NETWORK, bitcore.Address.Pay2PubKeyHash);
  } catch (err) {
    return false;
  }
}

CWPrivateKey.prototype.getPub = function() {
  try {
    return this.priv.toPublicKey().toString();
  } catch (err) {
    return false;
  }
}

/**
 * @param {string} message
 * @param {string} format    hex, base64
 * @returns {*}
 */
CWPrivateKey.prototype.signMessage = function(message, format) {
  var base64 = bitcore.Message(message).sign(this.priv); // always returns base64 string
  return bitcore.deps.Buffer(base64, 'base64').toString(format || 'base64');
}

CWPrivateKey.prototype.signRawTransaction = function(unsignedHex, disableIsFullySigned, cb) {
  if (typeof disableIsFullySigned === "function") {
    cb = disableIsFullySigned;
    disableIsFullySigned = null;
  }
  checkArgType(cb, "function");

  try {
    CWBitcore.signRawTransaction(unsignedHex, this, disableIsFullySigned, cb);
  } catch (err) {
    // async.nextTick to avoid parent trycatch
    async.nextTick(function() {
      cb(err);
    });
  }
}

CWPrivateKey.prototype.checkTransactionDest = function(txHex, destAdress) {
  checkArgsType(arguments, ["string", "object"]);
  try {
    return CWBitcore.checkTransactionDest(txHex, this.getAddresses(), destAdress);
  } catch (err) {
    return false;
  }
}

CWPrivateKey.prototype.checkAndSignRawTransaction = function(unsignedHex, destAdress, disableIsFullySigned, cb) {
  if (typeof(destAdress) == 'string') {
    destAdress = [destAdress];
  }
  if (typeof disableIsFullySigned === "function") {
    cb = disableIsFullySigned;
    disableIsFullySigned = null;
  }
  checkArgType(cb, "function");

  try {
    if (this.checkTransactionDest(unsignedHex, destAdress)) {
      this.signRawTransaction(unsignedHex, disableIsFullySigned, cb);
    } else {
      throw new Error("Failed to validate transaction destination");
    }
  } catch (err) {
    // async.nextTick to avoid parent trycatch
    async.nextTick(function() {
      cb(err);
    });
  }
}

CWPrivateKey.prototype.getWIF = function() {
  return this.priv.toWIF();
}

CWPrivateKey.prototype.encrypt = function(message) {
  return CWBitcore.encrypt(message, this.priv.toString());
}

CWPrivateKey.prototype.decrypt = function(cryptedMessage) {
  return CWBitcore.decrypt(cryptedMessage, this.priv.toString());
}

// TODO: rename to be more generic
var CWBitcore = {}

/**
 *
 * @param {bitcore.Script} script
 * @returns {boolean}
 */
CWBitcore.isOutScript = function(script) {
  return script.isPublicKeyOut() ||
    script.isPublicKeyHashOut() ||
    script.isMultisigOut() ||
    script.isScriptHashOut() ||
    script.isDataOut();
}

CWBitcore.isValidAddress = function(val) {
  try {
    return bitcore.Address.isValid(val, NETWORK, bitcore.Address.Pay2PubKeyHash);
  } catch (err) {
    return false;
  }
}

CWBitcore.isValidMultisigAddress = function(val) {
  try {
    var addresses = val.split("_");
    if (addresses.length != 4 && addresses.length != 5) {
      return false;
    }
    var required = parseInt(addresses.shift());
    var provided = parseInt(addresses.pop());
    if (isNaN(required) || isNaN(provided) || provided != addresses.length || required > provided || required < 1) {
      return false;
    }
    for (var a = 0; a < addresses.length; a++) {
      if (!CWBitcore.isValidAddress(addresses[a])) {
        return false;
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

CWBitcore.MultisigAddressToAddresses = function(val) {

  if (CWBitcore.isValidAddress(val)) {
    return [val];
  } else if (CWBitcore.isValidMultisigAddress(val)) {
    var addresses = val.split("_");
    addresses.shift();
    addresses.pop();

    return addresses;
  } else {
    return [];
  }
}

CWBitcore.genKeyMap = function(cwPrivateKeys) {
  var wkMap = {};
  cwPrivateKeys.forEach(function(cwPrivateKey) {
    wkMap[cwPrivateKey.getAddress()] = cwPrivateKey.priv;
  });

  return wkMap;
}

/**
 *
 * @param {string} unsignedHex
 * @param {CWPrivateKey} cwPrivateKey
 * @param {boolean|function} [disableIsFullySigned]
 * @param {function} cb
 * @returns {*}
 */
CWBitcore.signRawTransaction = function(unsignedHex, cwPrivateKey, disableIsFullySigned, cb) {
  // make disableIsFullySigned optional
  if (typeof disableIsFullySigned === "function") {
    cb = disableIsFullySigned;
    disableIsFullySigned = null;
  }
  checkArgType(unsignedHex, "string");
  checkArgType(cwPrivateKey, "object");
  checkArgType(cb, "function");

  try {
    var tx = bitcore.Transaction(unsignedHex);

    var keyMap = CWBitcore.genKeyMap([cwPrivateKey]);
    var keyChain = [];

    async.forEachOf(
      tx.inputs,
      function(input, idx, cb) {
        (function(cb) {
          var inputObj;

          // dissect what was set as input script to use it as output script
          var script = bitcore.Script(input._scriptBuffer.toString('hex'));
          var multiSigInfo;
          var addresses = [];

          switch (script.classify()) {
            case bitcore.Script.types.PUBKEY_OUT:
              inputObj = input.toObject();
              inputObj.output = bitcore.Transaction.Output({
                script: input._scriptBuffer.toString('hex'),
                satoshis: 0 // we don't know this value, setting 0 because otherwise it's going to cry about not being an INT
              });
              tx.inputs[idx] = new bitcore.Transaction.Input.PublicKey(inputObj);

              addresses = [script.toAddress(NETWORK).toString()];

              return cb(null, addresses);

            case bitcore.Script.types.PUBKEYHASH_OUT:
              inputObj = input.toObject();
              inputObj.output = bitcore.Transaction.Output({
                script: input._scriptBuffer.toString('hex'),
                satoshis: 0 // we don't know this value, setting 0 because otherwise it's going to cry about not being an INT
              });
              tx.inputs[idx] = new bitcore.Transaction.Input.PublicKeyHash(inputObj);

              addresses = [script.toAddress(NETWORK).toString()];

              return cb(null, addresses);

            case bitcore.Script.types.MULTISIG_IN:
              inputObj = input.toObject();

              return failoverAPI(
                'get_script_pub_key',
                {tx_hash: inputObj.prevTxId, vout_index: inputObj.outputIndex},
                function(data) {
                  inputObj.output = bitcore.Transaction.Output({
                    script: data['scriptPubKey']['hex'],
                    satoshis: bitcore.Unit.fromBTC(data['value']).toSatoshis()
                  });

                  multiSigInfo = CWBitcore.extractMultiSigInfoFromScript(inputObj.output.script);

                  inputObj.signatures = bitcore.Transaction.Input.MultiSig.normalizeSignatures(
                    tx,
                    new bitcore.Transaction.Input.MultiSig(inputObj, multiSigInfo.publicKeys, multiSigInfo.threshold),
                    idx,
                    script.chunks.slice(1, script.chunks.length).map(function(s) { return s.buf; }),
                    multiSigInfo.publicKeys
                  );

                  tx.inputs[idx] = new bitcore.Transaction.Input.MultiSig(inputObj, multiSigInfo.publicKeys, multiSigInfo.threshold);

                  addresses = CWBitcore.extractMultiSigAddressesFromScript(inputObj.output.script);

                  return cb(null, addresses);
                }
              );

            case bitcore.Script.types.MULTISIG_OUT:
              inputObj = input.toObject();
              inputObj.output = bitcore.Transaction.Output({
                script: input._scriptBuffer.toString('hex'),
                satoshis: 0 // we don't know this value, setting 0 because otherwise it's going to cry about not being an INT
              });

              multiSigInfo = CWBitcore.extractMultiSigInfoFromScript(inputObj.output.script);
              tx.inputs[idx] = new bitcore.Transaction.Input.MultiSig(inputObj, multiSigInfo.publicKeys, multiSigInfo.threshold);

              addresses = CWBitcore.extractMultiSigAddressesFromScript(inputObj.output.script);

              return cb(null, addresses);

            case bitcore.Script.types.SCRIPTHASH_OUT:
              // signing scripthash not supported, just skipping it, something external will have to deal with it
              return cb();

            case bitcore.Script.types.DATA_OUT:
            case bitcore.Script.types.PUBKEY_IN:
            case bitcore.Script.types.PUBKEYHASH_IN:
            case bitcore.Script.types.SCRIPTHASH_IN:
              // these are 'done', no reason to touch them!
              return cb();

            default:
              return cb(new Error("Unknown scriptPubKey [" + script.classify() + "](" + script.toASM() + ")"));
          }

        })(function(err, addresses) {
          if (err) {
            return cb(err);
          }

          // NULL means it isn't neccesary to sign it
          if (addresses === null) {
            return cb();
          }

          // unique filter
          addresses = addresses.filter(function(address, idx, self) {
            return address && self.indexOf(address) === idx;
          });

          var _keyChain = addresses.map(function(address) {
            return typeof keyMap[address] !== "undefined" ? keyMap[address] : null;
          }).filter(function(key) {
            return !!key
          });

          if (_keyChain.length === 0) {
            throw new Error("Missing private key to sign input: " + idx);
          }

          keyChain = keyChain.concat(_keyChain);

          cb();
        });
      },
      function(err) {
        if (err) {
          // async.nextTick to avoid parent trycatch
          return async.nextTick(function() {
            cb(err);
          });
        }

        // unique filter
        keyChain = keyChain.filter(function(key, idx, self) {
          return key && self.indexOf(key) === idx;
        });

        // sign with each key
        keyChain.forEach(function(priv) {
          tx.sign(priv);
        });

        // disable any checks that have anything to do with the values, because we don't know the values of the inputs
        var opts = {
          disableIsFullySigned: disableIsFullySigned,
          disableSmallFees: true,
          disableLargeFees: true,
          disableDustOutputs: true,
          disableMoreOutputThanInput: true
        };

        // async.nextTick to avoid parent trycatch
        async.nextTick(function() {
          cb(null, tx.serialize(opts));
        });
      }
    );
  } catch (err) {
    // async.nextTick to avoid parent trycatch
    async.nextTick(function() {
      cb(err);
    });
  }
};

CWBitcore.extractMultiSigAddressesFromScript = function(script) {
  checkArgType(script, "object");

  if (!script.isMultisigOut()) {
    return [];
  }

  var nKeysCount = bitcore.Opcode(script.chunks[script.chunks.length - 2].opcodenum).toNumber() - bitcore.Opcode.map.OP_1 + 1;
  var pubKeys = script.chunks.slice(script.chunks.length - 2 - nKeysCount, script.chunks.length - 2);

  return pubKeys.map(function(pubKey) {
    // using custom code to pubKey->address instead of PublicKey.fromDER because pubKey isn't valid DER
    return bitcore.Address(bitcore.crypto.Hash.sha256ripemd160(pubKey.buf), NETWORK, bitcore.Address.PayToPublicKeyHash).toString();
    // return bitcore.Address.fromPublicKey(bitcore.PublicKey.fromDER(pubKey.buf, /* strict= */false)).toString();
  });
};

CWBitcore.extractMultiSigInfoFromScript = function(script) {
  checkArgType(script, "object");

  if (!script.isMultisigOut()) {
    return [];
  }

  var nKeysCount = bitcore.Opcode(script.chunks[script.chunks.length - 2].opcodenum).toNumber() - bitcore.Opcode.map.OP_1 + 1;
  var threshold = bitcore.Opcode(script.chunks[script.chunks.length - nKeysCount - 2 - 1].opcodenum).toNumber() - bitcore.Opcode.map.OP_1 + 1;
  return {
    publicKeys: script.chunks.slice(script.chunks.length - 2 - nKeysCount, script.chunks.length - 2).map(function(pubKey) {
      return bitcore.PublicKey(pubKey.buf);
    }),
    threshold: threshold
  };
};

/**
 * @param {bitcore.Transaction.Output} output
 * @returns {string} either address or list of addresses (as CSV) or "" for op_return
 */
CWBitcore.extractAddressFromTxOut = function(output) {
  checkArgType(output, "object");

  switch (output.script.classify()) {
    case bitcore.Script.types.PUBKEY_OUT:
      return output.script.toAddress(NETWORK).toString();

    case bitcore.Script.types.PUBKEYHASH_OUT:
      return output.script.toAddress(NETWORK).toString();

    case bitcore.Script.types.SCRIPTHASH_OUT:
      return output.script.toAddress(NETWORK).toString();

    case bitcore.Script.types.MULTISIG_OUT:
      var addresses = CWBitcore.extractMultiSigAddressesFromScript(output.script);
      return addresses.join(",");

    case bitcore.Script.types.DATA_OUT:
      return "";

    default:
      throw new Error("Unknown type [" + output.script.classify() + "]");
  }
}

/**
 * @param {string} source
 * @param {string} txHex
 * @returns {*}
 */
CWBitcore.extractChangeTxoutValue = function(source, txHex) {
  checkArgsType(arguments, ["string", "string"]);

  var tx = bitcore.Transaction(txHex);

  return tx.outputs.map(function(output, idx) {
    var address = CWBitcore.extractAddressFromTxOut(output);

    if (address && address == source) {
      return output.satoshis;
    }

    return 0;
  }).reduce(function(value, change) { return change + value; });
}

/**
 * @TODO: check the pubkey instead
 *
 * @param {string}    txHex
 * @param {string[]}  source  list of compressed and uncompressed addresses
 * @param {string[]}  dest
 * @returns {boolean}
 */
CWBitcore.checkTransactionDest = function(txHex, source, dest) {
  checkArgsType(arguments, ["string", "object", "object"]);

  source = [].concat.apply([], source.map(function(source) {
    return CWBitcore.MultisigAddressToAddresses(source);
  }));
  dest = [].concat.apply([], dest.map(function(dest) {
    return CWBitcore.MultisigAddressToAddresses(dest);
  }));

  var tx = bitcore.Transaction(txHex);

  var outputsValid = tx.outputs.map(function(output, idx) {
    var address = null;

    switch (output.script.classify()) {
      case bitcore.Script.types.PUBKEY_OUT:
        address = output.script.toAddress(NETWORK).toString();
        break;

      case bitcore.Script.types.PUBKEYHASH_OUT:
        address = output.script.toAddress(NETWORK).toString();
        break;

      case bitcore.Script.types.SCRIPTHASH_OUT:
        address = output.script.toAddress(NETWORK).toString();
        break;

      case bitcore.Script.types.MULTISIG_OUT:
        var addresses = CWBitcore.extractMultiSigAddressesFromScript(output.script);

        var isSource = dest.sort().join() == addresses.sort().join();
        var isDest = source.sort().join() == addresses.sort().join();

        // if multisig we only accept it if it's value indicates it's a data output (<= MULTISIG_DUST_SIZE or <= REGULAR_DUST_SIZE*2)
        //  or a perfect match with the dest or source (change)
        return output.satoshis <= Math.max(MULTISIG_DUST_SIZE, REGULAR_DUST_SIZE * 2) || isSource || isDest;

      case bitcore.Script.types.DATA_OUT:
        return true;

      default:
        throw new Error("Unknown type [" + output.script.classify() + "]");
    }

    var containsSource = _.intersection([address], source).length > 0;
    var containsDest = _.intersection([address], dest).length > 0;

    return containsDest || containsSource;
  });

  return outputsValid.filter(function(v) { return !v; }).length === 0;
}

CWBitcore.compareOutputs = function(source, txHexs) {
  var t;

  if (txHexs[0].indexOf("=====TXSIGCOLLECT") != -1) {
    // armory transaction, we just compare if strings are the same.
    for (t = 1; t < txHexs.length; t++) {
      if (txHexs[t] != txHexs[0]) {
        return false;
      }
    }

    return true;
  } else {
    var tx0 = bitcore.Transaction(txHexs[0]);

    var txHexesValid = txHexs.map(function(txHex, idx) {
      if (idx === 0) {
        return true;
      }

      var tx1 = bitcore.Transaction(txHex);

      if (tx0.outputs.length != tx1.outputs.length) {
        return false;
      }

      var outputsValid = tx0.outputs.map(function(output, idx) {
        var addresses0 = CWBitcore.extractAddressFromTxOut(output).split(',').sort().join(',');
        var addresses1 = CWBitcore.extractAddressFromTxOut(tx1.outputs[idx]).split(',').sort().join(',');
        var amount0 = output.satoshis;
        var amount1 = tx1.outputs[idx].satoshis;

        // addresses need to be the same and values need to be the same
        //  expect for the change output
        return addresses0 == addresses1 && (amount0 == amount1 || addresses0.indexOf(source) != -1);
      });

      return outputsValid.filter(function(v) { return !v; }).length === 0;
    })

    return txHexesValid.filter(function(v) { return !v; }).length === 0;
  }
}

CWBitcore.pubKeyToPubKeyHash = function(pubKey) {
  return bitcore.Address.fromPublicKey(bitcore.PublicKey(pubKey, {network: NETWORK}), NETWORK).toString();
}

CWBitcore.encrypt = function(message, password) {
  return CryptoJS.AES.encrypt(message, password).toString();
}

CWBitcore.decrypt = function(cryptedMessage, password) {
  return CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(cryptedMessage, password));
}

CWBitcore.getQuickUrl = function(passphrase, password) {
  var url = location.protocol + '//' + location.hostname + '/#cp=';
  url += CWBitcore.encrypt(passphrase, password);
  return url;
}
