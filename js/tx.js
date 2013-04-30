/*
    tx.js - Bitcoin transactions for JavaScript (public domain)

    Obtaining inputs:
    1) http://blockchain.info/unspent?address=<address>
    2) http://blockexplorer.com/q/mytransactions/<address>

    Sending transactions:
    1) http://bitsend.rowit.co.uk
    2) http://www.blockchain.info/pushtx
*/

var TX = new function () {

    var inputs = [];
    var outputs = [];
    var eckey = null;
    var balance = 0;

    this.init = function(_eckey) {
        outputs = [];
        eckey = _eckey;
    }

    this.addOutput = function(addr, fval) {
        outputs.push({address: addr, value: fval});
    }

    this.getOutputs = function() {
        return outputs;
    }

    this.getBalance = function() {
        return balance;
    }

    this.getSendBalance = function() {
      value = 0.0
      for (var i in outputs) {
          if(outputs[i].address == this.getAddress())
            continue;
            
          var fval = outputs[i].value;
          value += fval;
      }
      value += 0.0005;
      return value.toFixed(4);
    }

    this.getChange = function() {
      value = 0.0
      for (var i in outputs) {
          if(outputs[i].address != this.getAddress())
            continue;
            
          var fval = outputs[i].value;
          value += fval;
      }
      return value.toFixed(4);
    }

    this.getAddress = function() {
        return eckey.getBitcoinAddress().toString();
    }

    this.parseInputs = function(text, address) {
        try {
            var res = tx_parseBCI(text, address);
        } catch(err) {
            var res = { "balance":"0" };
        }

        balance = res.balance;
        inputs = res.unspenttxs;
    }

    this.construct = function() {
        var sendTx = new Bitcoin.Transaction();
        var selectedOuts = [];
        for (var hash in inputs) {
            if (!inputs.hasOwnProperty(hash))
                continue;
            for (var index in inputs[hash]) {
                if (!inputs[hash].hasOwnProperty(index))
                    continue;
                var script = parseScript(inputs[hash][index].script);
                var b64hash = Crypto.util.bytesToBase64(Crypto.util.hexToBytes(hash));
                var txin = new Bitcoin.TransactionIn({outpoint: {hash: b64hash, index: index}, script: script, sequence: 4294967295});
                selectedOuts.push(txin);
                sendTx.addInput(txin);
            }
        }

        for (var i in outputs) {
            var address = outputs[i].address;
            var fval = outputs[i].value;
            var value = new BigInteger('' + Math.round(fval * 1e8), 10);
            sendTx.addOutput(new Bitcoin.Address(address), value);
        }

        var hashType = 1;
        for (var i = 0; i < sendTx.ins.length; i++) {
            var connectedScript = selectedOuts[i].script;
            var hash = sendTx.hashTransactionForSignature(connectedScript, i, hashType);
            var pubKeyHash = connectedScript.simpleOutPubKeyHash();
            var signature = eckey.sign(hash);
            signature.push(parseInt(hashType, 10));
            var pubKey = eckey.getPub();
            var script = new Bitcoin.Script();
            script.writeBytes(signature);
            script.writeBytes(pubKey);
            sendTx.ins[i].script = script;
        }
        return sendTx;
    };

    function uint(f, size) {
        if (f.length < size)
            return 0;
        var bytes = f.slice(0, size);
        var pos = 1;
        var n = 0;
        for (var i = 0; i < size; i++) { 
            var b = f.shift();
            n += b * pos;
            pos *= 256;
        }
        return size <= 4 ? n : bytes;
    }

    function u8(f)  { return uint(f,1); }
    function u16(f) { return uint(f,2); }
    function u32(f) { return uint(f,4); }
    function u64(f) { return uint(f,8); }

    function errv(val) {
        return (val instanceof BigInteger || val > 0xffff);
    }

    function readBuffer(f, size) {
        var res = f.slice(0, size);
        for (var i = 0; i < size; i++) f.shift();
        return res;
    }

    function readString(f) {
        var len = readVarInt(f);
        if (errv(len)) return [];
        return readBuffer(f, len);
    }

    function readVarInt(f) {
        var t = u8(f);
        if (t == 0xfd) return u16(f); else
        if (t == 0xfe) return u32(f); else
        if (t == 0xff) return u64(f); else
        return t;
    }
    
    this.toBBE = function(sendTx) {
        //serialize to Bitcoin Block Explorer format
        var buf = sendTx.serialize();
        var hash = Crypto.SHA256(Crypto.SHA256(buf, {asBytes: true}), {asBytes: true});

        var r = {};
        r['hash'] = Crypto.util.bytesToHex(hash.reverse());
        r['ver'] = sendTx.version;
        r['vin_sz'] = sendTx.ins.length;
        r['vout_sz'] = sendTx.outs.length;
        r['lock_time'] = sendTx.lock_time;
        r['size'] = buf.length;
        r['in'] = []
        r['out'] = []

        for (var i = 0; i < sendTx.ins.length; i++) {
            var txin = sendTx.ins[i];
            var hash = Crypto.util.base64ToBytes(txin.outpoint.hash);
            var n = txin.outpoint.index;
            var prev_out = {'hash': Crypto.util.bytesToHex(hash.reverse()), 'n': n};

            if (n == 4294967295) {
                var cb = Crypto.util.bytesToHex(txin.script.buffer);
                r['in'].push({'prev_out': prev_out, 'coinbase' : cb});
            } else {
                var ss = dumpScript(txin.script);
                r['in'].push({'prev_out': prev_out, 'scriptSig' : ss});
            }
        }

        for (var i = 0; i < sendTx.outs.length; i++) {
            var txout = sendTx.outs[i];
            var bytes = txout.value.slice(0);
            var fval = parseFloat(Bitcoin.Util.formatValue(bytes.reverse()));
            var value = fval.toFixed(8);
            var spk = dumpScript(txout.script);
            r['out'].push({'value' : value, 'scriptPubKey': spk});
        }

        return JSON.stringify(r, null, 4);
    };

    this.deserialize = function(bytes) {
        var sendTx = new Bitcoin.Transaction();

        var f = bytes.slice(0);
        var tx_ver = u32(f);
        var vin_sz = readVarInt(f);
        if (errv(vin_sz))
            return null;

        for (var i = 0; i < vin_sz; i++) {
            var op = readBuffer(f, 32);
            var n = u32(f);
            var script = readString(f);
            var seq = u32(f);
            var txin = new Bitcoin.TransactionIn({
                outpoint: { 
                    hash: Crypto.util.bytesToBase64(op),
                    index: n
                },
                script: new Bitcoin.Script(script),
                sequence: seq
            });
            sendTx.addInput(txin);
        }

        var vout_sz = readVarInt(f);

        if (errv(vout_sz))
            return null;

        for (var i = 0; i < vout_sz; i++) {
            var value = u64(f);
            var script = readString(f);

            var txout = new Bitcoin.TransactionOut({
                value: value,
                script: new Bitcoin.Script(script)
            });

            sendTx.addOutput(txout);
        }
        var lock_time = u32(f);
        sendTx.lock_time = lock_time;
        return sendTx;
    };

    return this;
};

function dumpScript(script) {
    var out = [];
    for (var i = 0; i < script.chunks.length; i++) {
        var chunk = script.chunks[i];
        var op = new Bitcoin.Opcode(chunk);
        typeof chunk == 'number' ?  out.push(op.toString()) :
            out.push(Crypto.util.bytesToHex(chunk));
    }
    return out.join(' ');
}

// blockchain.info parser (adapted)
// uses http://blockchain.info/unspent?address=<address>
function tx_parseBCI(data, address) {
    var r = JSON.parse(data);
    var txs = r.unspent_outputs;

    if (!txs)
        throw 'Not a BCI format';

    delete unspenttxs;
    var unspenttxs = {};
    var balance = BigInteger.ZERO;
    for (var i in txs) {
        var o = txs[i];
        var lilendHash = o.tx_hash;

        //convert script back to BBE-compatible text
        var script = dumpScript( new Bitcoin.Script(Crypto.util.hexToBytes(o.script)) );

        var value = new BigInteger('' + o.value, 10);
        if (!(lilendHash in unspenttxs))
            unspenttxs[lilendHash] = {};
        unspenttxs[lilendHash][o.tx_output_n] = {amount: value, script: script};
        balance = balance.add(value);
    }
    return {balance:balance, unspenttxs:unspenttxs};
}

function isEmpty(ob) {
    for(var i in ob){ if(ob.hasOwnProperty(i)){return false;}}
    return true;
}

function endian(string) {
    var out = []
    for(var i = string.length; i > 0; i-=2) {
        out.push(string.substring(i-2,i));
    }
    return out.join("");
}

function btcstr2bignum(btc) {
    var i = btc.indexOf('.');
    var value = new BigInteger(btc.replace(/\./,''));
    var diff = 9 - (btc.length - i);
    if (i == -1) {
        var mul = "100000000";
    } else if (diff < 0) {
        return value.divide(new BigInteger(Math.pow(10,-1*diff).toString()));
    } else {
        var mul = Math.pow(10,diff).toString();
    }
    return value.multiply(new BigInteger(mul));
}

function parseScript(script) {
    var newScript = new Bitcoin.Script();
    var s = script.split(" ");
    for (var i in s) {
        if (Bitcoin.Opcode.map.hasOwnProperty(s[i])){
            newScript.writeOp(Bitcoin.Opcode.map[s[i]]);
        } else {
            newScript.writeBytes(Crypto.util.hexToBytes(s[i]));
        }
    }
    return newScript;
}
// --->8---

// Some cross-domain magic (to bypass Access-Control-Allow-Origin)
function tx_fetch(url, onSuccess, onError, postdata) {
    var useYQL = true;

    if (useYQL) {
        var q = 'select * from html where url="'+url+'"';
        if (postdata) {
            q = 'use "http://brainwallet.github.com/js/htmlpost.xml" as htmlpost; ';
            q += 'select * from htmlpost where url="' + url + '" ';
            q += 'and postdata="' + postdata + '" and xpath="//p"';
        }
        url = 'https://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(q);
    }

    $.ajax({
        url: url,
        success: function(res) {
            onSuccess(useYQL ? $(res).find('results').text() : res.responseText);
        },
        error:function (xhr, opt, err) {
            if (onError)
                onError(err);
        }
    });
}
