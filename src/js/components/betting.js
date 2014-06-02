
function FeedBrowserViewModel() {

  var self = this;

  var wagerValidator = {
    required: true,
    isValidPositiveQuantity: self,
    validation: {
      validator: function (val, self) {
        var address = self.sourceAddress();
        var wager = self.wager();
        return parseFloat(wager) <= self.balances[address];
      },
      message: 'Quantity entered exceeds the address balance.',
      params: self
    }    
  }
  
  self.feed = ko.observable(null);
  self.targetValue = ko.observable(0);
  self.targetValueText = ko.observable('');
  self.betType = ko.observable('');
  self.betTypeCounter = ko.observable('');
  self.betTypeLabelBull = ko.observable('Bull');
  self.betTypeLabelBear = ko.observable('Bear');
  self.betTypeLabelEqual = ko.observable('Equal');
  self.betTypeLabelNotEqual = ko.observable('NotEqual');
  self.betTypeText = ko.observable('');
  self.deadline = ko.observable(0);
  self.availableAddresses = ko.observableArray([]);
  self.sourceAddress = ko.observable(null).extend(wagerValidator);
  self.balances = {};
	self.wager = ko.observable(null).extend(wagerValidator);
  self.odd = ko.observable(1);
  self.counterBets = ko.observableArray([]);
  self.selectedCounterBetTx = ko.observable(null);
  self.matchingVolume = ko.observable(0);
  self.openingVolume = ko.observable(0);
  self.fee = ko.observable(0);
  self.showAdvancedOptions = ko.observable(false);
  self.currentStep = ko.observable(0);
  self.greenPercent = ko.observable(20);
  self.feedStats = ko.observableArray([]);
  self.wizardTitle = ko.observable("Select Feed");
  self.selectedTarget = ko.observable(null);
  self.operatorOdds = ko.observable(false);
  self.leverage = ko.observable(LEVERAGE_UNIT);
  self.notAnUrlFeed = ko.observable(false);

  self.counterwager = ko.observable(null).extend({
    required: true,
    isValidPositiveQuantity: self    
  });

  self.feedUrl = ko.observable('').extend({
    required: false,
    isValidUrlOrValidBitcoinAdress: self
  });
  
  self.feedUrl.subscribe(function(val) {
    if (self.feedUrl.isValid()) {
      self.loadFeed();
    }
  });

  self.targetValue.subscribe(function(val) { 	
    if (!self.feed()) return;
    // pepare bet type labels
    if (self.feed().info_data.type=="all" || self.feed().info_data.type=="binary") {
      var labelEqual = 'Equal', labelNotEqual = 'NotEqual', labelTargetValue = 'target_value = '+val;
      if (self.feed().info_data.labels && self.feed().info_data.labels.equal) {
        labelEqual = self.feed().info_data.labels.equal;
        labelNotEqual = self.feed().info_data.labels.not_equal;
      }
      for (var i in self.feed().info_data.targets) {
        if (self.feed().info_data.targets[i].value == val) {
          self.selectedTarget(self.feed().info_data.targets[i]);
          self.deadline(self.feed().info_data.targets[i].deadline);
          if (self.feed().info_data.targets[i].labels) {
            labelEqual = self.feed().info_data.targets[i].labels.equal;
            labelNotEqual = self.feed().info_data.targets[i].labels.not_equal;
            labelTargetValue = self.feed().info_data.targets[i].long_text;        
          }
          break;
        }
      }
      self.betTypeLabelEqual(labelEqual);
      self.betTypeLabelNotEqual(labelNotEqual);
      self.targetValueText(labelTargetValue);
    }
  	
    self.loadCounterBets();
  });

  self.betType.subscribe(function(val) {
  	if (val=='') return;
    if (val == 'Equal') {
      self.betTypeText(self.betTypeLabelEqual());
      self.betTypeCounter(self.betTypeLabelNotEqual());
    } else if (val == 'NotEqual') {
      self.betTypeText(self.betTypeLabelNotEqual());
      self.betTypeCounter(self.betTypeLabelEqual());
    } else if (val == 'BullCFD') {
      self.betTypeText(self.betTypeLabelBull());
      self.betTypeCounter(self.betTypeLabelBear());
    } else if (val == 'BearCFD') {
      self.betTypeText(self.betTypeLabelBear());
      self.betTypeCounter(self.betTypeLabelBull());
    }
  	self.loadCounterBets();
  });

  self.leverage.subscribe(function(val) {
    self.loadCounterBets();
  });

  self.wager.subscribe(function(value) {
    try {
    	var c = mulFloat(self.odd(), value);
      self.counterwager(c);
      var f = mulFloat(divFloat(self.feed().fee_fraction_int, UNIT), value);
      self.fee(f);      
    } catch(e) {
      self.counterwager(0);
      self.fee(0);
    }
    self.updateMatchingVolume();
  });

  self.odd.subscribe(function(value) {
    try {
    	var c = mulFloat(self.wager(), value);
      self.counterwager(c);
    } catch(e) {
      self.counterwager(0);
    }  
    self.updateMatchingVolume();
  });

  self.expiration = ko.observable(1000).extend({
    required: true,
    isValidPositiveInteger: self
  });

  self.counterwager.subscribe(function() {
  	var t = addFloat(self.wager(), self.counterwager())
  	var p = divFloat(t, 100);
  	var g = divFloat(self.wager(), p);  	
  	self.greenPercent(g);
  });

  self.validationModel = ko.validatedObservable({
    wager: self.wager,
    counterwager: self.counterwager,
    expiration: self.expiration
  });

  var leverageListArray = [];
  for (var i=1; i<=100; i++) {
    leverageListArray.push({label: i+'x', value: i*5040});
  }
  self.leverageList = ko.observableArray(leverageListArray);

  $('#feedWizard').bootstrapWizard({
      tabClass: 'form-wizard',
      nextSelector: 'li.next',
      onTabClick: function(tab, navigation, index) {
      	return true; //tab click disabled
      },
      onTabShow: function(tab, navigation, index) {
      	if (index==0) {
      		$('li.previous').addClass('disabled');
			  	$('li.next').show();
			  	$('li.next.finish').hide();
          self.wizardTitle("Select Feed");
      	} else if (index==1) {
      		$('li.previous').removeClass('disabled');
      		$('li.next').show();
			  	$('li.next.finish').hide();
          self.wizardTitle("Enter Bet");
      	} else if (index==2) {
      		$('li.previous').removeClass('disabled');
  				$('li.next').hide();
  				$('li.next.finish').removeClass('disabled').show();
          self.wizardTitle("Confirm Bet");
      	} else {
      		return false;
      	}
      	self.currentStep(index);
      	return true;
      },
      onNext: function (tab, navigation, index) {
      	return true;
      }
   });

  self.init = function() {
  	$('li.next').addClass('disabled');
  	$('li.previous').addClass('disabled');
  	$('li.next.finish').hide();
  }

  self.displayFeed = function(feed) {  
    $.jqlog.debug(feed);
    if (typeof(feed.info_data) == "undefined") {
      self.notAnUrlFeed(true);
      return;
    }

  	// prepare source addresses
  	self.availableAddresses([]);
    self.balances = {};
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

    // feed type
    // TODO: manage type == 'all'

    if (typeof(feed.info_data.targets) == "undefined") {
      feed.info_data.type = 'cfd';
    } else {
      feed.info_data.type = 'binary';
    }
   
    
    // labels for cfd
    if (feed.info_data.type=="cfd") {
      var labelBull = 'Bull', labelBear = 'Bear';
      if (feed.info_data.labels && feed.info_data.labels.bull) {
        labelBull = feed.info_data.labels.bull;
        labelBear = feed.info_data.labels.bear;
      }
      self.betTypeLabelBull(labelBull);
      self.betTypeLabelBear(labelBear);
    }
  	
  	// prepare images url
    feed.info_data.operator.image_url = feed.info_data.operator.valid_image ? feedImageUrl(feed.source + '_owner') : '';
    feed.info_data.image_url = feed.info_data.valid_image ? feedImageUrl(feed.source + '_topic') : '';
    
    if (feed.info_data.type=="cfd") {
      feed.info_data.targets = [{'long_text':''}]; // targets needed in html template. ugly but avoid additonals variables.
      feed.info_data.deadline_str = moment(feed.info_data.next_deadline).format('YYYY/MM/DD hh:mm:ss A Z')
      feed.info_data.date_str = moment(feed.info_data.next_broadcast).format('YYYY/MM/DD hh:mm:ss A Z');
      feed.info_data.broadcast_interval = get_duration(feed.info_data.resolution_date);
      self.deadline(feed.info_data.next_deadline);

    } else {
      for (var i in feed.info_data.targets) {
        // prepare targets
        var image_name = feed.source + '_tv_' + feed.info_data.targets[i].value;
        feed.info_data.targets[i].image_url = feed.info_data.targets[i].valid_image ? feedImageUrl(image_name) : '';
        feed.info_data.targets[i].long_text = feed.info_data.targets[i].text/* + ' (value: ' + feed.info_data.targets[i].value + ')'*/;
        feed.info_data.targets[i].deadline_str = moment(feed.info_data.targets[i].deadline).format('YYYY/MM/DD hh:mm:ss A Z')
      }
      feed.info_data.date_str = moment(feed.info_data.resolution_date).format('YYYY/MM/DD hh:mm:ss A Z');
    }
    
    // prepare fee
    feed.fee = satoshiToPercent(feed.fee_fraction_int);
   
    // prepare counters
    var classes = {
    	'open': 'success',
    	'filled': 'primary',
    	'expired': 'danger'
    };
    for (var i in feed.counters.bets) {
    	feed.counters.bets[i].wager_quantity = normalizeQuantity(feed.counters.bets[i].wager_quantity) + ' XCP';
    	feed.counters.bets[i].wager_remaining = normalizeQuantity(feed.counters.bets[i].wager_remaining) + ' XCP';
    	feed.counters.bets[i].status_html = '<span class="label label-'+classes[feed.counters.bets[i].status]+'">'+feed.counters.bets[i].status+'</span>';

    }
    self.feedStats(feed.counters.bets)
    

    //$.jqlog.debug(feed);
    self.betType(''); // to force change event
    self.targetValue('');

    self.feed(feed);
    self.feedStats(feed.counters.bets);
    
    self.wager(1);
    if (feed.info_data.type == 'binary') {
      self.betType('Equal');
      self.targetValue(feed.info_data.targets[0].value);
    } else {
      self.betType('BullCFD');
      self.targetValue(1);
    }
    
    $('li.next').removeClass('disabled');
  }

  self.loadFeed = function() {
    self.notAnUrlFeed(false);
    failoverAPI('get_feed', {'address_or_url': self.feedUrl()}, self.displayFeed)
  }

  self.loadCounterBets = function() {
    if (!self.betType() ||  !self.feed() || !self.deadline() || (!self.targetValue() && self.feed().info_data.type == 'binary')) return false;
    var params = {
      bet_type: COUNTER_BET[self.betType()],
      feed_address: self.feed().source,    
      deadline: moment(self.deadline()).unix(),
      leverage: self.leverage()
    };
    if (self.feed().info_data.type == 'binary') {
      params.target_value = self.targetValue();
    }
    var onCounterbetsLoaded = function(data) {
      $.jqlog.debug(data);
      // prepare data for display. TODO: optimize, all in one loop
      var displayedData = []
      for (var b = data.length-1; b>=0; b--) {
        bet = {}
        bet.deadline_str = timestampToString(data[b].deadline);
        bet.ratio = reduce(data[b].wager_quantity, data[b].counterwager_quantity).join('/');
        bet.multiplier = divFloat(parseInt(data[b].wager_quantity), parseInt(data[b].counterwager_quantity));
        bet.multiplier = Math.floor(bet.multiplier*100) / 100;
        bet.wager = satoshiToXCP(data[b].wager_remaining);
        bet.wager_remaining = data[b].wager_remaining;
        bet.counterwager_remaining = data[b].counterwager_remaining;
        bet.counterwager = satoshiToXCP(data[b].counterwager_remaining);
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
            displayedData2[i].counterwager_remaining += displayedData[b].counterwager_remaining;
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

          previousVolume = 0;
          if (b>0) displayedData2[b].countervolume = displayedData2[b-1].countervolume + displayedData2[b].counterwager_remaining;
          else displayedData2[b].countervolume = displayedData2[b].counterwager_remaining;

          displayedData2[b].volume_str = satoshiToXCP(displayedData2[b].countervolume);
        }
      }
      self.counterBets(displayedData2);
      self.setDefaultOdds();    
    }

    failoverAPI('get_bets', params, onCounterbetsLoaded);
  }

  self.setDefaultOdds = function() {
    var odds, defaultOdds, overrideOdds;

    if (self.feed().info_data.type=="cfd") {
      if (self.feed().info_data.odds) {
        odds = self.feed().info_data.odds;
      }
    } else {
      if (self.selectedTarget().odds) {
        odds = self.selectedTarget().odds;
      }
    }

    if (odds) {
      if (odds.initial) {
        defaultOdds = self.betType()=='Equal' || self.betType()=='BullCFD' ? odds.initial : divFloat(1, odds.initial);
      }
      if (odds.suggested) {
        overrideOdds = self.betType()=='Equal' || self.betType()=='BullCFD' ? odds.suggested : divFloat(1, odds.suggested);
      }
    } 

    if (overrideOdds && !defaultOdds) {
      defaultOdds = overrideOdds;
    }
    self.operatorOdds(false);
    if (self.counterBets().length>0) {
      if (overrideOdds) {
        self.odd(overrideOdds);
        self.operatorOdds(true);
      } else {
        self.selectCounterbet(self.counterBets()[0]);
      }     
    } else {
      if (defaultOdds) {
        self.odd(defaultOdds);  
        self.operatorOdds(true);      
      } else {
        self.odd(1);
      }      
    }

  }

  self.selectCounterbet = function(counterbet) {
    var cw = mulFloat(self.wager(), counterbet.multiplier);
    cw = Math.floor(cw*10000) / 10000;

    self.counterwager(cw);
    self.odd(counterbet.multiplier);
    self.selectedCounterBetTx(counterbet.tx_index);
    $('#betting #counterbets tr').removeClass('selectedCounterBet');
    $('#cb_'+counterbet.tx_index).addClass('selectedCounterBet');
  }

  self.getVolumeFromOdd = function(value) {
    var books = self.counterBets();
    if (books.length==0) return 0;
    var volume = 0;
    for (var i=0; i<books.length; i++) {
      if (books[i].multiplier>=value) {
        volume = books[i].countervolume;
      } else {
        break;
      }
    }
    return volume;
  }

  self.updateMatchingVolume = function() {
    var odd = self.odd();
    var volume = self.getVolumeFromOdd(odd) / UNIT;
    var wager = self.wager();
    var matching = Math.min(volume, wager);
    var opening = (wager - matching);
    self.matchingVolume(round(matching, 4));
    self.openingVolume(round(opening, 4)); 
  }

  self.nextStep = function() {
  	$('#feedWizard').bootstrapWizard('next');
  }

  self.previousStep = function() {
  	$('#feedWizard').bootstrapWizard('previous');
  }

  self.submitBet = function() {
  	if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    var params = {
      source: self.sourceAddress(),
      feed_address: self.feed().source,
      bet_type: self.betType(),
      deadline: moment(self.deadline()).unix(),
      wager: denormalizeQuantity(self.wager()),
      counterwager: denormalizeQuantity(self.counterwager()),
      expiration: parseInt(self.expiration()),
      target_value: self.targetValue(),
      leverage: 5040
    }
    var onSuccess = function(txHash, data, endpoint) {
      bootbox.alert("<b>Your bet were sent successfully.</b> " + ACTION_PENDING_NOTICE);
    }
    WALLET.doTransaction(self.sourceAddress(), "create_bet", params, onSuccess);
  }

}


function OpenBetsViewModel() {
  self = this;

  self.openBets = ko.observableArray([]);
  self.addressesLabels = {};

  self.init = function() {
    self.addressesLabels = {};
    var wallet_adressess = WALLET.getAddressesList(true);
    var addresses = [];
    for(var i = 0; i < wallet_adressess.length; i++) {
      addresses.push(wallet_adressess[i][0]);
      self.addressesLabels[wallet_adressess[i][0]] = wallet_adressess[i][1];
    }

    var params = {
      'addresses': addresses,
      'status': 'open'
    }
    failoverAPI("get_user_bets", params, self.displayOpenBets);
  }

  self.displayOpenBets = function(data) {
    $.jqlog.debug(data);
    self.openBets([]);
    var bets = [];
    for (var i=0; i<data.bets.length; i++) {
      var bet = {};
      bet.address = data.bets[i].source;
      bet.address_label = self.addressesLabels[bet.address];

      
      if (data.feeds[data.bets[i].feed_address]) {
        var feed = data.feeds[data.bets[i].feed_address];
        bet.feed = feed.info_data.title;
        if (typeof(feed.info_data.targets) != 'undefined') {
          for (var j=0; j<feed.info_data.targets.length; j++) {
            if (feed.info_data.targets[j].value == data.bets[i].target_value) {
              bet.target_value = feed.info_data.targets[j].text;
            }
            if (typeof(feed.info_data.targets[j].labels) != "undefined") {
              bet.bet_type = data.bets[i].bet_type == 2 ? feed.info_data.targets[j].labels.equal : feed.info_data.targets[j].labels.not_equal;
            } else {
              bet.bet_type = BET_TYPES[data.bets[i].bet_type];
            }
          }
        } else {
          bet.target_value = 'NA';
          if (typeof(feed.info_data.labels) != "undefined") {
            bet.bet_type = data.bets[i].bet_type == 0 ? feed.info_data.labels.bull : feed.info_data.labels.bear;
          } else {
            bet.bet_type = BET_TYPES[data.bets[i].bet_type];
          }
        }
      } else {
        bet.feed = data.bets[i].feed_address;
        bet.target_value = data.bets[i].target_value;
        bet.bet_type = BET_TYPES[data.bets[i].bet_type];
      }

      bet.fee = satoshiToPercent(data.bets[i].fee_fraction_int);
      bet.deadline = moment(data.bets[i].deadline*1000).format('YYYY/MM/DD hh:mm:ss A Z')
      bet.wager_quantity = satoshiToXCP(data.bets[i].wager_quantity);
      bet.wager_remaining = satoshiToXCP(data.bets[i].wager_remaining);
      bet.counterwager_quantity = satoshiToXCP(data.bets[i].counterwager_quantity);
      bet.counterwager_remaining = satoshiToXCP(data.bets[i].counterwager_remaining);
      bet.bet_html = '<b>' + bet.bet_type + '</b> on <b>' + bet.target_value + '</b>';
      bets.push(bet);
    }
    self.openBets(bets);
    var openBetsTable = $('#openBetsTable').dataTable();
  }

  
}

function MatchedBetsViewModel() {
  self = this;
  self.matchedBets = ko.observableArray([]);
  self.addressesLabels = {};

  self.init = function() {
    self.addressesLabels = {};
    var wallet_adressess = WALLET.getAddressesList(true); 
    var filters = [];
    for(var i = 0; i < wallet_adressess.length; i++) { 
      self.addressesLabels[wallet_adressess[i][0]] = wallet_adressess[i][1];
      var filter = {
        'field': 'tx0_address',
        'op': '==',
        'value': wallet_adressess[i][0]
      };
      filters.push(filter);
      filter = {
        'field': 'tx1_address',
        'op': '==',
        'value': wallet_adressess[i][0]
      };
      filters.push(filter);
    }

    params = {
      'filters': filters,
      'filterop': 'or',
      'order_by': 'deadline',
      'order_dir': 'desc'
    };
    failoverAPI("get_bet_matches", params, self.displayMatchedBets);
  }

  self.displayMatchedBets = function(data) {
    $.jqlog.debug(data);
    var feed_addresses = {};
    for (var i in data) {
      feed_addresses[data[i].feed_address] = true;
    }
    feed_addresses = Object.keys(feed_addresses);

    var genBetItem = function(data_bet, num_tx, feeds) {
      var bet = {};
      bet.address = data_bet['tx'+num_tx+'_address'];
      bet.address_label = self.addressesLabels[bet.address];
      if (feeds[data_bet.feed_address]) {
        var feed = feeds[data_bet.feed_address];
        bet.feed = feed.info_data.title;
        if (typeof(feed.info_data.targets) != 'undefined') {
          for (var j=0; j<feed.info_data.targets.length; j++) {
            if (feed.info_data.targets[j].value == data_bet.target_value) {
              bet.target_value = feed.info_data.targets[j].text;
            }
            if (typeof(feed.info_data.targets[j].labels) != "undefined") {
              bet.bet_type = data_bet['tx'+num_tx+'_bet_type'] == 2 ? feed.info_data.targets[j].labels.equal : feed.info_data.targets[j].labels.not_equal;
            } else {
              bet.bet_type = BET_TYPES[data_bet['tx'+num_tx+'_bet_type']];
            }
          }
        } else {
          bet.target_value = 'NA';
          if (typeof(feed.info_data.labels) != "undefined") {
            bet.bet_type = data_bet['tx'+num_tx+'_bet_type'] == 2 ? feed.info_data.labels.bull : feed.info_data.labels.bear;
          } else {
            bet.bet_type = BET_TYPES[data_bet['tx'+num_tx+'_bet_type']];
          }
        }

      } else {
        bet.feed = data_bet.feed_address;
        bet.target_value = data_bet.target_value;
        bet.bet_type = BET_TYPES[data_bet['tx'+num_tx+'_bet_type']];
      }
      bet.fee = satoshiToPercent(data_bet.fee_fraction_int);
      bet.deadline = moment(data_bet.deadline*1000).format('YYYY/MM/DD hh:mm:ss A Z')
      if (num_tx=='0') {
        bet.wager = satoshiToXCP(data_bet.forward_quantity);
        bet.counterwager = satoshiToXCP(data_bet.backward_quantity);
      } else {
        bet.wager = satoshiToXCP(data_bet.backward_quantity);
        bet.counterwager = satoshiToXCP(data_bet.forward_quantity);
      }
      if (data_bet.status == 'pending') {
        bet.status = data_bet.status;
      } else {
        var win_bet_type = BET_MATCHES_STATUS[data_bet.status];
        bet.status = win_bet_type == data_bet['tx'+num_tx+'_bet_type'] ? 'win' : 'loose';
      }
      var classes = {
        'win': 'success',
        'pending': 'primary',
        'loose': 'danger'
      };
      bet.status_html = '<span class="label label-'+classes[bet.status]+'">'+bet.status+'</span>';
      return bet;
    }

    var onReceivedFeed = function(feeds) {     
      var bets = [];
      for (var i in data) {
        // one bet_matche can generate 2 lines if both addresses are in the wallet
        if (self.addressesLabels[data[i].tx0_address]) {
          bets.push(genBetItem(data[i], '0', feeds));
        }
        if (self.addressesLabels[data[i].tx1_address]) {
          bets.push(genBetItem(data[i], '1', feeds));
        }
      }
      self.matchedBets(bets);
      var matchedBetsTable = $('#matchedBetsTable').dataTable({
        "order": [ 6, 'asc' ]
      });
    }

    self.matchedBets([]);
    var params = {
      'addresses': feed_addresses
    }
    failoverAPI('get_feeds_by_source', params, onReceivedFeed);
  }
}


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
