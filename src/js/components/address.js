function AssetViewModel(props) {
  //An address has 2 or more assets (BTC, XCP, and any others)
  var self = this;
  self.ADDRESS = props['address']; //will not change
  self.ASSET = props['asset']; //assetID, will not change
  self.DIVISIBLE = props['divisible'] || true;
  self.isMine = ko.observable(props['isMine'] || null); //null for BTC and XCP, true for self assets, false for others assets
  self.isLocked = ko.observable(props['isLocked'] || false);
  self.balance = ko.observable(props['initialBalance'] || 0);
  self.totalIssued = ko.observable(props['totalIssued'] || 0);
  self.description = ko.observable(props['description'] || '');
  self.CALLABLE = props['callable'] || false;
  self.CALLDATE = props['callDate'] || null;
  self.CALLPRICE = props['callPrice'] || null;

  self.displayedBalance = ko.computed(function() {
    return "Bal: " + numberWithCommas(self.DIVISIBLE ? toFixed(self.balance() / UNIT, 8) : self.balance()).toString(); 
  }, self);
  
  self.send = function () {
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
            var addtlIssuance = $('#addtl_issue').val();

            //validate the entered data as a whole or floating point number
            if(!isNumber(addtlIssuance)) {
              bootbox.alert("Invalid data entered: Must be numeric.");
              return false;
            }
            
            addtlIssuance = parseFloat(addtlIssuance);
            var rawAddtlIssuance = self.DIVISIBLE ? Math.round(addtlIssuance * UNIT) : addtlIssuance;

            if(!self.DIVISIBLE && numberHasDecimalPlace(addtlIssuance)) {
              bootbox.alert("Non-divisible assets may not have a quantity with a decimal place.");
              return false;
            }
            
            if(self.totalIssued() + rawAddtlIssuance > MAX_INT) {
              bootbox.alert("The quantity desired to be issued for this asset is too high.");
              return false;
            }
             
            //do the transfer (zero quantity issuance to the specified address)
            $.jqlog.log("Issuing additional quantity for asset " + self.name() + "; RAW ADDTL QTY = " + rawAddtlIssuance.toString());
            
            multiAPIConsensus("do_issuance",
              {source: self.address(), quantity: rawAddtlIssuance, asset: self.name(), divisible: self.DIVISIBLE,
               description: self.description(), callable: self.CALLABLE, call_date: self.CALLDATE,
               call_price: self.CALLPRICE, transfer_destination: null,
               unsigned: WALLET.getAddressObj(self.address()).PUBKEY},
              function(unsignedTXHex, numTotalEndpoints, numConsensusEndpoints) {
                WALLET.signAndBroadcastTx(self.address(), unsignedTXHex);
                bootbox.alert("You have issued " + addtlIssuance.toString() + " additional quantity on your asset " + self.name() + ". It may take a bit for this to reflect.");
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
            multiAPIConsensus("do_issuance",
              {source: self.address(), quantity: 0, asset: self.name(), divisible: self.DIVISIBLE,
               description: self.description(), callable: self.CALLABLE, call_date: self.CALLDATE,
               call_price: self.CALLPRICE, transfer_destination: address,
               unsigned: WALLET.getAddressObj(self.address()).PUBKEY},
              function(unsignedTXHex, numTotalEndpoints, numConsensusEndpoints) {
                WALLET.signAndBroadcastTx(self.address(), unsignedTXHex);
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
            multiAPIConsensus("do_issuance",
              {source: self.address(), quantity: 0, asset: self.name(), divisible: self.DIVISIBLE,
               description: self.description(), callable: self.CALLABLE, call_date: self.CALLDATE,
               call_price: self.CALLPRICE, transfer_destination: null,
               unsigned: WALLET.getAddressObj(self.address()).PUBKEY},
              function(unsignedTXHex, numTotalEndpoints, numConsensusEndpoints) {
                WALLET.signAndBroadcastTx(self.address(), unsignedTXHex);
                bootbox.alert("Your asset has been locked. It may take a bit for this to reflect.");
            });
          }
        },
      }
    });    
  };

  self.changeDescription = function () {
    bootbox.dialog({
      message: "Enter the new description for this asset:<br/><br/> \
       <input type='text' id='asset_new_description' class='bootbox-input bootbox-input-text form-control'></input>",
      title: "Enter New Description",
      buttons: {
        success: {
          label: "Cancel",
          className: "btn-default",
          callback: function() {
            //modal will disappear
          }
        },
        danger: {
          label: "Change Description",
          className: "btn-primary",
          callback: function() {
            var newDescription = $('#asset_new_description').val();
            
            if(byteCount(newDescription) > 52) {
              bootbox.alert("Entered description is more than 52 bytes long. Please try again.");
              return false;
            }
            
            bootbox.alert("IMPLEMENTATION NOT FINISHED");
            //TODO: THIS IS INCOMPLETE ... we need semantics figured out for how to just change asset desc
            multiAPIConsensus("do_issuance",
              {source: self.address(), quantity: null, asset: self.name(), divisible: self.DIVISIBLE,
               description: newDescription, callable: self.CALLABLE, call_date: self.CALLDATE,
               call_price: self.CALLPRICE, transfer_destination: null,
               unsigned: WALLET.getAddressObj(self.address()).PUBKEY},
              function(unsignedTXHex, numTotalEndpoints, numConsensusEndpoints) {
                WALLET.signAndBroadcastTx(self.address(), unsignedTXHex);
                bootbox.alert("Your asset's description has been changed. It may take a bit for this to reflect.");
            });
          }
        },
      }
    });    
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
  
  self.refreshBTCBalance = function(firstCall) {
    if(!self.doBTCBalanceRefresh)
       return; //stop refreshing
       
    if(!firstCall) {
      WALLET.retrieveBTCBalance(self.ADDRESS, function(endpoint, data) {
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
    assert(asset != 'BTC' && asset != 'XCP', "Trying to dynamically add BTC or XCP");
    
    failoverAPI("get_asset_info", [asset], function(endpoint, assetInfo) {
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
    multiAPI("store_preferences", [WALLET.identifier(), PREFERENCES], function(endpoint, data) {
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
