function BalanceHistoryViewModel() {
  //An address on a wallet
  var self = this;
  self.selectedAsset = ko.observable('');
  self.availableAssets = ko.observableArray(["XCP", "BTC"]);
  self.graphData = null;
  
  self.init = function() {
    //contact server for list of all assets at the addresses we have
    failoverAPI("get_owned_assets", { addresses: WALLET.getAddressesList() }, function(data) {
      for(var i = 0; i < data.length; i++) {
        self.availableAssets.push(data[i]); //asset ID (e.g. "FOOBAR")  
      }
    });
    //select the first asset by default (XCP)
    self.selectedAsset(self.availableAssets()[0]);
    //trigger initial data display
    self.assetChanged();
  }
  
  self.assetChanged = function() {
    //contact server for balances across all addresses in our wallet that have this asset
    failoverAPI("get_balance_history", {asset: self.selectedAsset(), addresses: WALLET.getAddressesList(), }, function(data) {
      self.graphData = data;
      
      $('#balanceHistory').highcharts({
          chart: {
              type: 'line',
              zoomType: 'x',
              spacingRight: 20
          },      
          title: {
              text: 'Balances for Asset ' + self.selectedAsset(),
              x: -20 //center
          },
          xAxis: {
              type: 'datetime',
              maxZoom: 10 * 24 * 3600000, // ten days
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
                  text: 'Balance'
              },
              plotLines: [{
                  value: 0,
                  width: 1,
                  color: '#808080'
              }]
          },
          tooltip: {
              shared: true,
              valueSuffix: self.selectedAsset()
          },
          series: self.graphData
      });    
    });
  }
}

var ENTITY_NAMES = {
  'burns': 'Burn',
  'debits': 'Debit',
  'credits': 'Credit',
  'sends': 'Send',
  'orders': 'Order',
  'order_matches': 'Order Match',
  'btcpays': 'BTCPay',
  'issuances': 'Issuance',
  'broadcasts': 'Broadcast',
  'bets': 'Bet',
  'bet_matches': 'Bet Match',
  'dividends': 'Dividend',
  'cancels': 'Cancel',
  'callbacks': 'Callback',
  'bet_expirations': 'Bet Expired',
  'order_expirations': 'Order Expired',
  'bet_match_expirations': 'Bet Match Exp',
  'order_match_expirations': 'Order Match Exp'
};

var BET_TYPES = {
  0: "Bullish CFD",
  1: "Bearish CFD",
  2: "Equal",
  3: "Not Equal"
};

function TransactionHistoryItemViewModel(data) {
  var self = this;
  self.data = data;
  self.txIndex = self.data['tx_index'] || '';
  self.blockIndex = self.data['block_index'];
  self.blockTime = self.data['_block_time'];
  self.rawTxType = self.data['_entity'];
  self.txType = ENTITY_NAMES[self.data['_entity']];
  self.source = self.data['source'] || self.data['address'] || '';
  self.destination = self.data['source'];
  //self.btcAmount = TODO
  //self.fee = TODO
  
  self.dispBlocktime = function() {
    moment(self.blockTime * 1000).format("MMM Do YYYY, h:mm:ss a");
  };
  
  self.dispDescription = function() {
    //TODO: this display of data is very elementary and basic. IMPROVE greatly in the future...
    var desc = "";
    if(self.rawTxType == 'burns') {
      desc = "XCP Proof-of-Burn<br/>Burned: " + (self.data['burned'] / UNIT).toString() + " BTC<br/>"
        + "Earned: " + (self.data['earned'] / UNIT).toString() + " XCP";
    } else if(self.rawTxType == 'sends') {
      desc = "Send of " + self.data['amount'].toString() + " " + self.data['asset']
        + " to <a href=\"http://blockscan.com/address.aspx?q=" + self.data['destination'] + "\" target=\"blank\">"
        + self.data['destination'] + "</a>"; 
    } else if(self.rawTxType == 'orders') {
      desc = "Sell " + self.data['give_amount'] + " " + self.data['give_asset'] + " for "
        + self.data['get_amount'] + " " + self.data['get_asset'];
    } else if(self.rawTxType == 'order_matches') {
      desc = self.data['tx0_address'] + " sent " + self.data['forward_amount'] + " " + self.data['forward_asset']
        + self.data['tx1_address'] + " sent " + self.data['backward_amount'] + " " + self.data['backward_asset'];
    } else if(self.rawTxType == 'btcpays') {
      desc = "Payment for Order tx <a href=\"http://blockscan.com/order.aspx?q=" + self.txIndex + "\" target=\"blank\">" + self.txIndex + "</a>";
    } else if(self.rawTxType == 'issuances') {
      if(self.data['transfer']) {
        desc = "Asset " + self.data['asset'] + " transferred to " + self.data['transfer'];
      } else if(self.data['amount'] == 0) {
        desc = "Asset " + self.data['asset'] + " locked against additional issuance";
      } else {
        desc = (self.data['divisible'] ? self.data['quantity'] / UNIT : self.data['quantity']).toString() + " qty of asset " + self.data['asset'] + " issued";
      }
    } else if(self.rawTxType == 'broadcasts') {
      desc = "Text: " + self.data['text'] + "<br/>Value: " + self.data['value'];
    } else if(self.rawTxType == 'bets') {
      desc = BET_TYPES[self.data['bet_type']] + " bet on feed " + self.data['feed_address'] + "<br/>"
        + "Odds: " + self.data['odds'] + ", Wager: " + (self.data['wager_amount'] / UNIT) + " XCP, Counterwager: " + (self.data['counterwager_amount'] / UNIT) + " XCP";  
    } else if(self.rawTxType == 'bet_matches') {
      desc = "For feed " + self.data['feed_address'] + ", " + self.data['tx0_address'] + " bet " + self.data['forward_amount'] + " XCP"
        + self.data['tx1_address'] + " bet " + self.data['backward_amount'] + " XCP";
    } else if(self.rawTxType == 'dividends') {
      desc = "Paid " + (self.data['amount_per_share'] / UNIT) + " XCP on asset " + self.data['asset'];
    } else if(self.rawTxType == 'cancels') {
      desc = "Order/Bet cancelled.";
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
  this.LABEL = address + " (" + label + ")";
};
    
function TransactionHistoryViewModel() {
  var self = this;
  self.selectedAddress = ko.observable();
  self.availableAddresses = ko.observableArray([]); //stores AddressInDropdownModel objects
  self.transactions = ko.observableArray([]);
  
  self.init = function() {
    //populate addresses
    var addresses = WALLET.getAddressesList(true);
    for(var i = 0; i < addresses.length; i++) {
      self.availableAddresses.push(new AddressInDropdownItemModel(addresses[i][0], addresses[i][1]));
    }
    //select the first address by default
    self.selectedAddress(self.availableAddresses[0]);
    //trigger initial data display
    self.addressChanged();
  }
  
  self.addressChanged = function() {
    self.transactions([]); //clear
    failoverAPI("get_raw_transactions", {address: self.selectedAddress().ADDRESS}, function(data) {
      for(var i = 0; i< data.length; i++) {
        self.transactions.push(new TransactionHistoryItemViewModel(data));  
      }
      
      $('#txnHistory').dataTable({
        "sPaginationType" : "bootstrap_full"
      });
    });
  } 
}


var BALANCE_HISTORY = new BalanceHistoryViewModel();
var TXN_HISTORY = new TransactionHistoryViewModel();

$(document).ready(function() {
  ko.applyBindings(TXN_HISTORY, document.getElementById("wid-id-txnHistory"));
  ko.applyBindings(BALANCE_HISTORY, document.getElementById("wid-id-balHistory"));

  //BALANCE_HISTORY.init();
  TXN_HISTORY.init();
});

