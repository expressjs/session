'use strict'

const session = require('../../')
const util = require('util')
const Store = require('../../session/store')
/* istanbul ignore next */
const defer = typeof setImmediate === 'function'
  ? setImmediate
  : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)) }


class SmartStore extends Store {
  constructor() {
    super()
    this.sessions = Object.create(null)
  }

  destroy(sid, callback) {
    delete this.sessions[sid]
    defer(callback)
  }

  get(sid, callback) {
    let sess = this.sessions[sid]

    if (!sess) {
      return
    }

    // parse
    sess = JSON.parse(sess)

    if (sess.cookie) {
      // expand expires into Date object
      sess.cookie.expires = typeof sess.cookie.expires === 'string'
        ? new Date(sess.cookie.expires)
        : sess.cookie.expires

      // destroy expired session
      if (sess.cookie.expires && sess.cookie.expires <= Date.now()) {
        delete this.sessions[sid]
        sess = null
      }
    }

    defer(callback, null, sess)
  }

  set(sid, sess, callback) {
    this.sessions[sid] = JSON.stringify(sess)
    defer(callback)
  }
}


module.exports = SmartStore
