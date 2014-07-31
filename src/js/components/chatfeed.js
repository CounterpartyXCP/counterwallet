
function ChatLineViewModel(handle, text, is_op, is_private) {
  var self = this;
  self.HANDLE = handle;
  //^ May be text (for a user saying something) or null (for a system message)
  self.IS_OP = is_op || false;
  self.IS_PRIVATE = is_private || false;

  self.text = ko.observable(text);
  self.lineHead = ko.computed(function() {
    //NOTE: This section should NOT include any user-defined chat data (beyond the user's chosen chat
    // handle), as it is passed through knockouts html: filter.
    if(self.HANDLE) {
      if(self.IS_OP) {
        return "<span class='chatLineOpEmote'>" + self.HANDLE + (self.IS_PRIVATE ? '(PRIVATE)' : '') + ":</span>&nbsp;&nbsp;";  
      } else if(self.HANDLE == CHAT_FEED.handle()) {
        return "<span class='chatLineSelfEmote'>" + self.HANDLE + ":</span>&nbsp;&nbsp;";  
      } else {
        return "<span class='chatLineEmote'>" + self.HANDLE + (self.IS_PRIVATE ? '(PRIVATE)' : '') + ":</span>&nbsp;&nbsp;";  
      }
    } else { //system
      assert(self.HANDLE === null);
      return "<span class='chatLineSystem'>SYSTEM:</span>&nbsp;&nbsp;";
    }
  }, self);
}

function ChatFeedViewModel() {
  //An address has 2 or more assets (BTC, XCP, and any others)
  var self = this;
  self.lines = ko.observableArray([]);
  self.myLines = ko.observableArray([]);
  self.lastUpdated = ko.observable(new Date());
  self.handle = ko.observable(null);
  self.isOp = ko.observable(false); //if this user is an op or not
  self.bannedUntil = ko.observable(null);
  //self.textToSend = ko.observable('');
  self.feedConnections = [];
  self._historyKeyIndex = 0;
  self._handleTabCompletionIndex = null;
  self._handleTabCompletionPrefixText = '';
  self._firstAvailableChatServer = 0; //0-based index. Normally, this is 0, unless the first chat server in the list has issues
  
  self.lastSetWalletIDAttempt = null;

  self.headerText = ko.computed(function(){
    var header = "<b>Chatbox</b>";
    if(self.handle() && self.isOp()) header += " (<span class='chatLineOpEmote'>" + self.handle() + "</span>)"; 
    if(self.handle() && !self.isOp()) header += " (<span class='chatLineSelfEmote'>" + self.handle() + "</span>)";
    return header; 
  });
  
  self.numUsersOnline = ko.observable('??');
  
  self.init = function() {
    //Start up the chat feed if necessary
    //Called at login time (we do it then instead of when displaying the chat window, so that we can use it to track
    //which wallet IDs are online, which we use for showing orders with BTCPays that have a higher chance of being
    //paid more quickly, and how many users are using the wallet, for instance)
    if(self.feedConnections.length) { //already initialized
      return;
    }
    
    $.jqlog.debug("Starting chat feeds: " + JSON.stringify(cwBaseURLs()));
    for(var i = 0; i < cwBaseURLs().length; i++) {
      var socket = io.connect(cwBaseURLs()[i], {
        'connect timeout': 5000,
        'reconnect': true,
        'reconnection delay': 5000,
        'reconnection limit': 60000,
        'max reconnection attempts': 50000, /* just keep on trying */
        'try multiple transports': false,
        'force new connection': true, /* needed, otherwise socket.io will reuse the feed connection */
        //'transports': ['websocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling'],
        //'reconnection limit': 100000,
        'resource': USE_TESTNET ? '_t_chat' : '_chat'
      });
      self.feedConnections.push(socket); //must be done before we do any chatting...
      self._registerConnectCallback(i);
    }
    
    //Kick off refreshing of user count
    self.updateOnlineUserCount(); //initial call    
    setTimeout(function() {
      self.updateOnlineUserCount();
    }, CHAT_NUM_USERS_ONLINE_REFRESH_EVERY); 
  }

  self.updateOnlineUserCount = function() {
    //As all users are connected to every chat feed (at least currently), this should return an accurate number
    //If total numbers of servers in the backends list > # servers the client connects to, this will no longer be the case
    failoverAPI("get_num_users_online", {}, function(numUsersOnline, endpoint) {
      self.numUsersOnline(numUsersOnline);
      $("div.openChatPane").show();
    });
  }
  
  self._showChatWindow = function() {

    $('#chatPane').append($("div.openChatPane"));
    $("div.openChatPane").html('▲')
  
    // TODO: improve to really synchronize two animations (queue=false don't work well)
    // TODO: remove margin on windows resize
    if ($('body').width()>680) {
      $('#main').animate({marginRight : "280px"}, {duration: 600, queue: false});  
      $('#chatPane').css('width', '280px'); 
    } else {
      $('#chatPane').css('width', ($('#main').width()-5)+'px');
    }
    
    self.scrollToBottomIfNecessary(); //initially show the div scrolled to the bottom as the animation happens 
    $('#chatPane').show('slide', {direction:'right', queue: false}, 600, function() {
      self.scrollToBottomIfNecessary(); //prevent the scroll from slamming back to the top of the div 
    });
  }
  
  self._hideChatWindow = function() {
    //Collapse chat window
    $('#main').animate({marginRight : "0px"}, {duration: 600, queue: false, complete: function() {
      $('body').append($("div.openChatPane"));
      $("div.openChatPane").html('CHAT')
    }});
    $('#chatPane').hide('slide', {direction:'right', queue: false}, 600);
  }
  
  self.showChat = function() {
    if(self.handle()) { //user has already opened up the chat window in this session
      self._showChatWindow();
      return;
    }
    
    //pop up a dialog box to gather and set user's chat handle, and save to preferences
    multiAPINewest("get_chat_handle", {'wallet_id': WALLET.identifier()}, 'last_updated', function(data, endpoint) {
      if(data) {
        assert(data && data.hasOwnProperty('handle'));
        //handle already set, just pop up chat window
        self.handle(data['handle']);
        self.isOp(data['is_op']);
        self.bannedUntil(data['banned_until']);
        $.jqlog.debug("Chat handle: " + self.handle() + ", op: " + self.isOp() + ", banned until: " + self.bannedUntil()/1000);
        self._showChatWindow();
        
        var initialLineSetNumReplies = 0;
        var initialLineSet = [];
        
        function _startChattingAndGetLastLines(num) {
          self._registerCallbacks(num);
          self.feedConnections[num].emit('start_chatting', WALLET.identifier(), num == 0, function(data) {
            //populate last messages into dict, and then sort by timestamp
            self.feedConnections[num].emit('get_lastlines', function(linesList) {
              $.jqlog.debug("chat.get_lastlines(feed-"+num+"): len = " + linesList.length
                + "; initialLineSet.len = " + initialLineSet.length);
              initialLineSet = initialLineSet.concat(linesList);
              initialLineSetNumReplies += 1;
              
              if(initialLineSetNumReplies == cwBaseURLs().length)  { //got lines for final feed
                //collate linesets, ordered by when object property
                initialLineSet.sort(function (a, b){ return ((a.when < b.when) ? -1 : ((a.when > b.when) ? 1 : 0)); })
                //then add the lot to the chat window          
                for(var i = 0; i < initialLineSet.length; i++) {
                  self.addLine(initialLineSet[i]['handle'], initialLineSet[i]['text'], initialLineSet[i]['is_op'], false);
                }
                self.scrollToBottomIfNecessary();
              }
            });
          });
        }
        
        for(var i=0; i < self.feedConnections.length; i++) {
          //for each feed, we need to call over to "register"
          _startChattingAndGetLastLines(i);
        }
      } else {
        //handle is not stored on any server
        CHAT_SET_HANDLE_MODAL.show();
      }
    });
  }
  
  self._registerConnectCallback = function(num) {
    var socket = self.feedConnections[num];
    socket.on('connect', function() {
      $.jqlog.log('socket.io(chat): Connected to server: ' + cwBaseURLs()[num]);
      //Chat handle would be set when the user actually opens up the chat panel
      
      //For now, just send a "ping" so that the server sees us as online
      socket.emit('ping', WALLET.identifier());
    });
  }
  
  self._registerCallbacks = function(num) {
    var socket = self.feedConnections[num];
    socket.on('emote', function (handle, text, is_op, is_private, via_command) { //handle may be null, to print a SYSTEM message
      $.jqlog.debug("chat.emote(feed-"+num+"): handle: " + handle + ", viaCommand: " + via_command + ", isOp: " + is_op + ", text: " + text);
      
      //if the emote is via a command, and the chat server is not the primary one, then do not addLine
      if((via_command && num == self._firstAvailableChatServer) || !via_command) {
        self.addLine(handle, text, is_op, is_private);  
        if(handle == self.handle() && text == $('#chatTextBox').val()) {
          $('#chatTextBox').val(''); //clear the chat line because it came back to us
        }
      }
    });
    socket.on('oped', function (op_handle, handle) {
      if(num != self._firstAvailableChatServer) return; //prevent multiple repeated actions
      if(handle == self.handle()) self.isOp(true);
      self.addLine(null, op_handle + " has oped " + handle, null, null);
    });
    socket.on('unoped', function (op_handle, handle) {
      if(num != self._firstAvailableChatServer) return; //prevent multiple repeated actions
      if(handle == self.handle()) self.isOp(false);
      self.addLine(null, op_handle + " has unoped " + handle, null, null);
    });
    socket.on('banned', function (op_handle, handle, time, until_ts) {
      if(num != self._firstAvailableChatServer) return; //prevent multiple repeated actions
      self.addLine(null, op_handle + " has banned " + handle + (time == -1 ? " permanently ^_^" : (" for " + time + " seconds")), null, null);
    });
    socket.on('unbanned', function (op_handle, handle) {
      if(num != self._firstAvailableChatServer) return; //prevent multiple repeated actions
      self.addLine(null, op_handle + " has unbanned " + handle, null, null);
    });
    socket.on('handle_changed', function (op_handle, old_handle, new_handle) {
      if(num != self._firstAvailableChatServer) return; //prevent multiple repeated actions
      if(old_handle == self.handle()) self.handle(new_handle);
      self.addLine(null, op_handle + " has changed the chat handle for " + old_handle + " to " + new_handle, null, null);
    });
    socket.on('online_status', function (handle, is_online) { //response to /online command
      if(num != self._firstAvailableChatServer) return; //prevent multiple repeated actions
      self.addLine(null, handle + (is_online ? " is online" : " is not online"), null, null);
    });
    socket.on('error', function (error_name, error_message) {
      $.jqlog.debug("chat.error(feed-"+num+"): " + error_name + " -- " + error_message);
      
      if(error_name == 'invalid_state') {
        //attempt to self correct for this one....
        if(!self.lastSetWalletIDAttempt || ((new Date).getTime() / 1000) - self.lastSetWalletIDAttempt > 10) {
          // ^ avoid infinite loops :)
          socket.emit('start_chatting', WALLET.identifier(), num == 0, function(data) {
            self.lastSetWalletIDAttempt = (new Date).getTime() / 1000;
            if(num == self._firstAvailableChatServer) {
              self.addLine(null,
                "Lost chat feed link and attempted to correct. Please try sending your chat line again.", null, null);  
            }
          });
        }
      } else if(error_name == 'invalid_id' && self.handle()) {
        //will happen if there are multiple servers, and at least one we have a handle, and 1 or more of
        // the others, we don't (i.e. there is a mismatch). In this case, store the handle to make them match up
        multiAPI("store_chat_handle", {'wallet_id': WALLET.identifier(), 'handle': self.handle()}, function(data, endpoint) {
          $.jqlog.info("Synced handle '" + self.handle() + "' to all servers.");
        });
      } else {
        if(num == self._firstAvailableChatServer) { //don't show redundant error messages
          self.addLine(null, error_message, null, null);
        }  
      }
    });
  }
  
  self.hideChat = function() {
      self._hideChatWindow();
  }
  
  self.scrollToBottomIfNecessary = function() {
    //scroll to bottom if need be
    if($('#chatContentInnerDiv').prop('scrollHeight') >= $('#chatContentInnerDiv').height()) {
      var scrollTo_val = $('#chatContentInnerDiv').prop('scrollHeight') + 'px';
      $('#chatContentInnerDiv').slimScroll({scrollTo: scrollTo_val});    
    }
  }
  
  self.addLine = function(handle, text, is_op, is_private) {
    //check for a dupe line in the last 3 lines and do not post if so (this includes emotes and commands)
    var newLine = new ChatLineViewModel(handle, text, is_op, is_private);
    self.lines.push(newLine);

    //ensure only up to 200 lines max (threshold of 5 lines over before we clear for performance reasons?...if it matters...)
    if(self.lines().length > 205)
      self.lines.splice(0, 5);
    
    //if it's from us, add it to myLines
    if(handle == self.handle()) {
      self.myLines.push(newLine);
      if(self.myLines().length > 105)
        self.myLines(self.lines.splice(0, 5));  
    }
    
    self.scrollToBottomIfNecessary();
  }
  
  self.onKeyUp = function(data, event) {
    if(event.keyCode == 13){
        CHAT_FEED.sendLine();
    } else if(event.keyCode == 38) { //up arrow
      var text = $('#chatTextBox').val();
      if(!text) {
        //if the line was blank when this was pressed, show the last line
        self._historyKeyIndex = self.myLines().length - 1;
      } else {
        //otherwise if there was something when this was pressed, try to find that line in myLines that is currently displayed
        // ... if we can't find the line, don't change the textbox, and if we're on the first line, then don't change it
        // otherwise, change the textbox contents to be the previous entry in the history array
        for(var i = self.myLines().length - 1; i >= 0; --i) {
          if(self.myLines()[i].text() == text) break;
        }
        if(i == -1 || i == 0) return;
        self._historyKeyIndex -= 1;
      }
      $('#chatTextBox').val(self.myLines()[self._historyKeyIndex].text());
    } else if(event.keyCode == 40) { //down arrow
      var text = $('#chatTextBox').val();
      //if the line was blank when this was pressed, do nothing
      if(!text) return;
      
      //otherwise, find the line that is currently displayed in myLines... if we can find it, show the next line from
      // the history key index ... if we can't find the line, don't change the textbox
      for(var i = self.myLines().length - 1; i >= 0; --i) {
        if(self.myLines()[i].text() == text) break;
      }
      if(i != -1) {
        if(i == self.myLines().length - 1) { //last line, just clear the textbox
          $('#chatTextBox').val('');
        } else { //not last line...show the next line
          self._historyKeyIndex += 1;
          $('#chatTextBox').val(self.myLines()[self._historyKeyIndex].text());
        }
      }
    } else if(event.keyCode == 9) { //tab pressed - nick competion
      var words = $('#chatTextBox').val().replace(/[ :]+$/g, '').split(' ');
      //^ split without the automatic space and : our completion adds
      if(!words[words.length-1]) return;
      
      //gather the list of potential nicks from the last 50 lines of chat history (putting most recently spoken nicks first)
      var handles = [];
      for(var i = self.lines().length - 1; i >= Math.max(self.lines().length - 50, 0); --i) {
        if(self.lines()[i].HANDLE)
          handles.push(self.lines()[i].HANDLE);
      }
      handles = _.uniq(handles);
      handles = _.without(handles, self.handle()); //our own handle should not be a candidate for tab completion
      
      var toComplete = null;
      var lastWord = words[words.length-1];
      var subsequentTabbing = false;
      if(handles.filter(function(e) { return e == lastWord; }).length && self._handleTabCompletionPrefixText) {
        //last word was a full match, so use the stored last prefix. this will allow us to cycle through nick results
        toComplete = self._handleTabCompletionPrefixText;
        subsequentTabbing = true;
      } else {
        //last word was not a match, so update the stored prefix to be it
        toComplete = words[words.length-1];
        self._handleTabCompletionPrefixText = toComplete;
      }
      var matchingHandles = handles.filter(function(e) { return e.toLowerCase().indexOf(toComplete.toLowerCase()) == 0; });
      $.jqlog.debug("Chatbox tab competion on: '" + toComplete + "', subsequent tabbing: " + subsequentTabbing
        + ", candidates: " + JSON.stringify(matchingHandles));
      if(!matchingHandles.length) return;
      if(self._handleTabCompletionIndex == null || self._handleTabCompletionIndex + 1 >= matchingHandles.length) {
        self._handleTabCompletionIndex = 0; //circle around (or, start with the first entry if this is our first time 'tabbing' ;)
      } else {
        self._handleTabCompletionIndex += 1;
      }
      //otherwise we can be lazy it with...it doesn't matter if _handleTabCompletionIndex is not reset betwen competion
      // attempts, as we circle around to the results anyhow
      var choice = matchingHandles[self._handleTabCompletionIndex];
      $('#chatTextBox').val(words.slice(0, -1).join(' ') + (words.length == 1 ? '' : ' ') + choice + (words.length == 1 ? ': ' : ' '));
    }
  }
  
  self.sendLine = function() {
    //see if this is a chat command or not
    var text = $('#chatTextBox').val().trim();
    if(!text) return; //no empty lines
    assert(self.feedConnections.length >= 1, "Not connected to any chat servers!");
    
    if(_.startsWith(text, '/')) { //chat command
      var parts = text.replace('/', '').split(' ');
      var command = parts[0];
      var args = parts.slice(1);
      //send to EVERY connected chat server, as this modifies local server state (if accepted)
      for(var i=0; i < self.feedConnections.length; i++) {
        if(self.feedConnections[i].socket.connected && i < self._firstAvailableChatServer) {
          self._firstAvailableChatServer = i;
        }
        
        $.jqlog.debug("chat.sendLine(feed-" + i + "\\command): " + command + ", args: " + JSON.stringify(args));
        self.feedConnections[i].emit('command', command, args); //no need for a callback as the server will broadcast to us
      }
      $('#chatTextBox').val('');
    } else { //not a chat command
      //send to only the first (primary) chat server, as all clients are connected to all chat servers
      // and will get the message
      //just grab val() (not very knockout friendly) because certain browsers (certain mobile especially)
      // can get a bit wierd with keydown vs. keypress, etc...not work messing with it
      
      function _doChatEmote(num) {
        self.feedConnections[num].emit('emote', text, function(data) {
          //SUCCESS CALLBACK: post it to our window (as the servers won't broadcast it back to us)
        });
      } 
      
      for(var i=0; i < self.feedConnections.length; i++) {
        //Send the line out the first connected chat server
        if(self.feedConnections[i].socket.connected) {
          if(self._firstAvailableChatServer != i) {
            $.jqlog.info("chat.sendLine: Chat server " + self._firstAvailableChatServer + " not connected. Sending out chat server " + i + " instead.");
            self._firstAvailableChatServer = i;
          }
          $.jqlog.debug("chat.sendLine(feed-" + i + "\\emote): " + text);
          _doChatEmote(i);
          break;
        }
      }
    }
  }
}

ko.validation.rules['handleIsNotInUse'] = {
  async: true,
  message: 'Handle is already in use',
  validator: function (val, self, callback) {
    failoverAPI("is_chat_handle_in_use",  {'handle': val},
      function(isInUse, endpoint) {
        $.jqlog.debug("Handle in use: "+isInUse);
        CHAT_SET_HANDLE_MODAL.startEnable(!isInUse);
        $('#startChatBtn').prop("disabled", isInUse); //not correctly set by knockout
        return callback(!isInUse);
      }
    );   
  }
};
ko.validation.rules['isValidHandle'] = {
    validator: function (val, self) {
      return val.match(/[A-Za-z0-9_-]{4,12}/g);
    },
    message: "Invalid handle, must be between 4 and 12 characters with only alphanumeric, underscore or hyphen allowed."
};
ko.validation.registerExtenders();

function ChatSetHandleModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.startEnable = ko.observable(false);
  
  self.newHandle = ko.observable('').extend({
    required: true,
    throttle: 600,
    isValidHandle: self,
    handleIsNotInUse: self
  });
  
  self.validationModel = ko.validatedObservable({
    newHandle: self.newHandle
  });

  self.resetForm = function() {
    self.newHandle('');
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if ($('#startChatBtn').prop("disabled")) {
      return;
    }
    if(self.newHandle.isValidating()) {
      setTimeout(function() { //wait a bit and call again
        self.submitForm();
      }, 50);
      return;
    }
    
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    $('#chatSetHandleModal form').submit();
  }

  self.doAction = function() {
    if ($('#startChatBtn').prop("disabled")) {
      return;
    }
    //Save the handle back at counterblockd
    multiAPI("store_chat_handle", {'wallet_id': WALLET.identifier(), 'handle': self.newHandle()}, function(data, endpoint) {
      self.hide();
      CHAT_FEED.showChat();
    });
  }
  
  self.show = function(resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    self.shown(true);
  }  

  self.hide = function() {
    self.shown(false);
  }  
}


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/

$(document).ready(function() {
  //Set up link on the side bar to show/hide chat box  
  $('div.openChatPane').click(function() {
    $('#chatPane').is(':hidden') ? CHAT_FEED.showChat() : CHAT_FEED.hideChat(); 
  });

  $("#chatTextBox").keydown(function(e) { 
    if (e.keyCode == 9) { //prevent tab from switching focus
      e.preventDefault(); 
    } 
  });  

  // we disable the form until handle is verified
  $('input[name=newHandle]').keydown(function(e) {
    if (e.keyCode != 13) {
      $('#startChatBtn').prop("disabled", true);
    }    
  })
  $('#chatSetHandleModal form').submit(function(event) {
    return !$('#startChatBtn').prop("disabled");
  });
});
