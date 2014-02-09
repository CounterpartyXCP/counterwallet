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
    
    if(   (self.divisible() && self.quantity() * UNIT > MAX_INT)
       || (!self.divisible() && self.quantity() > MAX_INT)) {
      bootbox.alert("The quantity desired to be issued for this asset is too high.");
      return false;
    }
    
    if(self.callable() && self.callDate() <= new Date()) {
      bootbox.alert("Call date cannot be in the past.");
      return false;
    }

    if(  self.callable()
      && (   (self.divisible() && self.quantity() * UNIT > MAX_INT)
          || (!self.divisible() && self.quantity() > MAX_INT))
      ) {
      bootbox.alert("The call price for this asset is too high.");
      return false;
    }
    
    multiAPIConsensus("do_issuance",
      [self.address(), self.divisible() ? self.quantity() * UNIT : self.quantity(), self.name(), self.divisible(),
       self.description(), self.callable(), self.callDate(), self.callPrice(), null, WALLET.getAddressObj(self.address()).PUBKEY],
      function(unsigned_tx_hex) {
        WALLET.signAndBroadcastTx(self.address(), unsigned_tx_hex);
        
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

/*function CreateAssetModalViewModel() {
  var self = this;
  self.dialog = ko.validatedObservable(new CreateAssetDialogViewModel(this));
  
  self.show = function(address, resetForm) {
    return self.dialog().show(address, resetForm);
  }

  self.hide = function() {
    return self.dialog().hide();
  }
}*/

var CREATE_ASSET_MODAL = new CreateAssetModalViewModel();

$(document).ready(function() {
  $.jqlog.enabled(true);
  ko.applyBindingsWithValidation(CREATE_ASSET_MODAL, document.getElementById("createAssetModal"));
});
