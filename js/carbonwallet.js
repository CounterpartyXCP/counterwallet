// Global, hmmm.
var timeout;

$(document).ready(function() {

  $('#site').hide();
  $('#tx').hide();
  $('#logout-menu').hide();
  
  // Add instawallet style URLS. Only we use a hash 
  // and therefore the URL is not sent to the server.
  // See http://en.wikipedia.org/wiki/Fragment_identifier
  var hash = $(location).attr('href').split('#')[1];
  if(hash != '')
  {
    $('#password').val(hash.replace(/-/g, ' '));
    checkValidPassword();
  }
  
  $('#open-sesame').click(function(){
  
    var seed = $('#password').val();
    seed = mn_decode(seed);
    Electrum.init(seed, function(r) {
        if(r % 20 == 0)
          $('#seed-progress').css('width', (r + 19) + '%'); 
      }, 
      function(privKey) {
        Electrum.gen(10, function(r) { 
          WALLET.getKeys().push(new Bitcoin.ECKey(r[1])); 
          if(WALLET.getKeys().length == 10)
            login_success(); 
        });
      }
    );
        
    return true;
  })


  $('#txDropGetUnspent').click(txDropGetUnspent);
  $('#txDropAddr').change(txOnChangeSource);
  $('#txValue').change(txOnChangeDest);
  $('#txDest').change(txOnChangeDest);
  $('#txDest').keypress(verifySoon);
  $('#txValue').keypress(verifySoon);
  
  $('#password').keyup(checkValidPassword);

  $('#txAddDest').click(txOnAddDest);
  $('#txRemoveDest').click(txOnRemoveDest);
  $('#txSend').click(txVerify);
  $('#sendPayment').click(txSend);
  $('#generate-password').click(generatePassword);
  $('#regenerate-password').click(regeneratePassword);
  $('#regenerate-password').tooltip();
        
  $('#your-addresses-nav, #home').click(function(){
    hideAll();
    $('#your-addresses').show();
    $('#your-addresses-nav').parent().addClass('active');
    return false;
  });

  $('#make-payment-nav').click(function(){
    hideAll();
    $('#tx').show();
    $('#make-payment-nav').parent().addClass('active');
    return false;
  });

  $('#logout').click(function(){
    $('#password').val('');
    $('#site').hide();
    $('#create-keys').collapse('hide');
    $('#create-WALLET').collapse('hide');
    $('#logout-menu').hide();
    checkValidPassword();
    $('#logon').show();
    return false;
  });

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
    $('#your-addresses').hide();
    $('#tx').hide();
  }
  
  function login_success() 
  {
    $('#logon').hide();
    $('#site').show();
    $('#logout-menu').show();
    
    WALLET.updateAllBalances();
    $("#txDropAddr").find("option").remove();
    
    for(i = 0; i < WALLET.getKeys().length; i++)
    {
      var addr = WALLET.getKeys()[i].getBitcoinAddress().toString();
      $('#address' + i).text(addr); 
      $("#txDropAddr").append('<option value=' + i + '>' + addr + '</option>'); 
      $('#balance' + i).text(Bitcoin.Util.formatValue(WALLET.getBalances()[i])); 
      var qrcode = makeQRCode(addr);
      $('#qrcode' + i).popover({ title: 'QRCode', html: true, content: qrcode, placement: 'bottom' });
    }
    
    txOnChangeSource();
    
    return false;
  }
  
  function makeQRCode(addr) {
    var qr = qrcode(3, 'M');
    addr = addr.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
    qr.addData(addr);
    qr.make();
    return qr.createImgTag(4);
  }
  
  function checkValidPassword(){
    var password = $('#password').val()
    var valid = true;
    
    if(password.split(' ').length != 12)
      valid = false;
      
    if(valid)
    {
      $('#open-sesame').addClass('btn-primary');
      $('#open-sesame').removeAttr('disabled');
    }
    else
    {
      $('#open-sesame').removeClass('btn-primary');
      $('#open-sesame').attr('disabled', 'disabled');
    }
  }
  
  // -- WALLET Creation --
  function regeneratePassword() {
    $('#generated').val('');
    return generatePassword();
  }
  
  function generatePassword() {
  
    $('#generated').focus();
    
    if($('#generated').val() != '')
      return true;
      
    var pk = new Array(32);
    rng_get_bytes(pk);
    var seed = Crypto.util.bytesToHex(pk.slice(0,16));
    //nb! electrum doesn't handle trailing zeros very well
    // and we want to stay compatible.
    if (seed.charAt(0) == '0') seed = seed.substr(1);
    var codes = mn_encode(seed);
    $('#generated').val(codes);
    
    return true;
  }
  
  // -- transactions --

  function txOnChangeSource() {
    var i = $('#txDropAddr option:selected').prop('index');
    $('#txSec').val(WALLET.getKeys()[i].getExportedPrivateKey());
    txDropGetUnspent();
  }

  function txSetUnspent(text) {
      if(text == '')
        return;
      var r = JSON.parse(text);
      txUnspent = JSON.stringify(r, null, 4);
      $('#txUnspent').val(txUnspent);
      var address = $('#txAddr').val();
      TX.parseInputs(txUnspent, address);
      var value = TX.getBalance();
      var fval = Bitcoin.Util.formatValue(value);
      //var fee = parseFloat($('#txFee').val());
      $('#txBalance').val(fval);
      //$('#txValue').val(fval - fee);
      //txRebuild();
  }

  function txUpdateUnspent() {
      txSetUnspent($('#txUnspent').val());
  }

  function txParseUnspent(text) {
      if (text == '')
          return;
      txSetUnspent(text);
  }

  function txDropGetUnspent() {
      var addr = WALLET.getKeys()[$('#txDropAddr').val()].getBitcoinAddress().toString();

      $('#txUnspent').val('');
      BLOCKCHAIN.getUnspentOutputs(addr, txParseUnspent);
  }

  function txOnChangeDest() {
  
    var res = txGetOutputs();
    var valid = true;
    
    for( i in res)
    {
      if(res[i].dest == '' || res[i].fval == 0)
      {
        valid = false;
        break;
      }  
      else 
      {
        try {
          parseBase58Check(res[i].dest);
        }
        catch (e) {
          valid = false;
          break;
        }
      }
    }
    
    if(valid)
      $('#txSend').removeAttr('disabled');
    else
      $('#txSend').attr('disabled','disabled');
  }

  function txOnAddDest() {
      var list = $(document).find('.txCC');
      var clone = list.last().clone();
      clone.find('.help-inline').empty();
      clone.find('.control-label').text('Cc');
      var dest = clone.find('#txDest');
      var value = clone.find('#txValue');
      clone.insertAfter(list.last());
      $(dest).change(txOnChangeDest);
      $(value).change(txOnChangeDest);
      dest.val('');
      value.val('');
      $('#txRemoveDest').attr('disabled', false);
      return false;
  }

  function txOnRemoveDest() {
      var list = $(document).find('.txCC');
      if (list.size() == 2)
          $('#txRemoveDest').attr('disabled', true);
      list.last().remove();
      return false;
  }

  function txSent(text) {
      alertModal(text ? text : 'No response!');
      
      WALLET.updateAllBalances();
  }
  
  function txVerify() {
    txRebuild();
  
    $('#verifySource').text(TX.getAddress());
    $('#verifyAmountTitle').text(TX.getSendBalance());
    $('#verifyTotal').text(TX.getSendBalance());
    
    $('#verifyTable').find("tr:gt(0)").remove();
    for(i = 0; i < TX.getOutputs().length; i++)
    {
      if(TX.getOutputs()[i].address != TX.getAddress())
      {
        $('#verifyTable').append('<tr><td><span class="label label-info">'
          + TX.getOutputs()[i].address
          + '</span></td><td><span><strong>'
          + TX.getOutputs()[i].value
          + '</strong> BTC</span></td></tr>');
      }
    }
    $('#verifyChange').remove();
    $('#tx-toggle').prepend('<p id="verifyChange"><span>' 
        + TX.getChange()
        + '</span> BTC will be returned to the sending address as change</p>');
  
    $('#verifyModal').modal();
  }

  function txSend() {
      var txAddr = $('#txDropAddr option:selected').text();
      var address = TX.getAddress();

      var r = '';
      if (txAddr != address)
          r += 'Warning! Source address does not match private key.\n\n';

      var tx = $('#txHex').val();
      
      BLOCKCHAIN.sendTX(tx, txSent);
      return true;
  }
  

  function txRebuild() {
      var sec = $('#txSec').val();
      var addr = $('#txDropAddr option:selected').text();
      var unspent = $('#txUnspent').val();
      var balance = parseFloat($('#txBalance').val());
      
      var fee = parseFloat('0'+$('#txFee').val());

      try {
          var res = parseBase58Check(sec); 
          var version = res[0];
          var payload = res[1];
      } catch (err) {
          $('#txJSON').val('');
          $('#txHex').val('');
          return;
      }

      var compressed = false;
      if (payload.length > 32) {
          payload.pop();
          compressed = true;
      }

      var eckey = new Bitcoin.ECKey(payload);

      eckey.setCompressed(compressed);

      TX.init(eckey);

      var fval = 0;
      var o = txGetOutputs();
      for (i in o) {
          TX.addOutput(o[i].dest, o[i].fval);
          fval += o[i].fval;
      }

      // send change back or it will be sent as fee
      if (balance > fval + fee) {
          var change = balance - fval - fee;
          TX.addOutput(addr, change);
      }

      try {
          var sendTx = TX.construct();
          var txJSON = TX.toBBE(sendTx);
          var buf = sendTx.serialize();
          var txHex = Crypto.util.bytesToHex(buf);
          $('#txJSON').val(txJSON);
          $('#txHex').val(txHex);
      } catch(err) {
          $('#txJSON').val('Error ' + err);
          $('#txHex').val('Error ' + err);
      }
  }

  function txGetOutputs() {
      var res = [];
      $.each($(document).find('.txCC'), function() {
          var dest = $(this).find('#txDest').val();
          var fval = parseFloat('0' + $(this).find('#txValue').val());
          res.push( {"dest":dest, "fval":fval } );
      });
      return res;
  }

  function parseBase58Check(address) {
      var bytes = Bitcoin.Base58.decode(address);
      var end = bytes.length - 4;
      var hash = bytes.slice(0, end);
      var checksum = Crypto.SHA256(Crypto.SHA256(hash, {asBytes: true}), {asBytes: true});
      if (checksum[0] != bytes[end] ||
          checksum[1] != bytes[end+1] ||
          checksum[2] != bytes[end+2] ||
          checksum[3] != bytes[end+3])
              throw new Error("Wrong checksum");
      var version = hash.shift();
      return [version, hash];
  }
});
