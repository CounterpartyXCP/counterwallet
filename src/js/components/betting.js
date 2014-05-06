
function BettingViewModel() {
  var self = this;

  self.categories = ko.observableArray([]);
  self.feeds = ko.observableArray([]);
    
  self.init = function() {
    var cats = [];
    for (var c in FEED_CATEGORIES) {
      cats.push({
        'name': capitaliseFirstLetter(FEED_CATEGORIES[c]),
        'active': c==0 ? true : false
      });
    }
    self.categories(cats);
    self.showCategory(cats[0]);
  }

  self.showCategory = function(category) {
    $.jqlog.debug(category);
    var params = {
      'bet_type': 'simple',
      'category': category['name'].toLowerCase(),
      'owner': '',
      'source': '',
      'sort_order': -1
    };

    var onReceivedFeeds = function(data) {
      $.jqlog.debug(data);
      // prepare data for display
      for (var f in data) {
        if (data[f].with_image) {
          data[f].image_url = feedImageUrl(data[f].source);
        }
        data[f].deadline_str = timestampToString(data[f].deadline);
        data[f].fee = satoshiToPercent(data[f].fee_fraction_int)
      }
      self.feeds(data);
    }
    failoverAPI('get_feeds', params, onReceivedFeeds);
  }
}


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
