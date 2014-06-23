
function RpsViewModel() {

  var self = this;

  var defaul_wagers = [
    { wager: 0.1, game_count: 0},
    { wager: 0.2, game_count: 0},
    { wager: 0.5, game_count: 0},
    { wager: 1, game_count: 0},
    { wager: 2, game_count: 0},
    { wager: 5, game_count: 0},
    { wager: 10, game_count: 0},
    { wager: 20, game_count: 0},
    { wager: 50, game_count: 0},
    { wager: 100, game_count: 0} 
  ];

  self.addressesLabels = {};

  self.rpssl = ko.observableArray([
    {name: 'rock', value: 1, win:[3, 5], lose:[2, 4]},
    {name: 'paper', value: 2, win:[1, 4], lose:[3, 5]},
    {name: 'scissors', value: 3, win:[2, 5], lose:[1, 4]},
    {name: 'spock', value: 4, win:[1, 3], lose:[2, 5]},
    {name: 'lizard', value: 5, win:[2, 4], lose:[1, 3]}
  ]);

  self.move_names = ['NA', 'Rock', 'Paper', 'Scissors', 'Spock', 'Lizard'];

  self.wagers = ko.observableArray(null);
  self.move = ko.observable(null);
  self.wager = ko.observable(null);
  self.playLabel = ko.observable('');
  self.expiration = ko.observable(10);
  self.myGames = ko.observableArray(null);

  self.move.subscribe(function() { self.updatePlayLabel(); });
  self.wager.subscribe(function() { self.updatePlayLabel(); });

  self.init = function() {
    self.move(null);
    self.wager(null);
    self.playLabel('');
    self.updateOpenGames();
    var wallet_adressess = WALLET.getAddressesList(true);
    for (var i = 0; i < wallet_adressess.length; i++) {
      self.addressesLabels[wallet_adressess[i][0]] = wallet_adressess[i][1];
    }
  }

  self.updateOpenGames = function() {
    failoverAPI('get_open_rps_count', {'exclude_addresses': WALLET.getAddressesList()}, self.displayOpenGames); 
    failoverAPI('get_user_rps', {'addresses': WALLET.getAddressesList()}, self.displayUserGames); 
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
        game_count: countByWager[w] || 0
      };
      newWagers[i].game_count += "";
    } 
    $.jqlog.debug('newWagers');
    $.jqlog.debug(newWagers);

    self.wagers(newWagers);
  }

  self.displayUserGames = function(data) {
    $.jqlog.debug(data);
    var classes = {
      'win': 'success',
      'open': 'primary',
      'pending': 'primary',
      'tie': 'warning',
      'lose': 'danger',
    };

    var games = [];
    for (var i in data) {
      var game = {};

      game['status_html'] = '<span class="label label-'+classes[data[i]['status']]+'">'+data[i]['status']+'</span>';
      game['block_index'] = data[i]['block_index'];
      game['address_label'] = self.addressesLabels[data[i]['address']] || data[i]['address'];
      game['wager'] = normalizeQuantity(data[i]['wager']) + ' XCP';
      game['move_str'] = self.move_names[data[i]['move']];
      game['countermove_str'] = self.move_names[data[i]['counter_move']];
      games.push(game);
    }
    self.myGames(games);
    var myRpsTable = $('#myRpsTable').dataTable();
  }

  self.updatePlayLabel = function(value) {
    if (self.wager() && self.move()) {
      self.playLabel('Play <b>' + self.wager() + ' XCP</b> on <b>'+self.move().name.toUpperCase() + '</b>');
    }
  }

  self.selectMove = function(move) {
    $.jqlog.debug(move);
    $(".rps-image").removeClass('selectedMove').removeClass('win').removeClass('lose');
    $(".rps-image[rel='"+move.value+"']").addClass('selectedMove');
    for (var m in move.win) {
      $(".rps-image[rel='"+move.win[m]+"']").addClass('win');
    }
    for (var m in move.lose) {
      $(".rps-image[rel='"+move.lose[m]+"']").addClass('lose');
    }
    self.move(move)
  }

  self.generateMoveRandomHash = function(move) {
    var moveHex = Number(move).toString(16);
    while (moveHex.length<4) moveHex = '0' + moveHex;
    random = genRandom();
    return {"move": move, "random": random, "move_random_hash": doubleHash(random+moveHex)};
  }

  self.doAction = function() {
    $.jqlog.debug('doAction');

    var address = WALLET.getBiggestXCPBalanceAddress();
    $.jqlog.debug(address);

    if (address.getXCPBalance() < self.wager()) {
      bootbox.alert("None of your addresses contain enough XCP");
      return false;
    }
    var moveParams = self.generateMoveRandomHash(self.move().value);
    moveParams['source'] = address.ADDRESS;
    $.jqlog.debug(moveParams);

    var param = {
      source: address.ADDRESS,
      wager: denormalizeQuantity(self.wager()),
      possible_moves: 5,
      expiration: self.expiration(),
      move_random_hash: moveParams['move_random_hash']
    }
    var onSuccess = function(txHash, data, endpoint) {
      MESSAGE_FEED.OPEN_RPS[txHash] = moveParams;
      bootbox.alert("<b>You are played " + self.wager() + " XCP on " + self.move().name.toUpperCase() + ".</b> " + ACTION_PENDING_NOTICE);
    }
    WALLET.doTransaction(address.ADDRESS, "create_rps", param, onSuccess);
    return false; 
  }

}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
