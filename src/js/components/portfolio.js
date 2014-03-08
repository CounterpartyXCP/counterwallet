
function AssetPortfolioViewModel() {
  var self = this;
  self.myAssets = ko.observableArray(["XCP", "BTC"]);
  self.totalBalanceByAsset = {};
  self.totalXCPValueByAsset = {};
  self.marketInfo = null;
  self.showPortfolioIn = ko.observable('');
  //graph data  
  self.pctChangesInXCP = ko.observableArray([]); // % change in relative to XCP
  self.pctChangesInBTC = ko.observableArray([]); // % change in relative to BTC
  self.portfolioTotalXCPValueByAsset = ko.observableArray([]);
  //market cap table data
  self.marketCapTableRows = ko.observableArray([]);
  self.miniChartData = ko.observable({});
  
  self.init = function() {
    //Set up handler to regraph the data if the terms we place it in change
    self.showPortfolioIn.subscribeChanged(function(newValue, prevValue) {
      assert(newValue == "XCP" || newValue == "BTC", "Invalid value");
      if(newValue == prevValue) return; //no change
      //Recompose the table this has changed
      var newRows = [];
      if(newValue == "XCP") {
        for(asset in self.marketInfo) {
          if (self.marketInfo.hasOwnProperty(asset)) {
            newRows.push({
              asset: asset,
              marketCap: smartFormat(self.marketInfo[asset]['market_cap_in_xcp']) || '??',
              price: self.marketInfo[asset]['aggregated_price_in_xcp'] || '??',
              supply: smartFormat(self.marketInfo[asset]['total_supply']),
              volume: self.marketInfo[asset]['24h_ohlc_in_xcp']['vol'] && self.marketInfo[asset]['aggregated_price_in_xcp'] 
                ? smartFormat(self.marketInfo[asset]['24h_ohlc_in_xcp']['vol'] * self.marketInfo[asset]['aggregated_price_in_xcp']) : '??',
              pctChange: smartFormat(self.marketInfo[asset]['24h_vol_price_change_in_xcp']) || '??',
              history: self.marketInfo[asset]['7d_history_in_xcp']
            });
          }
        }
      } else { //BTC
        for(asset in self.marketInfo) {
          if (self.marketInfo.hasOwnProperty(asset)) {
            newRows.push({
              asset: asset,
              marketCap: smartFormat(self.marketInfo[asset]['market_cap_in_btc']) || '??',
              price: self.marketInfo[asset]['aggregated_price_in_btc'] || '??',
              supply: smartFormat(self.marketInfo[asset]['total_supply']),
              volume: self.marketInfo[asset]['24h_ohlc_in_btc']['vol'] && self.marketInfo[asset]['aggregated_price_in_btc'] 
                ? smartFormat(self.marketInfo[asset]['24h_ohlc_in_btc']['vol'] * self.marketInfo[asset]['aggregated_price_in_btc']) : '??',
              pctChange: smartFormat(self.marketInfo[asset]['24h_vol_price_change_in_btc']) || '??',
              history: self.marketInfo[asset]['7d_history_in_btc']
            });
          }
        }
      }
      newRows.sortBy("-marketCap"); //sort newRows by marketCap descending
      self.marketCapTableRows(newRows); // table will update
      self.generateAssetMiniCharts();
    });  
    
    //Get a list of all assets the user has
    var addresses = WALLET.getAddressesList();
    failoverAPI("get_owned_assets", { addresses: addresses }, function(data, endpoint) {
      var otherAssets = [];
      for(var i = 0; i < data.length; i++) {
        otherAssets.push(data[i]['asset']); //asset ID (e.g. "FOOBAR")
      }
      otherAssets.sort();
      self.myAssets(self.myAssets().concat(otherAssets));
      //^ this way, XCP and BTC stay at the top, but the other assets are alphabetically sorted
      
      //now that we have the list of assets, fetch all the info on them
      failoverAPI("get_market_info", { assets: self.myAssets() }, function(data, endpoint) {
        //compose our portfolio (for the portfolio table)
        self.marketInfo = data;
        
        //populate the pie graphs in the first widget
        var bal = null, asset = null;
        for(asset in self.marketInfo) {
          if (self.marketInfo.hasOwnProperty(asset)) {
            //get the total balance of all assets across all addresses in the wallet
            for(var i = 0; i < addresses.length; i++) {
              if(!self.totalBalanceByAsset[asset]) self.totalBalanceByAsset[asset] = 0;
              self.totalBalanceByAsset[asset] += WALLET.getBalance(addresses[i], asset); 
            }
            self.pctChangesInXCP.push({ name: asset, data: [data[asset]['24h_vol_price_change_in_xcp'] || 0] });  
            self.pctChangesInBTC.push({ name: asset, data: [data[asset]['24h_vol_price_change_in_btc'] || 0] });
            if(data[asset]['price_in_xcp'])
              self.totalXCPValueByAsset[asset] = self.totalBalanceByAsset[asset] / data[asset]['price_in_xcp']; 
            self.portfolioTotalXCPValueByAsset.push([ asset, self.totalXCPValueByAsset[asset] || 0 ]);
          }
        }
        
        self.generateSummaryCharts();
        self.showPortfolioIn("XCP"); //causes the table to be generated off of self.marketInfo
      });
    });
  }
  
  self.showPortfolioInXCP = function() {
    self.showPortfolioIn("XCP");
  }
  
  self.showPortfolioInBTC = function() {
    self.showPortfolioIn("BTC");
  }
  
  self.generateAssetMiniCharts = function() {
    //Generate the asset portfolio mini charts
    for(var i=0; i < self.marketCapTableRows().length; i++) {
      $('#miniChart-' + self.marketCapTableRows()[i]['asset']).highcharts({
        title: { text: null },
        xAxis: { type: 'datetime', title: { text: null } },
        yAxis: { title: { text: null } },
        credits: { enabled: false },
        tooltip: { enabled: false },
        legend: { enabled: false },
        series: self.marketCapTableRows()[i]['history']
      });
    }
  }

  self.generateSummaryCharts = function() {
    $('#portfolioAssetValsPie').highcharts({
        chart: {
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false
        },
        title: {
            text: 'Composition by Value (in XCP)'
        },
        tooltip: {
          pointFormat: '{series.name}: <b>{point.percentage:.2f}%</b><br>(<b>{point.y:.2f} XCP</b> total value)</b>'
        },
        plotOptions: {
            pie: {
                allowPointSelect: true,
                cursor: 'pointer',
                dataLabels: {
                    enabled: false
                },
                showInLegend: true
            }
        },
        credits: { enabled: false },
        series: [{
            type: 'pie',
            name: '% of Portfolio',
            data: self.portfolioTotalXCPValueByAsset()
        }]
    });        
    $('#pctChangeBarToXCP').highcharts({
        chart: {
            type: 'column'
        },
        title: {
            text: '24 Hour % Change vs XCP'
        },
        tooltip: {
          pointFormat: '{series.name}: <b>{point.y:.2f}%</b> vs XCP'
        },
        xAxis: { labels: { enabled: false } },
        yAxis: { title: { text: null } },
        credits: { enabled: false },
        series: self.pctChangesInXCP()
    });
    $('#pctChangeBarToBTC').highcharts({
        chart: {
            type: 'column'
        },
        title: {
            text: '24 Hour % Change vs BTC'
        },
        tooltip: {
          pointFormat: '{series.name}: <b>{point.y:.2f}%</b> vs BTC'
        },
        xAxis: { labels: { enabled: false } },
        yAxis: { title: { text: null } },
        credits: { enabled: false },
        series: self.pctChangesInBTC()
    });
  }

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
