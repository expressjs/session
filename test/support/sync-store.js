'use strict'

var session = require('../../')
var util = require('util')

module.exports = SyncStore

function SyncStore () {
  session.Store.call(this)
  this.sessions = Object.create(null)
}

util.inherits(SyncStore, session.Store)

SyncStore.prototype.destroy = function destroy (sid, callback) {
  delete this.sessions[sid]
  callback()
}

SyncStore.prototype.get = function get (sid, callback) {
  callback(null, JSON.parse(this.sessions[sid]))
}

SyncStore.prototype.set = function set (sid, sess, callback) {
  this.sessions[sid] = JSON.stringify(sess)
  callback()
}
