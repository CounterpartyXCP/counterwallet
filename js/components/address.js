function AddressViewModel(key, address, initialLabel) {
  //An address on a wallet
  var self = this;
  self.KEY = key; //  key : the ECKeyObj (eckey.js)
  self.ADDRESS = address;
  
  self.label = ko.observable(initialLabel);
  self.assets = ko.observableArray([
    new AssetViewModel(address, "BTC", null, 0), //will be updated with data loaded from blockchain
    new AssetViewModel(address, "XCP", null, 0)  //will be updated with data loaded from counterpartyd
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
        return !asset.isMine();
      });      
    }
  }, self);  
    
  this.getIsotopeOptions = function () {
    return { layoutMode: 'masonry' };
  };
  
  self.addOrUpdateAsset = function(asset, balance) {
    //add the balance if it doesn't exist
    var match = ko.utils.arrayFirst(self.assets(), function(item) {
        return item.ASSET === asset;
    });
    if (!match) {
      assert(asset != 'BTC' && asset != 'XCP', "Trying to dynamically add BTC or XCP");
      
      //Before we push, look up the asset to see if the issuer matches this address
      makeJSONAPICall("counterwalletd", "get_asset_owner", [asset], function(owner) {
        var isMine = owner == self.ADDRESS; //default to false on error or when we can't find the asset too
        self.assets.push(new AssetViewModel(self.ADDRESS, asset, isMine, balance)); //add new
      });
    } else {
      match.balance(balance); //modify existing
    }
  }
  
  /////////////////////////
  //Address-panel-related
  self.changeLabel = function(params) {
    PREFERENCES.address_aliases[self.ADDRESS] = params.value;
    //update the preferences on the server 
    makeJSONAPICall("counterwalletd", "store_preferences", [WALLET.id, prefs], function(data) {
      self.label = params.value; //update was a success
    });
  }
  
  self.sendFrom = function() {
    //Send from this address (go to the send pane with this address pre-entered)
    alert("sendFrom Todo");
  }

  self.showQRCode = function() {
    //Show the QR code for this address
    var qrcode = makeQRCode(self.ADDRESS);
    //Pop up a modal with this code
    showAlertModal(qrcode, "QR Code for " + self.ADDRESS);
  }

  self.createAssetIn = function() {
    //Create an asset for this address
    alert("createAssetIn Todo");
  }

  self.sortAssetsByName = function() {
    //Sort assets by asset name
    self.assets.sort(function(left, right) {
      return left.ASSET.localeCompare(right.ASSET);
    });    
  }

  self.sortAssetsByBalance = function() {
    //Sort assets by balance
    self.assets.sort(function(left, right) {
      return left.balance() == right.balance() ? 0 : (left.balance() < right.balance() ? -1 : 1)
    });    
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
