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
  Object.defineProperty(this, 'cookie', { value: undefined, writable: true })

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

Object.defineProperty(Session.prototype, 'touch', { value: function(){
  return this.resetMaxAge();
} });

/**
 * Reset `.maxAge` to `.originalMaxAge`.
 *
 * @return {Session} for chaining
 * @api public
 */

Object.defineProperty(Session.prototype, 'resetMaxAge', { value: function(){
  this.cookie.maxAge = this.cookie.originalMaxAge;
  return this;
} });

/**
 * Save the session data with optional callback `fn(err)`.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

Object.defineProperty(Session.prototype, 'save', { value: function(fn){
  this.req.sessionStore.set(this.id, this, fn || function(){});
  return this;
} });

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

Object.defineProperty(Session.prototype, 'reload', { value: function(fn){
  var req = this.req
    , store = this.req.sessionStore;
  store.get(this.id, function(err, sess){
    if (err) return fn(err);
    if (!sess) return fn(new Error('failed to load session'));
    store.createSession(req, sess);
    fn();
  });
  return this;
} });

/**
 * Destroy `this` session.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

Object.defineProperty(Session.prototype, 'destroy', { value: function(fn){
  delete this.req.session;
  this.req.sessionStore.destroy(this.id, fn);
  return this;
} });

/**
 * Regenerate this request's session.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

Object.defineProperty(Session.prototype, 'regenerate', { value: function(fn){
  this.req.sessionStore.regenerate(this.req, fn);
  return this;
} });
