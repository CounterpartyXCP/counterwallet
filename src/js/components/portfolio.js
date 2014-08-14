
var AssetPortfolioViewModel = AssetLeaderboardViewModel.extend(function() {
  var self = this;
  self._super(); //call parent class constructor
  self.myAssets = ko.observableArray(WALLET.getAssetsInWallet());
  self.init(self.myAssets()); //init parent class

  self.balancesByAsset = {};
  self.myGraphTables = {};
  
  self.showPortfolioIn.subscribeChanged(function(newValue, prevValue) {
    //use this to hook into the parent class being done with loading its market info data
    assert(self.marketInfo.length);
    assert(newValue == XCP || newValue == BTC, "Invalid value");
    if(newValue == prevValue) return; //no change
    
    if((Object.getOwnPropertyNames(self.myGraphTables).length == 0)) {
      var i = null, j = null;

      self.myGraphTables[XCP] = {
        'balByAsset': ko.observableArray([]),
        'rawValByAsset': {}, 'valByAsset': ko.observableArray([]),
        'pctChange': ko.observableArray([])
      };
      self.myGraphTables[BTC] = {
        'balByAsset': ko.observableArray([]),
        'rawValByAsset': {}, 'valByAsset': ko.observableArray([]),
        'pctChange': ko.observableArray([])
      };
      
      for(i=0; i < self.myAssets().length; i++) {
        self.balancesByAsset[self.myAssets()[i]] = WALLET.getTotalBalance(self.myAssets()[i]);
      }
      var assetTotalBal = null, info = null;
      for(var baseAsset in self.myGraphTables) { //XCP or BTC
        if(self.myGraphTables.hasOwnProperty(baseAsset)) {
          for(i=0; i < self.myAssets().length; i++) {
            asset = self.myAssets()[i];
            assetTotalBal = self.balancesByAsset[asset];

            //Populate balance by asset data, which doesn't require the asset to have market data
            self.myGraphTables[baseAsset]['balByAsset'].push([asset, assetTotalBal]); //normalized

            //populate graph data for assets with market info
            info = $.grep(self.marketInfo, function(e) { return e.asset == asset; })[0]; //O(n^3) --- optimize!
            if(info) {
              self.myGraphTables[baseAsset]['rawValByAsset'][asset] = info ? assetTotalBal / info[baseAsset == XCP ? 'price_in_xcp' : 'price_in_btc'] : null;
              self.myGraphTables[baseAsset]['valByAsset'].push([asset, self.myGraphTables[baseAsset]['rawValByAsset'][asset]])
              self.myGraphTables[baseAsset]['pctChange'].push({
                name: asset,
                data: [info ? (info[ baseAsset == XCP ? '24h_vol_price_change_in_xcp' : '24h_vol_price_change_in_btc' ] || 0) : null]
              });
            }
          }
        }
      }
    }
    self.generateSummaryCharts();
  });  
  
  self.generateSummaryCharts = function() {
    $('#portfolioAssetValsPie').highcharts({
        chart: {
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false
        },
        title: {
            text: 'Composition by Value (in ' + self.showPortfolioIn() + ')'
        },
        tooltip: {
          pointFormat: '{series.name}: <b>{point.percentage:.2f}%</b><br>(<b>{point.y:.2f} ' + self.showPortfolioIn() + '</b> total value)</b>'
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
            data: self.myGraphTables[self.showPortfolioIn()]['valByAsset']()
        }]
    });        
    $('#portfolioAssetBalsPie').highcharts({
        chart: {
            plotBackgroundColor: null,
            plotBorderWidth: null,
            plotShadow: false
        },
        title: {
            text: 'Composition by Quantity Owned'
        },
        tooltip: {
          pointFormat: '{series.name}: <b>{point.percentage:.2f}%</b>'
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
            data: self.myGraphTables[self.showPortfolioIn()]['balByAsset']()
        }]
    });
    $('#pctChangeBar').highcharts({
        chart: {
            type: 'column'
        },
        title: {
            text: '24 Hour % Change vs ' + self.showPortfolioIn()
        },
        tooltip: {
          pointFormat: '{series.name}: <b>{point.y:.2f}%</b> vs ' + self.showPortfolioIn()
        },
        xAxis: { labels: { enabled: false } },
        yAxis: { title: { text: null } },
        credits: { enabled: false },
        series: self.myGraphTables[self.showPortfolioIn()]['pctChange']()
    });
    if(!self.myGraphTables[self.showPortfolioIn()]['pctChange'].length)
      $('#pctChangeBar').highcharts().showLoading('No data to display');
  }
});


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
