function BalanceHistoryViewModel() {
  //An address on a wallet
  var self = this;
  self.selectedAsset = ko.observable('');
  self.availableAssets = !USE_TESTNET ? ko.observableArray([XCP, BTC]) : ko.observableArray([XCP]);
  //^ don't load BTC as an asset on testnet, since we can't show the data (since blockchain doesn't support testnet)
  self.graphData = null;
  self.ASSET_LASTCHANGE = null;
  
  self.init = function() {
    //contact server for list of all assets at the addresses we have
    failoverAPI("get_owned_assets", { addresses: WALLET.getAddressesList() }, function(data, endpoint) {
      var otherAssets = [];
      for(var i = 0; i < data.length; i++) {
        otherAssets.push(data[i]['asset']); //asset ID (e.g. "FOOBAR")
      }
      otherAssets.sort();
      self.availableAssets(self.availableAssets().concat(otherAssets));
      //^ this way, XCP and BTC stay at the top, but the other assets are alphabetically sorted
    });
    //the first asset will be automatically selected by default
    //assetChanged doesn't seem to autotrigger at least with chrome...manually invoke it
    self.assetChanged();
  }
  
  self.assetChanged = function() {
    if(self.selectedAsset() == self.ASSET_LASTCHANGE) return;
    self.ASSET_LASTCHANGE = self.selectedAsset();
    $.jqlog.debug("Balance history: Token changed: " + self.selectedAsset());
    
    if(self.selectedAsset() == BTC) { //mainnet only (as we use blockchain.info for this and they don't support testnet)
      var addresses = WALLET.getAddressesList();
      self.graphData = [];
      
      for(var i=0; i < addresses.length; i++) {
        //since we don't track BTC balances, we need to go to blockchain.info for that
        //$.getJSON("http://blockchain.info/charts/balance", {format: 'json', address: addresses[i], cors: 'true'}, function(data, textStatus, jqXHR) {
        var q = 'select * from html where url="http://blockchain.info/charts/balance?format=json&address='+addresses[i]+'"';
        $.queryYQL(q, function(data, textStatus, jqXHR) {
          var address = /address%3D([A-Za-z0-9]+)%22/g.exec(jqXHR.url)[1];
          var decodedData = null;

          //decodedData = data['values'];
          //YQL
          try {
            decodedData = $.parseJSON(data['query']['results']['body']['p'].trim())['values'];
          } catch(err) {
            decodedData = [];
          }
          //End YQL
          
          var addressHash = hashToB64(address);
          var addressName = PREFERENCES['address_aliases'][addressHash] ? "<b>" + PREFERENCES['address_aliases'][addressHash] + "</b> (" + address + ")" : address; 
          self.graphData.push({'name': addressName, 'data': decodedData});
          if(self.graphData.length == addresses.length) {
            self.doChart();
          }
        }).error(function(jqXHR, textStatus, errorThrown) {
          var address = /address%3D([A-Za-z0-9]+)%22/g.exec(jqXHR.url)[1];
          var addressHash = hashToB64(address);
          $.jqlog.debug( "Could not get " + BTC + " balance from blockchain for address " + address + ": " + errorThrown);
          var addressName = PREFERENCES['address_aliases'][addressHash] ? "<b>" + PREFERENCES['address_aliases'][addressHash] + "</b> (" + address + ")" : address; 
          self.graphData.push({'name': addressName, 'data': []});
          if(self.graphData.length == addresses.length) {
            self.doChart();
          }
        });
      }
    } else {
      //contact server for balances across all addresses in our wallet that have this asset
      failoverAPI("get_balance_history", {asset: self.selectedAsset(), addresses: WALLET.getAddressesList(), }, function(data, endpoint) {
        var i = null, j = null, addressHash = null;
        for(i=0; i < data.length; i++) {
          data[i]['name'] = getAddressLabel(data[i]['name']);
        }
        self.graphData = data;
        self.doChart();
      });
    }
  }
  
  self.doChart = function() {
    $('#balanceHistory').highcharts({
        chart: {
          type: 'line',
          zoomType: 'x',
          spacingRight: 20
        },      
        title: {
          text: 'Your Balances for Asset ' + self.selectedAsset(),
          x: -20 //center
        },
        xAxis: {
          type: 'datetime',
          //maxZoom: 10 * 24 * 3600000, // ten days
          title: {
            text: null
          },
          dateTimeLabelFormats: { // don't display the dummy year
            month: '%e. %b',
            year: '%b'
          }            
        },
        yAxis: {
          title: {
              text: 'Quantity'
          },
          plotLines: [{
              value: 0,
              width: 1,
              color: '#808080'
          }]
        },
        tooltip: {
          shared: true,
          valueSuffix: " " + self.selectedAsset()
        },
        credits: {
          enabled: false
        },
        series: self.graphData
    });    
  }
}

function TransactionHistoryItemViewModel(data) {
  if (data['status'] && data['status']=='expired') {
    $.jqlog.debug(data);
  }

  var self = this;
  self.DATA = data;
  self.TX_INDEX = self.DATA['tx_index'] || self.DATA['tx1_index'] || '';
  self.TX_HASH = self.DATA['tx_hash'] || self.DATA['order_hash'] || self.DATA['id'] || '';
  self.BLOCK_INDEX = self.DATA['block_index'] || self.DATA['tx1_block_index'];
  self.BLOCK_TIME = self.DATA['_block_time'];
  self.RAW_TX_TYPE = self.DATA['_category'];
  self.SOURCE = self.DATA['source'] || self.DATA['address'] || self.DATA['issuer'] || '';
  
  self.dispTXHash = function() {
    return getTxHashLink(self.TX_HASH);
  }

  self.dispBlockIndex = function() {
    return getLinkForBlock(self.BLOCK_INDEX);
  }
  
  self.dispSource = function() {
    return getLinkForCPData('address', self.SOURCE,  getAddressLabel(self.SOURCE));
  }

  //self.btcQuantity = TODO
  //self.fee = TODO
  
  self.dispBlockTime = function() {
    return moment(self.BLOCK_TIME).format("YYYY/MM/DD hh:mm:ss A") + ' ---- ' + moment(self.BLOCK_TIME).format("YYYY/MM/DD hh:mm:ss A Z");
  };
  
  self.dispTxType = function() {
    return ENTITY_NAMES[self.DATA['_category']] + "&nbsp;&nbsp;<i class=\"fa " + ENTITY_ICONS[self.DATA['_category']] + "\"></i>&nbsp;";
  }
  
  self.dispDescription = function() {
    //TODO: this display of data is very elementary and basic. IMPROVE greatly in the future...
    var desc = "";
    if(self.RAW_TX_TYPE == 'burns') {
      desc = XCP + " Proof-of-Burn<br/>Burned: <Am>" + normalizeQuantity(self.DATA['burned']) + "</Am> <As>" + BTC + "</As><br/>"
        + "Earned: <Am>" + smartFormat(normalizeQuantity(self.DATA['earned']) ) + "</Am> <As>" + XCP + "</As>";
    } else if(self.RAW_TX_TYPE == 'sends') {
      desc = "Send of <Am>" + smartFormat(normalizeQuantity(self.DATA['quantity'], self.DATA['_divisible'])) + "</Am> <As>" + self.DATA['asset']
        + "</As> to <Ad>" + getLinkForCPData('address', self.DATA['destination'], getAddressLabel(self.DATA['destination'])) + "</Ad>";
    } else if(self.RAW_TX_TYPE == 'orders') {
      desc = "Sell <Am>" + smartFormat(normalizeQuantity(self.DATA['give_quantity'], self.DATA['_give_asset_divisible']))
        + "</Am> <As>" + self.DATA['give_asset'] + "</As> for <Am>"
        + smartFormat(normalizeQuantity(self.DATA['get_quantity'], self.DATA['_get_asset_divisible'])) + "</Am> <As>"
        + self.DATA['get_asset'] + "</As>";
    } else if(self.RAW_TX_TYPE == 'order_matches') {
      desc = "<Ad>" + getAddressLabel(self.DATA['tx0_address']) + "</Ad> sent <Am>"
        + smartFormat(normalizeQuantity(self.DATA['forward_quantity'], self.DATA['_forward_asset_divisible']))
        + "</Am> <As>" + self.DATA['forward_asset'] + "</As><br/>"
        + "<Ad>" + getAddressLabel(self.DATA['tx1_address']) + "</Ad> sent <Am>"
        + smartFormat(normalizeQuantity(self.DATA['backward_quantity'], self.DATA['_backward_asset_divisible']))
        + "</Am> <As>" + self.DATA['backward_asset'] + "</As>";
      if(self.DATA['forward_asset'] == BTC || self.DATA['backward_asset'] == BTC) {
        desc += " <b>(pending BTCpay)</b>";
      }
    } else if(self.RAW_TX_TYPE == 'btcpays') {
      desc = "Payment for <Am>" + smartFormat(normalizeQuantity(self.DATA['btc_amount'])) + "</Am> <As>" + BTC + "</As>";
    } else if(self.RAW_TX_TYPE == 'issuances') {
      if(self.DATA['transfer']) {
        desc = "Token <As>" + self.DATA['asset'] + "</As> transferred to <Ad>"
          + getLinkForCPData('address', self.DATA['issuer'], getAddressLabel(self.DATA['issuer'])) + "</Ad>";
      } else if(self.DATA['locked']) {
        desc = "Token <As>" + self.DATA['asset'] + "</As> locked against additional issuance";
      } else {
        desc = "Quantity <Am>" + smartFormat(normalizeQuantity(self.DATA['quantity'], self.DATA['divisible']))
          + "</Am> of token <As>" + self.DATA['asset'] + "</As> issued";
      }
    } else if(self.RAW_TX_TYPE == 'broadcasts') {
      desc = "Text: " + self.DATA['text'] + "<br/>Value: " + self.DATA['value'];
    } else if(self.RAW_TX_TYPE == 'bets') {
      desc = BET_TYPES[self.DATA['bet_type']] + " bet on feed @ <Ad>"
        + getLinkForCPData('address', self.DATA['feed_address'], getAddressLabel(self.DATA['feed_address'])) + "</Ad><br/>"
        + "Odds: <b>" + reduce(self.DATA['wager_quantity'], self.DATA['counterwager_quantity']).join('/') + "</b>, Wager: <Am>"
        + smartFormat(normalizeQuantity(self.DATA['wager_quantity'])) + "</Am> <As>" + XCP + "</As>, Counterwager: <Am>"
        + smartFormat(normalizeQuantity(self.DATA['counterwager_quantity'])) + "</Am> <As>" + XCP + "</As>";  
    } else if(self.RAW_TX_TYPE == 'bet_matches') {
      desc = "For feed @ <Ad>" 
        + getLinkForCPData('address', self.DATA['feed_address'], getAddressLabel(self.DATA['feed_address']))
        + "</Ad>, <Ad>" + getAddressLabel(self.DATA['tx0_address']) + "</Ad> bet <Am>"
        + smartFormat(normalizeQuantity(self.DATA['forward_quantity'])) + "</Am> <As>" + XCP + "</As> and <Ad>"
        + getAddressLabel(self.DATA['tx1_address']) + "</Ad> bet <Am>"
        + smartFormat(normalizeQuantity(self.DATA['backward_quantity'])) + "</Am> <As>" + XCP + "</As>";
    } else if(self.RAW_TX_TYPE == 'dividends') {
      desc = "Paid <Am>" + smartFormat(normalizeQuantity(self.DATA['quantity_per_unit'])) + "</Am> <As>"+ self.DATA['dividend_asset']
        + "</As> per unit of token <As>" + self.DATA['asset'] + "</As>";
    } else if(self.RAW_TX_TYPE == 'cancels') {
      desc = "Order/Bet <b>" + data['offer_hash'] + "</b> cancelled.";
    } else if(self.RAW_TX_TYPE == 'callbacks') {
      desc = "<Am>" + (self.DATA['fraction'] * 100).toFixed(4) + "%</Am> outstanding called back for token <As>" + self.DATA['asset'] + "</As>";
    } else if(self.RAW_TX_TYPE == 'bet_expirations') {
      desc = "Bet <b>" + self.DATA['bet_index'] + "</b> expired";
    } else if(self.RAW_TX_TYPE == 'order_expirations') {
      desc = "Order <b>" + self.DATA['order_index'] + "</b> expired";
    } else if(self.RAW_TX_TYPE == 'bet_match_expirations') {
      desc = "Bet Match <b>" + self.DATA['bet_match_id'] + "</b> expired";
    } else if(self.RAW_TX_TYPE == 'order_match_expirations') {
      desc = "Order Match <b>" + self.DATA['order_match_id'] + "</b> expired";
    } else if(self.RAW_TX_TYPE == 'credits' || self.RAW_TX_TYPE == 'debits') {
      desc = "Address <Ad>" + getLinkForCPData('address', self.DATA['address'], getAddressLabel(self.DATA['address'])) + "</Ad>"
        + (self.RAW_TX_TYPE == 'credits' ? ' credited with ' : ' debited for ')
        + smartFormat(normalizeQuantity(self.DATA['quantity'], self.DATA['_divisible']))
        + "</Am> <As>" + self.DATA['asset'] + "</As>";
    } else if(self.RAW_TX_TYPE == 'rps') {
      desc = "Rock-Paper-Scissors bet, Wager: <Am>"
        + smartFormat(normalizeQuantity(self.DATA['wager'])) + "</Am> <As>" + XCP + "</As>";  
    } else if(self.RAW_TX_TYPE == 'rps_matches') {
      desc = "Rock-Paper-Scissors bet matched between <Ad>" + getAddressLabel(self.DATA['tx0_address']) + "</Ad> and <Ad>"
        + getAddressLabel(self.DATA['tx1_address']) + "</Ad>, wagering <Am>"
        + smartFormat(normalizeQuantity(self.DATA['wager'])) + "</Am> <As>" + XCP + "</As>";
    } else if(self.RAW_TX_TYPE == 'rpsresolves') {
      desc = "Rock-Paper-Scissors bet match <b>" + getTxHashLink(self.DATA['rps_match_id']) + "</b> resolved, source: <Ad>"
        + getAddressLabel(self.DATA['source']) + "</Ad>, winning move is <b>" + self.DATA['move'] + "</b>";
    } else if(self.RAW_TX_TYPE == 'rps_expirations') {
      desc = "RPS <b>" + self.DATA['rps_index'] + "</b> expired";
    } else if(self.RAW_TX_TYPE == 'rps_match_expirations') {
      desc = "RPS Match <b>" + getTxHashLink(self.DATA['rps_match_id']) + "</b> expired";
    } else {
      desc = "UNKNOWN TRANSACTION TYPE";
    }

    desc = desc.replace(/<Am>/g, '<b class="notoQuantityColor">').replace(/<\/Am>/g, '</b>');
    desc = desc.replace(/<Ad>/g, '<b class="notoAddrColor">').replace(/<\/Ad>/g, '</b>');
    desc = desc.replace(/<As>/g, '<b class="notoAssetColor">').replace(/<\/As>/g, '</b>');
    return desc;
  };
}

var HistoryAddressInDropdownItemModel = function(address, label) {
  this.ADDRESS = address;
  this.LABEL = '<b>' + label + "</b> (" + address + ")";
};
    
function TransactionHistoryViewModel() {
  var self = this;
  self._lastWindowWidth = null;
  self.selectedAddress = ko.observable('');
  self.availableAddresses = ko.observableArray([]); //stores HistoryAddressInDropdownItemModel objects
  self.transactions = ko.observableArray([]);
  self.ADDRESS_LASTCHANGE = null;
  
  self.init = function() {
    //populate addresses
    var addresses = WALLET.getAddressesList(true);
    for(var i = 0; i < addresses.length; i++) {
      self.availableAddresses.push(new HistoryAddressInDropdownItemModel(addresses[i][0], addresses[i][1]));
    }
    self.availableAddresses.sort(function(left, right) {
      return left.LABEL == right.LABEL ? 0 : (left.LABEL < right.LABEL ? -1 : 1)
    });
    //the first address will be automatically selected by default
    //addressChanged will naturally trigger on load
  }
  
  self.selectedAddress.subscribeChanged(function(newSelection, prevSelection) {
    if(newSelection == self.ADDRESS_LASTCHANGE) return; //just in case for screwy browsers...
    self.ADDRESS_LASTCHANGE = newSelection;
    $.jqlog.debug("Recent Transactions: Address changed called: " + newSelection);

    $('#txnHistoryLoading').show();
    $('#wid-id-txnHistory header span.jarviswidget-loader').show();
    self.transactions([]);
    $('#txnHistory').dataTable().fnClearTable();
    $('#txnHistory_wrapper').hide();
    failoverAPI("get_raw_transactions", {address: newSelection}, function(data, endpoint) {
      //clear table data and populate with the new data (which comes in the order of newest to oldest)
      for(var i = 0; i< data.length; i++) {
        self.transactions.push(new TransactionHistoryItemViewModel(data[i])); 
      }
      runDataTables('#txnHistory', true, {
        "aaSorting": [ [1, 'desc'], [0, 'desc'] ]
      });
      $('#txnHistory_wrapper').show();
      $('#wid-id-txnHistory header span.jarviswidget-loader').hide();
      $('#txnHistoryLoading').hide();
    });
  });
  
  self.dataTableResponsive = function(e) {
    // Responsive design for our data tables and more on this page
    var newWindowWidth = $(window).width();
    
    if(self._lastWindowWidth && newWindowWidth == self._lastWindowWidth) return;
    self._lastWindowWidth = newWindowWidth;

    if($('#txnHistory').hasClass('dataTable')) {
      var txnHistory = $('#txnHistory').dataTable();
      if(newWindowWidth < 1250) { //hide some...
        txnHistory.fnSetColumnVis(1, false); //hide block
        txnHistory.fnSetColumnVis(2, false); //hide blocktime
      }
      if(newWindowWidth >= 1250) { //show it all, baby
        txnHistory.fnSetColumnVis(1, true); //show block
        txnHistory.fnSetColumnVis(2, true); //show blocktime
      }
      txnHistory.fnAdjustColumnSizing();
    }
  }
}


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
