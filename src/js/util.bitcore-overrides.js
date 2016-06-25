/* Temp file until https://github.com/bitpay/bitcore-lib/pull/80 is merged into bitcore proper*/
var bitcore = require('bitcore-lib');

bitcore.Script.outputIdentifiers = {};
bitcore.Script.outputIdentifiers.PUBKEY_OUT = bitcore.Script.prototype.isPublicKeyOut;
bitcore.Script.outputIdentifiers.PUBKEYHASH_OUT = bitcore.Script.prototype.isPublicKeyHashOut;
bitcore.Script.outputIdentifiers.MULTISIG_OUT = bitcore.Script.prototype.isMultisigOut;
bitcore.Script.outputIdentifiers.SCRIPTHASH_OUT = bitcore.Script.prototype.isScriptHashOut;
bitcore.Script.outputIdentifiers.DATA_OUT = bitcore.Script.prototype.isDataOut;

/**
 * @returns {object} The Script type if it is a known form,
 * or Script.UNKNOWN if it isn't
 */
bitcore.Script.prototype.classify = function() {
  var outputType = this.classifyOutput();
  return outputType != bitcore.Script.types.UNKNOWN ? outputType : this.classifyInput();
};

/**
  * @returns {object} The Script type if it is a known form,
  * or Script.UNKNOWN if it isn't
  */
bitcore.Script.prototype.classifyOutput = function() {
   for (var type in bitcore.Script.outputIdentifiers) {
     if (bitcore.Script.outputIdentifiers[type].bind(this)()) {
       return bitcore.Script.types[type];
     }
   }
   return bitcore.Script.types.UNKNOWN;
};
 
bitcore.Script.inputIdentifiers = {};
bitcore.Script.inputIdentifiers.PUBKEY_IN = bitcore.Script.prototype.isPublicKeyIn;
bitcore.Script.inputIdentifiers.PUBKEYHASH_IN = bitcore.Script.prototype.isPublicKeyHashIn;
bitcore.Script.inputIdentifiers.MULTISIG_IN = bitcore.Script.prototype.isMultisigIn;
bitcore.Script.inputIdentifiers.SCRIPTHASH_IN = bitcore.Script.prototype.isScriptHashIn;
 
/**
 * @returns {object} The Script type if it is a known form,
 * or Script.UNKNOWN if it isn't
 */
bitcore.Script.prototype.classifyInput = function() {
  for (var type in bitcore.Script.inputIdentifiers) {
    if (bitcore.Script.inputIdentifiers[type].bind(this)()) {
       return bitcore.Script.types[type];
     }
  }
};