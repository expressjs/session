/*!
 * express-session
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */

var cookie = require('cookie');
var debug = require('debug')('express-session');
var deprecate = require('depd')('express-session');
var parseUrl = require('parseurl');
var uid = require('uid-safe').sync
  , onHeaders = require('on-headers')
  , signature = require('cookie-signature')

var Session = require('./session/session')
  , MemoryStore = require('./session/memory')
  , Cookie = require('./session/cookie')
  , Store = require('./session/store')

// environment

var env = process.env.NODE_ENV;

/**
 * Expose the middleware.
 */

exports = module.exports = session;

/**
 * Expose constructors.
 */

exports.Store = Store;
exports.Cookie = Cookie;
exports.Session = Session;
exports.MemoryStore = MemoryStore;
exports.sessionId = {
  set: setcookie,
  get: getcookie,
  generate: generateSessionId
};

/**
 * Warning message for `MemoryStore` usage in production.
 * @private
 */

var warning = 'Warning: connect.session() MemoryStore is not\n'
  + 'designed for a production environment, as it will leak\n'
  + 'memory, and will not scale past a single process.';

/**
 * Node.js 0.8+ async implementation.
 * @private
 */

/* istanbul ignore next */
var defer = typeof setImmediate === 'function'
  ? setImmediate
  : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)) }

/**
 * Setup session store with the given `options`.
 *
 * @param {Object} [options]
 * @param {Object} [options.cookie] Options for cookie
 * @param {Function} [options.genid] deprecated
 * @param {String} [options.name=connect.sid] Session ID cookie name
 * @param {Boolean} [options.proxy]
 * @param {Boolean} [options.resave] Resave unmodified sessions back to the store
 * @param {Boolean} [options.rolling] Enable/disable rolling session expiration
 * @param {Boolean} [options.saveUninitialized] Save uninitialized sessions to the store
 * @param {String|Array} [options.secret] Secret for signing session ID
 * @param {Object} [options.store=MemoryStore] Session store
 * @param {Object} [options.sessionId=sessionId] session id store, default is cookie
 * @param {String} [options.unset]
 * @return {Function} middleware
 * @public
 */

function session(options){
  var options = options || {}
  //  name - previously "options.key"
    , name = options.name || options.key || 'connect.sid'
    , store = options.store || new MemoryStore
    , cookie = options.cookie || {}
    , trustProxy = options.proxy
    , storeReady = true
    , rollingSessions = options.rolling || false
    , resaveSession = options.resave
    , saveUninitializedSession = options.saveUninitialized
    , secret = options.secret
    , sessionId = createSessionIdStore(options.sessionId);

  if ('genid' in options) {
    sessionId.generate = options.genid;
    deprecate('"genid" option is depcreated. Please use sessionId.generate');
  }

  if (typeof sessionId.generate !== 'function') {
    throw new TypeError('"' + ('genid' in options ? 'genid' : 'sessionId.generate') + '" option must be a function');
  }

  if (resaveSession === undefined) {
    deprecate('undefined resave option; provide resave option');
    resaveSession = true;
  }

  if (saveUninitializedSession === undefined) {
    deprecate('undefined saveUninitialized option; provide saveUninitialized option');
    saveUninitializedSession = true;
  }

  if (options.unset && options.unset !== 'destroy' && options.unset !== 'keep') {
    throw new TypeError('unset option must be "destroy" or "keep"');
  }

  // TODO: switch to "destroy" on next major
  var unsetDestroy = options.unset === 'destroy';

  if (Array.isArray(secret) && secret.length === 0) {
    throw new TypeError('secret option array must contain one or more strings');
  }

  if (secret && !Array.isArray(secret)) {
    secret = [secret];
  }

  if (!secret) {
    deprecate('req.secret; provide secret option');
  }

  // notify user that this store is not
  // meant for a production environment
  if ('production' == env && store instanceof MemoryStore) {
    console.warn(warning);
  }

  // generates the new session
  store.generate = function(req){
    req.sessionID = sessionId.generate(req);
    req.session = new Session(req);
    req.session.cookie = new Cookie(cookie);
  };

  store.on('disconnect', function(){ storeReady = false; });
  store.on('connect', function(){ storeReady = true; });

  return function session(req, res, next) {
    // self-awareness
    if (req.session) return next();

    // Handle connection as if there is no session if
    // the store has temporarily disconnected etc
    if (!storeReady) return debug('store is disconnected'), next();

    // ensure a secret is available or bail
    if (!secret && !req.secret) {
      next(new Error('secret option required for sessions'));
      return;
    }

    // backwards compatibility for signed cookies
    // req.secret is passed from the cookie parser middleware
    var secrets = secret || [req.secret];

    req.sessionStore = store;
    req.sessionID = sessionId.get(req, name, secrets);

    onHeaders(res, function(){
      if (!req.session) {
        debug('no session');
        return;
      }

      //TODO: implement parseOptions method and pass here options from
      //middleware function. Decrease amount of closured vars
      sessionId.set(res, name, req.sessionID, {
        secret: secrets[0],
        cookie: req.session.cookie,
        proxy: trustProxy,
        rolling: rollingSessions,
        saveUninitialized: saveUninitializedSession,
        request: req
      });
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

        var contentLength = Number(res.getHeader('Content-Length')) || 0;

        if (contentLength > 0) {
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
      } else if (shouldTouch(req)) {
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

    // determine if session should be destroyed
    function shouldDestroy(req) {
      return req.sessionID && unsetDestroy && req.session == null;
    }

    // determine if session should be saved to store
    function shouldSave(req) {
      // cannot set cookie without a session ID
      if (typeof req.sessionID !== 'string') {
        debug('session ignored because of bogus req.sessionID %o', req.sessionID);
        return false;
      }

      return saveUninitializedSession || req.session.isRetrieved()
        ? !req.session.isSaved()
        : req.session.isModified()
    }

    // determine if session should be touched
    function shouldTouch(req) {
      // cannot set cookie without a session ID
      if (typeof req.sessionID !== 'string') {
        debug('session ignored because of bogus req.sessionID %o', req.sessionID);
        return false;
      }

      return typeof store.touch === 'function' && req.session.isRetrieved() && !shouldSave(req);
    }

    // generate a session if the browser doesn't send a sessionID
    if (!req.sessionID) {
      debug('no SID sent, generating session');
      store.generate(req);
      return next();
    }

    // generate the session object
    debug('fetching %s', req.sessionID);
    store.get(req.sessionID, function(err, sess){
      // error handling
      if (err) {
        debug('error %j', err);

        if (err.code !== 'ENOENT') {
          return next(err);
        }

        // no session
        store.generate(req);
      } else if (!sess) {
        debug('no session found');
        store.generate(req);
      } else {
        debug('session found');
        store.createSession(req, sess);

        if (!resaveSession) {
          req.session.retain();
        }
      }

      next();
    });
  };
};

/**
 * Generate a session ID for a new session.
 *
 * @return {String}
 */
function generateSessionId() {
  return uid(24);
}

/**
 * Get the session ID cookie from request.
 *
 * @return {string}
 */
function getcookie(req, name, secrets) {
  var cookies = cookie.parse(req.headers.cookie || '');
  var raw = req.cookies && req.cookies[name];
  var val = req.signedCookies && req.signedCookies[name];

  if (raw || val) {
    deprecate('cookie should be available in req.headers.cookie');
  }

  raw = cookies[name] || raw;

  if (!raw) {
    return val;
  }

  if (raw.slice(0, 2) !== 's:') {
    debug('cookie unsigned');
    return;
  }

  val = unsigncookie(raw.slice(2), secrets);

  if (val === false) {
    debug('cookie signature invalid');
  }

  return val || undefined;
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
    return typeof req.secure === 'boolean' && req.secure;
  }

  // read the proto from x-forwarded-proto header
  var header = (req.headers['x-forwarded-proto'] || '').split(',');

  return header[0].toLowerCase().trim() === 'https';
}

/**
 * Set cookie on response.
 *
 * @private
 */
function setcookie(res, name, sessionId, options) {
  var req = options.request;
  // only send secure cookies via https
  if (options.cookie.secure && !issecure(req, options.proxy)) {
    debug('not secured');
    return;
  }

  var canSetCookie = req.session.isRetrieved()
    ? options.cookie.expires != null && req.session.isModified()
    : options.saveUninitialized || req.session.isModified();

  var isValidCookiePath = parseUrl.original(options.request).pathname.indexOf(options.cookie.path) === 0;

  if (typeof sessionId !== 'string' || !isValidCookiePath || !(options.rolling || canSetCookie)) {
    return;
  }

  var signed = 's:' + signature.sign(sessionId, options.secret);
  var data = cookie.serialize(name, signed, options.cookie.data);

  debug('set-cookie %s', data);

  var prev = res.getHeader('set-cookie');
  var header = [];

  if (prev) {
    header = header.concat(prev);
  }

  res.setHeader('set-cookie', header.concat(data))
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

/**
 * Creates session id store.
 *
 * @param {Object} [store]
 * @return {Object}
 * @private
 */
function createSessionIdStore(store) {
  store = store || {};

  return {
    set: store.set || exports.sessionId.set,
    get: store.get || exports.sessionId.get,
    generate: store.generate || exports.sessionId.generate
  };
}