var bitcore = require('bitcore');
// no reason to be used elsewhere
var NETWORK = USE_TESTNET ? bitcore.networks.testnet : bitcore.networks.livenet;

var CWBIP32 = function(passphrase) {
  checkArgType(passphrase, "string")
  // same as bitcoinjs-lib :
  // m : masterkery / 0' : first private derivation / 0 : external account / i : index
  this.basePath = 'm/0\'/0/';
  this.useOldBIP32 = false;
  this.init(passphrase);
}

CWBIP32.prototype.init = function(passphrase) {
  var words = $.trim(passphrase.toLowerCase()).split(' ');
  
  // if first word=='old' => old bip32
  if (words.length==13) {
    var first = words.shift();
    this.useOldBIP32 = (first == 'old');
  }

  var seed = this.wordsToSeed(words);   
  this.BIP32 = this.useOldBIP32 ? this.oldBIP32FromSeed(seed) : bitcore.BIP32.seed(seed, NETWORK.name);
  // this instance used for sweeping old wallet
  this.oldBIP32 = this.oldBIP32FromSeed(seed);
}

CWBIP32.prototype.wordsToSeed = function(words) {
  var m = new Mnemonic(words);
  return m.toHex();
}

CWBIP32.prototype.getOldAddressesInfos = function(callback) {
  var addresses = [];
  var cwkeys = {};

  for (var i=0; i<=9; i++) {

    var derivedKey = this.oldBIP32.derive(this.basePath+i);
    var key = derivedKey.eckey.private.toString('hex');
    var cwk = new CWPrivateKey(key);
    var address = cwk.getAddress();
    addresses.push(address);
    cwkeys[address] = cwk;
  }

  Counterblock.getBalances(addresses, cwkeys, callback);
  
}

// This function return an Bitcore BIP32 instance
// compatible with old counterwallet. ie generates
// sames addresses
// seed: hex string
CWBIP32.prototype.oldBIP32FromSeed = function(seed) {
  checkArgType(seed, "string");
  // here we need to pass seed as buffer, BUT for 
  // "historical" reason we keep seed as string to not
  // change generated addresses from the same passphrase.
  var words = bytesToWordArray(seed);  
  var hash = CryptoJS.HmacSHA512(words, 'Bitcoin seed');
  hash = wordArrayToBytes(hash);
  hash = bitcore.Buffer(hash);
  
  var priv =  hash.slice(0, 32).toString('hex');
  
  var eckey = new bitcore.Key();
  eckey.private = hash.slice(0, 32);
  eckey.regenerateSync();

  var bip32 = new bitcore.BIP32;
  bip32.depth = 0x00;
  bip32.parentFingerprint = bitcore.Buffer([0, 0, 0, 0]);
  bip32.childIndex = bitcore.Buffer([0, 0, 0, 0]);
  bip32.chainCode = hash.slice(32, 64);
  bip32.version = NETWORK.bip32privateVersion;
  bip32.eckey = eckey;
  bip32.hasPrivateKey = true;
  bip32.pubKeyHash = bitcore.util.sha256ripe160(bip32.eckey.public);
  bip32.buildExtendedPublicKey();
  bip32.buildExtendedPrivateKey();
  return bip32;
}

CWBIP32.prototype.getAddressKey = function(index) {
  checkArgType(index, "number");
  var derivedKey = this.BIP32.derive(this.basePath+index);
  return new CWPrivateKey(derivedKey.eckey.private.toString('hex'));
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
    return CWBitcore.checkTransactionDest(txHex, this.getAddress(), destAdress);
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

CWBitcore.checkTransactionDest = function(txHex, source, dest) { 
  checkArgsType(arguments, ["string", "string", "string"]);

  // unserialize raw transaction
  var tx = CWBitcore.parseRawTransaction(txHex);    
  for (var i=0; i<tx.outs.length; i++) {
      var addresses = CWBitcore.extractAddressFromTxOut(tx.outs[i]).split(',');
      $.jqlog.debug('addresses:::: '+addresses);
      var containsSource = addresses.indexOf(source) != -1;
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

