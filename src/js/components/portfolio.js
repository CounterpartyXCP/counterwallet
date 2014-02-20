
function AssetPortfolioViewModel() {
  var self = this;
  self.myAssets = ko.observableArray(["XCP", "BTC"]);
  self.totalBalanceByAsset = {};
  self.marketInfo = null;
  self.showPortfolioIn = ko.observable(null);
  //graph data  
  self.pctChangesToXCP = []; // % change in relative to XCP
  self.pctChangesToBTC = []; // % change in relative to BTC
  self.portfolioTotalBalancesByAsset = [];
  //market cap table data
  self.marketCapTableRows = ko.observable([]);
  
  self.init = function() {
    //Set up handler to regraph the data if the terms we place it in change
    self.showPortfolioIn.subscribe(function(newValue) {
      assert(newValue == "XCP" || newValue == "BTC", "Invalid value");
      if(newValue == self.showPortfolioIn()) return; //no change
      //Recompose the table this has changed
      var newRows = [];
      if(newValue == "XCP") {
        for(asset in self.marketInfo) {
          newRows.push({
            asset: asset,
            marketCap: self.marketInfo[asset]['market_cap_in_xcp'],
            price: self.marketInfo[asset]['aggregated_price_in_xcp'],
            supply: self.marketInfo[asset]['total_supply'],
            volume: self.marketInfo[asset]['24h_summary']['vol'] * self.marketInfo[asset]['aggregated_price_in_xcp'],
            pctChange: self.marketInfo[asset]['24h_vol_price_change_in_xcp'],
            history: self.marketInfo[asset]['history_xcp']
          });
        }
      } else { //BTC
        for(asset in self.marketInfo) {
          newRows.push({
            asset: asset,
            marketCap: self.marketInfo[asset]['market_cap_in_btc'],
            price: self.marketInfo[asset]['aggregated_price_in_btc'],
            supply: self.marketInfo[asset]['total_supply'],
            volume: self.marketInfo[asset]['24h_summary']['vol'] * self.marketInfo[asset]['aggregated_price_in_btc'],
            pctChange: self.marketInfo[asset]['24h_vol_price_change_in_btc'],
            history: self.marketInfo[asset]['history_btc']
          });
        }
      }
      self.marketCapTableRows(newRows); // table will update
    });  
    
    //Get a list of all assets the user has
    var addresses = WALLET.getAddressesList();
    failoverAPI("get_owned_assets", { addresses: addresses }, function(data, endpoint) {
      var otherAssets = [], i = null;
      for(i = 0; i < data.length; i++) {
        otherAssets.push(data[i]['asset']); //asset ID (e.g. "FOOBAR")
      }
      otherAssets.sort();
      self.availableAssets(self.myAssets().concat(otherAssets));
      //^ this way, XCP and BTC stay at the top, but the other assets are alphabetically sorted
      
      //now that we have the list of assets, fetch all the info on them
      failoverAPI("get_market_info", { assets: self.myAssets() }, function(data, endpoint) {
        //compose our portfolio (for the portfolio table)
        self.marketInfo = data;
        
        //populate the pie graphs in the first widget
        var bal = null, asset = null;
        for(asset in self.marketInfo) {
          //get the total balance of all assets across all addresses in the wallet
          for(i = 0; i < addresses.length; i++) {
            if(!self.totalBalanceByAsset[asset]) self.totalBalanceByAsset[asset] = 0;
            self.totalBalanceByAsset[asset] += WALLET.getBalance(addresses[i].ADDRESS, asset); 
          }
          self.pctChangesToXCP.push([ asset, data[asset]['24h_vol_price_change_in_xcp'] ]);  
          self.pctChangesToBTC.push([ asset, data[asset]['24h_vol_price_change_in_btc'] ]);
          self.portfolioTotalBalancesByAsset.push([ asset, self.totalBalanceByAsset[asset] ]);  
        }
        self.generateCharts();
        
        self.showPortfolioIn("XCP"); //causes the table to be generated off of self.marketInfo
    });
  }
  
  self.showPortfolioInXCP = function() {
    self.showPortfolioIn("XCP");
  }
  
  self.showPortfolioInBTC = function() {
    self.showPortfolioIn("BTC");
  }
  
  self.generateCharts = function() {
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
            pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
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
          series: [{
              type: 'pie',
              name: '% of Portfolio',
              data: self.portfolioTotalBalancesByAsset()
          }]
      });        
      $('#pctChangeBarToXCP').highcharts({
          chart: {
              type: 'column'
          },
          title: {
              text: '24h % Change To XCP'
          },
          credits: {
              enabled: false
          },
          series: self.pctChangesToXCP()
      });
      $('#pctChangeBarToBTC').highcharts({
          chart: {
              type: 'column'
          },
          title: {
              text: '24h % Change To BTC'
          },
          credits: {
              enabled: false
          },
          series: self.pctChangesToBTC()
      });
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


var ASSET_PORTFOLIO = new AssetPortfolioViewModel();

$(document).ready(function() {
  ko.applyBindings(ASSET_PORTFOLIO, document.getElementById("assetPortfolio"));

  ASSET_PORTFOLIO.init();
  
  $(window).bind("resize", ASSET_PORTFOLIO.dataTableResponsive);
  $(window).on('hashchange', function() {
    $(window).off("resize", ASSET_PORTFOLIO.dataTableResponsive);
  });
});

