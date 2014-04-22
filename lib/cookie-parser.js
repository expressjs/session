/**
 * Cookie parser class
 * @author Ricardo Barros <ricardofbarros@hotmail.com>
 */

/**
 * Module dependencies
 */

var cookie = require('cookie')
  , signature = require('cookie-signature');
 
/**
 * Construct a new Cookie Parser object
 *
 * @param {String} cookieRaw
 * @constructor CookieParser
 */

function CookieParser(cookieRaw) {
  
  /**
   * CookieParser private methods
   */  
  
  var _prototype = {

    /**
     * Parsed raw cookie 
     * @access private
     */
    parsedRaw : cookie.parse(cookieRaw),
    
    /**
     * Parse JSON cookies.
     *
     * @access private
     * @param {Object} obj
     * @return {Object}
     */
    toJSON : function(obj) {
      var self = this;
      
      Object.keys(obj).forEach(function(key){
        var val = obj[key];
        var res = self.stringToJSON(val);
        if (res) obj[key] = res;
      });
      
      return obj;
    },
    
    /**
     * Parse JSON cookie string
     *
     * @access private
     * @param {String} str
     * @return {Object} Parsed object or null if not json cookie
     */
    stringToJSON : function(str) {
      if (0 == str.indexOf('j:')) {
        try {
          return JSON.parse(str.slice(2));
        } catch (err) {
          // no op
        }
      }      
    }
  };

  /**
   * CookieParser public methods
   */  
  
  var prototype = {
        
    /**
     * Returns Signed Cookie as JSON
     * 
     * @access public
     * @returns {JSON} signed cookie
     */
    signed : function(secret) {
      var obj = {};
        
      Object.keys(_prototype.parsedRaw).forEach(function(key){
        var val = _prototype.parsedRaw[key];
        if (0 == val.indexOf('s:')) {
          val = signature.unsign(val.slice(2), secret);
          if (val) {
            obj[key] = val;
            delete _prototype.parsedRaw[key];
          }
        }
      });
      
      return _prototype.toJSON(obj);
    },

    /**
     * Parsed Cookie as JSON
     * @access public
     */
    parsed : _prototype.toJSON(_prototype.parsedRaw)      
  };
  
  return prototype;
}

module.exports = CookieParser;