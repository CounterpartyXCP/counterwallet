
function AddressViewModel(type, key, address, initialLabel, armoryPubKey) {
  //An address on a wallet
  //type is one of: normal, watch, armory
  assert(['normal', 'watch', 'armory'].indexOf(type) != -1);
  assert((type == 'normal' && key) || (type == 'watch' && !key) || (type == 'armory' && !key));
  assert((type == 'armory' && armoryPubKey) || !armoryPubKey); //only used with armory addresses

  var self = this;
  
  self.KEY = key; //  key : the HierarchicalKey bitcore object
  self.TYPE = type;
  self.ADDRESS = address;
  self.PUBKEY = type == 'armory' ? armoryPubKey : (key ? key.getPub() : ''); //hex string

  //Accessors for ease of use in templates...
  self.FEATURE_DIVIDEND = disabledFeatures.indexOf('dividend') == -1;
  self.IS_NORMAL = (type == 'normal');
  self.IS_WATCH_ONLY = (type == 'watch');
  self.IS_ARMORY_OFFLINE = (type == 'armory');

  self.lastSort = ko.observable('');
  self.lastSortDirection = ko.observable('');
  
  self.label = ko.observable(initialLabel);
  self.numPrimedTxouts = ko.observable(null);
  //^ # of unspent txouts for this address fitting our criteria, or null if unknown (e.g. insight is down/not responding)
  self.numPrimedTxoutsIncl0Confirms = ko.observable(null);

  self.assets = ko.observableArray([
    new AssetViewModel({address: address, asset: BTC}), //will be updated with data loaded from insight
    new AssetViewModel({address: address, asset: XCP})  //will be updated with data loaded from counterpartyd
  ]);
  
  self.assetFilter = ko.observable('');
  self.filteredAssets = ko.computed(function(){
    if(self.assetFilter() == '') { //show all
      return self.assets();
    } else if(self.assetFilter() == 'base') {
      return ko.utils.arrayFilter(self.assets(), function(asset) {
        return asset.ASSET == BTC || asset.ASSET == XCP;
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
  
  self.getAssetObj = function(asset) {
    //given an asset string, return a reference to the cooresponding AssetViewModel object
    return ko.utils.arrayFirst(self.assets(), function(a) {
      return a.ASSET == asset;
    });
  }
  
  self.getAssetsList = function() {
    var assets = [];
    ko.utils.arrayForEach(self.assets(), function(asset) {
      assets.push(asset.ASSET);
    });
    return assets;
  }
  
  self.addOrUpdateAsset = function(asset, assetInfo, initialRawBalance) {
    //Update asset property changes (ONLY establishes initial balance when logging in! -- past that, balance changes
    // come from debit and credit messages)
    //initialRawBalance is null if this is not an initial update
    //assetInfo comes from a call to get_asset_info, or as an issuance message feed object itself
    var match = ko.utils.arrayFirst(self.assets(), function(item) {
        return item.ASSET === asset;
    });

    if(asset == BTC || asset == XCP) { //special case update
      assert(match); //was created when the address viewmodel was initialized...
      match.rawBalance(initialRawBalance);
      return;
    }

    if (!match) {
      //add the asset if it doesn't exist. this can be triggered on login (from get_asset_info API results)
      // OR via the message feed (through receiving an asset send or ownership transfer for an asset not in the address yet)
      $.jqlog.debug("Adding token " + asset + " to address " + self.ADDRESS + " with raw bal "
        + initialRawBalance + " (divisible: " + assetInfo['divisible'] + ")");
      var assetProps = {
        address: self.ADDRESS,
        asset: asset,
        divisible: assetInfo['divisible'],
        owner: assetInfo['owner'] || assetInfo['issuer'],
        locked: assetInfo['locked'],
        rawBalance: initialRawBalance,
        rawSupply: assetInfo['supply'] || assetInfo['quantity'],
        description: assetInfo['description'], 
        callable: assetInfo['callable'],
        callDate: assetInfo['call_date'],
        callPrice: assetInfo['call_price']
      };
      self.assets.push(new AssetViewModel(assetProps)); //add new
      setTimeout(function() {

        $('#address-wid-' + self.ADDRESS + ' .dropdown-toggle').last().dropdown();

        $('#address-wid-' + self.ADDRESS + ' .asset-item:last-child .assetBtn').unbind('click');
        $('#address-wid-' + self.ADDRESS + ' .asset-item:last-child .assetBtn').click(function (event) {
          var menu = $(this).parent().find('ul');
          if (menu.css('display')=='block') {
            menu.hide();
          } else {
            menu.show();
          }
          menu.mouseleave(function() {
            menu.hide();
            menu.unbind('mouseleave');
          })
        });

      }, 1000);

    } else {
      //update existing. NORMALLY this logic is really only reached from the messages feed, however, we can have the
      // case where if we have a sweep operation for instance (which will show up as an asset transfer and credit
      // message received on the same block, at about the same time), due to API calls that are made in the handlers for
      // these, we could have a potential race condition where WALLET.updateBalance ends up calling this function
      // instead of just updating the rawBalance itself. We should be able to gracefully handle that...
      if(initialRawBalance) {
        match.rawBalance(initialRawBalance);
        return;
      }
      
      //Now that that's out of the way, in cases after here, we should only reach this from the messages feed 
      assert(assetInfo['owner'] === undefined, "Logic should only be reached via messages feed data, not with get_asset_info data");
      
      if(assetInfo['description'] != match.description()) {
        //when the description changes, the balance will get 0 passed into it to note this. obviously, don't take that as the literal balance :)
        $.jqlog.debug("Updating token " + asset + " @ " + self.ADDRESS + " description to '" + assetInfo['description'] + "'");
        match.description(assetInfo['description']);
      } else if(assetInfo['transfer']) {
        //transfer come in through the messages feed only (get_asset_info results doesn't have a transfer field passed in)
        $.jqlog.debug("Token " + asset + " @ " + self.ADDRESS + " transferred to '" + assetInfo['issuer'] + "'");
        //like with a description change, the balance is passed as 0
        match.owner(assetInfo['issuer']);
        if(match.isMine() === false && match.rawBalance() == 0)
          self.assets.remove(match); //i.e. remove the asset if it was owned by this address (and no longer is), and had a zero balance
      } else if(assetInfo['locked']) { //only add locking (do not change from locked back to unlocked, as that is not valid)
        $.jqlog.debug("Token " + asset + " @ " + self.ADDRESS + " locked");
        match.locked(assetInfo['locked']);
      } else {
        //handle issuance increases
        //assert(match.description() == assetInfo['description']); //description change was handled earlier
        //assert(match.owner() == (assetInfo['issuer'])); //transfer change was handled earlier
        //assert(!assetInfo['locked']); //lock change was handled earlier
        //assert(match.rawSupply() != assetInfo['quantity']);
        $.jqlog.debug("Updating token " + asset + " @ " + self.ADDRESS + " # issued units. Orig #: "
          + match.rawSupply() + ", new #: " + assetInfo['quantity']+ ", unconfirmed bal #: " + match.unconfirmedBalance());
        match.rawSupply(assetInfo['quantity']);
      }
      

    }
  }
  
  self.removeAsset = function(asset) {
    self.assets.remove(function(item) {
        return item.ASSET == asset;
    });    
  }
  
  /////////////////////////
  //Address-panel-related
  self.changeLabel = function(params) {
    CHANGE_ADDRESS_LABEL_MODAL.show(self.ADDRESS, self.label());
  }
  
  self.showQRCode = function() {
    //Show the QR code for this address
    var qrcode = makeQRCode(self.ADDRESS);
    //Pop up a modal with this code
    bootbox.alert('<center><h4>QR Code for <b>' + self.ADDRESS + '</b></h4><br/>' + qrcode + '</center>');
  }

  self.showPrivateKey = function() {
    //Show the private key code for this address
    DISPLAY_PRIVATE_KEY_MODAL.show(self.ADDRESS);
  }
  
  self.remove = function() { //possible for watch only addresses only
    assert(self.TYPE != 'normal', 'Only watch-only or armory addresses can be removed.');
    WALLET.addresses.remove(self);
    
    //update the preferences with this address removed
    if(self.TYPE === 'watch') {
      PREFERENCES['watch_only_addresses']= _.without(PREFERENCES['watch_only_addresses'], self.ADDRESS);  
    } else {
      assert(self.TYPE === 'armory');
      PREFERENCES['armory_offline_addresses'] = _.filter(PREFERENCES['armory_offline_addresses'], 
        function (el) { return el.address !== self.ADDRESS; });
    }
    
    WALLET.storePreferences(function() {
      checkURL(); //refresh the page without this address listed on it
    });
  }
  
  self.signMessage = function() {
    SIGN_MESSAGE_MODAL.show(self.ADDRESS);
  }

  self.signTransaction = function() {
    SIGN_TRANSACTION_MODAL.show(self.ADDRESS);
  }
  
  self.armoryBroadcastTransaction = function() {
    assert(self.IS_ARMORY_OFFLINE);
    ARMORY_BROADCAST_TRANSACTION.show(self.ADDRESS);
  }

  self.createAsset = function() {
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;

    var xcpBalance = WALLET.getBalance(self.ADDRESS, XCP);
    if(xcpBalance < ASSET_CREATION_FEE_XCP) {
      bootbox.alert("You need at least <b class='notoAmountColor'>" + ASSET_CREATION_FEE_XCP + "</b> <b class='notoAssetColor'>" + XCP + "</b>"
        + " to create a token, however, your current balance is only"
        + " <b class='notoAmountColor'>" + xcpBalance + "</b> <b class='notoAssetColor'>" + XCP + "</b>."
        + "<br/><br/>Please deposit more <b class='notoAssetColor'>" + XCP + "</b> into this address and try again.");
      return false;
    }

    CREATE_ASSET_MODAL.show(self.ADDRESS);
  }

  self.payDividend = function () {
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    PAY_DIVIDEND_MODAL.show(self);
  };

  self.broadcast = function () {
    if(!WALLET.canDoTransaction(self.ADDRESS)) return false;
    BROADCAST_MODAL.show(self, true);
  };
  
  self.selectAddressText = function() {
    return selectText('address-text-' + self.ADDRESS);    
  }

  self.sortAssetsByName = function() {
    //Sort assets by asset name
    var reverseSort = self.lastSort() == 'sortAssetsByName' && self.lastSortDirection() == 'asc';
    
    if(reverseSort) {
      self.assets.sort(function(left, right) {
          return right.ASSET.localeCompare(left.ASSET);
      });
    } else {
      self.assets.sort(function(left, right) {
          return left.ASSET.localeCompare(right.ASSET);
      });
    }

    self.lastSortDirection((self.lastSort() == 'sortAssetsByName' && self.lastSortDirection() == 'asc') ? 'desc' : 'asc');
    self.lastSort('sortAssetsByName');
  }

  self.sortAssetsByBalance = function() {
    //Sort assets by balance
    var reverseSort = self.lastSort() == 'sortAssetsByBalance' && self.lastSortDirection() == 'asc';

    if(reverseSort) {
      self.assets.sort(function(left, right) {
        return left.normalizedBalance() == right.normalizedBalance() ? 0 : (right.normalizedBalance() < left.normalizedBalance() ? -1 : 1)
      });
    } else {
      self.assets.sort(function(left, right) {
        return left.normalizedBalance() == right.normalizedBalance() ? 0 : (left.normalizedBalance() < right.normalizedBalance() ? -1 : 1)
      });
    }    

    self.lastSortDirection((self.lastSort() == 'sortAssetsByBalance' && self.lastSortDirection() == 'asc') ? 'desc' : 'asc');
    self.lastSort('sortAssetsByBalance');
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

  self.getXCPBalance = function() {
    var xcpAsset =  $.grep(self.assets(), function (value) {
        return value.ASSET == XCP;
    });
    return xcpAsset[0].normalizedBalance();
  }

}
