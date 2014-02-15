
function detectMessagesGap(message) {
  assert(message['message_index'] >= LAST_MESSAGEIDX_RECEIVED);
  if(   LAST_MESSAGEIDX_RECEIVED == 0 //first message received
     || message['message_index'] == LAST_MESSAGEIDX_RECEIVED + 1) { //next sequential message received 
    LAST_MESSAGEIDX_RECEIVED = message['message_index'];
    return;
  } else { //gap
    $.jqlog.warn("event:GAP DETECTED: our last msgidx = " + LAST_MESSAGEIDX_RECEIVED + "; server send msgidx = " + message['message_index']);
    
    //refresh all balances (just in case we missed a credit/debit)
    WALLET.updateBalances();
    
    //refresh the current pane (to refresh anything on that pane -- just in case we missed some other kind of message)
    checkURL();
    
    //TODO: in the future, we may want to instead retrieve the missed messages and replay them...but that would require
    // a different structure to this datafeed file in order to avoid code duplication 
  }
}


function initDataFeed() {
  //set up a connection to the server event feed via socket.io and handle messages
  var url = counterwalletd_feed_urls[0];
  var socket = io.connect(url);
  
  socket.on('connect', function() {
    $.jqlog.log('socket.io: Connected to server ' + url);
  });
  socket.on('disconnect', function() {
    $.jqlog.log('The client has disconnected from server ' + url);
  });
  
  socket.on('credit', function (data) {
    detectMessagesGap(message);
    $.jqlog.log("event:credit: " + JSON.stringify(data));
    //Might be one of our addresses. Update balance if it is...
    WALLET.updateBalance(data['address'], data['asset'], data['balance']);
  });

  socket.on('debit', function (data) {
    detectMessagesGap(message);
    $.jqlog.log("event:debit: " + JSON.stringify(data));
    //Might be one of our addresses. Update balance if it is...
    WALLET.updateBalance(data['address'], data['asset'], data['balance']);
  });

  socket.on('bet', function (data) {
    detectMessagesGap(message);
    $.jqlog.log("event:bet: " + JSON.stringify(data));
  });

  socket.on('broadcast', function (data) {
    detectMessagesGap(message);
    $.jqlog.log("event:broadcast: " + JSON.stringify(data));
  });

  socket.on('btcpay', function (data) {
    detectMessagesGap(message);
    $.jqlog.log("event:btcpay: " + JSON.stringify(data));
  });

  socket.on('burn', function (data) { //burns can still happen on testnet
    detectMessagesGap(message);
    $.jqlog.log("event:burn: " + JSON.stringify(data));
  });

  socket.on('cancel', function (data) {
    detectMessagesGap(message);
    $.jqlog.log("event:cancel: " + JSON.stringify(data));
  });

  socket.on('dividend', function (data) {
    detectMessagesGap(message);
    $.jqlog.log("event:dividend: " + JSON.stringify(data));
  });

  socket.on('issuance', function (data) {
    detectMessagesGap(message);
    $.jqlog.log("event:issuance: " + JSON.stringify(data));
    //See if the issuer matches any of our addresses
    var address = WALLET.getAddressObj(data['issuer']);
    if(!address) return;
    
    //get info on the asset to determine if it's locked or not
    failoverAPI("get_asset_info", [data['asset']], function(data, endpoint) {
      assert(data['owner'] == address.ADDRESS);
      address.addOrUpdateAsset(data['asset'], data['amount']);
    });
  });

  socket.on('order', function (data) {
    detectMessagesGap(message);
    $.jqlog.log("event:order: " + JSON.stringify(data));
  });

  socket.on('send', function (data) {
    detectMessagesGap(message);
    $.jqlog.log("event:send: " + JSON.stringify(data));
  });
}
