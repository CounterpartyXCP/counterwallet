var AssetPortfolioViewModel = AssetLeaderboardViewModel.extend(function() {
  var self = this;
  self._super(); //call parent class constructor
  self.myAssets = ko.observableArray(WALLET.getAssetsInWallet());
  self.init(self.myAssets()); //init parent class

  self.balancesByAsset = {};
  self.myGraphTables = {};

  self.showPortfolioIn.subscribeChanged(function(newValue, prevValue) {
    //use this to hook into the parent class being done with loading its market info data
    if (!self.marketInfo.length) return; //nothing to show
    assert(newValue === KEY_ASSET.XCP || newValue === KEY_ASSET.BTC, "Invalid value");
    if (newValue == prevValue) return; //no change

    if ((Object.getOwnPropertyNames(self.myGraphTables).length == 0)) {
      var i = null, j = null;

      self.myGraphTables[KEY_ASSET.XCP] = {
        'balByAsset': ko.observableArray([]),
        'rawValByAsset': {}, 'valByAsset': ko.observableArray([]),
        'pctChange': ko.observableArray([])
      };
      self.myGraphTables[KEY_ASSET.BTC] = {
        'balByAsset': ko.observableArray([]),
        'rawValByAsset': {}, 'valByAsset': ko.observableArray([]),
        'pctChange': ko.observableArray([])
      };

      for (i = 0; i < self.myAssets().length; i++) {
        self.balancesByAsset[self.myAssets()[i]] = WALLET.getTotalBalance(self.myAssets()[i]);
      }
      var assetTotalBal = null, info = null;
      for (var baseAsset in self.myGraphTables) { //XCP or BTC
        if (self.myGraphTables.hasOwnProperty(baseAsset)) {
          for (i = 0; i < self.myAssets().length; i++) {
            asset = self.myAssets()[i];
            assetTotalBal = self.balancesByAsset[asset];

            //Populate balance by asset data, which doesn't require the asset to have market data
            self.myGraphTables[baseAsset]['balByAsset'].push([asset, assetTotalBal]); //normalized

            //populate graph data for assets with market info
            info = $.grep(self.marketInfo, function(e) { return e.asset == asset; })[0]; //O(n^3) --- optimize!
            if (info) {
              self.myGraphTables[baseAsset]['rawValByAsset'][asset] = info ? assetTotalBal / info[baseAsset === KEY_ASSET.XCP ? 'price_in_xcp' : 'price_in_btc'] : null;
              self.myGraphTables[baseAsset]['valByAsset'].push([asset, self.myGraphTables[baseAsset]['rawValByAsset'][asset]])
              self.myGraphTables[baseAsset]['pctChange'].push({
                name: asset,
                data: [info ? (info[baseAsset === KEY_ASSET.XCP ? '24h_vol_price_change_in_xcp' : '24h_vol_price_change_in_btc'] || 0) : null]
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
        text: i18n.t("composition_by_value", self.showPortfolioIn())
      },
      tooltip: {
        pointFormat: '{series.name}: <b>{point.percentage:.2f}%</b><br>(' + i18n.t("x_total_value", '{point.y:.2f} ' + self.showPortfolioIn()) + ')</b>'
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
      credits: {enabled: false},
      series: [{
        type: 'pie',
        name: i18n.t('per_of_portofolio'),
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
        text: i18n.t('composition_by_quantity')
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
      credits: {enabled: false},
      series: [{
        type: 'pie',
        name: i18n.t('per_of_portofolio'),
        data: self.myGraphTables[self.showPortfolioIn()]['balByAsset']()
      }]
    });
    $('#pctChangeBar').highcharts({
      chart: {
        type: 'column'
      },
      title: {
        text: i18n.t('24h_change', self.showPortfolioIn())
      },
      tooltip: {
        pointFormat: '{series.name}: <b>{point.y:.2f}%</b> ' + i18n.t('vs') + ' ' + self.showPortfolioIn()
      },
      xAxis: {labels: {enabled: false}},
      yAxis: {title: {text: null}},
      credits: {enabled: false},
      series: self.myGraphTables[self.showPortfolioIn()]['pctChange']()
    });
    if (!self.myGraphTables[self.showPortfolioIn()]['pctChange'].length)
      $('#pctChangeBar').highcharts().showLoading(i18n.t('no_data_to_display'));
  }
});


/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
