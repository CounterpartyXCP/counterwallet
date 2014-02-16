function AssetViewModel(props) {
  //An address has 2 or more assets (BTC, XCP, and any others)
  var self = this;
  self.ADDRESS = props['address']; //will not change
  self.ASSET = props['asset']; //assetID, will not change
  self.DIVISIBLE = props['divisible'] || true;
  self.isMine = ko.observable(props['isMine'] || null); //null for BTC and XCP, true for self assets, false for others assets
  self.isLocked = ko.observable(props['isLocked'] || false);
  self.balance = ko.observable(props['balance'] || 0); //raw
  self.totalIssued = ko.observable(props['totalIssued'] || 0); //raw
  self.description = ko.observable(props['description'] || '');
  self.CALLABLE = props['callable'] || false;
  self.CALLDATE = props['callDate'] || null;
  self.CALLPRICE = props['callPrice'] || null;
  
  self.normalizedBalance = ko.computed(function() {
    return self.DIVISIBLE ? toFixed(self.balance() / UNIT, 8) : self.balance(); 
  }, self);

  self.displayedBalance = ko.computed(function() {
    return numberWithCommas(self.normalizedBalance()).toString(); 
  }, self);
  
  self.normalizedTotalIssued = ko.computed(function() {
    return self.DIVISIBLE ? toFixed(self.totalIssued() / UNIT, 8) : self.totalIssued(); 
  }, self);

  self.displayedTotalIssued = ko.computed(function() {
    return numberWithCommas(self.normalizedTotalIssued()).toString(); 
  }, self);
  
  self.send = function () {
    if(!self.balance()) { bootbox.alert("You have no available <b>" + self.ASSET + "</b> at address <b>" + self.ADDRESS + "</b> to send."); return; }
    SEND_MODAL.show(self.ADDRESS, self.ASSET, self.balance(), self.DIVISIBLE);
  };
  
  self.issueAdditional = function () {
    assert(self.isMine() && !self.isLocked());
    ISSUE_ADDITIONAL_ASSET_MODAL.show(self.ADDRESS, self.DIVISIBLE, self);
  };
  
  self.transfer = function () {
    assert(self.isMine());
    if(!self.isMine()) { bootbox.alert("Cannot transfer an asset that is not yours."); return; }
    TRANSFER_ASSET_MODAL.show(self.ADDRESS, self);
  };

  self.lock = function () {
    assert(self.isMine() && !self.isLocked());
    
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
            //issue 0 to lock the asset
            multiAPIConsensus("do_issuance",
              {source: self.ADDRESS, quantity: 0, asset: self.ASSET, divisible: self.DIVISIBLE,
               description: self.description(), callable: self.CALLABLE, call_date: self.CALLDATE,
               call_price: self.CALLPRICE, transfer_destination: null,
               unsigned: WALLET.getAddressObj(self.ADDRESS).PUBKEY},
              function(unsignedTXHex, numTotalEndpoints, numConsensusEndpoints) {
                WALLET.signAndBroadcastTx(self.ADDRESS, unsignedTXHex);
                bootbox.alert("Your asset has been locked. It may take a bit for this to reflect.");
            });
          }
        },
      }
    });    
  };

  self.changeDescription = function () {
    CHANGE_ASSET_DESCRIPTION_MODAL.show(self.ADDRESS, self);
  };

  self.payDividend = function () {
    PAY_DIVIDEND_MODAL.show(self.ADDRESS, self);
  };
}

function AddressViewModel(key, address, initialLabel) {
  //An address on a wallet
  var self = this;
  self.KEY = key; //  key : the ECKeyObj (eckey.js)
  self.ADDRESS = address;
  self.PUBKEY = Crypto.util.bytesToHex(key.getPub()); //hex string
  
  self.lastSort = '';
  self.lastSortDirection = '';
  
  self.label = ko.observable(initialLabel);
  self.assets = ko.observableArray([
    new AssetViewModel({address: address, asset: "BTC"}), //will be updated with data loaded from blockchain
    new AssetViewModel({address: address, asset: "XCP"})  //will be updated with data loaded from counterpartyd
  ]);
  
  self.assetFilter = ko.observable('');
  self.filteredAssets = ko.computed(function(){
    if(self.assetFilter() == '') { //show all
      return self.assets();
    } else if(self.assetFilter() == 'base') {
      return ko.utils.arrayFilter(self.assets(), function(asset) {
        return asset.ASSET == 'BTC' || asset.ASSET == 'XCP';
      });      
    } else if(self.assetFilter() == 'mine') {
      return ko.utils.arrayFilter(self.assets(), function(asset) {
        return asset.isMine();
      });      
    } else if(self.assetFilter() == 'others') {
      return ko.utils.arrayFilter(self.assets(), function(asset) {
        return asset.isMine() == false;
      });      
    }
  }, self);
  
  self.getIsotopeOptions = function () {
    return { layoutMode: 'masonry' };
  };
  
  self.getAssetObj = function(asset) {
    //given an asset string, return a reference to the cooresponding AssetViewModel object
    return ko.utils.arrayFirst(this.assets(), function(a) {
      return a.ASSET == asset;
    });
  }
  
  self.addOrUpdateAsset = function(asset, balance) {
    if(asset == 'BTC' || asset == 'XCP') { //special case update
      var match = ko.utils.arrayFirst(self.assets(), function(item) {
          return item.ASSET === asset;
      });
      assert(match); //was created when the address viewmodel was initialized...
      match.balance(balance);
      return;
    }
    
    failoverAPI("get_asset_info", [asset], function(assetInfo, endpoint) {
      var isMine = assetInfo['owner'] == self.ADDRESS; //default to false on error or when we can't find the asset too
      var match = ko.utils.arrayFirst(self.assets(), function(item) {
          return item.ASSET === asset;
      });
      if (!match) { //add the asset if it doesn't exist
        var assetProps = {
          address: self.ADDRESS, asset: asset, divisible: assetInfo['divisible'],
          isMine: isMine, isLocked: assetInfo['locked'], balance: balance,
          totalIssued: assetInfo['total_issued'], description: assetInfo['description'], 
          callable: assetInfo['callable'], callDate: assetInfo['call_date'], callPrice: assetInfo['call_price']        
        };
        self.assets.push(new AssetViewModel(assetProps)); //add new
      } else { //update existing 
        $.jqlog.log("Updating asset " + asset + " @ " + self.ADDRESS + ". Bal from " + match.balance() + " to " + balance + "; Others: " + JSON.stringify(assetInfo));
        match.isMine(isMine);
        match.isLocked(assetInfo['locked']);
        match.balance(balance);
        match.totalIssued(assetInfo['total_issued']);
        match.description(assetInfo['description']);
      }
    });
  }
  
  /////////////////////////
  //Address-panel-related
  self.changeLabel = function(params) {
    PREFERENCES.address_aliases[self.ADDRESS] = params.value;
    //update the preferences on the server 
    multiAPI("store_preferences", [WALLET.identifier(), PREFERENCES], function(data, endpoint) {
      self.label(params.value); //update was a success
    });
  }
  
  self.showQRCode = function() {
    //Show the QR code for this address
    var qrcode = makeQRCode(self.ADDRESS);
    //Pop up a modal with this code
    bootbox.alert('<center><h4>QR Code for ' + self.ADDRESS + '</h4><br/>' + qrcode + '</center>');
  }

  self.createAssetIn = function() {
    //Create an asset for this address
    CREATE_ASSET_MODAL.show(self.ADDRESS);
  }

  self.sortAssetsByName = function() {
    //Sort assets by asset name
    var reverseSort = self.lastSort == 'sortAssetsByName' && self.lastSortDirection == 'asc';
    
    if(reverseSort) {
      self.assets.sort(function(left, right) {
          return right.ASSET.localeCompare(left.ASSET);
      });
    } else {
      self.assets.sort(function(left, right) {
          return left.ASSET.localeCompare(right.ASSET);
      });
    }

    self.lastSortDirection = (self.lastSort == 'sortAssetsByName' && self.lastSortDirection == 'asc') ? 'desc' : 'asc';
    self.lastSort = 'sortAssetsByName';
  }

  self.sortAssetsByBalance = function() {
    //Sort assets by balance
    var reverseSort = self.lastSort == 'sortAssetsByBalance' && self.lastSortDirection == 'asc';

    if(reverseSort) {
      self.assets.sort(function(left, right) {
        return left.balance() == right.balance() ? 0 : (right.balance() < left.balance() ? -1 : 1)
      });
    } else {
      self.assets.sort(function(left, right) {
        return left.balance() == right.balance() ? 0 : (left.balance() < right.balance() ? -1 : 1)
      });
    }    

    self.lastSortDirection = (self.lastSort == 'sortAssetsByBalance' && self.lastSortDirection == 'asc') ? 'desc' : 'asc';
    self.lastSort = 'sortAssetsByBalance';
  }

  self.showAllAssets = function() {
    self.assetFilter(''); //Show all assets
  }

  self.showBaseAssetsOnly = function() {
    self.assetFilter('base'); //Show XCP and BTC only
  }

  self.showMyAssetsOnly = function() {
    self.assetFilter('mine'); //Show all my own assets
  }

  self.showOthersAssetsOnly = function() {
    self.assetFilter('others'); //Show other's (foreign) assets only
  }
}
