
function NotificationViewModel(category, message, when) {
  if(typeof(when)==='undefined' || when === null) when = new Date().getTime();

  var self = this;
  self.CATEGORY = category;
  /*
   * Possible categorys:
   * user: Misc user notification (not critical)
   * alert: Something to alert the user to at a notification level
   * security: Security-related notification
   * 
   * Beyond this, any one of the valid message category types:
   * credits, debits, orders, bets, broadcasts, etc
   */
  self.MESSAGE = message;
  self.WHEN = when; //when generated
  
  self.displayIcon = ko.computed(function() {
    if(self.CATEGORY == 'user') return 'fa-user';
    if(self.CATEGORY == 'alert') return 'fa-exclamation';
    if(self.CATEGORY == 'security') return 'fa-shield';
    return ENTITY_ICONS[self.CATEGORY] ? ENTITY_ICONS[self.CATEGORY] : 'fa-question';
  }, self);
  
  self.displayColor = ko.computed(function() {
    if(self.CATEGORY == 'user') return 'bg-color-lighten';
    if(self.CATEGORY == 'alert') return 'bg-color-redLight';
    if(self.CATEGORY == 'security') return 'bg-color-redLight';
    return ENTITY_NOTO_COLORS[self.CATEGORY] ? ENTITY_NOTO_COLORS[self.CATEGORY] : 'bg-color-white';
  }, self);
  
  self.displayText = function() {
    var desc = "";
    var category = self.CATEGORY;
    var msg = self.MESSAGE;
    
    if(category == "balances" || category == "debits" || category == "credits") {
      //do nothing
    } else if(category == "broadcasts") {
      //TODO
    } else if(category == "btcpays" && (WALLET.getAddressObj(msg['source']) || WALLET.getAddressObj(msg['destination']))) {
      desc = "BTCPay from " + getAddressLabel(msg['source']) + " to " + getAddressLabel(msg['destination'])
        + " for " + normalizeAmount(msg['btc_amount']) + " BTC";
    } else if(category == "burns" && WALLET.getAddressObj(msg['source'])) {
      desc = "Your address " + getAddressLabel(msg['source']) + " has burned " + normalizeAmount(msg['burned'])
        + " BTC for " + normalizeAmount(msg['earned']) + " XCP.";
    } else if(category == "cancels" && WALLET.getAddressObj(msg['source'])) {
      desc = "Order/Bid " + msg['offer_hash'] + " for your address " + getAddressLabel(msg['source']) + " was cancelled.";
    } else if(category == "callbacks" || category == "dividend") {
      //See if any of our addresses own any of the specified asset, and if so, notify them of the callback or dividend
      // NOTE that counterpartyd has automatically already adusted the balances of all asset holders...we just need to notify
      var addresses = WALLET.getAddressesList();
      var addressesWithAsset = [];
      for(var i=0; i < addresses.length; i++) {
        if(WALLET.getBalance(addresses[i], msg['asset'])) {
          addressesWithAsset.push(getAddressLabel(addresses[i]));
        }
      }
      if(!addressesWithAsset.length) return;
      if(category == "callbacks") {
        desc = "XCP balance adjusted on your address(es) " + addressesWithAsset.join(', ');
          + " due to " + (parseFloat(msg['fraction']) * 100).toString() + "% callback option being exercised for asset " + msg['asset'];
      } else {
        desc = msg['dividend_asset'] + " balance adjusted on your address(es) " + addressesWithAsset.join(', ');
          + " due to " + msg['amount_per_unit'] + " dividend being issued for asset " + msg['asset'];
      }
    } else if(category == "sends") {
      if(WALLET.getAddressObj(msg['source']) && WALLET.getAddressObj(msg['destination'])) {
        desc = "You transferred <b>" + numberWithCommas(normalizeAmount(msg['amount'], msg['_divisible']))
          + " " + msg['asset'] + "</b> from " + getAddressLabel(msg['source']) + " to " +  getAddressLabel(msg['destination']);
      } else if(WALLET.getAddressObj(msg['source'])) { //we sent funds
        desc = "You sent <b>" + numberWithCommas(normalizeAmount(msg['amount'], msg['_divisible']))
          + " " + msg['asset'] + "</b> from " + getAddressLabel(msg['source']) + " to address " +  getAddressLabel(msg['destination']);
      } else if(WALLET.getAddressObj(msg['destination'])) { //we received funds
        desc = "You received <b>"
          + numberWithCommas(normalizeAmount(msg['amount'], msg['_divisible'])) + " " + msg['asset']
          + "</b> from " +  getAddressLabel(msg['source']) + " to your address " +  getAddressLabel(msg['destination']);
      }
    } else if(category == "orders" && WALLET.getAddressObj(msg['source'])) {
      desc = "Your order to buy " + numberWithCommas(normalizeAmount(msg['get_amount'], msg['_get_asset_divisible']))
        + " " + msg['get_asset'] + " from " + getAddressLabel(msg['source'])
        + " in exchange for " + numberWithCommas(normalizeAmount(msg['give_amount'], msg['_give_asset_divisible']))
        + " " + msg['get_asset'] + " was successfully created.";
    } else if(category == "order_matches" && (WALLET.getAddressObj(msg['tx0_address']) || WALLET.getAddressObj(msg['tx1_address']))) {
      desc = "Order matched between " 
        + getAddressLabel(msg['tx0_address']) + " (offering "
        + numberWithCommas(normalizeAmount(msg['forward_amount'], msg['_forward_asset_divisible'])) + " " + msg['forward_asset'] + ") and "
        + getAddressLabel(msg['tx1_address']) + " (offering "
        + numberWithCommas(normalizeAmount(msg['forward_amount'], msg['_backward_asset_divisible'])) + " " + msg['forward_asset'] + ")";
    } else if(category == "order_expirations" && WALLET.getAddressObj(msg['source'])) {
      desc = "Your order " + msg['order_hash'] + " from address " + getAddressLabel(msg['source']) + " has expired.";
    } else if(category == "order_match_expirations") {
      if(WALLET.getAddressObj(msg['tx0_address']) && WALLET.getAddressObj(msg['tx1_address'])) {
        desc = "An order match between your addresses <b>" + getAddressLabel(msg['tx0_address'])
          + " and <b>" + getAddressLabel(msg['tx1_address']) + "</b> has expired.";
      } else if(WALLET.getAddressObj(msg['tx0_address'])) {
        desc = "An order match between your address <b>" + getAddressLabel(msg['tx0_address'])
          + " and address <b>" + getAddressLabel(msg['tx1_address']) + "</b> has expired.";
      } else if(WALLET.getAddressObj(msg['tx1_address'])) {
        desc = "An order match between your address <b>" + getAddressLabel(msg['tx1_address'])
          + " and address <b>" + getAddressLabel(msg['tx0_address']) + "</b> has expired.";
      }
    }
    return desc; 
  }  
}

function NotificationFeedViewModel(initialCount) {
  var self = this;
  
  self.notifications = ko.observableArray([]);
  self.lastUpdated = ko.observable(new Date());
  self.count = ko.observable(initialCount || 0);
  self.unackedCount = ko.observable(initialCount || 0);

  self.dispLastUpdated = ko.computed(function() {
    return "Last Updated: " + self.lastUpdated().toTimeString(); 
  }, self);
  
  self.ack = function() {
    self.unackedCount(0);
  }
  
  self.add = function(category, message, when) {
    self.notifications.unshift(new NotificationViewModel(category, message, when)); //add to front of array
    self.unackedCount(self.unackedCount() + 1);
    //if the number of notifications are over 40, remove the oldest one
    if(self.notifications().length > 40) self.notifications.pop();
    self.lastUpdated(new Date());
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
