// usage:
//   var feeController = CWFeeModelMixin(modalDialogModel)
//   feeController.reset()
var CWFeeModelMixin = function(modalDialogModel, opts) {
  var exports = {};

  var self = modalDialogModel;

  opts.action = opts.action || null;
  opts.transactionParameters = opts.transactionParameters || [];
  opts.validTransactionCheck = opts.validTransactionCheck || null;
  opts.buildTransactionData = opts.buildTransactionData || null;
  opts.address = opts.address || self.address;
  opts.prefix = opts.prefix || '';

  // public functions
  exports.reset = function() {
    clearGeneratedTransaction()

    setObs('transactionParamsAreValid', false);

    setObs('customFee', null)
    setObs('feePriorityLocaleName', 'fee_priority_details_between');
    setObs('feePriorityLocaleArgs', ['','','']);

    setObs('feeDetailsLocaleName', 'fee_details_calculating');
    setObs('feeDetailsLocaleArgs', []);


    setFeeDefaults()
  }

  exports.getCustomFee = function() {
    return getObs('customFee')
  }

  exports.getUnsignedTx = function() {
    return getObs('_unsignedTx')
  }

  // "0.00007999"
  exports.getFeeInBTC = function() {
    var args = getObs('feeDetailsLocaleArgs')
    return args[0];
  }

  // "0.39"
  exports.getFeeInFiat = function() {
    var args = getObs('feeDetailsLocaleArgs')
    return args[1];
  }

  exports.getFeeText = function() {
    var args = getObs('feeDetailsLocaleArgs')
    return args[0]+' ' + KEY_ASSET.BTC + ' ('+args[1]+' '+KEY_ASSET.USD + ')';
  }

  // local variables
  var _currentTransactionCallbackOffset = 0; // prevent transaction calculations from arriving in the wrong order

  // one time init
  function init() {
    // observables
    defineObservable('customFee', null);                                       // = ko.observable(null);
    defineObservable('feeSlider', 0);                                          // = ko.observable(0);
    defineObservable('feeSliderMax', 0);                                       // = ko.observable(0)
    defineObservable('feePriorityLocaleName', 'fee_priority_details_between'); // = ko.observable('fee_priority_details_between');
    defineObservable('feePriorityLocaleArgs', ['','','']);                     // = ko.observable(['','','']);
    defineObservable('feeDetailsLocaleName', 'fee_details');                   // = ko.observable('fee_details');
    defineObservable('feeDetailsLocaleArgs', []);                              // = ko.observable([]);
    defineObservable('_unsignedTx', null);                                     // = ko.observable(null);
    defineObservable('transactionParamsAreValid', false);

    // computed
    defineComputed('transactionIsReady', function() {
      return getObs('_unsignedTx') !== null && getObs('_unsignedTx').length;
    });

    // subscribe to things that make the transaction change
    for (var i = 0; i < opts.transactionParameters.length; i++) {
      opts.transactionParameters[i].subscribe(feeParametersChanged)
    }
    obsObj('customFee').subscribe(feeParametersChanged)

    obsObj('feeSlider').subscribe(function(sliderOffset) {
      CWBitcoinFees.getFeeByOffset(sliderOffset, function(fee) {
        obsObj('customFee')(fee.fee);
      })
    })

    // setup functions
    setFeeDefaults()
  }

  // support functions
  var clearGeneratedTransaction = function() {
    ++_currentTransactionCallbackOffset;
    setObs('_unsignedTx', null);
    setObs('feeDetailsLocaleName', 'fee_details_calculating');
    setObs('feeDetailsLocaleArgs', []);
  }

  var setFeeDefaults = function() {
    CWBitcoinFees.getFees(function(fees) {
      setObs('feeSliderMax', fees.length - 1);
      CWBitcoinFees.defaultFee(function(fee) {
        setObs('feeSlider', fee.offset);
        setObs('customFee', fee.fee);
      })
    })
  }


  var feeParametersChanged = function() {
    clearGeneratedTransaction();

    // update fee information display
    CWBitcoinFees.getFeeByOffset(getObs('feeSlider'), function(fee) {
      if (fee.maxDelay == 0) {
        setObs('feePriorityLocaleName', 'fee_priority_details_no_wait');
        setObs('feePriorityLocaleArgs', [fee.fee]);
      } else if (fee.minDelay == 0) {
        setObs('feePriorityLocaleName', 'fee_priority_details_up_to');
        setObs('feePriorityLocaleArgs', [fee.maxDelay, fee.fee]);
      } else {
        setObs('feePriorityLocaleName', 'fee_priority_details_between');
        setObs('feePriorityLocaleArgs', [fee.minDelay, fee.maxDelay, fee.fee]);
      }
    })

    debouncedFeeParametersChanged();
  }

  var debouncedFeeParametersChanged = _.debounce(function() {
    // clear fee and signed transaction
    clearGeneratedTransaction();

    // don't form the transaction if transaction isn't valid yet
    if (opts.validTransactionCheck != null && opts.validTransactionCheck() !== true) {
      setObs('transactionParamsAreValid', false);
      return;
    }
    setObs('transactionParamsAreValid', true);

    // pre-sign the transaction

    var tx_data = opts.buildTransactionData();
    WALLET.createUnsignedTransactionWithExtendedTXInfo(opts.address(), opts.action, tx_data,
      function(extendedTxInfo, offset) {
        if (offset !== _currentTransactionCallbackOffset) {
          // $.jqlog.debug('old transaction calculation ignored');
          return;
        }

        setObs('_unsignedTx', extendedTxInfo.tx_hex);
        var feeFloat = extendedTxInfo.btc_fee / UNIT

        CWBitcoinQuote.getQuote(function(quote) {
          var fiatString = formatFiat(feeFloat * quote, 2, 2)

          var hasBTCOut = extendedTxInfo.btc_out > 0;
          var isBTCSend = false;
          if (hasBTCOut && opts.action == "create_send" && tx_data.asset === KEY_ASSET.BTC) {
            isBTCSend = true;
          }

          if (hasBTCOut && !isBTCSend) {
            var dustFloat = extendedTxInfo.btc_out / UNIT
            setObs('feeDetailsLocaleName', 'fee_details_with_btc_out');
            setObs('feeDetailsLocaleArgs', [formatCryptoFloat(feeFloat + dustFloat), fiatString, formatCryptoFloat(feeFloat), formatCryptoFloat(dustFloat)]);
          } else {
            setObs('feeDetailsLocaleName', 'fee_details');
            setObs('feeDetailsLocaleArgs', [formatCryptoFloat(feeFloat), fiatString]);
          }


        })
      },
      _currentTransactionCallbackOffset
    );


  }, 650);

  function formatCryptoFloat(rawFee) {
    if (rawFee != null && rawFee >= 0) {
      return smartFormat(rawFee, null, 8);
    }

    return '';
  }

  // macros to get and set observables
  //   takes into account the prefix
  function getObs(observableName) {
    return obsObj(observableName)()
  }
  function setObs(observableName, value) {
    obsObj(observableName)(value)
  }

  // define observable and computed using prefix
  function defineObservable(observableName, arg) {
    self[opts.prefix + observableName] = ko.observable.call(self, arg)
  }
  function defineComputed(observableName, arg) {
    self[opts.prefix + observableName] = ko.computed.call(self, arg)
  }
  function obsObj(observableName) {
    return self[opts.prefix + observableName];
  }

  // call the init function to set everything up
  init();

  // return public methods
  return exports;
}
