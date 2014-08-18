
function WalletViewModel() {
  //The user's wallet
  var self = this;
  self.BITCOIN_WALLET = null; // CWHierarchicalKey instance
  self.autoRefreshBTCBalances = true; //auto refresh BTC balances every 5 minutes
  
  self.identifier = ko.observable(null); //set when logging in
  self.networkBlockHeight = ko.observable(null); //stores the current network block height. refreshed when we refresh the BTC balances
  self.addresses = ko.observableArray(); //AddressViewModel objects -- populated at login
  
  self.isNew = ko.observable(false); //set to true if we can't find the user's prefs when logging on. if set, we'll show some intro text on their login, etc.
  self.isSellingBTC = ko.observable(false); //updated by the btcpay feed
  self.isOldWallet = ko.observable(false);

  self.networkBlockHeight.subscribe(function(newBlockIndex) {
    try {
      if (CURRENT_PAGE_URL == 'pages/exchange.html') {
        EXCHANGE.refresh();
      }
    } catch(e) {}
  });
  
  self.addAddress = function(type, address, armoryPubKey) {
    assert(['normal', 'watch', 'armory'].indexOf(type) != -1);
    assert((type == 'normal' && !address) || (address));
    assert((type == 'armory' && armoryPubKey) || !armoryPubKey); //only used with armory addresses
    
    if(type == 'normal') {
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
      var label = PREFERENCES.address_aliases[addressHash] || "My Address #" + (i + 1);
      //^ an alias is made when a watch address is made, so this should always be found
  
      self.addresses.push(new AddressViewModel(type, key, address, label)); //add new
      $.jqlog.debug("Wallet address added: " + address + " -- hash: "
        + addressHash + " -- label: " + label + " -- index: " + i);
    } else {
      //adds a watch only address to the wallet
      //a label should already exist for the address in PREFERENCES.address_aliases by the time this is called
      assert(!self.getAddressObj(address), "Cannot addAddress: watch/armory address already exists in wallet!");
      var addressHash = hashToB64(address);
      var label = PREFERENCES.address_aliases[addressHash] || "UNKNOWN LABEL";
  
      self.addresses.push(new AddressViewModel(type, null, address, label, armoryPubKey)); //add new
      $.jqlog.debug("Watch-only or armory wallet address added: " + address + " -- hash: "
        + addressHash + " -- label: " + label + " -- armoryPubKey: " + armoryPubKey);
    }

    return address;
  }
  
  self.getAddressesList = function(withLabel) {
    if(typeof(withLabel)==='undefined') withLabel = false;
    var addresses = [];
    
    ko.utils.arrayForEach(self.addresses(), function(address) {
      if(withLabel) {
        addresses.push([address.ADDRESS, address.label(), address.getXCPBalance(), address.PUBKEY]);
      } else {
        addresses.push(address.ADDRESS);
      }
    });
    return addresses;
  }

  self.getBiggestXCPBalanceAddress = function() {
    var maxAmount = 0;
    var maxAddress = null;

    ko.utils.arrayForEach(self.addresses(), function(address) {
      var xcpBalance = address.getXCPBalance();
      if (xcpBalance>maxAmount) {
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
    return null;
  }
  
  self.getBalance = function(address, asset, normalized) {
    if(typeof(normalized)==='undefined') normalized = true;
    var addressObj = self.getAddressObj(address);
    assert(addressObj);
    var assetObj = addressObj.getAssetObj(asset);
    if(!assetObj) return 0; //asset not in wallet
    if (asset != BTC) {
      return normalized ? assetObj.normalizedBalance() : assetObj.rawBalance();
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
    if(!assetObj) {
      assert(asset != XCP && asset != BTC, BTC + " or " + XCP + " not present in the address?"); //these should be already in each address
      //we're trying to update the balance of an asset that doesn't yet exist at this address
      //fetch the asset info from the server, and then use that in a call to addressObj.addOrUpdateAsset
      failoverAPI("get_asset_info", {'assets': [asset]}, function(assetsInfo, endpoint) {
        addressObj.addOrUpdateAsset(asset, assetsInfo[0], rawBalance);
      });    
    } else {
      assetObj.rawBalance(rawBalance); 
      if (asset == BTC && unconfirmedRawBal) {
        assetObj.unconfirmedBalance(normalizeQuantity(unconfirmedRawBal));
        assetObj.balanceChangePending(true);
      } else if (asset == BTC) {
        assetObj.unconfirmedBalance(0);
        assetObj.balanceChangePending(false);
      }
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
    return _.uniq(assets);
  }

  self.isAssetHolder = function(asset) {
    var addressObj = null, assetObj = null, i = null, j = null;
    for(i=0; i < self.addresses().length; i++) {
      addressObj = self.addresses()[i];
      for(j=0; j < addressObj.assets().length; j++) {
        assetObj = addressObj.assets()[j]; 
        if (assetObj.ASSET == asset) {
          return true;
        }
      }
    }
    return false
  }

  self.searchDivisibility = function(asset, callback) {
    if (asset == BTC || asset == XCP) {
      callback(true);
      return;
    }
    // check if the wallet have the information
    var divisible = -1;
    var addressObj = null, assetObj = null, i = null, j = null;
    for(i=0; i < self.addresses().length; i++) {
      addressObj = self.addresses()[i];
      for(j=0; j < addressObj.assets().length; j++) {
        assetObj = addressObj.assets()[j]; 
        if (assetObj.ASSET == asset) {
          callback(assetObj.DIVISIBLE);
          return;
        }
      }
    }
    // else make a query to counterpartyd
    if (divisible == -1) {
      failoverAPI("get_asset_info", {'assets': [asset]}, function(assetsInfo, endpoint) {
        callback(assetsInfo[0]['divisible']);
        return;
      }); 
    }
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
    return _.uniq(assets);
  }
  
  self.refreshCounterpartyBalances = function(addresses, onSuccess) {
    //update all counterparty asset balances for the specified address (including XCP)
    //Note: after login, this normally never needs to be called (except when adding a watch address),
    // as counterparty asset balances are updated automatically via the messages feed
    failoverAPI("get_normalized_balances", {'addresses': addresses},
      function(balancesData, endpoint) {
        $.jqlog.debug("Got initial balances: " + JSON.stringify(balancesData));
        
        if(!balancesData.length)
          return onSuccess(); //user has no balance (i.e. first time logging in)
        
        var i = null, j = null;
        var numBalProcessed = 0;
        var assets = [];
        //Make a unique list of assets
        for(i=0; i < balancesData.length; i++) {
          if(assets.indexOf(balancesData[i]['asset'])==-1)
          assets.push(balancesData[i]['asset']);
        }
        getAssetInfo(assets).then(function (assetsInfo) {
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
      return item.CATEGORY == 'sends' && item.DATA['asset'] == BTC; //there is a pending BTC send
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
        self.updateBalance(data[i]['addr'], BTC, data[i]['confirmedRawBal'], data[i]['unconfirmedRawBal']);
        
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
        self.updateBalance(addresses[i], BTC, null, null); //null = UNKNOWN
        addressObj = self.getAddressObj(addresses[i]);
        addressObj.numPrimedTxouts(null); //null = UNKNOWN
        addressObj.numPrimedTxoutsIncl0Confirms(null); //null = UNKNOWN
      }
      bootbox.alert("Got an error when trying to sync " + BTC + " balances: " + textStatus);
      
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
    if (signedTxHex==false) {
      bootbox.alert("Client-side transaction validation FAILED. Transaction will be aborted and NOT broadcast."
                    + " Please contact the " + XCP_NAME + " development team");
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

  self.signAndBroadcastTxRaw = function(key, unsignedTxHex, onSuccess, onError, verifySourceAddr, verifyDestAddr) {
    assert(verifySourceAddr, "Source address must be specified");
    assert(verifyDestAddr, "Destination address must be specified");
    //Sign and broadcast a multisig transaction that we got back from counterpartyd (as a raw unsigned tx in hex)
    //* verifySourceAddr and verifyDestAddr MUST be specified to verify that the txn hash we get back from the server is what we expected. 
    
    $.jqlog.debug("RAW UNSIGNED HEX: " + unsignedTxHex);
   
    //Sign the input(s)
    var signedHex = key.checkAndSignRawTransaction(unsignedTxHex, verifyDestAddr);
    return self.broadcastSignedTx(signedHex, onSuccess, onError);
  }
  
  self.signAndBroadcastTx = function(address, unsignedTxHex, onSuccess, onError, verifyDestAddr) {
    var key = WALLET.getAddressObj(address).KEY;
    return self.signAndBroadcastTxRaw(key, unsignedTxHex, onSuccess, onError, address, verifyDestAddr);
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

  self.retriveBTCAddrsInfo = function(addresses, onSuccess, onError, minConfirmations) {
    if(typeof(minConfirmations)==='undefined') minConfirmations = 1;
    if(typeof(onError)==='undefined')
      onError = function(jqXHR, textStatus, errorThrown) { return defaultErrorHandler(jqXHR, textStatus, errorThrown); };
    assert(onSuccess, "onSuccess callback must be defined");
    
    failoverAPI("get_chain_address_info", {"addresses": addresses, "with_uxtos": true, "with_last_txn_hashes": 5, "with_block_height": true},
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
    
    if(self.getBalance(address, BTC, false) < MIN_PRIME_BALANCE) {
      bootbox.alert("Cannot do this action as you have insufficient <b class='notoAssetColor'>" + BTC + "</b> at this address."
        + "Due to " + BTC_NAME + " fees, each " + XCP_NAME + " action requires"
        + " approximately <b class='notoQuantityColor'>" + normalizeQuantity(MIN_PRIME_BALANCE) + "</b> <b class='notoAssetColor'>" + BTC + "</b> to perform.<br/><br/>"
        + "Please deposit the necessary <b class='notoAssetColor'>" + BTC + "</b> into <b class='notoAddrColor'>" + getAddressLabel(address) + "</b> and try again.");
      return false;
    }

    return true;
  }
  
  self.doTransaction = function(address, action, data, onSuccess, onError) {
    assert(['sign_tx', 'broadcast_tx', 'convert_armory_signedtx_to_raw_hex'].indexOf(action) === -1,
      'Specified action not supported through this function. please use appropriate primatives');
    
    var addressObj = WALLET.getAddressObj(address);
    
    //should not ever be a watch only wallet
    assert(!addressObj.IS_WATCH_ONLY);
    
    //specify the pubkey for a multisig tx
    assert(data['encoding'] === undefined);
    assert(data['pubkey'] === undefined);
    data['encoding'] = 'multisig';
    data['pubkey'] = addressObj.PUBKEY;
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

    var verifyDestAddr = data['destination'] || data['transfer_destination'] || data['feed_address'] || data['destBtcPay'] || data['source'];
    delete data['destBtcPay'];
    if (action == "create_burn") {
      verifyDestAddr = UNSPENDABLE;
    } else if (action == "create_dividend" && data['dividend_asset'] == BTC) {
      verifyDestAddr = data['_btc_dividend_dests'];
      delete data['_btc_dividend_dests'];
    }
    
    //Do the transaction
    multiAPIConsensus(action, data,
      function(unsignedTxHex, numTotalEndpoints, numConsensusEndpoints) {
        $.jqlog.debug("TXN CREATED. numTotalEndpoints="
          + numTotalEndpoints + ", numConsensusEndpoints="
          + numConsensusEndpoints + ", RAW HEX=" + unsignedTxHex);
          
        //if the address is an armory wallet, then generate an offline transaction to get signed
        if(addressObj.IS_ARMORY_OFFLINE) {
          multiAPIConsensus("create_armory_utx", {'unsigned_tx_hex': unsignedTxHex, 'public_key_hex': addressObj.PUBKEY},
            function(asciiUTx, numTotalEndpoints, numConsensusEndpoints) {
              //DO not add to pending action feed (it will be added automatically via zeroconf when the p2p network sees the tx)
              $.jqlog.debug("ARMORY UTX GENERATED: " + asciiUTx);
              return onSuccess ? onSuccess(null, data, null, 'armory', asciiUTx) : null;
            }
          );
          return;
        } else {
          WALLET.signAndBroadcastTx(address, unsignedTxHex, function(txHash, endpoint) {
            //register this as a pending transaction
            var category = action.replace('create_', '') + 's'; //hack
            if (category == 'rpss') category = 'rps';
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
            
            return onSuccess ? onSuccess(txHash, data, endpoint, 'normal', null) : null;
          }, onError, verifyDestAddr);
        }
    });
  }
  
  self.showTransactionCompleteDialog = function(text, armoryText, armoryUTx) {
    if(armoryUTx) {
      bootbox.alert((armoryText || text) + "<br/><br/>To complete the transaction, please copy over and sign the text below on your"
        + " offline Armory system, then bring back to " + XCP_NAME + " to broadcast:</br>"
        + "<textarea class=\"form-control armoryUTxTextarea\" rows=\"20\">" + armoryUTx + "</textarea>");
    } else {
      bootbox.alert(text);
    }
  }

  self.storePreferences = function(callback, for_login) {
    var params = {
      'wallet_id': WALLET.identifier(),
      'preferences': PREFERENCES,
      'network': USE_TESTNET ? 'testnet' : 'mainnet',
      'referer': ORIG_REFERER
    };
    if (for_login) {
      params['for_login'] = true;
    }
    multiAPI("store_preferences", params, callback);
    var now = Math.round((new Date()).getTime() / 1000);
    localStorage.setObject(WALLET.identifier() + '_preferences', {'last_updated': now, 'preferences':PREFERENCES});
  }
}

/*NOTE: Any code here is only triggered the first time the page is visited. Put JS that needs to run on the
  first load and subsequent ajax page switches in the .html <script> tag*/
