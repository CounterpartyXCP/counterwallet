
function ChatLineViewModel(type, handle, text) {
  var self = this;
  self.HANDLE = handle;
  self.TYPE = type;
  //^ Valid chat types are: 'emote' (for a user saying something) and 'system' (for a system message)
  //If type is system, handle should be blank
  self.text = ko.observable(text);
  
  self.lineText = ko.computed(function(){
    if(type == 'emote') {
      if(handle == CHAT_FEED.handle()) {
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
  //self.textToSend = ko.observable('');
  self.feedConnections = [];
  self._nextMessageNotSent = false;
  
  self.lastSetWalletIDAttempt = null;

  self.headerText = ko.computed(function(){
    return "<b>Chatbox</b>" + (self.handle() ? " (" + self.handle() + ")" : ''); 
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
      var handle = data && data.hasOwnProperty('handle') ? data['handle'] : null;
      if(handle == null) { //no handle yet
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
      } else {
        //handle already set, just pop up chat window
        handle = data['handle'];
        $.jqlog.log("Chat handle: " + handle);
        self.handle(handle);
        self._showChatWindow();
        self._initChatFeed();
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
                  self.addLine('emote', initialLineSet[i]['handle'], initialLineSet[i]['text']);
                }
              }
            });
            socket.chatFeed_hasInitialized = true;
          }
          
        });
        socket.on('emote', function (handle, text) {
          $.jqlog.log("chat.emote(feed-"+num+"): handle: " + handle + ", text: " + text);
          self.addLine('emote', handle, text);
        });
        socket.on('system', function (text) {
          $.jqlog.log("chat.system(feed-"+num+"): text: " + text);
          self.addLine('system', null, text);
        });
        socket.on('error', function (error_name, error_message) {
          $.jqlog.log("chat.error(feed-"+num+"): " + error_name + " -- " + error_message);
          
          if(error_name == 'invalid_id') {
            //attempt to self correct for this one....
            if(!self.lastSetWalletIDAttempt || ((new Date).getTime() / 1000) - self.lastSetWalletIDAttempt > 10) {
              // ^ avoid infinite loops :)
              socket.emit('set_walletid', WALLET.identifier(), function(data) {
                self.lastSetWalletIDAttempt = (new Date).getTime() / 1000;
                self.addLine('system', null,
                  "Server side issue (invalid_id). Attempted to correct. Please try sending your chat line again.");  
              });
            }
          } else {
            if(error_name == 'too_fast')
              self._nextMessageNotSent = true; //as the success callback is triggered after receiving the error callback
            
            self.addLine('system', null, error_message);  
          }
        });
      }
      _chatSIOCallbacks(i); //closure
    }
  }
    
  self.hideChat = function() {
      self._hideChatWindow();
  }
  
  self.addLine = function(type, handle, text) {
    self.lines.push(new ChatLineViewModel(type, handle, text));
    //ensure only up to 70 lines max (threshold of 5 lines over before we clear for performance reasons?...if it matters...)
    if(self.lines.length > 75) {
      self.lines.splice(0, 5);  
    }
    
    //scroll to bottom if need be
    if($('#chatContentInnerDiv').prop('scrollHeight') >= $('#chatContentInnerDiv').height()) {
      var scrollTo_val = $('#chatContentInnerDiv').prop('scrollHeight') + 'px';
      $('#chatContentInnerDiv').slimScroll({scrollTo: scrollTo_val});    
    }
  }
  
  self.sendLine = function() {
    //send to only the first (primary) chat server, as all clients are connected to all chat servers
    // and will get the message
    //just grab val() (not very knockout friendly) because certain browsers (certain mobile especially)
    // can get a bit wierd with keydown vs. keypress, etc...not work messing with it
    var text = $('#chatTextBox').val();
    $.jqlog.log("chat.sendLine: " + text);
    assert(self.feedConnections.length >= 1, "Not connected to any chat servers!");
    self.feedConnections[0].emit('emote', text, function(data) {
      //SUCCESS CALLBACK: post it to our window (as the servers won't broadcast it back to us)
      if(self._nextMessageNotSent) {
        self._nextMessageNotSent = false;
      } else {
        self.addLine('emote', self.handle(), text);
        $('#chatTextBox').val('');
      }
    });
  }
}

var CHAT_FEED = new ChatFeedViewModel();

$(document).ready(function() {
  ko.applyBindings(CHAT_FEED, document.getElementById("chatPane"));
  
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
