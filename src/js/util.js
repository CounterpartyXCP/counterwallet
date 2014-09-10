//Counterwallet-specific utility functions

function feedImageUrl(image_name) {
  var url = cwBaseURLs()[0];
  url += USE_TESTNET ? '/_t_feed_img/' : '/_feed_img/';
  url += image_name + '.png';
  return url;
}

function assetImageUrl(image_name) {
  var url = cwBaseURLs()[0];
  url += USE_TESTNET ? '/_t_asset_img/' : '/_asset_img/';
  url += image_name + '.png';
  return url;
}

function getCurrentPage() {
  return(window.location.hash.replace('#', '/'));
}

function decodeJsonBet(jsonBetBase64) {
  var jsonBet;
  try {
    $.jqlog.debug(atob(jsonBetBase64));
    jsonBet = JSON.parse(atob(jsonBetBase64));

  } catch(e) {
    return false;
  }
  if (typeof(jsonBet) != 'object') {
    return false;
  }
  if (jsonBet.command == undefined || jsonBet.command != 'bet') {
    return false;
  }
  var numbers = {'wager':1, 'counterwager':1, 'target_value':1, 'expiration':1, 'leverage':1, 'bet_type':1};
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
  for(var i = 0; i < addresses.length; i++) {
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
  if (RESTRICTED_AREA[action] && RESTRICTED_AREA[action].indexOf(USER_COUNTRY) != -1) {
    
    var message = i18n.t('forbiden_country');

    if(USE_TESTNET) { //allow the user to bust on through this alert on testnet
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
