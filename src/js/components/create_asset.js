ko.validation.rules['assetNameIsTaken'] = {
  async: true,
  message: 'Asset name is already taken',
  validator: function (val, otherVal, callback) {
    console.log("Assetname is taken: " + val);
    failoverAPI("get_issuances",
      {'filters': {'field': 'asset', 'op': '==', 'value': val}},
      function(endpoint, data) { return data ? callback(false) : callback(true) }); //empty list -> true (valid = true)  
  }
};
ko.validation.registerExtenders();

function CreateAssetModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable('');
  self.name = ko.observable('').extend({
    required: true,
    pattern: {
      message: 'Must be between 4-24 uppercase letters only (A-Z)',
      params: '^[A-Z]{4,24}$'
    },
    assetNameIsTaken: self
  });
  self.description = ko.observable('').extend({
    required: false,
    maxLength: 52 //the real test is 52 BYTES long, not characters long...we do this prelim check for user friendlyness in the form
  });
  self.divisible = ko.observable(true);
  self.quantity = ko.observable().extend({
    required: true,
    pattern: {
      message: 'Must be a valid number',
      params: '^[0-9]*\.?[0-9]{0,8}$' //not perfect ... will convert divisible assets to satoshi before sending to API
    }
  });
  self.callable = ko.observable(false);
  self.callDate = ko.observable().extend({
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
    }
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
    if(self.name.isValidating()) {
      setTimeout(function() { //wait a bit and call again
        self.submitForm();
      }, 50);
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
    //For now, use counterpartyd to compose the issuance. In the future, make it ourselves with a counterparty JS lib
    if(byteCount(newDescription) > 52) {
      bootbox.alert("Entered description is more than 52 bytes long. Please try again.");
      return false;
    }
    
    if(!self.divisible() && numberHasDecimalPlace(self.quantity())) {
      bootbox.alert("Non-divisible assets may not have a quantity with a decimal place.");
      return false;
    }
    
    var rawQuantity = self.divisible() ? Math.round(self.quantity().parseFloat() * UNIT) : self.quantity().parseInt();
    
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
    var rawCallPrice = self.divisible() ? Math.round(self.callPrice().parseFloat() * UNIT) : self.callPrice().parseInt();

    if(  self.callable()
      && (   (self.divisible() && self.quantity() * UNIT > MAX_INT)
          || (!self.divisible() && self.quantity() > MAX_INT))
      ) {
      bootbox.alert("The call price for this asset is too high.");
      return false;
    }
    
    multiAPIConsensus("do_issuance",
      [self.address(), rawQuantity, self.name(), self.divisible(),
       self.description(), self.callable(), rawCallDate, rawCallPrice, null, WALLET.getAddressObj(self.address()).PUBKEY],
      function(unsignedTXHex, numTotalEndpoints, numConsensusEndpoints) {
        WALLET.signAndBroadcastTx(self.address(), unsignedTXHex);
        
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
