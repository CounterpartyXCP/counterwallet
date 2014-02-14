ko.validation.rules['assetNameIsTaken'] = {
  async: true,
  message: 'Asset name is already taken',
  validator: function (val, otherVal, callback) {
    failoverAPI("get_issuances",
      {'filters': {'field': 'asset', 'op': '==', 'value': val}},
      function(endpoint, data) {
        return data.length ? callback(false) : callback(true) //empty list -> true (valid = true)
      }
    );   
  }
};
ko.validation.rules['isValidAssetDescription'] = {
    validator: function (val, self) {
      return byteCount(val) <= 52;
    },
    message: 'Asset description is more than 52 bytes long.'
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
    console.log("Submitting form...");
    $('#createAssetModal form').submit();
  }

  self.doAction = function() {
    var quantity = parseFloat(self.quantity());
    var rawQuantity = self.divisible() ? Math.round(quantity * UNIT) : parseInt(quantity);
    
    if(rawQuantity > MAX_INT) {
      bootbox.alert("The quantity desired to be issued for this asset is too high.");
      return false;
    }
    
    if(self.callable() && self.callDate() <= new Date()) {
      bootbox.alert("Call date cannot be in the past.");
      return false;
    }
    
    //convert callDate + callPrice
    var rawCallDate = self.callDate() ? self.callDate().getTime() / 1000 : null; //epoch time
    var rawCallPrice = self.divisible() ? Math.round(parseFloat(self.callPrice()) * UNIT) : parseInt(self.callPrice());

    if(self.callable() && rawQuantity + rawCallPrice > MAX_INT) {
      bootbox.alert("The call price for this asset is too high.");
      return false;
    }
    
    multiAPIConsensus("do_issuance",
      {source: self.address(), quantity: rawQuantity, asset: self.name(), divisible: self.divisible(),
       description: self.description(), callable: self.callable, call_date: rawCallDate,
       call_price: rawCallPrice, transfer_destination: null,
       unsigned: WALLET.getAddressObj(self.address()).PUBKEY},
      function(unsignedTXHex, numTotalEndpoints, numConsensusEndpoints) {
        console.log("GOT RAW HEX: " + unsignedTXHex);
        WALLET.signAndBroadcastTx(self.address(), unsignedTXHex);
        bootbox.alert("Your asset seemed to be created successfully. It will automatically appear under the \
        appropriate address once the network has confirmed it, and your account will be deducted by 5 XCP.");
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
    message: 'This issuance would exceed the hard limit for maximum quantity.'
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
      message: 'Must be a valid number',
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
    return (self.asset().DIVISIBLE ? parseFloat(self.additionalIssue()) * UNIT : parseInt(self.additionalIssue()))
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
    //do the additional issuance (specify non-zero quantity, no transfer destination)
    multiAPIConsensus("do_issuance",
      {source: self.address(), quantity: self.rawAdditionalIssue(), asset: self.asset().ASSET, divisible: self.asset().DIVISIBLE,
       description: self.asset().description(), callable: self.asset().CALLABLE, call_date: self.asset().CALLDATE,
       call_price: self.asset().CALLPRICE, transfer_destination: null,
       unsigned: WALLET.getAddressObj(self.address()).PUBKEY},
      function(unsignedTXHex, numTotalEndpoints, numConsensusEndpoints) {
        WALLET.signAndBroadcastTx(self.address(), unsignedTXHex);
        self.shown(false);
        bootbox.alert("You have issued <b>" + self.additionalIssue().toString() + "</b> additional quantity on your asset <b>"
          + self.asset().ASSET + "</b>. It may take a bit for this to reflect.");
    });
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
  
  self.destAddress = ko.observable('').extend({
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
    //do the transfer (zero quantity issuance to the specified address)
    multiAPIConsensus("do_issuance",
      {source: self.address(), quantity: 0, asset: self.asset().ASSET, divisible: self.asset().DIVISIBLE,
       description: self.asset().description(), callable: self.asset().CALLABLE, call_date: self.asset().CALLDATE,
       call_price: self.asset().CALLPRICE, transfer_destination: self.destAddress(),
       unsigned: WALLET.getAddressObj(self.address()).PUBKEY},
      function(unsignedTXHex, numTotalEndpoints, numConsensusEndpoints) {
        WALLET.signAndBroadcastTx(self.address(), unsignedTXHex);
        self.shown(false);
        bootbox.alert("<b>" + self.asset().ASSET + "</b> has been transferred to <b>" + self.destAddress() + "</b>. It may take a bit for this to reflect.");
    });
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
    bootbox.alert("IMPLEMENTATION NOT FINISHED");
    //TODO: THIS IS INCOMPLETE ... we need semantics figured out for how to just change asset desc
    multiAPIConsensus("do_issuance",
      {source: self.address(), quantity: null, asset: self.asset().ASSET, divisible: self.asset().DIVISIBLE,
       description: self.newDescription(), callable: self.asset().CALLABLE, call_date: self.asset().CALLDATE,
       call_price: self.asset().CALLPRICE, transfer_destination: null,
       unsigned: WALLET.getAddressObj(self.address()).PUBKEY},
      function(unsignedTXHex, numTotalEndpoints, numConsensusEndpoints) {
        WALLET.signAndBroadcastTx(self.address(), unsignedTXHex);
        self.shown(false);
        bootbox.alert("Your asset's description has been changed. It may take a bit for this to reflect.");
    });
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


ko.validation.rules['dividendDoesNotExceedXCPBalance'] = {
    validator: function (val, self) {
      if(!isNumber(val)) return null;
      return val * self.asset().normalizedTotalIssued() <= WALLET.getBalance(self.address(), "XCP");
    },
    message: 'The total dividend would exceed this address\' XCP balance.'
};
ko.validation.registerExtenders();

function PayDividendModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(''); // SOURCE address (supplied)
  self.asset = ko.observable();
  
  self.qtyPerUnit = ko.observable('').extend({
    required: true,
    pattern: {
      message: 'Must be a valid number',
      params: '^[0-9]*\.?[0-9]{0,8}$' //not perfect ... will convert divisible assets to satoshi before sending to API
    },
    dividendDoesNotExceedXCPBalance: self
  });
  
  self.assetName = ko.computed(function() {
    if(!self.asset()) return null;
    return self.asset().ASSET;
  }, self);
  
  self.displayedAddressXCPBalance = ko.computed(function() {
    return WALLET.getBalance(self.address(), "XCP"); //normalized
  }, self);

  self.displayedTotalPay = ko.computed(function() {
    if(!self.asset()) return null;
    return self.qtyPerUnit() * self.asset().normalizedTotalIssued();
  }, self);

  self.displayedXCPBalRemainingPostPay = ko.computed(function() {
    if(!self.asset()) return null;
    return toFixed(self.displayedAddressXCPBalance() - self.displayedTotalPay(), 8);
  }, self);
  
  self.validationModel = ko.validatedObservable({
    qtyPerUnit: self.qtyPerUnit
  });

  self.resetForm = function() {
    self.qtyPerUnit(null);
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
    //do the additional issuance (specify non-zero quantity, no transfer destination)
    multiAPIConsensus("do_dividend",
      {source: self.address(), quantity_per_unit: self.qtyPerUnit() * UNIT,
       share_asset: self.asset().ASSET, 
       unsigned: WALLET.getAddressObj(self.address()).PUBKEY},
      function(unsignedTXHex, numTotalEndpoints, numConsensusEndpoints) {
        WALLET.signAndBroadcastTx(self.address(), unsignedTXHex);
        self.shown(false);
        bootbox.alert("You have paid a dividend of <b>" + self.qtyPerUnit().toString()
          + " XCP</b> per outstanding unit to holders of asset <b>" + self.asset().ASSET
          + "</b>. It may take a bit for this to reflect.");
    });
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


var CREATE_ASSET_MODAL = new CreateAssetModalViewModel();
var ISSUE_ADDITIONAL_ASSET_MODAL = new IssueAdditionalAssetModalViewModel();
var TRANSFER_ASSET_MODAL = new TransferAssetModalViewModel();
var CHANGE_ASSET_DESCRIPTION_MODAL = new ChangeAssetDescriptionModalViewModel();
var PAY_DIVIDEND_MODAL = new PayDividendModalViewModel();

$(document).ready(function() {
  ko.applyBindingsWithValidation(CREATE_ASSET_MODAL, document.getElementById("createAssetModal"));
  ko.applyBindingsWithValidation(ISSUE_ADDITIONAL_ASSET_MODAL, document.getElementById("issueAdditionalAssetModal"));
  ko.applyBindingsWithValidation(TRANSFER_ASSET_MODAL, document.getElementById("transferAssetModal"));
  ko.applyBindingsWithValidation(CHANGE_ASSET_DESCRIPTION_MODAL, document.getElementById("changeAssetDescriptionModal"));
  ko.applyBindingsWithValidation(PAY_DIVIDEND_MODAL, document.getElementById("payDividendModal"));
});
