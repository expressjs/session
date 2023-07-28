/*!
 * Connect - session - Store
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 * @private
 */

const Cookie = require('./cookie')
const EventEmitter = require('events').EventEmitter
const Session = require('./session')

/**
 * Module exports.
 * @public
 */


/**
 * Abstract base class for session stores.
 * @public
 */

class Store extends EventEmitter {

  constructor() {
    super();
    EventEmitter.call(this)
  }
  /**
   * Re-generate the given request's session.
   *
   * @param  req
   * @param {Function} fn
   * @api public
   */
  regenerate(req, fn){
    const self = this;
    this.destroy(req.sessionID, (err)=>{
      self.generate(req);
      fn(err);
    });
  }
  /**
   * Load a `Session` instance via the given `sid`
   * and invoke the callback `fn(err, sess)`.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */
  load(sid, fn){
    const self = this;
    this.get(sid, function(err, sess){
      if (err) return fn(err);
      if (!sess) return fn();
      const req = { sessionID: sid, sessionStore: self };
      fn(null, self.createSession(req, sess))
    });
  }
  /**
   * Create session from JSON `sess` data.
   *
   * @param {Function} req
   * @param {Object} sess
   * @return {Session}
   * @api private
   */
  createSession(req, sess) {
    const expires = sess.cookie.expires
    const originalMaxAge = sess.cookie.originalMaxAge

    sess.cookie = new Cookie(sess.cookie);

    if (typeof expires === 'string') {
      // convert expires to a Date object
      sess.cookie.expires = new Date(expires)
    }

    // keep originalMaxAge intact
    sess.cookie.originalMaxAge = originalMaxAge

    req.session = new Session(req, sess);
    return req.session;
  }
}


module.exports = Store
