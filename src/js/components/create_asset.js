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
ko.validation.rules['isValidQtyForDivisibility'] = {
    validator: function (val, self) {
      if(self.divisible() === false && numberHasDecimalPlace(parseFloat(val))) {
        return false;
      }
      return true;
    },
    message: 'The amount must be a whole number, since this is a non-divisible asset.'
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

  self.resetForm = function(address) {
    self.address(address);
    self.name('');
    self.description('');
    self.divisible(true);
    self.quantity();
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    console.log("Submitform called");
    console.log(self.callDate());
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

  self.createAsset = function() {
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
        //WALLET.signAndBroadcastTx(self.address(), unsignedTXHex);
        
        //tell the user about the result
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

var CREATE_ASSET_MODAL = new CreateAssetModalViewModel();

$(document).ready(function() {
  $.jqlog.enabled(true);
  ko.applyBindingsWithValidation(CREATE_ASSET_MODAL, document.getElementById("createAssetModal"));
});
