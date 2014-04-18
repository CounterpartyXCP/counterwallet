pageSetUp(); //init smartadmin featureset

//This code is run on each visit to the page
window.ASSET_PORTFOLIO = new AssetPortfolioViewModel("Test");

ko.applyBindings(ASSET_PORTFOLIO, document.getElementById("portfolioButtonBar"));
ko.applyBindings(ASSET_PORTFOLIO, document.getElementsByClassName("portfolioGrid")[0]);

$(window).bind("resize", ASSET_PORTFOLIO.dataTableResponsive);
$(window).on('hashchange', function() {
  $(window).off("resize", ASSET_PORTFOLIO.dataTableResponsive);
});
