
function ChatLineViewModel(type, handle, op, text) {
  var self = this;
  self.HANDLE = handle;
  self.TYPE = type;
  self.OP = op;
  //^ Valid chat types are: 'emote' (for a user saying something) and 'system' (for a system message)
  //If type is system, handle should be blank
  self.text = ko.observable(text);
  
  self.lineText = ko.computed(function(){
    if(type == 'emote') {
      if(op) {
        return "<span class='chatLineOpEmote'>" + self.HANDLE + " (op):</span>&nbsp;&nbsp;" + self.text();  
      } else if(handle == CHAT_FEED.handle()) {
        return "<span class='chatLineSelfEmote'>" + self.HANDLE + ":</span>&nbsp;&nbsp;" + self.text();  
      } else {
        return "<span class='chatLineEmote'>" + self.HANDLE + ":</span>&nbsp;&nbsp;" + self.text();  
      }
    } else { //system
      return "<span class='chatLineSystem'>SYSTEM:</span>&nbsp;&nbsp;<b>" + self.text() + "</b>";
    }
  }, self);
}

function ChatFeedViewModel() {
  //An address has 2 or more assets (BTC, XCP, and any others)
  var self = this;
  self.lines = ko.observableArray([]);
  self.lastUpdated = ko.observable(new Date());
  self.handle = ko.observable(null);
  self.op = ko.observable(false); //if this user is an op or not
  self.bannedUntil = ko.observable(null);
  //self.textToSend = ko.observable('');
  self.feedConnections = [];
  self._nextMessageNotSent = false;
  
  self.lastSetWalletIDAttempt = null;

  self.headerText = ko.computed(function(){
    var header = "<b>Chatbox</b>";
    if(self.handle() && self.op()) header += " (<span class='chatLineOpEmote'>" + self.handle() + "</span>)"; 
    if(self.handle() && !self.op()) header += " (<span class='chatLineSelfEmote'>" + self.handle() + "</span>)";
    return header; 
  });
  
  self._showChatWindow = function() {
    $('#chatLink span').text("Hide Chat");
    $('#main').animate({ marginRight : "280px"},600);      
    $('#chatPane').show('slide',{direction:'right'},600);
  }
  
  self._hideChatWindow = function() {
    //Collapse chat window
    $('#chatLink span').text("Show Chat");
    $('#main').animate({ marginRight : "0px"},600);
    $('#chatPane').hide('slide',{direction:'right'},600);
  }
  
  self.showChat = function() {
    if(self.handle()) { //user has already opened up the chat window in this session
      self._showChatWindow();
      return;
    }
    
    //pop up a dialog box to gather and set user's chat handle, and save to preferences
    multiAPINewest("get_chat_handle", [WALLET.identifier()], 'last_updated', function(data, endpoint) {
      if(data) {
        assert(data && data.hasOwnProperty('handle'));
        //handle already set, just pop up chat window
        self.handle(data['handle']);
        self.op(data['op']);
        self.bannedUntil(data['banned_until']);
        $.jqlog.log("Chat handle: " + self.handle() + ", op: " + self.op() + ", banned until: " + self.bannedUntil()/1000);
        self._showChatWindow();
        self._initChatFeed();
      } else {
        //handle is not stored on any server
        bootbox.dialog({
          message: "To use chat, you must have a handle (or nickname) you wish to use (alphanumeric/underscore/hyphen, between 4 and 12 characters). Please enter it below:<br/><br/> \
          <input type='text' id='chat_handle' class='bootbox-input bootbox-input-text form-control'></input><br/><br/> \
          <b style='color:red'>Please remember that people in chat may not always be who they seem. Until a verified \
           identity system is implemented for chat, do not simply trust someone is who their handle says they are!</b>",
          title: "Enter your chat handle",
          buttons: {
            cancel: {
              label: "Cancel",
              className: "btn-default",
              callback: function() {
                //modal will disappear
              }
            },
            success: {
              label: "Start Chat",
              className: "btn-primary",
              callback: function() {
                handle = $('#chat_handle').val();
                
                //Validate handle, must be alpha numeric, less than 12 characters
                if(!handle.match(/[A-Za-z0-9_-]{4,12}/g)) {
                  return bootbox.alert("Invalid handle, must be between 4 and 12 characters, alphanumeric, underscore or hyphen allowed.");
                }
                
                //Save the handle back at counterwalletd
                multiAPI("store_chat_handle", [WALLET.identifier(), handle], function(data, endpoint) {
                  self.handle(handle);
                  self._showChatWindow();
                  self._initChatFeed();
                });
              }
            },
          }
        });
      }
    });
  }
  
  self._initChatFeed = function() {
    //Start up the chat feed if necessary
    if(self.feedConnections.length) { //already initialized
      return;
    }
    
    var initialLineSetNumReplies = 0;
    var initialLineSet = [];
        
    $.jqlog.log("Starting chat feeds: " + JSON.stringify(counterwalletd_base_urls));
    for(var i = 0; i < counterwalletd_base_urls.length; i++) {
      var socket = io.connect(counterwalletd_base_urls[i], {
        'max reconnection attempts': 5,
        'try multiple transports': false,
        'force new connection': true, /* needed, otherwise socket.io will reuse the feed connection */
        //'reconnection limit': 100000,
        //'max reconnection attempts': Infinity,
        'resource': USE_TESTNET ? '_t_chat' : '_chat'
      });
      
      function _chatSIOCallbacks(num) {
        socket.on('connect', function() {
          $.jqlog.log('socket.io(chat): Connected to server: ' + counterwalletd_base_urls[num]);
          
          if(socket.chatFeed_hasInitialized === undefined) {
            //for each feed, we need to call over to "set_walletid"
            socket.emit('set_walletid', WALLET.identifier(), function(data) {
              self.feedConnections.push(socket); //must be done before we do any chatting...
            });
            
            //populate last messages into dict, and then sort by timestamp
            socket.emit('get_lastlines', function(linesList) {
              $.jqlog.log("chat.get_lastlines(feed-"+num+"): len = " + linesList.length
                + "; initialLineSet.len = " + initialLineSet.length);
              initialLineSet = initialLineSet.concat(linesList);
              initialLineSetNumReplies += 1;
              
              if(initialLineSetNumReplies == counterwalletd_base_urls.length)  { //got lines for final feed
                //collate linesets, ordered by when object property
                initialLineSet.sort(function (a, b){ return ((a.when < b.when) ? -1 : ((a.when > b.when) ? 1 : 0)); })
                //then add the lot to the chat window          
                for(var i = 0; i < initialLineSet.length; i++) {
                  self.addLine('emote', initialLineSet[i]['handle'], initialLineSet[i]['op'], initialLineSet[i]['text']);
                }
                self.scrollToBottomIfNecessary();
              }
            });
            socket.chatFeed_hasInitialized = true;
          }
          
        });
        socket.on('emote', function (handle, op, text) {
          $.jqlog.log("chat.emote(feed-"+num+"): handle: " + handle + ", op: " + op + ", text: " + text);
          self.addLine('emote', handle, op, text);
        });
        socket.on('oped', function (op_handle, handle) {
          if(handle == self.handle()) self.op(true);
          self.addLine('system', null, null, op_handle + " has oped " + handle);
        });
        socket.on('unoped', function (op_handle, handle) {
          if(handle == self.handle()) self.op(false);
          self.addLine('system', null, null, op_handle + " has unoped " + handle);
        });
        socket.on('banned', function (op_handle, handle, time, until_ts) {
          self.addLine('system', null, null, op_handle + " has banned " + handle + (time == -1 ? " permanently :o" : (" for " + time + " seconds")));
        });
        socket.on('unbanned', function (op_handle, handle) {
          self.addLine('system', null, null, op_handle + " has unbanned " + handle);
        });
        socket.on('handle_changed', function (op_handle, old_handle, new_handle) {
          if(old_handle == self.handle()) self.handle(new_handle);
          self.addLine('system', null, null, op_handle + " has changed the chat handle for " + old_handle + " to " + new_handle);
        });
        socket.on('error', function (error_name, error_message) {
          $.jqlog.log("chat.error(feed-"+num+"): " + error_name + " -- " + error_message);
          
          if(error_name == 'invalid_state') {
            self.doReconnectionAttempt(socket);
          } else {
            if(error_name == 'too_fast')
              self._nextMessageNotSent = true; //as the success callback is triggered after receiving the error callback
            
            self.addLine('system', null, null, error_message);  
          }
        });
      }
      _chatSIOCallbacks(i); //closure
    }
  }
    
  self.hideChat = function() {
      self._hideChatWindow();
  }
  
  self.doReconnectionAttempt = function(socket) {
    //attempt to self correct for this one....
    if(!self.lastSetWalletIDAttempt || ((new Date).getTime() / 1000) - self.lastSetWalletIDAttempt > 10) {
      // ^ avoid infinite loops :)
      socket.emit('set_walletid', WALLET.identifier(), function(data) {
        self.lastSetWalletIDAttempt = (new Date).getTime() / 1000;
        self.addLine('system', null, null,
          "Lost chat feed link and attempted to correct. Please try sending your chat line again.");  
      });
    }
  }

  self.scrollToBottomIfNecessary = function() {
    //scroll to bottom if need be
    if($('#chatContentInnerDiv').prop('scrollHeight') >= $('#chatContentInnerDiv').height()) {
      var scrollTo_val = $('#chatContentInnerDiv').prop('scrollHeight') + 'px';
      $('#chatContentInnerDiv').slimScroll({scrollTo: scrollTo_val});    
    }
  }
  
  self.addLine = function(type, handle, op, text) {
    //check for a dupe line in the last 3 lines and do not post if so
    var newLine = new ChatLineViewModel(type, handle, op, text);
    var lastLines = self.lines.slice(Math.max(self.lines().length - 3, 1));
    for(var i=0; i < lastLines.length; i++) {
      if(newLine.lineText() == lastLines[i].lineText() && lastLines[i].TYPE != 'system' && !lastLines[i].OP) {
        $.jqlog.log("chat.addLine: Line ignored (duplicate): " + newLine.lineText());
        return;
      }
    }
    self.lines.push(newLine);
    //ensure only up to 200 lines max (threshold of 5 lines over before we clear for performance reasons?...if it matters...)
    if(self.lines().length > 205) {
      self.lines(self.lines.splice(0, 5));  
    }
    self.scrollToBottomIfNecessary();
  }
  
  self.sendLine = function() {
    //see if this is a chat command or not
    var text = $('#chatTextBox').val();
    if(!text) return; //no empty lines
    
    if(text.startsWith('/')) { //chat command
      var parts = text.replace('/', '').split(' ');
      var command = parts[0];
      var args = parts.slice(1);
      $.jqlog.log("chat.sendLine(command): " + command + ", args: " + JSON.stringify(args));
      //send to EVERY chat server, as this modifies local server state (if accepted)
      for(var i=0; i < self.feedConnections.length; i++) {
        self.feedConnections[i].emit('command', command, args); //no need for a callback as the server will broadcast to us
      }
      $('#chatTextBox').val('');
    } else { //not a chat command
      //send to only the first (primary) chat server, as all clients are connected to all chat servers
      // and will get the message
      //just grab val() (not very knockout friendly) because certain browsers (certain mobile especially)
      // can get a bit wierd with keydown vs. keypress, etc...not work messing with it
      $.jqlog.log("chat.sendLine(emote): " + text);
      assert(self.feedConnections.length >= 1, "Not connected to any chat servers!");
      self.feedConnections[0].emit('emote', text, function(data) {
        //SUCCESS CALLBACK: post it to our window (as the servers won't broadcast it back to us)
        if(self._nextMessageNotSent) {
          self._nextMessageNotSent = false;
        } else {
          self.addLine('emote', self.handle(), self.op(), text);
          $('#chatTextBox').val('');
        }
      });
    }
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/

$(document).ready(function() {
  //Set up link on the side bar to show/hide chat box
  $('#chatLink').click(function() {
    $('#chatPane').is(':hidden') ? CHAT_FEED.showChat() : CHAT_FEED.hideChat(); 
  });
  
  $("#chatTextBox").keyup(function(event){
    if(event.keyCode == 13){
        CHAT_FEED.sendLine();
    }
  });
});
