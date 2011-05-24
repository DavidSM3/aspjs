/*!
 * Global Functions and Variables
 *
 */

//These will become shorthand for Object.vartype, Array.toArray, String.urlEnc, etc
var vartype, isPrimitive, isSet, toArray, urlEnc, urlDec, htmlEnc, htmlDec;

/**
 * Shorthand to iterate Array / Object
 *
 */
function forEach(o, fn) {
  if (o instanceof Array) {
    return Array.prototype.each.call(o, fn);
  } else {
    return Object.each(o, fn);
  }
}

/**
 * Get a member of an object or set it if it doesn't exist
 * This basically replaces lines like:
 * # val = obj.prop || (obj.prop = default_val);
 *
 * @param {Object} obj
 * @param {String} prop
 * @param {Object} default_val
 */
function getset(obj, prop, default_val) {
  if (!Object.exists(obj, prop)) {
    obj[prop] = default_val;
  }
  return obj[prop];
}

/**
 * Create a Getter/Setter Function
 * The function returned accepts one or two arguments and calls the get,
 * set, del or each function based on the number and type of args passed in.
 *
 * @param {Object} params Named Parameters (at minimum "get" and "set")
 * @param {Object} [context] Context (becomes "this" inside getter/setter functions)
 * @returns {Function} Getter/Setter Function
 */
function fngetset(params, context) {
  var get = params.get
    , set = params.set
    , del = params.del
    , each = params.each;
  function gettersetter(n, val){
    var self = context || this
      , type = vartype(n)
      , len = arguments.length;
    if (each && type == 'function') {
      return each.call(self, n);
    }
    if (len == 1) {
      if (type == 'object') {
        return Object.each(n, gettersetter);
      } else {
        return get.call(self, n);
      }
    }
    if (del && val === null) {
      return del.call(self, n);
    }
    return set.call(self, n, val);
  };
  return gettersetter;
}

/**
 * Extend built-in objects
 *
 * Some of this code is inspired by or based on ECMAScript 5 and/or various open-source JavasScript
 * libraries.
 *
 */
if (!this.lib_globals) this.lib_globals = lib_globals;
function lib_globals() {

  function getGlobal() {
    return this;
  }

  //Append properties from one or more objects into the first (overwriting)
  Object.append = function() {
    var ret, args = Array.toArray(arguments);
    for (var i=0; i<args.length; i++) {
      if (args[i] instanceof Object) {
        if (ret) {
          Object.each(args[i],function(n, val){
            ret[n] = val;
          });
        } else {
          ret = args[i];
        }
      }
    }
    return ret;
  };
  //Recursively append objects such that sub-objects are cloned
  Object.combine = function() {
    var ret, args = Array.toArray(arguments);
    for (var i=0; i<args.length; i++) {
      if (args[i] instanceof Object) {
        if (ret) {
          Object.each(args[i],function(n, val){
            if (Object.isPrimitive(val)) {
              ret[n] = val;
            } else
            if (Object.vartype(val) == 'object') {
              //TODO: valueOf
              if (Object.exists(ret, n)) {
                ret[n] = Object.combine(ret[n],val)
              } else {
                ret[n] = Object.combine({},val)
              }
            } else {
              //TODO: clone
              ret[n] = val;
            }
          });
        } else {
          ret = args[i];
        }
      }
    }
    return ret;
  };
  //Create a new object that "inherits" from another
  Object.create = function(obj) {
    function F() {}
    F.prototype = obj;
    return new F();
  };
  //Extend an object so it "inherits" from parent but contains the given properties as its own
  Object.extend = function(parent, ext) {
    var obj = Object.create(parent);
    if (ext instanceof Function) {
      Object.append(obj, ext.call(parent, parent));
    } else
    if (ext instanceof Object) {
      //Object.append(obj, {_super: parent})
      Object.append(obj, ext)
    }
    return obj;
  };
  Object.each = function(o, f) {
    var i = 0;
    for (var n in o) if (Object.exists(o, n)) if (f.call(o, n, o[n],(i++)) === false) break;
    return o;
  };
  Object.exists = function(o, n) {
    return Object.prototype.hasOwnProperty.call(o, n);
  };
  Object.isPrimitive = function(obj) {
    return 'boolean null number string undefined'.w().exists(Object.vartype(obj));
  };
  Object.isSet = function(obj) {
    return !(obj === null || obj === undefined);
  };
  Object.keys = function(o) {
    var a = [];
    Object.each(o, function(n) {
      a.push(n);
    });
    return a;
  };
  Object.remove = function(o, a) {
    var type = Object.vartype(a);
    if (type == 'array') {
      for (var i=0; i<a.length; i++) Object.remove(o, a[i]);
    } else
    if (type == 'string' && Object.exists(o, a)) {
      delete o[a];
    }
    return o;
  };
  Object.values = function(o) {
    var a = [];
    Object.each(o, function(n, val) {
      a.push(val);
    });
    return a;
  };
  Object.vartype = function(obj) {
    var type = (obj === null) ? 'null' : typeof obj;
    if (obj instanceof Object) {
      return Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
    }
    return (type == 'object') ? 'unknown' : type;
  };

  Array.prototype.each = function(fn) {
    var arr = this, len = arr.length;
    for (var i = 0; i < len; i++) {
      if (fn.call(arr, i, arr[i]) === false) break;
    }
    return arr;
  };
  if (!Array.prototype.forEach)
  Array.prototype.forEach = function (fn, context) {
    var arr = this, len = context.length;
    context = context || arr;
    for (var i = 0; i < len; i++) {
      if (i in arr) fn.call(context, arr[i], i, arr);
    }
  };
  if (!Array.prototype.indexOf)
  Array.prototype.indexOf = function(el, i) {
    var arr = this, len = arr.length;
    i = i || 0;
    if (i < 0) i = len + i;
    for (; i < len; i++) {
      if (arr[i] === el) return i;
    }
    return -1
  };
  Array.prototype.exists = function(el) {
    return (Array.prototype.indexOf.call(this, el) >= 0);
  };
  if (!Array.prototype.filter)
  Array.prototype.filter = function(fn) {
    var arr = [];
    Array.prototype.each.call(this, function(i, el){
      if (fn(el, i)) arr.push(el);
    });
    return arr;
  };
  if (!Array.prototype.map)
  Array.prototype.map = function(fn) {
    var arr = [];
    Array.prototype.each.call(this, function(i, el){
      arr.push(fn(el, i));
    });
    return arr;
  };
  if (!Array.prototype.reduce)
  Array.prototype.reduce = function(fn, init) {
    var arr = this, len = arr.length, out, i = 0;
    if (arguments.length >= 2) {
      out = init;
    } else {
      out = arr[i++];
    }
    while (i < len) {
      out = fn.call(arr, out, arr[i], i++, arr);
    }
    return out;
  };
  Array.toArray = function(obj) {
    var len = obj.length, arr = new Array(len);
    for (var i = 0; i < len; i++) arr[i] = obj[i];
    return arr;
  };

  Function.prototype.bind = function(obj){
    var fn = this;
    return function(){ return fn.apply(obj, arguments) };
  };
  Function.noop = function(){};
  
  Number.parse = function(s, d) {
    if (!d) d = 0;
    var i = parseFloat(s);
    return isFinite(i) ? i : d;
  };
  Number.parseInt = function(s, d) {
    if (!d) d = 0;
    var i = parseInt(s, 10);
    return isFinite(i) ? i : d;
  };
  Number.random = function(lower, upper) {
    return Math.floor(Math.random() * (upper - lower + 1)) + lower;
  };
  
  var _split = String.prototype.split;
  String.prototype.split = function(s, limit) {
    if (Object.vartype(s) !== 'regexp') {
      return _split.apply(this, arguments);
    }
    var str = String(this), out = [], lastLastIndex = 0, match, lastLength;
    if (arguments.length < 2 || +limit < 0) {
      limit = Infinity;
    } else {
      limit = Math.floor(+limit);
      if (!limit) {
        return [];
      }
    }
    s = RegExp.copyAsGlobal(s);
    while (match = s.exec(str)) {
      if (s.lastIndex > lastLastIndex) {
        out.push(str.slice(lastLastIndex, match.index));
        if (match.length > 1 && match.index < str.length) {
          Array.prototype.push.apply(out, match.slice(1));
        }
        lastLength = match[0].length;
        lastLastIndex = s.lastIndex;
        if (out.length >= limit)
          break;
      }
      if (s.lastIndex === match.index)
        s.lastIndex++;
    }
    if (lastLastIndex === str.length) {
      if (!RegExp.prototype.test.call(s, '') || lastLength)
        out.push('');
    } else {
      out.push(str.slice(lastLastIndex));
    }
    return (out.length > limit) ? out.slice(0, limit) : out;
  };
  
  String.prototype.replaceAll = function(a, b) {
    return String.prototype.replace.call(this, new RegExp(RegExp.escape(a), 'ig'), b);
  };
  String.prototype.trimLeft = function() {
    return String.prototype.replace.call(this, /^\w*/, '');
  };
  String.prototype.trimRight = function() {
    return String.prototype.replace.call(this, /\w*$/, '');
  };
  String.prototype.trim = function() {
    return String.prototype.replace.call(this, /^\s*(\S*(\s+\S+)*)\s*$/ , '$1');
  };
  String.prototype.padLeft = function(n, s) {
    var r = String(this), len = r.length;
    return (len < n) ? new Array(n - len + 1).join(s) + r : r;
  };
  String.prototype.padRight = function(n, s) {
    var r = String(this), len = r.length;
    return (len < n) ? r + new Array(n - len + 1).join(s) : r;
  };
  String.prototype.startsWith = function(s) {
    var self = this, re = new RegExp('^' + RegExp.escape(s), 'i');
    return !!String(self).match(re);
  };
  String.prototype.endsWith = function(s) {
    var self = this, re = new RegExp(RegExp.escape(s) + '$', 'i');
    return !!String(self).match(re);
  };
  String.prototype.replaceHead = function(s1, s2) {
    var self = this, re = new RegExp('^' + RegExp.escape(s1), 'i');
    return String(self).replace(re, s2);
  };
  String.prototype.replaceTail = function(s1, s2) {
    var self = this, re = new RegExp(RegExp.escape(s1) + '$', 'i');
    return String(self).replace(re, s2);
  };
  String.prototype.w = function() {
    return String.prototype.split.call(this, /[,\s]+/);
  };
  String.parse = function(s) {
    return Object.isSet(s) ? String(s) : '';
  };
  String.repeat = function(s, n) {
    var a = new Array(n + 1);
    return a.join(s);
  };

  var re_urlEnc = /[^0-9a-f!$'()*,-.\/:;@[\\\]^_{|}~]+/ig;
  String.urlEnc = function(s) {
    return String(s).replace(re_urlEnc, function(s) {
      return encodeURIComponent(s);
    });
  };
  String.urlDec = function(s) {
    s = s.replace(/\+/g, ' ');
    try {
      return decodeURIComponent(s);
    } catch(e) {
      return unescape(s);
    }
  };
  
  String.htmlEnc = function(s) {
    s = String(s).replace(/&/g, '&amp;').replace(/>/g, '&gt;')
      .replace(/</g, '&lt;').replace(/"/g, '&quot;');
    return s;
  };
  String.htmlDec = function(s) {
    var repl = {'amp': 38, 'apos': 27, 'gt': 62, 'lt': 60, 'quot': 34};
    try {
      repl = app.cfg('html_entities') || repl;
    } catch(e) {}
    s = String.parse(s);
    s = replace(/&(\w{1,8});/g, function(ent, n) {
      var i = repl[n.toLowerCase()];
      return (i) ? String.fromCharCode(i) : ent;
    });
    s = replace(/&#(\d+);/g, function(ent, n) {
      var i = parseInt(n, 10);
      return (i) ? String.fromCharCode(i) : ent;
    });
    return s;
  };
  
  Date.prototype.toGMTString = function() {
    var a = Date.prototype.toUTCString.call(this).split(' ');
    if (a[1].length == 1) a[1] = '0' + a[1];
    return a.join(' ').replace(/UTC$/i, 'GMT');
  };
  Date.now = function() {
    return new Date();
  };

  var REG_DATE_1 = /^(\d{4})-(\d{2})-(\d{2})\s*T?([\d:]+)(\.\d+)?($|[Z\s+-].*)$/i;
  var REG_DATE_2 = /(^|[^\d])(\d{4})-(\d{1,2})-(\d{1,2})($|[^\d])/;
  Date.fromString = function(str, def) {
    if (str instanceof Date) {
      return new Date(str);
    }
    str = String(str);
    //ISO 8601 / JSON-style date: "2008-12-13T16:08:32Z"
    str = str.replace(REG_DATE_1, '$2/$3/$1 $4$6');
    //YYYY-M-D
    str = str.replace(REG_DATE_2, '$1$2/$3/$4$5');
    var i = Date.parse(str);
    if (isFinite(i)) {
      return new Date(i);
    }
    if (def) {
      return def;
    }
  };
  Date.fromUTCString = function(str, def) {
    var d = Date.fromString(str, def);
    if (d) {
      return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(),
        d.getMinutes(), d.getSeconds(), d.valueOf() % 1000));
    }
  };
  Date.getParts = function(d, utc) {
    var part = {
      yyyy: (utc) ? d.getUTCFullYear() : d.getFullYear(),
      moy: (utc) ? d.getUTCMonth() : d.getMonth(),
      d: (utc) ? d.getUTCDate() : d.getDate(),
      dow: (utc) ? d.getUTCDay() : d.getDay(),
      H: (utc) ? d.getUTCHours() : d.getHours(),
      n: (utc) ? d.getUTCMinutes() : d.getMinutes(),
      s: (utc) ? d.getUTCSeconds() : d.getSeconds()
    };
    part.yy = String(part.yyyy).substr(2);
    part.m = part.moy + 1;
    part.cc = 'January February March April May June July August September October November December'
      .w()[part.moy];
    part.c = part.cc ? part.cc.substr(0, 3) : '';
    part.ww = 'Sunday Monday Tuesday Wednesday Thursday Friday Saturday'.w()[part.dow];
    part.w = part.ww ? part.ww.substr(0, 3) : '';
    part.h = (part.H > 12 || part.H == 0) ? Math.abs(part.H - 12) : part.H;
    part.p = (part.H > 11) ? 'pm' : 'am';
    part.P = (part.H > 11) ? 'PM' : 'AM';
    'm d H h n s'.w().each(function(i, n) {
      part[n + n] = String(100 + part[n]).substring(1);
    });
    return function(n) {
      return String.parse(part[n]);
    };
  };
  Date.format = function(d, fmt, utc) {
    var r, type = Object.vartype(d);
    if (type == 'date' || type == 'number') {
      d = new Date(d);
    } else {
      d = Date.fromString(d);
    }
    if (!d) return '';
    r = (fmt) ? String(fmt) : '{yyyy}/{mm}/{dd}';
    var part = Date.getParts(d, utc);
    r = r.replace(/\{(\w+)\}/g, function(str, n) {
      return part(n) || str;
    });
    return r;
  };
  
  RegExp.escape = function(s) {
    return String(s).replace(/([.?*+^$[\]\\(){}-])/g,'\\$1');
  };
  RegExp.copyAsGlobal = function (o) {
    var m = 'g' + ((o.ignoreCase) ? 'i' : '') + ((o.multiline) ? 'm' : '');
    return new RegExp(o.source,m);
  };

  //"Shorthand" Copies
  vartype = Object.vartype;
  isPrimitive = Object.isPrimitive;
  isSet = Object.isSet;
  toArray = Array.toArray;
  urlEnc = String.urlEnc;
  urlDec = String.urlDec;
  htmlEnc = String.htmlEnc;
  htmlDec = String.htmlDec;

  return getGlobal();
}

/*!
 * Compatibility for v8cgi
 */
if (typeof exports != 'undefined') {
  exports.forEach = forEach;
  exports.getset = getset;
  exports.fngetset = fngetset;
}
