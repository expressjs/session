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

var Cookie = require('./cookie')
var EventEmitter = require('events').EventEmitter
var Session = require('./session')
var util = require('util')

/**
 * Module exports.
 * @public
 */

module.exports = Store

/**
 * Abstract base class for session stores.
 * @public
 */

function Store () {
  EventEmitter.call(this)
}

/**
 * Inherit from EventEmitter.
 */

util.inherits(Store, EventEmitter)

/**
 * Re-generate the given requests's session.
 *
 * @param {IncomingRequest} req
 * @return {Function} fn
 * @api public
 */

Store.prototype.regenerate = function(req, fn){
  var self = this;
  var destroyCallback = function(err){
    self.generate(req);
    fn(err);
  };
  if (req.sessionOptions.passReqToStore) {
    this.destroy(req.sessionID, req, destroyCallback);
  } else {
    this.destroy(req.sessionID, destroyCallback);
  }
};

/**
 * Create session from JSON `sess` data.
 *
 * @param {IncomingRequest} req
 * @param {Object} sess
 * @return {Session}
 * @api private
 */

Store.prototype.createSession = function(req, sess){
  var expires = sess.cookie.expires
  var originalMaxAge = sess.cookie.originalMaxAge

  sess.cookie = new Cookie(sess.cookie);

  if (typeof expires === 'string') {
    // convert expires to a Date object
    sess.cookie.expires = new Date(expires)
  }

  // keep originalMaxAge intact
  sess.cookie.originalMaxAge = originalMaxAge

  req.session = new Session(req, sess);
  return req.session;
};
