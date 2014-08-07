Counterblock = {};

Counterblock.getBalances = function(addresses, cwkeys, callback) {

  WALLET.retriveBTCAddrsInfo(addresses, function(btcData) {
    failoverAPI("get_normalized_balances", {'addresses': addresses}, function(assetsData, endpoint) {
      var data = {};
      // extracts all asset except BTC
      for (var i in assetsData) {
        e = assetsData[i];
        data[e.address] = data[e.address] || {};
        data[e.address][e.asset] = {
          'balance': e.quantity,
          'owner': e.owner
        }
      }
      // extracts BTC only if balance>0 or other assets in data[e.addr]
      for (var i in btcData) {
        e = btcData[i];
        if (data[e.addr] || e.confirmedRawBal>0) {
          data[e.addr] = data[e.addr] || {};
          data[e.addr][BTC] = {
            'balance': e.confirmedRawBal,
            'txouts': e.rawUtxoData.length  
          }; 
          if (cwkeys[e.addr]) {
            data[e.addr][BTC]['privkey'] = cwkeys[e.addr].getWIF();
          }
        }        
      }
      callback(data);
    });
  });

}

