
window.LOGON_VIEW_MODEL = new LogonViewModel();
window.LOGON_PASSWORD_MODAL = new LogonPasswordModalViewModel();

window.WALLET = new WalletViewModel();
window.WALLET_OPTIONS_MODAL = new WalletOptionsModalViewModel();

window.MESSAGE_FEED = new MessageFeed();
window.CHAT_FEED = new ChatFeedViewModel();
window.CHAT_SET_HANDLE_MODAL = new ChatSetHandleModalViewModel();
window.PENDING_ACTION_FEED = new PendingActionFeedViewModel();

window.UPCOMING_BTCPAY_FEED = new UpcomingBTCPayFeedViewModel();
window.WAITING_BTCPAY_FEED = new WaitingBTCPayFeedViewModel();
window.BTCPAY_FEED = new BTCPayFeedViewModel();

window.OPEN_ORDER_FEED = new OpenOrderFeedViewModel();
window.NOTIFICATION_FEED = new NotificationFeedViewModel();

$(document).ready(function() {
  ko.applyBindings(LOGON_VIEW_MODEL, document.getElementById("logon"));
  ko.applyBindingsWithValidation(LOGON_PASSWORD_MODAL, document.getElementById("logonPassphaseModal"));

  ko.applyBindingsWithValidation(WALLET_OPTIONS_MODAL, document.getElementById("walletOptionsModal"));
  
  ko.applyBindings(CHAT_FEED, document.getElementById("chatPane"));
  ko.applyBindings(CHAT_SET_HANDLE_MODAL, document.getElementById("chatSetHandleModal"));
  
  ko.applyBindings(PENDING_ACTION_FEED, document.getElementById("pendingActionFeed"));
  ko.applyBindings(BTCPAY_FEED, document.getElementById("btcPayFeed"));
  ko.applyBindings(OPEN_ORDER_FEED, document.getElementById("openOrderFeed"));
  ko.applyBindings(NOTIFICATION_FEED, document.getElementById("notificationFeed"));        
          
  //so that knockout is run on the DOM sections and global context is accessible...
  ko.applyBindings({}, document.getElementById("noticeTestnet"));
  ko.applyBindings({}, document.getElementById("noticeDevMode"));
  
  $('#fullscreen').click(function() {
    launchFullscreen(document.documentElement);
    return false;
  });
  $('#showOptions').click(function() {
    WALLET_OPTIONS_MODAL.show();
    return false;
  });
});

//Google analytics (production only)
if(GOOGLE_ANALYTICS_UAID) {
  var _gaq = _gaq || [];
  _gaq.push(['_setAccount', GOOGLE_ANALYTICS_UAID]);
  _gaq.push(['_trackPageview']);
  
  (function() {
    var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
    ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
  })();
}
