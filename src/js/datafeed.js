
function initDataFeed() {
  //set up a connection to the server event feed via socket.io and handle messages
  var url = counterwalletd_socketio_urls[0]; //temp
  var socket = io.connect(url);
  
  socket.on('connect', function() {
    $.jqlog.log('socket.io: Connected to server ' + url);
  });
  socket.on('disconnect', function() {
    $.jqlog.log('The client has disconnected from server ' + url);
  });
  socket.on('message', function(rawmsg) {
    $.jqlog.log('socket.io: GOT MESSAGE -- ' + rawmsg);
    var msg = $.parseJSON(rawmsg);
    
    if(msg._TYPE == 'credit') {
      onCredit(msg.address, msg.asset, msg.amount, msg.balance);
    } else if (data._TYPE == 'debit') {
      onDebit(msg.address, msg.asset, msg.amount, msg.balance);
    } else {
      $.jqlog.warn("socket.io: EVENT UNKNOWN -- " +  JSON.stringify(msg));
    }
  });
  
  socket.on('credit', function (data) {
    $.jqlog.log("event:credit: " + JSON.stringify(data));
    //Might be one of our addresses. Update balance if it is...
    WALLET.updateBalance(data['address'], data['asset'], data['balance']);
  });

  socket.on('debit', function (data) {
    $.jqlog.log("event:debit: " + JSON.stringify(data));
    //Might be one of our addresses. Update balance if it is...
    WALLET.updateBalance(data['address'], data['asset'], data['balance']);
  });

  socket.on('new_bet', function (data) {
    $.jqlog.log("event:new_bet: " + JSON.stringify(data));
  });

  socket.on('new_broadcast', function (data) {
    $.jqlog.log("event:new_broadcast: " + JSON.stringify(data));
  });

  socket.on('new_btcpay', function (data) {
    $.jqlog.log("event:new_btcpay: " + JSON.stringify(data));
  });

  socket.on('new_burn', function (data) {
    $.jqlog.log("event:new_burn: " + JSON.stringify(data));
  });

  socket.on('new_cancel', function (data) {
    $.jqlog.log("event:new_cancel: " + JSON.stringify(data));
  });

  socket.on('new_dividend', function (data) {
    $.jqlog.log("event:new_dividend: " + JSON.stringify(data));
  });

  socket.on('new_issuance', function (data) {
    $.jqlog.log("event:new_issuance: " + JSON.stringify(data));
    //See if the issuer matches any of our addresses
    var address = WALLET.getAddressObj(data['issuer']);
    if(!address) return;
    address.assets.push(new AssetViewModel(address.ADDRESS, data['asset'], data['divisible'], true, data['amount']));
  });

  socket.on('new_order', function (data) {
    $.jqlog.log("event:new_order: " + JSON.stringify(data));
  });

  socket.on('new_send', function (data) {
    $.jqlog.log("event:new_send: " + JSON.stringify(data));
  });
}
