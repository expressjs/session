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
const Store = require('./store');

/**
 * Shim setImmediate for node.js < 0.10
 * @private
 */

/* istanbul ignore next */
const defer = typeof setImmediate === 'function'
    ? setImmediate
    : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)) }

/**
 * Module exports.
 */


    /**
     * A session store in memory.
     * @public
     */
    class MemoryStore extends Store {
      sessions;
      constructor() {
        super()
        this.sessions = Object.create(null)
      }

      /**
       * Get all active sessions.
       *
       * @param {function} callback
       * @public
       */
      all = (callback) =>{
        const sessionIds = Object.keys(this.sessions)
        const sessions = Object.create(null)

        for (let i = 0; i < sessionIds.length; i++) {
          const sessionId = sessionIds[i]
          const session = this.getSession.call(this, sessionId)

          if (session) {
            sessions[sessionId] = session;
          }
        }

        callback && defer(callback, null, sessions)
      }
      /**
       * Clear all sessions.
       *
       * @param {function} callback
       * @public
       */
      clear = (callback) =>{
        this.sessions = Object.create(null)
        callback && defer(callback)
      }
      /**
       * Destroy the session associated with the given session ID.
       *
       * @param {string} sessionId
       * @param callback
       * @public
       */
      destroy = (sessionId, callback) =>{
        delete this.sessions[sessionId]
        callback && defer(callback)
      }
      /**
       * Fetch session by the given session ID.
       *
       * @param {string} sessionId
       * @param {function} callback
       * @public
       */
      get = (sessionId, callback) =>{
        defer(callback, null, this.getSession.call(this, sessionId))
      }

      /**
       * Commit the given session associated with the given sessionId to the store.
       *
       * @param {string} sessionId
       * @param {object} session
       * @param {function} callback
       * @public
       */
      set = (sessionId, session, callback)=> {
        session.req&&delete session.req.value
        this.sessions[sessionId] = JSON.stringify(session)
        callback && defer(callback)
      }

      /**
       * Get number of active sessions.
       *
       * @param {function} callback
       * @public
       */

      length = (callback) =>{
        this.all(function (err, sessions) {
          if (err) return callback(err)
          callback(null, Object.keys(sessions).length)
        })
      }

      /**
       * Touch the given session object associated with the given session ID.
       *
       * @param {string} sessionId
       * @param {object} session
       * @param {function} callback
       * @public
       */
      touch = (sessionId, session, callback) =>{
        const currentSession = this.getSession.call(this, sessionId)

        if (currentSession) {
          // update expiration
          currentSession.cookie = session.cookie
          this.sessions[sessionId] = JSON.stringify(currentSession)
        }

        callback && defer(callback)
      }

      /**
       * Get session from the store.
       * @private
       */
      getSession = (sessionId) =>{
        let sess
        let unwrapped_id

        if (typeof sessionId === 'string') {
          unwrapped_id = sessionId
        } else {
          // @ts-ignore
          unwrapped_id = sessionId.value
        }

        sess = this.sessions[unwrapped_id]

        if (!sess) {
          return
        }

        // parse
        sess = JSON.parse(sess)

        if (sess.cookie) {
          const expires = typeof sess.cookie.expires === 'string'
              ? new Date(sess.cookie.expires)
              : sess.cookie.expires

          // destroy expired session
          if (expires && expires <= Date.now()) {
            delete this.sessions[unwrapped_id]
            return
          }
        }

        return sess
      }
    }
module.exports = MemoryStore;



