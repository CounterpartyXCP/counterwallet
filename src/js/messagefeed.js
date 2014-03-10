
var LAST_MESSAGEIDX_RECEIVED = 0; //last message received from the data feed (socket.io) -- used to detect gaps
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
        parseMessageWithFeedGapDetection(event, data, handleMessage);
      }
  });
}

function parseMessageWithFeedGapDetection(event, data, callback) {
  if(!data || (data.substring && data.startswith("<html>"))) return;
  //^ sometimes nginx can trigger this via its proxy handling it seems, with a blank payload (or a html 502 Bad Gateway
  // payload) -- especially if the backend server reloads. Just ignore it.
  $.jqlog.info("event:RECV EVENT=" + event + ", IDX=" + data['_message_index'] + " (last idx: " + LAST_MESSAGEIDX_RECEIVED + ") -- " + JSON.stringify(data));
  if((data['_message_index'] === undefined || data['_message_index'] === null) && IS_DEV) debugger; //it's an odd condition we should look into...
  assert(LAST_MESSAGEIDX_RECEIVED, "LAST_MESSAGEIDX_RECEIVED is not defined! Should have been set from is_ready on logon.");
  
  //Detect a reorg (reverse gap) and refresh the current page if so.
  if(data['_message_index'] <= LAST_MESSAGEIDX_RECEIVED) {
    // ...however, the block difference must be within 10 block difference, otherwise it's just bogus (buffering issue ,etc??)
    if(LAST_MESSAGEIDX_RECEIVED - data['_message_index'] <= 10) {
      $.jqlog.warn("event:REORG DETECTED: our last msgidx = " + LAST_MESSAGEIDX_RECEIVED + "; server send msgidx = " + data['_message_index']);
      LAST_MESSAGEIDX_RECEIVED = data['_message_index'];
      //^ the subsequent catch up messages after this should then go through without triggering this reorg logic again
      checkURL(); //refresh the current page to regrab the fresh data
      //TODO/BUG??: do we need to "roll back" old messages on the bad chain???
      return;
    } else {
      $.jqlog.warn("event:BOGUS (old) MESSAGE IGNORED: our last msgidx = " + LAST_MESSAGEIDX_RECEIVED + "; server send msgidx = " + data['_message_index']);
      return;
    }
  }
  
  //handle normal case that the message we received is the next in order
  if(data['_message_index'] == LAST_MESSAGEIDX_RECEIVED + 1) {
    return callback(event, data);
  }
  
  //otherwise, we have a forward gap
  $.jqlog.warn("event:GAP DETECTED: our last msgidx = " + LAST_MESSAGEIDX_RECEIVED + " --  server sent msgidx = " + data['_message_index']);

  //request the missing messages from the feed and replay them...
  if(IS_DEV) debugger; //temporary...
  var missingMessages = [];
  for(var i=LAST_MESSAGEIDX_RECEIVED+1; i < data['_message_index']; i++) {
    missingMessages.push(i);
  }
  
  failoverAPI("get_messages_by_index", [missingMessages], function(missingMessageData, endpoint) {
    var missingMessageEventData = null;
    for(var i=0; i < data.length; i++) {
      assert(missingMessageData['message_index'] == missingMessages[i], "Message feed resync list oddity...?");
      missingMessageEventData = $.parseJSON(data['bindings']);
      //Recreate what the siofeed@counterwalletd adds to the raw binding data
      missingMessageEventData['_message_index'] = missingMessageData['message_index'];
      missingMessageEventData['_block_index'] = missingMessageData['block_index'];
      missingMessageEventData['_block_time'] = missingMessageData['block_time'];
      missingMessageEventData['_command'] = missingMessageData['command'];
      handleMessage(missingMessageData['category'], missingMessageEventData);
      assert(LAST_MESSAGEIDX_RECEIVED + 1 == missingMessageData['message_index'], "Message feed resync counter increment oddity...?");
      LAST_MESSAGEIDX_RECEIVED = missingMessageData['message_index']; 
    }
    //all caught up, call the callback for the original message itself
    callback(event, data);
  });

    //    
    //This is the old code that has a more crude approach...
    //refresh all balances (just in case we missed a credit/debit)
    //WALLET.updateBalances();
    //refresh the current pane (to refresh anything on that pane -- just in case we missed some other kind of message)
    //checkURL();
}

function handleMessage(event, data) {
  if(event != "btcpays") //remove any pending message (btcpays have their own remove method)
    PENDING_ACTION_FEED.removePendingAction(event, data);
  
  if(event == "balances") {
  } else if(event == "credits") {
    if(WALLET.getAddressObj(data['address'])) {
      WALLET.updateBalance(data['address'], data['asset'], data['balance']);
      NOTIFICATION_FEED.add(event, "Credit to <b>" + data['address'] + "</b> of <b>" + data['_amount_normalized'] + " "
        + data['asset'] + "</b>. New " + data['asset'] + " balance is <b>" +  data['_balance_normalized'] + "</b>.");
    }
  } else if(event == "debits") {
    if(WALLET.getAddressObj(data['address'])) {
      WALLET.updateBalance(data['address'], data['asset'], data['balance']);
      NOTIFICATION_FEED.add(event, "Debit from <b>" + data['address'] + "</b> of <b>" + data['_amount_normalized'] + " "
        + data['asset'] + "</b>. New " + data['asset'] + " balance is <b>" +  data['_balance_normalized'] + "</b>.");
    }
  } else if(event == "broadcasts") {
    //TODO
  } else if(event == "btcpays") {
    //Remove the BTCpay if the ordermatch is one of the ones in our pending list
    PENDING_ACTION_FEED.removePendingBTCPay(data['order_match_id']);
  } else if(event == "burns") {
    if(WALLET.getAddressObj(data['source'])) {
      NOTIFICATION_FEED.add(event, "Your address " + data['source'] + " has burned "
        + normalizeAmount(data['burned'], true) + " BTC for " + normalizeAmount(data['earned'], true) + " XCP.");
    }
  } else if(event == "cancels") {
    if(WALLET.getAddressObj(data['source'])) {
      //If for an order (and we are on the DEx page), refresh the order book if the orders page is displayed
      // and if the cooresponding order is for one of the assets that is being displayed
      if (typeof BUY_SELL !== 'undefined') {
        BUY_SELL.openOrders.remove(function(item) { return item.tx_index == data['offer_hash']});
      } 
      //Also remove the canceled order from the open orders and pending orders list (if present)
      OPEN_ORDER_FEED.remove(data['offer_hash']);
      PENDING_ACTION_FEED.removePendingBTCPayByOrderID(data['offer_hash']);
  
      //TODO: If for a bet, do nothing for now.

      NOTIFICATION_FEED.add(event, "Order/Bid " + data['offer_hash'] + " for your address " + data['source'] + " was cancelled.");
    }
  } else if(event == "callbacks") {
    //See if any of our addresses own any of the specified asset, and if so, notify them of the callback
    // NOTE that counterpartyd has automatically already adusted the balances of all asset holders...we just need to notify
    var addresses = WALLET.getAddressesList();
    for(var i=0; i < addresses.length; i++) {
      if(WALLET.getBalance(addresses[i], data['asset'])) {
        NOTIFICATION_FEED.add(event, data['asset'] + " balance adjusted on your address " + addresses[i]
          + " due to " + (parseFloat(data['fraction']) * 100).toString() + "% callback option being exercised.");
      }
    }
  } else if(event == "dividends") {
    //Similar approach as to callbacks above...
    var addresses = WALLET.getAddressesList();
    for(var i=0; i < addresses.length; i++) {
      if(WALLET.getBalance(addresses[i], data['asset'])) {
        NOTIFICATION_FEED.add(event, data['asset'] + " balance adjusted on your address " + addresses[i]
          + " due to " + numberWithCommas(normalizeAmount(data['amount_per_unit'], data['_divisible'])) + " unit dividend payment.");
      }
    }
  } else if(event == "issuances") {
    //See if the issuer matches any of our addresses
    var address = WALLET.getAddressObj(data['issuer']);
    if(!address) return;
    
    //get info on the asset to determine if it's locked or not
    failoverAPI("get_asset_info", [data['asset']], function(data, endpoint) {
      assert(data['owner'] == address.ADDRESS);
      address.addOrUpdateAsset(data['asset'], data['amount']);
    });
  } else if(event == "sends") {
    if(WALLET.getAddressObj(data['source'])) { //we sent funds
        NOTIFICATION_FEED.add(event, "You successfully sent <b>"
          + numberWithCommas(normalizeAmount(data['amount'], data['_divisible'])) + " " + data['asset']
          + "</b> from your address " + data['source'] + " to address " + data['destination']);
    }
    if(WALLET.getAddressObj(data['destination'])) { //we received funds
        NOTIFICATION_FEED.add(event, "You successfully received <b>"
          + numberWithCommas(normalizeAmount(data['amount'], data['_divisible'])) + " " + data['asset']
          + "</b> from address " + data['source'] + " to your address " + data['destination']);
    }
  } else if(event == "orders") {
    if(WALLET.getAddressObj(data['source'])) {
      //List the order in our open orders list (activities feed)
      OPEN_ORDER_FEED.add(data);
      //Also list the order on open orders if we're viewing the dex page
      if (typeof BUY_SELL !== 'undefined') {
        BUY_SELL.openOrders.push(order);
      }
      
      //Notify the user 
      NOTIFICATION_FEED.add(event, "Your order to buy " + numberWithCommas(normalizeAmount(data['get_amount'], data['_get_asset_divisible']))
        + " " + data['get_asset'] + " in exchange for " + numberWithCommas(normalizeAmount(data['give_amount'], data['_give_asset_divisible']))
        + " " + data['get_asset'] + " was successfully created.");
    }
  } else if(event == "order_matches") {
    //Determine if the match is one where one of our addresses owes BTC, and if so perform an automatic BTCPay
    if(WALLET.getAddressObj(data['tx0_address']) && data['forward_asset'] == 'BTC') {
      
    }
    if(WALLET.getAddressObj(data['tx1_address']) && data['backward_asset'] == 'BTC') {
      
    }
    //If for some reason we can't perform a BTCpay, alert the user and throw the entry on the "Pending Orders" list in the activity feed
  } else if(event == "order_expirations") {
    //Remove the order from the open orders list and pending orders list, if on either
    OPEN_ORDER_FEED.remove(data['order_hash']);
    PENDING_ACTION_FEED.removePendingBTCPayByOrderID(data['order_hash']);
    //Also, notify the user of the expiration
    if(WALLET.getAddressObj(data['source'])) {
      NOTIFICATION_FEED.add(event, "Your order <b>"
        + data['order_hash'] + " from address " + data['source'] + " has expired.");
    }
  } else if(event == "order_match_expirations") {
    //Notify the user
    if(WALLET.getAddressObj(data['tx0_address'])) {
      NOTIFICATION_FEED.add(event, "An order match between your address <b>"
        + data['tx0_address'] + " and address <b>" + data['tx1_address'] + "</b> has expired.");
    } 
    if(WALLET.getAddressObj(data['tx1_address'])) {
      NOTIFICATION_FEED.add(event, "An order match between your address <b>"
        + data['tx1_address'] + " and address <b>" + data['tx0_address'] + "</b> has expired.");
    } 
  } else if(event == "bets") {
    //TODO
  } else if(event == "bet_matches") {
    //TODO
  } else if(event == "bet_expirations") {
    //TODO
  } else if(event == "bet_match_expirations") {
    //TODO
  } else {
    $.jqlog.error("Unknown event: " + event);
  }
}
