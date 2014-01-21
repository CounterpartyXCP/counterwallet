// Here we hold all the interactions with the blockchain.
var BLOCKCHAIN = new function () {
  
  this.retrieveBTCBalance = function(address, callback) {
    url = 'http://blockchain.info/q/addressbalance/';
    fetchData(url + address, callback);
  }
  
  this.getUnspentBTCOutputs = function(address, callback) {
    var url = 'http://blockchain.info/unspent?address=' + address;
    fetchData(url, callback);
  }
  
  this.sendTX = function(tx, callback) {
    url = 'http://blockchain.info/pushtx';
    postdata = 'tx=' + tx;
    if (url != null && url != "") {
        fetchData(url, callback, callback, postdata);
    }
  }
}
