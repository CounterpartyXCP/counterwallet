function AssetViewModel(address, asset, isMine, initialBalance) {
  //An address has 2 or more assets (BTC, XCP, and any others)
  var self = this;
  self.ADDRESS = address; //will not change
  self.ASSET = asset; //assetID, will not change
  self.isMine = ko.observable(isMine); //null for BTC and XCP, true for self assets, false for others assets
  self.balance = ko.observable(initialBalance);
}


function CreateAssetModalViewModel() {
  var self = this;
  self.address = ko.observable('');
  self.name = ko.observable('');
  self.url = ko.observable('');
  self.divisible = ko.observable(true);
  self.quantity = ko.observable();

  self.windowTitle = ko.computed(function() {
    return "Issuing an asset from " + self.address();
  }, self);
  
  self.resetForm = function(address) {
    self.address(address);
    self.name('');
    self.url('');
    self.divisible(true);
    self.quantity();
  }
  
  self.createAsset = function() {
    //For now, use counterpartyd to compose the issuance. In the future, make it ourselves with a counterparty JS lib
    makeJSONAPICall("counterpartyd", "do_issuance",
      [self.address(), self.quantity(), self.name(), self.divisible(), null, true],
      function(unsigned_tx_hex) {
        //sign and broadcast the tx
        unsigned_tx_hex
      }
    );
    
    
  }  
  
}

var CREATE_ASSET_MODAL = new CreateAssetModalViewModel();

$(document).ready(function() {
  $.jqlog.enabled(true);
  ko.applyBindings(WALLET, document.getElementById("createAssetModal"));
});

