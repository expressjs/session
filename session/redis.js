/*!
 * Connect - session - RedisStore
 * Copyright(c) 2014 Chirag Jain
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Store = require('./store');
var redis = require('redis');

/**
 * Shim setImmediate for node.js < 0.10
 */

/* istanbul ignore next */
var defer = typeof setImmediate === 'function'
  ? setImmediate
  : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)) }

/**
 * Initialize a new `RedisStore`.
 *
 * @api public
 */

var RedisStore = module.exports = function RedisStore(options) {
  var self = this;
  options = options ? options : {};

  this.prefix = (null == options.prefix) ? 'sess:' : options.prefix;
  this.client = options.client || new redis.createClient(options.port || options.socket, options.host, options);
  
  if (options.pass) {
    this.client.auth(options.pass, function(err){
      if (err) return self.emit('disconnect');
    });    
  }

  this.client.on('error', function () { self.emit('disconnect'); }); //todo
  this.client.on('connect', function () { self.emit('connect'); }); //todo
};

/**
 * Inherit from `Store.prototype`.
 */

RedisStore.prototype.__proto__ = Store.prototype;

/**
 * Attempt to fetch session by the given `sid`.
 *
 * @param {String} sid
 * @param {Function} fn
 * @api public
 */

RedisStore.prototype.get = function(sid, fn){
  var self = this;
  this.client.hget(this.prefix, sid, function(err, sess){
    if (err) return self.emit('disconnect');
    if (!sess) {
      return defer(fn);
    }
    sess = sess.toString();
    // parse
    sess = JSON.parse(sess);

    var expires = typeof sess.cookie.expires === 'string'
      ? new Date(sess.cookie.expires).getTime()
      : sess.cookie.expires;

    // destroy expired session
    if (expires && expires <= Date.now()) {
      return self.destroy(sid, fn);
    }

    defer(fn, null, sess);
  });
};

/**
 * Commit the given `sess` object associated with the given `sid`.
 *
 * @param {String} sid
 * @param {Session} sess
 * @param {Function} fn
 * @api public
 */

RedisStore.prototype.set = function(sid, sess, fn){
  var self = this;
  sess = JSON.stringify(sess);
  this.client.hset(this.prefix, sid, sess, function(err){
    if (err) return self.emit('disconnect');
    fn = fn ? fn : noop;    
    defer(fn);
  });
};

/**
 * Destroy the session associated with the given `sid`.
 *
 * @param {String} sid
 * @api public
 */

RedisStore.prototype.destroy = function(sid, fn){
  var self = this;
  this.client.hdel(this.prefix, sid, function(err) {
    if (err) return self.emit('disconnect');
    defer(fn)
  });
};

/**
 * Invoke the given callback `fn` with all active sessions.
 *
 * @param {Function} fn
 * @api public
 */

RedisStore.prototype.all = function(fn){
  var self = this;
  this.client.hgetall(this.prefix, function(err, obj) {
    if (err) return self.emit('disconnect');
    for (var sid in obj) {
      // parse
      var sess = JSON.parse(obj[sid]);

      expires = typeof sess.cookie.expires === 'string'
        ? new Date(sess.cookie.expires).getTime()
        : sess.cookie.expires;

      if (!expires || expires > Date.now()) {
        obj[sid] = sess;
      } else {
        delete obj[sid];
      }
    }

    fn && defer(fn, null, obj);
  });
};

/**
 * Clear all sessions.
 *
 * @param {Function} fn
 * @api public
 */

RedisStore.prototype.clear = function(fn){
  var self = this;
  this.client.del(this.prefix, function(err) {
    if (err) return self.emit('disconnect');
    fn && defer(fn);
  });
};

/**
 * Fetch number of sessions.
 *
 * @param {Function} fn
 * @api public
 */

RedisStore.prototype.length = function(fn){
  var self = this;
  this.client.hlen(this.prefix, function(err, len) {
    if (err) return self.emit('disconnect');
    defer(fn, null, len);
  });
};
