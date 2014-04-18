pageSetUp(); //init smartadmin featureset

//This code is run on each visit to the page
window.BALANCE_HISTORY = new BalanceHistoryViewModel();
window.TXN_HISTORY = new TransactionHistoryViewModel();

ko.applyBindings(TXN_HISTORY, document.getElementById("wid-id-txnHistory"));
ko.applyBindings(BALANCE_HISTORY, document.getElementById("wid-id-balHistory"));

BALANCE_HISTORY.init();
TXN_HISTORY.init();
  
$(window).bind("resize", TXN_HISTORY.dataTableResponsive);
$(window).on('hashchange', function() {
  $(window).off("resize", TXN_HISTORY.dataTableResponsive);
});
