
var LAST_MESSAGEIDX_RECEIVED = 0; //last message received from the message feed (socket.io) -- used to detect gaps
var FAILOVER_CURRENT_IDX = 0; //last idx in the counterwalletd_base_urls tried (used for socket.io failover)

function tryNextSIOMessageFeed() {
  if(FAILOVER_LAST_IDX_TRIED + 1 == counterwalletd_base_urls.length) {
    FAILOVER_CURRENT_IDX = 0;
  } else {
    FAILOVER_CURRENT_IDX += 1;
  }
  $.jqlog.log('socket.io: Trying next server: ' + url[FAILOVER_CURRENT_IDX]);
  initMessageFeed();
}

function initMessageFeed() {
  //set up a connection to the server event feed via socket.io and handle messages
  var url = counterwalletd_base_urls[FAILOVER_CURRENT_IDX];
  $.jqlog.log("socket.io: Connecting to: " + url);
  //https://github.com/LearnBoost/Socket.IO/wiki/Configuring-Socket.IO
  var socket = io.connect(url, {
    'connect timeout': 5000,
    'reconnect': true,
    'reconnection delay': 500,
    'reconnection limit': 2000,
    'max reconnection attempts': 5,
    'force new connection': true,
    'try multiple transports': false,
    'resource': USE_TESTNET ? '_t_feed' : '_feed'
  });

  //Create a wildcard event handler: http://stackoverflow.com/a/19121009
  var original_$emit = socket.$emit;
  socket.$emit = function() {
      var args = Array.prototype.slice.call(arguments);
      original_$emit.apply(socket, ['*'].concat(args));
      if(!original_$emit.apply(socket, arguments)) {
          original_$emit.apply(socket, ['default'].concat(args));
      }
  }
  /*socket.on('default',function(event, data) {
      $.jqlog.log('socket.io event not trapped: ' + event + ' - data:' + JSON.stringify(data));
  });*/
  socket.on('*',function(event, data) {
      //$.jqlog.log('socket.io message received: ' + event + ' - data:' + JSON.stringify(data));
      if(event == 'connect') {
        $.jqlog.log('socket.io(messages): Connected to server: ' + url);
        socket.emit("subscribe"); //subscribe to the data feed itself
      } else if(event == 'disconnect') {
        $.jqlog.log('socket.io(messages): The client has disconnected from server: ' + url);
      } else if(event == 'connect_failed') {
        $.jqlog.log('socket.io(messages): Connection to server failed: ' + url);
        io.disconnect();
        tryNextSIOMessageFeed();
      } else if(event == 'reconnect_failed') {
        $.jqlog.log('socket.io(messages): Reconnect to the server failed: ' + url);
        io.disconnect();
        tryNextSIOMessageFeed();
      } else if(['connecting', 'connect_error', 'connect_timeout', 'reconnect', 'reconnecting', 'reconnect_error'].indexOf(event) >= 0) {
        //these events currently not handled
      } else{
        assert(data['_category'] !== undefined && event == data['_category'], "Message feed message lacks category field!");
        parseMessageWithFeedGapDetection(event, data);
      }
  });
}

function _getEventID(message) {
  var eventID = message['event'] || message['tx_hash'] || (message['tx0_hash'] + message['tx1_hash']) || null;
  if(!eventID)
    $.jqlog.warn("Cannot derive an eventID: " + JSON.stringify(message));
  return eventID;
}

function parseMessageWithFeedGapDetection(category, message) {
  if(!message || (message.substring && message.startswith("<html>"))) return;
  //^ sometimes nginx can trigger this via its proxy handling it seems, with a blank payload (or a html 502 Bad Gateway
  // payload) -- especially if the backend server reloads. Just ignore it.
  var eventID = _getEventID(message);
  $.jqlog.info("feed:RECV MESSAGE=" + category + ", IDX=" + message['_message_index'] + " (last idx: "
    + LAST_MESSAGEIDX_RECEIVED + "), EVENTID=" + eventID + ", CONTENTS=" + JSON.stringify(message));

  if((message['_message_index'] === undefined || message['_message_index'] === null) && IS_DEV) debugger; //it's an odd condition we should look into...
  assert(LAST_MESSAGEIDX_RECEIVED, "LAST_MESSAGEIDX_RECEIVED is not defined! Should have been set from is_ready on logon.");
  if(message['_message_index'] <= LAST_MESSAGEIDX_RECEIVED) {
    $.jqlog.warn("Received message_index is <= LAST_MESSAGEIDX_RECEIVED: " + JSON.stringify(message));
    return;
  }
  
  //handle normal case that the message we received is the next in order
  if(message['_message_index'] == LAST_MESSAGEIDX_RECEIVED + 1) {
    LAST_MESSAGEIDX_RECEIVED += 1;
    return handleMessage(eventID, category, message);
  }
  
  //otherwise, we have a forward gap
  $.jqlog.warn("feed:MESSAGE GAP DETECTED: our last msgidx = " + LAST_MESSAGEIDX_RECEIVED + " --  server sent msgidx = " + message['_message_index']);
  
  //sanity check
  assert(message['_message_index'] - LAST_MESSAGEIDX_RECEIVED <= 30, "Waay too many missing messages, IDX="
    + message['_message_index'] + " (last idx: " + LAST_MESSAGEIDX_RECEIVED + ")");

  //request the missing messages from the feed and replay them...
  var missingMessages = [];
  for(var i=LAST_MESSAGEIDX_RECEIVED+1; i < message['_message_index']; i++) {
    missingMessages.push(i);
  }
  
  failoverAPI("get_messagefeed_messages_by_index", [missingMessages], function(missingMessageData, endpoint) {
    var missingEventID = null;
    for(var i=0; i < missingMessageData.length; i++) {
      missingEventID = _getEventID(message);
      assert(missingMessageData[i]['_message_index'] == missingMessages[i], "Message feed resync list oddity...?");
      
      $.jqlog.info("feed:RECV GAP MESSAGE=" + missingMessageData[i]['_category'] + ", IDX=" + missingMessageData[i]['_message_index'] + " (last idx: "
        + LAST_MESSAGEIDX_RECEIVED + "), EVENTID=" + missingEventID + ", CONTENTS=" + JSON.stringify(missingMessageData[i]));

      handleMessage(missingEventID, missingMessageData[i]['_category'], missingMessageData[i]);
      
      assert(LAST_MESSAGEIDX_RECEIVED + 1 == missingMessageData[i]['_message_index'], "Message feed resync counter increment oddity...?");
      LAST_MESSAGEIDX_RECEIVED = missingMessageData[i]['_message_index']; 
    }
    //all caught up, call the callback for the original message itself
    handleMessage(eventID, category, message);
  });
}

function handleMessage(eventID, category, message) {
  //Detect a reorg and refresh the current page if so.
  if(message['_command'] == 'reorg') {
    //Don't need to adjust the message index
    $.jqlog.warn("feed:REORG DETECTED back to block: " + message['block_index']);
    checkURL(); //refresh the current page to regrab the fresh data
    //TODO/BUG??: do we need to "roll back" old messages on the bad chain???
    return;
  }
  
  //filter out non insert messages for now
  if(message['_command'] != 'insert')
    return;
    
  //remove any pending message from the pending actions pane (we do this before we filter out invalid messages
  // because we need to report on invalid messages)
  PENDING_ACTION_FEED.remove(eventID, category, message);

  //filter out any invalid messages for action processing itself
  assert(message['_status'].startsWith('valid')
    || message['_status'].startsWith('invalid')
    || message['_status'].startsWith('pending')
    || message['_status'].startsWith('completed')
    || message['_status'].startsWith('expired'));
  if(message['_status'].startsWith('invalid'))
    return; //ignore message
  if(message['_status'] == 'expired') {
    //ignore expired orders and bets, but we have order_expirations and bet_expiration inserts that we DO look at
    assert(category == "orders" || category == "bets", "Got an 'expired' message for a category of: " + category);
    return;
  }
  
  //notify the user in the notification pane
  NOTIFICATION_FEED.add(category, message);
  //^ especially with issuances, it's important that this line come before we modify state below
  
  //Have the action take effect (i.e. everything besides notifying the user in the notifcations pane, which was done above)
  if(category == "balances") {
    //DO NOTHING
  } else if(category == "credits" || category == "debits") {
    if(WALLET.getAddressObj(message['address'])) {
      //remove non-BTC/XCP asset objects that now have a zero balance from a debit
      if(message['_balance'] == 0 && message['asset'] != "BTC" && message['asset'] != "XCP") {
        assert(category == "debits"); //a credit to a balance of zero??
        var addressObj = WALLET.getAddressObj(message['address']);
        var assetObj = addressObj.getAssetObj(message['asset']);
        if(assetObj.isMine()) { //keep the asset object here, even if it has a zero balance
          WALLET.updateBalance(message['address'], message['asset'], message['_balance']);
        } else {
          addressObj.assets.remove(assetObj); //not owned by this address, with a zero balance?!? it's outta here
        }
      } else {
        WALLET.updateBalance(message['address'], message['asset'], message['_balance']);
      }
    }
  } else if(category == "broadcasts") {
    //TODO
  } else if(category == "btcpays") {
    WAITING_BTCPAY_FEED.remove(message['order_match_id']);
    //^ covers the case where make a BTC payment and log out before it is confirmed, then log back in and see it confirmed
  } else if(category == "burns") {
  } else if(category == "cancels") {
    if(WALLET.getAddressObj(message['source'])) {
      //If for an order (and we are on the DEx page), refresh the order book if the orders page is displayed
      // and if the cooresponding order is for one of the assets that is being displayed
      if (typeof BUY_SELL !== 'undefined') {
        BUY_SELL.openOrders.remove(function(item) { return item.tx_index == message['offer_hash']});
      } 
      //Also remove the canceled order from the open orders list
      // NOTE: this does not apply as a pending action because in order for us to issue a cancellation,
      // it would need to be confirmed on the blockchain in the first place
      OPEN_ORDER_FEED.remove(message['offer_hash']);
  
      //TODO: If for a bet, do nothing for now.
    }
  } else if(category == "callbacks") {
    //assets that are totally called back will be removed automatically when their
    // balance goes to zero, via the credit and debit handler
  } else if(category == "dividends") {
  } else if(category == "issuances") {
    var addressesWithAsset = WALLET.getAddressesWithAsset(message['asset']);
    for(var i=0; i < addressesWithAsset.length; i++) {
      WALLET.getAddressObj(addressesWithAsset[i]).addOrUpdateAsset(message['asset'], message, null);
    }
    //Also, if this is a new asset creation, or a transfer to an address that doesn't have the asset yet
    if(!addressesWithAsset.contains(message['issuer'])) {
      WALLET.getAddressObj(message['issuer']).addOrUpdateAsset(message['asset'], message, null);
    }
  } else if(category == "sends") {
    //the effects of a send are handled based on the credit and debit messages it creates, so nothing to do here
  } else if(category == "orders") {
    if(WALLET.getAddressObj(message['source'])) {
      //List the order in our open orders list (activities feed)
      OPEN_ORDER_FEED.add(message);
      //Also list the order on open orders if we're viewing the dex page
      /*if (typeof BUY_SELL !== 'undefined') {
        BUY_SELL.openOrders.push(message);
      }*/
    }
  } else if(category == "order_matches") {
    if(   (WALLET.getAddressObj(message['tx0_address']) && message['forward_asset'] == 'BTC')
       || (WALLET.getAddressObj(message['tx1_address']) && message['backward_asset'] == 'BTC')) {
      //If here, we got an order match where an address in our wallet owes BTC.
      // This being the case, we must settle up with a BTCPay
      var btcPayData = WaitingBTCPayFeedViewModel.makeBTCPayData(message);
      
      //If automatic BTC pays are enabled, just take care of the BTC pay right now
      if(PREFERENCES['auto_btcpay']) {
        if(WALLET.getBalance(btcPayData['myAddr'], 'BTC', false) >= (btcPayData['btcQuantityRaw']) + MIN_PRIME_BALANCE) {
          //user has the sufficient balance
          WALLET.doTransaction(btcPayData['myAddr'], "create_btcpay",
            { order_match_id: btcPayData['orderMatchID'] },
            function() {
              //notify the user of the automatic BTC payment
              bootbox.alert("Automatic <b class='notoAssetColor'>BTC</b> payment of "
                + "<b class='notoQuantityColor'>" + btcPayData['btcQuantity'] + "</b>"
                + " <b class='notoAssetColor'>BTC</b> made from address"
                + " <b class='notoAddrColor'>" + btcPayData['myAddr'] + "</b> for"
                + " <b class='notoQuantityColor'>" + btcPayData['otherOrderQuantity'] + "</b> "
                + " <b class='notoAssetColor'>" + btcPayData['otherOrderAsset'] + "</b>. " + ACTION_PENDING_NOTICE);
            }, function() {
              WAITING_BTCPAY_FEED.add(btcPayData);
              bootbox.alert("There was an error processing an automatic <b class='notoAssetColor'>BTC</b> payment."
                + " This payment has been placed in a pending state. Please try again manually.");
            }
          );
        } else {
          //The user doesn't have the necessary balance on the address... let them know and add the BTC as pending
          WAITING_BTCPAY_FEED.add(btcPayData);
          bootbox.alert("A payment on a matched order for "
            + "<b class='notoQuantityColor'>" + btcPayData['btcQuantity'] + "</b>"
            + "<b class='notoAssetColor'>BTC</b> is required, however, the address that made the order ("
            + "<b class='notoAddrColor'>" + getAddressLabel(btcPayData['myAddr']) + "</b>"
            + ") lacks the balance necessary to do this automatically. This order has been placed in a pending state."
            + "<br/><br/>Please deposit the necessary <b class='notoAssetColor'>BTC</b> into this address and"
            + "manually make the payment from the Bitcoin icon in the top bar of the site.");  
        }
      } else {
        //Otherwise, prompt the user to make the BTC pay
        var prompt = "An order match for <b class='notoQuantityColor'>" + btcPayData['otherOrderQuantity'] + "</b>"
          + " <b class='notoAssetColor'>" + btcPayData['otherOrderAsset'] + "</b> was successfully made. "
          + " To finalize, this requires payment of <b class='notoQuantityColor'>"+ btcPayData['btcQuantity'] + "</b>"
          + " <b class='notoAssetColor'>BTC</b>" + " from address"
          + " <b class='notoAddressColor'>" + getAddressLabel(btcPayData['myAddr']) + "</b>."
          + "<br/><br/><b>You must pay within 10 blocks time, or lose the purchase. Pay now?</b>";          
        bootbox.dialog({
          message: prompt,
          title: "Order Settlement (BTC Pay)",
          buttons: {
            success: {
              label: "No, hold off",
              className: "btn-danger",
              callback: function() {
                //If the user says no, then throw the BTC pay in pending BTC pays
                WAITING_BTCPAY_FEED.add(btcPayData);
              }
            },
            danger: {
              label: "Yes",
              className: "btn-success",
              callback: function() {
                WALLET.doTransaction(self.MY_ADDR, "create_btcpay",
                  { order_match_id: btcPayData['orderMatchID'] },
                  function() {
                    //notify the user of the automatic BTC payment
                    bootbox.alert("Automatic <b class='notoAssetColor'>BTC</b> payment of"
                      + " <b class='notoQuantityColor'>" + btcPayData['btcQuantity'] + "</b> <b class='notoAssetColor'>BTC</b>"
                      + " made from address <b class='notoAddressColor'>" + getAddressLabel(btcPayData['myAddr']) + "</b>"
                      + " for <b class='notoQuantityColor'>" + btcPayData['otherOrderQuantity'] + "</b>"
                      + " <b class='notoAssetColor'>" + btcPayData['otherOrderAsset'] + "</b>. " + ACTION_PENDING_NOTICE);
                  }, function() {
                    WAITING_BTCPAY_FEED.add(btcPayData);
                    bootbox.alert("There was an error processing an automatic <b class='notoAssetColor'>BTC</b> payment."
                      + "<br/><br/><b>Please manually make the payment from the Bitcoin icon in the top bar of the site.</b>");
                  }
                );
              }
            },
          }
        });    
      }
    } else if(WALLET.getAddressObj(message['tx0_address']) || WALLET.getAddressObj(message['tx1_address'])) {
      //If here, we got an order match for one of our addresses, but where no BTCpay is necessary from us

      //update the give/get remaining numbers in the open orders listing
      var match = ko.utils.arrayFirst(OPEN_ORDER_FEED.openOrders(), function(item) {
          return item.ORDER['tx_index'] == message['tx0_index'] || item.ORDER['tx_index'] == message['tx1_index'];
      });
      if(match && match.ORDER['tx_index'] == message['tx0_index']) {
        match.rawGiveRemaining(match.rawGiveRemaining() - message['forward_quantity']);
        match.rawGetRemaining(match.rawGetRemaining() - message['backward_quantity']);
      } else if(match) {
        assert(match.ORDER['tx_index'] == message['tx1_index']);
        match.rawGiveRemaining(match.rawGiveRemaining() - message['backward_quantity']);
        match.rawGetRemaining(match.rawGetRemaining() - message['forward_quantity']);
      }
      //no need to update for the buy/sell page's pending orders list as that is updated via synchronous data refresh
    }
  } else if(category == "order_expirations") {
    //Remove the order from the open orders list
    OPEN_ORDER_FEED.remove(message['order_hash']);
    WAITING_BTCPAY_FEED.remove(message['order_hash']); //just in case we had a BTC payment required for this order when it expired
  } else if(category == "order_match_expirations") {
    //Would happen if the user didn't make a BTC payment in time
    WAITING_BTCPAY_FEED.remove(message['order_match_id']);
    OPEN_ORDER_FEED.remove(message['order_match_id']); //just in case we had a BTC payment required for this order match when it expired
  } else if(category == "bets") {
    //TODO
  } else if(category == "bet_matches") {
    //TODO
  } else if(category == "bet_expirations") {
    //TODO
  } else if(category == "bet_match_expirations") {
    //TODO
  } else {
    $.jqlog.error("Unknown message category: " + category);
  }
}
