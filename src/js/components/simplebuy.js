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

      var types = data[m]['type'] == 'gateway' ? {'buy': 1, 'sell': 1} : {'buy': 1}

      for (var t in types) {

        if (data[m][t]) {

          var baseAsset = t == 'buy' ? data[m]['base-asset'] : data[m]['quote-asset'];
          var quoteAsset = t == 'sell' ? data[m]['base-asset'] : data[m]['quote-asset'];

          if (data[m]['type'] == 'crowdsale') {

            if (now >= data[m]['end']) {
              data[m]['finished'] = true;
            }
            if (now < data[m]['start']) {
              data[m]['pending'] = true;
            }

            attributes['buy'].push({
              'label': i18n.t('start'),
              'value': moment(data[m]['start'] * 1000).format("MMM Do YYYY, h:mm:ss a"),
              'attrclass': 'date'
            });
            attributes['buy'].push({
              'label': i18n.t('end'),
              'value': moment(data[m]['end'] * 1000).format("MMM Do YYYY, h:mm:ss a"),
              'attrclass': 'date'
            });

          }

          if ('min-amount' in data[m][t]) {
            attributes[t].push({
              'label': i18n.t('min_amount'),
              'value': data[m][t]['min-amount'] + ' ' + quoteAsset,
              'attrclass': 'min-amount'
            });
          }
          if ('max-amount' in data[m][t]) {
            attributes[t].push({
              'label': i18n.t('max_amount'),
              'value': data[m][t]['max-amount'] + ' ' + quoteAsset,
              'attrclass': 'max-amount'
            });
          }
          if ('reserve' in data[m][t]) {
            attributes[t].push({
              'label': i18n.t('reserve_balance'),
              'value': data[m][t]['reserve'] + ' ' + baseAsset,
              'attrclass': 'reserve'
            });
          }
          attributes[t].push({
            'label': i18n.t('confirmations_required'),
            'value': data[m][t]['confirmations-required'],
            'attrclass': 'confirmations-required'
          });
          if (data[m][t]['price']) {
            attributes[t].push({
              'label': i18n.t('current_price'),
              'value': data[m][t]['price'] + ' ' + data[m]['quote-asset'],
              'attrclass': 'price'
            });
          }
          if ('fees' in data[m][t]) {
            attributes[t].push({
              'label': i18n.t('fees'),
              'value': (data[m][t]['fees'] * 100) + '%',
              'attrclass': 'fees'
            });
          }

          if (data[m]['type'] == 'crowdsale') {
            attributes['buy'].push({
              'label': i18n.t('amount_reached'),
              'value': data[m]['amount-reached'] + ' ' + data[m]['quote-asset'],
              'attrclass': 'amount-reached'
            });
          }
        }
      }

      data[m]['attributes'] = attributes;
      data[m]['machineclass'] = (data[m]['finished'] || data[m]['pending']) ? 'pendingMachine' : '';
      data[m]['baseasset'] = data[m]['base-asset'];
      data[m]['quoteasset'] = data[m]['quote-asset'];
      if (data[m]['buy']) {
        data[m]['buytitle'] = data[m]['buy']['title'];
        data[m]['buydescription'] = data[m]['buy']['description'];
      }
      if (data[m]['sell']) {
        data[m]['selltitle'] = data[m]['sell']['title'];
        data[m]['selldescription'] = data[m]['sell']['description'];
      }
      data[m]['supportlink'] = data[m]['support-link'];
    }
    self.machines(data);

    $('div.vennd-machine').each(function() {
      var maxHeight = 0;
      $(this).find('p.description').each(function() {
        if ($(this).height() > maxHeight) {
          maxHeight = $(this).height();
        }
      });
      $(this).find('p.description').css('height', maxHeight + 'px');
    })
  }

  self.buy = function(machine) {
    VEND_MODAL.show(machine, 'buy');
  }

  self.sell = function(machine) {
    VEND_MODAL.show(machine, 'sell');
  }
}


function VendingMachineViewModel() {

  var self = this;

  var quantityValidator = {
    required: true,
    isValidPositiveQuantity: self,
    validation: {
      validator: function(val, self) {
        var address = self.sourceAddress();
        var quantity = self.quantity();
        return parseFloat(quantity) <= self.balances[address];
      },
      message: i18n.t('quantity_exceeds_balance'),
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
  self.noReserve = ko.observable();
  self.price = ko.observable();
  self.getCurrency = ko.observable();
  self.fees = ko.observable();

  self.confirmationPhrase = ko.computed(function() {
    if (!self.quantity()) return null;
    var getQuantity = divFloat(self.quantity(), self.price());
    getQuantity = mulFloat(getQuantity, 1 - self.fees());
    return i18n.t("quick_by_confirm_message", self.quantity(), self.currency(), self.name(), getQuantity, self.getCurrency());

  });

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
    $.jqlog.debug(machine);

    self.name(machine['name']);
    self.type(machine['type']);
    self.description(machine['description']);
    // prepare source addresses
    self.availableAddresses([]);
    self.balances = {};
    if (action == 'buy') {
      self.currency(machine['quote-asset']);
      self.getCurrency(machine['base-asset']);
    } else {
      self.currency(machine['base-asset']);
      self.getCurrency(machine['quote-asset']);
    }
    self.desinationAddress(machine[action]['address']);
    self.price(machine[action]['price']);
    self.fees(machine[action]['fees']);

    var addresses = WALLET.getAddressesList(true);
    var options = []
    self.noBalance(true);
    for (var i = 0; i < addresses.length; i++) {
      var balance = WALLET.getBalance(addresses[i][0], self.currency(), true);
      if (balance > 0) {
        options.push({
          address: addresses[i][0],
          label: addresses[i][1] + ' (' + round(balance, 2) + ' ' + self.currency() + ')'
        });
        self.balances[addresses[i][0]] = balance;
        self.noBalance(false);
      }

    }
    if (self.noBalance() == false) {
      self.noReserve(false);
      if ('reserve' in machine[action] && machine[action]['reserve'] <= 0) {
        self.noReserve(true);
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
      quantity: denormalizeQuantity(self.quantity()),
      asset: self.currency(),
      destination: self.desinationAddress(),
      _asset_divisible: true
    };

    var onSuccess = function(txHash, data, endpoint, addressType, armoryUTx) {
      var message = "<b>";
      if (armoryUTx) {
        message += i18n.t("you_are_choosing_to_send_from_to", self.quantity(), self.currency(), self.desinationAddress());
      } else {
        message += i18n.t("you_are_chose_to_send_from_to", self.quantity(), self.currency(), self.desinationAddress());
      }
      message += "</b> ";

      WALLET.showTransactionCompleteDialog(message + " " + i18n.t(ACTION_PENDING_NOTICE), message, armoryUTx);
    }

    WALLET.doTransaction(self.sourceAddress(), "create_send", params, onSuccess);
    self.hide();
  }

}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
