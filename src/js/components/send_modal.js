ko.validation.rules['isValidSendAmountForBalance'] = {
    validator: function (val, self) {
      if((self.divisible() ? self.balance() / UNIT : self.balance()) - parseFloat(val) < 0) {
        return false;
      }
      return true;
    },
    message: 'Entered amount exceeds your current balance.'
};
ko.validation.registerExtenders();

function SendModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.address = ko.observable(null);
  self.asset = ko.observable();
  self.balance = ko.observable(null);
  self.divisible = ko.observable();
  
  self.destAddress = ko.observable().extend({
    required: true,
    isValidBitcoinAddress: self,
    isNotSameBitcoinAddress: self
  });
  self.quantity = ko.observable().extend({
    required: true,
    pattern: {
      message: 'Must be a valid number',
      params: '^[0-9]*\.?[0-9]{0,8}$' //not perfect ... additional checking required
    },
    isValidQtyForDivisibility: self,
    isValidSendAmountForBalance: self
  });
  
  self.normalizedBalance = ko.computed(function() {
    if(self.address() === null || self.balance() === null) return null;
    return self.divisible() ? Decimal.round(new Decimal(self.balance()).div(UNIT), 8).toFloat() : self.balance();
  }, self);
  
  self.normalizedBalRemaining = ko.computed(function() {
    if(!isNumber(self.quantity())) return null;
    var curBalance = self.divisible() ? Decimal.round(new Decimal(self.balance()).div(UNIT), 8).toFloat() : self.balance();
    var balRemaining = Decimal.round(new Decimal(curBalance).sub(parseFloat(self.quantity()))).toFloat();
    if(balRemaining < 0) return null;
    return balRemaining;
  }, self);
  
  self.validationModel = ko.validatedObservable({
    destAddress: self.destAddress,
    quantity: self.quantity
  });  
  
  self.resetForm = function() {
    self.destAddress('');
    self.quantity(null);
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    //data entry is valid...submit to the server
    $('#sendModal form').submit();
  }

  self.doAction = function() {
    var quantity = parseFloat(self.quantity());
    var rawQuantity = self.divisible() ? Math.round(quantity * UNIT) : parseInt(quantity);

    //TODO: confirm that do_send works with BTC as well!    
    multiAPIConsensus("do_send",
      {source: self.address(), destination: self.destAddress(), quantity: rawQuantity, asset: self.asset(),
       unsigned: WALLET.getAddressObj(self.address()).PUBKEY},
      function(unsignedTXHex, numTotalEndpoints, numConsensusEndpoints) {
        console.log("GOT RAW HEX: " + unsignedTXHex);
        WALLET.signAndBroadcastTx(self.address(), unsignedTXHex);
        bootbox.alert("Your send seemed to be success. It will take effect as soon as the network has processed it.");
      }
    );
    
    self.shown(false);
  }
  
  self.show = function(fromAddress, asset, balance, isDivisible, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.address(fromAddress);
    self.asset(asset);
    self.balance(balance);
    self.divisible(isDivisible);
    self.shown(true);
  }  

  self.hide = function() {
    self.shown(false);
  }  
}

var SEND_MODAL = new SendModalViewModel();

$(document).ready(function() {
  ko.applyBindingsWithValidation(SEND_MODAL, document.getElementById("sendModal"));
});
