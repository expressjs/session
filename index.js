/*!
 * Connect - session
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var uid = require('uid2')
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
    , trustProxy = options.proxy || false
    , storeReady = true
    , rollingSessions = options.rolling || false;

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
    var writeHead = res.writeHead;
    res.writeHead = function(){
      if (!req.session) {
        debug('no session');
        writeHead.apply(res, arguments);
        return;
      }

      var cookie = req.session.cookie
        , proto = (req.headers['x-forwarded-proto'] || '').split(',')[0].toLowerCase().trim()
        , tls = req.connection.encrypted || (trustProxy && 'https' == proto)
        , isNew = unsignedCookie != req.sessionID;

      // only send secure cookies via https
      if (cookie.secure && !tls) {
        debug('not secured');
        writeHead.apply(res, arguments);
        return;
      }

      // in case of rolling session, always reset the cookie
      if (!rollingSessions) {

        // browser-session length cookie
        if (null == cookie.expires) {
          if (!isNew) {
            debug('already set browser-session cookie');
            writeHead.apply(res, arguments);
            return
          }
        // compare hashes and ids
        } else if (originalHash == hash(req.session) && originalId == req.session.id) {
          debug('unmodified session');
          writeHead.apply(res, arguments);
          return
        }

      }

      var val = 's:' + signature.sign(req.sessionID, secret);
      debug('set-cookie %s', val);
      res.cookie(name, val, cookie.data);
      writeHead.apply(res, arguments);
    };

    // proxy end() to commit the session
    var end = res.end;
    res.end = function(data, encoding){
      res.end = end;
      if (!req.session) return res.end(data, encoding);
      debug('saving');
      req.session.resetMaxAge();
      req.session.save(function(err){
        if (err) console.error(err.stack);
        debug('saved');
        res.end(data, encoding);
      });
    };

    // generate the session
    function generate() {
      store.generate(req);
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
