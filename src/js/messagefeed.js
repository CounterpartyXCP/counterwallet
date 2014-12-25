
function MessageFeed() {
  var self = this;
  self.lastMessageIndexReceived = ko.observable(0); //last message received from the message feed (socket.io) -- used to detect gaps
  self.failoverCurrentIndex = ko.observable(0); //last idx in the cwBaseURLs tried (used for socket.io failover)
  self.MESSAGE_QUEUE = [];
  self.OPEN_ORDERS = []; // here only for sellBTCOrdersCount

  self.removeOrder = function(hash) {
    var address = false
    for (var i in self.OPEN_ORDERS) {
      if (self.OPEN_ORDERS[i]['tx_hash'] == hash) {
        address = self.OPEN_ORDERS[i]['source'];
        self.OPEN_ORDERS = self.OPEN_ORDERS.splice(i, 1);
      }
    }
    return address;
  }

  self.restoreOrder = function() {
    //Get and populate any open orders we have
    var addresses = WALLET.getAddressesList();
    var filters = {'field': 'source', 'op': 'IN', 'value': addresses};
    failoverAPI("get_orders", {'filters': filters, 'show_expired': false, 'filterop': 'or'},
      function(data, endpoint) {
        //do not show empty/filled orders, including open BTC orders that have 0/neg give remaining 
        self.OPEN_ORDERS = $.grep(data, function(e) { return e['status'] == 'open' && e['give_remaining'] > 0; });
      }
    );
  }
  
  
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
    /*socket.on('default',function(event, data) {
        $.jqlog.debug('socket.io event not trapped: ' + event + ' - data:' + JSON.stringify(data));
    });*/
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

  self.parseMempoolTransaction = function(txHash, category, message) {

    message['bindings'] = JSON.parse(message['bindings']);
    message['bindings']['mempool'] = true;

    var displayTx = false;
    
    if (!WALLET.getAddressObj(message['bindings']['source'])) {
      if (category=='sends') {
        if (WALLET.getAddressObj(message['bindings']['destination'])) {
          displayTx = true;
        }
      } else if (category == 'issuances' && message['bindings']['transfer']) {
        if (WALLET.getAddressObj(message['bindings']['issuer'])) {
          message['bindings']['transfer_destination'] = message['bindings']['issuer'];
          displayTx = true;
        }
      } else if (category == 'dividends' || category == 'callbacks') {
        if (WALLET.isAssetHolder(message['bindings']['asset'])) {
          displayTx = true;
        }
      }
    }

    if (displayTx) {
      var asset1 = message['bindings']['asset'] || 'BTC';
      WALLET.getAssetsDivisibility([asset1], function(divisibility) {

        message['bindings']['divisible'] = divisibility[asset1];
        message['bindings']['tx_index'] = message['_message_index'];
        
        if (category == 'dividends') {

          var asset2 = message['bindings']['dividend_asset'];
          WALLET.getAssetsDivisibility([asset2], function(asset_divisibility) {
            message['bindings']['dividend_asset_divisible'] = asset_divisibility[asset2];
            PENDING_ACTION_FEED.add(txHash, category, message['bindings']);
          });

        } else {
          PENDING_ACTION_FEED.add(txHash, category, message['bindings']);
        }

      });
    }
    
  }
  
  self.parseMessageWithFeedGapDetection = function(txHash, category, message) {
    if(!message || (message.substring && message.startswith("<html>"))) return;
    //^ sometimes nginx can trigger this via its proxy handling it seems, with a blank payload (or a html 502 Bad Gateway
    // payload) -- especially if the backend server reloads. Just ignore it.
    assert(self.lastMessageIndexReceived(), "lastMessageIndexReceived is not defined!");

    $.jqlog.info("feed:receive IDX=" + message['_message_index']);

    //Handle zeroconf transactions
    if (message['_message_index'] == 'mempool') {
      self.parseMempoolTransaction(txHash, category, message);
      return;
    }

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
    failoverAPI("get_messagefeed_messages_by_index", {'message_indexes': missingMessageIndexes}, function(missingMessageData, endpoint) {
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
      
    //filter out non insert messages for now, EXCEPT for order, and bet (so that we get notified when the remaining qty, etc decrease)
    if(message['_command'] != 'insert' && (category != "orders" && category != "bets"))
      return;

    //If we received an action originating from an address in our wallet that was marked invalid by the network, let the user know
    // (do this even in cases where the entry does not exist in pendingActions, as the user could have logged out and back in)
    if(message['_status'] && _.startsWith(message['_status'], 'invalid') && WALLET.getAddressObj(message['source'])) {
      var actionText = PendingActionViewModel.calcText(category, message); //nice "good enough" shortcut method here
      bootbox.alert("<b class='errorColor'>" + i18n.t('network_processing_failed') + ":</b><br/><br/>"
        + actionText + "<br/><br/><b>" + i18n.t("reason") + ":</b> " + message['_status']);
    }

    //Insert the message into the stats page (if it has been initialized)
    if(window.hasOwnProperty('STATS_TXN_HISTORY')) {
      window.STATS_TXN_HISTORY.addMessage(message);
    }
      
    //remove any pending message from the pending actions pane (we do this before we filter out invalid messages
    // because we need to be able to remove a pending action that was marked invalid as well)
    PENDING_ACTION_FEED.remove(txHash, category);
  
    if(_.startsWith(message['_status'], 'invalid'))
      return; //ignore message
    if(message['_status'] == 'expired') {
      //ignore expired orders and bets, but we have order_expirations and bet_expiration inserts that we DO look at
      assert(category == "orders" || category == "bets", "Got an 'expired' message for a category of: " + category);
      return;
    }
    
    //notify the user in the notification pane
    NOTIFICATION_FEED.add(category, message);
    //^ especially with issuances, it's important that this line come before we modify state below


    // address with potential change in escrowed balance
    var refreshEscrowedBalance = [];
    
    //Have the action take effect (i.e. everything besides notifying the user in the notifcations pane, which was done above)
    if(category == "balances") {
      //DO NOTHING
    } else if(category == "credits" || category == "debits") {
      if(WALLET.getAddressObj(message['address'])) {
        WALLET.updateBalance(message['address'], message['asset'], message['_balance']);
        refreshEscrowedBalance.push(message['address']);
      }
    } else if(category == "broadcasts") {
      //TODO
    } else if(category == "burns") {
    } else if(category == "cancels") {
      
      if (WALLET.getAddressObj(message['source'])) {
        //Remove the canceled order from the open orders list
        // NOTE: this does not apply as a pending action because in order for us to issue a cancellation,
        // it would need to be confirmed on the blockchain in the first place
        self.removeOrder(message['offer_hash']);
        //TODO: If for a bet, do nothing for now.
        refreshEscrowedBalance.push(message['source']);
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
        failoverAPI("get_asset_info", {'assets': [message['asset']]}, function(assetsInfo, endpoint) {
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
      var match = ko.utils.arrayFirst(self.OPEN_ORDERS, function(item) {
          return item['tx_hash'] == message['tx_hash'];
      });
      if(match) {
        if(message['_status'] != 'open') { //order is filled, expired, or cancelled, remove it from the listing
          self.removeOrder(message['tx_hash']);
        }
      } else if(WALLET.getAddressObj(message['source'])) {
        //order is not in the open orders listing, but should be
        self.OPEN_ORDERS.push(message);
      }
      refreshEscrowedBalance.push(message['source']);

    } else if(category == "order_matches") {

      if(message['_btc_below_dust_limit'])
        return; //ignore any order match involving BTC below the dust limit

      refreshEscrowedBalance.push(message['tx0_address']);
      refreshEscrowedBalance.push(message['tx1_address']);

    } else if(category == "order_expirations") {
      //Remove the order from the open orders list
      self.removeOrder(message['order_hash']);
      
      refreshEscrowedBalance.push(message['source']);
    
    } else if(category == "order_match_expirations") {
     
      refreshEscrowedBalance.push(message['tx0_address']);
      refreshEscrowedBalance.push(message['tx1_address']);

    } else if(category == "bets") {
      
      refreshEscrowedBalance.push(message['source']);

    } else if(category == "bet_matches") {

      refreshEscrowedBalance.push(message['tx0_address']);
      refreshEscrowedBalance.push(message['tx1_address']);

    } else if(category == "bet_expirations") {
      
      refreshEscrowedBalance.push(message['source']);

    } else if(category == "bet_match_expirations") {

      refreshEscrowedBalance.push(message['tx0_address']);
      refreshEscrowedBalance.push(message['tx1_address']);

    } else {
      $.jqlog.error("Unknown message category: " + category);
    }

    for (var i in refreshEscrowedBalance) {
      var addressObj = WALLET.getAddressObj(refreshEscrowedBalance[i]);
      if (addressObj) {
        addressObj.updateEscrowedBalances();
      }
    }
  }


}