
function RpsViewModel() {

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
      message: 'Wager entered exceeds the address balance.',
      params: self
    }    
  }

  var defaul_wagers = [
    { wager: 1, game_count: 0, picto: 'bronze'},
    { wager: 2, game_count: 0, picto: 'silver'},
    { wager: 5, game_count: 0, picto: 'gold'}
  ];

  self.addressesLabels = {};
  self.balances = {};
  self.updatingOpenGames = false;

  self.rpssl = ko.observableArray([
    {name: 'rock', value: 1, win:[3, 5], lose:[2, 4]},
    {name: 'paper', value: 2, win:[1, 4], lose:[3, 5]},
    {name: 'scissors', value: 3, win:[2, 5], lose:[1, 4]},
    {name: 'spock', value: 4, win:[1, 3], lose:[2, 5]},
    {name: 'lizard', value: 5, win:[2, 4], lose:[1, 3]}
  ]);

  self.move_names = ['NA', 'Rock', 'Paper', 'Scissors', 'Spock', 'Lizard'];

  self.wagers = ko.observableArray(0);
  self.move = ko.observable(null);
  
  self.playLabel = ko.observable('');
  self.myGames = ko.observableArray(null);
  self.possibleMoves = ko.observable(3);

  self.sourceAddress = ko.observable(null).extend(wagerValidator);
  self.availableAddresses = ko.observableArray([]);

  self.wager = ko.observable(null).extend(wagerValidator);;

  self.expiration = ko.observable(500).extend({
    required: true,
    isValidPositiveInteger: self
  });

  self.move.subscribe(function() { self.updatePlayLabel(); });
  self.wager.subscribe(function() { self.updatePlayLabel(); });
  self.possibleMoves.subscribe(function() { self.onChangeGameType(); });

  self.showAdvancedOptions = ko.observable(false);

  self.showAdvancedOptions.subscribe(function(value) { 
    if (value) {
      $('#rps .wager-groups .radioBtn.active, #rps .wager-groups .radioBtn.active input.active').removeClass('active');
    }
  });

  self.pendingRPS = ko.observable(false);

  self.validationModel = ko.validatedObservable({
    wager: self.wager,
    expiration: self.expiration
  });

  self.onChangeGameType = function() {
    self.move(null);
    self.wager(null);
    self.playLabel('');
    $(".rps-image").removeClass('selectedMove').removeClass('win').removeClass('lose');
    $('#rps span.invalid').hide();
    self.updateOpenGames();

  }

  self.toggleGame = function() {
    if (self.possibleMoves() == 3) {
      $('#rps div.rpsButton').addClass('rps5');
      self.possibleMoves(5);
    } else {
      $('#rps div.rpsButton').removeClass('rps5');
      self.possibleMoves(3);
    } 
  }

  self.init = function() {

    self.onChangeGameType();

    var wallet_adressess = WALLET.getAddressesList(true);

    self.availableAddresses([]);
    self.balances = {};
    var options = []
    var maxBalance = wallet_adressess[0][2];
    var maxAddress = wallet_adressess[0][0];
    
    for (var i = 0; i < wallet_adressess.length; i++) {
      self.addressesLabels[wallet_adressess[i][0]] = wallet_adressess[i][1];
      options.push({
        address: wallet_adressess[i][0], 
        label: wallet_adressess[i][1] + ' (' + wallet_adressess[i][2] + ' ' + XCP + ')'
      });
      self.balances[wallet_adressess[i][0]] = wallet_adressess[i][2];
      if (wallet_adressess[i][2] > maxBalance) {
        maxBalance = wallet_adressess[i][2];
        maxAddress = wallet_adressess[i][0];
      }
    }
    self.availableAddresses(options);
    self.sourceAddress(maxAddress);

    if (PENDING_ACTION_FEED.pendingRPS()) {
      self.pendingRPS(true);
    }
  }

  self.updateOpenGames = function() {
    if (self.updatingOpenGames == false) {
      self.updatingOpenGames = true;
      failoverAPI('get_open_rps_count', {'possible_moves': self.possibleMoves(),'exclude_addresses': WALLET.getAddressesList()}, self.displayOpenGames); 
      failoverAPI('get_user_rps', {'addresses': WALLET.getAddressesList()}, self.displayUserGames); 
    }
     
  }

  self.displayOpenGames = function(data) {
    var countByWager = {};
    for (var i in data) {
      game = data[i];
      countByWager[normalizeQuantity(game.wager)] = game.game_count;
    }
    
    var newWagers = [];
    for (var i in defaul_wagers) {
      var w = defaul_wagers[i].wager;
      newWagers[i] = {
        wager: w,
        game_count: countByWager[w] || 0,
        picto: defaul_wagers[i].picto
      };
      newWagers[i].game_count += "";
    } 

    self.wagers(newWagers);
  }

  self.displayUserGames = function(data) {
    var classes = {
      'win': 'success',
      'open': 'primary',
      'pending': 'primary',
      'tie': 'warning',
      'lose': 'danger',
    };

    var games = [];
    var displayWarning = false;

    for (var i in data) {

      if ((data[i]['status'] == 'pending' && data[i]['move'] == 0) || data[i]['status'] == 'open') {
        displayWarning = true;
      } 
      var game = {};

      game['status_html'] = '<span class="label label-'+classes[data[i]['status']]+'">'+data[i]['status']+'</span>';
      game['block_index'] = data[i]['block_index'];
      game['address_label'] = self.addressesLabels[data[i]['address']] || data[i]['address'];
      game['wager'] = normalizeQuantity(data[i]['wager']) + ' ' + XCP;
      game['move_str'] = self.move_names[data[i]['move']];
      game['countermove_str'] = self.move_names[data[i]['counter_move']];
      if (data[i]['possible_moves'] == 3) {
        game['game_type'] = 'RPS'
      } else if (data[i]['possible_moves'] == 5) {
        game['game_type'] = 'RPSSL'
      } else {
        game['game_type'] = data[i]['possible_moves']+ 'moves'
      }
      if (data[i]['status'] == 'pending' || data[i]['status'] == 'open') {
        game['expiration'] = '~ ' + expireDate(data[i]['expiration']) + ' (' + data[i]['expiration'] + ')';
      } else {
        game['expiration'] = '-';
      }
      
      games.push(game);
    }
    self.pendingRPS(displayWarning);
    $('#myRpsTable').dataTable().fnClearTable();
    self.myGames(games);
    runDataTables('#myRpsTable', true, {
      "aaSorting": [[1, 'desc']]
    });
    self.updatingOpenGames = false;
  }

  self.updatePlayLabel = function(value) {
    if (self.wager() && self.move()) {
      self.playLabel('Play <b>' + self.wager() + ' ' + XCP + '</b> on <b>' + self.move().name.toUpperCase() + '</b>');
    } else {
      self.playLabel('');
    }
  }

  self.selectMove = function(move) {
    if (self.move() == null || self.move().value != move.value) {
      $(".rps-image").removeClass('selectedMove').removeClass('win').removeClass('lose');
      $(".rps-image[rel='"+move.value+"']").addClass('selectedMove');
      for (var m in move.win) {
        $(".rps-image[rel='"+move.win[m]+"']").addClass('win');
      }
      for (var m in move.lose) {
        $(".rps-image[rel='"+move.lose[m]+"']").addClass('lose');
      }
      self.move(move);
    } else {
      self.move(null);
      self.playLabel('');
      $(".rps-image").removeClass('selectedMove').removeClass('win').removeClass('lose');
    }
  }

  self.generateMoveRandomHash = function(move) {
    var moveHex = Number(move).toString(16);
    while (moveHex.length<4) moveHex = '0' + moveHex;
    random = genRandom();
    return {"move": move, "random": random, "move_random_hash": doubleHash(random+moveHex)};
  }

  self.doAction = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }

    if (self.balances[self.sourceAddress()] < self.wager()) {
      bootbox.alert("None of your addresses contain enough " + XCP);
      return false;
    }
    var moveParams = self.generateMoveRandomHash(self.move().value);
    moveParams['source'] = self.sourceAddress();

    var param = {
      source: self.sourceAddress(),
      wager: denormalizeQuantity(self.wager()),
      possible_moves: parseInt(self.possibleMoves()),
      expiration: parseInt(self.expiration()),
      move_random_hash: moveParams['move_random_hash']
    }
    var onSuccess = function(txHash, data, endpoint, addressType, armoryUTx) {
      MESSAGE_FEED.setOpenRPS(self.sourceAddress(), txHash, moveParams);

      var warn = '<b class="errorColor">Please stay logged in so that the game(s) can be properly resolved.' 
      warn += ' Once your game has been matched, it will take one more block for the game to complete.'
      warn += ' Be careful, if you close the Wallet before the end of the game you can lose money!!</b><br />';
      
      var message = "<b>You " + (armoryUTx ? "will be placing" : "have placed") + self.wager() + " XCP on "
        + self.move().name.toUpperCase() + ".</b> " + warn;
      
      self.init();
      self.pendingRPS(true);
      WALLET.showTransactionCompleteDialog(message + ACTION_PENDING_NOTICE, message, armoryUTx);
    }
    WALLET.doTransaction(self.sourceAddress(), "create_rps", param, onSuccess);
    return false; 
  }

}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
