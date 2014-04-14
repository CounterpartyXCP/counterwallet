
function WalletViewModel() {
  //The user's wallet
  var self = this;
  self.BITCOIN_WALLET = null; //Bitcoin.Wallet() BIP0032 wallet instance
  self.autoRefreshBTCBalances = true; //auto refresh BTC balances every 5 minutes
  
  self.identifier = ko.observable(null); //set when logging in
  self.networkBlockHeight = ko.observable(null); //stores the current network block height. refreshed when we refresh the BTC balances
  self.addresses = ko.observableArray(); //AddressViewModel objects -- populated at login
  
  self.isNew = ko.observable(false); //set to true if we can't find the user's prefs when logging on. if set, we'll show some intro text on their login, etc.
  
  self.isSellingBTC = ko.observable(false); //updated by the btcpay feed

  self.addAddress = function(key) {
    //adds a key to the wallet, making a new address object on the wallet in the process
    //(assets must still be attached to this address, with updateBalances() or other means...)
    //also, a label should already exist for the address in PREFERENCES.address_aliases by the time this is called

    //derive an address from the key (for the appropriate network)
    var address = key.getBitcoinAddress().toString();
    //Make sure this address doesn't already exist in the wallet (sanity check)
    assert(!self.getAddressObj(address), "Cannot addAddress: address already exists in wallet!");
    //see if there's a label already for this address that's stored in PREFERENCES, and use that if so
    var addressHash = hashToB64(address);
    //^ we store in prefs by a hash of the address so that the server data (if compromised) cannot reveal address associations
    var label = PREFERENCES.address_aliases[addressHash] || "UNKNOWN LABEL";
    //^ an alias is made when a watch address is made, so this should always be found

    self.addresses.push(new AddressViewModel(key, address, label)); //add new
    $.jqlog.debug("Wallet address added: " + address + " -- hash: " + addressHash + " -- label: " + label);
  }
  
  self.addWatchOnlyAddress = function(address) {
    //adds a watch only address to the wallet
    //a label should already exist for the address in PREFERENCES.address_aliases by the time this is called
    assert(!self.getAddressObj(address), "Cannot addWatchOnlyAddress: address already exists in wallet!");
    var addressHash = hashToB64(address);
    var label = PREFERENCES.address_aliases[addressHash] || "UNKNOWN LABEL";

    self.addresses.push(new AddressViewModel(null, address, label)); //add new
    $.jqlog.debug("Watch-only wallet address added: " + address + " -- hash: " + addressHash + " -- label: " + label);
  }

  self.getAddressesList = function(withLabel) {
    if(typeof(withLabel)==='undefined') withLabel = false;
    var addresses = [];
    
    ko.utils.arrayForEach(self.addresses(), function(address) {
      if(withLabel) {
        addresses.push([address.ADDRESS, address.label()]);
      } else {
        addresses.push(address.ADDRESS);
      }
    });
    return addresses;
  }
  
  self.getAddressObj = function(address) {
    //given an address string, return a reference to the cooresponding AddressViewModel object
    return ko.utils.arrayFirst(self.addresses(), function(a) {
      return a.ADDRESS == address;
    });
    return null;
  }
  
  self.getBalance = function(address, asset, normalized) {
    if(typeof(normalized)==='undefined') normalized = true;
    var addressObj = self.getAddressObj(address);
    assert(addressObj);
    var assetObj = addressObj.getAssetObj(asset);
    if(!assetObj) return 0; //asset not in wallet
    return normalized ? assetObj.normalizedBalance() : assetObj.rawBalance();
  }

  self.updateBalance = function(address, asset, rawBalance) {
    //Update a balance for a specific asset on a specific address. Requires that the asset exist
    var addressObj = self.getAddressObj(address);
    assert(addressObj);
    var assetObj = addressObj.getAssetObj(asset);
    if(!assetObj) {
      assert(asset != "XCP" && asset != "BTC", "BTC or XCP not present in the address?"); //these should be already in each address
      //we're trying to update the balance of an asset that doesn't yet exist at this address
      //fetch the asset info from the server, and then use that in a call to addressObj.addOrUpdateAsset
      failoverAPI("get_asset_info", [[asset]], function(assetsInfo, endpoint) {
        addressObj.addOrUpdateAsset(asset, assetsInfo[0], rawBalance);
      });    
    } else {
      assetObj.rawBalance(rawBalance);  
    }
    return true;
  }
  
  self.getAddressesWithAsset = function(asset) {
    var addresses = self.getAddressesList();
    var addressesWithAsset = [];
    //Grab the first asset object we can find for this asset
    var addressObj = null, assetObj = null;
    for(var i=0; i < addresses.length; i++) {
      addressObj = self.getAddressObj(addresses[i]);
      assetObj = addressObj.getAssetObj(asset);
      if(!assetObj) continue; //this address doesn't have the asset...that's fine
      addressesWithAsset.push(assetObj.ADDRESS);
    }
    return addressesWithAsset;
  }

  self.getTotalBalance = function(asset, normalized) { //gets the balance of an asset across all addresses
    if(typeof(normalized)==='undefined') normalized = true;
    var rawBalance = 0;
    var divisible = null;
    var addressObj = null, assetObj = null, i = null, j = null;
    for(i=0; i < self.addresses().length; i++) {
      addressObj = self.addresses()[i];
      for(j=0; j < addressObj.assets().length; j++) {
        assetObj = addressObj.assets()[j];
        if(assetObj.ASSET != asset) continue;
        rawBalance += assetObj.rawBalance();
        if(divisible === null) divisible = assetObj.DIVISIBLE;
      }
    }
    return normalized ? normalizeQuantity(rawBalance, divisible) : rawBalance;
  }

  self.getAssetsInWallet = function() { //gets assets that the user has a balance of
    //this is not optimized... O(n^2)
    var assets = [];
    var addressObj = null, assetObj = null, i = null, j = null;
    for(i=0; i < self.addresses().length; i++) {
      addressObj = self.addresses()[i];
      for(j=0; j < addressObj.assets().length; j++) {
        assetObj = addressObj.assets()[j]; 
        assets.push(assetObj.ASSET);
      }
    }
    return assets.unique();
  }

  self.getAssetsOwned = function() { //gets assets the user actually owns (is issuer of)
    //this is not optimized... O(n^2)
    var assets = [];
    var addressObj = null, assetObj = null, i = null, j = null;
    for(i=0; i < self.addresses().length; i++) {
      addressObj = self.addresses()[i];
      for(j=0; j < addressObj.assets().length; j++) {
        assetObj = addressObj.assets()[j]; 
        if(assetObj.isMine())
          assets.push(assetObj.ASSET);
      }
    }
    return assets.unique();
  }
  
  self.refreshCounterpartyBalances = function(addresses, onSuccess) {
    //update all counterparty asset balances for the specified address (including XCP)
    //Note: after login, this normally never needs to be called (except when adding a watch address),
    // as counterparty asset balances are updated automatically via the messages feed
    failoverAPI("get_normalized_balances", [addresses],
      function(balancesData, endpoint) {
        $.jqlog.debug("Got initial balances: " + JSON.stringify(balancesData));
        
        if(!balancesData.length)
          return onSuccess(); //user has no balance (i.e. first time logging in)
        
        var i = null, j = null;
        var numBalProcessed = 0;
        var assets = [];
        //Make a unique list of assets
        for(i=0; i < balancesData.length; i++) {
          if(!assets.contains(balancesData[i]['asset']))
          assets.push(balancesData[i]['asset']);
        }
        failoverAPI("get_asset_info", [assets], function(assetsInfo, endpoint) {
          for(i=0; i < assetsInfo.length; i++) {
            for(j=0; j < balancesData.length; j++) {
              if(balancesData[j]['asset'] != assetsInfo[i]['asset']) continue;
              WALLET.getAddressObj(balancesData[j]['address']).addOrUpdateAsset(
                assetsInfo[i]['asset'], assetsInfo[i], balancesData[j]['quantity']);
              numBalProcessed += 1;
              if(numBalProcessed == balancesData.length) return onSuccess();
            }
          }
        });
      }
    );
  }

  self.refreshBTCBalances = function(isRecurring) {
    if(typeof(isRecurring)==='undefined') isRecurring = false;
    //^ if isRecurring is set to true, we will update BTC balances every 5 min as long as self.autoRefreshBTCBalances == true
    
    //update all BTC balances (independently, so that one addr with a bunch of txns doesn't hold us up)
    var addresses = self.getAddressesList();
    var completedAddresses = []; //addresses whose balance has been retrieved
    var addressObj = null;
    
    //See if we have any pending BTC send transactions listed in Pending Actions, and if so, enable some extra functionality
    // to clear them out if we sense the txn as processed
    var pendingActionsHasBTCSend = ko.utils.arrayFirst(PENDING_ACTION_FEED.entries(), function(item) {
      return item.CATEGORY == 'sends' && item.DATA['asset'] == 'BTC'; //there is a pending BTC send
    });
    
    self.retriveBTCAddrsInfo(addresses, function(data) {
      //refresh the network block height (this is a bit hackish as blockHeight is embedded into each address object,
      // and they are all the same values, but we just look at the first value...we do it this way to avoid an extra API call every 5 minutes)
      if(data.length >= 1) self.networkBlockHeight(data[0]['blockHeight']);
      
      for(var i=0; i < data.length; i++) {
        //if someone sends BTC using the wallet, an entire TXout is spent, and the change is routed back. During this time
        // the (confirmed) balance will be decreased by the ENTIRE quantity of that txout, even though they may be getting
        // some/most of it back as change. To avoid people being confused over this, with BTC in particular, we should
        // display the unconfirmed portion of the balance in addition to the confirmed balance, as it will include the change output
        self.updateBalance(data[i]['addr'], "BTC", data[i]['confirmedRawBal']);
        
        addressObj = self.getAddressObj(data[i]['addr']);
        assert(addressObj, "Cannot find address in wallet for refreshing BTC balances!");
        if(data[i]['confirmedRawBal'] && !addressObj.IS_WATCH_ONLY) {
          //Also refresh BTC unspent txouts (to know when to "reprime" the account)
          addressObj.numPrimedTxouts(data[i]['numPrimedTxouts']);
          addressObj.numPrimedTxoutsIncl0Confirms(data[i]['numPrimedTxoutsIncl0Confirms']);
          
          $.jqlog.debug("refreshBTCBalances: Address " + data[i]['addr'] + " -- confirmed bal = " +  data[i]['confirmedRawBal']
            + "; unconfirmed bal = " + data[i]['unconfirmedRawBal'] + "; numPrimedTxouts = " + data[i]['numPrimedTxouts']
            + "; numPrimedTxoutsIncl0Confirms = " + data[i]['numPrimedTxoutsIncl0Confirms']);
            
          if(pendingActionsHasBTCSend) {
            //see if data[i]['lastTxns'] includes any hashes that exist in the Pending Actions, which
            // means we MAY be able to remove them from that listing (i.e. they COULD be non-BTC send (i.e. counterparty transactions) though
            //TODO: This is not very efficient when a BTC send is pending... O(n^3)! Although the sample sets are relatively small...
            for(var j=0; j < data[i]['lastTxns'].length; j++) {
              PENDING_ACTION_FEED.remove(data[i]['lastTxns'][j], "sends", true);
            }
          }
          
        } else { //non-watch only with a zero balance == no primed txouts (no need to even try and get a 500 error)
          addressObj.numPrimedTxouts(0);
          addressObj.numPrimedTxoutsIncl0Confirms(0);
        }
      }
      
      if(isRecurring && self.autoRefreshBTCBalances) {
        setTimeout(function() {
          if(self.autoRefreshBTCBalances) { self.refreshBTCBalances(true); }
        }, 60000 * 5);
      }
    }, function(jqXHR, textStatus, errorThrown) {
      //insight down or spazzing, set all BTC balances out to null
      var addressObj = null;
      for(var i=0; i < addresses.length; i++) {
        self.updateBalance(addresses[i], "BTC", null); //null = UNKNOWN
        addressObj = self.getAddressObj(addresses[i]);
        addressObj.numPrimedTxouts(null); //null = UNKNOWN
        addressObj.numPrimedTxoutsIncl0Confirms(null); //null = UNKNOWN
      }
      bootbox.alert("Got an error when trying to sync BTC balances: " + textStatus);
      
      if(isRecurring && self.autoRefreshBTCBalances) {
        setTimeout(function() {
          if(self.autoRefreshBTCBalances) { self.refreshBTCBalances(true); }
        }, 60000 * 5);
      }
    });
  }

  self.removeKeys = function() {
    //removes all keys (addresses) from the wallet. Normally called when logging out
    //stop BTC balance timer on each address
    ko.utils.arrayForEach(this.addresses(), function(a) {
        a.doBTCBalanceRefresh = false;
    });    
    self.addresses([]); //clear addresses
  } 
  
  
  /////////////////////////
  //BTC-related
  self.broadcastSignedTx = function(signedTxHex, onSuccess, onError) {
    $.jqlog.debug("RAW SIGNED HEX: " + signedTxHex);
    
    failoverAPI("broadcast", {"signed_tx_hex": signedTxHex},
      function(txHash, endpoint) {
        $.jqlog.log("broadcast:" + txHash + ": endpoint=" + endpoint);
        return onSuccess(txHash, endpoint);
      },
      onError
    );
  }

  self.signAndBroadcastTxRaw = function(key, unsignedTxHex, onSuccess, onError, verifySourceAddr, verifyDestAddr) {
    assert(verifySourceAddr, "Source address must be specified");
    //Sign and broadcast a multisig transaction that we got back from counterpartyd (as a raw unsigned tx in hex)
    //* verifySourceAddr and verifyDestAddr can be specified to verify that the txn hash we get back from the server is what we expected,
    // at least with the bitcoin source and dest addresses (if any). This is a basic form of sanity checking, that we
    // can enhance in the future to actually peer into the counterparty txn at a simplistic level to confirm certain additional details.
    //* destAddr is optional (used with sends, bets, btcpays, issuances when transferring asset ownership, and burns)
    
    var sendTx = Bitcoin.Transaction.deserialize(unsignedTxHex), i = null;
    //$.jqlog.debug("RAW UNSIGNED HEX: " + unsignedTxHex);
    
    //Sanity check on the txn source address and destination address (if specified)
    var address = null, addr = null;
    for (i=0; i < sendTx.outs.length; i++) {
      address = sendTx.outs[i].address;
      address.version = !USE_TESTNET ? Bitcoin.network.mainnet.addressVersion : Bitcoin.network.testnet.addressVersion;
      addr = address.toString();
      if(addr[0] != '1' && addr[0] != 'm' && addr[0] != 'n') continue; //not a pubkeyhash (i.e. address), skip
      if(addr.length != 33 && addr.length != 34 && addr.length != 35) continue; //not a pubkeyhash (i.e. address), skip
      //if an address is present, it must be either destAddress, or sourceAddress (i.e. for getting change)
      if(addr != verifySourceAddr && (verifyDestAddr && addr != verifyDestAddr)) {
        bootbox.alert("Client-side transaction validation FAILED. Transaction will be aborted and NOT broadcast."
          + " Please contact the Counterparty development team. Unexpected address was: " + addr);
        return false;
      }
    }
    
    //Sign the input(s)
    for (i=0; i < sendTx.ins.length; i++) {
      sendTx.sign(i, key);
    }
    return self.broadcastSignedTx(sendTx.serializeHex(), onSuccess, onError);
  }
  
  self.signAndBroadcastTx = function(address, unsignedTxHex, onSuccess, onError, verifyDestAddr) {
    var key = WALLET.getAddressObj(address).KEY;    
    return self.signAndBroadcastTxRaw(key, unsignedTxHex, onSuccess, onError, address, verifyDestAddr);
  }
  
  self.retrieveBTCBalance = function(address, onSuccess, onError) {
    //We used to have a retrieveBTCBalances function for getting balance of multiple addresses, but scrapped it
    // since it worked in serial, and one address with a lot of txns could hold up the balance retrieval of every
    // other address behind it
    failoverAPI("get_btc_address_info", {"addresses": [address], "with_uxtos": false, "with_last_txn_hashes": 0},
      function(data, endpoint) {
        return onSuccess(
          parseInt(data[0]['info']['balanceSat'] || 0), //confirmed BTC balance
          parseInt(data[0]['info']['unconfirmedBalanceSat'] || 0) //unconfirmed BTC balance
        );
      },
      onError || defaultErrorHandler);
  }

  self.retriveBTCAddrsInfo = function(addresses, onSuccess, onError, minConfirmations) {
    if(typeof(minConfirmations)==='undefined') minConfirmations = 1;
    if(typeof(onError)==='undefined')
      onError = function(jqXHR, textStatus, errorThrown) { return defaultErrorHandler(jqXHR, textStatus, errorThrown); };
    assert(onSuccess, "onSuccess callback must be defined");
    
    failoverAPI("get_btc_address_info", {"addresses": addresses, "with_uxtos": true, "with_last_txn_hashes": 5, "with_block_height": true},
      function(data, endpoint) {
        var numSuitableUnspentTxouts = null;
        var numPrimedTxoutsIncl0Confirms = null;
        var totalBalance = null;
        var i = null, j = null;
        var results = [];
        for(i=0; i < data.length; i++) {
          numSuitableUnspentTxouts = 0;
          numPrimedTxoutsIncl0Confirms = 0;
          totalBalance = 0;
          for(j=0; j < data[i]['uxtos'].length; j++) {
            if(denormalizeQuantity(data[i]['uxtos'][j]['amount']) >= MIN_PRIME_BALANCE) {
              numPrimedTxoutsIncl0Confirms++;
              if(data[i]['uxtos'][j]['confirmations'] >= minConfirmations)
                numSuitableUnspentTxouts++;
            }
            totalBalance += denormalizeQuantity(data[i]['uxtos'][j]['amount']);
          }
          results.push({
            'addr': data[i]['addr'],
            'blockHeight': data[i]['block_height'],
            'confirmedRawBal': parseInt(data[i]['info']['balanceSat'] || 0),
            'unconfirmedRawBal': parseInt(data[i]['info']['unconfirmedBalanceSat'] || 0),
            'numPrimedTxouts': Math.min(numSuitableUnspentTxouts, Math.floor(totalBalance / MIN_PRIME_BALANCE)),
            'numPrimedTxoutsIncl0Confirms': Math.min(numPrimedTxoutsIncl0Confirms, Math.floor(totalBalance / MIN_PRIME_BALANCE)),
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
    if(addressObj.numPrimedTxouts() == 0) { //no primed txouts
      if(self.getBalance(address, "BTC", false) < MIN_PRIME_BALANCE) {
        bootbox.alert("Can't do this action as you have insufficient <b class='notoAssetColor'>BTC</b> at this address, and Counterparty actions require a"
          + " small balance of <b class='notoAssetColor'>BTC</b> to perform (approximately"
          + " <b class='notoQuantityColor'>" + normalizeQuantity(MIN_PRIME_BALANCE) + "</b> <b class='notoAssetColor'>BTC</b> per transaction).<br/><br/>"
          + "Please deposit some <b class='notoAssetColor'>BTC</b> into <b class='notoAddrColor'>" + getAddressLabel(address) + "</b> and try again.");
        return false;
      } else {
        //Otherwise, we DO have a balance, we just don't have any suitable primed outputs
        PRIME_ADDRESS_MODAL.show(address);
        PRIME_ADDRESS_MODAL.showNoPrimedInputsError(true);
        return false;
      }
    }
    return true;
  }
  
  self.doTransaction = function(address, action, data, onSuccess, onError) {
    //specify the pubkey for a multisig tx
    assert(data['encoding'] === undefined);
    assert(data['pubkey'] === undefined);
    data['encoding'] = 'multisig';
    data['pubkey'] = WALLET.getAddressObj(address).PUBKEY;
    //find and specify the verifyDestAddr

    if (ALLOW_UNCONFIRMED_INPUTS && supportUnconfirmedChangeParam(action)) {
      data['allow_unconfirmed_inputs'] = true;
    }    
    
    //hacks for passing in some data that should be sent to PENDING_ACTION_FEED.add(), but not the create_ API call
    // here we only have to worry about what we create a txn for (so not order matches, debits/credits, etc)
    var extra1 = null, extra2 = null;
    if(action == 'create_order') {
      extra1 = data['_give_divisible'];
      delete data['_give_divisible'];
      extra2 = data['_get_divisible'];  
      delete data['_get_divisible'];
    } else if(action == 'create_cancel') {
      extra1 = data['_type'];
      delete data['_type'];
      extra2 = data['_tx_index'];
      delete data['_tx_index'];
    } else if(action == 'create_send') {
      extra1 = data['_divisible'];
      delete data['_divisible'];
    }
    
    var verifyDestAddr = data['destination'] || data['transfer_destination'] || null;
    multiAPIConsensus(action, data,
      function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {
        $.jqlog.debug("TXN CREATED. numTotalEndpoints="
          + numTotalEndpoints + ", numConsensusEndpoints="
          + numConsensusEndpoints + ", RAW HEX=" + unsignedTxHex);
        WALLET.signAndBroadcastTx(address, unsignedTxHex, function(txHash, endpoint) {
          //register this as a pending transaction
          var category = action.replace('create_', '') + 's'; //hack
          if(data['source'] === undefined) data['source'] = address;
          if(action == 'create_order') {
            data['_give_divisible'] = extra1;
            data['_get_divisible'] = extra2;
          } else if(action == 'create_cancel') {
            data['_type'] = extra1;
            data['_tx_index'] = extra2;
          } else if(action == 'create_send') {
            data['_divisible'] = extra1;
          }
          PENDING_ACTION_FEED.add(txHash, category, data);
          
          return onSuccess(txHash, data, endpoint);
        }, onError, verifyDestAddr);
    });
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
