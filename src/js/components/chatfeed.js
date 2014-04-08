
function ChatLineViewModel(handle, text, is_op, is_private) {
  var self = this;
  self.HANDLE = handle;
  //^ May be text (for a user saying something) or null (for a system message)
  self.IS_OP = is_op || false;
  self.IS_PRIVATE = is_private || false;
  self.text = ko.observable(text);
  
  self.lineText = ko.computed(function(){
    //if the line is addressed to us, then we should bold it (as well as coloring our handle itself)
    if(self.text().indexOf(CHAT_FEED.handle()) != -1) {
      self.text("<b>" + self.text() + "</b>");
      var regExp = new RegExp(CHAT_FEED.handle(), 'g');
      var nickColorClass = CHAT_FEED.is_op() ? 'chatLineOpEmote' : 'chatLineSelfEmote'; 
      self.text(self.text().replace(regExp, "<span class='" + nickColorClass + "'>" + CHAT_FEED.handle() + "</span>"));
    }
    
    if(self.HANDLE) {
      if(self.IS_OP) {
        return "<span class='chatLineOpEmote'>" + self.HANDLE + (self.IS_PRIVATE ? '(PRIVATE)' : '') + ":</span>&nbsp;&nbsp;" + self.text();  
      } else if(self.HANDLE == CHAT_FEED.handle()) {
        return "<span class='chatLineSelfEmote'>" + self.HANDLE + ":</span>&nbsp;&nbsp;" + self.text();  
      } else {
        return "<span class='chatLineEmote'>" + self.HANDLE + (self.IS_PRIVATE ? '(PRIVATE)' : '') + ":</span>&nbsp;&nbsp;" + self.text();  
      }
    } else { //system
      assert(self.HANDLE === null);
      return "<span class='chatLineSystem'>SYSTEM:</span>&nbsp;&nbsp;<b>" + self.text() + "</b>";
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
  self.is_op = ko.observable(false); //if this user is an op or not
  self.bannedUntil = ko.observable(null);
  //self.textToSend = ko.observable('');
  self.feedConnections = [];
  self._nextMessageNotSent = false;
  self._historyKeyIndex = 0;
  self._handleTabCompletionIndex = null;
  self._handleTabCompletionPrefixText = '';
  
  self.lastSetWalletIDAttempt = null;

  self.headerText = ko.computed(function(){
    var header = "<b>Chatbox</b>";
    if(self.handle() && self.is_op()) header += " (<span class='chatLineOpEmote'>" + self.handle() + "</span>)"; 
    if(self.handle() && !self.is_op()) header += " (<span class='chatLineSelfEmote'>" + self.handle() + "</span>)";
    return header; 
  });
  
  self.init = function() {
    //Start up the chat feed if necessary
    //Called at login time (we do it then instead of when displaying the chat window, so that we can use it to track
    //which wallet IDs are online, which we use for showing orders with BTCPays that have a higher chance of being
    //paid more quickly, for instance)
    if(self.feedConnections.length) { //already initialized
      return;
    }
    
    $.jqlog.debug("Starting chat feeds: " + JSON.stringify(cwBaseURLs()));
    for(var i = 0; i < cwBaseURLs().length; i++) {
      var socket = io.connect(cwBaseURLs()[i], {
        'max reconnection attempts': 5,
        'try multiple transports': false,
        'force new connection': true, /* needed, otherwise socket.io will reuse the feed connection */
        //'reconnection limit': 100000,
        //'max reconnection attempts': Infinity,
        'resource': USE_TESTNET ? '_t_chat' : '_chat'
      });
      self.feedConnections.push(socket); //must be done before we do any chatting...
      self._registerConnectCallback(i);
    }
  }
  
  self._showChatWindow = function() {
    $('#chatLink span').text("Hide Chat");
  
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
    $('#chatLink span').text("Show Chat");
    $('#main').animate({marginRight : "0px"}, {duration: 600, queue: false});
    $('#chatPane').hide('slide', {direction:'right', queue: false}, 600);
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
        self.is_op(data['is_op']);
        self.bannedUntil(data['banned_until']);
        $.jqlog.debug("Chat handle: " + self.handle() + ", op: " + self.is_op() + ", banned until: " + self.bannedUntil()/1000);
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
    socket.on('emote', function (handle, text, is_op, is_private) { //handle may be null, to print a SYSTEM message
      $.jqlog.debug("chat.emote(feed-"+num+"): handle: " + handle + ", is_op: " + is_op + ", text: " + text);
      self.addLine(handle, text, is_op, is_private);
    });
    socket.on('oped', function (op_handle, handle) {
      if(handle == self.handle()) self.is_op(true);
      self.addLine(null, op_handle + " has oped " + handle, null, null);
    });
    socket.on('unoped', function (op_handle, handle) {
      if(handle == self.handle()) self.is_op(false);
      self.addLine(null, op_handle + " has unoped " + handle, null, null);
    });
    socket.on('banned', function (op_handle, handle, time, until_ts) {
      self.addLine(null, op_handle + " has banned " + handle + (time == -1 ? " permanently :o" : (" for " + time + " seconds")), null, null);
    });
    socket.on('unbanned', function (op_handle, handle) {
      self.addLine(null, op_handle + " has unbanned " + handle, null, null);
    });
    socket.on('handle_changed', function (op_handle, old_handle, new_handle) {
      if(old_handle == self.handle()) self.handle(new_handle);
      self.addLine(null, op_handle + " has changed the chat handle for " + old_handle + " to " + new_handle, null, null);
    });
    socket.on('online_status', function (handle, is_online) { //response to /online command
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
            self.addLine(null,
              "Lost chat feed link and attempted to correct. Please try sending your chat line again.", null, null);  
          });
        }
      } else {
        if(error_name == 'too_fast')
          self._nextMessageNotSent = true; //as the success callback is triggered after receiving the error callback
        
        self.addLine(null, error_message, null, null);  
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
    //check for a dupe line in the last 3 lines and do not post if so
    var newLine = new ChatLineViewModel(handle, text, is_op, is_private);
    var lastLines = self.lines.slice(Math.max(self.lines().length - 3, 1));
    for(var i=0; i < lastLines.length; i++) {
      if(newLine.lineText() == lastLines[i].lineText() && lastLines[i].HANDLE != null) { // && !lastLines[i].IS_OP) {
        $.jqlog.debug("chat.addLine: Line ignored (duplicate): " + newLine.lineText());
        return;
      }
    }

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
      if(!words.last()) return;
      
      //gather the list of potential nicks from the last 50 lines of chat history (putting most recently spoken nicks first)
      var handles = [];
      for(var i = self.lines().length - 1; i >= Math.max(self.lines().length - 50, 0); --i) {
        if(self.lines()[i].HANDLE)
          handles.push(self.lines()[i].HANDLE);
      }
      handles = handles.unique();
      handles.remove(self.handle()); //our own handle should not be a candidate for tab completion
      
      var toComplete = null;
      var lastWord = words.last();
      var subsequentTabbing = false;
      if(handles.filter(function(e) { return e == lastWord; }).length && self._handleTabCompletionPrefixText) {
        //last word was a full match, so use the stored last prefix. this will allow us to cycle through nick results
        toComplete = self._handleTabCompletionPrefixText;
        subsequentTabbing = true;
      } else {
        //last word was not a match, so update the stored prefix to be it
        toComplete = words.last();
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
    var text = $('#chatTextBox').val();
    if(!text) return; //no empty lines
    assert(self.feedConnections.length >= 1, "Not connected to any chat servers!");
    
    if(text.startsWith('/')) { //chat command
      var parts = text.replace('/', '').split(' ');
      var command = parts[0];
      var args = parts.slice(1);
      $.jqlog.debug("chat.sendLine(command): " + command + ", args: " + JSON.stringify(args));
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
      $.jqlog.debug("chat.sendLine(emote): " + text);
      
      function _doChatEmote(num) {
        self.feedConnections[num].emit('emote', text, function(data) {
          //SUCCESS CALLBACK: post it to our window (as the servers won't broadcast it back to us)
          if(num==0) {
            if(self._nextMessageNotSent) {
              self._nextMessageNotSent = false;
            } else {
              text = $("<div/>").html(text).text();
              //^ sanitize html text out to match how the server will bcast it to other clients
              self.addLine(self.handle(), text, self.is_op(), false);
              $('#chatTextBox').val('');
            }
          }
        });
      } 
      
      for(var i=0; i < self.feedConnections.length; i++) {
        _doChatEmote(i);
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
    //Save the handle back at counterwalletd
    multiAPI("store_chat_handle", [WALLET.identifier(), self.newHandle()], function(data, endpoint) {
      CHAT_FEED.handle(self.newHandle());
      self.hide();
      CHAT_FEED._showChatWindow();
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
  $('#chatLink').click(function() {
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
