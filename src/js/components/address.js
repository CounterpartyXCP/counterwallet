function AddressViewModel(key, address, initialLabel) {
  //An address on a wallet
  var self = this;
  self.KEY = key; //  key : the ECKeyObj (eckey.js)
  self.ADDRESS = address;
  self.PUBKEY = Crypto.util.bytesToHex(key.getPub()); //hex string
  
  self.lastSort = '';
  self.lastSortDirection = '';
  self.doBalanceRefresh = true;
  
  self.label = ko.observable(initialLabel);
  self.assets = ko.observableArray([
    new AssetViewModel(address, "BTC", true, null, 0), //will be updated with data loaded from blockchain
    new AssetViewModel(address, "XCP", true, null, 0)  //will be updated with data loaded from counterpartyd
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
  
  self.refreshBTCBalance = function(firstCall) {
    if(!self.doBTCBalanceRefresh)
       return; //stop refreshing
       
    if(!firstCall) {
      WALLET.retrieveBTCBalance(self.ADDRESS, function(data) {
        //Find the BTC asset and update
        var btcAsset = ko.utils.arrayFirst(self.assets(), function(a) {
              return a.ASSET == 'BTC';
        });
        btcAsset.balance(parseInt(data));
        setInterval(self.refreshBTCBalance, 60000 * 5); //every 5 minutes
      });
    } else { //skip the balance check on the first call (since we just got it earlier when building the wallet)
      setInterval(self.refreshBTCBalance, 60000 * 5); //every 5 minutes
    }
  }
  //set up a timer to refresh BTC balances every 5 minutes (as these are the only balance that will not
  // come in on the socket.io feed)
  $.jqlog.log("Setting up BTC balance refresh timer for " + self.ADDRESS);
  self.refreshBTCBalance(true);
    
  self.getIsotopeOptions = function () {
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
      makeJSONAPICall("counterpartyd", "get_asset_info", [asset], function(result) {
        var isMine = result['owner'] == self.ADDRESS; //default to false on error or when we can't find the asset too
        self.assets.push(new AssetViewModel(self.ADDRESS, asset, result['divisible'], isMine, balance)); //add new
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
    makeJSONAPICall("counterwalletd", "store_preferences", [WALLET.id, PREFERENCES], function(data) {
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
