/*!
 * Connect - session - Session
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */

'use strict';

// FIXME: must convert to class, because: https://github.com/microsoft/TypeScript/issues/36369

/**
 * @typedef {import('express').Request} ExpressRequest
 * @typedef {{sessionID: string, session: Object.<string, any>, sessionStore: Object}} SessionRequest
 * @typedef {ExpressRequest & SessionRequest} IncomingRequest
 * @typedef {{[x: string]: string}} SessionData
 */

/**
 * Session TODO: write description
 * @class
 */

class Session {
  /**
   * Create a new `Session` with the given request and `data`.
   *
   * @param {IncomingRequest} req
   * FIXME: add `| null`
   * @param {SessionData} data
   * @private
   */
  constructor(req, data) {
    Object.defineProperty(this, 'req', { value: req })
    Object.defineProperty(this, 'id', { value: req.sessionID })

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
   * @public
   */

  touch() {
    return this.resetMaxAge()
  }

  /**
   * Reset `.maxAge` to `.originalMaxAge`.
   *
   * @return {Session} for chaining
   * @private
   */

  resetMaxAge() {
    if (this.cookie) {
      this.cookie.maxAge = this.cookie.originalMaxAge
    }
    return this
  }

  /**
   * Save the session data with optional callback `fn(err)`.
   *
   * @param {Function} fn
   * @return {Session} for chaining
   * @api public
   */

  save(fn) {
    this.req.sessionStore.set(this.id, this, fn || function() { })
    return this
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

  reload(fn) {
    var req = this.req
    var store = this.req.sessionStore

    store.get(this.id, function(err, sess) {
      if (err) return fn(err)
      if (!sess) return fn(new Error('failed to load session'))
      store.createSession(req, sess)
      fn()
    })
    return this
  }

  /**
   * Destroy `this` session.
   *
   * @param {Function} fn
   * @return {Session} for chaining
   * @api public
   */

  destroy(fn) {
    delete this.req.session
    this.req.sessionStore.destroy(this.id, fn)
    return this
  }

  /**
   * Regenerate this request's session.
   *
   * @param {Function} fn
   * @return {Session} for chaining
   * @api public
   */

  regenerate(fn) {
    this.req.sessionStore.regenerate(this.req, fn)
    return this
  }
}

module.exports = Session;
