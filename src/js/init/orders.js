pageSetUp(); //init smartadmin featureset

//This code is run on each visit to the page
window.ORDERS = new OrdersViewModel();
ko.applyBindings(ORDERS, document.getElementsByClassName("ordersGrid")[0]);

ORDERS.init(true);

$(window).resize(ORDERS.dataTableResponsive);
$(window).on('hashchange', function() {
  ORDERS.metricsStopAutoRefresh(); //just in case
  $(window).off("resize", ORDERS.dataTableResponsive);
});
