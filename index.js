/*!
 * express-session
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */

var deprecate = require('depd')('express-session');
var uid = require('uid-safe').sync;

var Session = require('./session/session')
  , MemoryStore = require('./session/memory')
  , Cookie = require('./session/cookie')
  , Store = require('./session/store')
  , CookieDriver = require('./driver/cookie')

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
 * @private
 */

var warning = 'Warning: connect.session() MemoryStore is not\n'
  + 'designed for a production environment, as it will leak\n'
  + 'memory, and will not scale past a single process.';

/**
 * Node.js 0.8+ async implementation.
 * @private
 */

/**
 * Setup session store with the given `options`.
 *
 * @param {Object} [options]
 * @param {Object} [options.cookie] Options for cookie
 * @param {Function} [options.genid]
 * @param {String} [options.name=connect.sid] Session ID cookie name
 * @param {Boolean} [options.proxy]
 * @param {Boolean} [options.resave] Resave unmodified sessions back to the store
 * @param {Boolean} [options.rolling] Enable/disable rolling session expiration
 * @param {Boolean} [options.saveUninitialized] Save uninitialized sessions to the store
 * @param {String|Array} [options.secret] Secret for signing session ID
 * @param {Object} [options.store=MemoryStore] Session store
 * @param {String} [options.unset]
 * @return {Function} middleware
 * @public
 */

function session(options){
  var options = options || {}
    , store = options.store || new MemoryStore
  var resaveSession = options.resave;
  var saveUninitializedSession = options.saveUninitialized;
  var driverOptions = {
    name: options.name || options.key || 'connect.sid',
    storeReady: true,
    secret: options.secret,
    saveUninitializedSession: options.saveUninitialized,
    rollingSessions: options.rolling || false,
    resaveSession: options.resave,
    trustProxy: options.proxy,
    cookie: options.cookie || {},
  };

  var generateId = options.genid || generateSessionId;

  if (typeof generateId !== 'function') {
    throw new TypeError('genid option must be a function');
  }

  if (driverOptions.resaveSession === undefined) {
    deprecate('undefined resave option; provide resave option');
    driverOptions.resaveSession = true;
  }

  if (driverOptions.saveUninitializedSession === undefined) {
    deprecate('undefined saveUninitialized option; provide saveUninitialized option');
    driverOptions.saveUninitializedSession = true;
  }

  if (options.unset && options.unset !== 'destroy' && options.unset !== 'keep') {
    throw new TypeError('unset option must be "destroy" or "keep"');
  }

  // TODO: switch to "destroy" on next major
  driverOptions.destroy = options.unset === 'destroy';

  if (Array.isArray(driverOptions.secret) && driverOptions.secret.length === 0) {
    throw new TypeError('secret option array must contain one or more strings');
  }

  if (driverOptions.secret && !Array.isArray(driverOptions.secret)) {
    driverOptions.secret = [driverOptions.secret];
  }

  if (!driverOptions.secret) {
    deprecate('req.secret; provide secret option');
  }

  // notify user that this store is not
  // meant for a production environment
  if ('production' == env && store instanceof MemoryStore) {
    console.warn(warning);
  }

  // generates the new session
  store.generate = function(req){
    req.sessionID = generateId(req);
    req.session = new Session(req);
    req.session.cookie = new Cookie(driverOptions.cookie);
  };

  driverOptions.storeImplementsTouch = typeof store.touch === 'function';
  store.on('disconnect', function(){ driverOptions.storeReady = false; });
  store.on('connect', function(){ driverOptions.storeReady = true; });

  return CookieDriver(store, driverOptions);
};

/**
 * Generate a session ID for a new session.
 *
 * @return {String}
 * @private
 */

function generateSessionId(sess) {
  return uid(24);
}
