//requires GOOGLE_ANALYTICS_UAID to be defined

function trackPageView(url) {
  //Track a page view via google analytics
  if(!GOOGLE_ANALYTICS_UAID) return;
  if(typeof(url)==='undefined') url = getCurrentPage();
  _gaq.push(['_trackPageview', url]);
}

function trackDialogShow(dialogName) {
  //Track the display of a dialog via google analytics
  if(!GOOGLE_ANALYTICS_UAID) return;
  _gaq.push(['_trackPageview', getCurrentPage() + '#' + dialogName]);
}

function trackEvent(category, action, label, value) {
  //Track some kind of user event via google analytics
  if(!GOOGLE_ANALYTICS_UAID) return;
  var data = ['_trackEvent', category, action];
  if(typeof(label)!=='undefined') data.push(label);
  if(typeof(value)!=='undefined') data.push(value); //this is an INTEGER value
  _gaq.push(data);
}
