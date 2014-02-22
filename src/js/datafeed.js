
var LAST_MESSAGEIDX_RECEIVED = 0; //last message received from the data feed (socket.io) -- used to detect gaps
var FAILOVER_CURRENT_IDX = 0; //last idx in the counterwalletd_feed_urls tried (used for socket.io failover)

//Create a wildcard event handler: http://stackoverflow.com/a/19121009
var original_$emit = socket.$emit;
socket.$emit = function() {
    var args = Array.prototype.slice.call(arguments);
    original_$emit.apply(socket, ['*'].concat(args));
    if(!original_$emit.apply(socket, arguments)) {
        original_$emit.apply(socket, ['default'].concat(args));
    }
}

function tryNextSIOServer() {
  if(FAILOVER_LAST_IDX_TRIED + 1 == counterwalletd_feed_urls.length) {
    FAILOVER_CURRENT_IDX = 0;
  } else {
    FAILOVER_CURRENT_IDX += 1;
  }
  $.jqlog.log('socket.io: Trying next server: ' + url[FAILOVER_CURRENT_IDX]);
  
}

function initMessageFeed(url) {
  //set up a connection to the server event feed via socket.io and handle messages
  var url = counterwalletd_feed_urls[FAILOVER_CURRENT_IDX];
  var socket = io.connect(url, {
    'connect timeout': 5000,
    'reconnect': true,
    'reconnection delay': 500,
    'reopen delay': 500,
    'max reconnection attempts': 4
    //'force new connection': true
  });
  
  socket.on('default',function(event, data) {
      $.jqlog.log('socket.io event not trapped: ' + event + ' - data:' + JSON.stringify(data));
  });
  
  socket.on('*',function(event, data) {
      $.jqlog.log('socket.io event received: ' + event + ' - data:' + JSON.stringify(data));
      if(event == 'connect') {
        $.jqlog.log('socket.io: Connected to server: ' + url);
      } else if(event == 'disconnect') {
        $.jqlog.log('socket.io: The client has disconnected from server: ' + url);
      } else if(event == 'connect_failed') {
        $.jqlog.log('socket.io: Connection to server failed: ' + url);
        io.disconnect();
        tryNextSIOServer();
      } else if(event == 'reconnect_failed') {
        $.jqlog.log('socket.io: Reconnect to the server failed: ' + url);
        io.disconnect();
        tryNextSIOServer();
      } else if(['connect_error', 'connect_timeout', 'reconnect', 'reconnect_error'].indexOf(event) >= 0) {
        //these events currently not handled
      } else{
        return parseMessage(event, data);  
      }
  });
}

function parseMessage(event, data, detectMessagesGap) {
  if(typeof(detectMessagesGap)==='undefined') detectMessagesGap = true;
  if(detectMessagesGap) {
    detectMessageFeedGap(event, data, handleMessage);
  } else {
    handleMessage(event, data);
  }
}
  
function handleMessage(event, data) {
  $.jqlog.log("HANDLING event " + data['_message_index'] + ":" + event + ": " + JSON.stringify(data));
  
  if(event == "balances") {
  } else if(event == "credits") {
    if(WALLET.getAddressObj(data['address'])) {
      WALLET.updateBalance(data['address'], data['asset'], data['balance']);
      ACTIVITY_FEED.addNotification(event, "Credit to <b>" + data['address'] + "</b> of <b>" + data['_amount_normalized'] + " "
        + data['asset'] + "</b>. New " + data['asset'] + " balance is <b>" +  data['_balance_normalized'] + "</b>.");
    }
  } else if(event == "debits") {
    if(WALLET.getAddressObj(data['address'])) {
      WALLET.updateBalance(data['address'], data['asset'], data['balance']);
      ACTIVITY_FEED.addNotification(event, "Debit from <b>" + data['address'] + "</b> of <b>" + data['_amount_normalized'] + " "
        + data['asset'] + "</b>. New " + data['asset'] + " balance is <b>" +  data['_balance_normalized'] + "</b>.");
    }
  } else if(event == "broadcasts") {
    //TODO
  } else if(event == "btcpays") {
    //Remove the BTCpay if the ordermatch is one of the ones in our pending list
    ACTIVITY_FEED.removePendingBTCPay(data['order_match_id']);
  } else if(event == "burns") {
    if(WALLET.getAddressObj(data['source'])) {
      ACTIVITY_FEED.addNotification(event, "Your address " + data['source'] + " has burned "
        + normalizeAmount(data['burned'], true) + " BTC for " + normalizeAmount(data['earned'], true) + " XCP.");
    }
  } else if(event == "cancels") {
    //If for an order, refresh the order book if the orders page is displayed and if the cooresponding
    // order is for one of the assets that is being displayed
    data['source']
    
    //TODO: If for a bet, do nothing for now.
    
    ACTIVITY_FEED.addNotification(event, "Your address .");
  } else if(event == "callbacks") {
  } else if(event == "dividends") {
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
  } else if(event == "orders") {
  } else if(event == "order_matches") {
  } else if(event == "order_expirations") {
    //HANDLE IN THE FUTURE
  } else if(event == "order_match_expirations") {
    //HANDLE IN THE FUTURE
  } else if(event == "bets") {
  } else if(event == "bet_matches") {
  } else if(event == "bet_expirations") {
  } else if(event == "bet_match_expirations") {
  } else {
    $.jqlog.error("Unknown event: " + event);
  }
}

function detectMessageFeedGap(event, data, callback) {
  assert(data['_message_index'] >= LAST_MESSAGEIDX_RECEIVED);
  
  if(   LAST_MESSAGEIDX_RECEIVED == 0 //first message received
     || data['_message_index'] == LAST_MESSAGEIDX_RECEIVED + 1) { //next sequential message received 
    LAST_MESSAGEIDX_RECEIVED = data['_message_index'];
    return;
  }
  
  //otherwise, we have a gap
  $.jqlog.warn("event:GAP DETECTED: our last msgidx = " + LAST_MESSAGEIDX_RECEIVED + "; server send msgidx = " + data['_message_index']);

  //request the missing messages from the feed and replay them...
  var missingMessages = [];
  for(var i=LAST_MESSAGEIDX_RECEIVED+1; i > data['_message_index']; i++) {
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
      parseMessage(missingMessageData['category'], missingMessageEventData, false);
      assert(LAST_MESSAGEIDX_RECEIVED + 1 == missingMessageData['message_index'], "Message feed resync counter increment oddity...?");
      LAST_MESSAGEIDX_RECEIVED = missingMessageData['message_index']; 
    }
    //all caught up, call the callback for the original message itself
    return callback(event, data);
  });

    //    
    //This is the old code that has a more crude approach...
    //refresh all balances (just in case we missed a credit/debit)
    //WALLET.updateBalances();
    //refresh the current pane (to refresh anything on that pane -- just in case we missed some other kind of message)
    //checkURL();
}
