// Decimal.js
// FROM: https://github.com/hiroshi-manabe/JSDecimal/blob/master/lib/decimal.js
// A class for handling decimal numbers with JavaScript.
//
// License: MIT (see LICENCE.md)
//
// Instance methods:
//
// Constructor(v) [v: String/Number/Decimal]
// add(another)
// sub(another)
// mul(another)
// div(another)
// compare(another)
// isZero()
// toString()
// toFloat()
//
// Class method:
//
// round(obj, digits, mode)
//
// Sample:
//
// var a = new Decimal(0.1);
// var b = a.mul(0.2);  // b <- 0.02
// var c = b.sub(0.3);  // c <- -0.28
// var d = c.div(0.4);  // d <- -0.7
// var str = d.toString();  // str <- "0.7"
// var num = d.toFloat();  // num <- 0.7
//

(function() {
    var ROOT = this;
    
    var Decimal = function(v) {
  if (this.constructor != Decimal)  {
      return new Decimal(v);
  }
  if (!v) {
      this.sig = Array(Decimal.n);
      for (var i = 0; i < Decimal.n; ++i) {
    this.sig[i] = 0;
      }
      this.exp = 0;
      this.is_minus = false;
      return;
  }

  if (v instanceof Decimal) {
      this.sig = v.sig.slice();
      this.exp = v.exp;
      this.is_minus = v.is_minus;
      return;
  }

  var v_str = "";
  if (v instanceof String) {
      v_str = v;
  } else {
      v_str = v.toString();
  }

  this.is_minus = false;

  var ch = v_str.charAt(0);
  if (ch == "+" || ch == "-") {
      this.is_minus = (ch == "-");
      v_str = v_str.substring(1);
  }

  var exp = 0;
  var e_pos = v_str.indexOf("e");
  if (e_pos != -1) {
      exp = -parseInt(v_str.substring(e_pos + 1));
      v_str = v_str.substring(0, e_pos);
  }

  var point_pos = v_str.indexOf(".");
  if (point_pos != -1) {
      v_str = v_str.substring(0, point_pos) +
    v_str.substring(point_pos + 1, v_str.length);
      exp += v_str.length - point_pos;
  }
  v_str = v_str.replace(/^0+/, "");

  var back_zero_count = Decimal.decimal_digits -
        (v_str.length > exp ? v_str.length : exp);

  if (back_zero_count > 0) {
      for (var i = 0; i < back_zero_count; ++i) {
    v_str += "0";
      }
      exp += back_zero_count;
  }
    
  if (v_str.length < Decimal.decimal_digits) {
      var tmp = "";
      for (var i = 0; i < (Decimal.decimal_digits - v_str.length); ++i) {
    tmp += "0";
      }
      v_str = tmp + v_str;
  }

  this.exp = exp;
  if (exp < -1) {
      throw new Decimal.OverflowError();
  }

  this.sig = Array();
  for (var i = 0; i < Decimal.n; ++i) {
      this.sig.unshift(parseFloat(v_str.substring(i *  Decimal.decimal_digits_per_word, (i + 1) * Decimal.decimal_digits_per_word)));
  }

  if (this.isZero()) {
      this.is_minus = false;
  }
    }

    Decimal.pow = function(n, m) {
  var ret = 1;
  for (var i = 0; i < m; ++i) {
      ret *= n;
  }
  return ret;
    };

    Decimal.MidpointRounding = {
  AwayFromZero : 0,
  ToEven : 1
    };

    Decimal.word_base = 16;
    Decimal.decimal_digits_per_word = 7;
    Decimal.n = 4;
    Decimal.decimal_digits = Decimal.decimal_digits_per_word * Decimal.n;
    Decimal.one_word = Decimal.pow(10.0, Decimal.decimal_digits_per_word);
    Decimal.two_words = Decimal.pow(10.0, (Decimal.decimal_digits_per_word * 2));

    Decimal.OverflowError = function() {
  this.message = "OverflowError";
    };

    Decimal.ZeroDivisionError = function() {
  this.message = "ZeroDivisionError";
    };

    Decimal.initConstants = function() {
  var tmp = "\\d{";
  tmp += Decimal.decimal_digits_per_word;
  tmp += "}$";
  Decimal.regexp_digits = new RegExp(tmp);
  Decimal.one_word_zeros = "";
  for (var i = 0; i < Decimal.decimal_digits_per_word - 1; ++i) {
      Decimal.one_word_zeros += "0";
  }
  Decimal.zeros = "";
  for (var i = 0; i < Decimal.decimal_digits - 1; ++i) {
      Decimal.zeros += "0";
  }
  Decimal.constants_initialized = true;
    }

    Decimal.prototype.toString = function() {
  if (this.isZero()) {
      return "0";
  }
    
  if (!Decimal.constants_initialized) {
      Decimal.initConstants();
  }

  var str_sig = "";
  for (var i = Decimal.n - 1; i >= 0; --i) {
      (Decimal.zeros + this.sig[i]).match(Decimal.regexp_digits);
      str_sig += RegExp.lastMatch;
  }

  if (this.exp > 0) {
      str_sig = str_sig.substring(0, Decimal.decimal_digits - this.exp) +
            "." + str_sig.substring(Decimal.decimal_digits - this.exp);
      str_sig = str_sig.replace(/\.?0+$/, "");
  }
  str_sig = str_sig.replace(/^0+/, "");

  if (str_sig.charAt(0) == ".") {
      str_sig = "0" + str_sig;
  }

  if (this.exp == -1) {
      str_sig += "0";
  }
    
  return (this.is_minus ? "-" : "") + str_sig;
    };

    Decimal.prototype.toFloat = function() {
  return parseFloat(this.toString());
    };

    Decimal.fromData = function(sig, exp, is_minus) {
  var obj = new Decimal();
  var orig_len = sig.length;
  var valid_num = Decimal.countValidNum(sig);

  obj.exp = (exp < valid_num ? Decimal.decimal_digits + exp - valid_num :
       Decimal.decimal_digits);

  obj.is_minus = is_minus;

  if (obj.exp < -1) {
      throw new Decimal.OverflowError();
  }
           
  var word_diff = Math.floor((exp - obj.exp + Decimal.decimal_digits) /
           Decimal.decimal_digits_per_word) - Decimal.n;
  var digit_diff = exp - obj.exp - (word_diff *
            Decimal.decimal_digits_per_word);

  var to_div = Decimal.pow(10, digit_diff);
  var to_mul = Decimal.pow(10, (Decimal.decimal_digits_per_word -
              digit_diff));

  for (var i = 0; i < Decimal.n; ++i) {
      var j = i + word_diff;
      if (j >= 0 && j < orig_len) {
    obj.sig[i] = Math.floor(sig[j] / to_div);
      }
      if (j + 1 >= 0 && j + 1 < orig_len) {
    obj.sig[i] += (sig[j + 1] * to_mul) % Decimal.one_word;
      }
  }
  if (exp > obj.exp) {
      var zero_flag = true;
      for (var i = 0; i < word_diff + 1; ++i) {
    if (i < word_diff) {
        if (i && sig[i - 1]) {
      zero_flag = false;
        }
    } else {
        var last = (sig[i] * to_mul) % Decimal.one_word;
        if (i > 0) {
      last += Math.floor(sig[i - 1] / to_div);
      if (sig[i-1] % to_div) {
          zero_flag = false;
      }
        }
        if (last > Decimal.one_word / 2) {
      obj.sig[0] += 1;
        } else if (last == Decimal.one_word / 2 ) {
      if (!zero_flag || obj.sig[0] % 2) {
          obj.sig[0] += 1;
      }
        }
    }
      }
  }

  if (obj.isZero()) {
      obj.is_minus = false;
  }

  return obj;
    };

    Decimal.round = function(obj, digits, mode) {
  var ret = new Decimal(obj);
  var pos = obj.exp - digits;

  if (pos <= 0 || pos > Decimal.decimal_digits) {
      return;
  }

  var last_word_pos = Math.floor((pos - 1) / Decimal.decimal_digits_per_word);
  var last_digit_pos = (pos - 1) % Decimal.decimal_digits_per_word;
  var round_word_pos = Math.floor(pos / Decimal.decimal_digits_per_word);
  var round_digit_pos = pos % Decimal.decimal_digits_per_word;

  var tmp = Decimal.pow(10, round_digit_pos);
  var last_digit_is_even = (Math.floor(obj.sig[round_word_pos] / tmp) % 2 
          == 0);

  var round_up = false;
  var tmp2 = Decimal.pow(10, last_digit_pos + 1);
    
  var zero_flag = true;

  for (var i = 0; i < last_word_pos; ++i) {
      if (obj.sig[i]) {
    zero_flag = false;
    ret.sig[i] = 0;
      }
  }

  var last_num = obj.sig[last_word_pos] % tmp2;

  if (last_num > tmp2 / 2) {
      round_up = true;
  } else if (last_num == tmp2 / 2) {
      if (!zero_flag || !(last_digit_is_even &&
        mode == Decimal.MidpointRounding.ToEven)) {
    round_up = true;
      }
  }

  ret.sig[last_word_pos] -= ret.sig[last_word_pos] % tmp2;

  if (round_up) {
      // a lazy way (slow but convenient)
      ret = ret.add(new Decimal("1e-" + digits.toString()));
  }

  return ret;
    };

    Decimal.prototype.compare = function(another) {
  var this_sign = this.is_minus ? -1 : 1;
  if (this.is_minus != another.is_minus) {
      return this_sign;
  }
  return this.absCompare(another) * this_sign;
    };

    Decimal.prototype.absCompare = function(another) {
  var this_is_zero = this.isZero();
  var another_is_zero = another.isZero();
  if (this_is_zero && another_is_zero) {
      return 0;
  }
  if (this_is_zero != another_is_zero) {
      return another_is_zero - this_is_zero;
  }
  var exp_cmp = another.exp - this.exp;
  if (exp_cmp) {
      return exp_cmp;
  }
  for (var i = Decimal.n - 1; i >= 0; --i) {
      var sig_cmp = this.sig[i] - another.sig[i];
      if (sig_cmp) {
    return sig_cmp;
      }
  }
  return 0;
    };

    Decimal.prototype.absAddSub = function(smaller, is_sub) {
  if (smaller.isZero()) {
      return new Decimal(this);
  }

  var word_diff = Math.floor((smaller.exp - this.exp) /
           Decimal.decimal_digits_per_word);
  var mul = Decimal.pow(10, ((smaller.exp - this.exp) %
           Decimal.decimal_digits_per_word));
  var sign = is_sub ? -1 : 1;
  var carry = is_sub ? Decimal.one_word : 0;
  var adjustment = is_sub ? Decimal.two_words - Decimal.one_word : 0;

  var count = Decimal.n + word_diff + 1;
  var sig = Array(count);

  for (var i = 0; i < count; ++i) {
      sig[i] = carry + adjustment;

      if (i >= word_diff && i - word_diff < Decimal.n) {
    sig[i] += this.sig[i - word_diff] * mul;
      }

      if (i < Decimal.n) {
    sig[i] += smaller.sig[i] * sign;
      }

      carry = Math.floor(sig[i] / Decimal.one_word);
      sig[i] %= Decimal.one_word;
  }

  return Decimal.fromData(sig, smaller.exp, this.is_minus);
    };

    Decimal.countValidNum = function(sig) {
  for (var i = sig.length - 1; i >= 0; --i) {
      var n = Decimal.one_word;
      for (var j = Decimal.decimal_digits_per_word - 1; j >= 0; --j) {
    n /= 10;
    if (sig[i] >= n) {
        return i * Decimal.decimal_digits_per_word + j + 1;
    }
      }
  }

  return 1;
    };

    Decimal.prototype.validWords = function() {
  for (var i = this.sig.length - 1; i >= 0; --i) {
      if (this.sig[i]) {
    return i + 1;
      }
  }
  return 1;
    };

    Decimal.prototype.addSub = function(another, is_sub) {
  var another_decimal = (another instanceof Decimal ? another :
             new Decimal(another));
  var abs_smaller;
  var abs_larger;
  var ret_is_minus;

  if (this.absCompare(another_decimal) < 0) {
      abs_smaller = this;
      abs_larger = another_decimal;
      ret_is_minus = (another_decimal.is_minus != is_sub);
  } else {
      abs_smaller = another_decimal;
      abs_larger = this;
      ret_is_minus = this.is_minus;
  }

  var is_abs_sub = (abs_smaller.is_minus == abs_larger.is_minus) == is_sub;
  var ret = abs_larger.absAddSub(abs_smaller, is_abs_sub);

  ret.is_minus = ret_is_minus;

  return ret;
    };

    Decimal.prototype.add = function(another) {
  return this.addSub(another, false);
    };

    Decimal.prototype.sub = function(another) {
  return this.addSub(another, true);
    };

    Decimal.prototype.isZero = function() {
  for (var i = 0; i < Decimal.n; ++i) {
      if (this.sig[i]) {
    return false;
      }
  }
  return true;
    };

    Decimal.prototype.mul = function(another) {
  var another_decimal = (another instanceof Decimal ? another :
             new Decimal(another));

  if (this.isZero() || another_decimal.isZero()) {
      return Decimal(0);
  }

  var sig = Array(Decimal.n * 2);
  for (var i = 0; i < Decimal.n * 2; ++i) {
      sig[i] = 0;
  }

  for (var i = 0; i < Decimal.n; ++i) {
      for (var j = 0; j < Decimal.n; ++j) {
    var result = sig[i + j] + this.sig[i] * another_decimal.sig[j];
    sig[i + j] = result % Decimal.one_word
    sig[i + j + 1] += Math.floor(result / Decimal.one_word);
      }
  }
  var is_minus = (this.is_minus != another_decimal.is_minus);
  return Decimal.fromData(sig, this.exp + another_decimal.exp, is_minus);
    };

    Decimal.prototype.div = function(another) {
  var another_decimal = (another instanceof Decimal ? another :
             new Decimal(another));

  if (another_decimal.isZero()) {
      throw new ZeroDivisionError();
  }

  var added = Decimal.n * 2;
  var this_sig = Array(added);
  for (var i = 0; i < added; ++i) {
      this_sig[i] = 0;
  }
  this_sig = this_sig.concat(this.sig);

  var this_v = this.validWords() + added;
  var another_v = another_decimal.validWords();
  var another_exp = another_decimal.exp;

  var another_sig = another_decimal.sig.slice();
  if (another_v == 1) {
      another_sig.unshift(0);
      ++another_v;
      another_exp += Decimal.decimal_digits_per_word;
  }

  var result_len = Decimal.n + 2;
  var result_sig = Array(result_len);

  for (var i = 0; i < result_len; ++i) {
      result_sig[i] = 0;
  }

  var result_v = 0;

  for (var i = 0; i < result_len; ++i) {
      var ind = this_v - i - 1;
      var tmp1 = this_sig[ind];

      if (i) {
    tmp1 += this_sig[ind + 1] * Decimal.one_word;
      }

      var result = Math.floor(tmp1 / another_sig[another_v - 1]);

      var tmp2 = ((tmp1 - another_sig[another_v - 1] * result) *
      Decimal.one_word + this_sig[ind - 1] +
      (Decimal.two_words - another_sig[another_v - 2] * result));

      if (tmp2 < Decimal.two_words) {
    result -= Math.floor((Decimal.two_words - 1 - tmp2) /
             (another_sig[another_v - 1]
              * Decimal.one_word +
              another_sig[another_v - 2])) + 1;
      }

      // multiply and subtract
      var carry = Decimal.one_word;
      for (var j = 0; j < another_v + 1; ++j) {
    var ind2 = (added - i + j - 
          (Decimal.n - (this_v - added)) +
          (Decimal.n - another_v));

    if (ind2 >= this_v) {
        break;
    }

    this_sig[ind2] += (Decimal.two_words - Decimal.one_word + carry);

    if (j < another_v) {
        this_sig[ind2] -= another_sig[j] * result;
    }

    carry = Math.floor(this_sig[ind2] / Decimal.one_word);
    this_sig[ind2] %= Decimal.one_word;
      }

      if (carry < Decimal.one_word) {
    // subtracted too much, add back
    result -= 1;
    carry = 0;

    for (j = 0; j < another_v; ++j) {
        var ind2 = this_v - i - another_v + j;
        this_sig[ind2] += carry + another_sig[j];
        carry = Math.floor(this_sig[ind2] / Decimal.one_word);
        this_sig[ind2] %= Decimal.one_word;
    }
      }
      result_sig[result_len - 1 - i] = result;

      // increment valid_words of the result
      if (result || result_v) {
    ++result_v;
      }

      // stop if we've computed enough words
      if (result_v > Decimal.n) {
    break;
      }
  }
  // if the remainder isn't zero, add one to the result
  // in order to prevent an erroneous round off
  for (var i = 0; i < this_sig.length; ++i) {
      if (this_sig[i]) {
    result_sig[0] += 1;
    break;
      }
  }

  var result_exp = (this.exp - another_decimal.exp +
        (another_v - (this_v - added) + Decimal.n + 1) *
        Decimal.decimal_digits_per_word);

  return Decimal.fromData(result_sig, result_exp,
        this.is_minus != another_decimal.is_minus);
    };

    // Module
    if(typeof module != 'undefined' && module.exports) {
        module.exports = Decimal;
    } else {
        ROOT.Decimal = Decimal;
    }
})();
