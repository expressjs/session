/*!
 * Connect - session - Session
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 * @private
 */
var Promise = typeof Promise === 'undefined' ? require('bluebird') : Promise;

/**
 * Expose Session.
 */

module.exports = Session;

/**
 * Create a new `Session` with the given request and `data`.
 *
 * @param {IncomingRequest} req
 * @param {Object} data
 * @api private
 */

function Session(req, data) {
  Object.defineProperty(this, 'req', { value: req });
  Object.defineProperty(this, 'id', { value: req.sessionID });

  if (typeof data === 'object' && data !== null) {
    // merge data into this, ignoring prototype properties
    for (var prop in data) {
      if (!(prop in this)) {
        this[prop] = data[prop]
      }
    }
  }
}

/**
 * Update reset `.cookie.maxAge` to prevent
 * the cookie from expiring when the
 * session is still active.
 *
 * @return {Session} for chaining
 * @api public
 */

defineMethod(Session.prototype, 'touch', function touch() {
  return this.resetMaxAge();
});

/**
 * Reset `.maxAge` to `.originalMaxAge`.
 *
 * @return {Session} for chaining
 * @api public
 */

defineMethod(Session.prototype, 'resetMaxAge', function resetMaxAge() {
  this.cookie.maxAge = this.cookie.originalMaxAge;
  return this;
});

/**
 * Save the session data with optional callback `fn(err)`.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

defineMethod(Session.prototype, 'save', function save(fn) {
  return stdCallbackOrPromiseWrapper.call(
    this,
    this.req.sessionStore,
    'set',
    [ this.id, this ],
    fn);
});

/**
 * Re-loads the session data _without_ altering
 * the maxAge properties. Invokes the callback `fn(err)`,
 * after which time if no exception has occurred the
 * `req.session` property will be a new `Session` object,
 * although representing the same session.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

defineMethod(Session.prototype, 'reload', function reload(fn) {
  var self = this;
  var req = this.req;
  var store = this.req.sessionStore;

  if (typeof fn === 'function') {
    store.get(self.id, function(err, sess){
      if (err) return fn(err);
      if (!sess) return fn(new Error('failed to load session'));
      store.createSession(req, sess);
      fn();
    });
    return this;
  }

  return new Promise(function(resolve, reject){
    store.get(self.id, function(err, sess){
      if (err) return reject(err);
      if (!sess) return reject(new Error('failed to load session'));
      store.createSession(req, sess);
      resolve();
    });
  });
});

/**
 * Destroy `this` session.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

defineMethod(Session.prototype, 'destroy', function destroy(fn) {
  delete this.req.session;
  return stdCallbackOrPromiseWrapper.call(
    this,
    this.req.sessionStore,
    'destroy',
    [ this.id ],
    fn);
});

/**
 * Regenerate this request's session.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

defineMethod(Session.prototype, 'regenerate', function regenerate(fn) {
  return stdCallbackOrPromiseWrapper.call(
    this,
    this.req.sessionStore,
    'regenerate',
    [ this.req ],
    fn);
});

/**
 * Helper function for creating a method on a prototype.
 *
 * @param {Object} obj
 * @param {String} name
 * @param {Function} fn
 * @private
 */
function defineMethod(obj, name, fn) {
  Object.defineProperty(obj, name, {
    configurable: true,
    enumerable: false,
    value: fn,
    writable: true
  });
};

function stdCallbackOrPromiseWrapper(thisArg, method, args, callback) {
  if (typeof callback === 'function') {
    thisArg[method].apply(thisArg, args.concat([ callback ]))
    return this
  }

  return new Promise(function(resolve, reject) {
    thisArg[method].apply(thisArg, args.concat([function(err) {
      if (err) return reject(err)
      resolve()
    }]))
  })
}
