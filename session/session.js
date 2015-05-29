
/*!
 * Connect - session - Session
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */

var crc = require('crc').crc32;

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
  Object.defineProperties(this, {
    req: { value: req },
    id:  { value: req.sessionID },
    _hashCode: { writable: true, value: {} },
    _isRetrieved: { writable: true, value: false }
  });

  if (typeof data === 'object' && data !== null) {
    this._isRetrieved = true;
    // merge data into this, ignoring prototype properties
    for (var prop in data) {
      if (!(prop in this)) {
        this[prop] = data[prop]
      }
    }
  }

  this._hashCode.original = hash(this);
}

/**
 * Update reset `.cookie.maxAge` to prevent
 * the cookie from expiring when the
 * session is still active.
 *
 * @return {Session} for chaining
 * @api public
 */

Session.prototype.touch = function(){
  return this.resetMaxAge();
};

/**
 * Reset `.maxAge` to `.originalMaxAge`.
 *
 * @return {Session} for chaining
 * @api public
 */

Session.prototype.resetMaxAge = function(){
  this.cookie.maxAge = this.cookie.originalMaxAge;
  return this;
};

/**
 * Save the session data with optional callback `fn(err)`.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

Session.prototype.save = function(fn){
  this._hashCode.saved = hash(this);
  this.req.sessionStore.set(this.id, this, fn || function(){});
  return this;
};

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

Session.prototype.reload = function(fn){
  var req = this.req
    , store = this.req.sessionStore;
  store.get(this.id, function(err, sess){
    if (err) return fn(err);
    if (!sess) return fn(new Error('failed to load session'));
    store.createSession(req, sess);
    fn();
  });
  return this;
};

/**
 * Destroy `this` session.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

Session.prototype.destroy = function(fn){
  delete this.req.session;
  this.req.sessionStore.destroy(this.id, fn);
  return this;
};

/**
 * Regenerate this request's session.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

Session.prototype.regenerate = function(fn){
  this.req.sessionStore.regenerate(this.req, fn);
  return this;
};

/**
 * Check if session is modified.
 *
 * @return {boolean}
 * @api public
 */

Session.prototype.isModified = function(){
  return this.id !== this.req.sessionID || this._hashCode.original !== hash(this);
};

/**
 * Check if session is saved.
 *
 * @return {boolean}
 * @api public
 */

Session.prototype.isSaved = function(){
  return this.id === this.req.sessionID && this._hashCode.saved === hash(this);
};

/**
 * Check if session is retrieved from storage.
 *
 * @return {boolean}
 * @api public
 */

Session.prototype.isRetrieved = function(){
  return this._isRetrieved;
};

/**
 * Retain session. Set saved hash code to original hash code value.
 * TODO: Probably this method will be removed in funture
 *
 * @return {Session} for chaining
 * @api public
 */

Session.prototype.retain = function(){
  this._hashCode.saved = this._hashCode.original;
  return this;
};

/**
 * Hash the given `sess` object omitting changes to `.cookie`.
 *
 * @param {Object} sess
 * @return {String}
 * @private
 */

function hash(sess) {
  return crc(JSON.stringify(sess, function (key, val) {
    if (key !== 'cookie') {
      return val;
    }
  }));
}