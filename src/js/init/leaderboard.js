pageSetUp(); //init smartadmin featureset

//This code is run on each visit to the page
window.ASSET_LEADERBOARD = new AssetLeaderboardViewModel();

ko.applyBindings(ASSET_LEADERBOARD, document.getElementById("leaderboardButtonBar"));
ko.applyBindings(ASSET_LEADERBOARD, document.getElementsByClassName("leaderboardGrid")[0]);

ASSET_LEADERBOARD.init();

$(window).bind("resize", ASSET_LEADERBOARD.dataTableResponsive);
$(window).on('hashchange', function() {
  $(window).off("resize", ASSET_LEADERBOARD.dataTableResponsive);
});
