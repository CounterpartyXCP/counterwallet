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

      // dissect what was set as input script to use it as output script
      if (bitcore.Script(tx.inputs[0]._scriptBuffer.toString('hex')).isPublicKeyHashOut()) {
        var inputObj = tx.inputs[0].toObject();
        inputObj.output = bitcore.Transaction.Output({
          script: tx.inputs[0]._scriptBuffer.toString('hex'),
          satoshis: 0 // we don't know this value, setting 0 because otherwise it's going to cry about not being an INT
        });
        tx.inputs[0] = new bitcore.Transaction.Input.PublicKeyHash(inputObj);
      }

      // sign with priv
      tx.sign([cwk.priv]);

      // disable any checks that have anything to do with the values, because we don't know the values of the inputs
      var opts = {
        disableSmallFees: true,
        disableLargeFees: true,
        disableDustOutputs: true,
        disableMoreOutputThanInput: true
      };

      // signed serialized
      tx.serialize(opts).should.be.equal(data.transaction.signed, "signed");
    });

    it('Should correctly sign raw transaction', function() {
      var cwk = new CWPrivateKey(data.privkey);

      var signedHex = cwk.signRawTransaction(data.transaction.unsigned2);
      signedHex.should.be.equal(data.transaction.signed, "signed");
    });

  });

});
