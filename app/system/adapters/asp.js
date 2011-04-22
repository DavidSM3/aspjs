/**
 * ASP / IIS Adapter
 *
 * This library is a wrapper for the classes and methods that interact with ASP / IIS.
 *
 * Requires: core, lib_globals, Collection
 * Optional: lib_json, Binary
 *
 */
function lib_server() {
  
  var util = require('util');
  var json = require('json');
  var REG_URL = /^([^:\/]+:\/\/)?([^\/]*)([^?]*)(\?|$)(.*)/;

  var iis = {
    app: global['Application'],
    req: global['Request'],
    res: global['Response'],
    server: global['Server']
  };

  var vars = {
    platform: 'ASP'
  };
  var varmap = {
    ipaddr: 'REMOTE_ADDR',
    req_headers: 'ALL_RAW',
    server: 'SERVER_SOFTWARE'
  };

  function getVar(n) {
    if (vars[n]) {
      return vars[n];
    } else
    if (iis.req && varmap[n]) {
      return iis.req.servervariables(varmap[n]).item();
    } else {
      return '';
    }
  }

  var res = newResponse();

  function commitResponse() {
    iis.res.status = res.status;
    res.headers.each(function(n,val){
      switch (n.toLowerCase()) {
        case 'content-type':
          iis.res.contentType = applyCharset(val, res.charset);
          break;
        case 'cache-control':
          iis.res.cacheControl = String(val);
          break;
        default:
          iis.res.addHeader(n,val);
      }
    });
    res.cookies.each(function(n,obj){
      if (vartype(obj) == 'string') {
        obj = {val:obj};
      }
      iis.res.cookies(n) = String(obj.val);
      if (obj.exp) {
        iis.res.cookies(n).expires = Date.fromString(obj.exp);
      }
    });
  }

  function applyCharset(ctype, charset) {
    return (/^text\//i.exec(ctype)) ? ctype + '; charset=' + charset : ctype;
  }

  return {
    req: {
      getURL: function() {
        var m = iis.req.querystring.item().match(REG_URL);
        return (m[3] || '/') + m[4] + m[5];
      },
      getURLParts: function() {
        var m = iis.req.querystring.item().match(REG_URL);
        return {path: urlDec(m[3]) || '/', qs: m[4] + m[5]};
      },
      getHeaders: function() {
        return new Collection(util.parseHeaders(getVar('req_headers')));
      },
      getPostData: function() {
        var ctype = iis.req.servervariables('content_type').item() || '';
        if (ctype.match(/multipart/i)) {
          return processMultiPartBody();
        } else {
          return processFormBody();
        }
      },
      getCookies: function() {
        var cookies = {};
        if (iis.req.cookies) {
          Enumerator.each(iis.req.cookies.contents,function(i,key){
            cookies[key] = iis.req.cookies(key).item();
          });
        }
        return new Collection(cookies);
      }
    },
    res: {
      headers: function(){
        return res.headers.apply(null,arguments);
      },
      cookies: function(){
        return res.cookies.apply(null,arguments);
      },
      charset: function(s) {
        if (arguments.length) {
          return res.charset = s;
        } else {
          return res.charset;
        }
      },
      status: function(s) {
        if (arguments.length) {
          return res.status = s;
        } else {
          return res.charset;
        }
      },
      debug: function(o) {
        sys.log(o);
      },
      clear: function() {
        iis.res.clear();
        res = newResponse();
      },
      write: function(s) {
        iis.res.write(s);
      },
      writebin: function(b) {
        if (!(b instanceof Binary)) {
          b = new Binary(b);
        }
        iis.res.binaryWrite(b.readBin());
      },
      sendFile: function(opts) {
        commitResponse();
        var upload = new ActiveXObject("Persits.Upload");
        try {
          iis.res.buffer = false;
          upload.sendBinary(sys.mappath(opts.file), true, opts.ctype, !!opts.attachment,
            '"' + opts.name.replaceAll('"',"'") + '"');
        } catch(e) {
          iis.res.buffer = true;
          throw new Error('Error Serving File "' + opts.path + '"; ' + e.message);
        }
        iis.res.end();
      },
      end: function() {
        commitResponse();
        iis.res.end();
      }
    },
    mappath: function(p) {
      return iis.server.mappath(p);
    },
    exec: function(s) {
      return iis.server.execute(s);
    },
    vars: function(n) {
      return getVar(n);
    },
    appvars: col_wrap(iis.app,'JScript:',{enc: jsEnc, dec: jsDec})
  };


  /**
   * Create new response data object with blank / default values
   *
   * @returns {Object} Object containing response data fields
   */
  function newResponse() {
    return {
      status: '200',
      headers: new Collection({'content-type': 'text/plain'}),
      cookies: new Collection(),
      charset: 'utf-8'
    };
  }


  /**
   * Process Request Body where Content-Type is "application/x-www-form-urlencoded"
   *
   * @returns {Object} Object containing form fields (collection)
   */
  function processFormBody() {
    var fields = util.parseQueryString(iis.req.form.item());
    return {fields: util.newParamCollection(fields)};
  }


  /**
   * Process Request Body where Content-Type is "multipart/form-data" (usually file uploads)
   *
   * @returns {Object} Object containing files (collection) and fields (collection)
   */
  function processMultiPartBody() {
    var files = util.newParamCollection()
      , fields = util.newParamCollection()
      , upload = new ActiveXObject("Persits.Upload")
      , pid = req.params('x-upload-id') || req.headers('x-upload-id');

    if (pid) {
      upload.progressid = pid;
    }
    if (app.cfg('upload/max_size')) {
      upload.setMaxSize(app.cfg('upload/max_size') * 1024,true);
    }
    upload.overwriteFiles = false;
    var fileCount = upload.save(sys.mappath('data/temp/'));
    for (var i=1;i<=fileCount;i++) {
      var file = upload.files(i);
      files.add(file.name,processUploadedFile(file));
    }
    var fieldCount = upload.form.count;
    for (var i=1; i<=fieldCount; i++) {
      var f = upload.form(i);
      fields.add(f.name,f.value);
    }
    return {files: files, fields: fields};
  }

  /**
   * Save uploaded file to temporary directory and return a file descriptor object containing some
   * key properties of the file.
   * 
   * @param {Object} file
   * @returns {Object} File Descriptor
   */
  function processUploadedFile(file) {
    var fd = Object.create({
      move: function(p) {
        app.res.debug('Move: ' + file.name + ' -> ' + p);
        path = sys.path(p)
        app.res.debug('sys.path: ' + path);
        app.res.debug('sys.mappath: ' + sys.mappath(path));
        file.move(sys.mappath(path));
      },
      discard: function() {
        file.Delete();
      }
    });
    Object.append(fd,{
      name: file.originalFilename,
      path: sys.path.join('data/temp/', file.filename),
      mimetype: file.contentType,
      creationtime: new Date(file.creationTime),
      uploadtime: __date,
      lastaccesstime: __date,
      size: file.size,
      hash: file.md5Hash.toLowerCase(),
      imagetype: file.imageType,
      imagewidth: file.ImageWidth,
      imageheight: file.ImageHeight
    });
    return fd;
  }

  /*!
   * Functions for storing (Encoding/Decoding) data structures within Application Variables
   */
  function jsEnc(val) {
    if (isPrimitive(val) || !json) {
      return val;
    } else {
      return Array.toSafeArray([json.stringify(val)]);
    }
  }
  function jsDec(val) {
    if (json && Array.isSafeArray(val) && val.dimensions() == 1 && val.ubound() == 0) {
      return json.parse(val.getItem(0));
    }
    return val;
  }

  /**
   * Wrapper object for getting, setting and enumerating ActiveX collection. Optional Prefix parameter
   * can be used to store variable names so as not to conflict with other scripts. Optional Processor
   * parameter contains functions to encode / decode complex data types.
   *
   * Creates object with the following methods:
   *   .get('name'); //Get variable by name
   *   .set('name','value'); //Set variable
   *   .del('name'); //Delete variable
   *   .each(function(n,val){ ... }); //Enumerate
   *   .clear(); //Delete all
   *
   * @param col
   * @param pre
   * @param proc
   */
  function col_wrap(col,pre,proc) {
    var obj = {};
    pre = String.parse(pre);
    proc = proc || {};
    var enc = proc.enc || function(val){ return val; }
      , dec = proc.dec || function(val){ return val; };
    if (col.contents) {
      col = col.contents;
    }
    if (!col) {
      throw new Error('Invalid ActiveX Collection.');
    }
    obj.get = function(n){
      return dec(col(pre + n));
    };
    obj.set = function(n,val){
      col(pre + n) = enc(val);
      return val;
    };
    obj.del = function(n){
      var key = pre + n, val = dec(col(key));
      col.remove(key);
      return val;
    };
    obj.append = function(o){
      Object.each(o,function(n,val){
        obj.set(n,val);
      });
      return obj;
    };
    /**
     * Enumerates collection based on regular expression.
     *   sel(/^a(\d)/,function(n,val,cap1){ ... });
     */
    obj.sel = function(rex,fn){
      var items = {};
      Enumerator.each(col,function(i,key){
        var matches = key.match(rex);
        if (matches) {
          items[key] = [key,dec(col(key))].append(matches.slice(1));
        }
      });
      if (fn) {
        Object.each(items,function(n,arr){
          if (fn.apply(items,arr) === null) {
            col.remove(n);
          }
        });
      }
      return items;
    };
    obj.all = function(){
      var items = {};
      Enumerator.each(col,function(i,key){
        if (key.startsWith(pre)) {
          items[key.replaceHead(pre,'')] = dec(col(key));
        }
      });
      return items;
    };
    obj.each = function(fn){
      var items = obj.all();
      Object.each(items,function(n,val){
        if (fn.call(obj,n,val) === null) {
          obj.del(n);
        }
      });
      return obj;
    };
    obj.clear = function(){
      obj.each(function(n,val){
        return null;
      });
      return obj;
    };
    return obj_wrap(obj);
  }

  /**
   * Creates shorthand function for reading and manipulating a wrapped ActiveX collection.
   *
   * Returns function (fn) that is used as follows:
   *   fn('name'); //Get variable by name
   *   fn('name','value'); //Set variable
   *   fn('name',null); //Delete variable
   *   fn(function(n,val){ ... }); //Enumerate
   *   fn(); //Get all
   *   fn.clear(); //Delete all
   *
   */
  function obj_wrap(obj) {
    function fn(n,val) {
      var type = vartype(n), args = toArray(arguments);
      if (arguments.length == 0) {
        return obj.all();
      }
      if (type == 'function') {
        return obj.each(n);
      }
      if (type == 'object') {
        return obj.append(n);
      }
      if (arguments.length == 1) {
        return obj.get(n);
      }
      if (val === null) {
        return obj.del(n);
      }
      return obj.set(n,val);
    }
    return Object.append(fn,obj);
  }

}