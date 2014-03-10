function NotificationViewModel(type, message, when) {
  if(typeof(when)==='undefined') when = new Date().getTime();

  var self = this;
  self.type = ko.observable(type);
  /*
   * Possible types:
   * user: Misc user notification (not critical)
   * alert: Something to alert the user to at a notification level
   * security: Security-related notification
   * 
   * Beyond this, any one of the valid message category types:
   * credits, debits, orders, bets, broadcasts, etc
   */
  self.message = ko.observable(message);
  self.when = ko.observable(when); //when generated
  
  self.displayIconForType = ko.computed(function() {
    if(type == 'user') return 'fa-user';
    if(type == 'alert') return 'fa-exclamation';
    if(type == 'security') return 'fa-shield';
    return ENTITY_ICONS[type] ? ENTITY_ICONS[type] : 'fa-question';
  }, self);
  
  self.displayColorForType = ko.computed(function() {
    if(type == 'user') return 'bg-color-lighten';
    if(type == 'alert') return 'bg-color-redLight';
    if(type == 'security') return 'bg-color-redLight';
    return ENTITY_NOTO_COLORS[type] ? ENTITY_NOTO_COLORS[type] : 'bg-color-white';
  }, self);
}

function NotificationFeedViewModel(initialCount) {
  var self = this;
  
  self.notifications = ko.observableArray([]);
  self.lastUpdated = ko.observable(new Date());
  self.count = ko.observable(initialCount || 0);

  self.dispLastUpdated = ko.computed(function() {
    return "Last Updated: " + self.lastUpdated().toTimeString(); 
  }, self);
  
  self.dispCount = ko.computed(function() {
    return self.count();
  }, self);
  
  self.add = function(type, message, when) {
    self.notifications.unshift(new NotificationViewModel(type, message, when)); //add to front of array
    self.unackedNotificationCount(self.unackedNotificationCount() + 1);
    //if the number of notifications are over 40, remove the oldest one
    if(self.notifications().length > 40) self.notifications.pop();
    self.lastUpdated(new Date());
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
