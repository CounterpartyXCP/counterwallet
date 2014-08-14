
function AssetViewModel(props) {
  //An address has 2 or more assets (BTC, XCP, and any others)
  var self = this;
  self.ADDRESS = props['address']; //will not change
  self.ASSET = props['asset']; //assetID, will not change
  self.DIVISIBLE = props['divisible'] !== undefined ? props['divisible'] : true;
  self.owner = ko.observable(props['owner']);
  self.locked = ko.observable(props['locked'] !== undefined ? props['locked'] : false);
  self.rawBalance = ko.observable(props['rawBalance'] || (self.ASSET == BTC ? null : 0));
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

  self.isMine = ko.computed(function() {
    if(self.ASSET == BTC || self.ASSET == XCP) return null; //special value for BTC and XCP
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
  
  self.dispBalance = ko.computed(function() {
    var confirmed = self.normalizedBalance() === null ? '??' : smartFormat(self.normalizedBalance(), true);
    var unconfirmedBal = addFloat(self.normalizedBalance(), self.unconfirmedBalance());
    var unconfirmed = unconfirmedBal != self.normalizedBalance() ? ' <span style="font-size:11px">(' + smartFormat(unconfirmedBal, true) + ')</span>' : '';
    return confirmed + unconfirmed;
  }, self);
  
  self.dispBalancePadding = ko.computed(function() {
    return self.locked() && self.CALLABLE ? '40px' : (self.locked() || self.CALLABLE ? '20px' : '0px');    
  }, self);

  self.send = function () {
    if(!self.rawBalance()) { bootbox.alert("You have no available <b class='notoAssetColor'>" + self.ASSET + "</b>"
      + " at address <b class='notoAddrColor'>" + getAddressLabel(self.ADDRESS) + "</b> to send."); return; }
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    SEND_MODAL.show(self.ADDRESS, self.ASSET, self.rawBalance(), self.DIVISIBLE);
  };
  
  self.showInfo = function () {
    SHOW_ASSET_INFO_MODAL.show(self);
  };
  
  self.testnetBurn = function () {
    if(!self.rawBalance()) { bootbox.alert("You have no available <b class='notoAssetColor'>" + self.ASSET + "</b>"
      + " at address <b class='notoAddrColor'>" + getAddressLabel(self.ADDRESS) + "</b> to burn."); return; }
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
      message: "By locking your token, you will not be able to issue more units of it in the future.<br/><br/> \
        <b class='errorRed'>Please NOTE that this action is irreversable!</b>",
      title: "Are you sure?",
      buttons: {
        success: {
          label: "Cancel",
          className: "btn-default",
          callback: function() {
            //modal will disappear
          }
        },
        danger: {
          label: "Lock Token",
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
                var message = "Your token " + (armoryUTx ? "will be" : "has been") + " locked. No more units of the token may be issued.";
                WALLET.showTransactionCompleteDialog(message + ACTION_PENDING_NOTICE, message, armoryUTx);
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
    bootbox.alert("Token callbacks are temporarily disabled.");
    return false;
    ///////////////////
    
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    CALL_ASSET_MODAL.show(self.ADDRESS, self.ASSET);
  }
}
