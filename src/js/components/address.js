function AssetViewModel(address, asset, divisible, isMine, isLocked, initialBalance) {
  //An address has 2 or more assets (BTC, XCP, and any others)
  var self = this;
  self.ADDRESS = address; //will not change
  self.ASSET = asset; //assetID, will not change
  self.isMine = ko.observable(isMine); //null for BTC and XCP, true for self assets, false for others assets
  self.isLocked = ko.observable(isLocked);
  self.DIVISIBLE = divisible;
  self.balance = ko.observable(initialBalance);
  
  self.displayedBalance = ko.computed(function() {
    return "Bal: " + numberWithCommas(self.DIVISIBLE ? toFixed(self.balance() / 100000000, 8) : self.balance()).toString(); 
  }, self);
  
  self.sendTo = function () {
    if(!self.balance()) { bootbox.alert("You have no balance of this asset to send."); return; }

    //pop up the send to window with the address and asset pre-populated
    bootbox.alert("Functionality not yet implemented.");
  };
  
  self.issueAdditional = function () {
    if(!self.isMine()) { bootbox.alert("Cannot issue existing quanity of an asset that is not yours."); return; }
    if(self.isLocked()) { bootbox.alert("Cannot issue existing quanity of a locked asset."); return; }
    
    bootbox.dialog({
      message: "How many more quantity of this asset would you like to issue? <i>(For divisible assets, state \
       the amount as a whole or floating point number, not in satoshis -- e.g. '732.45')</i><br/><br/> \
       <b style='color:red'>Please NOTE that this action is irreversable</b><br/><br/> \
       <input type='text' id='addtl_issue' class='bootbox-input bootbox-input-text form-control'></input>",
      title: "Confirm Additional Issuance",
      buttons: {
        success: {
          label: "Cancel",
          className: "btn-default",
          callback: function() {
            //modal will disappear
          }
        },
        danger: {
          label: "Issue additional quantity",
          className: "btn-danger",
          callback: function() {
            var addtl_issuance = $('#addtl_issue').val();
            //validate the entered data as a whole or floating point number
            if(!isNumber(addtl_issuance)) {
              return bootbox.alert("Invalid data entered: Must be numeric.");
            }
             
            //do the transfer (zero quantity issuance to the specified address)
            addtl_issuance = parseFloat(addtl_issuance);
            makeJSONAPICall("counterpartyd", "do_issuance",
              [self.address(), addtl_issuance, self.name(), self.divisible(),
               null, WALLET.getAddressObj(self.address()).PUBKEY],
              function(unsigned_tx_hex) {
                WALLET.signAndBroadcastTx(self.address(), unsigned_tx_hex);
                bootbox.alert("Your asset has been transferred to <b>" + address + "</b>. It may take a bit for this to reflect.");
            });
          }
        },
      }
    });    
  };
  
  self.transfer = function () {
    if(!self.isMine()) { bootbox.alert("Cannot transfer an asset that is not yours."); return; }
    
    bootbox.dialog({
      message: "Enter the bitcoin address you would like to perminently transfer <u>ALL</u> shares of this \
       asset to.<br/><br/><b style='color:red'>Please NOTE that this action is irreversable</b><br/><br/> \
       <input type='text' id='transfer_address' class='bootbox-input bootbox-input-text form-control'></input>",
      title: "Confirm Transfer Request",
      buttons: {
        success: {
          label: "Cancel",
          className: "btn-default",
          callback: function() {
            //modal will disappear
          }
        },
        danger: {
          label: "Transfer this asset",
          className: "btn-danger",
          callback: function() {
            var address = $('#transfer_address').val();
            try {
              Bitcoin.Address(address);
            } catch (err) {
              return bootbox.alert("Invalid bitcoin address entered.");
            }
            
            //do the transfer (zero quantity issuance to the specified address)
            makeJSONAPICall("counterpartyd", "do_issuance",
              [self.address(), 0, self.name(), self.divisible(),
               address, WALLET.getAddressObj(self.address()).PUBKEY],
              function(unsigned_tx_hex) {
                WALLET.signAndBroadcastTx(self.address(), unsigned_tx_hex);
                bootbox.alert("Your asset has been transferred to <b>" + address + "</b>. It may take a bit for this to reflect.");
            });
          }
        },
      }
    });    
  };

  self.lock = function () {
    if(self.isLocked()) { bootbox.alert("This asset is already locked."); return; }
    if(!self.isMine()) { bootbox.alert("Cannot lock an asset that is not yours."); return; }
    
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
            makeJSONAPICall("counterpartyd", "do_issuance",
              [self.address(), 0, self.name(), self.divisible(),
               null, WALLET.getAddressObj(self.address()).PUBKEY],
              function(unsigned_tx_hex) {
                WALLET.signAndBroadcastTx(self.address(), unsigned_tx_hex);
                bootbox.alert("Your asset has been locked. It may take a bit for this to reflect.");
            });
          }
        },
      }
    });    
  };

  self.changeDescription = function () {
    bootbox.alert("Functionality not yet implemented.");
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
  self.doBalanceRefresh = true;
  
  self.label = ko.observable(initialLabel);
  self.assets = ko.observableArray([
    new AssetViewModel(address, "BTC", true, null, false, 0), //will be updated with data loaded from blockchain
    new AssetViewModel(address, "XCP", true, null, false, 0)  //will be updated with data loaded from counterpartyd
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
        setInterval(function() { self.refreshBTCBalance(false) }, 60000 * 5); //every 5 minutes
      });
    } else { //skip the balance check on the first call (since we just got it earlier when building the wallet)
      setInterval(function() { self.refreshBTCBalance(false) }, 60000 * 5); //every 5 minutes
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
        self.assets.push(new AssetViewModel(self.ADDRESS, asset, result['divisible'], isMine, result['locked'], balance)); //add new
      });
    } else {
      $.jqlog.log("Updating balance for asset " + asset + " @ " + self.ADDRESS + " from " + match.balance() + " to " + balance);
      match.balance(balance); //modify existing
    }
  }
  
  /////////////////////////
  //Address-panel-related
  self.changeLabel = function(params) {
    PREFERENCES.address_aliases[self.ADDRESS] = params.value;
    //update the preferences on the server 
    makeJSONAPICall("counterwalletd", "store_preferences", [WALLET.identifier(), PREFERENCES], function(data) {
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
