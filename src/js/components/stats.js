
function StatsHistoryViewModel() {
  var self = this;
  self.txGraphData = null;
  self.walletGraphData = null;
  self.totalMainnetWallets = 0;
  self.totalTestnetWallets = 0;
  self.totalUnknownWallets = 0;
  
  self.init = function() {
    failoverAPI("get_transaction_stats", {}, function(data, endpoint) {
      for(var i=0; i < data.length; i++) {
          data[i]['name'] = data[i]['name'].capitalize().replace(/_/g, ' ');
      }
      self.txGraphData = data;
      self.doTxChart();
    });

    failoverAPI("get_wallet_stats", {}, function(data, endpoint) {
      self.walletGraphData = data['wallet_stats'];
      self.totalMainnetWallets = data['num_wallets_mainnet'];
      $('#totalMainnetWallets').text(self.totalMainnetWallets);
      self.totalTestnetWallets = data['num_wallets_testnet'];
      $('#totalTestnetWallets').text(self.totalTestnetWallets);
      self.totalUnknownWallets = data['num_wallets_unknown'];
      $('#totalUnknownWallets').text(self.totalUnknownWallets);
      self.doWalletChart();
    });
  }
  
  self.doTxChart = function() {
    $('#transactionStatHistory').highcharts({
       chart: {
            type: 'column',
            zoomType: 'x',
            maxZoom: 48 * 3600 * 1000
        },
        title: {
            text: 'Transaction Count by Day'
        },
        xAxis: {
          type: 'datetime',
          title: {
            text: null
          }
        },
        yAxis: {
            min: 0,
            title: {
                text: '# Transactions'
            },
            stackLabels: {
                enabled: true,
                style: {
                    fontWeight: 'bold',
                    color: (Highcharts.theme && Highcharts.theme.textColor) || 'gray'
                }
            }
        },
        legend: {
            align: 'right',
            verticalAlign: 'top',
            floating: true,
            backgroundColor: (Highcharts.theme && Highcharts.theme.background2) || 'white',
            borderColor: '#CCC',
            borderWidth: 1,
            shadow: false
        },
        tooltip: {
            formatter: function() {
                return '<b>'+ moment(this.x).format('MMM Do YYYY') +'</b><br/>'+
                    this.series.name +': '+ this.y +'<br/>'+
                    'Total: '+ this.point.stackTotal;
            }
        },
        credits: {
            enabled: false
        },        
        plotOptions: {
            column: {
                stacking: 'normal'
            }
        },      
        series: self.txGraphData
    });    
  }
  
  self.doWalletChart = function() {
    $('#walletStatHistory').highcharts({
       chart: {
            type: 'line',
            zoomType: 'x',
            maxZoom: 48 * 3600 * 1000
        },
        title: {
            text: 'Wallet Activity by Day'
        },
        xAxis: {
          type: 'datetime',
          title: {
            text: null
          }
        },
        yAxis: {
            min: 0,
            title: {
                text: '#'
            },
            stackLabels: {
                enabled: true,
                style: {
                    fontWeight: 'bold',
                    color: (Highcharts.theme && Highcharts.theme.textColor) || 'gray'
                }
            }
        },
        legend: {
            align: 'right',
            verticalAlign: 'top',
            floating: true,
            backgroundColor: (Highcharts.theme && Highcharts.theme.background2) || 'white',
            borderColor: '#CCC',
            borderWidth: 1,
            shadow: false
        },
        tooltip: {
            formatter: function() {
                return '<b>'+ moment(this.x).format('MMM Do YYYY') +'</b><br/>'+
                    this.series.name +': '+ this.y;
            }
        },
        credits: {
            enabled: false
        },        
        plotOptions: {
            column: {
                stacking: 'normal'
            }
        },      
        series: self.walletGraphData
    });    
  }

  self.showNewRow = function(elem) { if (elem.nodeType === 1) $(elem).hide().slideDown() }
  
  self.hideOldRow = function(elem) { if (elem.nodeType === 1) $(elem).slideUp(function() { $(elem).remove(); }) }  
}


function StatsTransactionHistoryViewModel() {
  var self = this;
  self._lastWindowWidth = null;
  self.transactions = ko.observableArray([]);
  
  self.init = function() {
    //Initialize out the initial list of messages
    //var messageIndexes = range(MESSAGE_FEED.lastMessageIndexReceived() - 100, 100);
    failoverAPI("get_last_n_messages", {count: 50}, function(data, endpoint) {
      //clear table data and populate with the new data (which comes in the order of newest to oldest)
      data.reverse();
      for(var i = 0; i< data.length; i++) {
        //if(data[i]['_category']; == 'credit' || data[i]['_category']; == 'debit')
        if(data[i]['_command'] != 'insert')
          continue;
        self.transactions.push(new TransactionHistoryItemViewModel(data[i])); 
      }
    });
  }
  
  self.addMessage = function(message) {
    //insert at head, and pop off tail
    self.transactions.unshift(new TransactionHistoryItemViewModel(message));
    if(self.transactions().length > STATS_MAX_NUM_TRANSACTIONS)
      self.transactions.pop(); //keep it <= STATS_MAX_NUM_TRANSACTIONS
  }
  
  self.dataTableResponsive = function(e) {
    // Responsive design for our data tables and more on this page
    var newWindowWidth = $(window).width();
    
    if(self._lastWindowWidth && newWindowWidth == self._lastWindowWidth) return;
    self._lastWindowWidth = newWindowWidth;
  }
}


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
