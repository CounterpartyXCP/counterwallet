
function MessageFeed() {
  var self = this;
  self.lastMessageIndexReceived = ko.observable(0); //last message received from the message feed (socket.io) -- used to detect gaps
  self.failoverCurrentIndex = ko.observable(0); //last idx in the cwBaseURLs tried (used for socket.io failover)
  self.MESSAGE_QUEUE = [];
  
  self.tryNextSIOMessageFeed = function() {
    if(self.failoverCurrentIndex() + 1 == cwBaseURLs().length) {
      self.failoverCurrentIndex(0);
    } else {
      self.failoverCurrentIndex(self.failoverCurrentIndex() + 1);
    }
    $.jqlog.log('socket.io: Trying next server: ' + cwBaseURLs()[self.failoverCurrentIndex()]);
    self.init(self.lastMessageIndexReceived());
  }
  
  self.init = function(last_message_index) {
    self.lastMessageIndexReceived(last_message_index);
    //set up a connection to the server event feed via socket.io and handle messages
    var url = cwBaseURLs()[self.failoverCurrentIndex()];
    $.jqlog.log("socket.io(messages): Connecting to: " + url);
    //https://github.com/LearnBoost/Socket.IO/wiki/Configuring-Socket.IO
    var socket = io.connect(url, {
      'connect timeout': 5000,
      'reconnect': true,
      'reconnection delay': 500,
      'reconnection limit': 10000,
      'max reconnection attempts': 5,
      'force new connection': true,
      'try multiple transports': false,
      //'transports': ['websocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling'],
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
    socket.on('default',function(event, data) {
        $.jqlog.log('socket.io event not trapped: ' + event + ' - data:' + JSON.stringify(data));
    });
    socket.on('*',function(event, data) {
        $.jqlog.log('socket.io message received: ' + event + ' - data:' + JSON.stringify(data));
        if(event == 'connect') {
          $.jqlog.log('socket.io(messages): Connected to server: ' + url);
          socket.emit("subscribe"); //subscribe to the data feed itself
        } else if(event == 'disconnect') {
          $.jqlog.warn('socket.io(messages): The client has disconnected from server: ' + url);
        } else if(event == 'connect_failed') {
          $.jqlog.warn('socket.io(messages): Connection to server failed: ' + url);
          socket.disconnect();
          self.tryNextSIOMessageFeed();
        } else if(event == 'reconnect_failed') {
          $.jqlog.warn('socket.io(messages): Reconnect to the server failed: ' + url);
          socket.disconnect();
          self.tryNextSIOMessageFeed();
        } else if(event == 'error') {
          $.jqlog.warn('socket.io(messages): Received an error: ' + url);
        } else if(['connecting', 'connect_error', 'connect_timeout', 'reconnect', 'reconnecting', 'reconnect_error'].indexOf(event) >= 0) {
          //these events currently not handled
        } else{
          assert(data['_category'] !== undefined && event == data['_category'], "Message feed message lacks category field!");
          var txHash = self.getTxHash(data);
          self.MESSAGE_QUEUE.push([txHash, event, data]);
        }
    });
    
    //Start the message queue reading process (we don't just call the message parsing machinery directly due and use a
    // producer/consumer queue pattern as this method allows us to effectively handle message gaps (i.e. just push them
    // on the head of the queue and just keep running through the queue))
    self.checkMessageQueue();
  }
  
  self.getTxHash = function(message) {
    var txHash = message['event'] || message['tx_hash'] || (message['tx0_hash'] + message['tx1_hash']) || null;
    if(!txHash)
      $.jqlog.warn("Cannot derive a txHash for IDX " + message['_message_index'] + " (category: " + message['_category'] + ")");
    return txHash;
  }
  
  self.checkMessageQueue = function() {
    var event = null, result = null;
    while(self.MESSAGE_QUEUE.length) {
      event = self.MESSAGE_QUEUE[0];
      result = self.parseMessageWithFeedGapDetection(event[0], event[1], event[2]);
      if(result && result.hasOwnProperty('done')) {
        break; //deferred returned, as there were missing messages. abort processing until we have them
      }
      self.MESSAGE_QUEUE.shift(); //normal case. pop off the head and continue processing...
    }
    
    if(result && result.hasOwnProperty('done')) {
      //a gap was found. wait until we get in the missing messages. then call again (as those missing msgs should be at the top of the queue)
      $.when(result).done(function(d) {
        self.checkMessageQueue();
      });
    } else { //normal case: no gaps. call again in 1 second
      setTimeout(function() { self.checkMessageQueue(); }, 1000);
    }
  }
  
  self.parseMessageWithFeedGapDetection = function(txHash, category, message) {
    if(!message || (message.substring && message.startswith("<html>"))) return;
    //^ sometimes nginx can trigger this via its proxy handling it seems, with a blank payload (or a html 502 Bad Gateway
    // payload) -- especially if the backend server reloads. Just ignore it.
    assert(self.lastMessageIndexReceived(), "lastMessageIndexReceived is not defined!");
  
    $.jqlog.info("feed:receive IDX=" + message['_message_index']);
  
    //Ignore old messages if they are ever thrown at us
    if(message['_message_index'] <= self.lastMessageIndexReceived()) {
      $.jqlog.warn("Received message_index is <= lastMessageIndexReceived: " + JSON.stringify(message));
      return;
    }
    
    //handle normal case that the message we received is the next in order
    if(message['_message_index'] == self.lastMessageIndexReceived() + 1) {
      self.handleMessage(txHash, category, message);
      return;
    }
    
    //otherwise, we have a forward gap
    $.jqlog.warn("feed:MESSAGE GAP DETECTED: our last msgidx = " + self.lastMessageIndexReceived() + " --  server sent msgidx = " + message['_message_index']);
    
    //sanity check
    assert(message['_message_index'] - self.lastMessageIndexReceived() <= 30, "Way too many missing messages, IDX="
      + message['_message_index'] + " (last idx: " + self.lastMessageIndexReceived() + ")");
  
    //request the missing messages from the feed and replay them...
    var deferred = $.Deferred();
    var missingMessageIndexes = [];
    var missingMessageQueueEntries = [];
    for(var i=self.lastMessageIndexReceived()+1; i < message['_message_index']; i++) {
      missingMessageIndexes.push(i);
    }
    failoverAPI("get_messagefeed_messages_by_index", [missingMessageIndexes], function(missingMessageData, endpoint) {
      var missingTxHash = null;
      for(var i=0; i < missingMessageData.length; i++) {
        missingTxHash = self.getTxHash(missingMessageData[i]);
        assert(missingMessageData[i]['_message_index'] == missingMessageIndexes[i], "Message feed resync list oddity...?");
        $.jqlog.info("feed:receiveForGap IDX=" + missingMessageData[i]['_message_index']);
        missingMessageQueueEntries.push([missingTxHash, missingMessageData[i]['_category'], missingMessageData[i]]);
      }
      Array.prototype.splice.apply(self.MESSAGE_QUEUE, [0, 0].concat(missingMessageQueueEntries));
      //^ throw at the head of the message queue, in the same order
      deferred.resolve();
    });
    //this deferred will be resolved once we have successfully retrieved the missing messages
    //(the subsequent call to the function will process the missing messages, as well as what was already in the message queue)
    return deferred;
  }
  
  self.handleMessage = function(txHash, category, message) {
    assert(self.lastMessageIndexReceived() + 1 == message['_message_index'], "Message feed resync counter increment oddity...?");
  
    $.jqlog.info("feed:PROCESS MESSAGE=" + category + ", IDX=" + message['_message_index'] + " (last idx: "
      + self.lastMessageIndexReceived() + "), TX_HASH=" + txHash + ", CONTENTS=" + JSON.stringify(message));
  
    self.lastMessageIndexReceived(self.lastMessageIndexReceived() + 1);
      
    //Detect a reorg and refresh the current page if so.
    if(message['_command'] == 'reorg') {
      //Don't need to adjust the message index
      self.lastMessageIndexReceived(message['_last_message_index']);
      $.jqlog.warn("feed:Blockchain reorganization at block " + message['block_index']
        + "; last message idx reset to " + self.lastMessageIndexReceived());
      setTimeout(function() { WALLET.refreshCounterpartyBalances(WALLET.getAddressesList(), checkURL); }, randomIntFromInterval(1, 5) * 1000);
      //^ refresh the current page to regrab the fresh data (give cwd a second to sync up though)
      // also, wait a random interval to do this between 1 and 5 seconds, to avoid dog-piling the server
      //TODO/BUG??: do we need to "roll back" old messages on the bad chain???
      return;
    }

    //increment stored networkBlockHeight off of the feed, if possible (allows us to more quickly update this then
    // just relying on 5 minute polling for new BTC balances)
    if(message['block_index'])
      WALLET.networkBlockHeight(message['block_index']);
      
    //filter out non insert messages for now, EXCEPT for order messages (so that we get notified when the remaining qty, etc decrease)
    if(message['_command'] != 'insert' && category != "orders")
      return;

    //If we received an action originating from an address in our wallet that was marked invalid by the network, let the user know
    // (do this even in cases where the entry does not exist in pendingActions, as the user could have logged out and back in)
    if(message['_status'] && message['_status'].startsWith('invalid') && WALLET.getAddressObj(message['source'])) {
      var actionText = PendingActionViewModel.calcText(category, message); //nice "good enough" shortcut method here
      bootbox.alert("<b class='errorColor'>Network processing of the following action failed:</b><br/><br/>"
        + actionText + "<br/><br/><b>Reason:</b> " + message['_status']);
    }

    //Insert the message into the stats page (if it has been initialized)
    if(window.hasOwnProperty('STATS_TXN_HISTORY')) {
      window.STATS_TXN_HISTORY.addMessage(message);
    }
      
    //remove any pending message from the pending actions pane (we do this before we filter out invalid messages
    // because we need to be able to remove a pending action that was marked invalid as well)
    PENDING_ACTION_FEED.remove(txHash, category);
  
    //filter out any invalid messages for action processing itself
    assert(message['_status'].startsWith('valid')
      || message['_status'].startsWith('invalid')
      || message['_status'].startsWith('pending') //order matches for BTC
      || message['_status'].startsWith('open') //orders and bets
      || message['_status'].startsWith('cancelled') //orders and bets
      || message['_status'].startsWith('completed') //order match (non-BTC, or BTC match where BTCPay has been made)
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
          assert(category == "debits"); //a credit to a balance of zero?? Yes with unconfirmed balance>0
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
        //Remove the canceled order from the open orders list
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
      if(WALLET.getAddressObj(message['issuer']) && addressesWithAsset.length && !(addressesWithAsset.indexOf(message['issuer']) != -1)) {
        failoverAPI("get_asset_info", [[message['asset']]], function(assetsInfo, endpoint) {
          WALLET.getAddressObj(message['issuer']).addOrUpdateAsset(message['asset'], assetsInfo[0], null); //will show with a 0 balance
        });    
      }
    } else if(category == "sends") {
      //the effects of a send are handled based on the credit and debit messages it creates, so nothing to do here
    } else if(category == "orders") {
      if(message['_btc_below_dust_limit'])
        return; //ignore any order involving BTC below the dust limit
      
      //valid order statuses: open, filled, invalid, cancelled, and expired
      //update the give/get remaining numbers in the open orders listing, if it already exists
      var match = ko.utils.arrayFirst(OPEN_ORDER_FEED.entries(), function(item) {
          return item.TX_HASH == message['tx_hash'];
      });
      if(match) {
        if(message['_status'] != 'open') { //order is filled, expired, or cancelled, remove it from the listing
          OPEN_ORDER_FEED.remove(message['tx_hash']);
        } else { //order is still open, but the quantities are updating
          match.rawGiveRemaining(message['give_quantity_remaining']);
          match.rawGetRemaining(message['get_quantity_remaining']);
          
          //if the order is for BTC and the qty remaining on either side is negative (but not on BOTH sides,
          // as it would be fully satified then and canceling would be pointless), auto cancel the order
          if(   (match.GET_ASSET == 'BTC' || match.GIVE_ASSET == 'BTC')
             && (match.rawGiveRemaining() <= 0 || match.rawGetRemaining() <= 0)
             && !(match.rawGiveRemaining() <= 0 && match.rawGetRemaining() <= 0)) {
            $.jqlog.debug("Auto cancelling BTC order " + match.TX_HASH
              + " as the give_remaining xor get_remaining <= 0 ...");
            WALLET.doTransaction(match.SOURCE, "create_cancel", {
              offer_hash: match.TX_HASH,
              source: match.SOURCE,
              _type: 'order',
              _tx_index: match.TX_INDEX
            });
          }
        }
      } else if(WALLET.getAddressObj(message['source'])) {
        //order is not in the open orders listing, but should be
        OPEN_ORDER_FEED.add(message);
      }
    } else if(category == "order_matches") {
      if(message['_btc_below_dust_limit'])
        return; //ignore any order match involving BTC below the dust limit
      
      //Look to order matches when determining to do a BTCpay
      //If the order_matches message doesn't have a tx0_address/tx1_address field, then we don't need to do anything with it
      if(   (WALLET.getAddressObj(message['tx0_address']) && message['forward_asset'] == 'BTC' && message['_status'] == 'pending')
         || (WALLET.getAddressObj(message['tx1_address']) && message['backward_asset'] == 'BTC' && message['_status'] == 'pending')) {
        //Register this as an "upcoming" BTCpay
        var btcPayData = WaitingBTCPayFeedViewModel.makeBTCPayData(message); 
        //Don't include in UPCOMING_BTCPAY_FEED BTCpays which are for less than the current (multisig) dust amount
        if (btcPayData['btcQuantityRaw']>=MULTISIG_DUST_SIZE) {
          UPCOMING_BTCPAY_FEED.add(btcPayData);
        } else {
          $.jqlog.debug("dust order_matches "+btcPayData['orderMatchID']+" : "+btcPayData['btcQuantityRaw']);
        }  
        
      }
    } else if(category == "order_expirations") {
      //Remove the order from the open orders list
      OPEN_ORDER_FEED.remove(message['order_hash']);
      WAITING_BTCPAY_FEED.remove(message['order_hash']); //just in case we had a BTC payment required for this order when it expired
    } else if(category == "order_match_expirations") {
      //Would happen if the user didn't make a BTC payment in time
      WAITING_BTCPAY_FEED.remove(message['order_match_id']);
      //^ just in case we had a BTC payment required for this order match when it expired
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
}