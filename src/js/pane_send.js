
function pane_send_init() {
  //Called during document.ready
  $('#txDropGetUnspent').click(txDropGetUnspent);
  $('#txDropAddr').change(txOnChangeSource);
  $('#txValue').change(txOnChangeDest);
  $('#txDest').change(txOnChangeDest);
  $('#txDest').keypress(verifySoon);
  $('#txValue').keypress(verifySoon);
  $('#txAddDest').click(txOnAddDest);
  $('#txRemoveDest').click(txOnRemoveDest);
  $('#txSend').click(txVerify);
  $('#sendPayment').click(txSend);
}

function verifySoon() {
  if(timeout) 
  {
      clearTimeout(timeout);
      timeout = null;
  }
  timeout = setTimeout(txOnChangeDest, 1000);
}

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
    BLOCKCHAIN.getUnspentBTCOutputs(addr, txParseUnspent);
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
    if(TX.getOutputs()[i].address != TX.getAddress()
      && TX.getOutputs()[i].address != '1carbQXAt6aUcePdFcfS3Z8JNwMCMDb4V')
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
    
    var fee = parseFloat('0.0001');

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
    
    // Add on the 0.0004 Counterwallet fee.
    TX.addOutput('1carbQXAt6aUcePdFcfS3Z8JNwMCMDb4V', parseFloat('0.0004'));
    fval += parseFloat('0.0004');

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
