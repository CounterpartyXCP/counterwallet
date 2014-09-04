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
    
    var message = 'It appears that you are located in a country in which we are legally unable to provide this service.';

    if(USE_TESTNET) { //allow the user to bust on through this alert on testnet
      bootbox.dialog({
        title: "Country warning",
        message: message + "<br/><br/>Since you are on testnet, you can choose to proceeed anyway.",
        buttons: {
          "success": {
            label: "Proceed Anyway",
            className: "btn-success",
            callback: function() {
              callback();
            }
          },
          "cancel": {
            label: "Close",
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
        title: "Country warning",
        message: message,
        buttons: {
          "cancel": {
            label: "Close",
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

ko.bindingHandlers['locale'] = {
  update: function(element, valueAccessor, allBindings){
    var key = ko.unwrap(valueAccessor());
    var args = ko.toJS(allBindings.get('localeArgs') || []);
    var translation = i18n.t(key, {postProcess: 'sprintf', sprintf: args});
    //$.jqlog.debug(key + " : " + translation);
    element.innerHTML = translation;
  }
};

ko.bindingHandlers['localeAttr'] = {
  update: function(element, valueAccessor, allBindings){
    var attributes = ko.toJS(valueAccessor());
    var attributesArgs = ko.toJS(allBindings.get('localeAttrArgs') || {});
    for (var attrName in attributes) {
      var args = [];
      if (attributesArgs[attrName]) {
        args = ko.toJS(attributesArgs[attrName]);
      }
      var translation = i18n.t(attributes[attrName], {postProcess: 'sprintf', sprintf: args});
      $(element).attr(attrName, translation);
    }
  }
};
