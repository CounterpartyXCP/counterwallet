ko.validation.rules['isValidAddressDescription'] = {
    validator: function (val, self) {
      return val.length <= 70; //arbitrary
    },
    message: 'Address description is more than 70 characters long.'
};
ko.validation.registerExtenders();

function CreateNewAddressModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.description = ko.observable('').extend({
    required: true,
    isValidAddressDescription: self,
  });
  
  self.validationModel = ko.validatedObservable({
    description: self.description
  });

  self.resetForm = function() {
    self.description('');
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    console.log("Submitting form...");
    $('#createNewAddressModal form').submit();
  }

  self.doAction = function() {
    //generate new priv key and address via electrum
    var r = electrum_extend_chain(electrum_get_pubkey(WALLET.ELECTRUM_PRIV_KEY),
      WALLET.ELECTRUM_PRIV_KEY, WALLET.addresses().length /*-1 +1 = 0*/, false, true);
    //r = [addr.toString(), sec.toString(), newPub, newPriv]
    
    //set the description of this address
    $.jqlog.log("NEW address created: " + r[0]);
    WALLET.addKey(new Bitcoin.ECKey(r[1]), self.description());
    
    //update PREFS and push
    PREFERENCES['num_addresses_used'] += 1;
    PREFERENCES['address_aliases'][r[0]] = self.description();
    multiAPI("store_preferences", [WALLET.identifier(), PREFERENCES], function(data, endpoint) {
      self.shown(false);
      //reload page to reflect the addition
      $('#content').load("xcp/pages/balances.html");
      //^ don't use loadURL here as it won't do a full reload and re-render the new widget
    });
  }
  
  self.show = function(resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.shown(true);
  }  

  self.hide = function() {
    self.shown(false);
  }  
}


var CREATE_NEW_ADDRESS_MODAL = new CreateNewAddressModalViewModel();

$(document).ready(function() {
  ko.applyBindingsWithValidation(CREATE_NEW_ADDRESS_MODAL, document.getElementById("createNewAddressModal"));
});


$('#createNewAddress').click(function() {
  if(WALLET.addresses.length >= MAX_ADDRESSES) { bootbox.alert("You already have the max number of addresses for a single wallet ("
    + MAX_ADDRESSES + "). Please create a new wallet for more."); return; }
  CREATE_NEW_ADDRESS_MODAL.show();
});
