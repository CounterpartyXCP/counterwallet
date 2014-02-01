function NotificationViewModel(type, message, when) {
  if(typeof(when)==='undefined') when = new Date().toTimeString();

  var self = this;
  self.type = ko.observable(type);
  /*
   * Possible types:
   * user: Misc user notification (not critical)
   * alert: Something to alert the user to at a notification level
   * recved-funds: When the wallet has received funds
   */
  self.message = ko.observable(message);
  self.when = ko.observable(when); //when generated
}

function ActivityFeedViewModel(initialActivityCount) {
  if(typeof(initialActivityCount)==='undefined') initialActivityCount = 0;
  
  //An address has 2 or more assets (BTC, XCP, and any others)
  var self = this;
  self.activityCount = ko.observable(initialActivityCount); //will not change
  self.notifications = ko.observableArray([]);
  
  self.lastUpdated = ko.observable(new Date());
  self.lastUpdatedDisplayed = ko.computed(function() {
    return "Last Updated: " + self.lastUpdated().toTimeString(); 
  }, self);
  
}

var ACTIVITY_FEED = new ActivityFeedViewModel();

$(document).ready(function() {
  $.jqlog.enabled(true);
  ko.applyBindings(ACTIVITY_FEED, document.getElementById("activityBox"));
});
