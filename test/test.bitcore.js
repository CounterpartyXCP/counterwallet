var should = chai.should();

for (var network in fixtures) {

  var data = fixtures[network];
  NETWORK = bitcore.networks[data.network];
  var prefix = '['+data.network.toUpperCase()+'] ';
  
  describe(prefix+'HierarchicalKey addresses', function() {

    it('Should correctly generate addresses from passphrase', function() {
      var hkey = new CWHierarchicalKey(data.passphrase);
      for (var i=0; i<3; i++) {
        var cwk = hkey.getAddressKey(i);
        var address = cwk.getAddress();
        address.should.be.a('string');
        address.should.equal(data.addresses[i]);
        console.log(cwk.getWIF());
      }
    });

    it('Should correctly generate old addresses from passphrase', function() {
      var hkey = new CWHierarchicalKey('old '+data.passphrase);
      for (var i=0; i<3; i++) {
        var cwk = hkey.getAddressKey(i);
        var address = cwk.getAddress();
        address.should.be.a('string');
        address.should.equal(data.oldaddresses[i]);
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

    it('Should generate different old addresses from diffrent passphrase', function() {
      var hkey = new CWHierarchicalKey('old '+data.passphrase2);
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


  describe(prefix+'Private keys methods', function() {

    it('Should correctly instanciate CWPrivateKey object', function() {
      var cwk = new CWPrivateKey(data.privkey);
      cwk.getAddress().should.be.equal(data.addresses[0]);
      cwk.getPub().should.be.equal(data.pubkey);
      cwk.isValid().should.be.equal.true;
      cwk.getWIF().should.be.equal(data.wif);
    });

    // bad test because K change each transaction.
    // TO deserialize signed transaction and check input/ouptut OR/AND find a better way to do this.
    /*it('Should correctly sign transaction', function() {
      var cwk = new CWPrivateKey(data.privkey);
      var signed = cwk.signRawTransaction(data.transaction.unsigned);
      signed.should.be.equal(data.transaction.signed);
    });*/

    it('Should reject transaction with incorrect destination', function() {
      var cwk = new CWPrivateKey(data.privkey);
      var check = cwk.checkTransactionDest(data.transaction.unsigned, data.addresses[2]);
      check.should.be.equal.false;
    });

  });

}