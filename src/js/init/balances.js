//Bind the WALLET object to balancesGrid (this MUST go before pageSetUp on this page or Wierd Things Will Happen!)
ko.applyBindingsWithValidation(WALLET, document.getElementsByClassName("balancesContainer")[0]);
pageSetUp(); //init smartadmin featureset
 
//balances.js
window.CHANGE_ADDRESS_LABEL_MODAL = new ChangeAddressLabelModalViewModel();
window.CREATE_NEW_ADDRESS_MODAL = new CreateNewAddressModalViewModel();
window.SEND_MODAL = new SendModalViewModel();
window.SWEEP_MODAL = new SweepModalViewModel();
window.SIGN_MESSAGE_MODAL = new SignMessageModalViewModel();
window.TESTNET_BURN_MODAL = new TestnetBurnModalViewModel();

ko.applyBindings({}, document.getElementById("gettingStartedNotice"));
ko.applyBindings({}, document.getElementById("pendingBTCPayNotice"));
ko.applyBindingsWithValidation(CHANGE_ADDRESS_LABEL_MODAL, document.getElementById("changeAddressLabelModal"));
ko.applyBindingsWithValidation(CREATE_NEW_ADDRESS_MODAL, document.getElementById("createNewAddressModal"));
ko.applyBindingsWithValidation(SEND_MODAL, document.getElementById("sendModal"));
ko.applyBindingsWithValidation(SWEEP_MODAL, document.getElementById("sweepModal"));
ko.applyBindingsWithValidation(SIGN_MESSAGE_MODAL, document.getElementById("signMessageModal"));
ko.applyBindingsWithValidation(TESTNET_BURN_MODAL, document.getElementById("testnetBurnModal"));
  
//balances_assets.js
window.CREATE_ASSET_MODAL = new CreateAssetModalViewModel();
window.ISSUE_ADDITIONAL_ASSET_MODAL = new IssueAdditionalAssetModalViewModel();
window.TRANSFER_ASSET_MODAL = new TransferAssetModalViewModel();
window.CHANGE_ASSET_DESCRIPTION_MODAL = new ChangeAssetDescriptionModalViewModel();
window.PAY_DIVIDEND_MODAL = new PayDividendModalViewModel();
window.CALL_ASSET_MODAL = new CallAssetModalViewModel();
window.SHOW_ASSET_INFO_MODAL = new ShowAssetInfoModalViewModel();

ko.applyBindingsWithValidation(CREATE_ASSET_MODAL, document.getElementById("createAssetModal"));
ko.applyBindingsWithValidation(ISSUE_ADDITIONAL_ASSET_MODAL, document.getElementById("issueAdditionalAssetModal"));
ko.applyBindingsWithValidation(TRANSFER_ASSET_MODAL, document.getElementById("transferAssetModal"));
ko.applyBindingsWithValidation(CHANGE_ASSET_DESCRIPTION_MODAL, document.getElementById("changeAssetDescriptionModal"));
ko.applyBindingsWithValidation(PAY_DIVIDEND_MODAL, document.getElementById("payDividendModal"));
ko.applyBindingsWithValidation(CALL_ASSET_MODAL, document.getElementById("callAssetModal"));
ko.applyBindingsWithValidation(SHOW_ASSET_INFO_MODAL, document.getElementById("showAssetInfoModal"));

$(document).ready(function() {
    //Some misc jquery event handlers
    $('#createAddress, #createWatchOnlyAddress').click(function() {
      if(WALLET.addresses().length >= MAX_ADDRESSES) {
        bootbox.alert("You already have the max number of addresses for a single wallet (<b>"
          + MAX_ADDRESSES + "</b>). Please create a new wallet (i.e. different passphrase) for more.");
        return false;
      }
      CREATE_NEW_ADDRESS_MODAL.show($(this).attr('id') == 'createWatchOnlyAddress');
    });
    
    $('#sweepFunds').click(function() {
      SWEEP_MODAL.show();
    });
      
    //Called on first load, and every switch back to the balances page
    if(window._BALANCES_HAS_LOADED_ALREADY === undefined) {
        window._BALANCES_HAS_LOADED_ALREADY = true;
    } else {
        WALLET.refreshBTCBalances(false);
    }
});
