
function AssetViewModel(props) {
  //An address has 2 or more assets (BTC, XCP, and any others)
  var self = this;
  self.ADDRESS = props['address']; //will not change
  self.ASSET = props['asset']; //assetID, will not change
  self.DIVISIBLE = props['divisible'] || true;
  self.isMine = ko.observable(props['isMine'] || null); //null for BTC and XCP, true for self assets, false for others assets
  self.isLocked = ko.observable(props['isLocked'] || false);
  self.balance = ko.observable(props['balance'] || 0); //raw (not normalized)
  self.totalIssued = ko.observable(props['totalIssued'] || 0); //raw
  self.description = ko.observable(props['description'] || '');
  self.CALLABLE = props['callable'] || false;
  self.CALLDATE = props['callDate'] || null;
  self.CALLPRICE = props['callPrice'] || null;
  
  self.normalizedBalance = ko.computed(function() {
    return self.DIVISIBLE ? Decimal.round(new Decimal(self.balance()).div(UNIT), 8).toFloat() : self.balance(); 
  }, self);

  self.displayedBalance = ko.computed(function() {
    return numberWithCommas(self.normalizedBalance()).toString(); 
  }, self);
  
  self.normalizedTotalIssued = ko.computed(function() {
    return self.DIVISIBLE ? Decimal.round(new Decimal(self.totalIssued()).div(UNIT), 8).toFloat() : self.totalIssued(); 
  }, self);

  self.displayedTotalIssued = ko.computed(function() {
    return numberWithCommas(self.normalizedTotalIssued()); 
  }, self);
  
  self.send = function () {
    if(!self.balance()) { bootbox.alert("You have no available <b>" + self.ASSET + "</b> at address <b>" + self.ADDRESS + "</b> to send."); return; }
    if(!canDoTransaction(self.ADDRESS)) return false;
    SEND_MODAL.show(self.ADDRESS, self.ASSET, self.balance(), self.DIVISIBLE);
  };
  
  self.issueAdditional = function () {
    assert(self.isMine() && !self.isLocked());
    if(!canDoTransaction(self.ADDRESS)) return false;
    ISSUE_ADDITIONAL_ASSET_MODAL.show(self.ADDRESS, self.DIVISIBLE, self);
  };
  
  self.transfer = function () {
    assert(self.isMine());
    if(!canDoTransaction(self.ADDRESS)) return false;
    TRANSFER_ASSET_MODAL.show(self.ADDRESS, self);
  };

  self.lock = function () {
    assert(self.isMine() && !self.isLocked());
    if(!canDoTransaction(self.ADDRESS)) return false;
    
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
            //to lock, issue with quantity == 0 and "LOCK" in the description field
            multiAPIConsensus("create_issuance",
              {source: self.ADDRESS, quantity: 0, asset: self.ASSET, divisible: self.DIVISIBLE,
               description: "LOCK", callable_: self.CALLABLE, call_date: self.CALLDATE,
               call_price: self.CALLPRICE, transfer_destination: null,
               multisig: WALLET.getAddressObj(self.ADDRESS).PUBKEY},
              function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {
                WALLET.signAndBroadcastTx(self.ADDRESS, unsignedTxHex);
                bootbox.alert("Your asset has been locked. It may take a bit for this to reflect.");
            });
          }
        },
      }
    });    
  };

  self.changeDescription = function () {
    if(!canDoTransaction(self.ADDRESS)) return false;
    CHANGE_ASSET_DESCRIPTION_MODAL.show(self.ADDRESS, self);
  };

  self.payDividend = function () {
    if(!canDoTransaction(self.ADDRESS)) return false;
    PAY_DIVIDEND_MODAL.show(self.ADDRESS, self);
  };
}
