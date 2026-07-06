/*!
 * Connect - session - Session
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */

'use strict';

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
 * @param {Function} [fn]
 * @return {Session|Promise} for chaining
 * @api public
 */

defineMethod(Session.prototype, 'save', function save(fn) {
  var self = this;
  var store = this.req.sessionStore;

  return callbackOrPromise(this, fn, function (done) {
    store.set(self.id, self, done);
  }, self);
});

/**
 * Re-loads the session data _without_ altering
 * the maxAge properties. Invokes the callback `fn(err)`,
 * after which time if no exception has occurred the
 * `req.session` property will be a new `Session` object,
 * although representing the same session.
 *
 * @param {Function} [fn]
 * @return {Session|Promise} for chaining
 * @api public
 */

defineMethod(Session.prototype, 'reload', function reload(fn) {
  var req = this.req;
  var store = this.req.sessionStore;
  var id = this.id;

  return callbackOrPromise(this, fn, function (done) {
    store.get(id, function (err, sess) {
      if (err) return done(err);
      if (!sess) return done(new Error('failed to load session'));
      store.createSession(req, sess);
      done();
    });
  });
});

/**
 * Destroy `this` session.
 *
 * @param {Function} [fn]
 * @return {Session|Promise} for chaining
 * @api public
 */

defineMethod(Session.prototype, 'destroy', function destroy(fn) {
  var store = this.req.sessionStore;
  var id = this.id;

  delete this.req.session;

  return callbackOrPromise(this, fn, function (done) {
    store.destroy(id, done);
  });
});

/**
 * Regenerate this request's session.
 *
 * @param {Function} [fn]
 * @return {Session|Promise} for chaining
 * @api public
 */

defineMethod(Session.prototype, 'regenerate', function regenerate(fn) {
  var req = this.req;
  var store = this.req.sessionStore;

  return callbackOrPromise(this, fn, function (done) {
    store.regenerate(req, done);
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
 * Run `executor(done)` in callback or promise style: with a callback,
 * return `session` for chaining; without one, return a `Promise`
 * resolving to `value`, or the request's current session by default.
 *
 * @private
 */

function callbackOrPromise(session, callback, executor, value) {
  if (typeof callback === 'function') {
    executor(callback)
    return session
  }

  return new Promise(function (resolve, reject) {
    executor(function (err) {
      if (err) return reject(err)
      resolve(value !== undefined ? value : session.req.session)
    })
  })
}
