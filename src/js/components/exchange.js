function OpenOrdersViewModel() {
  self = this;

  self.openOrders = ko.observableArray([]);
  self.addressesLabels = {};

  self.init = function() {
    self.addressesLabels = {};
    var wallet_adressess = WALLET.getAddressesList(true);
    var addresses = [];
    for(var i = 0; i < wallet_adressess.length; i++) {
      addresses.push(wallet_adressess[i][0]);
      self.addressesLabels[wallet_adressess[i][0]] = wallet_adressess[i][1];
    }

    var params = {
      filters: [
        {'field':'source', 'op':'IN', 'value':addresses},
        {'field':'give_remaining', 'op':'>', 'value':0}
      ],
      status: 'open'
    };
    failoverAPI("get_orders", params, self.displayOpenOrders);
  }

  self.displayOpenOrders = function(data) {
    $.jqlog.debug(data);
    self.openOrders([]);
    var orders = [];
    for (var i=0; i<data.length; i++) {
      var order = {};
      order.tx_index = data[i].tx_index;
      order.tx_hash = data[i].tx_hash;
      order.source = data[i].source;
      order.address_label = self.addressesLabels[order.source];
      order.give_quantity_str = normalizeQuantity(data[i].give_quantity) + ' ' + data[i].give_asset;
      order.get_quantity_str = normalizeQuantity(data[i].get_quantity) + ' ' + data[i].get_asset;
      order.give_remaining_str = normalizeQuantity(data[i].give_remaining) + ' ' + data[i].give_asset;
      order.get_remaining_str = normalizeQuantity(data[i].get_remaining) + ' ' + data[i].get_asset;
      order.expire_index = data[i].expire_index;
      order.expire_date = expireDate(data[i].expire_index);
      orders.push(order);
    }
    self.openOrders(orders);
    var openOrdersTable = $('#openOrdersTable').dataTable();
  }

  self.cancelOpenOrder = function(order) {
    var params = {
      offer_hash: order.tx_hash,
      source: order.source,
      _type: 'order',
      _tx_index: order.tx_index
    }

    var onSuccess = function(txHash, data, endpoint) {
      bootbox.alert("<b>Your order was canceled successfully.</b> " + ACTION_PENDING_NOTICE);
    }

    WALLET.doTransaction(order.source, "create_cancel", params, onSuccess);
  }
  
}

function OrderMatchesViewModel() {
  self = this;

  self.orderMatches = ko.observableArray([]);
  self.addressesLabels = {};

  self.init = function() {
    self.addressesLabels = {};
    var wallet_adressess = WALLET.getAddressesList(true);
    var addresses = [];
    for(var i = 0; i < wallet_adressess.length; i++) {
      addresses.push(wallet_adressess[i][0]);
      self.addressesLabels[wallet_adressess[i][0]] = wallet_adressess[i][1];
    }

    var params = {
      filters: [
        {'field':'tx0_address', 'op':'IN', 'value':addresses},
        {'field':'tx1_address', 'op':'IN', 'value':addresses},
      ],
      filterop: 'OR',
      status: ['pending', 'completed', 'expired']
    };
    failoverAPI("get_order_matches", params, self.displayOrderMatches);
  }

  self.displayOrderMatches = function(data) {
    self.orderMatches([]);
    var order_matches = [];
    for (var i=0; i<data.length; i++) {
      var order_match = {};

      if (self.addressesLabels[data[i].tx0_address]) {
        order_match.address_label = self.addressesLabels[data[i].tx0_address];
        order_match.give_quantity_str = normalizeQuantity(data[i].forward_quantity) + ' ' + data[i].forward_asset;
        order_match.get_quantity_str = normalizeQuantity(data[i].backward_quantity) + ' ' + data[i].backward_asset;
      } else {
        order_match.address_label = self.addressesLabels[data[i].tx1_address];
        order_match.give_quantity_str = normalizeQuantity(data[i].backward_quantity) + ' ' + data[i].backward_asset;
        order_match.get_quantity_str = normalizeQuantity(data[i].forward_quantity) + ' ' + data[i].forward_asset;
      }
      order_match.status = data[i].status;

      var classes = {
        'completed': 'success',
        'pending': 'primary',
        'expired': 'danger'
      };
      order_match.status_html = '<span class="label label-'+classes[order_match.status]+'">'+order_match.status+'</span>';

      order_matches.push(order_match);
    }
    self.orderMatches(order_matches);
    var orderMatchesTable = $('#orderMatchesTable').dataTable();

  }

}


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
