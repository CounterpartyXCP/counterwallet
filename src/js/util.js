//Counterwallet-specific utility functions

function formatHtmlPrice(price) {
  num = noExponents(parseFloat(price).toFixed(8));
  var parts = num.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  parts[1] = parts[1].replace(/(0{0,8}$)/, '<span class="text-muted">$1</span>')
  return parts.join('.');
}

function cleanHtmlPrice(price) {
  var clean = price.split("<span");
  return parseFloat(clean[0]);
}

function feedImageUrl(image_name) {
  var url = cwBaseURLs()[0];
  var prefix = USE_TESTNET ? "_t" : ( USE_REGTEST ? "_r" : "");
  url += '/' + prefix + '_feed_img/';
  url += image_name + '.png';
  return url;
}

function assetImageUrl(image_name) {
  var url = cwBaseURLs()[0];
  var prefix = USE_TESTNET ? "_t" : ( USE_REGTEST ? "_r" : "");
  url += '/' + prefix + '_asset_img/';
  url += image_name + '.png';
  return url;
}

function getCurrentPage() {
  return (window.location.hash.replace('#', '/'));
}

function decodeJsonBet(jsonBetBase64) {
  var jsonBet;
  try {
    $.jqlog.debug(atob(jsonBetBase64));
    jsonBet = JSON.parse(atob(jsonBetBase64));

  } catch (e) {
    return false;
  }
  if (typeof(jsonBet) != 'object') {
    return false;
  }
  if (jsonBet.command == undefined || jsonBet.command != 'bet') {
    return false;
  }
  var numbers = {'wager': 1, 'counterwager': 1, 'target_value': 1, 'expiration': 1, 'leverage': 1, 'bet_type': 1};
  for (var e in numbers) {
    if (jsonBet[e] == undefined || isNaN(jsonBet[e])) {
      return false;
    }
  }
  if (BET_TYPES_SHORT[jsonBet.bet_type] == undefined) {
    return false;
  }
  if (jsonBet.deadline == undefined || !moment(jsonBet.deadline).isValid()) {
    return false;
  }
  if (jsonBet.feed_address == undefined || !CWBitcore.isValidAddress(jsonBet.feed_address)) {
    return false;
  }
  if (jsonBet.source == undefined) {
    return false;
  }
  var addresses = WALLET.getAddressesList(true);
  var isMine = false;
  for (var i = 0; i < addresses.length; i++) {
    if (addresses[i][0] == jsonBet.source) {
      isMine = true;
    }
  }
  if (!isMine) {
    return false;
  }
  return jsonBet;
}

function expireDate(expire_index) {
  var expire_in = expire_index - WALLET.networkBlockHeight();
  return new Date((new Date()).getTime() + (expire_in * APPROX_SECONDS_PER_BLOCK * 1000));
}

function checkCountry(action, callback) {
  if (restrictedAreas[action] && restrictedAreas[action].indexOf(USER_COUNTRY) != -1) {
    var message = i18n.t('forbiden_country');

    if (action in RESTRICTED_AREA_MESSAGE) {
      message += '<br />' + i18n.t(RESTRICTED_AREA_MESSAGE[action]);
    }

    if (USE_TESTNET || USE_REGTEST) { //allow the user to bust on through this alert on testnet
      bootbox.dialog({
        title: i18n.t("country_warning"),
        message: message + "<br/><br/>" + i18n.t("testnet_proceed_anyway"),
        buttons: {
          "success": {
            label: i18n.t("proceed_anyway"),
            className: "btn-success",
            callback: function() {
              callback();
            }
          },
          "cancel": {
            label: i18n.t("close"),
            className: "btn-danger",
            callback: function() {
              bootbox.hideAll();
              return false;
            }
          }
        }
      });
    } else {
      bootbox.dialog({
        title: i18n.t("country_warning"),
        message: message,
        buttons: {
          "cancel": {
            label: i18n.t("close"),
            className: "btn-danger",
            callback: function() {
              bootbox.hideAll();
              return false;
            }
          }
        }
      });
    }
  } else {
    callback();
  }
}

function orderMultisigAddress(address) {
  var addresse_array = address.split('_');
  if (addresse_array.length > 1) {
    var required_sig = addresse_array.shift();
    var provided_sig = addresse_array.pop();
    return required_sig + '_' + addresse_array.sort().join("_") + '_' + provided_sig;
  } else {
    return addresse_array.pop();
  }

}

function pubkeyToPubkeyhash(pubkey) {
  return CWBitcore.pubKeyToPubKeyHash(pubkey);
}

function getPubkeyForAddress(address, callback) {
  if (!CWBitcore.isValidAddress(address) && !CWBitcore.isValidMultisigAddress(address)) {
    callback([]);
  }
  var pubkeys = [];
  var addresses = address.split('_');
  for (var a in addresses) {
    var addr = addresses[a];
    if (CWBitcore.isValidAddress(addr)) {
      var addrObj = WALLET.getAddressObj(addr);
      if (addrObj) {
        pubkeys.push(addrObj.PUBKEY);
      }
    }
  }
  if (addresses.length > pubkeys.length) {
    failoverAPI("get_pubkey_for_address", {'address': address}, function(data) {
      if (data) {
        for (var p in data) {
          if (pubkeys.indexOf(data[p]) == -1) {
            pubkeys.push(data[p]);
          }
        }
      }
      callback(pubkeys);
    });
  } else {
    callback(pubkeys);
  }
}

function getLinkForCPData(type, dataID, dataTitle, htmlize) {
  if (typeof(dataTitle) === 'undefined' || dataTitle === null) dataTitle = dataID;
  if (typeof(htmlize) === 'undefined' || htmlize === null) htmlize = true;
  if (typeof(type) === 'undefined') type = 'tx';
  var url = null;
  if (type == 'address') { //dataID is an address
    url = BLOCKEXPLORER_URL + '/address/' + dataID;
    //format multisig addresses
    if (dataTitle.indexOf("_") > -1) {
      var parts = dataTitle.split('_');
      dataTitle = "multisig " + parts[0] + " of " + parts[parts.length - 1];
      //remove first and last elements
      parts.shift();
      parts.pop();
      dataTitle += " (" + parts.join(', ') + ")";
    }
  } else if (type == 'tx') { //generic TX
    url = BLOCKEXPLORER_URL + '/tx/' + dataID;
  } else {
    assert(false, "Unknown type of " + type);
  }

  return htmlize ? ('<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + dataTitle + '</a>') : url;
}

function getTxHashLink(hash) {
  // TODO: add link to blockscan when possible
  var shortHash = hash.substr(hash.length - 5);
  if (hash.length == 128) {
    shortHash += '...' + hash.substr(64, 5);
  }
  var link = '<span rel="tooltip" title="' + hash + '" data-placement="top" data-container="body" class="shortHash">' + shortHash + '</span>';

  return link;
}

function getLinkForBlock(blockIndex, dataTitle, htmlize) {
  if (typeof(dataTitle) === 'undefined' || dataTitle === null) dataTitle = blockIndex;
  if (typeof(htmlize) === 'undefined' || htmlize === null) htmlize = true;
  var url = BLOCKEXPLORER_URL + '/block/' + blockIndex;
  return htmlize ? '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + dataTitle + '</a>' : url;
}

function getAddressLabel(address) {
  //gets the address label if the address is in this wallet
  return PREFERENCES['address_aliases'][hashToB64(address)] || address;
}
