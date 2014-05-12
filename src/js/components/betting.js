
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
        data[f].date_str = timestampToString(data[f].date);
        data[f].fee = satoshiToPercent(data[f].fee_fraction_int)
        data[f].choices = [];
        for (var c in data[f].outcomes) {
          var oddsBet = data[f].odds[parseInt(c)];
          var odds = {
            'equal': oddsBet.equal == 'NA' ? 'NA' : round(oddsBet.equal, 4) + ' XCP',
            'not_equal': oddsBet.not_equal == 'NA' ? 'NA' : round(oddsBet.not_equal, 4) + ' XCP'
          }
          data[f].choices.push({
            text: data[f].outcomes[c],
            target_value: parseInt(c)+1,
            feed: data[f],
            odds: odds
          });
        }
        deadlines = [];
        for (var d in data[f].deadlines) {
          deadlines.push({
            text: timestampToString(data[f].deadlines[d]),
            timestamp: data[f].deadlines[d]
          });
        }
        data[f].deadlines = deadlines;
        data[f].deadline = deadlines[0].text;
      }
      self.feeds(data);
      $("a[rel=tooltip]").tooltip();
    }
    failoverAPI('get_feeds', params, onReceivedFeeds);
  }

  self.bet = function(outcome, betType) {
    $.jqlog.debug(outcome);
    BET_MODAL.show(outcome.feed, betType, outcome.target_value);
  }

  self.betEqual = function(outcome) {
    self.bet(outcome, "Equal");
  }

  self.betNotEqual = function(outcome) {
    self.bet(outcome, "NotEqual");
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
  self.deadlineStr = ko.observable(null);
  self.balances = {};
  self.counterBets = ko.observableArray([]);
  self.selectedCounterBetTx = ko.observable(null);
  self.targetValue = ko.observable(1);
  self.selectedOutcome = ko.observable('');
  self.showAdvancedOptions = ko.observable(false);
  self.odd = ko.observable(1); 
  self.fee = ko.observable(0);
  self.wager = ko.observable(null).extend(wagerValidator);
  self.matchingVolume = ko.observable(0);
  self.openingVolume = ko.observable(0);

  self.wager.subscribe(function(value) {
    try {
      self.counterwager(round(value * self.odd(), 4));      
    } catch(e) {
      self.counterwager(0);
    }
    self.updateMatchingVolume();
  });

  self.odd.subscribe(function(value) {
    try {
      self.counterwager(round(value * self.wager(), 4));
    } catch(e) {
      self.counterwager(0);
    }  
    self.updateMatchingVolume();
  });

  self.counterwager = ko.observable(null).extend({
    required: true,
    isValidPositiveQuantity: self    
  });

  self.counterwager.subscribe(function(value) {
    try {
      self.fee(round(value * (self.feed().fee_fraction_int / UNIT), 4));
    } catch(e) {
      self.fee(0);
    }  
  });

  self.deadline.subscribe(function(value) {
    self.loadCounterBets();
    self.deadlineStr(timestampToString(value));
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

  self.show = function(feed, betType, targetValue) {
    self.shown(true);
    self.betType = betType;
    self.targetValue(targetValue);
    self.feed(feed);
    self.selectedOutcome(feed.outcomes[targetValue-1])
    
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
    //self.counterwager(1);
    self.wager(1);

    // feed timestamp - 2h
    self.deadline(feed.deadlines[0] * 1000);
  }

  self.loadCounterBets = function() {
    if (!self.betType ||  !self.feed() || !self.deadline() || !self.targetValue()) return false;
    var params = {
      bet_type: COUNTER_BET[self.betType],
      feed_address: self.feed().source,
      target_value: self.targetValue(),
      deadline: self.deadline(),
      leverage: 5040,

    };

    var onCounterbetsLoaded = function(data) {
      $.jqlog.debug(data);
      $.jqlog.debug('data');
      // prepare data for display. TODO: optimize, all in one loop
      var displayedData = []
      for (var b = data.length-1; b>=0; b--) {
        bet = {}
        bet.deadline_str = timestampToString(data[b].deadline);
        bet.ratio = reduce(data[b].wager_quantity, data[b].counterwager_quantity).join('/');
        bet.multiplier = parseInt(data[b].wager_quantity)/parseInt(data[b].counterwager_quantity);
        bet.multiplier = Math.floor(bet.multiplier*100) / 100;
        bet.wager = satoshiToXCP(data[b].wager_remaining);
        bet.wager_remaining = data[b].wager_remaining;
        bet.tx_index = data[b].tx_index;
        bet.bet_count = 1;
        displayedData.push(bet);
      }
      var displayedData2 = [];
      if (displayedData.length>0) {
        // sort by multiplier desc   
        displayedData.sortBy("-multiplier");
        // agregate bets
        displayedData2 = [displayedData[0]];
        for (var b = 1; b < displayedData.length; b++) {
          if (displayedData[b].multiplier == displayedData[b-1].multiplier) {
            var i = displayedData2.length-1;
            displayedData2[i].wager_remaining += displayedData[b].wager_remaining;
            displayedData2[i].wager = satoshiToXCP(displayedData2[i].wager_remaining);
            displayedData2[i].bet_count += displayedData[b].bet_count;
          } else {
            displayedData2.push(displayedData[b]);
          }
        }
        // calculate volume
        for (var b = 0; b < displayedData2.length; b++) {
          var previousVolume = 0;
          if (b>0) displayedData2[b].volume = displayedData2[b-1].volume + displayedData2[b].wager_remaining;
          else displayedData2[b].volume = displayedData2[b].wager_remaining;
          displayedData2[b].volume_str = satoshiToXCP(displayedData2[b].volume);
        }
      }

      self.counterBets(displayedData2);
      if (displayedData2.length>0) {
        self.selectCounterbet(displayedData2[0]);
      } else {
        self.counterwager(1);
        self.odd(1);
      }
      
    }

    failoverAPI('get_bets', params, onCounterbetsLoaded);
  }

  self.selectCounterbet = function(counterbet) {
    $.jqlog.debug(counterbet);
    var cw = self.wager() * counterbet.multiplier;
    cw = Math.floor(cw*10000) / 10000;

    self.counterwager(cw);
    self.odd(counterbet.multiplier);
    //self.deadline(counterbet.deadline * 1000);
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
      deadline: Math.round(self.deadline()),
      wager: denormalizeQuantity(self.wager()),
      counterwager: denormalizeQuantity(self.counterwager()),
      expiration: parseInt(self.expiration()),
      target_value: self.targetValue(),
      leverage: 5040
    }
    $.jqlog.debug(params);

    var onSuccess = function(txHash, data, endpoint) {
      bootbox.alert("<b>Your funds were sent successfully.</b> " + ACTION_PENDING_NOTICE);
    }

    WALLET.doTransaction(self.sourceAddress(), "create_bet", params, onSuccess);
    self.shown(false);
  }

  self.getVolumeFromOdd = function(value) {
    var books = self.counterBets();
    if (books.length==0) return 0;
    var volume = 0;
    for (var i=0; i<books.length; i++) {
      if (books[i].multiplier>=value) {
        volume = books[i].volume;
      } else {
        break;
      }
    }
    return volume;
  }

  self.updateMatchingVolume = function() {
    var odd = self.odd();
    var wager = self.wager();
    var volume = self.getVolumeFromOdd(odd) / UNIT;
    var matching = Math.min(volume, wager);
    var opening = wager - matching

    self.matchingVolume(matching);
    self.openingVolume(opening);

    $.jqlog.debug('updateMatchingVolume');
    $.jqlog.debug(odd+ ' , '+wager);
  }

}


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
