INIT_FUNC = {};
PROCESSED_BTCPAY = {};

function initIndex() { //main page
  window.LOGON_VIEW_MODEL = new LogonViewModel();
  window.LICENSE_MODAL = new LicenseModalViewModel();
  window.LOGON_PASSWORD_MODAL = new LogonPasswordModalViewModel();
  
  window.WALLET = new WalletViewModel();
  window.WALLET_OPTIONS_MODAL = new WalletOptionsModalViewModel();
  
  window.MESSAGE_FEED = new MessageFeed();
  window.CHAT_FEED = new ChatFeedViewModel();
  window.CHAT_SET_HANDLE_MODAL = new ChatSetHandleModalViewModel();
  window.PENDING_ACTION_FEED = new PendingActionFeedViewModel();
  
  window.UPCOMING_BTCPAY_FEED = new UpcomingBTCPayFeedViewModel();
  window.WAITING_BTCPAY_FEED = new WaitingBTCPayFeedViewModel();
  window.BTCPAY_FEED = new BTCPayFeedViewModel();
  
  window.NOTIFICATION_FEED = new NotificationFeedViewModel();
  
  window.SUPPORT_MODAL = new SupportModalViewModel();
  window.DONATE_MODAL = new DonationViewModel();
  window.CREATE_SUPPORT_CASE_VIEW_MODEL = new CreateSupportCaseViewModel();

  $(document).ready(function() {
    ko.applyBindings(LOGON_VIEW_MODEL, document.getElementById("logon"));
    ko.applyBindings(LICENSE_MODAL, document.getElementById("licenseModal"));
    ko.applyBindings(LOGON_PASSWORD_MODAL, document.getElementById("logonPassphaseModal"));
    ko.applyBindings(WALLET_OPTIONS_MODAL, document.getElementById("walletOptionsModal"));
    ko.applyBindings(CHAT_FEED, document.getElementById("chatPane"));
    ko.applyBindings(CHAT_SET_HANDLE_MODAL, document.getElementById("chatSetHandleModal"));
    ko.applyBindings(PENDING_ACTION_FEED, document.getElementById("pendingActionFeed"));
    ko.applyBindings(BTCPAY_FEED, document.getElementById("btcPayFeed"));
    ko.applyBindings(NOTIFICATION_FEED, document.getElementById("notificationFeed"));        
    ko.applyBindings(SUPPORT_MODAL, document.getElementById("supportModal"));
    ko.applyBindings(DONATE_MODAL, document.getElementById("donateModal"));
    ko.applyBindings(CREATE_SUPPORT_CASE_VIEW_MODEL, document.getElementById("createSupportCaseModal"));
    
    //so that knockout is run on the DOM sections and global context is accessible...
    ko.applyBindings({}, document.getElementById("noticeTestnet"));
    ko.applyBindings({}, document.getElementById("noticeDevMode"));
    
    $('#fullscreen').click(function(e) {
      launchFullscreen(document.documentElement);
      return false;
    });
    $('#showOptions').click(function(e) {
      WALLET_OPTIONS_MODAL.show();
      return false;
    });
    $('#support').click(function(e) {
      SUPPORT_MODAL.show('general');
      return false;
    });
    $('#loginform').submit(function() {
      if (LOGON_VIEW_MODEL.isPassphraseValid()) {
        LOGON_VIEW_MODEL.openWallet();
      } 
      return false;
    })
    $('#donate').click(function(e) {
      DONATE_MODAL.show();
      return false;
    });
    if (USE_TESTNET && TESTNET_PASSPHRASE) {
      $.jqlog.debug('Testnet passphrase specified: ' + TESTNET_PASSPHRASE);
      $('#password').val(TESTNET_PASSPHRASE);
      $('#password').change();
      setTimeout(function() {
        $('#loginform').submit();
      }, 500);
    }

    $("#walletUrl").focus(function() {
        var $this = $(this);
        $this.select();
        // Work around Chrome's little problem
        $this.mouseup(function() {
            // Prevent further mouseup intervention
            $this.unbind("mouseup");
            return false;
        });
    });

    $('.showCreateSupportCase').click(function(e) {
      SUPPORT_MODAL.hide(); //oftentimes it will be up...don't want layers of modals
      CREATE_SUPPORT_CASE_VIEW_MODEL.show();
    });
  });
}
initIndex(); //call it now, as this script is loaded on index page load


function initBalances() {
  ko.applyBindings(WALLET, document.getElementsByClassName("balancesContainer")[0]);
  //^ this line MUST go above pageSetup() in this case, or odd things will happen
  
  pageSetUp(); //init smartadmin featureset
   
  //balances.js
  window.CHANGE_ADDRESS_LABEL_MODAL = new ChangeAddressLabelModalViewModel();
  window.CREATE_NEW_ADDRESS_MODAL = new CreateNewAddressModalViewModel();
  window.SEND_MODAL = new SendModalViewModel();
  window.SWEEP_MODAL = new SweepModalViewModel();
  window.SIGN_MESSAGE_MODAL = new SignMessageModalViewModel();
  window.TESTNET_BURN_MODAL = new TestnetBurnModalViewModel();
  window.DISPLAY_PRIVATE_KEY_MODAL = new DisplayPrivateKeyModalViewModel();
  window.BROADCAST_MODAL = new BroadcastModalViewModel();
  window.SIGN_TRANSACTION_MODAL = new SignTransactionModalViewModel();
  window.ARMORY_BROADCAST_TRANSACTION = new ArmoryBroadcastTransactionModalViewModel();
  
  ko.applyBindings({}, document.getElementById("gettingStartedNotice"));
  ko.applyBindings({}, document.getElementById("pendingBTCPayNotice"));
  ko.applyBindings({}, document.getElementById("oldWalletDetectedNotice"));
  ko.applyBindings(CHANGE_ADDRESS_LABEL_MODAL, document.getElementById("changeAddressLabelModal"));
  ko.applyBindings(CREATE_NEW_ADDRESS_MODAL, document.getElementById("createNewAddressModal"));
  ko.applyBindings(SEND_MODAL, document.getElementById("sendModal"));
  ko.applyBindings(SWEEP_MODAL, document.getElementById("sweepModal"));
  ko.applyBindings(SIGN_MESSAGE_MODAL, document.getElementById("signMessageModal"));
  ko.applyBindings(TESTNET_BURN_MODAL, document.getElementById("testnetBurnModal"));
  ko.applyBindings(DISPLAY_PRIVATE_KEY_MODAL, document.getElementById("displayPrivateKeyModal"));
  ko.applyBindings(BROADCAST_MODAL, document.getElementById("broadcastModal"));
  ko.applyBindings(SIGN_TRANSACTION_MODAL, document.getElementById("signTransactionModal"));
  ko.applyBindings(ARMORY_BROADCAST_TRANSACTION, document.getElementById("armoryBroadcastTransactionModal"));
  
  if(!isBound("left-panel")) {
    ko.applyBindings({
      FEATURE_EXCHANGE: disabledFeatures.indexOf('exchange') == -1,
      FEATURE_BETTING: disabledFeatures.indexOf('betting') == -1,
      FEATURE_RPS: disabledFeatures.indexOf('rps') == -1,
      FEATURE_HISTORY: disabledFeatures.indexOf('history') == -1,
      FEATURE_PORTFOLIO: disabledFeatures.indexOf('portfolio') == -1,
      FEATURE_LEADERBOARD: disabledFeatures.indexOf('leaderboard') == -1,
      FEATURE_STATS: disabledFeatures.indexOf('stats') == -1
    }, document.getElementById("left-panel"));
  }
    
  //balances_assets.js
  window.CREATE_ASSET_MODAL = new CreateAssetModalViewModel();
  window.ISSUE_ADDITIONAL_ASSET_MODAL = new IssueAdditionalAssetModalViewModel();
  window.TRANSFER_ASSET_MODAL = new TransferAssetModalViewModel();
  window.CHANGE_ASSET_DESCRIPTION_MODAL = new ChangeAssetDescriptionModalViewModel();
  window.PAY_DIVIDEND_MODAL = new PayDividendModalViewModel();
  window.CALL_ASSET_MODAL = new CallAssetModalViewModel();
  window.SHOW_ASSET_INFO_MODAL = new ShowAssetInfoModalViewModel();
  
  ko.applyBindings(CREATE_ASSET_MODAL, document.getElementById("createAssetModal"));
  ko.applyBindings(ISSUE_ADDITIONAL_ASSET_MODAL, document.getElementById("issueAdditionalAssetModal"));
  ko.applyBindings(TRANSFER_ASSET_MODAL, document.getElementById("transferAssetModal"));
  ko.applyBindings(CHANGE_ASSET_DESCRIPTION_MODAL, document.getElementById("changeAssetDescriptionModal"));
  ko.applyBindings(PAY_DIVIDEND_MODAL, document.getElementById("payDividendModal"));
  ko.applyBindings(CALL_ASSET_MODAL, document.getElementById("callAssetModal"));
  ko.applyBindings(SHOW_ASSET_INFO_MODAL, document.getElementById("showAssetInfoModal"));
  
  $(document).ready(function() {
      //Some misc jquery event handlers
      $('#createAddress, #createWatchOnlyAddress, #createArmoryOfflineAddress').click(function(e) {
        if(WALLET.addresses().length >= MAX_ADDRESSES) {
          bootbox.alert("You already have the max number of addresses for a single wallet (<b>"
            + MAX_ADDRESSES + "</b>). Please create a new wallet (i.e. different passphrase) for more.");
          return false;
        }

        var addressType = 'normal';        
        if($(this).attr('id') == 'createWatchOnlyAddress')
          addressType = 'watch'; 
        else if($(this).attr('id') == 'createArmoryOfflineAddress')
          addressType = 'armory'; 
        CREATE_NEW_ADDRESS_MODAL.show(addressType);
        e.preventDefault(); //prevent the location hash from changing
      });
      
      $('#sweepFunds, #sweepFunds2').click(function() {
        SWEEP_MODAL.show(true, false);
      });
      $('#sweepOldWallet').click(function() {
        SWEEP_MODAL.show(true, true);
      });
      $('#balanceHelp').click(function() {
        SUPPORT_MODAL.show('balancesPage');
      });

      //temporary
      if (WALLET.BITCOIN_WALLET.useOldHierarchicalKey) {
        $('#newWalletSweep').hide();
      } else {
        $('#sweepFunds').hide();
      }
      $('#support_havingIssuesLink').click(function(e) {
        SUPPORT_MODAL.show('general');
        return false;
      });
        
      //Called on first load, and every switch back to the balances page
      if(window._BALANCES_HAS_LOADED_ALREADY === undefined) {
        window._BALANCES_HAS_LOADED_ALREADY = true;
        
        function _detectOldWallet() {
          //Prompt an old wallet user to migrate their funds
          //Do this in another thread so that we don't delay the showing of the balances
          WALLET.BITCOIN_WALLET.getOldAddressesInfos(function(data) {   
            var needSweep = false;
            for (var a in data) {
              needSweep = true;
              break;
            }
            if (needSweep) {
              bootbox.confirm("<b style='color:red'>We detected that you have an 'old' wallet with funds present. Press 'OK' to sweep these funds into your new wallet, or Cancel to skip for now.</b>", function(value) {
                if (value) {
                  SWEEP_MODAL.show(true, true);
                }
              });
            }
          });
        }    
        //DISABLE this call for now, as it takes too long to complete and hangs the browser
        //setTimeout(_detectOldWallet, 300);

      } else {
        WALLET.refreshBTCBalances(false);
      }

      // FIX: replace buggy smartadmin dropdown menu for assets menu
      $('.assetBtn').click(function (event) {
        var menu = $(this).parent().find('ul');
        if (menu.css('display')=='block') {
          menu.hide();
        } else {
          menu.show();
        }
        menu.mouseleave(function() {
          menu.hide();
          menu.unbind('mouseleave');
        })
      });
      // don't work: https://github.com/twbs/bootstrap/issues/2975#issuecomment-8670606
      /*$('body')
      .on('touchstart.dropdown', '.dropdown-menu', function (e) { e.stopPropagation(); })
      .on('touchstart.dropdown', '.dropdown-submenu', function (e) { e.preventDefault(); });*/
  });
}
INIT_FUNC['pages/balances.html'] = initBalances;

function initFeedBTCPays() {
  ko.applyBindings(WAITING_BTCPAY_FEED, document.getElementById("waitingBTCPayFeedContent"));
  ko.applyBindings(UPCOMING_BTCPAY_FEED, document.getElementById("upcomingBTCPayFeedContent"));
}
INIT_FUNC['pages/feed_btcpays.html'] = initFeedBTCPays;


function initFeedNotifications() {
  ko.applyBindings(NOTIFICATION_FEED, document.getElementById("notificationFeedContent"));
}
INIT_FUNC['pages/feed_notifications.html'] = initFeedNotifications;


function initFeedPendingActions() {
  ko.applyBindings(PENDING_ACTION_FEED, document.getElementById("pendingActionFeedContent"));
}
INIT_FUNC['pages/feed_pending_actions.html'] = initFeedPendingActions;


function initHistory() {
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
}
INIT_FUNC['pages/history.html'] = initHistory;


function initStats() {
  pageSetUp(); //init smartadmin featureset
  
  //This code is run on each visit to the page
  window.STATS_HISTORY = new StatsHistoryViewModel();
  window.STATS_TXN_HISTORY = new StatsTransactionHistoryViewModel();
  
  ko.applyBindings(STATS_TXN_HISTORY, document.getElementById("wid-id-statsTxnHistory"));
  ko.applyBindings(STATS_HISTORY, document.getElementById("wid-id-statsHistory"));
  ko.applyBindings(STATS_HISTORY, document.getElementById("wid-id-walletHistory"));
  
  STATS_HISTORY.init();
  STATS_TXN_HISTORY.init();
}
INIT_FUNC['pages/stats.html'] = initStats;


function initLeaderboard() {
  pageSetUp(); //init smartadmin featureset
  
  //This code is run on each visit to the page
  window.ASSET_LEADERBOARD = new AssetLeaderboardViewModel();
  
  ko.applyBindings(ASSET_LEADERBOARD, document.getElementById("leaderboardMarketBar"));
  ko.applyBindings(ASSET_LEADERBOARD, document.getElementsByClassName("leaderboardGrid")[0]);
  
  ASSET_LEADERBOARD.init();
  
  $(window).bind("resize", ASSET_LEADERBOARD.dataTableResponsive);
  $(window).on('hashchange', function() {
    $(window).off("resize", ASSET_LEADERBOARD.dataTableResponsive);
  });
}
INIT_FUNC['pages/leaderboard.html'] = initLeaderboard;


function initExchange() {
  // Hack to resolve books widgets positions
  localStorage.removeItem('Plugin_position_pages/exchange.html_widget-grid');
  
  pageSetUp(); //init smartadmin featureset
  
  //This code is run on each visit to the page
  window.EXCHANGE = new ExchangeViewModel();
  ko.applyBindings(EXCHANGE, document.getElementsByClassName("ordersGrid")[0]);
  
  EXCHANGE.init(true);

  $('#exchangeHelp').click(function() {
    SUPPORT_MODAL.show('exchangePage');
  });
  $('#changeMarket').click(function() {
    loadURL('pages/exchange.html', $('#content'));
  });

}
INIT_FUNC['pages/exchange.html'] = initExchange;


function initPortfolio() {
  pageSetUp(); //init smartadmin featureset
  
  //This code is run on each visit to the page
  window.ASSET_PORTFOLIO = new AssetPortfolioViewModel();
  
  ko.applyBindings(ASSET_PORTFOLIO, document.getElementById("portfolioMarketBar"));
  ko.applyBindings(ASSET_PORTFOLIO, document.getElementsByClassName("portfolioGrid")[0]);
  
  $(window).bind("resize", ASSET_PORTFOLIO.dataTableResponsive);
  $(window).on('hashchange', function() {
    $(window).off("resize", ASSET_PORTFOLIO.dataTableResponsive);
  });
}
INIT_FUNC['pages/portfolio.html'] = initPortfolio;


function initBetting() {
  pageSetUp();
  window.FEED_BROWSER = new FeedBrowserViewModel();
  ko.applyBindings(FEED_BROWSER, document.getElementById("betting"));

  FEED_BROWSER.init();
}
INIT_FUNC['pages/betting.html'] = initBetting;

function initOpenBets() {
  pageSetUp();
  window.OPEN_BETS = new OpenBetsViewModel();
  ko.applyBindings(OPEN_BETS, document.getElementById("openbets"));

  OPEN_BETS.init();
  
  $(window).bind("resize", OPEN_BETS.dataTableResponsive);
  $(window).on('hashchange', function() {
    $(window).off("resize", OPEN_BETS.dataTableResponsive);
  });
}
INIT_FUNC['pages/openbets.html'] = initOpenBets;

function initMatchedBets() {
  pageSetUp();
  window.MATCHED_BETS = new MatchedBetsViewModel();
  ko.applyBindings(MATCHED_BETS, document.getElementById("matchedbets"));

  MATCHED_BETS.init();

  $(window).bind("resize", MATCHED_BETS.dataTableResponsive);
  $(window).on('hashchange', function() {
    $(window).off("resize", MATCHED_BETS.dataTableResponsive);
  });
}
INIT_FUNC['pages/matchedbets.html'] = initMatchedBets;

function initOpenOrders() {
  pageSetUp();
  window.OPEN_ORDERS = new OpenOrdersViewModel();
  ko.applyBindings(OPEN_ORDERS, document.getElementById("openorders"));

  OPEN_ORDERS.init();
}
INIT_FUNC['pages/openorders.html'] = initOpenOrders;

function initOrderMatches() {
  pageSetUp();
  window.ORDER_MATCHES = new OrderMatchesViewModel();
  ko.applyBindings(ORDER_MATCHES, document.getElementById("ordermatches"));

  ORDER_MATCHES.init();
}
INIT_FUNC['pages/ordermatches.html'] = initOrderMatches;

function initRPS() {
  pageSetUp();
  window.RPS = new RpsViewModel();
  ko.applyBindings(RPS, document.getElementById("rps"));

  RPS.init();
}
INIT_FUNC['pages/rps.html'] = initRPS;
