
function AddressViewModel(key, address, initialLabel) {
  //An address on a wallet
  var self = this;
  self.KEY = key; //  key : the ECKeyObj (eckey.js)
  self.ADDRESS = address;
  self.PUBKEY = key.getPub().toHex(); //hex string
  
  self.lastSort = '';
  self.lastSortDirection = '';
  
  self.label = ko.observable(initialLabel);
  self.numPrimedTxouts = ko.observable(null);
  //^ # of unspent txouts for this address fitting our criteria, or null if unknown (e.g. insight is down/not responding)
  self.assets = ko.observableArray([
    new AssetViewModel({address: address, asset: "BTC"}), //will be updated with data loaded from insight
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
  
  self.dispNumPrimedTxouts = ko.computed(function(){
    var txo = self.numPrimedTxouts();
    if(txo === null) return 'Primed:&nbsp;<span class="badge">??</span>'; 
    if(txo < 3) return 'Primed:&nbsp;<span class="badge badge-error">'+txo+'</span>'; 
    if(txo < 5) return 'Primed:&nbsp;<span class="badge badge-warning">'+txo+'</span>'; 
    return 'Primed:&nbsp;<span class="badge badge-success">'+txo+'</span>'; 
  }, self);
  
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
    if(!checkForPrimedTxout(self.ADDRESS)) return false;
    var addressHash = Bitcoin.convert.bytesToBase64(Bitcoin.Crypto.SHA256(self.ADDRESS, {asBytes: true}));
    PREFERENCES.address_aliases[addressHash] = params.value;
    //update the preferences on the server 
    multiAPI("store_preferences", [WALLET.identifier(), PREFERENCES], function(data, endpoint) {
      self.label(params.value); //update was a success
    });
  }
  
  self.prime = function() {
    //No need for canDoTransaction here, as PRIME_ADDRESS_MODAL checks for 0 BTC balance
    PRIME_ADDRESS_MODAL.show(self.ADDRESS);
  }
  
  self.showQRCode = function() {
    //Show the QR code for this address
    var qrcode = makeQRCode(self.ADDRESS);
    //Pop up a modal with this code
    bootbox.alert('<center><h4>QR Code for <b>' + self.ADDRESS + '</b></h4><br/>' + qrcode + '</center>');
  }
  
  self.signMessage = function() {
    SIGN_MESSAGE_MODAL.show(self.ADDRESS);
  }

  self.createAssetIn = function() {
    if(!canDoTransaction(self.ADDRESS)) return false;
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
