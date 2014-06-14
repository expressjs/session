/*!
 * express-session
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var uid = require('uid2')
  , onHeaders = require('on-headers')
  , crc32 = require('buffer-crc32')
  , parse = require('url').parse
  , signature = require('cookie-signature')
  , debug = require('debug')('session')

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

/**
 * Warning message for `MemoryStore` usage in production.
 */

var warning = 'Warning: connect.session() MemoryStore is not\n'
  + 'designed for a production environment, as it will leak\n'
  + 'memory, and will not scale past a single process.';

/**
 * Setup session store with the given `options`.
 *
 * See README.md for documentation of options and formatting.
 *
 * Session data is _not_ saved in the cookie itself, however cookies are used,
 * so you must use the cookie-parser middleware _before_ `session()`.
 * [https://github.com/expressjs/cookie-parser]
 *
 * @param {Object} options
 * @return {Function} middleware
 * @api public
 */

function session(options){
  var options = options || {}
  //  name - previously "options.key"
    , name = options.name || options.key || 'connect.sid'
    , store = options.store || new MemoryStore
    , cookie = options.cookie || {}
    , trustProxy = options.proxy
    , storeReady = true
    , rollingSessions = options.rolling || false;

  // TODO: switch default to false on next major
  var resaveSession = options.resave === undefined
    ? true
    : options.resave;

  // notify user that this store is not
  // meant for a production environment
  if ('production' == env && store instanceof MemoryStore) {
    console.warn(warning);
  }

  // generates the new session
  store.generate = function(req){
    req.sessionID = uid(24);
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

    // pathname mismatch
    var originalPath = parse(req.originalUrl).pathname;
    if (0 != originalPath.indexOf(cookie.path || '/')) return next();

    // backwards compatibility for signed cookies
    // req.secret is passed from the cookie parser middleware
    var secret = options.secret || req.secret;

    // ensure secret is available or bail
    if (!secret) throw new Error('`secret` option required for sessions');

    var originalHash
      , originalId;

    // expose store
    req.sessionStore = store;

    // grab the session cookie value and check the signature
    var rawCookie = req.cookies[name];

    // get signedCookies for backwards compat with signed cookies
    var unsignedCookie = req.signedCookies[name];

    if (!unsignedCookie && rawCookie) {
      unsignedCookie = (0 == rawCookie.indexOf('s:'))
        ? signature.unsign(rawCookie.slice(2), secret)
        : rawCookie;
    }

    // set-cookie
    onHeaders(res, function(){
      if (!req.session) {
        debug('no session');
        return;
      }

      var cookie = req.session.cookie;

      // only send secure cookies via https
      if (cookie.secure && !issecure(req, trustProxy)) {
        debug('not secured');
        return;
      }

      var isNew = unsignedCookie != req.sessionID;

      // in case of rolling session, always reset the cookie
      if (!rollingSessions) {

        // browser-session length cookie
        if (null == cookie.expires) {
          if (!isNew) {
            debug('already set browser-session cookie');
            return
          }
        // compare hashes and ids
        } else if (!isModified(req.session)) {
          debug('unmodified session');
          return
        }

      }

      var val = 's:' + signature.sign(req.sessionID, secret);
      debug('set-cookie %s', val);
      res.cookie(name, val, cookie.data);
    });

    // proxy end() to commit the session
    var end = res.end;
    res.end = function(data, encoding){
      res.end = end;
      if (!req.session) return res.end(data, encoding);
      req.session.resetMaxAge();

      if (resaveSession || isModified(req.session)) {
        debug('saving');
        return req.session.save(function(err){
          if (err) console.error(err.stack);
          debug('saved');
          res.end(data, encoding);
        });
      }

      res.end(data, encoding);
    };

    // generate the session
    function generate() {
      store.generate(req);
    }

    // check if session has been modified
    function isModified(sess) {
      return originalHash != hash(sess) || originalId != sess.id;
    }

    // get the sessionID from the cookie
    req.sessionID = unsignedCookie;

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
        if ('ENOENT' == err.code) {
          generate();
          next();
        } else {
          next(err);
        }
      // no session
      } else if (!sess) {
        debug('no session found');
        generate();
        next();
      // populate req.session
      } else {
        debug('session found');
        store.createSession(req, sess);
        originalId = req.sessionID;
        originalHash = hash(sess);
        next();
      }
    });
  };
};

/**
 * Hash the given `sess` object omitting changes to `.cookie`.
 *
 * @param {Object} sess
 * @return {String}
 * @api private
 */

function hash(sess) {
  return crc32.signed(JSON.stringify(sess, function(key, val){
    if ('cookie' != key) return val;
  }));
}

/**
 * Determine if request is secure.
 *
 * @param {Object} req
 * @param {Boolean} [trustProxy]
 * @return {Boolean}
 * @api private
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
