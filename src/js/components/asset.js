
function AssetViewModel(props) {
  //An address has 2 or more assets (BTC, XCP, and any others)
  var self = this;
  self.ADDRESS = props['address']; //will not change
  self.ASSET = props['asset']; //assetID, will not change
  self.DIVISIBLE = props['divisible'] || true;
  self.owner = ko.observable(props['owner']);
  self.isLocked = ko.observable(props['isLocked'] || false);
  self.rawBalance = ko.observable(props['rawBalance'] || 0); //raw (not normalized)
  self.rawTotalIssued = ko.observable(props['rawTotalIssued'] || 0); //raw
  self.description = ko.observable(props['description'] || '');
  self.CALLABLE = props['callable'] || false;
  self.CALLDATE = props['callDate'] || null;
  self.CALLPRICE = props['callPrice'] || null;

  self.isMine = ko.computed(function() {
    if(self.ASSET == 'BTC' || self.ASSET == 'XCP') return null; //special value for BTC and XCP
    return self.owner() == self.ADDRESS;
  }, self);
  
  self.normalizedBalance = ko.computed(function() {
    return normalizeAmount(self.rawBalance(), self.DIVISIBLE);
  }, self);

  self.dispBalance = ko.computed(function() {
    return numberWithCommas(self.normalizedBalance()); 
  }, self);
  
  self.normalizedTotalIssued = ko.computed(function() {
    return normalizeAmount(self.rawTotalIssued(), self.DIVISIBLE);
  }, self);

  self.dispTotalIssued = ko.computed(function() {
    return numberWithCommas(self.normalizedTotalIssued()); 
  }, self);
  
  self.dispCallDate = ko.computed(function() {
    return moment(self.CALLDATE * 1000).format("MMM Do YYYY, h:mm:ss a");
  }, self);

  self.send = function () {
    if(!self.rawBalance()) { bootbox.alert("You have no available <b>" + self.ASSET + "</b> at address <b>" + self.ADDRESS + "</b> to send."); return; }
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    SEND_MODAL.show(self.ADDRESS, self.ASSET, self.rawBalance(), self.DIVISIBLE);
  };
  
  self.showInfo = function () {
    SHOW_ASSET_INFO_MODAL.show(self);
  };
  
  self.testnetBurn = function () {
    if(!self.rawBalance()) { bootbox.alert("You have no available <b>" + self.ASSET + "</b> at address <b>" + self.ADDRESS + "</b> to burn."); return; }
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    TESTNET_BURN_MODAL.show(self.ADDRESS);
  };
  
  self.issueAdditional = function () {
    assert(self.isMine() && !self.isLocked());
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    ISSUE_ADDITIONAL_ASSET_MODAL.show(self.ADDRESS, self.DIVISIBLE, self);
  };
  
  self.transfer = function () {
    assert(self.isMine());
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    TRANSFER_ASSET_MODAL.show(self.ADDRESS, self);
  };

  self.lock = function () {
    assert(self.isMine() && !self.isLocked());
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    
    bootbox.dialog({
      message: "By locking your asset, you will not be able to issue more of it in the future.<br/><br/> \
        <b style='color:red'>Please NOTE that this action is irreversable!</b>",
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
          label: "Lock this asset",
          className: "btn-danger",
          callback: function() {
            //to lock, issue with amount == 0 and "LOCK" in the description field
            WALLET.doTransaction(self.ADDRESS, "create_issuance",
              { source: self.ADDRESS,
                amount: 0,
                asset: self.ASSET,
                divisible: self.DIVISIBLE,
                description: "LOCK",
                callable_: self.CALLABLE,
                call_date: self.CALLDATE,
                call_price: self.CALLPRICE,
                transfer_destination: null
              },
              function() {
                bootbox.alert("Your asset has been locked. It may take a bit for this to reflect.");
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

  self.payDividend = function () {
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    PAY_DIVIDEND_MODAL.show(self.ADDRESS, self);
  };
}
