
function WaitingBTCPayViewModel(btcPayData) {
  /* message is a message data object from the message feed for an order_match that requires a btc pay from an address in our wallet*/
  var self = this;
  self.BTCPAY_DATA = btcPayData;
  self.now = ko.observable(new Date()); //auto updates from the parent model every minute
  
  self.expiresInNumBlocks = ko.computed(function() {
    return self.BTCPAY_DATA['matchExpireIndex'] - WALLET.networkBlockHeight();
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
  
  self.completeBTCPay = function() {
    //Pop up confirm dialog, and make BTC payment
    WALLET.retrieveBTCBalance(self.BTCPAY_DATA['myAddr'], function(balance) {
      if(balance < self.BTCPAY_DATA['btcQuantityRaw'] + MIN_PRIME_BALANCE) {
        bootbox.alert("You do not have the required <b class='notoAssetColor'>BTC</b> balance to settle this order."
          + " Please deposit more <b class='notoAssetColor'>BTC</b> into address"
          + " <b class='notoAddrColor'>" + getAddressLabel(self.BTCPAY_DATA['myAddr']) + "</b> and try again.");
        return;
      }
      
      bootbox.dialog({
        message: "Confirm a payment of <b class='notoQuantityColor'>" + self.BTCPAY_DATA['btcQuantity'] + "</b>"
          + " <b class='notoAssetColor'>BTC</b>" + " to address"
          + " <b class='notoAddrColor'>" + getAddressLabel(self.BTCPAY_DATA['btcDestAddr']) + "</b> to settle order ID"
          + " <b>" + self.BTCPAY_DATA['myOrderTxIndex'] + "</b>?",
        title: "Confirm Order Settlement (BTC Payment)",
        buttons: {
          cancel: {
            label: "Cancel",
            className: "btn-default",
            callback: function() { } //just close the dialog
          },
          confirm: {
            label: "Confirm and Pay",
            className: "btn-success",
            callback: function() {
              //complete the BTCpay. Start by getting the current BTC balance for the address
              WALLET.doTransaction(self.BTCPAY_DATA['myAddr'], "create_btcpay",
                { order_match_id: self.BTCPAY_DATA['orderMatchID'] },
                function() { 
                  //remove the BTC payment from the notifications
                  WAITING_BTCPAY_FEED.remove(self.BTCPAY_DATA['orderMatchID']);
                }
              );
            }
          }
        }
      });
    });    
  }
}

function WaitingBTCPayFeedViewModel() {
  var self = this;
  self.waitingBTCPays = ko.observableArray([]);
  self.lastUpdated = ko.observable(new Date());
  
  self.dispCount = ko.computed(function() {
    return self.waitingBTCPays().length;
  }, self);

  //Every 60 seconds, run through all waitingBTCPays and update their 'now' members
  setInterval(function() {
    var now = new Date();
    for(var i=0; i < self.waitingBTCPays().length; i++) {
      self.waitingBTCPays()[i].now(now);
    }  
  }, 60 * 1000); 

  self.add = function(message, resort) {
    assert(message);
    if(typeof(resort)==='undefined') resort = true;
    self.waitingBTCPays.unshift(new WaitingBTCPayViewModel(message));
    if(resort) {
      //sort the pending BTCpays so that the entry most close to expiring is at top
      self.waitingBTCPays.sort(function(left, right) {
        return left.expiresInNumBlocks() == right.expiresInNumBlocks() ? 0 : (left.expiresInNumBlocks() < right.expiresInNumBlocks() ? -1 : 1);
      });      
    }
    self.lastUpdated(new Date());
  }
  
  self.remove = function(orderHashOrMatchHash, data) {
    //data is supplied optionally to allow us to notify the user on a failed BTCpay...it's only used when called from messagesfeed.js
    // before we work with valid messages only
    var match = ko.utils.arrayFirst(self.waitingBTCPays(), function(item) {
      if(orderHashOrMatchHash == item.BTCPAY_DATA['orderMatchID']) return true; //matched by the entire order match hash
      //otherwise try to match on a single order hash
      var orderHash1 = item.BTCPAY_DATA['orderMatchID'].substring(0, 64);
      var orderHash2 = item.BTCPAY_DATA['orderMatchID'].substring(64);
      return orderHashOrMatchHash == orderHash1 || orderHashOrMatchHash == orderHash2;
    });
    if(match) {
      self.waitingBTCPays.remove(match);
      self.lastUpdated(new Date());
    }
  }
}
WaitingBTCPayFeedViewModel.makeBTCPayData = function(data) {
  //data is a pending order match object (from a data feed message received, or from a get_orders API result)
  var firstInPair = WALLET.getAddressObj(data['tx0_address']) && data['forward_asset'] == 'BTC' ? true : false;
  if(!firstInPair) assert(WALLET.getAddressObj(data['tx1_address']) && data['backward_asset'] == 'BTC');
  
  return {
    matchExpireIndex: data['match_expire_index'],
    orderMatchID: data['tx0_hash'] + data['tx1_hash'],
    myAddr: firstInPair ? data['tx0_address'] : data['tx1_address'],
    btcDestAddr: firstInPair ? data['tx1_address'] : data['tx0_address'],
    btcQuantity: normalizeQuantity(firstInPair ? data['forward_quantity'] : data['backward_quantity'], true), //normalized
    btcQuantityRaw: firstInPair ? data['forward_quantity'] : data['backward_quantity'],
    myOrderTxIndex: firstInPair ? data['tx0_index'] : data['tx1_index'],
    otherOrderTxIndex: firstInPair ? data['tx1_index'] : data['tx0_index'],
    otherOrderAsset: firstInPair ? data['backward_asset'] : data['forward_asset'],
    otherOrderQuantity: normalizeQuantity(firstInPair ? data['backward_quantity'] : data['forward_quantity'],
      firstInPair ? data['_backward_asset_divisible'] : data['_forward_asset_divisible']), //normalized
    otherOrderQuantityRaw: firstInPair ? data['backward_quantity'] : data['forward_quantity']
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
