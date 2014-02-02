function CreateAssetModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable('');
  self.name = ko.observable('');
  self.url = ko.observable('');
  self.divisible = ko.observable(true);
  self.quantity = ko.observable();

  self.resetForm = function(address) {
    self.address(address);
    self.name('');
    self.url('');
    self.divisible(true);
    self.quantity();
  }
  
  self.submitForm = function() {
    $('#createAssetModal form').submit();
  }

  self.createAsset = function() {
    //For now, use counterpartyd to compose the issuance. In the future, make it ourselves with a counterparty JS lib
    makeJSONAPICall("counterpartyd", "do_issuance",
      [self.address(), self.quantity(), self.name(), self.divisible(),
       null, WALLET.getAddressObj(self.address()).PUBKEY],
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

var CREATE_ASSET_MODAL = new CreateAssetModalViewModel();

$(document).ready(function() {
  $.jqlog.enabled(true);
  ko.applyBindings(CREATE_ASSET_MODAL, document.getElementById("createAssetModal"));
});

