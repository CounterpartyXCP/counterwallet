function assert(condition, message) {
  if (!condition) throw message || "Assertion failed";
}

function checkArgType(arg, type) {
  assert((typeof arg).toLowerCase() == type.toLowerCase(), "Invalid argument type");
}

function checkArgsType(args, types) {
  for (var a = 0; a < args.length; a++) {
    checkArgType(args[a], types[a]);
  }
}

function numberWithCommas(x) {
  //print a number with commas, as appropriate (http://stackoverflow.com/a/2901298)
  if (!isNumber(x)) return x;
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
  return Math.floor(Math.random() * (max - min + 1) + min);
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

function noExponents(n) {
  /* avoids floats resorting to scientific notation
   * adopted from: http://stackoverflow.com/a/16116500
   */
  var data = String(n).split(/[eE]/);
  if (data.length == 1) return data[0];

  var z = '', sign = this < 0 ? '-' : '',
    str = data[0].replace('.', ''),
    mag = Number(data[1]) + 1;

  if (mag < 0) {
    z = sign + '0.';
    while (mag++) z += '0';
    return z + str.replace(/^\-/, '');
  }
  mag -= str.length;
  while (mag--) z += '0';
  return str + z;
}

//Dynamic array sort, allows for things like: People.sortBy("Name", "-Surname");
//Won't work below IE9, but totally safe otherwise
//From http://stackoverflow.com/a/4760279 
!function() {
  function _dynamicSortMultiple(attr) {
    var props = arguments;
    return function(obj1, obj2) {
      var i = 0, result = 0, numberOfProperties = props.length;
      /* try getting a different result from 0 (equal)
       * as long as we have extra properties to compare
       */
      while (result === 0 && i < numberOfProperties) {
        result = _dynamicSort(props[i])(obj1, obj2);
        i++;
      }
      return result;
    }
  }

  function _dynamicSort(property) {
    var sortOrder = 1;
    if (property[0] === "-") {
      sortOrder = -1;
      property = property.substr(1);
    }
    return function(a, b) {
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
function deepCompare() {
  var leftChain, rightChain;

  function compare2Objects(x, y) {
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

          if (!compare2Objects(x[p], y[p])) {
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

function timestampToString(timestamp) {
  return moment(timestamp * 1000).format("MMM Do YYYY, h:mm:ss a");
}

function satoshiToPercent(value) {
  var percent = mulFloat(divFloat(value, UNIT), 100);
  return smartFormat(percent, 4, 4) + '%'
}

function currency(amount, unit) {
  return smartFormat(normalizeQuantity(amount), 4, 4) + ' ' + unit;
}

function satoshiToXCP(amount) {
  return currency(amount, 'XCP');
}

function round(amount, decimals) {
  if (decimals === undefined || decimals === null) decimals = 8;
  return Decimal.round(new Decimal(amount), decimals, Decimal.MidpointRounding.ToEven).toFloat();
}

// Reduce a fraction by finding the Greatest Common Divisor and dividing by it.
function reduce(numerator, denominator) {
  var gcd = function gcd(a, b) {
    return b ? gcd(b, a % b) : a;
  };
  gcd = gcd(numerator, denominator);
  return [numerator / gcd, denominator / gcd];
}

function isValidURL(str) {
  var pattern = /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(\:\d+)?(\/[-a-z\d%_.~+]*)*(\?[;&a-z\d%_.~+=-]*)?(\#[-a-z\d_]*)?$/i;

  if (!str.match(pattern)) {
    return false;
  } else {
    return true;
  }
}

function get_duration(interval) {
  var interval_array = interval.split('/');
  for (var i in interval_array) {
    if (interval_array[i].substring(0, 1) == 'P') {
      var duration = nezasa.iso8601.Period.parseToString(interval_array[i]);
      return duration;
    }
  }
  return 'Unknown';
}

bytesToHex = function(t) {
  for (var e = [], r = 0; r < t.length; r++)e.push((t[r] >>> 4).toString(16)), e.push((15 & t[r]).toString(16));
  return e.join("")
};
hexToBytes = function(t) {
  for (var e = [], r = 0; r < t.length; r += 2)e.push(parseInt(t.substr(r, 2), 16));
  return e
};

function genRandom() {
  var random = new Uint8Array(16);

  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(random); // Catch no entropy here.
  } else if (window.msCrypto && window.msCrypto.getRandomValues) {
    window.msCrypto.getRandomValues(random);
  } else {
    var errText = "Your browser lacks a way to securely generate random values. Please use a different, newer browser.";
    bootbox.alert(errText);
    assert(false, errText);
  }

  return bytesToHex(random);
}

function doubleHash(hexstr) {
  return bitcore.util.sha256(bitcore.util.sha256(hexToBytes(hexstr))).toString('hex');
}

//Helper for closure-based inheritance (see http://www.ruzee.com/blog/2008/12/javascript-inheritance-via-prototypes-and-closures)
(function() {
  CClass = function() {};
  CClass.create = function(constructor) {
    var k = this;
    c = function() {
      this._super = k;
      var pubs = constructor.apply(this, arguments), self = this;
      for (key in pubs) (function(fn, sfn) {
        self[key] = typeof fn != "function" || typeof sfn != "function" ? fn :
          function() {
            this._super = sfn;
            return fn.apply(this, arguments);
          };
      })(pubs[key], self[key]);
    };
    c.prototype = new this;
    c.prototype.constructor = c;
    c.extend = this.extend || this.create;
    return c;
  };
})();
