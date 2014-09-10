
function AssetViewModel(props) {
  //An address has 2 or more assets (BTC, XCP, and any others)
  var self = this;
  self.ADDRESS = props['address']; //will not change
  self.ASSET = props['asset']; //assetID, will not change
  self.DIVISIBLE = props['divisible'] !== undefined ? props['divisible'] : true;
  self.owner = ko.observable(props['owner']);
  self.locked = ko.observable(props['locked'] !== undefined ? props['locked'] : false);
  self.rawBalance = ko.observable(props['rawBalance'] || (self.ASSET == 'BTC' ? null : 0));
  //^ raw (not normalized) (for BTC/XCP, default to null to show '??' instead of 0, until the balance is populated)
  self.rawSupply = ko.observable(props['rawSupply'] || 0); //raw
  self.SUPPLY = normalizeQuantity(self.rawSupply(), self.DIVISIBLE);
  self.holdersSupply = self.rawSupply() - self.rawBalance();
  self.description = ko.observable(props['description'] || '');
  self.CALLABLE = props['callable'] !== undefined ? props['callable'] : false;
  self.CALLDATE = props['callDate'] || null;
  self.CALLPRICE = props['callPrice'] || null;
  
  self.balanceChangePending = ko.observable(false);
  //^ if/when set to true, will highlight the balance to show that a balance change is pending
  self.issuanceQtyChangePending = ko.observable(false);
  //^ similar, but for the "Issued" text on owned assets

  self.escrowedBalance = ko.observable(props['rawEscrowedBalance']);

  self.dispEscrowedBalance = ko.computed(function() {
    if (self.escrowedBalance()) {
      return '/ Escr: ' + smartFormat(normalizeQuantity(self.escrowedBalance(), self.DIVISIBLE));
    }
  }, self);

  self.updateEscrowedBalance = function(delta) {
    self.escrowedBalance(self.escrowedBalance() + delta);
  }

  self.isMine = ko.computed(function() {
    if(self.ASSET == 'BTC' || self.ASSET == 'XCP') return null; //special value for BTC and XCP
    return self.owner() == self.ADDRESS;
  }, self);
  
  self.normalizedBalance = ko.computed(function() {
    if(self.rawBalance() === null) return null;
    return normalizeQuantity(self.rawBalance(), self.DIVISIBLE);
  }, self);
  
  self.normalizedTotalIssued = ko.computed(function() {
    return normalizeQuantity(self.rawSupply(), self.DIVISIBLE);
  }, self);

  self.dispTotalIssued = ko.computed(function() {
    return smartFormat(self.normalizedTotalIssued()); 
  }, self);
  
  self.dispCallDate = ko.computed(function() {
    if(!self.CALLDATE) return null;
    return moment(self.CALLDATE * 1000).format("MMM Do YYYY, h:mm:ss a");
  }, self);

  self.unconfirmedBalance = ko.observable(0);
  self.unconfirmedBalance.subscribe(function(value) {
    if (value==0) {
      self.balanceChangePending(false);
    }
  })

  self.availableBalance = ko.computed(function() {
    return addFloat(self.normalizedBalance(), self.unconfirmedBalance());
  });
  
  self.rawAvailableBalance = ko.computed(function() {
    return denormalizeQuantity(self.availableBalance(), self.DIVISIBLE);
  });

  self.dispBalance = ko.computed(function() {
    var confirmed = self.normalizedBalance() === null ? '??' : smartFormat(self.normalizedBalance(), true);
    var unconfirmed = self.availableBalance() != self.normalizedBalance() ? ' <span style="font-size:11px">(' + smartFormat(self.availableBalance(), true) + ')</span>' : '';
    return confirmed + unconfirmed;
  }, self);
  
  self.dispBalancePadding = ko.computed(function() {
    return self.locked() && self.CALLABLE ? '40px' : (self.locked() || self.CALLABLE ? '20px' : '0px');    
  }, self);

  self.send = function () {
    if(self.availableBalance()<=0) { 
      bootbox.alert(i18n.t("not_available_asset_to_send", self.ASSET, getAddressLabel(self.ADDRESS))); 
      return; 
    }
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    SEND_MODAL.show(self.ADDRESS, self.ASSET, self.rawAvailableBalance(), self.DIVISIBLE);
  };
  
  self.showInfo = function () {
    SHOW_ASSET_INFO_MODAL.show(self);
  };
  
  self.testnetBurn = function () {
    if(!self.availableBalance()) { 
      bootbox.alert(i18n.t("not_available_asset_to_burn", self.ASSET, getAddressLabel(self.ADDRESS))); 
      return; 
    }
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    TESTNET_BURN_MODAL.show(self.ADDRESS);
  };
  
  self.issueAdditional = function () {
    assert(self.isMine() && !self.locked());
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    ISSUE_ADDITIONAL_ASSET_MODAL.show(self.ADDRESS, self.DIVISIBLE, self);
  };
  
  self.transfer = function () {
    assert(self.isMine());
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    TRANSFER_ASSET_MODAL.show(self.ADDRESS, self);
  };

  self.lock = function () {
    assert(self.isMine() && !self.locked());
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    
    bootbox.dialog({
      message: i18n.t("lock_asset_warning"),
      title: i18n.t("are_you_sure"),
      buttons: {
        success: {
          label: i18n.t("cancel"),
          className: "btn-default",
          callback: function() {
            //modal will disappear
          }
        },
        danger: {
          label: i18n.t("lock_token"),
          className: "btn-danger",
          callback: function() {
            //to lock, issue with quantity == 0 and "LOCK" in the description field
            WALLET.doTransaction(self.ADDRESS, "create_issuance",
              { source: self.ADDRESS,
                quantity: 0,
                asset: self.ASSET,
                divisible: self.DIVISIBLE,
                description: 'LOCK',
                callable_: self.CALLABLE,
                call_date: self.CALLDATE ? self.CALLDATE : null,
                call_price: self.CALLPRICE ? self.CALLPRICE : null,
                transfer_destination: null
              },
              function(txHash, data, endpoint, addressType, armoryUTx) {
                var message = i18n.t("no_more_token_may_issued");
                if (armoryUTx) {
                  message = i18n.t("token_will_be_locked") + " " + message;
                } else {
                  message = i18n.t("token_has_been_locked") + " " + message;
                }
                WALLET.showTransactionCompleteDialog(message + " " + i18n.t(ACTION_PENDING_NOTICE), message, armoryUTx);
              }
            );
          }
        },
      }
    });    
  };

  self.changeDescription = function () {
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    CHANGE_ASSET_DESCRIPTION_MODAL.show(self.ADDRESS, self);
  };
  
  self.call = function() {
    ///////////////////
    //TEMP DISABLE
    bootbox.alert(i18n.t("callback_temporarily_disabled"));
    return false;
    ///////////////////
    
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    CALL_ASSET_MODAL.show(self.ADDRESS, self.ASSET);
  }
}
