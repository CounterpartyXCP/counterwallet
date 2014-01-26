var timeout; // Global, hmmm.
var PREFERENCES = {}; //set when logging in

/*
 * Primary site init (thanks to knockout.js, this is where all the "magic" does NOT happen :)
 */
$(document).ready(function() {
  //Set up logging (jqlog)
  $.jqlog.enabled(true);
  
  //Set up form validation
  $("input,select,textarea").not("[type=submit]").jqBootstrapValidation();
  
  //Reject cruddy old browsers
  $.reject({  
    reject: {
      msie5: true, //die die die!
      msie6: true, //die die die!
      msie7: true, //die die die!
      msie8: true, //die die die!
      firefox1: true,
      firefox2: true
    },
    imagePath: './images/jquery.reject/', // Path where images are located    
  }); // Customized Text    
  
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
    $('#site').hide();
    LOGON_VIEW_MODEL.enteredPassphrase('');
    LOGON_VIEW_MODEL.generatedPassphrase('');
    
    //Clear addresses (this will stop BTC balance refresh as well)
    WALLET.removeAddresses();
    
    $('#logon').show();
    return false;
  });
});

