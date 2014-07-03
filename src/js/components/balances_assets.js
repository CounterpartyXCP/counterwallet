ko.validation.rules['assetNameIsTaken'] = {
  async: true,
  message: 'Token name is already taken',
  validator: function (val, self, callback) {
    failoverAPI("get_issuances",
      {'filters': {'field': 'asset', 'op': '==', 'value': val}},
      function(data, endpoint) {
        return data.length ? callback(false) : callback(true) //empty list -> true (valid = true)
      }
    );   
  }
};
// TODO: DRY!!
ko.validation.rules['assetNameExists'] = {
  async: true,
  message: 'Token name does not exist',
  validator: function (val, self, callback) {
    failoverAPI("get_issuances",
      {'filters': {'field': 'asset', 'op': '==', 'value': val}},
      function(data, endpoint) {
        $.jqlog.debug("asset exists: "+data.length);
        return data.length ? callback(true) : callback(false) //empty list -> false (valid = false)
      }
    );   
  }
};

ko.validation.rules['isValidAssetDescription'] = {
    validator: function (val, self) {
      return byteCount(val) <= MAX_ASSET_DESC_LENGTH;
    },
    message: 'Token description is more than ' + MAX_ASSET_DESC_LENGTH + ' bytes long.'
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
  self.quantity = ko.observable().extend({
    required: true,
    isValidPositiveQuantityOrZero: self,
    isValidQtyForDivisibility: self
  });
  self.callable = ko.observable(false);
  self.callDate = ko.observable(new Date(new Date().getTime() + 30*24*60*60*1000)).extend({
    //^ default to current date + 30 days for now (also serves to hide a bug with the required
    // field validation not working if this field is empty). This is temporary...
    date: true,
    required: {
      message: "Call date is required if the token is callable",
      onlyIf: function () { return (self.callable() === true); }
    }
  });
  self.callPrice = ko.observable(0).extend({
    required: {
      message: "Call price is required if the token is callable",
      onlyIf: function () { return (self.callable() === true); }
    },
    isValidPositiveQuantityOrZero: self
  });
  
  self.validationModel = ko.validatedObservable({
    name: self.name,
    description: self.description,
    quantity: self.quantity,
    callDate: self.callDate,
    callPrice: self.callPrice
  });  

  self.resetForm = function() {
    self.name('');
    self.description('');
    self.divisible(true);
    self.quantity(null);
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
    $('#createAssetModal form').submit();
  }

  self.doAction = function() {
    var quantity = parseFloat(self.quantity());
    var rawQuantity = denormalizeQuantity(quantity, self.divisible());
    
    if(rawQuantity > MAX_INT) {
      bootbox.alert("The quantity desired to be issued for this token is too high.");
      return false;
    }
    
    if(self.callable() && self.callDate() <= new Date()) {
      bootbox.alert("Call date cannot be in the past.");
      return false;
    }
    
    WALLET.doTransaction(self.address(), "create_issuance",
      { source: self.address(),
        asset: self.name(),
        quantity: rawQuantity,
        divisible: self.divisible(),
        description: self.description(),
        callable_: self.callable(),
        call_date: self.callable() ? parseInt(self.callDate().getTime() / 1000) : null, //epoch ts
        call_price: self.callable() ? parseFloat(self.callPrice()) : null, //float
        transfer_destination: null
      },
      function(txHash, data, endpoint) {
        bootbox.alert("Your token <b class='notoAssetColor'>" + self.name() + "</b>"
          + " has been created.<br/><br/>It will automatically appear under the appropriate address once the network"
          + " has confirmed it, and your address <b class='notoAddrColor'>" + getAddressLabel(self.address())
          +  "</b> will be deducted by <b class='notoQuantityColor'>" + ASSET_CREATION_FEE_XCP + "</b> <b class='notoAssetColor'>XCP</b>.");
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


function IssueAdditionalAssetModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(''); // SOURCE address (supplied)
  self.divisible = ko.observable();
  self.asset = ko.observable();
  
  self.additionalIssue = ko.observable('').extend({
    required: true,
    isValidPositiveQuantity: self,
    isValidQtyForDivisibility: self,
    validation: {
      validator: function (val, self) {
        return self.rawAdditionalIssue() + self.asset().rawSupply() <= MAX_INT;
      },
      message: 'This issuance would exceed the hard limit for maximum quantity.',
      params: self
    }    
  });
  
  self.dispTotalIssued = ko.computed(function() {
    if(!self.asset()) return null;
    return self.asset().dispTotalIssued();
  }, self);
  
  self.rawAdditionalIssue = ko.computed(function() {
    if(!self.asset() || !isNumber(self.additionalIssue())) return null;
    return denormalizeQuantity(self.additionalIssue(), self.asset().DIVISIBLE); 
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
    $('#issueAdditionalAssetModal form').submit();
  }

  self.doAction = function() {
    //do the additional issuance (specify non-zero quantity, no transfer destination)
    WALLET.doTransaction(self.address(), "create_issuance",
      { source: self.address(),
        quantity: self.rawAdditionalIssue(),
        asset: self.asset().ASSET,
        divisible: self.asset().DIVISIBLE,
        description: self.asset().description(),
        callable_: self.asset().CALLABLE,
        call_date: self.asset().CALLABLE ? self.asset().CALLDATE : null,
        call_price: self.asset().CALLABLE ? self.asset().CALLPRICE : null,
        transfer_destination: null
      },
      function(txHash, data, endpoint) {
        self.shown(false);
        bootbox.alert("You have issued <b class='notoQuantityColor'>" + self.additionalIssue() + "</b> additional"
          + " quantity on your token <b class='notoAssetColor'>" + self.asset().ASSET + "</b>. "
          + ACTION_PENDING_NOTICE);
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
    $('#transferAssetModal form').submit();
  }

  self.doAction = function() {
    //do the transfer (zero quantity issuance to the specified address)
    WALLET.doTransaction(self.address(), "create_issuance",
      { source: self.address(),
        quantity: 0,
        asset: self.asset().ASSET,
        divisible: self.asset().DIVISIBLE,
        description: self.asset().description(),
        callable_: self.asset().CALLABLE,
        call_date: self.asset().CALLABLE ? self.asset().CALLDATE : null,
        call_price: self.asset().CALLABLE ? self.asset().CALLPRICE : null,
        transfer_destination: self.destAddress()
      },
      function(txHash, data, endpoint) {
        self.shown(false);
        bootbox.alert("<b class='notoAssetColor'>" + self.asset().ASSET + "</b> has been transferred to "
          + " <b class='notoAddressColor'>" + self.destAddress() + "</b>. "
          + ACTION_PENDING_NOTICE);
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


function ChangeAssetDescriptionModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(''); // SOURCE address (supplied)
  self.asset = ko.observable();
  
  self.newDescription = ko.observable('').extend({
    required: true,
    isValidAssetDescription: self,
    validation: {
      validator: function (val, self) {
        return self.newDescription() != self.asset().description();
      },
      message: 'This description is the same as the current description.',
      params: self
    },    
    newDescIsNotSameAsCurrentDesc: self
  });
  
  self.dispAssetDescription = ko.computed(function() {
    return self.asset() ? self.asset().description() : '';
  }, self);

  self.dispCharactersRemaining = ko.computed(function() {
    if(!self.newDescription() || self.newDescription().length > MAX_ASSET_DESC_LENGTH) return '';
    return ' (<b>' + (MAX_ASSET_DESC_LENGTH - byteCount(self.newDescription())) + '</b> bytes remaining)'
  }, self);
    
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
    $('#changeAssetDescriptionModal form').submit();
  }

  self.doAction = function() {
    //to change the desc, issue with quantity == 0 and the new description in the description field
    WALLET.doTransaction(self.address(), "create_issuance",
      { source: self.address(),
        quantity: 0,
        asset: self.asset().ASSET,
        divisible: self.asset().DIVISIBLE,
        description: self.newDescription(),
        callable_: self.asset().CALLABLE,
        call_date: self.asset().CALLABLE ? self.asset().CALLDATE : null,
        call_price: self.asset().CALLABLE ? self.asset().CALLPRICE : null,
        transfer_destination: null
      },
      function(txHash, data, endpoint) {
        self.shown(false);
        bootbox.alert("The description for token <b class='notoAssetColor'>" + self.asset().ASSET + "</b> has been"
          + " changed to <b>" + self.newDescription() + "</b>. " + ACTION_PENDING_NOTICE);
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


var DividendAssetInDropdownItemModel = function(asset, rawBalance, normalizedBalance) {
  this.ASSET = asset;
  this.RAW_BALANCE = rawBalance; //raw
  this.NORMALIZED_BALANCE = normalizedBalance; //normalized
  this.SELECT_LABEL = asset + " (bal: " + normalizedBalance + ")";
};
function PayDividendModalViewModel() {
  var self = this;

  self.shown = ko.observable(false);
  self.addressVM = ko.observable(null); // SOURCE address view model(supplied)
  self.assetData = ko.observable(null);
  
  self.assetName = ko.observable('').extend({
    required: true,
    pattern: {
      message: 'Must be between 4-24 uppercase letters only (A-Z) & cannot start with the letter A.',
      params: '^[B-Z][A-Z]{3,23}$'
    },
    assetNameExists: self,
    rateLimit: { timeout: 500, method: "notifyWhenChangesStop" },
    validation:  {
      validator: function (val, self) {
        if(self.assetData() === null) return true; //wait until dividend asset chosen to validate
        
        var supply = new Decimal(normalizeQuantity(self.assetData().supply, self.assetData().divisible));
        // we substract user balance for this asset
        var userAsset = self.addressVM().getAssetObj(self.assetName());
        if (userAsset) {
          supply = supply.sub(new Decimal(userAsset.normalizedBalance()));
        }
        return supply > 0
      },
      message: 'No dividend to distribute.',
      params: self
    }
  });
  // TODO: DRY! we already make a query to check if assetName exists
  self.assetName.subscribe(function(name) {
    failoverAPI("get_asset_info", [[name]], function(assetsData, endpoint) {
      self.assetData(assetsData[0]);
    });
  });
  
  self.availableDividendAssets = ko.observableArray([]);
  self.selectedDividendAsset = ko.observable(null).extend({ //dividends are paid IN (i.e. with) this asset
    required: true
  });
  
  self.quantityPerUnit = ko.observable('').extend({
    required: true,
    isValidPositiveQuantity: self,
    validation: [{
      validator: function (val, self) {
        if(self.dividendAssetBalRemainingPostPay() === null) return true; //wait until dividend asset chosen to validate
        return self.dividendAssetBalRemainingPostPay() >= 0;
      },
      message: 'The total distribution would exceed the address\' balance for the selected Distribution Token.',
      params: self
    }]
  });
  
  self.totalPay = ko.computed(function() {
    if(!self.assetData() || !isNumber(self.quantityPerUnit()) || !parseFloat(self.quantityPerUnit())) return null;

    var supply = new Decimal(normalizeQuantity(self.assetData().supply, self.assetData().divisible));
    // we substract user balance for this asset
    var userAsset = self.addressVM().getAssetObj(self.assetName());
    if (userAsset) {
      supply = supply.sub(new Decimal(userAsset.normalizedBalance()));
    }
    var totalPay = new Decimal(self.quantityPerUnit()).mul(supply);
    
    return Decimal.round(totalPay, 8, Decimal.MidpointRounding.ToEven).toFloat();

  }, self);
  
  self.dispTotalPay = ko.computed(function() {
    return smartFormat(self.totalPay());
  }, self);

  self.dividendAssetBalance = ko.computed(function() {
    if(!self.selectedDividendAsset()) return null;
    return WALLET.getBalance(self.addressVM().ADDRESS, self.selectedDividendAsset()); //normalized
  }, self);

  self.dividendAssetBalRemainingPostPay = ko.computed(function() {
    if(!self.assetData() || self.dividendAssetBalance() === null || self.totalPay() === null) return null;
    return Decimal.round(new Decimal(self.dividendAssetBalance()).sub(self.totalPay()), 8, Decimal.MidpointRounding.ToEven).toFloat();
  }, self);
  
  self.dispDividendAssetBalRemainingPostPay = ko.computed(function() {
    return smartFormat(self.dividendAssetBalRemainingPostPay());
  }, self);
  
  self.validationModel = ko.validatedObservable({
    quantityPerUnit: self.quantityPerUnit,
    selectedDividendAsset: self.selectedDividendAsset,
    assetName: self.assetName
  });

  self.resetForm = function() {
    self.quantityPerUnit(null);
    self.availableDividendAssets([]);
    self.selectedDividendAsset(null);
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {   
    $('#payDividendModal form').submit();
  }
  
  self.doAction = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }
    //do the additional issuance (specify non-zero quantity, no transfer destination)
    WALLET.doTransaction(self.addressVM().ADDRESS, "create_dividend",
      { source: self.addressVM().ADDRESS,
        quantity_per_unit: denormalizeQuantity(parseFloat(self.quantityPerUnit())),
        asset: self.assetData().asset,
        dividend_asset: self.selectedDividendAsset()
      },
      function(txHash, data, endpoint) {
        self.shown(false);
        bootbox.alert("You have paid a distribution of <b class='notoQuantityColor'>" + self.quantityPerUnit() + "</b>"
          + " <b class='notoAssetColor'>" + self.selectedDividendAsset() + "</b> per outstanding unit to holders of token"
          + " <b class='notoAssetColor'>" + self.assetData().asset + "</b>. " + ACTION_PENDING_NOTICE);
      }
    );
  }

  self.showModal = function(address, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.addressVM(address);
    self.assetName('');
    self.assetData(null);
    self.shown(true);
    
    //Get the balance of ALL assets at this address
    failoverAPI("get_normalized_balances", [[address.ADDRESS]], function(data, endpoint) {
      for(var i=0; i < data.length; i++) {
        if(data[i]['quantity'] !== null && data[i]['quantity'] !== 0)
          self.availableDividendAssets.push(new DividendAssetInDropdownItemModel(data[i]['asset'], data[i]['quantity'], data[i]['normalized_quantity']));
      }

      //Also get the BTC balance at this address and put at head of the list
      WALLET.retrieveBTCBalance(address.ADDRESS, function(balance) {
        if(balance) {
          self.availableDividendAssets.unshift(new DividendAssetInDropdownItemModel("BTC", balance, normalizeQuantity(balance)));
        }
      });
    });
  }
  
  self.show = function(address, resetForm) {
    checkCountry("dividend", function() {
      self.showModal(address, resetForm);
    });
  }  

  self.hide = function() {
    self.shown(false);
  }  
}


function CallAssetModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(null); // SOURCE address (supplied)
  self.asset = ko.observable(null); // Asset to call (supplied)
  self.assetObj = ko.observable(null);
  
  self.percentageToCall = ko.observable(null).extend({
    required: true,
    isValidPositiveQuantity: self,
    max: 100,
    min: 0.00001,
    validation: {
      validator: function (val, self) {
        if(self.xcpBalRemainingPostCall() === null) return true; //wait until dividend asset chosen to validate
        return self.xcpBalRemainingPostCall() >= 0;
      },
      message: 'The total dividend would exceed the address\' balance for the selected Dividend Token.',
      params: self
    }    
  });

  self.dispCallDate = ko.computed(function() {
    if(!self.assetObj()) return null;
    return self.assetObj().dispCallDate();
  }, self);
    
  self.dispCallPrice = ko.computed(function() {
    if(!self.assetObj()) return null;
    return self.assetObj().CALLPRICE;
  }, self);
  
  self.dispTotalIssued = ko.computed(function() {
    if(!self.assetObj()) return null;
    return self.assetObj().normalizedTotalIssued();
  }, self); 
  
  self.dispTotalOutstanding = ko.computed(function() {
    //total qty of this asset in hands other than the asset's owner
    if(!self.assetObj()) return null;
    return self.assetObj().normalizedTotalIssued() - self.assetObj().normalizedBalance();
  }, self); 

  self.unitsToCallback = ko.computed(function() {
    if(!self.dispTotalOutstanding() || !self.percentageToCall()) return null;
    return self.dispTotalOutstanding() * Decimal.round(new Decimal(self.percentageToCall()).div(100), 8, Decimal.MidpointRounding.ToEven).toFloat(); 
  }, self); 

  self.dispUnitsToCallback = ko.computed(function() {
    return smartFormat(self.unitsToCallback(), null, 4); 
  }, self); 

  self.unitsAfterCallback = ko.computed(function() {
    if(!self.assetObj() || !self.unitsToCallback()) return null;
    return self.assetObj().normalizedBalance() + self.unitsToCallback();
  }, self); 

  self.dispUnitsAfterCallback = ko.computed(function() {
    return smartFormat(self.unitsAfterCallback(), null, 4); 
  }, self); 

  self.totalXCPPay = ko.computed(function() {
    if(!self.percentageToCall() || !self.assetObj()) return null;
    return +(self.percentageToCall() * (self.assetObj().normalizedTotalIssued() - self.assetObj().normalizedBalance()) * self.assetObj().CALLPRICE).toFixed(4);
  }, self);

  self.xcpBalRemainingPostCall = ko.computed(function() {
    if(self.totalXCPPay() === null) return null;
    return Decimal.round(new Decimal(WALLET.getBalance(self.address(), 'XCP')).sub(self.totalXCPPay()), 8, Decimal.MidpointRounding.ToEven).toFloat();
  }, self);
  
  self.xcpBalRemainingPostCallIsSet = ko.computed(function() {
    return self.xcpBalRemainingPostCall() !== null;
  }, self);

  self.dispXCPBalRemainingPostCall = ko.computed(function() {
    return smartFormat(self.xcpBalRemainingPostCall(), null, 4);
  }, self);
  
  self.validationModel = ko.validatedObservable({
    percentageToCall: self.percentageToCall
  });

  self.resetForm = function() {
    self.percentageToCall(null);
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    $('#callAssetModal form').submit();
  }

  self.doAction = function() {
    //do the additional issuance (specify non-zero quantity, no transfer destination)
    WALLET.doTransaction(self.address(), "create_callback",
      { source: self.address(),
        fraction: Decimal.round(new Decimal(self.percentageToCall()).div(100), 8, Decimal.MidpointRounding.ToEven).toFloat(),
        asset: self.asset()
      },
      function(txHash, data, endpoint) {
        self.shown(false);
        bootbox.alert("You have called back <b class='notoQuantityColor'>" + self.percentageToCall() + "%</b>"
          + " of token <b class='notoAssetColor'>" + self.asset() + "</b>"
          + " for the price of <b class='notoQuantityColor'>" + self.totalXCPPay() + "</b> <b class='notoAssetColor'>XCP</b>. "
          + ACTION_PENDING_NOTICE);
      }
    );
  }
  
  self.show = function(address, asset, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.address(address);
    self.asset(asset);
    self.assetObj(WALLET.getAddressObj(address).getAssetObj(asset));
    var now = new Date(); 
    var nowUTC = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());

    //Check if the passed asset is callable
    assert(self.assetObj().isMine(), "Token is not yours!");
    assert(self.assetObj().CALLABLE, "Token is not callable!");

    var callDate = new Date(0);
    callDate.setUTCSeconds(self.assetObj().CALLDATE);
    if(callDate > nowUTC) {
      bootbox.alert("Token <b class='notoAssetColor'>" + self.asset()
      + "</b> cannot be called until " + self.assetObj().dispCallDate());
      return;
    }
    self.shown(true);
  }  

  self.hide = function() {
    self.shown(false);
  }  
}


var AssetHistoryItemModel = function(historyObj) {
  var self = this;
  self.HISTORYOBJ = historyObj;
  
  self.dispBlockTime = function() {
    return moment(self.HISTORYOBJ['at_block_time']).format("M/D/YY h:mm:ssa");
  }

  self.dispDescription = function() {
    var desc = '';
    if(self.HISTORYOBJ['type'] == 'created') {
      desc = "Token created with description '<b>" + self.HISTORYOBJ['description']
        + "</b>' and total issuance of <Am>" + numberWithCommas(self.HISTORYOBJ['total_issued_normalized']) + "</Am> units."
        + " Owned by address <Ad>" + getAddressLabel(self.HISTORYOBJ['owner']) + "</Ad>";
    } else if(self.HISTORYOBJ['type'] == 'issued_more') {
      desc = "An additional <Am>" + numberWithCommas(self.HISTORYOBJ['additional_normalized']) + "</Am> units issued."
        + " Total issuance increased to <Am>" + numberWithCommas(self.HISTORYOBJ['total_issued_normalized']) + "</Am> units";
    } else if(self.HISTORYOBJ['type'] == 'changed_description') {
      desc = "Description changed to '<b>" + self.HISTORYOBJ['new_description'] + "</b>'";
    } else if(self.HISTORYOBJ['type'] == 'locked') {
      desc = "Token locked";
    } else if(self.HISTORYOBJ['type'] == 'transferred') {
      desc = "Token transferred from address <Ad>" + getAddressLabel(self.HISTORYOBJ['prev_owner'])
        + "</Ad> to address <Ad>" + getAddressLabel(self.HISTORYOBJ['new_owner']) + "</Ad>";
    } else if(self.HISTORYOBJ['type'] == 'called_back') {
      desc = "<Am>" + self.HISTORYOBJ['percentage'] + "%</Am> of token called back";
    } else {
      desc = "UNKNOWN OP: <b>" + self.HISTORYOBJ['type'] + "</b>";
    }
    
    desc = desc.replace(/<Am>/g, '<b class="notoQuantityColor">').replace(/<\/Am>/g, '</b>');
    desc = desc.replace(/<Ad>/g, '<b class="notoAddrColor">').replace(/<\/Ad>/g, '</b>');
    return desc;
  }
};

function ShowAssetInfoModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(null);
  self.asset = ko.observable(null);
  self.owner = ko.observable(null);
  self.description = ko.observable(null);
  self.totalIssued = ko.observable(null);
  self.locked = ko.observable(null);
  self.divisible = ko.observable(null);
  self.callable = ko.observable(null);
  self.callDate = ko.observable(null);
  self.callPrice = ko.observable(null);
  self.history = ko.observableArray([]);
  
  self.extImageURL = ko.observable(null);
  self.extWebsite = ko.observable(null);
  self.extDescription = ko.observable(null);
  self.extPGPSigURL = ko.observable(null);
  
  self.dispTotalIssued = ko.computed(function() {
    return smartFormat(self.totalIssued()); 
  }, self); 

  self.showHistory = ko.computed(function() {
    return self.history().length ? true : false; 
  }, self); 

  self.show = function(assetObj) {
    self.address(assetObj.ADDRESS);
    self.asset(assetObj.ASSET);
    self.owner(assetObj.owner());
    self.description(assetObj.description());
    self.totalIssued(assetObj.normalizedTotalIssued());
    self.locked(assetObj.locked());
    self.divisible(assetObj.DIVISIBLE);
    self.callable(assetObj.CALLABLE);
    self.callDate(assetObj.dispCallDate());
    self.callPrice(assetObj.CALLPRICE);
    self.history([]); //clear until we have the data from the API call below...
    
    //Fetch the asset history and populate the table with it
    failoverAPI("get_asset_extended_info", {asset: assetObj.ASSET},
      function(ext_info, endpoint) {
        if(!ext_info)
          return; //asset has no extended info
        
        if(ext_info['image'])
          self.extImageURL((USE_TESTNET ? '/_t_asset_img/' : '/_asset_img/') + assetObj.ASSET + '.png');
        
        self.extWebsite(ext_info['website']);
        self.extDescription(ext_info['description']);
        self.extPGPSigURL(ext_info['pgpsig']);
      }
    );   
    
    failoverAPI("get_asset_history", {asset: assetObj.ASSET, reverse: true},
      function(history, endpoint) {
        for(var i=0; i < history.length; i++) {
          self.history.push(new AssetHistoryItemModel(history[i]));
        }
      }
    );   
    
    self.shown(true);
  }  

  self.hide = function() {
    self.shown(false);
  }  
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
