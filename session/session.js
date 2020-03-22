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
  var self = this;
  return new Promise(function(resolve, reject){
    self.req.sessionStore.set(self.id, self, function(err) {
      if (err) return rejectPromise(err, fn, reject);
      resolvePromise(null, fn, resolve);
    });
  });
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

  return new Promise(function(resolve, reject){
    store.get(self.id, function(err, sess){
      if (err) return rejectPromise(err, fn, reject);
      if (!sess) return rejectPromise(new Error('failed to load session'), fn, reject);
      store.createSession(req, sess);
      resolvePromise(null, fn, resolve);
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
  var self = this;
  return new Promise(function(resolve, reject){
    delete self.req.session;
    self.req.sessionStore.destroy(self.id, function(err) {
      if (err) return rejectPromise(err, fn, reject);
      resolvePromise(null, fn, resolve);
    });
  });
});

/**
 * Regenerate this request's session.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

defineMethod(Session.prototype, 'regenerate', function regenerate(fn) {
  var self = this;
  return new Promise(function(resolve, reject){
    self.req.sessionStore.regenerate(self.req, function(err) {
      if (err) return rejectPromise(err, fn, reject);
      resolvePromise(null, fn, resolve);
    });
  });
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

/**
 * Wrapper for returning a callback with
 * an error and rejecting a promise
 *
 * @param {Error/String} error
 * @param {Function} callback
 * @param {Function} reject
 */
function rejectPromise(err, callback, reject) {
  callback = callback || function(){};
  callback(err);
  reject(err);
}

/**
 * Wrapper for returning a callback with
 * a response and resolving a promise
 *
 * @param {Any} response
 * @param {Function} callback
 * @param {Function} resolve
 */
function resolvePromise(response, callback, resolve) {
  callback = callback || function(){};
  callback(null, response);
  resolve(response);
}
