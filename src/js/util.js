function assert(condition, message) {
  if (!condition)
      throw message || "Assertion failed";
}

function qs(key) {
  //http://stackoverflow.com/a/7732379
  key = key.replace(/[*+?^$.\[\]{}()|\\\/]/g, "\\$&"); // escape RegEx meta chars
  var match = location.search.match(new RegExp("[?&]"+key+"=([^&]+)(&|$)"));
  return match && decodeURIComponent(match[1].replace(/\+/g, " "));
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

Array.prototype.contains = function(element){
    return this.indexOf(element) > -1;
};

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

function noExponents(n) {
  /* avoids floats resorting to scientific notation
   * adopted from: http://stackoverflow.com/a/16116500
   */
  var data= String(n).split(/[eE]/);
  if(data.length== 1) return data[0]; 

  var  z= '', sign= this<0? '-':'',
  str= data[0].replace('.', ''),
  mag= Number(data[1])+ 1;

  if(mag<0){
      z= sign + '0.';
      while(mag++) z += '0';
      return z + str.replace(/^\-/,'');
  }
  mag -= str.length;  
  while(mag--) z += '0';
  return str + z;
}
