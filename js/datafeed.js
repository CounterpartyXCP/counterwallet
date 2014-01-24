
function onCredit(address, asset, amount, balance) {
  $.jqlog.log("event: onCredit", {'address': address, 'asset': asset, 'amount': amount, 'balance': balance});
  
  //Might be one of our addresses. Update balance if it is...
  WALLET.updateBalance(address, asset, balance);
}

function onDebit(address, asset, amount, balance) {
  $.jqlog.log("event: onDebit", {'address': address, 'asset': asset, 'amount': amount, 'balance': balance});

  //Might be one of our addresses. Update balance if it is...
  WALLET.updateBalance(address, asset, balance);
}

function initDataFeed() {
  //set up a connection to the server event feed via socket.io and handle messages
  var url = counterwalletd_socketio_urls[0];
  var socket = io(url[0]);
  
  socket.on('connect', function() {
    $.jqlog.log('socket.io: Connected to server ' + url);
  });
  socket.on('disconnect', function() {
    $.jqlog.log('The client has disconnected from server ' + url);
  });
  socket.on('message', function(rawmsg) {
    $.jqlog.log('socket.io: GOT MESSAGE: ' + rawmsg);
    var msg = $.parseJSON(rawmsg);
    
    if(msg._TYPE == 'credit') {
      onCredit(msg.address, msg.asset, msg.amount, msg.balance);
    } else if (data._TYPE == 'debit') {
      onDebit(msg.address, msg.asset, msg.amount, msg.balance);
    } else {
      $.jqlog.warn("event: UNKNOWN", msg);
    }
  });
}
