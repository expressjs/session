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
 * @return {Promise}
 * @api public
 */

defineMethod(Session.prototype, 'save', function save (fn) {
  if (fn) {
    this.req.sessionStore.set(this.id, this, fn)
    return
  }

  if (!fn && !global.Promise) {
    this.req.sessionStore.set(this.id, this, function(){})
    return
  }

  var sess = this
  return new Promise(function (resolve, reject) {
    sess.req.sessionStore.set(sess.id, sess, function (err) {
      if (err) reject(err)
      resolve()
    })
  })
})

/**
 * Re-loads the session data _without_ altering
 * the maxAge properties. Invokes the callback `fn(err)`,
 * after which time if no exception has occurred the
 * `req.session` property will be a new `Session` object,
 * although representing the same session.
 *
 * @param {Function} [fn]
 * @return {Promise}
 * @api public
 */

defineMethod(Session.prototype, 'reload', function reload (fn) {
  var req = this.req
  var store = this.req.sessionStore
  if (fn) {
    store.get(this.id, function (err, sess) {
      if (err) return fn(err)
      if (!sess) return fn(new Error('failed to load session'))
      store.createSession(req, sess)
      fn()
    })
    return
  }

  if (!fn && !global.Promise) {
    throw new Error('must use callback without promises')
  }

  var parent = this
  return new Promise(function (resolve, reject) {
    store.get(parent.id, function (err, sess) {
      if (err) reject(err)
      if (!sess) reject(new Error('failed to load session'))
      store.createSession(req, sess)
      resolve()
    })
  })
})

/**
 * Destroy `this` session.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

defineMethod(Session.prototype, 'destroy', function destroy(fn) {
  delete this.req.session
  if (fn) {
    this.req.sessionStore.destroy(this.id, fn)
    return
  }

  if (!fn && !global.Promise) {
    throw new Error('must use callback without promises')
  }

  var parent = this
  return new Promise(function (resolve, reject) {
    parent.req.sessionStore.destroy(parent.id, function(err) {
      if (err) reject(err)
      resolve()
    })
  })
})

/**
 * Regenerate this request's session.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

defineMethod(Session.prototype, 'regenerate', function regenerate(fn) {
  if (fn) {
    this.req.sessionStore.regenerate(this.req, fn)
    return
  }

  if (!fn && !global.Promise) {
    throw new Error('must use callback without promises')
  }

  var sess = this
  return new Promise(function (resolve, reject) {
    sess.req.sessionStore.regenerate(sess.req, function(err) {
      if (err) reject(err)
      resolve()
    })
  })
})

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
