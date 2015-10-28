/* globals NETWORK */
var should = chai.should();

Object.keys(fixtures).forEach(function(network) {
  var data = fixtures[network];

  // set global NETWORK used in util.bitcore
  NETWORK = bitcore.Networks[data.network];

  var prefix = '[' + data.network.toUpperCase() + '] ';
  
  describe(prefix + 'HierarchicalKey addresses', function() {

    it('Should correctly generate addresses from passphrase', function() {
      var hkey = new CWHierarchicalKey(data.passphrase);
      for (var i=0; i<3; i++) {
        var cwk = hkey.getAddressKey(i);
        var address = cwk.getAddress();
        address.should.be.a('string');
        address.should.equal(data.addresses[i]);
      }
    });

    it('Should generate different addresses from diffrent passphrase', function() {
      var hkey = new CWHierarchicalKey(data.passphrase2);
      for (var i=0; i<3; i++) {
        var cwk = hkey.getAddressKey(i);
        var address = cwk.getAddress();
        address.should.be.a('string');
        address.should.not.equal(data.addresses[i]);
      }
    });

    it('Should correctly validate address', function() {
      CWBitcore.isValidAddress(data.addresses[0]).should.equal.true;
      var badAddress = data.addresses[0].replace(/u/g, "v");
      CWBitcore.isValidAddress(badAddress).should.equal.false;
    });

  });


  describe(prefix + 'Private keys methods', function() {

    it('Should correctly instanciate CWPrivateKey object from HEX', function() {
      var cwk = new CWPrivateKey(data.privkey);
      cwk.getAddress().should.be.equal(data.addresses[0]);
      cwk.getPub().should.be.equal(data.pubkey);
      cwk.isValid().should.be.equal.true;
      cwk.getWIF().should.be.equal(data.wif);
    });

    it('Should correctly instanciate CWPrivateKey object from WIF', function() {
      var cwk = new CWPrivateKey(data.wif);
      cwk.getAddress().should.be.equal(data.addresses[0]);
      cwk.getPub().should.be.equal(data.pubkey);
      cwk.isValid().should.be.equal.true;
      cwk.priv.toString().should.be.equal(data.privkey);
    });

    it('Should reject transaction with incorrect destination', function() {
      var cwk = new CWPrivateKey(data.privkey);
      var check = cwk.checkTransactionDest(data.transaction.unsigned, [data.addresses[2]]);
      check.should.be.equal.false;
    });

    it('Should be able to sign a message', function() {
      var cwk = new CWPrivateKey(data.privkey);

      var message = "testing123";

      var signature = cwk.signMessage(message);

      signature.should.be.a('string');
      bitcore.Message(message).verify(data.addresses[0], signature).should.be.true;

    });

    it('Should correctly sign raw transaction [playground]', function() {
      var cwk = new CWPrivateKey(data.privkey);
      var utxoInfo = {
        address: "muYJYjRZDPmTEMfyEGe34BGN8tZ6rmRZCu",
        txId: '93cb35b7e13c7c6de45d4c54375b94c14cb35073f67f974ced464b855a8abd39',
        outputIndex: 2,
        script: bitcore.Script.buildPublicKeyHashOut("muYJYjRZDPmTEMfyEGe34BGN8tZ6rmRZCu").toString(),
        satoshis: 895789030
      };

      var tx = bitcore.Transaction();
      tx.from(utxoInfo)
        .to("mkvaJJCpMMjvhaHodDCvstZsZwTaWR4w3M", 10860)
        .addOutput(bitcore.Transaction.Output({
          script: bitcore.Script("512102b6f17e170c40a6b1cdbb4572b172175199122b01f81a56a2d2666a035ed5feef211c434e545250525459000000000000000000000001000000000bebc2000000000052ae"),
          satoshis: 10860
        }))
        .to("muYJYjRZDPmTEMfyEGe34BGN8tZ6rmRZCu", 895747310)
      ;

      // unsigned serialized
      tx.uncheckedSerialize().should.be.equal(data.transaction.unsigned, "unsigned");

      // unsigned serialized, with script set
      tx.inputs[0].setScript(bitcore.Script.buildPublicKeyHashOut("muYJYjRZDPmTEMfyEGe34BGN8tZ6rmRZCu").toString());
      tx.uncheckedSerialize().should.be.equal(data.transaction.unsigned2, "unsigned2");

      // take unsigned serialized and set proper input again
      tx = bitcore.Transaction(data.transaction.unsigned2);
      tx.inputs.splice(0, 1); // remove input, no other way of doing this in bitcore ...
      tx.from(utxoInfo);

      // sign with priv
      tx.sign([cwk.priv]);

      // signed serialized
      tx.serialize().should.be.equal(data.transaction.signed, "signed");
    });

    it('Should correctly sign raw transaction', function(done) {

      var _failoverAPI = failoverAPI;
      // mock failoverAPI
      failoverAPI = function(method, data, cb) {
        if (method != "get_script_pub_key") {
          throw new Error("Invalid method called: " + method);
        }
        if (data.tx_hash != "93cb35b7e13c7c6de45d4c54375b94c14cb35073f67f974ced464b855a8abd39") {
          throw new Error("Invalid tx_hash: " + data.tx_hash);
        }
        if (data.vout_index != 2) {
          throw new Error("Invalid vout_index: " + data.vout_index);
        }

        cb({
          "value" : 8.95789030,
          "n" : 2,
          "scriptPubKey" : {
            "asm" : "OP_DUP OP_HASH160 99d31556557ce86ab75fcb74683efba1bde2815e OP_EQUALVERIFY OP_CHECKSIG",
            "hex" : "76a91499d31556557ce86ab75fcb74683efba1bde2815e88ac",
            "reqSigs" : 1,
            "type" : "pubkeyhash",
            "addresses" : [
              "muYJYjRZDPmTEMfyEGe34BGN8tZ6rmRZCu"
            ]
          }
        });
      };

      after(function() {
        failoverAPI = _failoverAPI;
      });

      var cwk = new CWPrivateKey(data.privkey);

      cwk.signRawTransaction(data.transaction.unsigned, function(signed) {
        signed.should.be.equal(data.transaction.signed, "signed");
        done();
      })
    });

  });

});
