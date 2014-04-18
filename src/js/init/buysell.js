pageSetUp(); //init smartadmin featureset

//This code is run on each visit to the page
window.BUY_SELL = new BuySellWizardViewModel();

ko.applyBindings(BUY_SELL, document.getElementsByClassName("buySellGrid")[0]);
  
BUY_SELL.init();

$(window).resize(BUY_SELL.dataTableResponsive);
$(window).on('hashchange', function() {
  BUY_SELL._tab2StopAutoRefresh(); //just in case
  $(window).off("resize", BUY_SELL.dataTableResponsive);
});
