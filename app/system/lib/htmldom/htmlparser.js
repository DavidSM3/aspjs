/*!
 * HTML Parser
 * 
 * Based on code by John Resig (http://ejohn.org/blog/pure-javascript-html-parser/)
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 *
 * // Usage:
 * HTMLParser(htmlString, {
 *     start: function(tag, attrs, unary) {},
 *     end: function(tag) {},
 *     chars: function(text) {},
 *     comment: function(text) {}
 * });
 *
 */

if (!this.lib_htmlparser) this.lib_htmlparser = lib_htmlparser;
function lib_htmlparser() {

  // Regular Expressions for parsing tags and attributes
  var RE_DOCTYPE = /<!DOCTYPE(\s+(".*?"|\S+))*(\[(<.*?>|[^\]]*)\])?\s*>/i
    , RE_DOCTYPE_PART = /\s+(".*?"|\[(?:<.*?>|[^\]]*)\]|\S+)/ig
    , RE_TRIM_QUOTES = /(^"|"$)/g
    , RE_START_TAG = /^<([\w:-]+)((?:\s+[\w:-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/
    , RE_END_TAG = /^<\/([\w:-]+)[^>]*>/
    , RE_ATTR = /([\w:-]+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g;

  // Empty Elements - HTML 4.01
  var empty = makeMap('area,base,basefont,br,col,frame,hr,img,input,isindex,link,meta,param,embed');

  // Block Elements - HTML 4.01
  var block = makeMap('address,applet,blockquote,button,center,dd,del,dir,div,dl,dt,fieldset,form,frameset,hr,iframe,ins,isindex,li,map,menu,noframes,noscript,object,ol,p,pre,script,table,tbody,td,tfoot,th,thead,tr,ul');

  // Inline Elements - HTML 4.01
  var inline = makeMap('a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var');

  // Elements that you can, intentionally, leave open (and which close themselves)
  var closeSelf = makeMap('colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr');

  // Attributes that have their values filled in disabled="disabled"
  var fillAttrs = makeMap('checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected');

  // Special Elements (can contain anything)
  var special = makeMap('script,style');

  function HTMLParser(html, handler) {
    var index, chars, match, stack = [], last = html;
    stack.last = function() {
      return this[this.length - 1];
    };

    while (html) {
      chars = true;
      // Make sure we're not in a script or style element
      if (!stack.last() || !special[stack.last()]) {
        // comment
        if (html.indexOf('\x3C!--') == 0) {
          index = html.indexOf('--\x3E');
          if (index >= 0) {
            if (handler.comment) {
              handler.comment(html.substring(4, index));
            }
            html = html.substring(index + 3);
            chars = false;
          }
        } else
        // cdata
        if (html.indexOf('<![CDATA[') == 0) {
          index = html.indexOf(']]>');
          if (index >= 0) {
            if (handler.cdata) {
              handler.cdata(html.substring(9, index));
            }
            html = html.substring(index + 3);
            chars = false;
          }
        } else
        // doctype
        if (html.search(RE_DOCTYPE) == 0) {
          html = html.replace(RE_DOCTYPE, function(doctype, parts) {
            if (handler.doctype) {
              handler.doctype(doctype, parseDocType(doctype));
            }
            return '';
          });
          chars = false;
        } else
        // end tag
        if (html.indexOf('</') == 0) {
          match = html.match(RE_END_TAG);
          if (match) {
            html = html.substring(match[0].length);
            match[0].replace(RE_END_TAG, parseEndTag);
            chars = false;
          }

        } else
        // start tag
        if (html.indexOf('<') == 0) {
          match = html.match(RE_START_TAG);
          if (match) {
            html = html.substring(match[0].length);
            match[0].replace(RE_START_TAG, parseStartTag);
            chars = false;
          }
        }
        if (chars) {
          index = html.indexOf('<');
          var text = index < 0 ? html : html.substring(0, index);
          html = index < 0 ? '' : html.substring(index);
          if (handler.chars) {
            handler.chars(htmlDec(text));
          }
        }
      } else {
        //Inside a Script or Style Element
        var regEndTag = new RegExp('</' + RegExp.escape(stack.last()) + '[^>]*>'), trimAt;
        html.replace(regEndTag, function(tag, index) {
          if (handler.chars) {
            handler.chars(html.substring(0, index));
          }
          trimAt = index + tag.length;
        });
        html = html.substring(trimAt);
        parseEndTag('', stack.last());
      }
      if (html == last) {
        throw new Error('Parse Error: ' + html);
      }
      last = html;
    }
    // Clean up any remaining tags
    parseEndTag();

    function parseDocType(data) {
      var parts = [], doctype = {};
      data = data.replace(RE_DOCTYPE_PART, function(_, part) {
        parts.push(part.replace(RE_TRIM_QUOTES, ''));
        return '';
      });
      return {
        rootElement: parts[0],
        'public': parts[1],
        fpi: parts[2],
        uri: parts[3]
      };
    }

    function parseStartTag(tag, tagName, rest, unary) {
      if (block[tagName]) {
        while (stack.last() && inline[stack.last()]) {
          parseEndTag('', stack.last());
        }
      }
      if (closeSelf[tagName] && stack.last() == tagName) {
        parseEndTag('', tagName);
      }
      unary = empty[tagName] || !!unary;
      if (!unary) {
        stack.push(tagName);
      }
      if (handler.start) {
        var attrs = [];
        rest.replace(RE_ATTR, function(match, name) {
          var value = arguments[2] ? arguments[2] :
          arguments[3] ? arguments[3] :
          arguments[4] ? arguments[4] :
          fillAttrs[name] ? name : '';
          attrs.push({
            name: name,
            value: value,
            escaped: value.replace(/(^|[^\\])"/g, '$1\\"') //"
          });
        });
        if (handler.start)
          handler.start(tagName, attrs, unary);
      }
    }

    function parseEndTag(tag, tagName) {
      // If no tag name is provided, clean shop
      if (!tagName) {
        var pos = 0;
      } else {
        // Find the closest opened tag of the same type
        for (var pos = stack.length - 1; pos >= 0; pos--) {
          if (stack[pos] == tagName) break;
        }
      }
      if (pos >= 0) {
        // Close all the open elements, up the stack
        for (var i = stack.length - 1; i >= pos; i--) {
          if (handler.end) {
            handler.end(stack[i]);
          }
        }
        // Remove the open elements from the stack
        stack.length = pos;
      }
    }
  }

  function makeMap(str) {
    var obj = {}, items = str.split(',');
    for (var i = 0; i < items.length; i++) {
      obj[items[i]] = true;
    }
    return obj;
  }

  return {
    parse: HTMLParser
  };

}
