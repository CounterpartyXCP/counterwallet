ko.validation.rules['isValidBitcoinAddress'] = {
    validator: function (val, otherVal) {
        try {
          Bitcoin.Address(val);
          return true;
        } catch (err) {
          return false;
        }
    },
    message: 'This field must be a valid bitcoin address.'
};
ko.validation.rules['isNotSameBitcoinAddress'] = {
    validator: function (val, self) {
      return val != self.address();
    },
    message: 'Destination address cannot be equal to the sending address.'
};
ko.validation.rules['isValidSendAmountForDivisibility'] = {
    validator: function (val, self) {
      if(self.divisible() === false && numberHasDecimalPlace(val)) {
        return false;
      }
      return true;
    },
    message: 'The amount must be a whole number, since this is a non-divisible asset.'
};
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
  self.address = ko.observable();
  self.asset = ko.observable();
  self.balance = ko.observable();
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
    isValidSendAmountForDivisibility: self,
    isValidSendAmountForBalance: self
  });
  
  self.sendIntroSummary = ko.computed(function() {
    return "Fill out the form to send <b>" + self.asset() + "</b> from your address <b>" + self.address() + "</b> to the address you enter below.<br/><br/>"
     + "You have up to <b>" + (self.divisible() ? self.balance() / UNIT : self.balance()) + " " + self.asset() + "</b> available to send from this address.";
  }, self);
  
  self.sendRemainingSummary = ko.computed(function() {
    if(!isNumber(self.quantity())) return '';
    var balRemaining = (self.divisible() ? self.balance() / UNIT : self.balance()) - parseFloat(self.quantity());
    if(balRemaining < 0) return '';
    return "<b>After sending, you will have <span style='color:green'>" + balRemaining + "</span> " + self.asset() + " remaining at this address.</b>";
  }, self);
  
  
  self.validationModel = ko.validatedObservable({
      destAddress: self.destAddress,
      quantity: self.quantity
  });  

  self.resetForm = function(address) {
    self.destAddress('');
    self.quantity();
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

  self.sendFunds = function() {
    var quantity = parseFloat(self.quantity());
    var rawQuantity = self.divisible() ? Math.round(quantity * UNIT) : parseInt(quantity);

    //TODO: confirm that do_send works with BTC as well!    
    multiAPIConsensus("do_send",
      {source: self.address(), destination: self.destAddress(), quantity: rawQuantity, asset: self.asset(),
       unsigned: WALLET.getAddressObj(self.address()).PUBKEY},
      function(unsignedTXHex, numTotalEndpoints, numConsensusEndpoints) {
        console.log("GOT RAW HEX: " + unsignedTXHex);
        //WALLET.signAndBroadcastTx(self.address(), unsignedTXHex);
        
        bootbox.alert("Your send seemed to be success. It will take effect as soon as the network has processed it.");
      }
    );
    
    self.shown(false);
  }
  
  self.show = function(fromAddress, asset, balance, isDivisible, resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    
    self.address(fromAddress);
    self.asset(asset);
    self.balance(balance);
    self.divisible(isDivisible);
    
    if(resetForm) self.resetForm();
    self.shown(true);
  }  

  self.hide = function() {
    self.shown(false);
  }  
}

var SEND_MODAL = new SendModalViewModel();

$(document).ready(function() {
  $.jqlog.enabled(true);
  ko.applyBindingsWithValidation(SEND_MODAL, document.getElementById("sendModal"));
});
