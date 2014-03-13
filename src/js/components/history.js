function BalanceHistoryViewModel() {
  //An address on a wallet
  var self = this;
  self.selectedAsset = ko.observable('');
  self.availableAssets = !USE_TESTNET ? ko.observableArray(["XCP", "BTC"]) : ko.observableArray(["XCP"]);
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
    console.log("Balance history: Asset changed: " + self.selectedAsset());
    
    if(self.selectedAsset() == "BTC") { //mainnet only (as we use blockchain.info for this and they don't support testnet)
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
          $.jqlog.log( "Could not get BTC balance from blockchain for address " + address + ": " + errorThrown);
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
              text: 'Amount'
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
  var self = this;
  self.data = data;
  //console.log("data: " + self.data['tx_index'] + " -- " + JSON.stringify(self.data));
  self.txIndex = self.data['tx_index'] || '';
  self.blockIndex = self.data['block_index'];
  self.blockTime = self.data['_block_time'];
  self.rawTxType = self.data['_entity'];
  self.source = self.data['source'] || self.data['address'] || self.data['issuer'] || '';
  
  self.dispSource = function() {
    return getAddressLabel(self.source);
  }
  //self.btcAmount = TODO
  //self.fee = TODO
  
  self.dispBlockTime = function() {
    return moment(self.blockTime * 1000).format("MMM Do YYYY, h:mm:ss a");
  };
  
  self.dispTxType = function() {
    return ENTITY_NAMES[self.data['_entity']] + "&nbsp;&nbsp;<i class=\"fa " + ENTITY_ICONS[self.data['_entity']] + "\"></i>&nbsp;";
  }
  
  self.dispDescription = function() {
    //TODO: this display of data is very elementary and basic. IMPROVE greatly in the future...
    var desc = "";
    if(self.rawTxType == 'burns') {
      desc = "XCP Proof-of-Burn<br/>Burned: " + normalizeAmount(self.data['burned']) + " BTC<br/>"
        + "Earned: " + numberWithCommas(normalizeAmount(self.data['earned']) ) + " XCP";
    } else if(self.rawTxType == 'sends') {
      desc = "Send of " + numberWithCommas(normalizeAmount(self.data['amount'], self.data['_divisible'])) + " " + self.data['asset']
        + " to " + getLinkForCPData('address', self.data['destination'], getAddressLabel(self.data['destination']));
    } else if(self.rawTxType == 'orders') {
      desc = "Sell " + numberWithCommas(normalizeAmount(self.data['give_amount'], self.data['_give_divisible']))
        + " " + self.data['give_asset'] + " for "
        + numberWithCommas(normalizeAmount(self.data['get_amount'], self.data['_get_divisible'])) + " "
        + self.data['get_asset'];
    } else if(self.rawTxType == 'order_matches') {
      desc = self.data['tx0_address'] + " sent "
        + numberWithCommas(normalizeAmount(self.data['forward_amount'], self.data['_forward_divisible']))
        + " " + self.data['forward_asset']
        + self.data['tx1_address'] + " sent "
        + numberWithCommas(normalizeAmount(self.data['backward_amount'], self.data['_backward_divisible']))
        + " " + self.data['backward_asset'];
    } else if(self.rawTxType == 'btcpays') {
      desc = "Payment for Order tx " + getLinkForCPData('order', self.txIndex);
    } else if(self.rawTxType == 'issuances') {
      if(self.data['transfer']) {
        desc = "Asset " + self.data['asset'] + " transferred to "
          + getLinkForCPData('address', self.data['issuer'], getAddressLabel(self.data['issuer']));
      } else if(self.data['locked']) {
        desc = "Asset " + self.data['asset'] + " locked against additional issuance";
      } else {
        desc = "Quantity " + numberWithCommas(normalizeAmount(self.data['amount'], self.data['divisible']))
          + " of asset " + self.data['asset'] + " issued";
      }
    } else if(self.rawTxType == 'broadcasts') {
      desc = "Text: " + self.data['text'] + "<br/>Value: " + self.data['value'];
    } else if(self.rawTxType == 'bets') {
      desc = BET_TYPES[self.data['bet_type']] + " bet on feed @ "
        + getLinkForCPData('address', self.data['feed_address'], getAddressLabel(self.data['feed_address'])) + "<br/>"
        + "Odds: " + self.data['odds'] + ", Wager: "
        + numberWithCommas(normalizeAmount(self.data['wager_amount'])) + " XCP, Counterwager: "
        + numberWithCommas(normalizeAmount(self.data['counterwager_amount'])) + " XCP";  
    } else if(self.rawTxType == 'bet_matches') {
      desc = "For feed " 
        + getLinkForCPData('address', self.data['feed_address'], getAddressLabel(self.data['feed_address']))
        + ", " + self.data['tx0_address'] + " bet "
        + numberWithCommas(normalizeAmount(self.data['forward_amount'])) + " XCP"
        + self.data['tx1_address'] + " bet "
        + numberWithCommas(normalizeAmount(self.data['backward_amount'])) + " XCP";
    } else if(self.rawTxType == 'dividends') {
      desc = "Paid " + numberWithCommas(normalizeAmount(self.data['amount_per_share'])) + " "+ self.data['dividend_asset']
        + " on asset " + self.data['asset'];
    } else if(self.rawTxType == 'cancels') {
      desc = "Order/Bet " + data['offer_hash'] +" cancelled.";
    } else if(self.rawTxType == 'callbacks') {
      desc = self.data['fraction'] + " called back for asset " + self.data['asset'];
    } else if(self.rawTxType == 'bet_expirations') {
      desc = "Bet " + self.data['bet_index'] + " expired";
    } else if(self.rawTxType == 'order_expirations') {
      desc = "Order " + self.data['order_index'] + " expired";
    } else if(self.rawTxType == 'bet_match_expirations') {
      desc = "Bet Match " + self.data['bet_match_id'] + " expired";
    } else if(self.rawTxType == 'order_match_expirations') {
      desc = "Order Match " + self.data['order_match_id'] + " expired";
    } else {
      desc = "UNKNOWN TRANSACTION TYPE";
    }
    return desc;
  };
}

var AddressInDropdownItemModel = function(address, label) {
  this.ADDRESS = address;
  this.LABEL = '<b>' + label + "</b> (" + address + ")";
};
    
function TransactionHistoryViewModel() {
  var self = this;
  self._lastWindowWidth = null;
  self.selectedAddress = ko.observable('');
  self.availableAddresses = ko.observableArray([]); //stores AddressInDropdownModel objects
  self.transactions = ko.observableArray([]);
  self.ADDRESS_LASTCHANGE = null;
  
  self.init = function() {
    //populate addresses
    var addresses = WALLET.getAddressesList(true);
    for(var i = 0; i < addresses.length; i++) {
      self.availableAddresses.push(new AddressInDropdownItemModel(addresses[i][0], addresses[i][1]));
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
    console.log("Recent Transactions: Address changed called: " + newSelection);

    $('#txnHistoryLoading').show();
    $('#wid-id-txnHistory header span.jarviswidget-loader').show();
    self.transactions([]);
    $('#txnHistory').dataTable().fnClearTable();
    $('#txnHistory_wrapper').hide();
    failoverAPI("get_raw_transactions", {address: newSelection}, function(data, endpoint) {
      //clear table data and populate with the new data
      for(var i = 0; i< data.length; i++) {
        self.transactions.push(new TransactionHistoryItemViewModel(data[i]));  
      }
      runDataTables(null, true);
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
