var CWBitcoinQuote = (function() {
  var exports = {};

  var quoteCache = null
  var defaultQuote = 0

  exports.getQuote = function(cb) {
    getCache(function() {
      if (quoteCache !== null) {
        cb(quoteCache)
        return
      }
      cb(defaultQuote)
    })
  }

  function getCache(cb) {
    if (quoteCache === null) {
      refreshCache(cb)
      return
    }

    cb(quoteCache)
    return
  }

  function refreshCache(cb, fallback) {
    var url = "https://apiv2.bitcoinaverage.com/indices/global/ticker/short?crypto=BTC&fiat=USD";
    if (fallback) {
      url = "https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD";
    }

    $.ajax({
      method: "GET",
      url: url,
      dataType: 'json',
      success: function(apiResponse) {
        buildQuoteFromResponse(apiResponse, fallback);
        if (typeof cb == 'function') {
          cb(quoteCache)
          return
        }
      },
      error: function(jqxhr, textSatus, errorThrown) {
        $.jqlog.warn('bitcoinaverage quote failed: '+textSatus+' '+errorThrown);

        if (!fallback) {
          refreshCache(cb, true)
          return;
        }

        if (typeof cb == 'function') {
          cb(defaultQuote)
        }
        return
      }
    });
  }

  function buildQuoteFromResponse(apiResponse, fallback) {
    if (fallback) {
      quoteCache = apiResponse.USD
    } else {
      quoteCache = apiResponse.BTCUSD.last
    }
    $.jqlog.debug('buildQuoteFromResponse fallback='+fallback+' quoteCache '+JSON.stringify(quoteCache));
  }

  // init
  setInterval(refreshCache, 900000); // refresh once every 15 minutes
  setTimeout(refreshCache, 1000); // first time 1 sec. after load

  return exports;
})();
