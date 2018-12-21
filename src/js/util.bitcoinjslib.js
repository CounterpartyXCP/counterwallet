
CWPrivateKey.prototype.checkTransactionDest2 = function(txHex, dest) {
  checkArgsType(arguments, ["string", "object", "object"]);

  var tx = bitcoinjs.Transaction.fromHex(txHex)

  console.log('TX', tx)

  var decomp = tx.outs.map(x => bitcoinjs.script.decompile(x.script))

  console.log('DECOMP', decomp)

 // Unreachable code for now
  throw new Error('Bitcore sucks')
}
