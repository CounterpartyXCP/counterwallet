function WalletViewModel() {
  //The user's wallet
  var self = this;
  self.BITCOIN_WALLET = null; // CWHierarchicalKey instance
  self.autoRefreshBTCBalances = true; //auto refresh BTC balances every 5 minutes

  self.identifier = ko.observable(null); //set when logging in
  self.networkBlockHeight = ko.observable(null); //stores the current network block height. refreshed when we refresh the BTC balances
  self.addresses = ko.observableArray(); //AddressViewModel objects -- populated at login

  self.isNew = ko.observable(false); //set to true if we can't find the user's prefs when logging on. if set, we'll show some intro text on their login, etc.
  self.isExplicitlyNew = ko.observable(false); //set to true if the user explicitly clicks on Create New Wallet and makes it (e.g. this may be false and isNew true if the user typed in the wrong passphrase, or manually put the words together)
  self.isSellingBTC = ko.observable(false); //updated by the btcpay feed
  self.isOldWallet = ko.observable(false);
  self.isSegwitEnabled = USE_TESTNET || USE_REGTEST;

  self.cancelOrders = [];
  var storedCancelOrders = localStorage.getObject("cancelOrders")
  if (storedCancelOrders) {
    self.cancelOrders = storedCancelOrders;
  }

  function updateSegwitGenerationVisibility() {
    if (self.isSegwitEnabled) {
      $("#createSegwitAddress").show()
    } else {
      $("#createSegwitAddress").hide()
    }
  }

  self.networkBlockHeight.subscribe(function(newBlockIndex) {
    self.isSegwitEnabled = newBlockIndex >= 557236 // should be synced up to "segwit_support" entry from counterparty-lib/counterpartylib/protocol_changes.json

    updateSegwitGenerationVisibility()

    try {
      if (CURRENT_PAGE_URL == 'pages/exchange.html') {
        EXCHANGE.refresh();
      }
    } catch (e) {}
  });

  self.addAddress = function(type, address, pubKeys) {
    assert(['normal', 'watch', 'armory', 'multisig', 'segwit'].indexOf(type) != -1);
    assert(((type == 'normal' || type == 'segwit') && !address) || (address));
    assert((type == 'multisig' && pubKeys) || (type == 'armory' && pubKeys) || !pubKeys); //only used with armory addresses

    if (type == 'normal') {
      //adds a key to the wallet, making a new address object on the wallet in the process
      //(assets must still be attached to this address, with updateBalances() or other means...)
      //also, a label should already exist for the address in PREFERENCES.address_aliases by the time this is called

      //derive an address from the key (for the appropriate network)
      var i = self.addresses().length;

      // m : masterkery / 0' : first private derivation / 0 : external account / i : index
      var key = self.BITCOIN_WALLET.getAddressKey(i);
      var address = key.getAddress();

      //Make sure this address doesn't already exist in the wallet (sanity check)
      assert(!self.getAddressObj(address), "Cannot addAddress: address already exists in wallet!");
      //see if there's a label already for this address that's stored in PREFERENCES, and use that if so
      var addressHash = hashToB64(address);
      //^ we store in prefs by a hash of the address so that the server data (if compromised) cannot reveal address associations
      var label = PREFERENCES.address_aliases[addressHash] || i18n.t("default_address_label", (i + 1));
      //^ an alias is made when a watch address is made, so this should always be found

      self.addresses.push(new AddressViewModel(type, key, address, label)); //add new
      $.jqlog.debug("Wallet address added: " + address + " -- hash: "
        + addressHash + " -- label: " + label + " -- index: " + i);
    } else if (type == 'segwit') {
      //adds a key to the wallet, making a new address object on the wallet in the process
      //(assets must still be attached to this address, with updateBalances() or other means...)
      //also, a label should already exist for the address in PREFERENCES.address_aliases by the time this is called

      //derive an address from the key (for the appropriate network)
      if (self.isSegwitEnabled) {
        var i = self.addresses().length;

        // m : masterkery / 0' : first private derivation / 0 : external account / i : index
        var key = self.BITCOIN_WALLET.getAddressKey(i);
        var networkName = key.priv.network.alias
        if (USE_TESTNET && ! USE_REGTEST) {
          networkName = key.priv.network.name
        }
        var address = bitcoinjs.payments.p2wpkh({ pubkey: key.priv.publicKey.toBuffer(), network: bitcoinjs.networks[networkName] }).address;

        //Make sure this address doesn't already exist in the wallet (sanity check)
        assert(!self.getAddressObj(address), "Cannot addAddress: address already exists in wallet!");
        //see if there's a label already for this address that's stored in PREFERENCES, and use that if so
        var addressHash = hashToB64(address);
        //^ we store in prefs by a hash of the address so that the server data (if compromised) cannot reveal address associations
        var label = PREFERENCES.address_aliases[addressHash] || i18n.t("default_address_label", (i + 1));
        //^ an alias is made when a watch address is made, so this should always be found

        self.addresses.push(new AddressViewModel(type, key, address, label)); //add new
        $.jqlog.debug("Wallet address added: " + address + " -- hash: "
          + addressHash + " -- label: " + label + " -- index: " + i);
      } else {
        $.jqlog.debug("Segwit not enabled on mainnet yet");
      }
    } else {
      //adds a watch only address to the wallet
      //a label should already exist for the address in PREFERENCES.address_aliases by the time this is called
      assert(!self.getAddressObj(address), "Cannot addAddress: watch/armory address already exists in wallet!");
      var addressHash = hashToB64(address);
      var label = PREFERENCES.address_aliases[addressHash] || i18n.t("unknown_label");

      self.addresses.push(new AddressViewModel(type, null, address, label, pubKeys)); //add new
      $.jqlog.debug("Watch-only, multisig or armory wallet address added: " + address + " -- hash: "
        + addressHash + " -- label: " + label + " -- PubKey(s): " + pubKeys);
    }

    return address;
  }

  self.getAddressesList = function(withLabel) {
    if (typeof(withLabel) === 'undefined') withLabel = false;
    var addresses = [];

    ko.utils.arrayForEach(self.addresses(), function(address) {
      if (withLabel) {
        addresses.push([address.ADDRESS, address.label(), address.getXCPBalance(), address.PUBKEY]);
      } else {
        addresses.push(address.ADDRESS);
      }
    });
    return addresses;
  }

  self.numAddressesUsed = function() {
    var count = 0;

    ko.utils.arrayForEach(self.addresses(), function(address) {
      if (address.TYPE == 'normal') {
        count++;
      }
    });
    return count;
  }

  self.getBiggestXCPBalanceAddress = function() {
    var maxAmount = 0;
    var maxAddress = null;

    ko.utils.arrayForEach(self.addresses(), function(address) {
      var xcpBalance = address.getXCPBalance();
      if (xcpBalance > maxAmount) {
        maxAmount = xcpBalance;
        maxAddress = address;
      }
    });

    return maxAddress;

  }

  self.getAddressObj = function(address) {
    //given an address string, return a reference to the corresponding AddressViewModel object
    return ko.utils.arrayFirst(self.addresses(), function(a) {
      return a.ADDRESS == address;
    });
  }

  self.getBalance = function(address, asset, normalized) {
    if (typeof(normalized) === 'undefined') normalized = true;
    var addressObj = self.getAddressObj(address);
    assert(addressObj);
    var assetObj = addressObj.getAssetObj(asset);
    if (!assetObj) return 0; //asset not in wallet
    if (asset !== KEY_ASSET.BTC) {
      return normalized ? assetObj.availableBalance() : assetObj.rawAvailableBalance();
    } else {
      var bal = assetObj.normalizedBalance() + assetObj.unconfirmedBalance();
      return normalized ? bal : denormalizeQuantity(bal);
    }

  }

  self.getPubkey = function(address) {
    var addressObj = self.getAddressObj(address);
    assert(addressObj);
    return addressObj.PUBKEY;
  }

  self.updateBalance = function(address, asset, rawBalance, unconfirmedRawBal) {
    //Update a balance for a specific asset on a specific address. Requires that the asset exist
    var addressObj = self.getAddressObj(address);
    assert(addressObj);
    var assetObj = addressObj.getAssetObj(asset);
    if (!assetObj) {
      assert(asset !== KEY_ASSET.XCP && asset !== KEY_ASSET.BTC, [KEY_ASSET.BTC, 'or', KEY_ASSET.XCP, 'not present in the address?'].join(' ')); //these should be already in each address
      //we're trying to update the balance of an asset that doesn't yet exist at this address
      //fetch the asset info from the server, and then use that in a call to addressObj.addOrUpdateAsset
      failoverAPI("get_assets_info", {'assetsList': [asset]}, function(assetsInfo, endpoint) {
        addressObj.addOrUpdateAsset(asset, assetsInfo[0], rawBalance);
      });
    } else {
      assetObj.rawBalance(rawBalance);
      if (asset === KEY_ASSET.BTC && unconfirmedRawBal) {
        assetObj.unconfirmedBalance(normalizeQuantity(unconfirmedRawBal));
        assetObj.balanceChangePending(true);
        addressObj.addOrUpdateAsset(asset, {}, rawBalance);
      } else if (asset === KEY_ASSET.BTC) {
        assetObj.unconfirmedBalance(0);
        assetObj.balanceChangePending(false);
        addressObj.addOrUpdateAsset(asset, {}, rawBalance);
      }

    }
    return true;
  }

  self.getAddressesWithAsset = function(asset) {
    var addresses = self.getAddressesList();
    var addressesWithAsset = [];
    //Grab the first asset object we can find for this asset
    var addressObj = null, assetObj = null;
    for (var i = 0; i < addresses.length; i++) {
      addressObj = self.getAddressObj(addresses[i]);
      assetObj = addressObj.getAssetObj(asset);
      if (!assetObj) continue; //this address doesn't have the asset...that's fine
      addressesWithAsset.push(assetObj.ADDRESS);
    }
    return addressesWithAsset;
  }

  self.getTotalBalance = function(asset, normalized) { //gets the balance of an asset across all addresses
    if (typeof(normalized) === 'undefined') normalized = true;
    var rawBalance = 0;
    var divisible = null;
    var addressObj = null, assetObj = null, i = null, j = null;
    for (i = 0; i < self.addresses().length; i++) {
      addressObj = self.addresses()[i];
      for (j = 0; j < addressObj.assets().length; j++) {
        assetObj = addressObj.assets()[j];
        if (assetObj.ASSET != asset) continue;
        rawBalance += assetObj.rawBalance();
        if (divisible === null) divisible = assetObj.DIVISIBLE;
      }
    }
    return normalized ? normalizeQuantity(rawBalance, divisible) : rawBalance;
  }

  self.getAssetsInWallet = function() { //gets assets that the user has a balance of
    //this is not optimized... O(n^2)
    var assets = [];
    var addressObj = null, assetObj = null, i = null, j = null;
    for (i = 0; i < self.addresses().length; i++) {
      addressObj = self.addresses()[i];
      for (j = 0; j < addressObj.assets().length; j++) {
        assetObj = addressObj.assets()[j];
        assets.push(assetObj.ASSET);
      }
    }
    return _.uniq(assets);
  }

  self.isAssetHolder = function(asset) {
    var addressObj = null, assetObj = null, i = null, j = null;
    for (i = 0; i < self.addresses().length; i++) {
      addressObj = self.addresses()[i];
      for (j = 0; j < addressObj.assets().length; j++) {
        assetObj = addressObj.assets()[j];
        if (assetObj.ASSET == asset) {
          return true;
        }
      }
    }
    return false
  }

  self.isAssetDivisibilityAvailable = function(asset) {
    var divisible = -1;
    var addressObj = null, assetObj = null, i = null, j = null;
    for (i = 0; i < self.addresses().length; i++) {
      addressObj = self.addresses()[i];
      for (j = 0; j < addressObj.assets().length; j++) {
        assetObj = addressObj.assets()[j];
        if (assetObj.ASSET == asset) {
          divisible = assetObj.DIVISIBLE ? 1 : 0;

        }
      }
    }
    return divisible;
  }

  self.getAssetsDivisibility = function(assets, callback) {
    var assetsDivisibility = {};
    var notAvailable = [];

    // check if the wallet have the information
    for (var a in assets) {
      var asset = assets[a];
      if (asset === KEY_ASSET.XCP || asset === KEY_ASSET.BTC) {
        assetsDivisibility[asset] = true;
      } else {
        var divisible = self.isAssetDivisibilityAvailable(asset);
        if (divisible == -1) {
          notAvailable.push(asset)
        } else if (divisible == 1) {
          assetsDivisibility[asset] = true;
        } else {
          assetsDivisibility[asset] = false;
        }
      }
    }

    if (notAvailable.length > 0) {
      // else make a query to counterpartyd
      failoverAPI("get_assets_info", {'assetsList': notAvailable}, function(assetsInfo, endpoint) {
        for (var a in assetsInfo) {
          assetsDivisibility[assetsInfo[a]['asset']] = assetsInfo[a]['divisible'];
        }
        callback(assetsDivisibility);
      });
    } else {
      callback(assetsDivisibility)
    }
  }

  self.getAssetsOwned = function() { //gets assets the user actually owns (is issuer of)
    //this is not optimized... O(n^2)
    var assets = [];
    var addressObj = null, assetObj = null, i = null, j = null;
    for (i = 0; i < self.addresses().length; i++) {
      addressObj = self.addresses()[i];
      for (j = 0; j < addressObj.assets().length; j++) {
        assetObj = addressObj.assets()[j];
        if (assetObj.isMine())
          assets.push(assetObj.ASSET);
      }
    }
    return _.uniq(assets);
  }

  self.refreshCounterpartyBalances = function(addresses, onSuccess) {
    //update all counterparty asset balances for the specified address (including XCP)
    //Note: after login, this normally never needs to be called (except when adding a watch address),
    // as counterparty asset balances are updated automatically via the messages feed
    $.jqlog.debug('Updating normalized balances for a multiple addresses at wallet ' + addresses)
    failoverAPI("get_normalized_balances", {'addresses': addresses},
      function(balancesData, endpoint) {
        $.jqlog.debug("Got initial balances: " + JSON.stringify(balancesData));

        var addressAsset = {};

        if (!balancesData.length) {
          for (var i in addresses) {
            WALLET.getAddressObj(addresses[i]).addOrUpdateAsset(KEY_ASSET.XCP, {}, 0, 0);
          }
          if (onSuccess) return onSuccess(); //user has no balance (i.e. first time logging in)
          else return;
        }


        var i = null, j = null;
        var numBalProcessed = 0;
        var assets = [];
        //Make a unique list of assets
        for (i = 0; i < balancesData.length; i++) {
          addressAsset[balancesData[i]['address'] + '_' + balancesData[i]['asset']] = true;
          if (assets.indexOf(balancesData[i]['asset']) == -1) {
            assets.push(balancesData[i]['asset']);
          }
        }
        // TODO: optimize: assets infos already fetched in get_normalized_balances() in counterblockd
        failoverAPI("get_escrowed_balances", {'addresses': addresses}, function(escrowedBalances) {

          // add asset with all fund escrowed
          for (var addr in escrowedBalances) {
            for (var ass in escrowedBalances[addr]) {
              if (!((addr + '_' + ass) in addressAsset)) {
                balancesData.push({'address': addr, 'asset': ass, 'quantity': 0});
                addressAsset[addr + '_' + ass] = true;
              }
              if (assets.indexOf(ass) == -1) {
                assets.push(ass);
              }
            }
          }

          failoverAPI("get_assets_info", {'assetsList': assets}, function(assetsInfo, endpoint) {

            for (i = 0; i < assetsInfo.length; i++) {
              for (j = 0; j < balancesData.length; j++) {
                if (balancesData[j]['asset'] != assetsInfo[i]['asset']) continue;
                var address = balancesData[j]['address'];
                var asset = assetsInfo[i]['asset'];
                var escrowedBalance = 0;
                if (address in escrowedBalances && asset in escrowedBalances[address]) {
                  escrowedBalance = escrowedBalances[address][asset];
                }
                WALLET.getAddressObj(address).addOrUpdateAsset(asset, assetsInfo[i], balancesData[j]['quantity'], escrowedBalance);
              }
            }
            if (onSuccess) return onSuccess();
          });

        });

      }

    );


  }

  self.refreshBTCBalances = function(isRecurring, addresses, onSuccess) {
    if (typeof(isRecurring) === 'undefined') isRecurring = false;
    //^ if isRecurring is set to true, we will update BTC balances every 5 min as long as self.autoRefreshBTCBalances == true

    //update all BTC balances (independently, so that one addr with a bunch of txns doesn't hold us up)
    if (addresses == undefined || addresses == null) {
      addresses = self.getAddressesList();
    }

    $.jqlog.debug(addresses);

    var completedAddresses = []; //addresses whose balance has been retrieved
    var addressObj = null;

    //See if we have any pending BTC send transactions listed in Pending Actions, and if so, enable some extra functionality
    // to clear them out if we sense the txn as processed
    var pendingActionsHasBTCSend = ko.utils.arrayFirst(PENDING_ACTION_FEED.entries(), function(item) {
      return item.CATEGORY === 'sends' && item.DATA['asset'] === KEY_ASSET.BTC; //there is a pending BTC send
    });

    self.retrieveBTCAddrsInfo(addresses, function(data) {
      //refresh the network block height (this is a bit hackish as blockHeight is embedded into each address object,
      // and they are all the same values, but we just look at the first value...we do it this way to avoid an extra API call every 5 minutes)
      if (data.length >= 1) self.networkBlockHeight(data[0]['blockHeight']);

      for (var i = 0; i < data.length; i++) {
        //if someone sends BTC using the wallet, an entire TXout is spent, and the change is routed back. During this time
        // the (confirmed) balance will be decreased by the ENTIRE quantity of that txout, even though they may be getting
        // some/most of it back as change. To avoid people being confused over this, with BTC in particular, we should
        // display the unconfirmed portion of the balance in addition to the confirmed balance, as it will include the change output
        self.updateBalance(data[i]['addr'], KEY_ASSET.BTC, data[i]['confirmedRawBal'], data[i]['unconfirmedRawBal']);

        addressObj = self.getAddressObj(data[i]['addr']);
        assert(addressObj, 'Cannot find address in wallet for refreshing ' + KEY_ASSET.BTC + ' balances!');

        if (data[i]['confirmedRawBal'] > 0 || data[i]['unconfirmedRawBal'] > 0 ||
          data[i]['numPrimedTxoutsIncl0Confirms'] > 0 || data[i]['numPrimedTxouts'] > 0 ||
          data[i]['lastTxns'] > 0) {
          addressObj.withMovement(true);
        }

        if (data[i]['confirmedRawBal'] && !addressObj.IS_WATCH_ONLY) {
          //Also refresh BTC unspent txouts (to know when to "reprime" the account)
          addressObj.numPrimedTxouts(data[i]['numPrimedTxouts']);
          addressObj.numPrimedTxoutsIncl0Confirms(data[i]['numPrimedTxoutsIncl0Confirms']);

          $.jqlog.debug("refreshBTCBalances: Address " + data[i]['addr'] + " -- confirmed bal = " + data[i]['confirmedRawBal']
            + "; unconfirmed bal = " + data[i]['unconfirmedRawBal'] + "; numPrimedTxouts = " + data[i]['numPrimedTxouts']
            + "; numPrimedTxoutsIncl0Confirms = " + data[i]['numPrimedTxoutsIncl0Confirms']);

          if (pendingActionsHasBTCSend) {
            //see if data[i]['lastTxns'] includes any hashes that exist in the Pending Actions, which
            // means we MAY be able to remove them from that listing (i.e. they COULD be non-BTC send (i.e. counterparty transactions) though
            //TODO: This is not very efficient when a BTC send is pending... O(n^3)! Although the sample sets are relatively small...
            for (var j = 0; j < data[i]['lastTxns'].length; j++) {
              PENDING_ACTION_FEED.remove(data[i]['lastTxns'][j], "sends", true);
            }
          }

        } else { //non-watch only with a zero balance == no primed txouts (no need to even try and get a 500 error)
          addressObj.numPrimedTxouts(0);
          addressObj.numPrimedTxoutsIncl0Confirms(0);
        }
      }

      if (isRecurring && self.autoRefreshBTCBalances) {
        setTimeout(function() {
          if (self.autoRefreshBTCBalances) { self.refreshBTCBalances(true); }
        }, 60000 * 5);
      }

      if (onSuccess) onSuccess();

    }, function(jqXHR, textStatus, errorThrown) {
      //system down or spazzing, set all BTC balances out to null
      var addressObj = null;
      for (var i = 0; i < addresses.length; i++) {
        self.updateBalance(addresses[i], KEY_ASSET.BTC, null, null); //null = UNKNOWN
        addressObj = self.getAddressObj(addresses[i]);
        addressObj.numPrimedTxouts(null); //null = UNKNOWN
        addressObj.numPrimedTxoutsIncl0Confirms(null); //null = UNKNOWN
      }
      //But don't pop up a message box so we don't freak out users -- just alert on console
      $.jqlog.warn(i18n.t("btc_sync_error", textStatus));
      //bootbox.alert(i18n.t("btc_sync_error", textStatus));

      if (isRecurring && self.autoRefreshBTCBalances) {
        setTimeout(function() {
          if (self.autoRefreshBTCBalances) { self.refreshBTCBalances(true); }
        }, 60000 * 5);
      }
    });
  }

  self.removeKeys = function() {
    //removes all keys (addresses) from the wallet. Normally called when logging out
    //stop BTC balance timer on each address
    ko.utils.arrayForEach(self.addresses(), function(a) {
      a.doBTCBalanceRefresh = false;
    });
    self.addresses([]); //clear addresses
  }


  /////////////////////////
  //BTC-related
  self.broadcastSignedTx = function(signedTxHex, onSuccess, onError) {
    if (signedTxHex == false) {
      bootbox.alert(i18n.t("tx_validation_failed"));
      return false;
    }
    $.jqlog.debug("RAW SIGNED HEX: " + signedTxHex);

    failoverAPI("broadcast_tx", {"signed_tx_hex": signedTxHex},
      function(txHash, endpoint) {
        $.jqlog.log("broadcast:" + txHash + ": endpoint=" + endpoint);
        return onSuccess(txHash, endpoint);
      },
      onError
    );
  }

  function isBech32(addr) {
    try {
      bitcoinjs.address.fromBech32(addr)

      return true
    } catch (e) {
      return false
    }
  }

  self.signAndBroadcastTxRaw = function(key, unsignedTxHex, onSuccess, onError, verifySourceAddr, verifyDestAddr) {
    assert(verifySourceAddr, "Source address must be specified");
    assert(verifyDestAddr, "Destination address must be specified");
    //Sign and broadcast a multisig transaction that we got back from counterpartyd (as a raw unsigned tx in hex)
    // verifySourceAddr and verifyDestAddr MUST be specified to verify that the txn hash we get back from the server is what we expected.

    $.jqlog.debug("RAW UNSIGNED HEX: " + unsignedTxHex);

    var sourceIsBech32 = isBech32(verifySourceAddr);
    var hasDestBech32 = verifyDestAddr.reduce((p, x) => p || isBech32(x), false);
    var hasAnyBech32 = hasDestBech32 || sourceIsBech32;

    if (hasAnyBech32) {
      // Use bitcoinjs implementation
      var tx = bitcoinjs.Transaction.fromHex(unsignedTxHex);
      var network = bitcoinjs.networks[self.BITCOIN_WALLET.HierarchicalKey.network.alias];

      var txb = new bitcoinjs.TransactionBuilder(network);
      var keypair = bitcoinjs.ECPair.fromWIF(key.priv.toWIF(), network); // Way easier to convert to WIF and then back to ECPair

      self.retrieveBTCAddrsInfo([verifySourceAddr], function(data) {
        var utxoMap = {}
        data[0].rawUtxoData.forEach(utxo => {
          utxoMap[utxo.txid] = utxo
        })

        if (sourceIsBech32) {
          var p2wpkh = bitcoinjs.payments.p2wpkh({ pubkey: keypair.publicKey, network: network })

          for (var i=0; i < tx.ins.length; i++) {
             // We get reversed tx hashes somehow after parsing
            var txhash = tx.ins[i].hash.reverse().toString('hex')
            var prev = utxoMap[txhash]

            txb.addInput(tx.ins[i].hash.toString('hex'), prev.vout, null, p2wpkh.output)
          }
        } else {
          var p2pk = bitcoinjs.payments.p2pkh({ pubkey: keypair.publicKey, network: network })

          for (var i=0; i < tx.ins.length; i++) {
             // We get reversed tx hashes somehow after parsing
            var txhash = tx.ins[i].hash.reverse().toString('hex')
            var prev = utxoMap[txhash]

            txb.addInput(tx.ins[i].hash.toString('hex'), prev.vout, null, p2pk.output)
          }
        }

        for (var i=0; i < tx.outs.length; i++) {
          var txout = tx.outs[i]

          txb.addOutput(txout.script, txout.value)
        }

        for (var i=0; i < tx.ins.length; i++) {
          var txhash = tx.ins[i].hash.toString('hex')
          if (txhash in utxoMap) {
            var prev = utxoMap[txhash]
            var redeemScript = undefined
            /*if (hasDestBech32) {
              redeemScript =  // Future support for P2WSH
            }*/
            // Math.floor is less than ideal in this scenario, we need to get the raw satoshi value in the utxo map
            txb.sign(i, keypair, null, null, Math.floor(parseFloat(prev.amount) * 100000000), redeemScript);
          } else {
            // This should throw an error?
            bootbox.alert("Failed to sign transaction: " + "Incomplete SegWit inputs");
            return
          }
        }

        var signedHex = txb.build().toHex();

        $.jqlog.debug("RAW SIGNED HEX: " + signedHex);

        self.broadcastSignedTx(signedHex, onSuccess, onError);
      }, function(jqXHR, textStatus, errorThrown) {
        if (err) {
          bootbox.alert("Failed to sign transaction: " + textStatus);
          return
        }
      });

    } else {
      // Use legacy bitcore implementation
      //Sign the input(s)
      key.checkAndSignRawTransaction(unsignedTxHex, verifyDestAddr, function(err, signedHex) {
        if (err) {
          bootbox.alert("Failed to sign transaction: " + err);
          return
        }

        self.broadcastSignedTx(signedHex, onSuccess, onError);
      });
    }
  }

  self.signAndBroadcastTx = function(address, unsignedTxHex, onSuccess, onError, verifyDestAddr) {
    var key = WALLET.getAddressObj(address).KEY;
    self.signAndBroadcastTxRaw(key, unsignedTxHex, onSuccess, onError, address, verifyDestAddr);
  }

  self.retrieveBTCBalance = function(address, onSuccess, onError) {
    //We used to have a retrieveBTCBalances function for getting balance of multiple addresses, but scrapped it
    // since it worked in serial, and one address with a lot of txns could hold up the balance retrieval of every
    // other address behind it
    failoverAPI("get_chain_address_info", {"addresses": [address], "with_uxtos": false, "with_last_txn_hashes": 0},
      function(data, endpoint) {
        return onSuccess(
          parseInt(data[0]['info']['balanceSat'] || 0), //confirmed BTC balance
          parseInt(data[0]['info']['unconfirmedBalanceSat'] || 0) //unconfirmed BTC balance
        );
      },
      onError || defaultErrorHandler);
  }

  self.retrieveBTCAddrsInfo = function(addresses, onSuccess, onError, minConfirmations) {
    if (typeof(minConfirmations) === 'undefined') minConfirmations = 1;
    if (typeof(onError) === 'undefined')
      onError = function(jqXHR, textStatus, errorThrown) { return defaultErrorHandler(jqXHR, textStatus, errorThrown); };
    assert(onSuccess, "onSuccess callback must be defined");

    failoverAPI("get_chain_address_info", {"addresses": addresses, "with_uxtos": true, "with_last_txn_hashes": 5},
      function(data, endpoint) {
        var numSuitableUnspentTxouts = null;
        var numPrimedTxoutsIncl0Confirms = null;
        var totalBalance = null;
        var i = null, j = null;
        var results = [];
        for (i = 0; i < data.length; i++) {
          numSuitableUnspentTxouts = 0;
          numPrimedTxoutsIncl0Confirms = 0;
          totalBalance = 0;
          for (j = 0; j < data[i]['uxtos'].length; j++) {
            if (denormalizeQuantity(data[i]['uxtos'][j]['amount']) >= MIN_BALANCE_FOR_ACTION) {
              numPrimedTxoutsIncl0Confirms++;
              if (data[i]['uxtos'][j]['confirmations'] >= minConfirmations)
                numSuitableUnspentTxouts++;
            }
            totalBalance += denormalizeQuantity(data[i]['uxtos'][j]['amount']);
          }
          results.push({
            'addr': data[i]['addr'],
            'blockHeight': data[i]['block_height'],
            'confirmedRawBal': parseInt(data[i]['info']['balanceSat'] || 0),
            'unconfirmedRawBal': parseInt(data[i]['info']['unconfirmedBalanceSat'] || 0),
            'numPrimedTxouts': Math.min(numSuitableUnspentTxouts, Math.floor(totalBalance / MIN_BALANCE_FOR_ACTION)),
            'numPrimedTxoutsIncl0Confirms': Math.min(numPrimedTxoutsIncl0Confirms, Math.floor(totalBalance / MIN_BALANCE_FOR_ACTION)),
            'lastTxns': data[i]['last_txns'],
            'rawUtxoData': data[i]['uxtos']
          });
        }
        //final number of primed txouts is lesser of either the # of txouts that are >= .0005 BTC, OR the floor(total balance / .0005 BTC)
        return onSuccess(results);
      },
      function(jqXHR, textStatus, errorThrown) {
        return onError(jqXHR, textStatus, errorThrown); //some other error
      }
    );
  }

  /////////////////////////
  //Counterparty transaction-related
  self.canDoTransaction = function(address) {
    /* ensures that the specified address can perform a counterparty transaction */
    var addressObj = self.getAddressObj(address);
    assert(!addressObj.IS_WATCH_ONLY, "Cannot perform this action on a watch only address!");

    if (self.getBalance(address, KEY_ASSET.BTC, false) < MIN_BALANCE_FOR_ACTION) {
      bootbox.alert(i18n.t("insufficient_btc", normalizeQuantity(MIN_BALANCE_FOR_ACTION), getAddressLabel(address)));
      return false;
    }

    return true;
  }

  self.createUnsignedTransactionWithExtendedTXInfo = function(address, action, action_data, cb, cb_offset) {
    action_data['extended_tx_info']   = true;
    action_data['disable_utxo_locks'] = true;
    self.doTransaction(address, action, action_data, null, null,
      function(extendedTxInfo, data) {
        $.jqlog.debug('createSignedTransactionWithFee extendedTxInfo: '+JSON.stringify(extendedTxInfo,null,2)+"\n"+'data: '+JSON.stringify(data,null,2));
        cb(extendedTxInfo, cb_offset);
      }
    );

  }

  self.doTransactionWithTxHex = function(address, action, data, constructedTxHex, onSuccess, onError) {
    if (data == null || data == false) {
      // when data is empty, do not continue
      return;
    }
    return self.doTransaction(address, action, data, onSuccess, onError, null, constructedTxHex);
  }

  self.doTransaction = function(address, action, data, onSuccess, onError, onTransactionCreated, constructedTxHex) {
    if (typeof(onError) === 'undefined' || onError == "default") {
      onError = function(jqXHR, textStatus, errorThrown) {
        return defaultErrorHandler(jqXHR, textStatus, errorThrown); //from util.api.js
      };
    }

    assert(['sign_tx', 'broadcast_tx', 'convert_armory_signedtx_to_raw_hex'].indexOf(action) === -1,
      'Specified action not supported through this function. please use appropriate primitives');

    if (action == 'create_cancel') {
      if (self.cancelOrders.indexOf(data['offer_hash']) != -1) {
        $.jqlog.debug(data['offer_hash'] + ' already cancelled.')
        return;
      } else {
        $('#btcancel_' + data['offer_hash']).addClass('disabled');
      }
    }

    var addressObj = WALLET.getAddressObj(address);

    //should not ever be a watch only wallet
    assert(!addressObj.IS_WATCH_ONLY);

    //specify the pubkey for a multisig tx
    assert(data['encoding'] === undefined);
    assert(data['pubkey'] === undefined);
    data['encoding'] = 'auto';
    data['pubkey'] = addressObj.PUBKEY;
    //find and specify the verifyDestAddr

    if (data['_pubkeys']) {
      if (typeof(data['pubkey']) == "string") {
        data['pubkey'] = [data['pubkey']];
      }
      data['pubkey'] = data['pubkey'].concat(data['_pubkeys']);
      delete data['_pubkeys']
    }

    if (ALLOW_UNCONFIRMED_INPUTS && supportUnconfirmedChangeParam(action)) {
      data['allow_unconfirmed_inputs'] = true;
    }

    //hacks for passing in some data that should be sent to PENDING_ACTION_FEED.add(), but not the create_ API call
    // here we only have to worry about what we create a txn for (so not order matches, debits/credits, etc)
    var extra = {};
    if (action == 'create_order') {
      extra['_give_asset_divisible'] = data['_give_asset_divisible'];
      delete data['_give_asset_divisible'];
      extra['_get_asset_divisible'] = data['_get_asset_divisible'];
      delete data['_get_asset_divisible'];
      extra['_give_asset_longname'] = data['_give_asset_longname'];
      delete data['_give_asset_longname'];
      extra['_get_asset_longname'] = data['_get_asset_longname'];
      delete data['_get_asset_longname'];
    } else if (action == 'create_cancel') {
      extra['_type'] = data['_type'];
      delete data['_type'];
      extra['_tx_index'] = data['_tx_index'];
      delete data['_tx_index'];
    } else if (action == 'create_send') {
      extra['asset_divisible'] = data['_asset_divisible'];
      delete data['_asset_divisible'];
    }

    var verifyDestAddr = data['destination'] || data['transfer_destination'] || data['feed_address'] || data['destBtcPay'] || data['source'];
    delete data['destBtcPay'];
    if (action == "create_burn") {
      verifyDestAddr = USE_TESTNET ? TESTNET_UNSPENDABLE : REGTEST_UNSPENDABLE;
    } else if (action === 'create_dividend' && data['dividend_asset'] == KEY_ASSET.BTC) {
      verifyDestAddr = data['_btc_dividend_dests'];
      delete data['_btc_dividend_dests'];
    }
    if (typeof(verifyDestAddr) == 'string') {
      verifyDestAddr = [verifyDestAddr];
    }

    // determine whether to read the get_optimal_fee_per_kb from the server
    //   or skip it
    var provideOptimalFeeFn;
    if (data['_fee_option'] === 'custom') {
      provideOptimalFeeFn = function(cb) {
        // don't call the fee api
        cb(null)
      }
    } else {
      provideOptimalFeeFn = function(cb) {
        failoverAPI("get_optimal_fee_per_kb", {}, cb);
      }
    }

    // determine if we need to reconstruct the transaction
    var constructTransactionFn;
    if (constructedTxHex != null) {
      $.jqlog.debug('using previous constructedTxHex: '+JSON.stringify(constructedTxHex));

      // we already have a previously constructed transaction
      constructTransactionFn = function(action, data, cb) {
        cb(constructedTxHex, null, null)
      }
      data['extended_tx_info'] = false
    } else {
      $.jqlog.debug('calling multiAPIConsensus to build transaction');
      constructTransactionFn = multiAPIConsensus;
    }

    //Determine the fee to use
    provideOptimalFeeFn(
      function(fee_per_kb) {
        // default to optimal if it exists
        if (fee_per_kb != null && fee_per_kb['optimal'] != null) {
          data['fee_per_kb'] = fee_per_kb['optimal'];
        }

        // check for an explicit fee option
        if (data.hasOwnProperty('_fee_option')) {
          if (data['_fee_option'] === 'low_priority') {
            data['fee_per_kb'] = fee_per_kb['low_priority'];
          }
          else if (data['_fee_option'] === 'custom') {
            assert(data.hasOwnProperty('_custom_fee'));
            data['fee_per_kb'] = data['_custom_fee'] * 1024;
          }
          delete data['_fee_option'];
        }
        if (data.hasOwnProperty('_custom_fee')) {
          delete data['_custom_fee'];
        }

        //Do the transaction
        var wasExtendedInfo = !!data['extended_tx_info']
        // $.jqlog.debug('data: '+JSON.stringify(data,null,2)+' wasExtendedInfo:'+JSON.stringify(wasExtendedInfo));
        constructTransactionFn(action, data,
          function(apiResponse, numTotalEndpoints, numConsensusEndpoints) {
            // $.jqlog.debug('apiResponse: '+JSON.stringify(apiResponse,null,2));
            var extendedTxInfo = {}
            var unsignedTxHex = apiResponse
            if (wasExtendedInfo) {
              extendedTxInfo = apiResponse;
              unsignedTxHex = extendedTxInfo['tx_hex'];
            } else {
              unsignedTxHex = apiResponse
              extendedTxInfo = {
                tx_hex: unsignedTxHex
              }
            }

            $.jqlog.info("TXN CREATED. numTotalEndpoints="
              + numTotalEndpoints + ", numConsensusEndpoints="
              + numConsensusEndpoints + ", FEE=" + data['fee_per_kb'] + ", RAW HEX=" + unsignedTxHex);

            // callback with the transaction info and be done
            if (onTransactionCreated != null) {
              onTransactionCreated(extendedTxInfo, data)
              return;
            }

            //if the address is an armory wallet, then generate an offline transaction to get signed
            if (addressObj.IS_ARMORY_OFFLINE) {

              multiAPIConsensus("create_armory_utx", {
                  'unsigned_tx_hex': unsignedTxHex,
                  'public_key_hex': addressObj.PUBKEY
                },
                function(asciiUTx, numTotalEndpoints, numConsensusEndpoints) {
                  //DO not add to pending action feed (it will be added automatically via zeroconf when the p2p network sees the tx)
                  $.jqlog.info("ARMORY UTX GENERATED: " + asciiUTx);
                  return onSuccess ? onSuccess(null, data, null, 'armory', asciiUTx) : null;
                }
              );
              if (action == 'create_cancel') {
                $('#btcancel_' + data['offer_hash']).removeClass('disabled');
              }
              return;

            } else if (addressObj.IS_MULTISIG_ADDRESS) {

              self.showTransactionCompleteDialog("<b>" + i18n.t('mutisig_tx_read') + "</b>", null, null, unsignedTxHex);
              if (action == 'create_cancel') {
                $('#btcancel_' + data['offer_hash']).removeClass('disabled');
              }
              return;

            } else {

              WALLET.signAndBroadcastTx(address, unsignedTxHex, function(txHash, endpoint) {
                //register this as a pending transaction
                var category = action.replace('create_', '') + 's'; //hack
                if (data['source'] === undefined) data['source'] = address;
                if (action == 'create_order') {
                  data['_give_asset_divisible'] = extra['_give_asset_divisible'];
                  data['_get_asset_divisible'] = extra['_get_asset_divisible'];
                  data['_give_asset_longname'] = extra['_give_asset_longname'];
                  data['_get_asset_longname'] = extra['_get_asset_longname'];
                } else if (action == 'create_cancel') {
                  data['_type'] = extra['_type'];
                  data['_tx_index'] = extra['_tx_index'];
                } else if (action == 'create_send') {
                  data['_asset_divisible'] = extra['_asset_divisible'];
                }
                PENDING_ACTION_FEED.add(txHash, category, data);

                if (action == 'create_cancel') {
                  $('#btcancel_' + data['offer_hash']).addClass('disabled');
                  self.cancelOrders.push(data['offer_hash']);
                  localStorage.setObject("cancelOrders", self.cancelOrders);
                }

                return onSuccess ? onSuccess(txHash, data, endpoint, 'normal', null) : null;
              }, function(jqXHR, textStatus, errorThrown) {
                if (action == 'create_cancel') {
                  $('#btcancel_' + data['offer_hash']).removeClass('disabled');
                }
                onError(jqXHR, textStatus, errorThrown);
              }, verifyDestAddr);
            }
          });
      });
  }

  self.showTransactionCompleteDialog = function(text, armoryText, armoryUTx, unsignedHex) {
    if (armoryUTx) {
      bootbox.alert((armoryText || text) + "<br/><br/>" + i18n.t("to_complete_armory_tx")
        + "</br><textarea class=\"form-control armoryUTxTextarea\" rows=\"20\">" + armoryUTx + "</textarea>");
    } else if (unsignedHex) {
      bootbox.alert(text + "<br/><br/>" + i18n.t("to_complete_unsigned_tx")
        + "</br><textarea class=\"form-control armoryUTxTextarea\" rows=\"20\">" + unsignedHex + "</textarea>");
    } else {
      bootbox.alert(text);
    }
  }

  self.storePreferences = function(callback, forLogin) {
    var params = {
      'wallet_id': WALLET.identifier(),
      'preferences': PREFERENCES,
      'network': USE_TESTNET ? 'testnet' : (USE_REGTEST ? 'regtest' : 'mainnet'),
      'referer': ORIG_REFERER
    };
    if (forLogin) {
      params['for_login'] = true;
    }
    multiAPI("store_preferences", params, callback);
    var now = Math.round((new Date()).getTime() / 1000);
    localStorage.setObject(WALLET.identifier() + '_preferences', {'last_updated': now, 'preferences': PREFERENCES});
  }

}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
