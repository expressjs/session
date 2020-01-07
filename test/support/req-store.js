'use strict'

var session = require('../../')
var util = require('util')

module.exports = ReqStore

function ReqStore () {
  session.Store.call(this)
  this.sessions = Object.create(null)
}

util.inherits(ReqStore, session.Store)

ReqStore.prototype.passReq = true

ReqStore.prototype.destroy = function destroy (sid, req, callback) {
  delete this.sessions[req.hostname + ' ' + sid]
  callback()
}

ReqStore.prototype.get = function get (sid, req, callback) {
  callback(null, JSON.parse(this.sessions[req.hostname + ' ' + sid]))
}

ReqStore.prototype.set = function set (sid, sess, req, callback) {
  this.sessions[req.hostname + ' ' + sid] = JSON.stringify(sess)
  callback()
}

ReqStore.prototype.touch = ReqStore.prototype.set
