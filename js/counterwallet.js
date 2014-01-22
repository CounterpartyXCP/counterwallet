var timeout; // Global, hmmm.
var PREFERENCES = {}; //set when logging in

function alertModal(text) {
  $('#alertModalText').text(text || 'Nevermind');
  $('#alertModal').modal();
}

function verifySoon() {
  if(timeout) 
  {
      clearTimeout(timeout);
      timeout = null;
  }
  timeout = setTimeout(txOnChangeDest, 1000);
}

function hideAll()
{
  $('ul.nav-list li').removeClass('active');
  $('#home').hide();
  $('#send').hide();
}

function sendFromAddr(address) {
  //show send screen
  //pre-populate address
  alert("Todo");
}

function login_success() 
{
  $('#logon').hide();
  $('#site').show();
  
  //Generate the elements in the DOM for each address on the balances screen 
  var addrs = WALLET.getAddresses();
  for (var i=0; i < addrs.length; i++) {
    $('#balances_container').append("")
    
    var panel = '<div class="panel panel-info">';
    
    //panel header and actions dropdown
    panel += '<div class="panel-heading clearfix"><h3 class="panel-title pull-left">'
        + '<a href="#" id="#label_'+addrs[i]+'">'+(addrs[i] in PREFERENCES.address_aliases ? PREFERENCES.address_aliases[addrs[i]] : 'Click to set a nickname')+'</a></h3>'
          + '<h4 class="panel-title pull-left">' + addrs[i] + '</h4>'
        + '<div class="btn-group pull-right"><button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">Actions <span class="caret"></span></button>'
        + '<ul class="dropdown-menu" role="menu">'
          + '<li><a id="action_'+addrs[i]+'_sendfrom" href="#">Send from</a></li>'
          + '<li><a id="action_'+addrs[i]+'_qrcode" href="#">Show QR code</a></li>'
          + '<li><a id="action_'+addrs[i]+'_createasset" href="#">Create asset at</a></li>'
        + '<li class="divider"></li><li class="dropdown-header">Sort by...</li><li><a href="#">Name</a></li><li><a href="#">Balance</a></li>'
        + '<li class="divider"></li><li class="dropdown-header">Filter?</li>'
          + '<li><a id="filter_'+addrs[i]+'_showall" href="#">Show All</a></li>'
          + '<li><a id="filter_'+addrs[i]+'_showbase" href="#">Show XCP & BTC only</a></li>'
          + '<li><a id="filter_'+addrs[i]+'_showmyassets" href="#">Show my assets only</a></li>'
          + '<li><a id="filter_'+addrs[i]+'_showothassets" href="#">Show others\' assets only</a></li>'
        + '</ul>'
        + '</div></div>';
    
    //panel body
    panel += '<div id="balances_'+addrs[i]+'_container"></div>'; //will contain isotope entries for each asset w/ a balance

    //panel close
    panel += '</div>';

    //panel action handlers    
    $('#label_'+addrs[i]).editable({
        type: 'text',
        url: function(params) {
          PREFERENCES.address_aliases[addrs[i]] = params.value;
          //update the preferences on the server 
          makeJSONAPICall("counterwalletd", "store_preferences", [WALLET.id, prefs], function(data) {
            //update was a success
            $('#label_'+addrs[i]).text(params.value);
          });
        },
        title: 'Enter a nickname for this address'
    });    
    
    $('#action_'+addrs[i]+'_sendfrom').on('click', function() {
      
    });
    $('#action_'+addrs[i]+'_qrcode').on('click', function() {
      var qrcode = makeQRCode(addr);
      //$('#qrcode' + i).popover({ title: 'QRCode', html: true, content: qrcode, placement: 'bottom' });
    });
    $('#action_'+addrs[i]+'_createasset').on('click', function() {
      
    });
    $('#filter_'+addrs[i]+'_showall').on('click', function() {
      
    });
    $('#filter_'+addrs[i]+'_showbase').on('click', function() {
      
    });
    $('#filter_'+addrs[i]+'_showmyassets').on('click', function() {
      
    });
    $('#filter_'+addrs[i]+'_showothassets').on('click', function() {
      
    });
    
  }
  
  //Update the wallet balances
  WALLET.updateBalances(function(address, asset, newbalance) {
    //TODO
  });
  
  
  /*$("#txDropAddr").find("option").remove();
  for(i = 0; i < WALLET.getKeys().length; i++)
  {
    var addr = WALLET.getKeys()[i].getBitcoinAddress().toString();
    $("#txDropAddr").append('<option value=' + i + '>' + addr + '</option>'); 
    $('#balance' + i).text(Bitcoin.Util.formatValue(WALLET.getBalances()[i])); 
    
    
  }
  txOnChangeSource();
  */
  
  return false;
}


/*
 * JQUERY INIT HANDLER
 */
$(document).ready(function() {
  //Set up logging (jqlog)
  $.jqlog.enabled(true);
  
  // Add support for instawallet style URLS. Only we use a hash 
  // and therefore the URL is not sent to the server.
  // See http://en.wikipedia.org/wiki/Fragment_identifier
  var hash = $(location).attr('href').split('#')[1];
  if(hash != '' && hash != undefined)
  {
    $('#password').val(hash.replace(/-/g, ' '));
    checkValidPassword();
  }
  
  //Set up handler for Navbar menu flipping (once logged in)  
  $('#menubar a').click(function (e) {
    if($(this).parent('li').hasClass('active')){
        $( $(this).attr('href') ).hide();
    }
    else {
        e.preventDefault();
        $(this).tab('show');
    }
  });

  //Logout handler
  $('#logout').click(function(){
    $('#password').val('');
    $('#site').hide();
    $('#create-keys').collapse('hide');
    $('#create-WALLET').collapse('hide');
    checkValidPassword();
    $('#logon').show();
    return false;
  });

  //Set up other handlers
  pane_send_init();
  pane_logon_init();
});

