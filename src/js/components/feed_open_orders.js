
function OpenOrderViewModel(order) {
  assert(order['tx_index'], "Must be a valid order object");
  var self = this;
  self.ORDER = order;
  //break out the dynamic (changing) fields as observables
  self.rawGiveRemaining = ko.observable(order['give_remaining']);
  self.rawGetRemaining = ko.observable(order['get_remaining']);
  self.feeRemaining = ko.observable(order['fee_remaining']);
  self.now = ko.observable(new Date()); //auto updates from the parent model every minute
  
  self.expiresInNumBlocks = ko.computed(function() {
    return self.ORDER['expire_index'] - WALLET.networkBlockHeight();
  }, self);
  
  self.approxExpiresInTime = ko.computed(function() {
    return new Date((new Date()).getTime() + (self.expiresInNumBlocks() * APPROX_SECONDS_PER_BLOCK * 1000));
  }, self);

  self.displayColor = ko.computed(function() {
    if(self.approxExpiresInTime() - self.now() > 7200 * 1000) return 'bg-color-greenLight'; //> 2 hours
    if(self.approxExpiresInTime() - self.now() > 3600 * 1000) return 'bg-color-yellow'; //> 1 hour
    if(self.approxExpiresInTime() - self.now() > 1800 * 1000) return 'bg-color-orange'; //> 30 min
    return 'bg-color-red'; // < 30 min, or already expired according to our reough estimate
  }, self);
  
  self.cancelOpenOrder = function() {
    bootbox.dialog({
      message: "Are you sure that you want to cancel this order?<br/><br/> \
        <b style='color:red'>Please NOTE that this action is irreversable!</b>",
      title: "Are you sure?",
      buttons: {
        success: {
          label: "Don't Cancel Order",
          className: "btn-default",
          callback: function() {
            //modal will disappear
          }
        },
        danger: {
          label: "Cancel Order",
          className: "btn-warning",
          callback: function() {
            //issue 0 to lock the asset
            WALLET.doTransaction(self.ORDER['source'], "create_cancel",
              {
                offer_hash: self.ORDER['tx_hash'],
                _type: 'order',
                _tx_index: self.ORDER['tx_index']
              },
              function(txHash, data, endpoint) {
                bootbox.alert("Your order cancellation has been submitted. " + ACTION_PENDING_NOTICE);
                
                if(self.ORDER['give_asset'] == 'BTC') {
                  multiAPI("cancel_btc_open_order", [WALLET.identifier(), self.ORDER['tx_hash']]);
                }
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
  
  self.dispCount = ko.computed(function() {
    return self.openOrders().length;
  }, self);
  
  //Every 60 seconds, run through all openOrders and update their 'now' members
  setInterval(function() {
    var now = new Date();
    for(var i=0; i < self.openOrders().length; i++) {
      self.openOrders()[i].now(now);
    }  
  }, 60 * 1000); 
  
  self.add = function(order, resort) {
    assert(order);
    if(typeof(resort)==='undefined') resort = true;
    self.openOrders.unshift(new OpenOrderViewModel(order));
    if(resort) {
      //sort the pending orders so that the order most close to expiring is at top
      self.openOrders.sort(function(left, right) {
        return left.expiresInNumBlocks() == right.expiresInNumBlocks() ? 0 : (left.expiresInNumBlocks() < right.expiresInNumBlocks() ? -1 : 1);
      });      
    }
    self.lastUpdated(new Date());
  }

  self.remove = function(orderTxHashOrIndex) {
    self.openOrders.remove(function(item) {
        return orderTxHashOrIndex == item.ORDER['tx_index'] || orderTxHashOrIndex == item.ORDER['tx_hash'];
    });
    self.lastUpdated(new Date());
  }
  
  self.restore = function() {
    //Get and populate any open orders we have
    var addresses = WALLET.getAddressesList();
    var filters = [];
    for(var i=0; i < addresses.length; i++) {
      filters.push({'field': 'source', 'op': '==', 'value': addresses[i]});
    }
    failoverAPI("get_orders", {'filters': filters, 'show_empty': false, 'show_expired': false, 'filterop': 'or'},
      function(data, endpoint) {
        //get divisibility for assets (this is slow and unoptimized)
        var assets = [];
        for(i=0; i < data.length; i++) {
          if(!assets.contains(data[i]['give_asset'])) assets.push(data[i]['give_asset']);
          if(!assets.contains(data[i]['get_asset'])) assets.push(data[i]['get_asset']);
        }
        failoverAPI("get_asset_info", [assets], function(assetsInfo, endpoint) {
          var assetMappings = {};
          for(i=0; i < assetsInfo.length; i++) {
            assetMappings[assetsInfo[i]['asset']] = assetsInfo[i]['divisible'];
          }
          
          for(i=0; i < data.length; i++) {
            data[i]['_give_asset_divisible'] = assetMappings[data[i]['give_asset']];
            data[i]['_get_asset_divisible'] = assetMappings[data[i]['get_asset']];
            self.add(data[i], i == data.length - 1); //PERF: sort on the last addition only
          }
        });
      }
    );
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
