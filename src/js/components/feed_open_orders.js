
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
                source: self.ORDER['source'],
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
  self.entries = ko.observableArray([]);
  self.lastUpdated = ko.observable(new Date());
  
  self.dispCount = ko.computed(function() {
    return self.entries().length;
  }, self);

  self.sellBTCOrdersCount = ko.computed(function() {
    return $.map(self.entries(), function(item) {       
        return ('BTC' == item.ORDER['give_asset']) ? item : null;
    }).length;
  }, self);
  
  //Every 60 seconds, run through all entries and update their 'now' members
  setInterval(function() {
    var now = new Date();
    for(var i=0; i < self.entries().length; i++) {
      self.entries()[i].now(now);
    }  
  }, 60 * 1000); 
  
  self.add = function(order, resort) {
    assert(order);
    if(typeof(resort)==='undefined') resort = true;
    self.entries.unshift(new OpenOrderViewModel(order));
    if(resort) {
      //sort the pending orders so that the order most close to expiring is at top
      self.entries.sort(function(left, right) {
        return left.expiresInNumBlocks() == right.expiresInNumBlocks() ? 0 : (left.expiresInNumBlocks() < right.expiresInNumBlocks() ? -1 : 1);
      });      
    }
    self.lastUpdated(new Date());
  }

  self.remove = function(orderTxHash) {
    self.entries.remove(function(item) {
        return orderTxHash == item.ORDER['tx_hash'];
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
    failoverAPI("get_orders", {'filters': filters, 'show_expired': false, 'filterop': 'or'},
      function(data, endpoint) {
        //if the order is for BTC and the qty remaining on either side is negative (but not on BOTH sides,
        // as it would be fully satified then and canceling would be pointless), auto cancel the order
        //BUG: logging back in and out again before this txn is confirmed will create a second cancellation request here (which will be rejected, but still)
        //TODO: maybe look at pending operations to make sure that we don't reissue a cancel call that is currently pending
        var openBTCOrdersToCancel = $.grep(data, function(e) {
          return    e['status'] == 'open'
                 && (e['get_asset'] == 'BTC' || e['give_asset'] == 'BTC')
                 && (e['get_remaining'] <= 0 || e['give_remaining'] <= 0)
                 && !(e['get_remaining'] <= 0 && e['give_remaining'] <= 0);
        });
        for(i=0; i < openBTCOrdersToCancel.length; i++) {
          $.jqlog.debug("Auto cancelling BTC order " + openBTCOrdersToCancel[i]['tx_hash']
            + " as the give_remaining and/or get_remaining <= 0 ...");
          WALLET.doTransaction(openBTCOrdersToCancel[i]['source'], "create_cancel", {
            offer_hash: openBTCOrdersToCancel[i]['tx_hash'],
            source: openBTCOrdersToCancel[i]['source'],
            _type: 'order',
            _tx_index: openBTCOrdersToCancel[i]['tx_index']
          });
        }
        
        //do not show empty/filled orders, including open BTC orders that have 0/neg give/get remaining (as we auto
        // cancelled them above or they are fully satisfied and do not need to be shown, or need cancellation)
        var openOrders = $.grep(data, function(e) { return e['status'] == 'open' && e['get_remaining'] > 0 && e['give_remaining'] > 0; });
        //get divisibility for assets (this is slow and unoptimized)
        var assets = [];
        for(i=0; i < openOrders.length; i++) {
          if(!assets.contains(openOrders[i]['give_asset'])) assets.push(openOrders[i]['give_asset']);
          if(!assets.contains(openOrders[i]['get_asset'])) assets.push(openOrders[i]['get_asset']);
        }
        failoverAPI("get_asset_info", [assets], function(assetsInfo, endpoint) {
          var assetMappings = {};
          for(i=0; i < assetsInfo.length; i++) {
            assetMappings[assetsInfo[i]['asset']] = assetsInfo[i]['divisible'];
          }
          
          for(i=0; i < openOrders.length; i++) {
            openOrders[i]['_give_asset_divisible'] = assetMappings[openOrders[i]['give_asset']];
            openOrders[i]['_get_asset_divisible'] = assetMappings[openOrders[i]['get_asset']];
            self.add(openOrders[i], i == openOrders.length - 1); //PERF: sort on the last addition only
          }
        });
      }
    );
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
