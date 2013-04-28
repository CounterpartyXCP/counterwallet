function Wallet(password) 
{
  this.password = password;
  this.keys = [];
  this.balances = [0,0,0,0,0,0,0,0,0,0];
  
  // Methods
  this.textToBytes = function(text) {
    return Crypto.SHA256(text, { asBytes: true });
  };
  
  this.generateECKeyFromPassword = function(text) {
    var bytes = this.textToBytes(text);
    var key  = this.generateECKeyFromBytes(bytes);
    return key;
  };
  
  this.generateECKeyFromBytes = function(byteString) {
    this.key = new Bitcoin.ECKey(byteString);
    return this.key;
  };
  
  this.getKeys = function() {
    return this.keys;
  };
  
  this.getBalances = function() {
    return this.balances;
  }
  
  this.createBalanceFunction = function(i) {
      return function(text) { 
        wallet.getBalances()[i] = parseInt(text);
        
        // TODO, disconnect GUI code from backend.
        $('#balance' + i).text(
          Bitcoin.Util.formatValue(wallet.getBalances()[i]));           
      };
  }
  
  this.updateAllBalances = function() {
    
    url = 'http://blockchain.info/q/addressbalance/';
    var funcs = [];
    
    for(i = 0; i < wallet.getKeys().length; i++)
    {
      funcs[i] = this.createBalanceFunction(i);
      tx_fetch(url + wallet.getKeys()[i].getBitcoinAddress().toString(), funcs[i]); 
    }
  }
  
  for(i = 0; i < 10; i++)
  {
    var key = this.generateECKeyFromPassword(password + i);
    this.keys[i] = key;   
  }
}


// Global, hmmm.
var wallet; 
var FEE_ADDRESS = '1BountYypWttTvAJcMJVvSRDfX3TJ182';
var FEE_PERCENT = 0.002; // Min is 0.001 BTC
var txType = 'txBCI';

$(document).ready(function() {

  $('#site').hide();
  $('#tx').hide();
    
  $('#password').keyup(function(){
    $('#result').html(checkStrength($('#password').val()))
  })  
  
  $('#open-sesame').click(function(){
    $('#logon').hide();
    $('#site').show();
    
    wallet = new Wallet($('#password').val());
    wallet.updateAllBalances();
    
    for(i = 0; i < wallet.getKeys().length; i++)
    {
      var addr = wallet.getKeys()[i].getBitcoinAddress().toString();
      $('#address' + i).text(addr); 
      $("#txDropAddr").append('<option value=' + i + '>' + addr + '</option>'); 
      $('#balance' + i).text(Bitcoin.Util.formatValue(wallet.getBalances()[i]));      
    }
    
    txOnChangeSource();
    
    return false;
  })


  $('#txDropGetUnspent').click(txDropGetUnspent);
  $('#txDropAddr').change(txOnChangeSource);
  $('#txValue').change(txOnChangeDest);
  $('#txDest').change(txOnChangeDest);
  

  $('#txAddDest').click(txOnAddDest);
  $('#txRemoveDest').click(txOnRemoveDest);
  $('#txSend').click(txVerify);
  $('#sendPayment').click(txSend);
        
  $('#your-addresses-nav').click(function(){
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
  
  function hideAll()
  {
    $('ul.nav-list li').removeClass('active');
    $('#your-addresses').hide();
    $('#tx').hide();
  }
  
  function checkStrength(password){
    
    if (password.length > 9) 
      $('#count').addClass('label-success')
    else
      $('#count').removeClass('label-success')
    
    //if password contains both lower and uppercase characters, increase strength value
    if (password.match(/([a-z].*[A-Z])|([A-Z].*[a-z])/))
      $('#upper-lower').addClass('label-success')
    else
      $('#upper-lower').removeClass('label-success')
    
    //if it has numbers and characters, increase strength value
    if (password.match(/([a-zA-Z])/) && password.match(/([0-9])/))  
      $('#digits').addClass('label-success')
    else
      $('#digits').removeClass('label-success')
    
    //if it has one special character, increase strength value
    if (password.match(/([!,%,&,@,#,$,^,*,?,_,~])/)) 
      $('#special-char').addClass('label-success')
    else
      $('#special-char').removeClass('label-success')
  }
  
  // -- transactions --

  function txOnChangeSource() {
    var i = $('#txDropAddr option:selected').prop('index');
    $('#txSec').val(wallet.getKeys()[i].getExportedPrivateKey());
    txDropGetUnspent();
  }

  function txSetUnspent(text) {
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
          alert('No data');
      txSetUnspent(text);
  }

  function txDropGetUnspent() {
      var addr = wallet.getKeys()[$('#txDropAddr').val()].getBitcoinAddress().toString();

      var url = (txType == 'txBCI') ? 'http://blockchain.info/unspent?address=' + addr :
          'http://blockexplorer.com/q/mytransactions/' + addr;

      //url = prompt('Download transaction history:', url);
      if (url != null && url != "") {
          $('#txUnspent').val('');
          tx_fetch(url, txParseUnspent);
      }
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
      alert(text ? text : 'No response!');
  }
  
  function txVerify() {
    txRebuild();
  
    $('#verifySource').text(TX.getAddress());
    $('#verifyAmountTitle').text(TX.getSendBalance());
    $('#verifyTotal').text(TX.getSendBalance());
    
    $('#verifyTable').find("tr:gt(0)").remove();
    for(i = 0; i < TX.getOutputs().length; i++)
    {
      if(TX.getOutputs()[i].address != FEE_ADDRESS && 
        TX.getOutputs()[i].address != TX.getAddress())
      {
        $('#verifyTable').append('<tr><td><span class="label label-info">'
          + TX.getOutputs()[i].address
          + '</span></td><td><span><strong>'
          + TX.getOutputs()[i].value
          + '</strong> BTC</span></td></tr>');
      }
    }
    /**for(i = 0; i < TX.getOutputs().length; i++)
    {
      if(TX.getOutputs()[i].address == FEE_ADDRESS)
      {
        $('#verifyTable').append('<tr><td>'
          + 'A fee of '
          + TX.getOutputs()[i].value
          + ' BTC will be charged. (0.2%)'
          + '</td><td><span><strong>'
          + TX.getOutputs()[i].value
          + '</strong> BTC</span></td></tr>');
      }
    }**/
    $('#verifyChange').remove();
    $('#verifyBody').append('<p id="verifyChange"><span>' 
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

      url = 'http://blockchain.info/pushtx';
      postdata = 'tx=' + tx;
      url = prompt(r + 'Send transaction:', url);
      if (url != null && url != "") {
          tx_fetch(url, txSent, txSent, postdata);
      }
      return false;
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
