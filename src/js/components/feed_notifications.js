NOTIFIED_RPS_RESULT = {};

function NotificationViewModel(category, message) {
  var self = this;
  self.CATEGORY = category;
  assert(category != "balances" && category != "debits" && category != "credits",
    "Trying to notify on a category that we don't notify on: " + category);
  self.WHEN = new Date().getTime();
  self.ICON_CLASS =  NotificationViewModel.calcIconClass(category);
  self.COLOR_CLASS =  NotificationViewModel.calcColorClass(category);
  self.MESSAGE = message;
  self.MESSAGE_TEXT = NotificationViewModel.calcText(category, message);
  
}

NotificationViewModel.calcIconClass = function(category) {
  /*
   * Possible categories:
   * user: Misc user notification (not critical)
   * alert: Something to alert the user to at a notification level
   * security: Security-related notification
   * 
   * Beyond this, any one of the valid message category types:
   * credits, debits, orders, bets, broadcasts, etc
   */
  if(category == 'user') return 'fa-user';
  if(category == 'alert') return 'fa-exclamation';
  if(category == 'security') return 'fa-shield';
  return ENTITY_ICONS[category] ? ENTITY_ICONS[category] : 'fa-question';
}
NotificationViewModel.calcColorClass = function(category) {
  if(category == 'user') return 'bg-color-lighten';
  if(category == 'alert') return 'bg-color-redLight';
  if(category == 'security') return 'bg-color-redLight';
  return ENTITY_NOTO_COLORS[category] ? ENTITY_NOTO_COLORS[category] : 'bg-color-white';
}
NotificationViewModel.calcText = function(category, message) {
  //Run through this function only once for each notification -- when the notification is initially received (and
  // before the underlying wallet/asset/whatever state has been modified, so that we can compare new to existing states
  // -- if we need to -- to be able to see what changed, which is important in the case of asset issuances, for instance)
  var desc = "";
  
  if(category == "sends") {
    if(WALLET.getAddressObj(message['source']) && WALLET.getAddressObj(message['destination'])) {
      desc = "You transferred <Am>" + smartFormat(normalizeQuantity(message['quantity'], message['_divisible']))
        + "</Am> <As>" + message['asset'] + "</As> from <Ad>" + getAddressLabel(message['source'])
        + "</Ad> to <Ad>" + getAddressLabel(message['destination']) + "</Ad>";
    } else if(WALLET.getAddressObj(message['source'])) { //we sent funds
      desc = "You sent <Am>" + smartFormat(normalizeQuantity(message['quantity'], message['_divisible']))
        + "</Am> <As>" + message['asset'] + "</As> from <Ad>" + getAddressLabel(message['source'])
        + "</Ad> to address <Ad>" +  getAddressLabel(message['destination']) + "</Ad>";
    } else if(WALLET.getAddressObj(message['destination'])) { //we received funds
      desc = "You received <Am>"
        + smartFormat(normalizeQuantity(message['quantity'], message['_divisible'])) + "</Am> <As>" + message['asset']
        + "</As> from <Ad>" +  getAddressLabel(message['source'])
        + "</Ad> to your address <Ad>" +  getAddressLabel(message['destination']) + "</Ad>";
    }
  } else if(category == "btcpays" && (WALLET.getAddressObj(message['source']) || WALLET.getAddressObj(message['destination']))) {
    desc = "BTCPay from <Ad>" + getAddressLabel(message['source']) + "</Ad> to <Ad>" + getAddressLabel(message['destination'])
      + "</Ad> for <Am>" + smartFormat(normalizeQuantity(message['btc_amount'])) + "</Am> <As>" + BTC + "</As>";
  } else if(category == "burns" && WALLET.getAddressObj(message['source'])) {
    desc = "Your address <Ad>" + getAddressLabel(message['source']) + "</Ad> has burned <Am>" + smartFormat(normalizeQuantity(message['burned']))
      + "</Am> <As>" + BTC + "</As> for <Am>" + smartFormat(normalizeQuantity(message['earned'])) + "</Am> <As>" + XCP + "</As>";
  } else if(category == "cancels" && WALLET.getAddressObj(message['source'])) {
    desc = "Order/Bid ID <b>" + message['tx_index'] + "</b> for your address <Ad>" + getAddressLabel(message['source']) + "</Ad> was cancelled";
  } else if(category == "callbacks" || category == "dividend") {
    //See if any of our addresses own any of the specified asset, and if so, notify them of the callback or dividend
    // NOTE that counterpartyd has automatically already adusted the balances of all asset holders...we just need to notify
    var addressesWithAsset = WALLET.getAddressesWithAsset(message['asset']);
    if(!addressesWithAsset.length) return;
    if(category == "callbacks") {
      desc = "<As>" + XCP + "<</As> balance adjusted on your address(es) <Ad>" + addressesWithAsset.join(', ')
        + "</Ad> due to <Am>" + (parseFloat(message['fraction']) * 100).toString()
        + "%</Am> callback option being exercised for token <As>" + message['asset'] + "</As>";
    } else {
      desc = "<As>" + message['dividend_asset'] + "</As> balance adjusted on your address(es) <Ad>" + addressesWithAsset.join(', ')
        + "</Ad> due to <Am>" + message['quantity_per_unit'] + "</Am> distribution being issued for token <As>" + message['asset'] + "</As>";
    }
  } else if(category == 'issuances') {
    var addresses = WALLET.getAddressesList();
    var assetObj = null;
    var addressesWithAsset = WALLET.getAddressesWithAsset(message['asset']);
    if(addressesWithAsset.length)
      assetObj = WALLET.getAddressObj(addressesWithAsset[0]).getAssetObj(message['asset']);
    
    if(message['transfer']) {
      //Detect transfers, whether we currently have the object in our wallet or not (as it could be
      // a transfer FROM an address outside of our wallet)
      if(addresses.indexOf(message['source'])!=-1 || addresses.indexOf(message['issuer'])!=-1) {
        desc = "Token <As>" + message['asset'] + "</As> was transferred from <Ad>"
          + getLinkForCPData('address', message['source'], getAddressLabel(message['source'])) + "</Ad> to <Ad>"
          + getLinkForCPData('address', message['issuer'], getAddressLabel(message['issuer'])) + "</Ad>"; 
      }
    } else if(assetObj) { //the address is in the wallet
      //Detect everything else besides transfers, which we only care to see if the asset is listed in one of the wallet addresses
      if(message['locked']) {
        assert(!assetObj.locked());
        desc = "Token <As>" + message['asset'] + "</As> was locked against additional issuance";
      } else if(message['description'] != assetObj.description()) {
        desc = "Token <As>" + message['asset'] + "</As> had its description changed from <b>" + assetObj.description()
          + "</b> to <b>" + message['description'] + "</b>";
      } else {
        var additionalQuantity = message['quantity'];
        if(additionalQuantity) {
          desc = "Additional <Am>" + smartFormat(normalizeQuantity(additionalQuantity, assetObj.DIVISIBLE))
            + "</Am> units issued for token <As>" + message['asset'] + "</As>";
        } else {
          //this is not a transfer, but it is not in our wallet as well we can assume it's an issuance of a totally new asset
          desc = "Token <As>" + message['asset'] + "</As> was issued with an initial quantity of <Am>"
            + smartFormat(normalizeQuantity(message['quantity'], message['divisible'])) + "</Am> units";
        }
      }
    }
  } else if(category == "orders" && WALLET.getAddressObj(message['source'])) {
    desc = "Your order to buy <Am>" + smartFormat(normalizeQuantity(message['get_quantity'], message['_get_asset_divisible']))
      + "</Am> <As>" + message['get_asset'] + "</As> from <Ad>" + getAddressLabel(message['source'])
      + "</Ad> in exchange for <Am>" + smartFormat(normalizeQuantity(message['give_quantity'], message['_give_asset_divisible']))
      + "</Am> <As>" + message['give_asset'] + "</As> is active";
  } else if(category == "order_matches" && (WALLET.getAddressObj(message['tx0_address']) || WALLET.getAddressObj(message['tx1_address']))) {
    desc = "Order matched between <Ad>" 
      + getAddressLabel(message['tx0_address']) + "</Ad> (gave <Am>"
      + smartFormat(normalizeQuantity(message['forward_quantity'], message['_forward_asset_divisible'])) + "</Ad> <As>" + message['forward_asset'] + "</As>) and <Ad>"
      + getAddressLabel(message['tx1_address']) + "</Ad> (gave <Am>"
      + smartFormat(normalizeQuantity(message['backward_quantity'], message['_backward_asset_divisible'])) + "</Ad> <As>" + message['backward_asset'] + "</As>)";
  } else if(category == "order_expirations" && WALLET.getAddressObj(message['source'])) {
    desc = "Your order ID <b>" + message['order_index'] + "</b> from address <Ad>" + getAddressLabel(message['source']) + "</Ad> has expired";
  } else if(category == "order_match_expirations") {
    if(WALLET.getAddressObj(message['tx0_address']) && WALLET.getAddressObj(message['tx1_address'])) {
      desc = "An order match between your addresses <Ad>" + getAddressLabel(message['tx0_address'])
        + "</Ad> and <Ad>" + getAddressLabel(message['tx1_address']) + "</Ad> has expired";
    } else if(WALLET.getAddressObj(message['tx0_address'])) {
      desc = "An order match between your address <Ad>" + getAddressLabel(message['tx0_address'])
        + "</Ad> and address <Ad>" + getAddressLabel(message['tx1_address']) + "</Ad> has expired";
    } else if(WALLET.getAddressObj(message['tx1_address'])) {
      desc = "An order match between your address <Ad>" + getAddressLabel(message['tx1_address'])
        + "</Ad> and address <Ad>" + getAddressLabel(message['tx0_address']) + "</Ad> has expired";
    }
  } else if(category == "broadcasts" && WALLET.getAddressObj(message['source'])) {
    if(message['locked']) {
      desc = "You have locked the feed at address <Ad>" + getAddressLabel(message['source']) + "</Ad>";
    } else {
      desc = "You have broadcast value <Am>" + message['value'] + "</Am> from address <Ad>" + getAddressLabel(message['source']) + "</Ad>";
    }
  } else if(category == "bets" && WALLET.getAddressObj(message['source'])) {

    desc = "You bet <Am>" + smartFormat(normalizeQuantity(message['wager_quantity'])) + "</Am> <As>" + XCP + "</As> on the feed @"
      + " <Ad>" + getAddressLabel(message['source']) + "</Ad>";

  } else if(category == "bet_matches" && (WALLET.getAddressObj(message['tx0_address']) || WALLET.getAddressObj(message['tx1_address']))) {

    desc = "Bet @ feed <Ad>" + message['feed_address'] + "</Ad> matched between <Ad>" 
      + getAddressLabel(message['tx0_address']) + "</Ad> (gave <Am>"
      + smartFormat(normalizeQuantity(message['forward_quantity'])) + "</Ad> <As>" + XCP + "</As>) and <Ad>"
      + getAddressLabel(message['tx1_address']) + "</Ad> (gave <Am>"
      + smartFormat(normalizeQuantity(message['backward_quantity'])) + "</Ad> <As>" + XCP + "</As>)";

  } else if(category == "bet_expirations" && WALLET.getAddressObj(message['source'])) {
    desc = "Your bet ID <b>" + message['bet_index'] + "</b> from address <Ad>" + getAddressLabel(message['source']) + "</Ad> has expired";
  } else if(category == "bet_match_expirations") {
    if(WALLET.getAddressObj(message['tx0_address']) && WALLET.getAddressObj(message['tx1_address'])) {
      desc = "A bet match between your addresses <Ad>" + getAddressLabel(message['tx0_address'])
        + "</Ad> and <Ad>" + getAddressLabel(message['tx1_address']) + "</Ad> has expired";
    } else if(WALLET.getAddressObj(message['tx0_address'])) {
      desc = "A bet match between your address <Ad>" + getAddressLabel(message['tx0_address'])
        + "</Ad> and address <Ad>" + getAddressLabel(message['tx1_address']) + "</Ad> has expired";
    } else if(WALLET.getAddressObj(message['tx1_address'])) {
      desc = "A bet match between your address <Ad>" + getAddressLabel(message['tx1_address'])
        + "</Ad> and address <Ad>" + getAddressLabel(message['tx0_address']) + "</Ad> has expired";
    }


  } else if(category == 'rps'  && WALLET.getAddressObj(message['source'])) {

    desc  = "You play Rock-Paper-Scissors with <Am>" + smartFormat(normalizeQuantity(message['wager']))+ "</Am> <As>" + XCP + "</As>";
    desc += " with <Ad>"+ getAddressLabel(message['source']) + "</Ad>";

  } else if(category == 'rpsresolves' && WALLET.getAddressObj(message['source'])) {

    var move_names = ['NA', 'ROCK', 'PAPER', 'SCISSORS', 'SPOCK', 'LIZARD'];
    var move_name = move_names[message['move']] || message['move']
    desc  = "Your move <Am>"+ move_name +"</Am> with <Ad>" + getAddressLabel(message['source']) + "</Ad> is confirmed";

  } else if(category == 'rps_expirations' && WALLET.getAddressObj(message['source'])) {

    desc = "Your RPS game ID <b>" + message['rps_index'] + "</b> from address <Ad>" + getAddressLabel(message['source']) + "</Ad> has expired";

  } else if(category == "rps_match_expirations") {

    if(WALLET.getAddressObj(message['tx0_address']) && WALLET.getAddressObj(message['tx1_address'])) {
      desc = "A RPS match between your addresses <Ad>" + getAddressLabel(message['tx0_address'])
        + "</Ad> and <Ad>" + getAddressLabel(message['tx1_address']) + "</Ad> has expired";
    } else if(WALLET.getAddressObj(message['tx0_address'])) {
      desc = "A RPS match between your address <Ad>" + getAddressLabel(message['tx0_address'])
        + "</Ad> and address <Ad>" + getAddressLabel(message['tx1_address']) + "</Ad> has expired";
    } else if(WALLET.getAddressObj(message['tx1_address'])) {
      desc = "A RPS match between your address <Ad>" + getAddressLabel(message['tx1_address'])
        + "</Ad> and address <Ad>" + getAddressLabel(message['tx0_address']) + "</Ad> has expired";
    }

  } else if(category == "rps_matches") {

    if (!message['tx0_address']) {

      var params = {
        filters: [
          {field: 'id', op: '=', value: message['rps_match_id']}
        ]
      }

      var onReceiveRpsMatch = function(data) {
        for (var i in data) {
          var rps_match = data[i];
          NOTIFICATION_FEED.add(category, rps_match);
        }        
      }

      failoverAPI('get_rps_matches', params, onReceiveRpsMatch);

    } else {
        
        if (WALLET.getAddressObj(message['tx0_address'])) {
          if  (message['status'] == "concluded: first player wins") {
            desc = "RPS: You win " + smartFormat(normalizeQuantity(message['wager']))+ "</Am> <As>" + XCP + "</As>" + 
                   " with <Ad>" + getAddressLabel(message['tx0_address']) + "</Ad>";
          } else if  (message['status'] == "concluded: second player wins") {
            desc = "RPS: You lose " + smartFormat(normalizeQuantity(message['wager']))+ "</Am> <As>" + XCP + "</As>" + 
                   " with <Ad>" + getAddressLabel(message['tx0_address']) + "</Ad>";
          } else if  (message['status'] == "concluded: tie") {
            desc = "RPS: Tie with <Ad>" + getAddressLabel(message['tx0_address']) + "</Ad>";
          }
          if (desc) {
            desc += " (" + message['tx0_index'] + ")";
          }
        }

        var desc2 = "";
        if (WALLET.getAddressObj(message['tx1_address'])) {
          if  (message['status'] == "concluded: first player wins") {
            desc2 = "RPS: You lose " + smartFormat(normalizeQuantity(message['wager']))+ "</Am> <As>" + XCP + "</As>" + 
                   " with <Ad>" + getAddressLabel(message['tx1_address']) + "</Ad>";
          } else if  (message['status'] == "concluded: second player wins") {
            desc2 = "RPS: You win " + smartFormat(normalizeQuantity(message['wager']))+ "</Am> <As>" + XCP + "</As>" + 
                   " with <Ad>" + getAddressLabel(message['tx1_address']) + "</Ad>";
          } else if  (message['status'] == "concluded: tie") {
            desc2 = "RPS: Tie with <Ad>" + getAddressLabel(message['tx1_address']) + "</Ad>";
          }
          if (desc) {
            desc2 += " (" + message['tx1_index'] + ")";
          }
          if (desc2 != "") {
            desc = desc + '<br />' + desc2;
          }
        }

        if (desc && NOTIFIED_RPS_RESULT[desc]) {
          desc = null;
        } else if (desc) {
          NOTIFIED_RPS_RESULT[desc] = true;
        }
      
    }

  }

  if(desc) {
    desc = desc.replace(/<Am>/g, '<b class="notoQuantityColor">').replace(/<\/Am>/g, '</b>');
    desc = desc.replace(/<Ad>/g, '<b class="notoAddrColor">').replace(/<\/Ad>/g, '</b>');
    desc = desc.replace(/<As>/g, '<b class="notoAssetColor">').replace(/<\/As>/g, '</b>');
  }
  return desc; 
}  


function NotificationFeedViewModel(initialCount) {
  var self = this;
  
  self.entries = ko.observableArray([]);
  self.lastUpdated = ko.observable(new Date());
  self.count = ko.observable(initialCount || 0);
  self.unackedCount = ko.observable(initialCount || 0);

  self.ack = function() {
    self.unackedCount(0);
  }
  
  self.add = function(category, message) {
    if(category == "balances" || category == "debits" || category == "credits") return;
    //^ we don't notify on these categories (since the action is covered by other categories, such as send, which makes these redundant)
    
    var noto = new NotificationViewModel(category, message);
    if(!noto.MESSAGE_TEXT)
      return; //will be the case if this noto does not apply to this client or is not something this client needs to see
    
    self.entries.unshift(noto); //add to front of array
    self.unackedCount(self.unackedCount() + 1);
    //if the number of entries are over 40, remove the oldest one
    if(self.entries().length > 40) self.entries.pop();
    self.lastUpdated(new Date());
    WALLET.refreshBTCBalances();
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
