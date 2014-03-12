ko.validation.rules['assetNameIsTaken'] = {
  async: true,
  message: 'Asset name is already taken',
  validator: function (val, self, callback) {
    failoverAPI("get_issuances",
      {'filters': {'field': 'asset', 'op': '==', 'value': val}},
      function(data, endpoint) {
        return data.length ? callback(false) : callback(true) //empty list -> true (valid = true)
      }
    );   
  }
};
ko.validation.rules['isValidAssetDescription'] = {
    validator: function (val, self) {
      return byteCount(val) <= MAX_ASSET_DESC_LENGTH;
    },
    message: 'Asset description is more than ' + MAX_ASSET_DESC_LENGTH + ' bytes long.'
};
ko.validation.registerExtenders();

function CreateAssetModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable('');
  self.name = ko.observable('').extend({
    required: true,
    pattern: {
      message: 'Must be between 4-24 uppercase letters only (A-Z) & cannot start with the letter A.',
      params: '^[B-Z][A-Z]{3,23}$'
    },
    assetNameIsTaken: self
  });
  self.description = ko.observable('').extend({
    required: false,
    isValidAssetDescription: self
  });
  self.divisible = ko.observable(true);
  self.amount = ko.observable().extend({
    required: true,
    pattern: {
      message: 'Must be a valid number',
      params: '^[0-9]*\.?[0-9]{0,8}$' //not perfect ... will convert divisible assets to satoshi before sending to API
    },
    isValidQtyForDivisibility: self
  });
  self.callable = ko.observable(false);
  self.callDate = ko.observable(new Date(new Date().getTime() + 30*24*60*60*1000)).extend({
    //^ default to current date + 30 days for now (also serves to hide a bug with the required
    // field validation not working if this field is empty). This is temporary...
    date: true,
    required: {
      message: "Call date is required if the asset is callable",
      onlyIf: function () { return (self.callable() === true); }
    }
  });
  self.callPrice = ko.observable().extend({
    required: {
      message: "Call price is required if the asset is callable",
      onlyIf: function () { return (self.callable() === true); }
    },
    pattern: {
      message: 'Must be a valid number',
      params: '^[0-9]*\.?[0-9]{0,8}$'
    },
    isValidQtyForDivisibility: self
  });
  
  self.validationModel = ko.validatedObservable({
    name: self.name,
    description: self.description,
    amount: self.amount,
    callDate: self.callDate,
    callPrice: self.callPrice
  });  

  self.resetForm = function() {
    self.name('');
    self.description('');
    self.divisible(true);
    self.amount(null);
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if(self.name.isValidating()) {
      setTimeout(function() { //wait a bit and call again
        self.submitForm();
      }, 50);
      return;
    }
    
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    
    //data entry is valid...submit to the server
    console.log("Submitting form...");
    $('#createAssetModal form').submit();
  }

  self.doAction = function() {
    var amount = parseFloat(self.amount());
    var rawAmount = denormalizeAmount(amount, self.divisible());
    
    if(rawAmount > MAX_INT) {
      bootbox.alert("The amount desired to be issued for this asset is too high.");
      return false;
    }
    
    if(self.callable() && self.callDate() <= new Date()) {
      bootbox.alert("Call date cannot be in the past.");
      return false;
    }
    
    //convert callDate + callPrice
    var rawCallDate = self.callDate() ? parseInt(self.callDate().getTime() / 1000) : 0; //epoch ts

    WALLET.doTransaction(self.address(), "create_issuance",
      { source: self.address(),
        asset: self.name(),
        amount: rawAmount,
        divisible: self.divisible(),
        description: self.description(),
        callable_: self.callable,
        call_date: rawCallDate,
        call_price: parseFloat(self.callPrice()) || 0.0, //float
        transfer_destination: null
      },
      function() {
        bootbox.alert("<b>Your asset was created successfully.</b><br/><br/>It will automatically appear under the \
        appropriate address once the network has confirmed it, and your account will be deducted by <b>" + ASSET_CREATION_FEE_XCP + " XCP</b>.");
      }
    );
    self.shown(false);
  }
  
  self.show = function(address, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.address(address);
    self.shown(true);
  }  

  self.hide = function() {
    self.shown(false);
  }  
}


ko.validation.rules['additionalIssueDoesNotExceedLimit'] = {
    validator: function (val, self) {
      return self.rawAdditionalIssue() + self.asset().totalIssued() <= MAX_INT;
    },
    message: 'This issuance would exceed the hard limit for maximum amount.'
};
ko.validation.registerExtenders();

function IssueAdditionalAssetModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(''); // SOURCE address (supplied)
  self.divisible = ko.observable();
  self.asset = ko.observable();
  
  self.additionalIssue = ko.observable('').extend({
    required: true,
    pattern: {
      message: 'Must be a valid amount',
      params: '^[0-9]*\.?[0-9]{0,8}$' //not perfect ... will convert divisible assets to satoshi before sending to API
    },
    isValidQtyForDivisibility: self,
    additionalIssueDoesNotExceedLimit: self
  });
  
  self.displayedTotalIssued = ko.computed(function() {
    if(!self.asset()) return null;
    return self.asset().displayedTotalIssued();
  }, self);
  
  self.rawAdditionalIssue = ko.computed(function() {
    if(!self.asset() || !isNumber(self.additionalIssue())) return null;
    return denormalizeAmount(self.additionalIssue(), self.asset().DIVISIBLE); 
  }, self);

  self.validationModel = ko.validatedObservable({
    additionalIssue: self.additionalIssue
  });

  self.resetForm = function() {
    self.additionalIssue(null);
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    console.log("Submitting form...");
    $('#issueAdditionalAssetModal form').submit();
  }

  self.doAction = function() {
    //do the additional issuance (specify non-zero amount, no transfer destination)
    WALLET.doTransaction(self.address(), "create_issuance",
      { source: self.address(),
        amount: self.rawAdditionalIssue(),
        asset: self.asset().ASSET,
        divisible: self.asset().DIVISIBLE,
        description: self.asset().description(),
        callable_: self.asset().CALLABLE,
        call_date: self.asset().CALLDATE,
        call_price: self.asset().CALLPRICE,
        transfer_destination: null
      },
      function() {
        self.shown(false);
        bootbox.alert("You have issued <b>" + self.additionalIssue().toString() + "</b> additional quantity on your asset <b>"
          + self.asset().ASSET + "</b>. It may take a bit for this to reflect.");
      }
    );
  }
  
  self.show = function(address, divisible, asset, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.address(address);
    self.divisible(divisible);
    self.asset(asset);
    self.shown(true);
  }  

  self.hide = function() {
    self.shown(false);
  }  
}

function TransferAssetModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(''); // SOURCE address (supplied)
  self.asset = ko.observable();
  
  self.destAddress = ko.observable('').trimmed().extend({
    required: true,
    isValidBitcoinAddress: self,
    isNotSameBitcoinAddress: self
  });
  
  self.validationModel = ko.validatedObservable({
    destAddress: self.destAddress
  });

  self.resetForm = function() {
    self.destAddress('');
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    console.log("Submitting form...");
    $('#transferAssetModal form').submit();
  }

  self.doAction = function() {
    //do the transfer (zero amount issuance to the specified address)
    WALLET.doTransaction(self.address(), "create_issuance",
      { source: self.address(),
        amount: 0,
        asset: self.asset().ASSET,
        divisible: self.asset().DIVISIBLE,
        description: self.asset().description(),
        callable_: self.asset().CALLABLE,
        call_date: self.asset().CALLDATE,
        call_price: self.asset().CALLPRICE,
        transfer_destination: self.destAddress()
      },
      function() {
        self.shown(false);
        bootbox.alert("<b>" + self.asset().ASSET + "</b> has been transferred to <b>" + self.destAddress() + "</b>. It may take a bit for this to reflect.");
      }
    );
  }
  
  self.show = function(sourceAddress, asset, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.address(sourceAddress);
    self.asset(asset);
    self.shown(true);
  }  

  self.hide = function() {
    self.shown(false);
  }  
}


ko.validation.rules['newDescIsNotSameAsCurrentDesc'] = {
    validator: function (val, self) {
      return self.newDescription() != self.asset().description();
    },
    message: 'This description is the same as the current description.'
};
ko.validation.registerExtenders();

function ChangeAssetDescriptionModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(''); // SOURCE address (supplied)
  self.asset = ko.observable();
  
  self.newDescription = ko.observable('').extend({
    required: true,
    isValidAssetDescription: self,
    newDescIsNotSameAsCurrentDesc: self
  });
  
  self.validationModel = ko.validatedObservable({
    newDescription: self.newDescription
  });

  self.resetForm = function() {
    self.newDescription('');
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    console.log("Submitting form...");
    $('#changeAssetDescriptionModal form').submit();
  }

  self.doAction = function() {
    //to change the desc, issue with amount == 0 and the new description in the description field
    WALLET.doTransaction(self.address(), "create_issuance",
      { source: self.address(),
        amount: 0,
        asset: self.asset().ASSET,
        divisible: self.asset().DIVISIBLE,
        description: self.newDescription(),
        callable_: self.asset().CALLABLE,
        call_date: self.asset().CALLDATE,
        call_price: self.asset().CALLPRICE,
        transfer_destination: null
      },
      function() {
        self.shown(false);
        bootbox.alert("Your asset's description has been changed. It may take a bit for this to reflect.");
      }
    );
  }
  
  self.show = function(address, asset, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.address(address);
    self.asset(asset);
    self.shown(true);
  }  

  self.hide = function() {
    self.shown(false);
  }  
}


ko.validation.rules['amountDoesNotExceedDividendAssetBalance'] = {
    validator: function (val, self) {
      if(self.dividendAssetBalRemainingPostPay() === null) return true; //wait until dividend asset chosen to validate
      return self.dividendAssetBalRemainingPostPay() >= 0;
    },
    message: 'The total dividend would exceed the address\' balance for the selected Dividend Asset.'
};
ko.validation.registerExtenders();

var DividendAssetInDropdownItemModel = function(asset, rawBalance, normalizedBalance) {
  this.ASSET = asset;
  this.RAW_BALANCE = rawBalance; //raw
  this.NORMALIZED_BALANCE = normalizedBalance; //normalized
  this.SELECT_LABEL = asset + " (bal: " + normalizedBalance + ")";
};
function PayDividendModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(''); // SOURCE address (supplied)
  self.asset = ko.observable(null); //dividends are paid to holders of this asset

  self.availableDividendAssets = ko.observableArray([]);
  self.selectedDividendAsset = ko.observable(null).extend({ //dividends are paid IN (i.e. with) this asset
    required: true
  });
  
  self.amountPerUnit = ko.observable('').extend({
    required: true,
    pattern: {
      message: 'Must be a valid number',
      params: '^[0-9]*\.?[0-9]{0,8}$' //not perfect ... will convert divisible assets to satoshi before sending to API
    },
    amountDoesNotExceedDividendAssetBalance: self
  });
  
  self.assetName = ko.computed(function() {
    if(!self.asset()) return null;
    return self.asset().ASSET;
  }, self);
  
  self.totalPay = ko.computed(function() {
    if(!self.asset()) return null;
    return self.amountPerUnit() * self.asset().normalizedTotalIssued();
  }, self);

  self.dividendAssetBalance = ko.computed(function() {
    if(!self.selectedDividendAsset()) return null;
    return WALLET.getBalance(self.address(), self.selectedDividendAsset()); //normalized
  }, self);

  self.dividendAssetBalRemainingPostPay = ko.computed(function() {
    if(!self.asset() || self.dividendAssetBalance() === null) return null;
    return Decimal.round(new Decimal(self.dividendAssetBalance()).sub(self.totalPay()), 8).toFloat();
  }, self);
  
  self.validationModel = ko.validatedObservable({
    amountPerUnit: self.amountPerUnit,
    selectedDividendAsset: self.selectedDividendAsset
  });

  self.resetForm = function() {
    self.amountPerUnit(null);
    self.availableDividendAssets([]);
    self.selectedDividendAsset(null);
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    console.log("Submitting form...");
    $('#payDividendModal form').submit();
  }

  self.doAction = function() {
    //do the additional issuance (specify non-zero amount, no transfer destination)
    WALLET.doTransaction(self.address(), "create_dividend",
      { source: self.address(),
        amount_per_unit: denormalizeAmount(parseFloat(self.amountPerUnit())),
        asset: self.asset().ASSET,
        dividend_asset: self.selectedDividendAsset()
      },
      function() {
        self.shown(false);
        bootbox.alert("You have paid a dividend of <b>" + self.amountPerUnit().toString()
          + " XCP</b> per outstanding unit to holders of asset <b>" + self.asset().ASSET
          + "</b>. It may take a bit for this to reflect.");
      }
    );
  }
  
  self.show = function(address, asset, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.address(address);
    self.asset(asset);
    self.shown(true);
    
    //Get the balance of ALL assets at this address
    failoverAPI("get_normalized_balances", [address], function(data, endpoint) {
      for(var i=0; i < data.length; i++) {
        if(data[i]['amount'] !== null && data[i]['amount'] !== 0)
          self.availableDividendAssets.push(new DividendAssetInDropdownItemModel(data[i]['asset'], data[i]['amount'], data[i]['normalized_amount']));
      }

      //Also get the BTC balance at this address and put at head of the list
      WALLET.retrieveBTCBalance(address, function(balance) {
        if(balance) {
          self.availableDividendAssets.unshift(new DividendAssetInDropdownItemModel("BTC", balance, normalizeAmount(balance)));
        }
      });
    });
  }  

  self.hide = function() {
    self.shown(false);
  }  
}


ko.validation.rules['calledAmountDoesNotExceedXCPBalanceRequired'] = {
    validator: function (val, self) {
      if(self.xcpBalRemainingPostCall() === null) return true; //wait until dividend asset chosen to validate
      return self.xcpBalRemainingPostCall() >= 0;
    },
    message: 'The total dividend would exceed the address\' balance for the selected Dividend Asset.'
};
ko.validation.registerExtenders();

function CallAssetModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(''); // SOURCE address (supplied)

  self.callableAssets = ko.observableArray([]);
  self.selectedCallableAsset = ko.observable(null).extend({ //dividends are paid IN (i.e. with) this asset
    required: true
  });
  
  self.percentageToCall = ko.observable('').extend({
    required: true,
    pattern: {
      message: 'Must be a valid number',
      params: '^[0-9]*\.?[0-9]{0,8}$' //not perfect ... will convert divisible assets to satoshi before sending to API
    },
    max: 100,
    min: 0.00000001, 
    calledAmountDoesNotExceedXCPBalanceRequired: self
  });
  
      //if(!isNumber(val)) return false;
      //return val * self.asset().normalizedTotalIssued() <= WALLET.getBalance(self.address(), self.selectedDividendAsset());
  
  self.assetName = ko.computed(function() {
    if(!self.asset()) return null;
    return self.asset().ASSET;
  }, self);
  
  self.totalPay = ko.computed(function() {
    if(!self.asset()) return null;
    return self.amountPerUnit() * self.asset().normalizedTotalIssued();
  }, self);

  self.dividendAssetBalance = ko.computed(function() {
    if(!self.selectedDividendAsset()) return null;
    return WALLET.getBalance(self.address(), self.selectedDividendAsset()); //normalized
  }, self);

  self.xcpBalRemainingPostCall = ko.computed(function() {
    if(!self.asset() || self.dividendAssetBalance() === null) return null;
    return Decimal.round(new Decimal(self.dividendAssetBalance()).sub(self.totalPay()), 8).toFloat();
  }, self);
  
  self.validationModel = ko.validatedObservable({
    selectedCallableAsset: self.selectedCallableAsset,
    percentageToCall: self.percentageToCall
  });

  self.resetForm = function() {
    self.amountPerUnit(null);
    self.availableDividendAssets([]);
    self.selectedDividendAsset(null);
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    console.log("Submitting form...");
    $('#payDividendModal form').submit();
  }

  self.doAction = function() {
    //do the additional issuance (specify non-zero amount, no transfer destination)
    WALLET.doTransaction(self.address(), "create_dividend",
      { source: self.address(),
        amount_per_unit: denormalizeAmount(parseFloat(self.amountPerUnit())),
        asset: self.asset().ASSET,
        dividend_asset: self.selectedDividendAsset()
      },
      function() {
        self.shown(false);
        bootbox.alert("You have paid a dividend of <b>" + self.amountPerUnit().toString()
          + " XCP</b> per outstanding unit to holders of asset <b>" + self.asset().ASSET
          + "</b>. It may take a bit for this to reflect.");
      }
    );
  }
  
  self.show = function(address, asset, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.address(address);
    self.asset(asset);
    self.shown(true);
    
    //Get the balance of ALL assets at this address
    failoverAPI("get_normalized_balances", [address], function(data, endpoint) {
      for(var i=0; i < data.length; i++) {
        if(data[i]['amount'] !== null && data[i]['amount'] !== 0)
          self.availableDividendAssets.push(new DividendAssetInDropdownItemModel(data[i]['asset'], data[i]['amount'], data[i]['normalized_amount']));
      }
      //TODO: enable this once counterpartyd supports dividends in BTC
      /*//Also get the BTC balance at this address and put at head of the list
      WALLET.retrieveBTCBalance(address, function(balance) {
        if(balance) {
          self.availableDividendAssets.unshift(new DividendAssetInDropdownItemModel("BTC", balance, normalizeAmount(balance)));
        }
      });*/
    });
  }  

  self.hide = function() {
    self.shown(false);
  }  
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
