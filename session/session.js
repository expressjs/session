/*!
 * Connect - session - Session
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */

'use strict';

/**
 * Node.js 0.8+ async implementation.
 * @private
 */

/* istanbul ignore next */
var defer = typeof setImmediate === 'function'
  ? setImmediate
  : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)) }

/**
 * Expose Session.
 */


/**
 * Create a new `Session` with the given request and `data`.
 *
 * @param {IncomingRequest} req
 * @param {Object} data
 * @api private
 */

class Session {

  constructor(req, data) {
    Object.defineProperty(this, 'req', {value: req});
    Object.defineProperty(this, 'id', {value: req.sessionID});

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
   * @param {Function} fn optional done callback
   * @return {Session} for chaining
   * @api public
   */
  touch(fn){
    this.resetMaxAge();
    if (fn) defer(fn);
    return this;
  }
  /**
   * Reset `.maxAge` to `.originalMaxAge`.
   *
   * @return {Session} for chaining
   * @api public
   */
  resetMaxAge(){
    this.cookie.maxAge = this.cookie.originalMaxAge;
    return this;
  }

  /**
   * Save the session data with optional callback `fn(err)`.
   *
   * @param {Function} fn
   * @return {Session} for chaining
   * @api public
   */
  save(fn){
    this.req.sessionStore.set(this.id, this, fn || function(){});
    return this;
  }
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
  reload(fn){
    const req = this.req
    const store = this.req.sessionStore

    store.get(this.id, function(err, sess){
      if (err) return fn(err);
      if (!sess) return fn(new Error('failed to load session'));
      store.createSession(req, sess);
      fn();
    });
    return this;
  }

  /**
   * Destroy `this` session.
   *
   * @param {Function} fn
   * @return {Session} for chaining
   * @api public
   */
  destroy(fn){
    delete this.req.session;
    this.req.sessionStore.destroy(this.id, fn);
    return this;
  }

  /**
   * Regenerate this request's session.
   *
   * @param {Function} fn
   * @return {Session} for chaining
   * @api public
   */
  regenerate(fn){
    this.req.sessionStore.regenerate(this.req, fn);
    return this;
  }
}

module.exports = Session;
