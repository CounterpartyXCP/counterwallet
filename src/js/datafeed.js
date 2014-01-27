
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
    $.jqlog.log("event: onCredit: " + JSON.stringify(data));
    
    //Might be one of our addresses. Update balance if it is...
    WALLET.updateBalance(data['address'], data['asset'], data['balance']);
  });
  socket.on('debit', function (data) {
    $.jqlog.log("event: onDebit" + JSON.stringify(data));
  
    //Might be one of our addresses. Update balance if it is...
    WALLET.updateBalance(data['address'], data['asset'], data['balance']);
  });
}
