
function SimpleBuyViewModel() {

  var self = this;
  
  self.machines = ko.observableArray([]);
  self.machineFilter = ko.observable('all');

  self.init = function() {
    failoverAPI('get_vennd_machine', [], self.prepareMachinesData);
  }

  self.prepareMachinesData = function(data) {

    self.machines([]);

    for (var m in data) {
      data[m]['finished'] = false;
      data[m]['pending'] = false;

      var now = Math.round((new Date()).getTime() / 1000);
      var attributes = {
        'buy': [],
        'sell': []
      };
      var sellAttributes = [];

      if (data[m]['type'] == 'gateway') {

        for (var t in {'buy':1, 'sell':1}) {

          if (data[m][t]) {

            var baseAsset = t == 'buy' ? data[m]['base-asset'] : data[m]['quote-asset'];
            var quoteAsset = t == 'sell' ? data[m]['base-asset'] : data[m]['quote-asset'];

            attributes[t].push({
              'label': 'Min. amount',
              'value': data[m][t]['min-amount'] + ' ' + quoteAsset,
              'attrclass': 'min-amount'
            });
            attributes[t].push({
              'label': 'Max. amount',
              'value': data[m][t]['max-amount'] + ' ' + quoteAsset,
              'attrclass': 'max-amount'
            });
            if (data[m][t]['reserve']) {
              attributes[t].push({
                'label': 'Reserve balance',
                'value': data[m][t]['reserve'] + ' ' + baseAsset,
                'attrclass': 'reserve'
              });
            }
            attributes[t].push({
              'label': 'Confirmations required',
              'value':  data[m][t]['confirmations-required'],
              'attrclass': 'confirmations-required'
            });
            attributes[t].push({
              'label': 'Current price',
              'value':  data[m][t]['price'] + ' ' + data[m]['quote-asset'],
              'attrclass': 'price'
            });
            attributes[t].push({
              'label': 'Fees',
              'value': (data[m][t]['fees'] * 100) + '%',
              'attrclass': 'fees'
            });
          }
        }

      } else if (data[m]['type'] == 'crowdsale') {

        if (now >= data[m]['end']) {
          data[m]['finished'] = true;
        }
        if (now < data[m]['start']) {
          data[m]['pending'] = true;
        }

        attributes['buy'].push({
          'label': 'Start',
          'value':  moment(data[m]['start'] * 1000).format("MMM Do YYYY, h:mm:ss a"),
          'attrclass': 'date'
        });
        attributes['buy'].push({
          'label': 'End',
          'value':  moment(data[m]['end'] * 1000).format("MMM Do YYYY, h:mm:ss a"),
          'attrclass': 'date'
        });
        attributes['buy'].push({
          'label': 'Confirmations required',
          'value':  data[m]['buy']['confirmations-required'],
          'attrclass': 'confirmations-required'
        });
        attributes['buy'].push({
          'label': 'Amount reached',
          'value':  data[m]['amount-reached'] + ' ' + data[m]['quote-asset'],
          'attrclass': 'amount-reached'
        });

      }
      

      data[m]['attributes'] = attributes;
      data[m]['machineclass'] = (data[m]['finished'] || data[m]['pending']) ? 'pendingMachine' : '';
      data[m]['baseasset'] = data[m]['base-asset'];
      data[m]['quoteasset'] = data[m]['quote-asset'];
      data[m]['doubleway'] = attributes['sell'].length > 0;
      data[m]['buytitle'] = data[m]['buy']['title'];
      data[m]['buydescription'] = data[m]['buy']['description'];
      if (data[m]['doubleway']) {
        data[m]['selltitle'] = data[m]['sell']['title'];
        data[m]['selldescription'] = data[m]['sell']['description'];
      }
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
      self.desinationAddress(machine['buy']['address']);
    } else {
      self.currency(machine['base-asset']);
      self.desinationAddress(machine['sell']['address']);
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
