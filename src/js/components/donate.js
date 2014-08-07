
function DonationViewModel() {

  var self = this;

  var quantityValidator = {
    required: true,
    isValidPositiveQuantity: self,
    validation: {
      validator: function (val, self) {
        var address = self.sourceAddress();
        var quantity = self.quantity();
        if (self.donationCurrency() == XCP) {
          return parseFloat(quantity) <= self.balancesXCP[address];
        } else {
          return parseFloat(quantity) <= self.balancesBTC[address];
        }
      },
      message: 'Quantity entered exceeds the address balance.',
      params: self
    }    
  }
  
  self.shown = ko.observable(false);
  self.availableAddresses = ko.observableArray([]);
  self.sourceAddress = ko.observable(null).extend(quantityValidator);
  self.balancesXCP = {};
  self.balancesBTC = {};
	self.quantity = ko.observable(null).extend(quantityValidator);
  self.donationCurrency = ko.observable(BTC);


  self.validationModel = ko.validatedObservable({
    quantity: self.quantity
  });

  self.show = function() {
    self.init();
    self.shown(true);
  }

  self.hide = function() {
    self.shown(false);
  }

  self.init = function() {

    // prepare source addresses
    self.availableAddresses([]);
    self.balancesXCP = {};
    var addresses = WALLET.getAddressesList(true);
    var options = []
    for(var i = 0; i < addresses.length; i++) {
      var btcBalance = WALLET.getBalance(addresses[i][0], BTC, true);
      options.push({
        address: addresses[i][0], 
        label: addresses[i][1] + ' (' + round(btcBalance, 2) + ' ' + BTC + ' / ' + round(addresses[i][2], 2) + ' ' + XCP + ')'
      });
      self.balancesBTC[addresses[i][0]] = btcBalance;
      self.balancesXCP[addresses[i][0]] = addresses[i][2];
    }
    self.availableAddresses(options);
  }

  self.submitDonation = function() {
    $.jqlog.debug('submitDonation');
  	if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    

    var params = {
      source: self.sourceAddress(),
      quantity:  denormalizeQuantity(self.quantity()),
      asset: self.donationCurrency(),
      destination: DONATION_ADDRESS,
      _divisible: true
    };
    $.jqlog.debug(params);
    var onSuccess = function(txHash, data, endpoint, addressType, armoryUTx) {
      var message = "<b>You " + (armoryUTx ? "are choosing to send" : "chose to send") + self.quantity()
        + " " + self.donationCurrency() + " to support development. Thank you!</b> ";
      WALLET.showTransactionCompleteDialog(message + ACTION_PENDING_NOTICE, message, armoryUTx);
    }
    WALLET.doTransaction(self.sourceAddress(), "create_send", params, onSuccess);
    self.hide();
  }

}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
