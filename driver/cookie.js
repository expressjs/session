var parseUrl = require('parseurl');
var cookie = require('cookie');
var onHeaders = require('on-headers');
var debug = require('debug')('express-session');
var crc = require('crc').crc32;
var signature = require('cookie-signature');
var deprecate = require('depd')('express-session');

/* istanbul ignore next */
var defer = typeof setImmediate === 'function'
  ? setImmediate
  : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)) }

module.exports = function(store, options) {

  return function(req, res, next) {
    // self-awareness
    if (req.session) return next();
    
    // Handle connection as if there is no session if
    // the store has temporarily disconnected etc
    if (!options.storeReady) return debug('store is disconnected'), next();
    
    // pathname mismatch
    var originalPath = parseUrl.original(req).pathname;
    if (0 != originalPath.indexOf(options.cookie.path || '/')) return next();
    
    // ensure a secret is available or bail
    if (!options.secret && !req.secret) {
      next(new Error('secret option required for sessions'));
      return;
    }
    
    // backwards compatibility for signed cookies
    // req.secret is passed from the cookie parser middleware
    var secrets = options.secret || [req.secret];
    
    var originalHash;
    var originalId;
    var savedHash;
    
    // expose store
    req.sessionStore = store;
    
    // get the session ID from the cookie
    var cookieId = req.sessionID = getcookie(req, options.name, secrets);
    
    // set-cookie
    onHeaders(res, function(){
      if (!req.session) {
        debug('no session');
        return;
      }
    
      var cookie = req.session.cookie;
    
      // only send secure cookies via https
      if (cookie.secure && !issecure(req, options.trustProxy)) {
        debug('not secured');
        return;
      }
    
      if (!shouldSetCookie(req)) {
        return;
      }
    
      setcookie(res, options.name, req.sessionID, secrets[0], cookie.data);
    });
    
    // proxy end() to commit the session
    var _end = res.end;
    var _write = res.write;
    var ended = false;
    res.end = function end(chunk, encoding) {
      if (ended) {
        return false;
      }
    
      ended = true;
    
      var ret;
      var sync = true;
    
      function writeend() {
        if (sync) {
          ret = _end.call(res, chunk, encoding);
          sync = false;
          return;
        }
    
        _end.call(res);
      }
    
      function writetop() {
        if (!sync) {
          return ret;
        }
    
        if (chunk == null) {
          ret = true;
          return ret;
        }
    
        var contentLength = Number(res.getHeader('Content-Length'));
    
        if (!isNaN(contentLength) && contentLength > 0) {
          // measure chunk
          chunk = !Buffer.isBuffer(chunk)
            ? new Buffer(chunk, encoding)
            : chunk;
          encoding = undefined;
    
          if (chunk.length !== 0) {
            debug('split response');
            ret = _write.call(res, chunk.slice(0, chunk.length - 1));
            chunk = chunk.slice(chunk.length - 1, chunk.length);
            return ret;
          }
        }
    
        ret = _write.call(res, chunk, encoding);
        sync = false;
    
        return ret;
      }
    
      if (shouldDestroy(req)) {
        // destroy session
        debug('destroying');
        store.destroy(req.sessionID, function ondestroy(err) {
          if (err) {
            defer(next, err);
          }
    
          debug('destroyed');
          writeend();
        });
    
        return writetop();
      }
    
      // no session to save
      if (!req.session) {
        debug('no session');
        return _end.call(res, chunk, encoding);
      }
    
      // touch session
      req.session.touch();
    
      if (shouldSave(req)) {
        req.session.save(function onsave(err) {
          if (err) {
            defer(next, err);
          }
    
          writeend();
        });
    
        return writetop();
      } else if (options.storeImplementsTouch && shouldTouch(req)) {
        // store implements touch method
        debug('touching');
        store.touch(req.sessionID, req.session, function ontouch(err) {
          if (err) {
            defer(next, err);
          }
    
          debug('touched');
          writeend();
        });
    
        return writetop();
      }
    
      return _end.call(res, chunk, encoding);
    };
    
    // generate the session
    function generate() {
      store.generate(req);
      originalId = req.sessionID;
      originalHash = hash(req.session);
      wrapmethods(req.session);
    }
    
    // wrap session methods
    function wrapmethods(sess) {
      var _save = sess.save;
    
      function save() {
        debug('saving %s', this.id);
        savedHash = hash(this);
        _save.apply(this, arguments);
      }
    
      Object.defineProperty(sess, 'save', {
        configurable: true,
        enumerable: false,
        value: save,
        writable: true
      });
    }
    
    // check if session has been modified
    function isModified(sess) {
      return originalId !== sess.id || originalHash !== hash(sess);
    }
    
    // check if session has been saved
    function isSaved(sess) {
      return originalId === sess.id && savedHash === hash(sess);
    }
    
    // determine if session should be destroyed
    function shouldDestroy(req) {
      return req.sessionID && options.destroy && req.session == null;
    }
    
    // determine if session should be saved to store
    function shouldSave(req) {
      // cannot set cookie without a session ID
      if (typeof req.sessionID !== 'string') {
        debug('session ignored because of bogus req.sessionID %o', req.sessionID);
        return false;
      }
    
      return !options.saveUninitializedSession && cookieId !== req.sessionID
        ? isModified(req.session)
        : !isSaved(req.session)
    }
    
    // determine if session should be touched
    function shouldTouch(req) {
      // cannot set cookie without a session ID
      if (typeof req.sessionID !== 'string') {
        debug('session ignored because of bogus req.sessionID %o', req.sessionID);
        return false;
      }
    
      return cookieId === req.sessionID && !shouldSave(req);
    }
    
    // determine if cookie should be set on response
    function shouldSetCookie(req) {
      // cannot set cookie without a session ID
      if (typeof req.sessionID !== 'string') {
        return false;
      }
    
      // in case of rolling session, always reset the cookie
      if (options.rollingSessions) {
        return true;
      }
    
      return cookieId != req.sessionID
        ? options.saveUninitializedSession || isModified(req.session)
        : req.session.cookie.expires != null && isModified(req.session);
    }
    
    // generate a session if the browser doesn't send a sessionID
    if (!req.sessionID) {
      debug('no SID sent, generating session');
      generate();
      next();
      return;
    }
    
    // generate the session object
    debug('fetching %s', req.sessionID);
    store.get(req.sessionID, function(err, sess){
      // error handling
      if (err) {
        debug('error %j', err);
    
        if (err.code !== 'ENOENT') {
          next(err);
          return;
        }
    
        generate();
      // no session
      } else if (!sess) {
        debug('no session found');
        generate();
      // populate req.session
      } else {
        debug('session found');
        store.createSession(req, sess);
        originalId = req.sessionID;
        originalHash = hash(sess);
    
        if (!options.resaveSession) {
          savedHash = originalHash
        }
    
        wrapmethods(req.session);
      }
    
      next();
    });
  };
};

/**
 * Get the session ID cookie from request.
 *
 * @return {string}
 * @private
 */

function getcookie(req, name, secrets) {
  var header = req.headers.cookie;
  var raw;
  var val;

  // read from cookie header
  if (header) {
    var cookies = cookie.parse(header);

    raw = cookies[name];

    if (raw) {
      if (raw.substr(0, 2) === 's:') {
        val = unsigncookie(raw.slice(2), secrets);

        if (val === false) {
          debug('cookie signature invalid');
          val = undefined;
        }
      } else {
        debug('cookie unsigned')
      }
    }
  }

  // back-compat read from cookieParser() signedCookies data
  if (!val && req.signedCookies) {
    val = req.signedCookies[name];

    if (val) {
      deprecate('cookie should be available in req.headers.cookie');
    }
  }

  // back-compat read from cookieParser() cookies data
  if (!val && req.cookies) {
    raw = req.cookies[name];

    if (raw) {
      if (raw.substr(0, 2) === 's:') {
        val = unsigncookie(raw.slice(2), secrets);

        if (val) {
          deprecate('cookie should be available in req.headers.cookie');
        }

        if (val === false) {
          debug('cookie signature invalid');
          val = undefined;
        }
      } else {
        debug('cookie unsigned')
      }
    }
  }

  return val;
}

/**
 * Hash the given `sess` object omitting changes to `.cookie`.
 *
 * @param {Object} sess
 * @return {String}
 * @private
 */

function hash(sess) {
  return crc(JSON.stringify(sess, function (key, val) {
    if (key !== 'cookie') {
      return val;
    }
  }));
}

/**
 * Determine if request is secure.
 *
 * @param {Object} req
 * @param {Boolean} [trustProxy]
 * @return {Boolean}
 * @private
 */

function issecure(req, trustProxy) {
  // socket is https server
  if (req.connection && req.connection.encrypted) {
    return true;
  }

  // do not trust proxy
  if (trustProxy === false) {
    return false;
  }

  // no explicit trust; try req.secure from express
  if (trustProxy !== true) {
    var secure = req.secure;
    return typeof secure === 'boolean'
      ? secure
      : false;
  }

  // read the proto from x-forwarded-proto header
  var header = req.headers['x-forwarded-proto'] || '';
  var index = header.indexOf(',');
  var proto = index !== -1
    ? header.substr(0, index).toLowerCase().trim()
    : header.toLowerCase().trim()

  return proto === 'https';
}

/**
 * Set cookie on response.
 *
 * @private
 */

function setcookie(res, name, val, secret, options) {
  var signed = 's:' + signature.sign(val, secret);
  var data = cookie.serialize(name, signed, options);

  debug('set-cookie %s', data);

  var prev = res.getHeader('set-cookie') || [];
  var header = Array.isArray(prev) ? prev.concat(data)
    : Array.isArray(data) ? [prev].concat(data)
    : [prev, data];

  res.setHeader('set-cookie', header)
}

/**
 * Verify and decode the given `val` with `secrets`.
 *
 * @param {String} val
 * @param {Array} secrets
 * @returns {String|Boolean}
 * @private
 */
function unsigncookie(val, secrets) {
  for (var i = 0; i < secrets.length; i++) {
    var result = signature.unsign(val, secrets[i]);

    if (result !== false) {
      return result;
    }
  }

  return false;
}
