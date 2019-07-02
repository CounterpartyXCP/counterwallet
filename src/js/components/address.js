function AddressViewModel(type, key, address, initialLabel, pubKeys) {
  //An address on a wallet
  //type is one of: normal, watch, armory
  assert(['normal', 'watch', 'armory', 'multisig', 'segwit'].indexOf(type) != -1);
  assert(((type == 'normal' || type == 'segwit') && key) || (type == 'watch' && !key) || (type == 'armory' && !key) || type == 'multisig');
  assert((type == 'multisig' && pubKeys) || (type == 'armory' && pubKeys) || !pubKeys); //only used with armory addresses

  var self = this;

  self.KEY = key; //  key : the HierarchicalKey bitcore object
  self.TYPE = type;
  self.ADDRESS = address;
  self.PUBKEY = (type == 'armory' || type == 'multisig') ? pubKeys : (key ? key.getPub() : ''); //hex string

  //Accessors for ease of use in templates...
  self.FEATURE_DIVIDEND = disabledFeatures.indexOf('dividend') == -1;
  self.IS_NORMAL = (type == 'normal');
  self.IS_SEGWIT = (type == 'segwit');
  self.IS_WATCH_ONLY = (type == 'watch');
  self.IS_ARMORY_OFFLINE = (type == 'armory');
  self.IS_MULTISIG_ADDRESS = (type == 'multisig');

  self.lastSort = ko.observable('');
  self.lastSortDirection = ko.observable('');

  self.label = ko.observable(initialLabel);
  self.numPrimedTxouts = ko.observable(null);
  //^ # of unspent txouts for this address fitting our criteria, or null if unknown (e.g. insight is down/not responding)
  self.numPrimedTxoutsIncl0Confirms = ko.observable(null);
  self.withMovement = ko.observable(false);

  self.assets = ko.observableArray([
    new AssetViewModel({address: address, asset: KEY_ASSET.BTC}), //will be updated with data loaded from insight
    new AssetViewModel({address: address, asset: KEY_ASSET.XCP})  //will be updated with data loaded from counterpartyd
  ]);

  self.dispensers = ko.observableArray([]);

  self.assetFilter = ko.observable('');
  self.filteredAssets = ko.computed(function() {
    if (self.assetFilter() == '') { //show all
      return self.assets();
    } else if (self.assetFilter() == 'base') {
      return ko.utils.arrayFilter(self.assets(), function(asset) {
        return asset.ASSET === KEY_ASSET.BTC || asset.ASSET === KEY_ASSET.XCP;
      });

    } else if (self.assetFilter() == 'mine') {
      return ko.utils.arrayFilter(self.assets(), function(asset) {
        return asset.isMine();
      });
    } else if (self.assetFilter() == 'others') {
      return ko.utils.arrayFilter(self.assets(), function(asset) {
        return asset.isMine() == false;
      });
    }
  }, self);

  self.hasDispensers = ko.computed(function() {
    return self.dispensers().length > 0
  });

  self.multisigType = ko.computed(function() {
    if (!self.IS_MULTISIG_ADDRESS) return null;
    var array = self.ADDRESS.split("_");
    return array.shift() + "/" + array.pop();
  });

  self.dispAddress = ko.computed(function() {
    if (!self.IS_MULTISIG_ADDRESS) return self.ADDRESS;
    var addresses = self.ADDRESS.split("_");
    addresses.shift();
    addresses.pop();
    var shortAddresses = [];
    ko.utils.arrayForEach(addresses, function(address) {
      shortAddresses.push(address.substring(0, 5) + '...' + address.substring(address.length - 5, address.length));
    });
    return shortAddresses.join(", ");
  });

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

  self.updateEscrowedBalances = function() {
    failoverAPI("get_escrowed_balances", {'addresses': [self.ADDRESS]}, function(escrowedBalances) {
      if (escrowedBalances[self.ADDRESS]) {
        for (var asset in escrowedBalances[self.ADDRESS]) {
          var assetObj = self.getAssetObj(asset);
          if (assetObj) {
            assetObj.escrowedBalance(escrowedBalances[self.ADDRESS][asset])
          }
        }
      }
    });
  }

  self.initDropDown = function(asset) {
    setTimeout(function() {

      $('#asset-' + self.ADDRESS + '-' + asset + ' .dropdown-toggle').last().dropdown();

      $('#asset-' + self.ADDRESS + '-' + asset + ' .assetBtn').unbind('click');
      $('#asset-' + self.ADDRESS + '-' + asset + ' .assetBtn').click(function(event) {
        var menu = $(this).parent().find('ul');
        if (menu.css('display') == 'block') {
          menu.hide();
        } else {
          menu.show();
        }
        menu.mouseleave(function() {
          menu.hide();
          menu.unbind('mouseleave');
        })
      });

    }, 500);
  }

  self.initDispenserDropDown = function(asset) {
    setTimeout(function() {

      $('#dispenser-' + self.ADDRESS + '-' + asset + ' .dropdown-toggle').last().dropdown();

      $('#dispenser-' + self.ADDRESS + '-' + asset + ' .assetBtn').unbind('click');
      $('#dispenser-' + self.ADDRESS + '-' + asset + ' .assetBtn').click(function(event) {
        var menu = $(this).parent().find('ul');
        if (menu.css('display') == 'block') {
          menu.hide();
        } else {
          menu.show();
        }
        menu.mouseleave(function() {
          menu.hide();
          menu.unbind('mouseleave');
        })
      });

    }, 500);
  }

  self.initTooltip = function(asset, assetInfo) {
    /* initialize tooltip for a truncated subasset name */
    if(!assetInfo['asset_longname']) {
      return;
    }

    setTimeout(function() {
      $("h3.name-subasset").tooltip();
      //$("[rel=tooltip]").tooltip();
    }, 500);
  }

  self.addOrUpdateAsset = function(asset, assetInfo, initialRawBalance, escrowedBalance) {
    //Update asset property changes (ONLY establishes initial balance when logging in! -- past that, balance changes
    // come from debit and credit messages)
    //initialRawBalance is null if this is not an initial update
    //assetInfo comes from a call to get_asset_info, or as an issuance message feed object itself
    var match = ko.utils.arrayFirst(self.assets(), function(item) {
      return item.ASSET === asset;
    });

    if (asset === KEY_ASSET.BTC || asset === KEY_ASSET.XCP) { //special case update
      assert(match, 'was created when the address viewmodel was initialized...');
      match.rawBalance(initialRawBalance);
      match.escrowedBalance(escrowedBalance);
      self.initDropDown(asset);
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
        asset_longname: assetInfo['asset_longname'],
        divisible: assetInfo['divisible'],
        owner: assetInfo['owner'] || assetInfo['issuer'],
        locked: assetInfo['locked'],
        rawBalance: initialRawBalance,
        rawSupply: assetInfo['supply'] || assetInfo['quantity'],
        description: assetInfo['description'],
        rawEscrowedBalance: escrowedBalance,
        escrowedBalance: normalizeQuantity(escrowedBalance, assetInfo['divisible'])
      };
      self.assets.push(new AssetViewModel(assetProps)); //add new
      self.initDropDown(asset);
      self.initTooltip(asset, assetInfo);
    } else {
      //update existing. NORMALLY this logic is really only reached from the messages feed, however, we can have the
      // case where if we have a sweep operation for instance (which will show up as an asset transfer and credit
      // message received on the same block, at about the same time), due to API calls that are made in the handlers for
      // these, we could have a potential race condition where WALLET.updateBalance ends up calling this function
      // instead of just updating the rawBalance itself. We should be able to gracefully handle that...
      if (initialRawBalance) {
        match.rawBalance(initialRawBalance);
        return;
      }

      if (assetInfo['description'] != match.description()) {
        //when the description changes, the balance will get 0 passed into it to note this. obviously, don't take that as the literal balance :)
        $.jqlog.debug("Updating token " + asset + " @ " + self.ADDRESS + " description to '" + assetInfo['description'] + "'");
        match.description(assetInfo['description']);
      } else if (assetInfo['transfer']) {
        //transfer come in through the messages feed only (get_asset_info results doesn't have a transfer field passed in)
        $.jqlog.debug("Token " + asset + " @ " + self.ADDRESS + " transferred to '" + assetInfo['issuer'] + "'");
        //like with a description change, the balance is passed as 0
        match.owner(assetInfo['issuer']);
        if (match.isMine() === false && match.rawBalance() == 0)
          self.assets.remove(match); //i.e. remove the asset if it was owned by this address (and no longer is), and had a zero balance
      } else if (assetInfo['locked']) { //only add locking (do not change from locked back to unlocked, as that is not valid)
        $.jqlog.debug("Token " + asset + " @ " + self.ADDRESS + " locked");
        match.locked(assetInfo['locked']);
      } else {
        //handle issuance increases
        //assert(match.description() == assetInfo['description']); //description change was handled earlier
        //assert(match.owner() == (assetInfo['issuer'])); //transfer change was handled earlier
        //assert(!assetInfo['locked']); //lock change was handled earlier
        //assert(match.rawSupply() != assetInfo['quantity']);
        $.jqlog.debug("Updating token " + asset + " @ " + self.ADDRESS + " # issued units. Orig #: "
          + match.rawSupply() + ", new #: " + assetInfo['quantity'] + ", unconfirmed bal #: " + match.unconfirmedBalance());
        match.rawSupply(assetInfo['quantity']);
      }


    }
  }

  self.addOrUpdateDispenser = function(dispenser, assetInfo) {
    var match = ko.utils.arrayFirst(self.dispensers(), function(item) {
      return item.ASSET === dispenser.asset
    });

    if (!match) {
      var dispenserProps = {
        address: self.ADDRESS,
        asset: dispenser.asset,
        asset_longname: assetInfo['asset_longname'],
        divisible: assetInfo['divisible'],
        //owner: assetInfo['owner'] || assetInfo['issuer'],
        //locked: assetInfo['locked'],
        description: assetInfo['description'],
        rawEscrowedBalance: dispenser.escrow_quantity,
        escrowedBalance: normalizeQuantity(dispenser.escrow_quantity, assetInfo['divisible']),
        rawGiveRemaining: dispenser.give_remaining,
        giveRemaining: normalizeQuantity(dispenser.give_remaining, assetInfo['divisible']),
        rawGiveQuantity: dispenser.give_quantity,
        giveQuantity: normalizeQuantity(dispenser.give_quantity, assetInfo['divisible']),
        rawSatoshirate: dispenser.satoshirate,
        satoshirate: normalizeQuantity(dispenser.satoshirate, true),
      }

      self.dispensers.push(new DispenserViewModel(dispenserProps));
      //self.initDispenserDropDown(dispenser.asset);
      // TODO: Add dropdowns and tooltips
    } else {

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
    bootbox.alert('<center><h4>' + i18n.t('qr_code_for', self.ADDRESS) + '</h4><br/>' + qrcode + '</center>');
  }

  self.showPrivateKey = function() {
    //Show the private key code for this address
    DISPLAY_PRIVATE_KEY_MODAL.show(self.ADDRESS);
  }

  self.remove = function() { //possible for watch only addresses only
    WALLET.addresses.remove(self);

    //update the preferences with this address removed
    if (self.TYPE === 'watch') {
      PREFERENCES['watch_only_addresses'] = _.without(PREFERENCES['watch_only_addresses'], self.ADDRESS);
    } else if (self.TYPE === 'armory') {
      PREFERENCES['armory_offline_addresses'] = _.filter(PREFERENCES['armory_offline_addresses'],
        function(el) { return el.address !== self.ADDRESS; });
    } else if (self.TYPE === 'multisig') {
      PREFERENCES['multisig_addresses'] = _.filter(PREFERENCES['multisig_addresses'],
        function(el) { return el.address !== self.ADDRESS; });
    } else if (self.TYPE === 'normal') {
      PREFERENCES['num_addresses_used'] -= 1;
    } else if (self.TYPE === 'segwit') {
      PREFERENCES['num_segwit_addresses_used'] -= 1;
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
    if (!WALLET.canDoTransaction(self.ADDRESS)) return false;

    var xcpBalance = WALLET.getBalance(self.ADDRESS, KEY_ASSET.XCP);
    CREATE_ASSET_MODAL.show(self.ADDRESS, xcpBalance, true);
  }

  self.payDividend = function() {
    if (!WALLET.canDoTransaction(self.ADDRESS)) return false;
    PAY_DIVIDEND_MODAL.show(self);
  };

  self.broadcast = function() {
    if (!WALLET.canDoTransaction(self.ADDRESS)) return false;
    BROADCAST_MODAL.show(self, true);
  };

  self.selectAddressText = function() {
    return selectText('address-text-' + self.ADDRESS);
  }

  self.sortAssetsByName = function() {
    //Sort assets by asset name
    var reverseSort = self.lastSort() == 'sortAssetsByName' && self.lastSortDirection() == 'asc';

    if (reverseSort) {
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

    if (reverseSort) {
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
    var xcpAsset = $.grep(self.assets(), function(value) {
      return value.ASSET === KEY_ASSET.XCP;
    });
    return xcpAsset[0].normalizedBalance();
  }

}
