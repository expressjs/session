/*!
 * express-session
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 * @private
 */

var util = require("util");

/**
 * Shim setImmediate for node.js < 0.10
 * @private
 */

/* istanbul ignore next */
var defer = typeof setImmediate === 'function'
    ? setImmediate
    : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)) };

/**
 * Determines whether a session is expired. If it is expired - the session will be deleted.
 * @param {MemoryStore} store
 * @param {String} sid
 * @param {Object} session
 * @param {Number} when
 * @returns {boolean} true if the session has expired
 */
var checkSessionExpired = function (store, sid, session, when) {

  if (!session) return true;

  var expires = session.cookie ?
      typeof session.cookie.expires === 'string'
          ? new Date(session.cookie.expires)
          : session.cookie.expires :
      null;

  if (session.cookie && !expires) {

    // There IS a cookie, but the cookie is a browser-session cookie.
    // So let's figure out the TTL for this session.

    if (!store.disableTTL && store._sessionsAccessStore[sid]) {
      expires = store._sessionsAccessStore[sid] + store.ttl;
    }

  }

  if (!expires || expires <= when) {
    delete store._sessions[sid];
    delete store._sessionsAccessStore[sid];
    return true;
  }

  return false;
};

/**
 * https://github.com/expressjs/session#session-store-implementation
 *
 * @param {object} session  express session
 * @return {Function} the `FileStore` extending `express`'s session Store
 *
 * @api public
 */
module.exports = function (session) {

  /**
   * Express' session Store.
   */

  var Store = session.Store;

  /**
   * Initialize MemoryStore with the given `options`
   *
   * @param {Object} options (optional)
   * @param {Number=3600} options.ttl - How many seconds to keep a session alive since the last access to it, in case the cookie is a browser-session.
   * @param {Boolean=false} options.disableTTL - Should ttl be disabled
   * @param {Number|Boolean=1800} options.automaticExpiration - Interval in seconds for checking for expired sessions. Set to 0 or false to disable.
   * @api public
   */

  var MemoryStore = function (options) {
    var that = this;

    options = options || {};
    Store.call(that, options);

    /**
     * This is where the serialized sessions are stored
     * @type {Object.<String, String>}
     * @private
     */
    that._sessions = {};

    /**
     * This is where the session last access time is saved
     * @type {Object.<String, Number>}
     * @private
     */
    that._sessionsAccessStore = {};

    that.ttl = (options.ttl || 3600) * 1000;
    that.disableTTL = !!options.disableTTL;
    that.automaticExpiration = options.automaticExpiration == null ? true : options.automaticExpiration;

    if (that.automaticExpiration && typeof that.automaticExpiration !== 'number') {
      that.automaticExpiration = 1800;
    }

    if (that.automaticExpiration) {
      setInterval(function () {

        /* istanbul ignore next */
        that._checkForExpiredSessions();

      }, 1000 * that.automaticExpiration);
    }
  };

  /**
   * Inherit from `Store`.
   */

  util.inherits(MemoryStore, Store);

  /**
   * Attempt to fetch session by the given `sid`.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */

  MemoryStore.prototype.get = function (sid, fn) {
    var session = this._sessions[sid];

    if (!session) {
      /* istanbul ignore next */
      return fn && defer(fn, null, null)
    }

    var now = Date.now();

    // Parse session
    session = JSON.parse(session);

    if (checkSessionExpired(this, sid, session, now)) {
      /* istanbul ignore next */
      fn && defer(fn, null, null);
    }

    if (!this.disableTTL) {
      this._sessionsAccessStore[sid] = Math.max(this._sessionsAccessStore[sid] || 0, now);
    }

    fn && defer(fn, null, session);
  };

  /**
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} session
   * @param {Function} fn
   * @api public
   */

  MemoryStore.prototype.set = function (sid, session, fn) {

    try {
      var serializedSession = JSON.stringify(session);
    }
    catch (err) {
      /* istanbul ignore next */
      return fn && defer(fn, err);
    }

    this._sessions[sid] = serializedSession;

    if (!this.disableTTL) {
      this._sessionsAccessStore[sid] = Math.max(this._sessionsAccessStore[sid] || 0, Date.now());
    }

    fn && defer(fn, null);
  };

  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */

  MemoryStore.prototype.destroy = function (sid, fn) {

    delete this._sessions[sid];
    delete this._sessionsAccessStore[sid];

    fn && defer(fn, null);
  };

  /**
   * Refresh the time-to-live for the session with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} session
   * @param {Function} fn
   * @api public
   */

  MemoryStore.prototype.touch = function (sid, session, fn) {

    var now = Date.now();

    /**
     * @type {String|{cookie: ?}}
     */
    var currentSession = this._sessions[sid];

    if (!currentSession) {
      /* istanbul ignore next */
      return fn && defer(fn, null);
    }

    // Parse session
    currentSession = JSON.parse(currentSession);

    if (checkSessionExpired(this, sid, currentSession, now)) {
      /* istanbul ignore next */
      return fn && defer(fn, null);
    }

    if (!this.disableTTL) {
      this._sessionsAccessStore[sid] = Math.max(this._sessionsAccessStore[sid] || 0, now);
    }

    currentSession.cookie = session.cookie;
    this._sessions[sid] = JSON.stringify(currentSession);

    fn && defer(fn, null);
  };

  /**
   * Fetches the count of all sessions in the store.
   *
   * @param {Function} fn
   * @api public
   */

  MemoryStore.prototype.length = function (fn) {
    fn && defer(fn, null, Object.keys(this._sessions).length);
  };

  /**
   * Delete all sessions from the store
   *
   * @param {Function} fn
   * @api public
   */

  MemoryStore.prototype.clear = function (fn) {

    this._sessions = {};
    this._sessionsAccessStore = {};

    fn && defer(fn, null);
  };

  /**
   * Get all active sessions.
   *
   * @param {function} fn
   * @public
   */

  MemoryStore.prototype.all = function (fn) {

    var sessionIds = Object.keys(this._sessions);
    var sessions = {};

    var now = Date.now();

    for (var i = 0; i < sessionIds.length; i++) {
      var sid = sessionIds[i];
      var session = JSON.parse(this._sessions[sid]);

      if (!checkSessionExpired(this, sid, session, now)) {
        sessions[sid] = session;
      }
    }

    fn && defer(fn, null, sessions);
  };

  /**
   * Check for expired sessions.
   *
   */

  /* istanbul ignore next */
  MemoryStore.prototype._checkForExpiredSessions = function () {

    var sessionIds = Object.keys(this._sessions);

    var now = Date.now();

    for (var i = 0; i < sessionIds.length; i++) {
      var sid = sessionIds[i];
      var session = JSON.parse(this._sessions[sid]);

      checkSessionExpired(this, sid, session, now);
    }

  };

  return MemoryStore;
};