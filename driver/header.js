var debug = require('debug')('express-session');
var signature = require('cookie-signature');
var crc = require('crc').crc32;

module.exports = function(store, options) {

	return function(req, res, next) {
    // self-awareness
    if (req.session) return next();
    
    // Handle connection as if there is no session if
    // the store has temporarily disconnected etc
    if (!options.storeReady) return debug('store is disconnected'), next();

    var originalHash;
    var originalId;
    var savedHash;

    // expose store
    req.sessionStore = store;

    // get the session ID from the cookie
    var headerId = req.sessionID = getheader(req, options.name);

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
    
      return !options.saveUninitializedSession && headerId !== req.sessionID
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
    
      return headerId === req.sessionID && !shouldSave(req);
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
 * Get the session ID header from request.
 *
 * @return {string}
 * @private
 */

function getheader(req, name) {
  var raw = req.get(name);
  var val;

  if (raw) {
    if (raw.substr(0, 7).toLowerCase() === 'bearer ') {
      val = raw.slice(7);
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
