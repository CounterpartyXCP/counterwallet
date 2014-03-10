
function OpenOrderViewModel(order) {
  assert(order['tx_index'], "Must be a valid order object");
  var self = this;
  self.order = order;
  //break out the dynamic (changing) fields as observables
  self.giveRemaining = ko.observable(order['give_remaining']);
  self.getRemaining = ko.observable(order['get_remaining']);
  self.feeRemaining = ko.observable(order['fee_remaining']);
  
  self.cancelOpenOrder = function() {
    bootbox.dialog({
      message: "Are you sure that you want to cancel this order?<br/><br/> \
        <b style='color:red'>Please NOTE that this action is irreversable!</b>",
      title: "Are you sure?",
      buttons: {
        success: {
          label: "Don't Cancel Order'",
          className: "btn-default",
          callback: function() {
            //modal will disappear
          }
        },
        danger: {
          label: "Cancel Order",
          className: "btn-danger",
          callback: function() {
            //issue 0 to lock the asset
            WALLET.doTransaction(self.order['source'], "create_cancel",
              { offer_hash: self.order['tx_hash'] },
              function() {
                bootbox.alert("Your order cancellation has been submitted"
                  + " but it may take a bit for this to formally reflect on the network.");
              }
            );
          }
        },
      }
    });    
  }
}

function OpenOrderFeedViewModel() {
  var self = this;
  
  self.openOrders = ko.observableArray([]);
  self.lastUpdated = ko.observable(new Date());
  
  self.dispLastUpdated = ko.computed(function() {
    return "Last Updated: " + self.lastUpdated().toTimeString(); 
  }, self);
  
  self.dispCount = ko.computed(function() {
    return self.openOrders().length;
  }, self);
  
  self.add = function(order) {
    assert(order);
    self.openOrders.push(new OpenOrderViewModel(order));
    self.lastUpdated(new Date());
  }

  self.remove = function(orderTxHashOrIndex) {
    var match = ko.utils.arrayFirst(self.openOrders(), function(item) {
        return orderTxHashOrIndex == item.order['tx_index'] || orderTxHashOrIndex == item.order['tx_hash'];
    });
    if (match) {
      ko.utils.arrayRemoveItem(self.openOrders, match);
    }
    self.lastUpdated(new Date());
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
