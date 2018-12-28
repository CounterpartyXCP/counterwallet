var CWBitcoinFees = (function() {
  var exports = {};

  var DEFAULT_FEE_MAX_DELAY_BLOCKS = 2;

  var feesCache = null
  // provide at least something for fallback fees
  //   make it obvious that there is no predictability here
  var defaultFees = [
    {
      offset: 0,
      fee: 101,
      minDelay: 1,
      maxDelay: 9999
    },
    {
      offset: 1,
      fee: 201,
      minDelay: 1,
      maxDelay: 1000
    }
  ]

  exports.getFees = function(cb) {
    getCache(cb)
  }

  exports.getFeeByOffset = function(offset, cb) {
    getCache(function() {
      if (feesCache[offset] != null) {
        cb(feesCache[offset]);
        return
      }
      cb(lastOrDefaultFee())
      return
    })
  }

  exports.defaultFee = function(cb) {
    getCache(function() {
      for (var i = 0; i < feesCache.length; i++) {
        if (feesCache[i].minDelay <= 0 && feesCache[i].maxDelay <= DEFAULT_FEE_MAX_DELAY_BLOCKS) {
          cb(feesCache[i])
          return
        }
      }
      cb(lastOrDefaultFee())
      return
    })
  }

  function lastOrDefaultFee() {
    if (feesCache.length) {
      return feesCache[feesCache.length - 1]
    }
    return defaultFees[0]
  }

  function getCache(cb) {
    if (feesCache === null) {
      refreshCache(cb)
      return
    }

    cb(feesCache)
    return
  }

  function refreshCache(cb) {
    $.ajax({
      method: "GET",
      url: "https://bitcoinfees.earn.com/api/v1/fees/list",
      dataType: 'json',
      success: function(apiResponse) {
        buildFeesFromResponse(apiResponse);
        if (typeof cb == 'function') {
          cb(feesCache)
          return
        }
      },
      error: function(jqxhr, textSatus, errorThrown) {
        $.jqlog.warn('bitcoinfees quote failed: '+textSatus+' '+errorThrown);
        if (typeof cb == 'function') {
          if (feesCache == null) {
            feesCache = defaultFees
          }
          cb(feesCache)
        }
        return
      }
    });
  }

  function buildFeesFromResponse(apiResponse) {
    var rawFees = apiResponse.fees
    // $.jqlog.debug('buildFeesFromResponse rawFees '+JSON.stringify(rawFees,null,2));
    feesCache = []

    var highestOffset = -1;
    var feeOffest = 0;
    for (var i = 0; i < rawFees.length; i++) {
      var feeEntry = rawFees[i]
      if (feeEntry.minFee == 0) {
        continue;
      }

      var cacheEntry = {
        offset: feeOffest,
        fee: feeEntry.minFee,
        minDelay: feeEntry.minDelay,
        maxDelay: feeEntry.maxDelay
      };
      feesCache.push(cacheEntry);
      ++feeOffest;

      // stop at 0
      if (feeEntry.maxDelay == 0) {
        break;
      }
    }

    // $.jqlog.debug('buildFeesFromResponse feesCache '+JSON.stringify(feesCache));
  }

  // init
  setInterval(refreshCache, 300000); // refresh once every 5 minutes
  setTimeout(refreshCache, 1000); // first time 1 sec. after load

  return exports;
})();
