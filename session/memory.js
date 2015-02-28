/*!
 * express-session
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */

var Store = require('./store')
var util = require('util')

/**
 * Shim setImmediate for node.js < 0.10
 * @private
 */

/* istanbul ignore next */
var defer = typeof setImmediate === 'function'
  ? setImmediate
  : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)) }

/**
 * Module exports.
 */

module.exports = MemoryStore

/**
 * A session store in memory.
 * @public
 */

function MemoryStore(options) {
  Store.call(this)
  this.cacheLimit = options && options.cacheLimit || 1000
  this.sessions = Object.create(null)
  this.first = null
  this.last = null
  this.l = 0
}

/**
 * Inherit from Store.
 */

util.inherits(MemoryStore, Store)

/**
 * Get all active sessions.
 *
 * @param {function} callback
 * @public
 */

MemoryStore.prototype.all = function all(callback) {
  var sessionIds = Object.keys(this.sessions)
  var sessions = Object.create(null)

  for (var i = 0; i < sessionIds.length; i++) {
    var sessionId = sessionIds[i]
    var session = getSession.call(this, sessionId)

    if (session) {
      sessions[sessionId] = session
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

MemoryStore.prototype.clear = function clear(callback) {
  this.sessions = Object.create(null)
  this.last = null
  this.first = null
  this.l = 0
  callback && defer(callback)
}

/**
 * Destroy the session associated with the given session ID.
 *
 * @param {string} sessionId
 * @public
 */

MemoryStore.prototype.destroy = function destroy(sessionId, callback) {
  var sess = this.sessions[sessionId]
  delete this.sessions[sessionId]

  if(typeof sess !== 'undefined'){
    if(sess.next !== null) sess.next.prev = sess.prev
    if(sess.prev !== null) sess.prev.next = sess.next

    if(this.last !== null && this.last.id === sessionId){
      this.last = this.last.next
    }

    if(this.first !== null && this.first.id === sessionId){
      this.first = this.first.prev
    }

    this.l--
  }

  callback && defer(callback)
}

/**
 * Fetch session by the given session ID.
 *
 * @param {string} sessionId
 * @param {function} callback
 * @public
 */

MemoryStore.prototype.get = function get(sessionId, callback) {
  defer(callback, null, getSession.call(this, sessionId))
}

/**
 * Commit the given session associated with the given sessionId to the store.
 *
 * @param {string} sessionId
 * @param {object} session
 * @param {function} callback
 * @public
 */

/**
 * Get number of active sessions.
 *
 * @param {function} callback
 * @public
 */

MemoryStore.prototype.length = function length(callback) {
  callback(null, this.l)
}

MemoryStore.prototype.set = function set(sessionId, session, callback) {

  var firstSession = this.first

  if(typeof this.sessions[sessionId] === 'undefined'){
    this.l++
  }

  this.first = this.sessions[sessionId] = {id: sessionId, data: JSON.stringify(session), prev: firstSession, next: null}

  if(firstSession !== null){
    firstSession.next = this.first
  }

  if(this.last === null) {
    this.last = this.first
  }

  if (this.l > this.cacheLimit) {
    var last = this.last
    this.last = this.last.next
    this.destroy(last.id)
  }

  callback && defer(callback)
}

/**
 * Touch the given session object associated with the given session ID.
 *
 * @param {string} sessionId
 * @param {object} session
 * @param {function} callback
 * @public
 */

MemoryStore.prototype.touch = function touch(sessionId, session, callback) {
  var currentSession = getSession.call(this, sessionId)

  if (currentSession) {
    // update expiration
    currentSession.cookie = session.cookie
    this.sessions[sessionId].data = JSON.stringify(currentSession)
  }

  callback && defer(callback)
}

/**
 * Get session from the store.
 * @private
 */

function getSession(sessionId) {
  var sess = this.sessions[sessionId]

  if (!sess) {
    return
  }

  // parse
  sess = JSON.parse(sess.data)

  var expires = typeof sess.cookie.expires === 'string'
    ? new Date(sess.cookie.expires)
    : sess.cookie.expires

  // destroy expired session
  if (expires && expires <= Date.now()) {
    this.destroy(sessionId)
    return
  }

  return sess
}
