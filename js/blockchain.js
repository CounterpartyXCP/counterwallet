// Here we hold all the interactions with the blockchain.
var BLOCKCHAIN = new function () {
  
  this.retrieveBalance = function(address, callback) {
    url = 'http://blockchain.info/q/addressbalance/';
    this.tx_fetch(url + address, callback);
  }
  
  this.getUnspentOutputs = function(address, callback) {

      var url = 'http://blockchain.info/unspent?address=' + address;

      this.tx_fetch(url, callback);
  }
  
  this.sendTX = function(tx, callback) {

      url = 'http://blockchain.info/pushtx';
      postdata = 'tx=' + tx;
      if (url != null && url != "") {
          this.tx_fetch(url, callback, callback, postdata);
      }
  }
  
  // Some cross-domain magic (to bypass Access-Control-Allow-Origin)
  this.tx_fetch = function(url, onSuccess, onError, postdata) {
      var useYQL = true;

      if (useYQL) {
          var q = 'select * from html where url="'+url+'"';
          if (postdata) {
              q = 'use "http://brainwallet.github.com/js/htmlpost.xml" as htmlpost; ';
              q += 'select * from htmlpost where url="' + url + '" ';
              q += 'and postdata="' + postdata + '" and xpath="//p"';
          }
          url = 'https://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(q);
      }

      $.ajax({
          url: url,
          success: function(res) {
              onSuccess(useYQL ? $(res).find('results').text() : res.responseText);
          },
          error:function (xhr, opt, err) {
              if (onError)
                  onError(err);
          }
      });
  }
}
