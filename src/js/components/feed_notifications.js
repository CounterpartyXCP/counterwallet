
function NotificationViewModel(category, message, when) {
  if(typeof(when)==='undefined' || when === null) when = new Date().getTime();

  var self = this;
  self.CATEGORY = category;
  assert(category != "balances" && category != "debits" && category != "credits",
    "Trying to notify on a category that we don't notify on: " + category);
    
  /*
   * Possible categories:
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
    
    if(category == "sends") {
      if(WALLET.getAddressObj(msg['source']) && WALLET.getAddressObj(msg['destination'])) {
        desc = "You transferred <Am>" + numberWithCommas(normalizeQuantity(msg['quantity'], msg['_divisible']))
          + "</Am> <As>" + msg['asset'] + "</As> from <Ad>" + getAddressLabel(msg['source'])
          + "</Ad> to <Ad>" + getAddressLabel(msg['destination']) + "</Ad>";
      } else if(WALLET.getAddressObj(msg['source'])) { //we sent funds
        desc = "You sent <Am>" + numberWithCommas(normalizeQuantity(msg['quantity'], msg['_divisible']))
          + "</Am> <As>" + msg['asset'] + "</As> from <Ad>" + getAddressLabel(msg['source'])
          + "</Ad> to address <Ad>" +  getAddressLabel(msg['destination']) + "</Ad>";
      } else if(WALLET.getAddressObj(msg['destination'])) { //we received funds
        desc = "You received <Am>"
          + numberWithCommas(normalizeQuantity(msg['quantity'], msg['_divisible'])) + "</Am> <As>" + msg['asset']
          + "</As> from <Ad>" +  getAddressLabel(msg['source'])
          + "</Ad> to your address <Ad>" +  getAddressLabel(msg['destination']) + "</Ad>";
      }
    } else if(category == "btcpays" && (WALLET.getAddressObj(msg['source']) || WALLET.getAddressObj(msg['destination']))) {
      desc = "BTCPay from " + getAddressLabel(msg['source']) + " to " + getAddressLabel(msg['destination'])
        + " for " + normalizeQuantity(msg['btc_quantity']) + " BTC";
    } else if(category == "burns" && WALLET.getAddressObj(msg['source'])) {
      desc = "Your address " + getAddressLabel(msg['source']) + " has burned " + normalizeQuantity(msg['burned'])
        + " BTC for " + normalizeQuantity(msg['earned']) + " XCP";
    } else if(category == "cancels" && WALLET.getAddressObj(msg['source'])) {
      desc = "Order/Bid " + msg['offer_hash'] + " for your address " + getAddressLabel(msg['source']) + " was cancelled";
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
        desc = "XCP balance adjusted on your address(es) <Ad>" + addressesWithAsset.join(', ')
          + "</Ad> due to <Am>" + (parseFloat(msg['fraction']) * 100).toString()
          + "%</Am> callback option being exercised for asset <As>" + msg['asset'] + "</As>";
      } else {
        desc = "<As>" + msg['dividend_asset'] + "</As> balance adjusted on your address(es) <Ad>" + addressesWithAsset.join(', ')
          + "</Ad> due to <Am>" + msg['quantity_per_unit'] + "</Am> dividend being issued for asset <As>" + msg['asset'] + "</As>";
      }
    } else if(category == 'issuances') {
      var assetObj = null;
      var addressesWithAsset = WALLET.getAddressesWithAsset(msg['asset']);
      if(addressesWithAsset.length)
        assetObj = WALLET.getAddressObj(addressesWithAsset[0]).getAssetObj(msg['asset']);
      
      if(msg['transfer']) {
        //Detect transfers, whether we currently have the object in our wallet or not (as it could be
        // a transfer FROM an address outside of our wallet)
        if(addresses.contains(msg['source']) || addresses.contains(msg['issuer'])) {
          desc = "Asset <As>" + msg['asset'] + "</As> was transferred from <Ad>"
            + getLinkForCPData('address', msg['source'], getAddressLabel(msg['source'])) + "</Ad> to <Ad>"
            + getLinkForCPData('address', msg['issuer'], getAddressLabel(msg['issuer'])) + "</Ad>"; 
        }
      } else {
        assert(assetObj);
        //Detect everything else besides transfers, which we only care to see if the asset is listed in one of the wallet addresses
        if(msg['locked'] != assetObj.isLocked()) {
          desc = "Asset <As>" + msg['asset'] + "</As> was locked against additional issuance";
        } else if(msg['description'] != assetObj.description()) {
          desc = "Asset <As>" + msg['asset'] + "</As> had its description changed from <b>" + assetObj.description()
            + "</b> to <b>" + msg['description'] + "</b>";
        } else {
          var additionalQuantity = msg['quantity'] - assetObj.rawTotalIssued();
          if(additionalQuantity) {
            desc = "Additional <Am>" + numberWithCommas(normalizeQuantity(additionalQuantity, assetObj.DIVISIBLE))
              + "</Am> units issued for asset <As>" + msg['asset'] + "</As>";
          } else {
            //this is not a transfer, but it is not in our wallet as well we can assume it's an issuance of a totally new asset
            desc = "Asset <As>" + msg['asset'] + "</As> was issued with an initial quantity of <Am>"
              + numberWithCommas(normalizeQuantity(msg['quantity'], msg['divisible'])) + "</Am> units";
          }
        }
      }
    } else if(category == "orders" && WALLET.getAddressObj(msg['source'])) {
      desc = "Your order to buy <Am>" + numberWithCommas(normalizeQuantity(msg['get_quantity'], msg['_get_asset_divisible']))
        + "</Am> <As>" + msg['get_asset'] + "</As> from <Ad>" + getAddressLabel(msg['source'])
        + "</Ad> in exchange for <Am>" + numberWithCommas(normalizeQuantity(msg['give_quantity'], msg['_give_asset_divisible']))
        + "</Am> <As>" + msg['get_asset'] + "</As> is active";
    } else if(category == "order_matches" && (WALLET.getAddressObj(msg['tx0_address']) || WALLET.getAddressObj(msg['tx1_address']))) {
      desc = "Order matched between <Ad>" 
        + getAddressLabel(msg['tx0_address']) + "</Ad> (offering <Am>"
        + numberWithCommas(normalizeQuantity(msg['forward_quantity'], msg['_forward_asset_divisible'])) + "</Ad> <As>" + msg['forward_asset'] + "</As>) and <Ad>"
        + getAddressLabel(msg['tx1_address']) + "</Ad> (offering <Am>"
        + numberWithCommas(normalizeQuantity(msg['forward_quantity'], msg['_backward_asset_divisible'])) + "</Ad> <As>" + msg['forward_asset'] + "</As>)";
    } else if(category == "order_expirations" && WALLET.getAddressObj(msg['source'])) {
      desc = "Your order <i>" + msg['order_hash'] + "</i> from address <Ad>" + getAddressLabel(msg['source']) + "</Ad> has expired";
    } else if(category == "order_match_expirations") {
      if(WALLET.getAddressObj(msg['tx0_address']) && WALLET.getAddressObj(msg['tx1_address'])) {
        desc = "An order match between your addresses <Ad>" + getAddressLabel(msg['tx0_address'])
          + "</Ad> and <Ad>" + getAddressLabel(msg['tx1_address']) + "</Ad> has expired";
      } else if(WALLET.getAddressObj(msg['tx0_address'])) {
        desc = "An order match between your address <Ad>" + getAddressLabel(msg['tx0_address'])
          + "</Ad> and address <Ad>" + getAddressLabel(msg['tx1_address']) + "</Ad> has expired";
      } else if(WALLET.getAddressObj(msg['tx1_address'])) {
        desc = "An order match between your address <Ad>" + getAddressLabel(msg['tx1_address'])
          + "</Ad> and address <Ad>" + getAddressLabel(msg['tx0_address']) + "</Ad> has expired";
      }
    } else if(category == "broadcasts") {
      //TODO
    }

    if(desc) {
      desc = desc.replace(/<Am>/g, '<b class="notoQuantityColor">').replace(/<\/Am>/g, '</b>');
      desc = desc.replace(/<Ad>/g, '<b class="notoAddrColor">').replace(/<\/Ad>/g, '</b>');
      desc = desc.replace(/<As>/g, '<b class="notoAssetColor">').replace(/<\/As>/g, '</b>');
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
    if(category == "balances" || category == "debits" || category == "credits") {
      //we don't notify on these categories (since the action is covered by other categories, such as send, which makes these redundant)
      return;
    }    
    
    var noto = new NotificationViewModel(category, message, when);
    if(noto.displayText() == '')
      //will be the case if this noto does not apply to this client or is not something this client needs to see
      return;
    
    self.notifications.unshift(noto); //add to front of array
    self.unackedCount(self.unackedCount() + 1);
    //if the number of notifications are over 40, remove the oldest one
    if(self.notifications().length > 40) self.notifications.pop();
    self.lastUpdated(new Date());
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
