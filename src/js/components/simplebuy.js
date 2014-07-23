
function SimpleBuyViewModel() {

  var self = this;
  
  self.machines = ko.observableArray([]);

  self.init = function() {
    failoverAPI('get_vennd_machine', [], self.prepareMachinesData);
  }

  self.prepareMachinesData = function(data) {

    self.machines([]);

    for (var m in data) {
      data[m]['finished'] = false;
      data[m]['pending'] = false;

      var now = Math.round((new Date()).getTime() / 1000);
      var attributes = []
      if (data[m]['type'] == 'vending machine') {

        attributes.push({
          'label': 'Min. amount',
          'value': data[m]['min-amount'] + ' ' + data[m]['quote-asset']
        });
        attributes.push({
          'label': 'Max. amount',
          'value': data[m]['max-amount'] + ' ' + data[m]['quote-asset']
        });
        attributes.push({
          'label': 'Reserve balance',
          'value': data[m]['base-reserve'] + ' ' + data[m]['base-asset']
        });
        attributes.push({
          'label': 'Current price',
          'value': data[m]['price'] + ' ' + data[m]['quote-asset']
        });
        attributes.push({
          'label': 'Fees',
          'value': (data[m]['fees']*100) + '%'
        })

      } else if (data[m]['type'] == 'gateway') {

        attributes.push({
          'label': 'Min. amount',
          'value': data[m]['min-amount'] + ' ' + data[m]['quote-asset'] + ' or ' + data[m]['min-amount'] + ' ' + data[m]['base-asset']
        });
        attributes.push({
          'label': 'Max. amount',
          'value': data[m]['max-amount'] + ' ' + data[m]['quote-asset'] + ' or ' + data[m]['max-amount'] + ' ' + data[m]['base-asset']
        });
        attributes.push({
          'label': 'Reserve balance',
          'value': data[m]['base-reserve'] + ' ' + data[m]['base-asset'] + ' and ' + data[m]['quote-reserve'] + ' ' + data[m]['quote-asset']
        });
        attributes.push({
          'label': 'Current price',
          'value':  ' 1 ' + data[m]['quote-asset'] + ' <-> 1 ' + data[m]['base-asset']
        });
        attributes.push({
          'label': 'Fees',
          'value': (data[m]['fees'] * 100) + '%'
        })

      } else if (data[m]['type'] == 'crowdsale') {

        if (now >= data[m]['end']) {
          data[m]['finished'] = true;
        }
        if (now < data[m]['start']) {
          data[m]['pending'] = true;
        }

        attributes.push({
          'label': 'Start',
          'value':  moment(data[m]['start'] * 1000).format("MMM Do YYYY, h:mm:ss a")
        });
        attributes.push({
          'label': 'End',
          'value':  moment(data[m]['end'] * 1000).format("MMM Do YYYY, h:mm:ss a")
        });
        attributes.push({
          'label': 'Amount reached',
          'value':  data[m]['amount-reached'] + ' ' + data[m]['quote-asset']
        });
      }

      data[m]['attributes'] = attributes;
    }
    $.jqlog.debug(data);
    self.machines(data);
  }
  
  self.buy = function(machine) {
    $.jqlog.debug(machine);
    VEND_MODAL.show(machine, 'buy');
  }

  self.sell = function(machine) {
    $.jqlog.debug(machine);
    VEND_MODAL.show(machine, 'sell');
  }
}


function VendingMachineViewModel() {

  var self = this;

  var quantityValidator = {
    required: true,
    isValidPositiveQuantity: self,
    validation: {
      validator: function (val, self) {
        var address = self.sourceAddress();
        var quantity = self.quantity();
        return parseFloat(quantity) <= self.balances[address];
      },
      message: 'Quantity entered exceeds the address balance.',
      params: self
    }    
  }
  
  self.shown = ko.observable(false);
  self.availableAddresses = ko.observableArray([]);
  self.sourceAddress = ko.observable(null).extend(quantityValidator);
  self.balances = {};
  self.quantity = ko.observable(null).extend(quantityValidator);
  self.currency = ko.observable();
  self.desinationAddress = ko.observable();
  self.name = ko.observable();
  self.type = ko.observable();
  self.description = ko.observable();
  self.noBalance = ko.observable();

  self.validationModel = ko.validatedObservable({
    quantity: self.quantity
  });

  self.show = function(machine, action) {
    self.init(machine, action);
    self.shown(true);
  }

  self.hide = function() {
    self.shown(false);
  }

  self.init = function(machine, action) {

    self.name(machine['name']);
    self.type(machine['type']);
    self.description(machine['description']);
    // prepare source addresses
    self.availableAddresses([]);
    self.balances = {};
    if (action == 'buy') {
      self.currency(machine['quote-asset']);
      self.desinationAddress(machine['buy-address']);
    } else {
      self.currency(machine['base-asset']);
      self.desinationAddress(machine['sell-address']);
    }
    var addresses = WALLET.getAddressesList(true);
    var options = []
    self.noBalance(true);
    for(var i = 0; i < addresses.length; i++) {
      var balance = WALLET.getBalance(addresses[i][0], self.currency(), true);
      if (balance>0) {
          options.push({
          address: addresses[i][0], 
          label: addresses[i][1] + ' (' + round(balance, 2) + ' ' + self.currency() + ')'
        });
        self.balances[addresses[i][0]] = balance;
        self.noBalance(false);
      }
      
    }
    self.availableAddresses(options);
  }

  self.send = function() {
   
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    

    var params = {
      source: self.sourceAddress(),
      quantity:  denormalizeQuantity(self.quantity()),
      asset: self.currency(),
      destination: self.desinationAddress(),
      _divisible: true
    };
    $.jqlog.debug(params);
    var onSuccess = function(txHash, data, endpoint, addressType, armoryUTx) {
      var message = "<b>You " + (armoryUTx ? "are choosing to send" : "chose to send") + self.quantity()
        + " " + self.currency() + " to " + self.desinationAddress() + "</b> ";
      WALLET.showTransactionCompleteDialog(message + ACTION_PENDING_NOTICE, message, armoryUTx);
    }
    WALLET.doTransaction(self.sourceAddress(), "create_send", params, onSuccess);
    self.hide();
  }

}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
