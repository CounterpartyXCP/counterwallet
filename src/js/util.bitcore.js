var bitcore = require('bitcore');
// no reason to be used elsewhere
var NETWORK = USE_TESTNET ? bitcore.networks.testnet : bitcore.networks.livenet;

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
  
  // if first word=='old' => old HierarchicalKey
  if (words.length==13) {
    var first = words.shift();
    this.useOldHierarchicalKey = (first == 'old');
  }

  var seed = this.wordsToSeed(words);   
  this.HierarchicalKey = this.useOldHierarchicalKey ? this.oldHierarchicalKeyFromSeed(seed) : bitcore.HierarchicalKey.seed(seed, NETWORK.name);
  // this instance used for sweeping old wallet
  this.oldHierarchicalKey = this.oldHierarchicalKeyFromSeed(seed);
}

CWHierarchicalKey.prototype.wordsToSeed = function(words) {
  var m = new Mnemonic(words);
  return m.toHex();
}

CWHierarchicalKey.prototype.getOldAddressesInfos = function(callback) {
  var addresses = [];
  var cwkeys = {};

  for (var i=0; i<=9; i++) {

    var derivedKey = this.oldHierarchicalKey.derive(this.basePath+i);
    var key = derivedKey.eckey.private.toString('hex');
    var cwk = new CWPrivateKey(key);
    var address = cwk.getAddress();
    addresses.push(address);
    cwkeys[address] = cwk;
  }

  Counterblock.getBalances(addresses, cwkeys, callback);
  
}

// This function return an Bitcore HierarchicalKey instance
// compatible with old counterwallet. ie generates
// sames addresses
// seed: hex string
CWHierarchicalKey.prototype.oldHierarchicalKeyFromSeed = function(seed) {
  checkArgType(seed, "string");
  // here we need to pass seed as buffer, BUT for 
  // "historical" reason we keep seed as string to not
  // change generated addresses from the same passphrase.
  var words = bytesToWordArray(seed);  
  var hash = CryptoJS.HmacSHA512(words, BTC_NAME + ' seed');
  hash = wordArrayToBytes(hash);
  hash = bitcore.Buffer(hash);
  
  var priv =  hash.slice(0, 32).toString('hex');
  
  var eckey = new bitcore.Key();
  eckey.private = hash.slice(0, 32);
  eckey.regenerateSync();

  var hkey = new bitcore.HierarchicalKey;
  hkey.depth = 0x00;
  hkey.parentFingerprint = bitcore.Buffer([0, 0, 0, 0]);
  hkey.childIndex = bitcore.Buffer([0, 0, 0, 0]);
  hkey.chainCode = hash.slice(32, 64);
  hkey.version = NETWORK.hkeyPrivateVersion;
  hkey.eckey = eckey;
  hkey.hasPrivateKey = true;
  hkey.pubKeyHash = bitcore.util.sha256ripe160(hkey.eckey.public);
  hkey.buildExtendedPublicKey();
  hkey.buildExtendedPrivateKey();
  return hkey;
}

CWHierarchicalKey.prototype.getAddressKey = function(index) {
  checkArgType(index, "number");
  var derivedKey = this.HierarchicalKey.derive(this.basePath+index);
  return new CWPrivateKey(derivedKey.eckey.private.toString('hex'));
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
  checkArgType(priv, "string");
  this.priv = null;
  this.init(priv);
}

CWPrivateKey.prototype.init = function(priv) {
  try {
    this.priv = priv;
    this.walletKey = new bitcore.WalletKey({network: NETWORK});
    this.walletKey.fromObj({priv:this.priv});
  } catch (err) {
    this.priv = null;
  }
}

CWPrivateKey.prototype.getAddress = function() {
  try {
    var wkObj = this.walletKey.storeObj();
    return wkObj.addr;
  } catch (err) {
    return false;
  }
}

CWPrivateKey.prototype.getAltAddress = function() {
  var cwk = new CWPrivateKey(this.priv);
  cwk.walletKey.privKey._compressed = !cwk.walletKey.privKey._compressed;
  cwk.walletKey.privKey.regenerateSync();
  return cwk.walletKey.storeObj().addr;
}

CWPrivateKey.prototype.getAddresses = function() {
  return addresses = [
    this.getAddress(),
    this.getAltAddress()
  ];
}

CWPrivateKey.prototype.isValid = function() {
  try {
    var address = new bitcore.Address(this.getAddress());
    return address.isValid() && (address.version() == NETWORK.addressVersion);
  } catch (err) {
    return false;
  }
}

CWPrivateKey.prototype.getPub = function() {
  try {
    return this.walletKey.privKey.public.toString('hex');
  } catch (err) {
    return false;
  }
}

CWPrivateKey.prototype.getBitcoreECKey = function() {
  try {
    return this.walletKey.privKey;
  } catch (err) {
    return false;
  }
}

CWPrivateKey.prototype.signMessage = function(message, format) {
  return bitcore.Message.sign(message, this.getBitcoreECKey()).toString(format);
}

CWPrivateKey.prototype.signRawTransaction = function(unsignedHex) {
  checkArgType(unsignedHex, "string");
  return CWBitcore.signRawTransaction(unsignedHex, this);
}

CWPrivateKey.prototype.checkTransactionDest = function(txHex, destAdress) {
  checkArgsType(arguments, ["string", "string"]);
  try {
    return CWBitcore.checkTransactionDest(txHex, this.getAddresses(), destAdress);
  } catch (err) {
    return false;
  }  
}

CWPrivateKey.prototype.checkAndSignRawTransaction = function(unsignedHex, destAdress) {
  checkArgsType(arguments, ["string", "string"]);
  if (this.checkTransactionDest(unsignedHex, destAdress)) {
    return this.signRawTransaction(unsignedHex);
  }
  return false;
}

CWPrivateKey.prototype.getWIF = function() {
  var buf = new bitcore.Buffer(this.priv, 'hex');
  var privkey = new bitcore.PrivateKey(NETWORK.privKeyVersion, buf, true);
  return privkey.as('base58');
}

CWPrivateKey.prototype.encrypt = function(message) {
  return CWBitcore.encrypt(message, this.priv);
}

CWPrivateKey.prototype.decrypt = function(cryptedMessage) {
  return CWBitcore.decrypt(cryptedMessage, this.priv);
}

// TODO: rename to be more generic
var CWBitcore =  {}

CWBitcore.isValidAddress = function(val) {
  try {
    var address = new bitcore.Address(val);
    if (address.isValid()) {
      return address.version() == NETWORK.addressVersion;
    } else {
      return false;
    }     
  } catch (err) {
    return false;
  }
}

CWBitcore.parseRawTransaction = function(txHex) {
  checkArgType(txHex, "string");

  var raw = new bitcore.Buffer(txHex, 'hex');
  var tx = new bitcore.Transaction();
  tx.parse(raw);
  return tx;
}

CWBitcore.signRawTransaction = function(unsignedHex, cwPrivateKey) {
  checkArgsType(arguments, ["string", "object"]);

  var address = cwPrivateKey.getAddress();

  // function used to each for each type
  var fnToSign = {};
  fnToSign[bitcore.Script.TX_PUBKEYHASH] = bitcore.TransactionBuilder.prototype._signPubKeyHash;
  fnToSign[bitcore.Script.TX_PUBKEY]     = bitcore.TransactionBuilder.prototype._signPubKey;
  fnToSign[bitcore.Script.TX_MULTISIG]   = bitcore.TransactionBuilder.prototype._signMultiSig;
  fnToSign[bitcore.Script.TX_SCRIPTHASH] = bitcore.TransactionBuilder.prototype._signScriptHash;

  // build key map
  var wkMap = {};
  wkMap[address] = new bitcore.WalletKey({network:NETWORK, privKey:cwPrivateKey.getBitcoreECKey()});

  // unserialize raw transaction
  var unsignedTx = CWBitcore.parseRawTransaction(unsignedHex);   

  // prepare  signed transaction
  var signedTx = new bitcore.TransactionBuilder();
  //signedTx.tx = CWBitcore.prepareSignedTransaction(unsignedTx);
  signedTx.tx = unsignedTx;

  for (var i=0; i < unsignedTx.ins.length; i++) {
      
    // init parameters
    var txin = unsignedTx.ins[i];
    var scriptPubKey = new bitcore.Script(txin.s);
    var input = {
        address: address,
        scriptPubKey: scriptPubKey,
        scriptType: scriptPubKey.classify(),
        i: i
    };     
    // generating hash for signature
    var txSigHash = unsignedTx.hashForSignature(scriptPubKey, i, bitcore.Transaction.SIGHASH_ALL);
    // empty the script
    signedTx.tx.ins[i].s = bitcore.util.EMPTY_BUFFER;
    // sign hash
    var ret = fnToSign[input.scriptType].call(signedTx, wkMap, input, txSigHash);    
    // inject signed script in transaction object
    if (ret && ret.script) {
      signedTx.tx.ins[i].s = ret.script;
      if (ret.inputFullySigned) signedTx.inputsSigned++;
      if (ret.signaturesAdded) signedTx.signaturesAdded += ret.signaturesAdded;
    }

  }
  return signedTx.tx.serialize().toString('hex');
}

CWBitcore.extractAddressFromTxOut = function(txout) {
  checkArgType(txout, "object");

  var script = txout.getScript();
  return bitcore.Address.fromScriptPubKey(script, NETWORK.name).toString();
}

CWBitcore.extractChangeTxoutValue = function(source, txHex) {
  checkArgsType(arguments, ["string", "string"]);

  // unserialize raw transaction
  var tx = CWBitcore.parseRawTransaction(txHex);

  for (var i=0; i<tx.outs.length; i++) {
      var address = CWBitcore.extractAddressFromTxOut(tx.outs[i]);
      if (address == source) {
          return tx.outs[i].getValue();
      }
  }
  return 0;
}

// source: array with compressed and uncompressed address.
// so we don't care how the used library parse the transaction.
CWBitcore.checkTransactionDest = function(txHex, source, dest) { 
  checkArgsType(arguments, ["string", "object", "string"]);

  // unserialize raw transaction
  var tx = CWBitcore.parseRawTransaction(txHex);    
  for (var i=0; i<tx.outs.length; i++) {
      var addresses = CWBitcore.extractAddressFromTxOut(tx.outs[i]).split(',');
      var containsSource = _.intersection(addresses, source).length > 0;
      var containsDest = addresses.indexOf(dest) != -1;
      if (!containsSource && !containsDest) {
        return false;
      } else if (addresses.length>1) {
        // if multisig we accept only value==MULTISIG_DUST_SIZE
        if (tx.outs[i].getValue()>MULTISIG_DUST_SIZE) {
          return false;
        }
      }
  }
  return true;
}

CWBitcore.compareOutputs = function(source, txHexs) {
  
  var tx0 = CWBitcore.parseRawTransaction(txHexs[0]); 

  for (var t = 1; t < txHexs.length; t++) {
    var tx1 = CWBitcore.parseRawTransaction(txHexs[t]); 
    if (tx1.outs.length != tx0.outs.length) {
      return false;
    }
    for (var i=0; i<tx0.outs.length; i++) {
      var addresses0 = CWBitcore.extractAddressFromTxOut(tx0.outs[i]).split(',').sort().join(',');
      var addresses1 = CWBitcore.extractAddressFromTxOut(tx1.outs[i]).split(',').sort().join(',');
      var amount0 = tx0.outs[i].getValue();
      var amount1 = tx1.outs[i].getValue();

      if (addresses0 != addresses1 || (addresses0.indexOf(source) == -1 && amount0 != amount1)) {
        return false;
      }
    }
  }
  return true;

}

CWBitcore.encrypt = function(message, password) {
  return CryptoJS.AES.encrypt(message, password).toString();
}

CWBitcore.decrypt = function(cryptedMessage, password) {
  return CryptoJS.enc.Utf8.stringify(CryptoJS.AES.decrypt(cryptedMessage, password));
}

