function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

function makeQRCode(addr) {
  var qr = qrcode(3, 'M');
  addr = addr.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
  qr.addData(addr);
  qr.make();
  return qr.createImgTag(4);
}

function numberWithCommas(x) {
  if(x === undefined || x === null) return x;
  //print a number with commas, as appropriate (http://stackoverflow.com/a/2901298)
  var parts = x.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

function isNumber(n) {
  //http://stackoverflow.com/a/1830844
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function numberHasDecimalPlace(n) {
  return n % 1 != 0;
}

function byteCount(s) {
  /*http://stackoverflow.com/a/12203648*/
  return encodeURI(s).split(/%..|./).length - 1;
}

if (!Array.prototype.last){
    Array.prototype.last = function(){
        return this[this.length - 1];
    };
};

if (typeof String.prototype.startsWith != 'function') {
  // see below for better implementation!
  String.prototype.startsWith = function (str){
    return this.indexOf(str) == 0;
  };
}

function selectText(element) {
    var doc = document
        , text = doc.getElementById(element)
        , range, selection
    ;    
    if (doc.body.createTextRange) { //ms
        range = doc.body.createTextRange();
        range.moveToElementText(text);
        range.select();
    } else if (window.getSelection) { //all others
        selection = window.getSelection();        
        range = doc.createRange();
        range.selectNodeContents(text);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

function shuffle(array) {
  //http://stackoverflow.com/a/2450976
  var currentIndex = array.length
    , temporaryValue
    , randomIndex
    ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}
