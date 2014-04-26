var bitcore = require('bitcore');

var CWBIP32 = function(passphrase) {
  checkArgType(passphrase, "string")
  // same as bitcoinjs-lib :
  // m : masterkery / 0' : first private derivation / 0 : external account / i : index
  this.basePath = 'm/0\'/0/'
  
  this.init = function(passphrase) {
    var seed = passphraseToSeed(passphrase);
    this.BIP32 = USE_OLD_BIP32 ? oldBIP32FromSeed(seed) : bitcore.BIP32.seed(seed, NETWORK_NAME);  
  }

  var passphraseToSeed = function(passphrase) {
    var sanitizedPassphrase = $.trim(passphrase.toLowerCase());
    var m = new Mnemonic(sanitizedPassphrase.split(' '));
    return m.toHex();
  }

  // This function return an Bitcore BIP32 instance
  // compatible with old counterwallet. ie generates
  // sames addresses
  // seed: hex string
  var oldBIP32FromSeed = function(seed) {
    checkArgType(seed, "string");
    // here we need to pass seed as buffer, BUT for 
    // "historical" reason we keep seed as string to not
    // change generated addresses from the same passphrase.
    var words = bytesToWordArray(seed);  
    var hash = CryptoJS.HmacSHA512(words, 'Bitcoin seed');
    hash = wordArrayToBytes(hash);
    hash = bitcore.buffertools.Buffer(hash);
    var priv =  hash.slice(0, 32).toString('hex');
    var wk = new bitcore.WalletKey({network: NETWORK_CONF});
    wk.fromObj({priv:priv});
    var eckey = wk.privKey;
    var bip32 = new bitcore.BIP32;
    bip32.depth = 0x00;
    bip32.parentFingerprint = bitcore.buffertools.Buffer([0, 0, 0, 0]);
    bip32.childIndex = bitcore.buffertools.Buffer([0, 0, 0, 0]);
    bip32.chainCode = hash.slice(32, 64);
    bip32.version = NETWORK_CONF.bip32privateVersion;
    bip32.eckey = eckey;
    bip32.hasPrivateKey = true;
    bip32.pubKeyHash = bitcore.util.sha256ripe160(bip32.eckey.public);
    bip32.buildExtendedPublicKey();
    bip32.buildExtendedPrivateKey();
    return bip32;
  }

  this.getAddressKey = function(index) {
    checkArgType(index, "number");
    var derivedKey = this.BIP32.derive(this.basePath+index);
    return new CWPrivateKey(bitcore.buffertools.toHex(derivedKey.eckey.private));
  }

  this.init(passphrase);
}

// priv: private key wif or hex
var CWPrivateKey = function(priv) {

  this.priv = priv;

  this.getAddress = function() {
    if (this.priv=='') return false;
    try {
      var wk = new bitcore.WalletKey({network: NETWORK_CONF});
      wk.fromObj({priv:this.priv});
      var wkObj = wk.storeObj();
      return wkObj.addr;
    } catch (err) {
      return false;
    }
  }

  this.isValid = function() {
    try {
      var address = new bitcore.Address(this.getAddress());
      return address.isValid() && (address.version() == NETWORK_VERSION);
    } catch (err) {
      return false;
    }
  }

  this.getPub = function() {
    try {
      var wk = new bitcore.WalletKey({network: NETWORK_CONF});
      wk.fromObj({priv:this.priv});
      return bitcore.buffertools.toHex(wk.privKey.public);
    } catch (err) {
      return false;
    }
  }

  this.getBitcoreECKey = function() {
    try {
      var wk = new bitcore.WalletKey({network: NETWORK_CONF});
      wk.fromObj({priv:this.priv});
      return wk.privKey;
    } catch (err) {
      return false;
    }
  }

  this.signMessage = function(message, format) {
    return bitcore.Message.sign(message, this.getBitcoreECKey()).toString(format);
  }

  this.signRawTransaction = function(unsignedHex) {
    checkArgType(unsignedHex, "string");
    return CWBitcore.signRawTransaction(unsignedHex, this);
  }

  this.checkTransactionDest = function(txHex, destAdress) {
    checkArgType(txHex, "string");
    checkArgType(destAdress, "string");
    return CWBitcore.checkTransactionDest(txHex, this.getAddress(), destAdress);
  }

  this.checkAndSignRawTransaction = function(unsignedHex, destAdress) {
    checkArgType(unsignedHex, "string");
    checkArgType(destAdress, "string");
    if (this.checkTransactionDest(unsignedHex, destAdress)) {
      return this.signRawTransaction(unsignedHex);
    }
    return false;
  }

  this.getWIF = function() {
    var buf = new bitcore.buffertools.Buffer(this.priv, 'hex');
    var privkey = new bitcore.PrivateKey(NETWORK_CONF.privKeyVersion, buf, true);
    return privkey.as('base58');
  }

}


var CWBitcore = new function() {

  this.isValidAddress = function(val) {
    try {
      var address = new bitcore.Address(val);
      if (address.isValid()) {
        return address.version() == NETWORK_VERSION;
      } else {
        return false;
      }     
    } catch (err) {
      return false;
    }
  }


  this.prepareSignedTransaction = function(unsignedTx) {
    checkArgType(unsignedTx, "object");

    var txobj = {}; 
    txobj.version    = unsignedTx.version;
    txobj.lock_time  = unsignedTx.lock_time;
    txobj.ins  = [];
    for (var i=0; i < unsignedTx.ins.length; i++) {
      txobj.ins.push({
        s: bitcore.util.EMPTY_BUFFER,
        q: unsignedTx.ins[i].q,
        o: unsignedTx.ins[i].o
      });
    }  
    txobj.outs = unsignedTx.outs;
    return new bitcore.Transaction(txobj);
  }

  this.parseRawTransaction = function(txHex) {
    checkArgType(txHex, "string");

    var raw = new bitcore.buffertools.Buffer(txHex, 'hex');
    var tx = new bitcore.Transaction();
    tx.parse(raw);
    return tx;
  }

  this.signRawTransaction = function(unsignedHex, cwPrivateKey) {
    checkArgType(unsignedHex, "string");
    checkArgType(cwPrivateKey, "object");

    var address = cwPrivateKey.getAddress();

    // function used to each for each type
    var fnToSign = {};
    fnToSign[bitcore.Script.TX_PUBKEYHASH] = bitcore.TransactionBuilder.prototype._signPubKeyHash;
    fnToSign[bitcore.Script.TX_PUBKEY]     = bitcore.TransactionBuilder.prototype._signPubKey;
    fnToSign[bitcore.Script.TX_MULTISIG]   = bitcore.TransactionBuilder.prototype._signMultiSig;
    fnToSign[bitcore.Script.TX_SCRIPTHASH] = bitcore.TransactionBuilder.prototype._signScriptHash;

    // build key map
    var wkMap = {};
    wkMap[address] = new bitcore.WalletKey({network:NETWORK_CONF, privKey:cwPrivateKey.getBitcoreECKey()});

    // unserialize raw transaction
    var unsignedTx = CWBitcore.parseRawTransaction(unsignedHex);   

    // prepare  signed transaction
    var signedTx = new bitcore.TransactionBuilder();
    signedTx.tx = CWBitcore.prepareSignedTransaction(unsignedTx);

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

  this.extractAddressFromTxOut = function(txout) {
    checkArgType(txout, "object");

    var script = txout.getScript();
    return bitcore.Address.fromScriptPubKey(script, NETWORK_CONF.name).toString();
  }

  this.extractChangeTxoutValue = function(source, txHex) {
    checkArgType(source, "string");
    checkArgType(txHex, "string");

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

  this.checkTransactionDest = function(txHex, source, dest) { 
    checkArgType(txHex, "string"); 
    checkArgType(source, "string");
    checkArgType(dest, "string");

    // unserialize raw transaction
    var tx = CWBitcore.parseRawTransaction(txHex);    
    for (var i=0; i<tx.outs.length; i++) {
        var addresses = CWBitcore.extractAddressFromTxOut(tx.outs[i]).split(',');
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

}

