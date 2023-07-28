'use strict'

const Store = require('../../session/store')

class SyncStore extends Store {
  constructor() {
    // @ts-ignore
    super()
    this.sessions = Object.create(null)
  }

  destroy(sid, callback) {
    delete this.sessions[sid]
    callback()
  }

  get(sid, callback) {
    callback(null, JSON.parse(this.sessions[sid]))
  }

  set(sid, sess, callback) {
    this.sessions[sid] = JSON.stringify(sess)
    callback()
  }
}

module.exports = SyncStore
