
function BettingViewModel() {
  var self = this;

  self.categories = ko.observableArray([]);
  self.feeds = ko.observableArray([]);
  self.currentCat = ko.observable(capitaliseFirstLetter(FEED_CATEGORIES[0]));

  self.currentCat.subscribe(function(value) {
    self.showCategory(value);
  });
    
  self.init = function() {
    var cats = [];
    for (var c in FEED_CATEGORIES) {
      cats.push({
        'name': capitaliseFirstLetter(FEED_CATEGORIES[c]),
        'active': c==0 ? true : false
      });
    }
    self.categories(cats);
    self.showCategory(cats[0].name);
  }

  self.showCategory = function(category) {

    var params = {
      'bet_type': 'simple',
      'category': category.toLowerCase(),
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
        if (data[f].equal_odd.wager && data[f].equal_odd.counterwager) {
          data[f].equal_odd_str = normalizeQuantity(data[f].equal_odd.wager) + ' / ' + normalizeQuantity(data[f].equal_odd.counterwager);
        } else {
          data[f].equal_odd_str = '0 / 0';
        }
        if (data[f].not_equal_odd.wager && data[f].not_equal_odd.counterwager) {
          data[f].not_equal_odd_str = normalizeQuantity(data[f].not_equal_odd.wager) + ' / ' + normalizeQuantity(data[f].not_equal_odd.counterwager);
        } else {
          data[f].not_equal_odd_str = '0 / 0';
        }
      }
      self.feeds(data);
    }
    failoverAPI('get_feeds', params, onReceivedFeeds);
  }

  self.bet = function(feed, betType) {
    BET_MODAL.show(feed, betType);
  }

  self.betEqual = function(feed) {
    self.bet(feed, "Equal");
  }

  self.betNotEqual = function(feed) {
    self.bet(feed, "NotEqual");
  }
}


function BetModalViewModel() {
  var self = this;

  var wagerValidator = {
    required: true,
    isValidPositiveQuantity: self,
    validation: {
      validator: function (val, self) {
        var address = self.sourceAddress();
        var wager = self.wager();

        $.jqlog.debug('address: '+address);
        $.jqlog.debug('balances: '+self.balances[address]);
        $.jqlog.debug('wager: '+wager);

        return parseFloat(wager) <= self.balances[address];
      },
      message: 'Quantity entered exceeds the address balance.',
      params: self
    }    
  }

  self.shown = ko.observable(false);
  self.feed = ko.observable({});
  self.availableAddresses = ko.observableArray([]);
  self.sourceAddress = ko.observable(null).extend(wagerValidator);
  self.deadline = ko.observable(null);
  self.balances = {};
  self.counterBets = ko.observableArray([]);
  self.selectedCounterBetTx = ko.observable(null);

  self.wager = ko.observable(null).extend(wagerValidator);

  self.counterwager = ko.observable(null).extend({
    required: true,
    isValidPositiveQuantity: self    
  });

  self.expiration = ko.observable(1000).extend({
    required: true,
    isValidPositiveInteger: self    
  });

  self.validationModel = ko.validatedObservable({
    wager: self.wager,
    counterwager: self.counterwager,
    expiration: self.expiration
  });

  self.show = function(feed, betType) {
    self.shown(true);
    self.betType = betType;
    self.feed(feed);
    
    
    // feed timestamp - 2h
    self.deadline((feed.deadline - 2*60*60) * 1000);
    //populate the list of addresseses again
    self.availableAddresses([]);
    self.balances = {};
    self.counterBets([]);

    var addresses = WALLET.getAddressesList(true);
    var options = []
    for(var i = 0; i < addresses.length; i++) {
      options.push({
        address: addresses[i][0], 
        label: addresses[i][1] + ' (' + addresses[i][2] + ' XCP)'
      });
      self.balances[addresses[i][0]] = addresses[i][2];
    }
    self.availableAddresses(options);
    self.counterwager(1);
    self.wager(1);

    var params = {
      bet_type: COUNTER_BET[self.betType],
      feed_address: self.feed().source,
      target_value: 1,
      leverage: 5040
    };

    var onCounterbetsLoaded = function(data) {
      $.jqlog.debug('COUNTERBETS:');
      $.jqlog.debug(data);
      // prepare data for display
      for (var b in data) {
        data[b].deadline_str = timestampToString(data[b].deadline);
        data[b].ratio = reduce(data[b].wager_quantity, data[b].counterwager_quantity).join('/');
        data[b].multiplier = parseInt(data[b].wager_quantity)/parseInt(data[b].counterwager_quantity);
        data[b].multiplier = Math.floor(data[b].multiplier*100) / 100;
        data[b].counterwager = smartFormat(normalizeQuantity(data[b].counterwager_remaining), 4, 4)+ ' XCP'; 
      }
      self.counterBets(data);
    }

    failoverAPI('get_bets', params, onCounterbetsLoaded);
  }

  self.selectCounterbet = function(counterbet) {
    $.jqlog.debug(counterbet);
    var cw = self.wager() * counterbet.multiplier;
    cw = Math.floor(cw*10000) / 10000;

    self.counterwager(cw);
    self.deadline(counterbet.deadline * 1000);
    self.selectedCounterBetTx(counterbet.tx_index);
    $('#betModal #counterbets tr').removeClass('selectedCounterBet');
    $('#cb_'+counterbet.tx_index).addClass('selectedCounterBet');
  }

  self.hide = function() {
    self.shown(false);
  }

  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }
    
    var params = {
      source: self.sourceAddress(),
      feed_address: self.feed().source,
      bet_type: self.betType,
      deadline: Math.round(self.deadline()/1000),
      wager: denormalizeQuantity(self.wager()),
      counterwager: denormalizeQuantity(self.counterwager()),
      expiration: parseInt(self.expiration()),
      target_value: 1.0,
      leverage: 5040
    }
    $.jqlog.debug(params);

    var onSuccess = function(txHash, data, endpoint) {
      bootbox.alert("<b>Your funds were sent successfully.</b> " + ACTION_PENDING_NOTICE);
    }

    WALLET.doTransaction(self.sourceAddress(), "create_bet", params, onSuccess);
    self.shown(false);
  }
}


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
