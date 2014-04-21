
/*
 * STRING PROTOTYPES
 */
if (typeof String.prototype.startsWith != 'function') {
  // see below for better implementation!
  String.prototype.startsWith = function (str){
    return this.indexOf(str) == 0;
  };
}

if (typeof String.prototype.endsWith != 'function') {
  String.prototype.endsWith = function(suffix) {
      return this.indexOf(suffix, this.length - suffix.length) !== -1;
  };
}

if (typeof String.prototype.stripTags != 'function') {
  String.prototype.stripTags = function(element){
      return this.replace(/(<([^>]+)>)/ig,"");
  };
}


/*
 * ARRAY PROTOTYPES
 */
if (typeof Array.prototype.last != 'function') {
    Array.prototype.last = function(){
        return this[this.length - 1];
    };
};

if (typeof Array.prototype.contains != 'function') {
  Array.prototype.contains = function(element){
      return this.indexOf(element) > -1;
  };
}

if (typeof Array.prototype.remove != 'function') {
  Array.prototype.remove = function() { //http://stackoverflow.com/a/3955096
      var what, a = arguments, L = a.length, ax;
      while (L && this.length) {
          what = a[--L];
          while ((ax = this.indexOf(what)) !== -1) {
              this.splice(ax, 1);
          }
      }
      return this;
  };
}

if (typeof Array.prototype.unique != 'function') {
  Array.prototype.unique = function() { //modified from http://stackoverflow.com/a/9229821
      var prim = {"boolean":{}, "number":{}, "string":{}}, obj = [];
  
      return this.filter(function(x) {
          var t = typeof x;
          return (t in prim) ? 
              !prim[t][x] && (prim[t][x] = 1) :
              obj.indexOf(x) < 0 && obj.push(x);
      });
  }
}


/*
 * OTHER METHODS
 */
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

function randomIntFromInterval(min, max) {
    return Math.floor(Math.random()*(max-min+1)+min);
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

//Dynamic array sort, allows for things like: People.sortBy("Name", "-Surname");
//Won't work below IE9, but totally safe otherwise
//From http://stackoverflow.com/a/4760279 
!function() {
    function _dynamicSortMultiple(attr) {
      var props = arguments;
      return function (obj1, obj2) {
          var i = 0, result = 0, numberOfProperties = props.length;
          /* try getting a different result from 0 (equal)
           * as long as we have extra properties to compare
           */
          while(result === 0 && i < numberOfProperties) {
              result = _dynamicSort(props[i])(obj1, obj2);
              i++;
          }
          return result;
      }      
    }
    function _dynamicSort(property) {
      var sortOrder = 1;
      if(property[0] === "-") {
          sortOrder = -1;
          property = property.substr(1);
      }
      return function (a,b) {
          var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
          return result * sortOrder;
      }
    }
    Object.defineProperty(Array.prototype, "sortBy", {
        enumerable: false,
        writable: true,
        value: function() {
            return this.sort(_dynamicSortMultiple.apply(null, arguments));
        }
    });
}();

//Local storage helper functions
//http://stackoverflow.com/a/3146971
//Usage: var userObject = {userId: 24, name: 'Jack Bauer'}; localStorage.setObject('user', userObject); userObject = localStorage.getObject('user');
Storage.prototype.setObject = function(key, value) {
    this.setItem(key, JSON.stringify(value));
}
Storage.prototype.getObject = function(key) {
    var value = this.getItem(key);
    return value && JSON.parse(value);
}

//Object comparison -- From http://stackoverflow.com/a/1144249
function deepCompare () {
  var leftChain, rightChain;

  function compare2Objects (x, y) {
    var p;

    // remember that NaN === NaN returns false
    // and isNaN(undefined) returns true
    if (isNaN(x) && isNaN(y) && typeof x === 'number' && typeof y === 'number') {
         return true;
    }

    // Compare primitives and functions.     
    // Check if both arguments link to the same object.
    // Especially useful on step when comparing prototypes
    if (x === y) {
        return true;
    }

    // Works in case when functions are created in constructor.
    // Comparing dates is a common scenario. Another built-ins?
    // We can even handle functions passed across iframes
    if ((typeof x === 'function' && typeof y === 'function') ||
       (x instanceof Date && y instanceof Date) ||
       (x instanceof RegExp && y instanceof RegExp) ||
       (x instanceof String && y instanceof String) ||
       (x instanceof Number && y instanceof Number)) {
        return x.toString() === y.toString();
    }
    // At last checking prototypes as good a we can
    if (!(x instanceof Object && y instanceof Object)) {
        return false;
    }
    if (x.isPrototypeOf(y) || y.isPrototypeOf(x)) {
        return false;
    }
    if (x.constructor !== y.constructor) {
        return false;
    }
    if (x.prototype !== y.prototype) {
        return false;
    }
    // check for infinitive linking loops
    if (leftChain.indexOf(x) > -1 || rightChain.indexOf(y) > -1) {
         return false;
    }

    // Quick checking of one object beeing a subset of another.
    // todo: cache the structure of arguments[0] for performance
    for (p in y) {
        if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
            return false;
        }
        else if (typeof y[p] !== typeof x[p]) {
            return false;
        }
    }
    for (p in x) {
        if (y.hasOwnProperty(p) !== x.hasOwnProperty(p)) {
            return false;
        }
        else if (typeof y[p] !== typeof x[p]) {
            return false;
        }
        switch (typeof (x[p])) {
            case 'object':
            case 'function':

                leftChain.push(x);
                rightChain.push(y);

                if (!compare2Objects (x[p], y[p])) {
                    return false;
                }

                leftChain.pop();
                rightChain.pop();
                break;

            default:
                if (x[p] !== y[p]) {
                    return false;
                }
                break;
        }
    }
    return true;
  }
  if (arguments.length < 1) {
    return true; //Die silently? Don't know how to handle such case, please help...
    // throw "Need two or more arguments to compare";
  }
  for (var i = 1, l = arguments.length; i < l; i++) {

      leftChain = []; //todo: this can be cached
      rightChain = [];

      if (!compare2Objects(arguments[0], arguments[i])) {
          return false;
      }
  }
  return true;
}


//Helper for closure-based inheritance (see http://www.ruzee.com/blog/2008/12/javascript-inheritance-via-prototypes-and-closures)
(function(){
  CClass = function(){};
  CClass.create = function(constructor) {
    var k = this;
    c = function() {
      this._super = k;
      var pubs = constructor.apply(this, arguments), self = this;
      for (key in pubs) (function(fn, sfn) {
        self[key] = typeof fn != "function" || typeof sfn != "function" ? fn :
          function() { this._super = sfn; return fn.apply(this, arguments); };
      })(pubs[key], self[key]);
    }; 
    c.prototype = new this;
    c.prototype.constructor = c;
    c.extend = this.extend || this.create;
    return c;
  };
})();
