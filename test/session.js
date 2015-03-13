
process.env.NO_DEPRECATION = 'express-session';

var after = require('after')
var assert = require('assert')
var express = require('express')
  , request = require('supertest')
  , cookieParser = require('cookie-parser')
  , session = require('../')
  , Cookie = require('../session/cookie')
var fs = require('fs')
var http = require('http')
var https = require('https')

var min = 60 * 1000;

describe('session()', function(){
  it('should export constructors', function(){
    assert.equal(typeof session.Session, 'function')
    assert.equal(typeof session.Store, 'function')
    assert.equal(typeof session.MemoryStore, 'function')
  })

  it('should do nothing if req.session exists', function(done){
    var app = express()
      .use(function(req, res, next){ req.session = {}; next(); })
      .use(session({ secret: 'keyboard cat', cookie: { maxAge: min }}))
      .use(end);

      request(app)
      .get('/')
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, done)
  })

  it('should error without secret', function(done){
    request(createServer({ secret: undefined }))
    .get('/')
    .expect(500, /secret.*required/, done)
  })

  it('should get secret from req.secret', function(done){
    var app = express()
      .use(function(req, res, next){ req.secret = 'keyboard cat'; next(); })
      .use(session({ cookie: { maxAge: min }}))
      .use(end);
    app.set('env', 'test');

    request(app)
    .get('/')
    .expect(200, '', done)
  })

  it('should create a new session', function (done) {
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      req.session.active = true
      res.end('session active')
    });

    request(server)
    .get('/')
    .expect(shouldSetCookie('connect.sid'))
    .expect(200, 'session active', function (err, res) {
      if (err) return done(err)
      store.length(function (err, len) {
        if (err) return done(err)
        assert.equal(len, 1)
        done()
      })
    })
  })

  it('should load session from cookie sid', function (done) {
    var count = 0
    var server = createServer(null, function (req, res) {
      req.session.num = req.session.num || ++count
      res.end('session ' + req.session.num)
    });

    request(server)
    .get('/')
    .expect(shouldSetCookie('connect.sid'))
    .expect(200, 'session 1', function (err, res) {
      if (err) return done(err)
      request(server)
      .get('/')
      .set('Cookie', cookie(res))
      .expect(200, 'session 1', done)
    })
  })

  it('should pass session fetch error', function (done) {
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      res.end('hello, world')
    })

    store.get = function destroy(sid, callback) {
      callback(new Error('boom!'))
    }

    request(server)
    .get('/')
    .expect(shouldSetCookie('connect.sid'))
    .expect(200, 'hello, world', function (err, res) {
      if (err) return done(err)
      request(server)
      .get('/')
      .set('Cookie', cookie(res))
      .expect(500, 'boom!', done)
    })
  })

  it('should treat ENOENT session fetch error as not found', function (done) {
    var count = 0
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      req.session.num = req.session.num || ++count
      res.end('session ' + req.session.num)
    })

    store.get = function destroy(sid, callback) {
      var err = new Error('boom!')
      err.code = 'ENOENT'
      callback(err)
    }

    request(server)
    .get('/')
    .expect(shouldSetCookie('connect.sid'))
    .expect(200, 'session 1', function (err, res) {
      if (err) return done(err)
      request(server)
      .get('/')
      .set('Cookie', cookie(res))
      .expect(200, 'session 2', done)
    })
  })

  it('should create multiple sessions', function (done) {
    var cb = after(2, check)
    var count = 0
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      var isnew = req.session.num === undefined
      req.session.num = req.session.num || ++count
      res.end('session ' + (isnew ? 'created' : 'updated'))
    });

    function check(err) {
      if (err) return done(err)
      store.all(function (err, sess) {
        if (err) return done(err)
        assert.equal(Object.keys(sess).length, 2)
        done()
      })
    }

    request(server)
    .get('/')
    .expect(200, 'session created', cb)

    request(server)
    .get('/')
    .expect(200, 'session created', cb)
  })

  it('should handle multiple res.end calls', function(done){
    var app = express()
      .use(session({ secret: 'keyboard cat', cookie: { maxAge: min }}))
      .use(function(req, res){
        res.setHeader('Content-Type', 'text/plain');
        res.end('Hello, world!');
        res.end();
      });
    app.set('env', 'test');

    request(app)
    .get('/')
    .expect('Content-Type', 'text/plain')
    .expect(200, 'Hello, world!', done);
  })

  it('should handle res.end(null) calls', function (done) {
    var server = createServer(null, function (req, res) {
      res.end(null)
    })

    request(server)
    .get('/')
    .expect(200, '', done)
  })

  it('should handle reserved properties in storage', function (done) {
    var count = 0
    var sid
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      sid = req.session.id
      req.session.num = req.session.num || ++count
      res.end('session saved')
    })

    request(server)
    .get('/')
    .expect(200, 'session saved', function (err, res) {
      if (err) return done(err)
      store.get(sid, function (err, sess) {
        if (err) return done(err)
        // save is reserved
        sess.save = 'nope'
        store.set(sid, sess, function (err) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, 'session saved', done)
        })
      })
    })
  })

  it('should only have session data enumerable (and cookie)', function (done) {
    var server = createServer(null, function (req, res) {
      req.session.test1 = 1
      req.session.test2 = 'b'
      res.end(Object.keys(req.session).sort().join(','))
    })

    request(server)
    .get('/')
    .expect(200, 'cookie,test1,test2', done)
  })

  it('should not save with bogus req.sessionID', function (done) {
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      req.sessionID = function () {}
      req.session.test1 = 1
      req.session.test2 = 'b'
      res.end()
    })

    request(server)
    .get('/')
    .expect(shouldNotHaveHeader('Set-Cookie'))
    .expect(200, function (err) {
      if (err) return done(err)
      store.length(function (err, length) {
        if (err) return done(err)
        assert.equal(length, 0)
        done()
      })
    })
  })

  describe('when response ended', function () {
    it('should have saved session', function (done) {
      var saved = false
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.hit = true
        res.end('session saved')
      })

      var _set = store.set
      store.set = function set(sid, sess, callback) {
        setTimeout(function () {
          _set.call(store, sid, sess, function (err) {
            saved = true
            callback(err)
          })
        }, 200)
      }

      request(server)
      .get('/')
      .expect(200, 'session saved', function (err) {
        if (err) return done(err)
        assert.ok(saved)
        done()
      })
    })

    it('should have saved session even with empty response', function (done) {
      var saved = false
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.hit = true
        res.setHeader('Content-Length', '0')
        res.end()
      })

      var _set = store.set
      store.set = function set(sid, sess, callback) {
        setTimeout(function () {
          _set.call(store, sid, sess, function (err) {
            saved = true
            callback(err)
          })
        }, 200)
      }

      request(server)
      .get('/')
      .expect(200, '', function (err) {
        if (err) return done(err)
        assert.ok(saved)
        done()
      })
    })

    it('should have saved session even with multi-write', function (done) {
      var saved = false
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.hit = true
        res.setHeader('Content-Length', '12')
        res.write('hello, ')
        res.end('world')
      })

      var _set = store.set
      store.set = function set(sid, sess, callback) {
        setTimeout(function () {
          _set.call(store, sid, sess, function (err) {
            saved = true
            callback(err)
          })
        }, 200)
      }

      request(server)
      .get('/')
      .expect(200, 'hello, world', function (err) {
        if (err) return done(err)
        assert.ok(saved)
        done()
      })
    })

    it('should have saved session even with non-chunked response', function (done) {
      var saved = false
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.hit = true
        res.setHeader('Content-Length', '13')
        res.end('session saved')
      })

      var _set = store.set
      store.set = function set(sid, sess, callback) {
        setTimeout(function () {
          _set.call(store, sid, sess, function (err) {
            saved = true
            callback(err)
          })
        }, 200)
      }

      request(server)
      .get('/')
      .expect(200, 'session saved', function (err) {
        if (err) return done(err)
        assert.ok(saved)
        done()
      })
    })
  })

  describe('when sid not in store', function () {
    it('should create a new session', function (done) {
      var count = 0
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.num = req.session.num || ++count
        res.end('session ' + req.session.num)
      });

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        store.clear(function (err) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, 'session 2', done)
        })
      })
    })

    it('should have a new sid', function (done) {
      var count = 0
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.num = req.session.num || ++count
        res.end('session ' + req.session.num)
      });

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        var val = sid(res)
        assert.ok(val)
        store.clear(function (err) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetCookie('connect.sid'))
          .expect(200, 'session 2', function (err, res) {
            if (err) return done(err)
            assert.notEqual(sid(res), val)
            done()
          })
        })
      })
    })
  })

  describe('when sid not properly signed', function () {
    it('should generate new session', function (done) {
      var store = new session.MemoryStore()
      var server = createServer({ store: store, key: 'sessid' }, function (req, res) {
        var isnew = req.session.active === undefined
        req.session.active = true
        res.end('session ' + (isnew ? 'created' : 'read'))
      })

      request(server)
      .get('/')
      .expect(shouldSetCookie('sessid'))
      .expect(200, 'session created', function (err, res) {
        if (err) return done(err)
        var val = sid(res)
        assert.ok(val)
        request(server)
        .get('/')
        .set('Cookie', 'sessid=' + val)
        .expect(shouldSetCookie('sessid'))
        .expect(200, 'session created', done)
      })
    })

    it('should not attempt fetch from store', function (done) {
      var store = new session.MemoryStore()
      var server = createServer({ store: store, key: 'sessid' }, function (req, res) {
        var isnew = req.session.active === undefined
        req.session.active = true
        res.end('session ' + (isnew ? 'created' : 'read'))
      })

      request(server)
      .get('/')
      .expect(shouldSetCookie('sessid'))
      .expect(200, 'session created', function (err, res) {
        if (err) return done(err)
        var val = cookie(res).replace(/...\./, '.')

        assert.ok(val)
        request(server)
        .get('/')
        .set('Cookie', val)
        .expect(shouldSetCookie('sessid'))
        .expect(200, 'session created', done)
      })
    })
  })

  describe('when session expired in store', function () {
    it('should create a new session', function (done) {
      var count = 0
      var store = new session.MemoryStore()
      var server = createServer({ store: store, cookie: { maxAge: 5 } }, function (req, res) {
        req.session.num = req.session.num || ++count
        res.end('session ' + req.session.num)
      });

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        setTimeout(function () {
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetCookie('connect.sid'))
          .expect(200, 'session 2', done)
        }, 20)
      })
    })

    it('should have a new sid', function (done) {
      var count = 0
      var store = new session.MemoryStore()
      var server = createServer({ store: store, cookie: { maxAge: 5 } }, function (req, res) {
        req.session.num = req.session.num || ++count
        res.end('session ' + req.session.num)
      });

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        var val = sid(res)
        assert.ok(val)
        setTimeout(function () {
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetCookie('connect.sid'))
          .expect(200, 'session 2', function (err, res) {
            if (err) return done(err)
            assert.notEqual(sid(res), val)
            done()
          })
        }, 15)
      })
    })

    it('should not exist in store', function (done) {
      var count = 0
      var store = new session.MemoryStore()
      var server = createServer({ store: store, cookie: { maxAge: 5 } }, function (req, res) {
        req.session.num = req.session.num || ++count
        res.end('session ' + req.session.num)
      });

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        setTimeout(function () {
          store.all(function (err, sess) {
            if (err) return done(err)
            assert.equal(Object.keys(sess).length, 0)
            done()
          })
        }, 10)
      })
    })
  })

  describe('proxy option', function(){
    describe('when enabled', function(){
      var server
      before(function () {
        server = createServer({ proxy: true, cookie: { secure: true, maxAge: 5 }})
      })

      it('should trust X-Forwarded-Proto when string', function(done){
        request(server)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, done)
      })

      it('should trust X-Forwarded-Proto when comma-separated list', function(done){
        request(server)
        .get('/')
        .set('X-Forwarded-Proto', 'https,http')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, done)
      })

      it('should work when no header', function(done){
        request(server)
        .get('/')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
      })
    })

    describe('when disabled', function(){
      var server
      before(function () {
        server = createServer({ proxy: false, cookie: { secure: true, maxAge: 5 }})
      })

      it('should not trust X-Forwarded-Proto', function(done){
        request(server)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
      })

      it('should ignore req.secure from express', function(done){
        var app = express()
          .use(session({ secret: 'keyboard cat', proxy: false, cookie: { secure: true, maxAge: min }}))
          .use(function(req, res) { res.json(req.secure); });
        app.enable('trust proxy');

        request(app)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, 'true', done)
      })
    })

    describe('when unspecified', function(){
      var server
      before(function () {
        server = createServer({ cookie: { secure: true, maxAge: 5 }})
      })

      it('should not trust X-Forwarded-Proto', function(done){
        request(server)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
      })

      it('should use req.secure from express', function(done){
        var app = express()
          .use(session({ secret: 'keyboard cat', cookie: { secure: true, maxAge: min }}))
          .use(function(req, res) { res.json(req.secure); });
        app.enable('trust proxy');

        request(app)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, 'true', done)
      })
    })
  })

  describe('genid option', function(){
    it('should reject non-function values', function(){
      assert.throws(session.bind(null, { genid: 'bogus!' }), /genid.*must/)
    });

    it('should provide default generator', function(done){
      request(createServer())
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done)
    });

    it('should allow custom function', function(done){
      function genid() { return 'apple' }

      request(createServer({ genid: genid }))
      .get('/')
      .expect(shouldSetCookieToValue('connect.sid', 's%3Aapple.D8Y%2BpkTAmeR0PobOhY4G97PRW%2Bj7bUnP%2F5m6%2FOn1MCU'))
      .expect(200, done)
    });

    it('should encode unsafe chars', function(done){
      function genid() { return '%' }

      request(createServer({ genid: genid }))
      .get('/')
      .expect(shouldSetCookieToValue('connect.sid', 's%3A%25.kzQ6x52kKVdF35Qh62AWk4ZekS28K5XYCXKa%2FOTZ01g'))
      .expect(200, done)
    });

    it('should provide req argument', function(done){
      function genid(req) { return req.url }

      request(createServer({ genid: genid }))
      .get('/foo')
      .expect(shouldSetCookieToValue('connect.sid', 's%3A%2Ffoo.paEKBtAHbV5s1IB8B2zPnzAgYmmnRPIqObW4VRYj%2FMQ'))
      .expect(200, done)
    });
  });

  describe('key option', function(){
    it('should default to "connect.sid"', function(done){
      request(createServer())
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done)
    })

    it('should allow overriding', function(done){
      request(createServer({ key: 'session_id' }))
      .get('/')
      .expect(shouldSetCookie('session_id'))
      .expect(200, done)
    })
  })

  describe('rolling option', function(){
    it('should default to false', function(done){
      var app = express();
      app.use(session({ secret: 'keyboard cat', cookie: { maxAge: min }}));
      app.use(function(req, res, next){
        var save = req.session.save;
        req.session.user = 'bob';
        res.end();
      });

      request(app)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, function(err, res){
        if (err) return done(err);
        request(app)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
      });
    });

    it('should force cookie on unmodified session', function(done){
      var app = express();
      app.use(session({ rolling: true, secret: 'keyboard cat', cookie: { maxAge: min }}));
      app.use(function(req, res, next){
        var save = req.session.save;
        req.session.user = 'bob';
        res.end();
      });

      request(app)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, function(err, res){
        if (err) return done(err);
        request(app)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, done)
      });
    });
  });

  describe('resave option', function(){
    it('should default to true', function(done){
      var count = 0;
      var app = express();
      app.use(session({ secret: 'keyboard cat', cookie: { maxAge: min }}));
      app.use(function(req, res, next){
        var save = req.session.save;
        res.setHeader('x-count', count);
        req.session.user = 'bob';
        req.session.save = function(fn){
          res.setHeader('x-count', ++count);
          return save.call(this, fn);
        };
        res.end();
      });

      request(app)
      .get('/')
      .expect('x-count', '1')
      .expect(200, function(err, res){
        if (err) return done(err);
        request(app)
        .get('/')
        .set('Cookie', cookie(res))
        .expect('x-count', '2')
        .expect(200, done);
      });
    });

    it('should force save on unmodified session', function(done){
      var count = 0;
      var app = express();
      app.use(session({ resave: true, secret: 'keyboard cat', cookie: { maxAge: min }}));
      app.use(function(req, res, next){
        var save = req.session.save;
        res.setHeader('x-count', count);
        req.session.user = 'bob';
        req.session.save = function(fn){
          res.setHeader('x-count', ++count);
          return save.call(this, fn);
        };
        res.end();
      });

      request(app)
      .get('/')
      .expect('x-count', '1')
      .expect(200, function(err, res){
        if (err) return done(err);
        request(app)
        .get('/')
        .set('Cookie', cookie(res))
        .expect('x-count', '2')
        .expect(200, done);
      });
    });

    it('should prevent save on unmodified session', function(done){
      var count = 0;
      var app = express();
      app.use(session({ resave: false, secret: 'keyboard cat', cookie: { maxAge: min }}));
      app.use(function(req, res, next){
        var save = req.session.save;
        res.setHeader('x-count', count);
        req.session.user = 'bob';
        req.session.save = function(fn){
          res.setHeader('x-count', ++count);
          return save.call(this, fn);
        };
        res.end();
      });

      request(app)
      .get('/')
      .expect('x-count', '1')
      .expect(200, function(err, res){
        if (err) return done(err);
        request(app)
        .get('/')
        .set('Cookie', cookie(res))
        .expect('x-count', '1')
        .expect(200, done);
      });
    });

    it('should still save modified session', function(done){
      var count = 0;
      var app = express();
      app.use(session({ resave: false, secret: 'keyboard cat', cookie: { maxAge: min }}));
      app.use(function(req, res, next){
        var save = req.session.save;
        res.setHeader('x-count', count);
        req.session.count = count;
        req.session.user = 'bob';
        req.session.save = function(fn){
          res.setHeader('x-count', ++count);
          return save.call(this, fn);
        };
        res.end();
      });

      request(app)
      .get('/')
      .expect('x-count', '1')
      .expect(200, function(err, res){
        if (err) return done(err);
        request(app)
        .get('/')
        .set('Cookie', cookie(res))
        .expect('x-count', '2')
        .expect(200, done);
      });
    });

    it('should pass session touch error', function (done) {
      var cb = after(2, done)
      var store = new session.MemoryStore()
      var server = createServer({ store: store, resave: false }, function (req, res) {
        req.session.hit = true
        res.end('session saved')
      })

      store.touch = function touch(sid, sess, callback) {
        callback(new Error('boom!'))
      }

      server.on('error', function onerror(err) {
        assert.ok(err)
        assert.equal(err.message, 'boom!')
        cb()
      })

      request(server)
      .get('/')
      .expect(200, 'session saved', function (err, res) {
        if (err) return cb(err)
        request(server)
        .get('/')
        .set('Cookie', cookie(res))
        .end(cb)
      })
    })
  });

  describe('saveUninitialized option', function(){
    it('should default to true', function(done){
      var count = 0;
      var app = express();
      app.use(session({ secret: 'keyboard cat', cookie: { maxAge: min }}));
      app.use(function(req, res, next){
        var save = req.session.save;
        res.setHeader('x-count', count);
        req.session.save = function(fn){
          res.setHeader('x-count', ++count);
          return save.call(this, fn);
        };
        res.end();
      });

      request(app)
      .get('/')
      .expect('x-count', '1')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done);
    });

    it('should force save of uninitialized session', function(done){
      var count = 0;
      var app = express();
      app.use(session({ saveUninitialized: true, secret: 'keyboard cat', cookie: { maxAge: min }}));
      app.use(function(req, res, next){
        var save = req.session.save;
        res.setHeader('x-count', count);
        req.session.save = function(fn){
          res.setHeader('x-count', ++count);
          return save.call(this, fn);
        };
        res.end();
      });

      request(app)
      .get('/')
      .expect('x-count', '1')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done);
    });

    it('should prevent save of uninitialized session', function(done){
      var count = 0;
      var app = express();
      app.use(session({ saveUninitialized: false, secret: 'keyboard cat', cookie: { maxAge: min }}));
      app.use(function(req, res, next){
        var save = req.session.save;
        res.setHeader('x-count', count);
        req.session.save = function(fn){
          res.setHeader('x-count', ++count);
          return save.call(this, fn);
        };
        res.end();
      });

      request(app)
      .get('/')
      .expect('x-count', '0')
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, done)
    });

    it('should still save modified session', function(done){
      var count = 0;
      var app = express();
      app.use(session({ saveUninitialized: false, secret: 'keyboard cat', cookie: { maxAge: min }}));
      app.use(function(req, res, next){
        var save = req.session.save;
        res.setHeader('x-count', count);
        req.session.count = count;
        req.session.user = 'bob';
        req.session.save = function(fn){
          res.setHeader('x-count', ++count);
          return save.call(this, fn);
        };
        res.end();
      });

      request(app)
      .get('/')
      .expect('x-count', '1')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done);
    });

    it('should pass session save error', function (done) {
      var cb = after(2, done)
      var store = new session.MemoryStore()
      var server = createServer({ store: store, saveUninitialized: true }, function (req, res) {
        res.end('session saved')
      })

      store.set = function destroy(sid, sess, callback) {
        callback(new Error('boom!'))
      }

      server.on('error', function onerror(err) {
        assert.ok(err)
        assert.equal(err.message, 'boom!')
        cb()
      })

      request(server)
      .get('/')
      .expect(200, 'session saved', cb)
    })

    it('should prevent uninitialized session from being touched', function (done) {
      var cb = after(1, done)
      var store = new session.MemoryStore()
      var server = createServer({ saveUninitialized: false, store: store, cookie: { maxAge: min } }, function (req, res) {
        res.end()
      })

      store.touch = function () {
        cb(new Error('should not be called'))
      }

      request(server)
      .get('/')
      .expect(200, cb)
    })
  });

  describe('secret option', function () {
    it('should reject empty arrays', function () {
      assert.throws(createServer.bind(null, { secret: [] }), /secret option array/);
    })

    describe('when an array', function () {
      it('should sign cookies', function (done) {
        var server = createServer({ secret: ['keyboard cat', 'nyan cat'] }, function (req, res) {
          req.session.user = 'bob';
          res.end(req.session.user);
        });

        request(server)
        .get('/')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, 'bob', done);
      })

      it('should sign cookies with first element', function (done) {
        var store = new session.MemoryStore();

        var server1 = createServer({ secret: ['keyboard cat', 'nyan cat'], store: store }, function (req, res) {
          req.session.user = 'bob';
          res.end(req.session.user);
        });

        var server2 = createServer({ secret: 'nyan cat', store: store }, function (req, res) {
          res.end(String(req.session.user));
        });

        request(server1)
        .get('/')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, 'bob', function (err, res) {
          if (err) return done(err);
          request(server2)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, 'undefined', done);
        });
      });

      it('should read cookies using all elements', function (done) {
        var store = new session.MemoryStore();

        var server1 = createServer({ secret: 'nyan cat', store: store }, function (req, res) {
          req.session.user = 'bob';
          res.end(req.session.user);
        });

        var server2 = createServer({ secret: ['keyboard cat', 'nyan cat'], store: store }, function (req, res) {
          res.end(String(req.session.user));
        });

        request(server1)
        .get('/')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, 'bob', function (err, res) {
          if (err) return done(err);
          request(server2)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, 'bob', done);
        });
      });
    })
  })

  describe('unset option', function () {
    it('should reject unknown values', function(){
      assert.throws(session.bind(null, { unset: 'bogus!' }), /unset.*must/)
    });

    it('should default to keep', function(done){
      var store = new session.MemoryStore();
      var app = express()
        .use(session({ store: store, secret: 'keyboard cat' }))
        .use(function(req, res, next){
          req.session.count = req.session.count || 0;
          req.session.count++;
          if (req.session.count === 2) req.session = null;
          res.end();
        });

      request(app)
      .get('/')
      .expect(200, function(err, res){
        if (err) return done(err);
        store.length(function(err, len){
          if (err) return done(err);
          assert.equal(len, 1)
          request(app)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, function(err, res){
            if (err) return done(err);
            store.length(function(err, len){
              if (err) return done(err);
              assert.equal(len, 1)
              done();
            });
          });
        });
      });
    });

    it('should allow destroy on req.session = null', function(done){
      var store = new session.MemoryStore();
      var app = express()
        .use(session({ store: store, unset: 'destroy', secret: 'keyboard cat' }))
        .use(function(req, res, next){
          req.session.count = req.session.count || 0;
          req.session.count++;
          if (req.session.count === 2) req.session = null;
          res.end();
        });

      request(app)
      .get('/')
      .expect(200, function(err, res){
        if (err) return done(err);
        store.length(function(err, len){
          if (err) return done(err);
          assert.equal(len, 1)
          request(app)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, function(err, res){
            if (err) return done(err);
            store.length(function(err, len){
              if (err) return done(err);
              assert.equal(len, 0)
              done();
            });
          });
        });
      });
    });

    it('should not set cookie if initial session destroyed', function(done){
      var store = new session.MemoryStore();
      var app = express()
        .use(session({ store: store, unset: 'destroy', secret: 'keyboard cat' }))
        .use(function(req, res, next){
          req.session = null;
          res.end();
        });

      request(app)
      .get('/')
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, function(err, res){
        if (err) return done(err);
        store.length(function(err, len){
          if (err) return done(err);
          assert.equal(len, 0)
          done();
        });
      });
    });

    it('should pass session destroy error', function (done) {
      var cb = after(2, done)
      var store = new session.MemoryStore()
      var server = createServer({ store: store, unset: 'destroy' }, function (req, res) {
        req.session = null
        res.end('session destroyed')
      })

      store.destroy = function destroy(sid, callback) {
        callback(new Error('boom!'))
      }

      server.on('error', function onerror(err) {
        assert.ok(err)
        assert.equal(err.message, 'boom!')
        cb()
      })

      request(server)
      .get('/')
      .expect(200, 'session destroyed', cb)
    })
  });

  describe('res.end patch', function () {
    it('should correctly handle res.end/res.write patched prior', function (done) {
      var app = express()

      app.use(writePatch())
      app.use(createSession())
      app.use(function (req, res) {
        req.session.hit = true
        res.write('hello, ')
        res.end('world')
      })

      request(app)
      .get('/')
      .expect(200, 'hello, world', done)
    })

    it('should correctly handle res.end/res.write patched after', function (done) {
      var app = express()

      app.use(createSession())
      app.use(writePatch())
      app.use(function (req, res) {
        req.session.hit = true
        res.write('hello, ')
        res.end('world')
      })

      request(app)
      .get('/')
      .expect(200, 'hello, world', done)
    })
  })

  describe('req.session', function(){
    it('should persist', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.count = req.session.count || 0
        req.session.count++
        res.end('hits: ' + req.session.count)
      })

      request(server)
      .get('/')
      .expect(200, 'hits: 1', function (err, res) {
        if (err) return done(err)
        store.load(sid(res), function (err, sess) {
          if (err) return done(err)
          assert.ok(sess)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, 'hits: 2', done)
        })
      })
    })

    it('should only set-cookie when modified', function(done){
      var modify = true;

      var app = express()
        .use(session({ secret: 'keyboard cat', cookie: { maxAge: min }}))
        .use(function(req, res, next){
          if (modify) {
            req.session.count = req.session.count || 0;
            req.session.count++;
          }
          res.end(req.session.count.toString());
        });

      request(app)
      .get('/')
      .expect(200, '1', function (err, res) {
        if (err) return done(err)
        request(app)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(200, '2', function (err, res) {
          if (err) return done(err)
          var val = cookie(res);
          modify = false;

          request(app)
          .get('/')
          .set('Cookie', val)
          .expect(shouldNotHaveHeader('Set-Cookie'))
          .expect(200, '2', function (err, res) {
            if (err) return done(err)
            modify = true;

            request(app)
            .get('/')
            .set('Cookie', val)
            .expect(shouldSetCookie('connect.sid'))
            .expect(200, '3', done)
          });
        });
      });
    })

    describe('.destroy()', function(){
      it('should destroy the previous session', function(done){
        var app = express()
          .use(session({ secret: 'keyboard cat' }))
          .use(function(req, res, next){
            req.session.destroy(function(err){
              if (err) throw err;
              assert(!req.session, 'req.session after destroy');
              res.end();
            });
          });

        request(app)
        .get('/')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
      })
    })

    describe('.regenerate()', function(){
      it('should destroy/replace the previous session', function(done){
        var app = express()
          .use(session({ secret: 'keyboard cat', cookie: { maxAge: min }}))
          .use(function(req, res, next){
            var id = req.session.id;
            req.session.regenerate(function(err){
              if (err) throw err;
              assert.notEqual(id, req.session.id)
              res.end();
            });
          });

        request(app)
        .get('/')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, function (err, res) {
          if (err) return done(err)
          var id = sid(res)
          request(app)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetCookie('connect.sid'))
          .expect(200, function (err, res) {
            if (err) return done(err)
            assert.notEqual(sid(res), id)
            done();
          });
        });
      })
    })

    describe('.reload()', function () {
      it('should reload session from store', function (done) {
        var server = createServer(null, function (req, res) {
          if (req.url === '/') {
            req.session.active = true
            res.end('session created')
            return
          }

          req.session.url = req.url

          if (req.url === '/bar') {
            res.end('saw ' + req.session.url)
            return
          }

          request(server)
          .get('/bar')
          .set('Cookie', val)
          .expect(200, 'saw /bar', function (err, resp) {
            if (err) return done(err)
            req.session.reload(function (err) {
              if (err) return done(err)
              res.end('saw ' + req.session.url)
            })
          })
        })
        var val

        request(server)
        .get('/')
        .expect(200, 'session created', function (err, res) {
          if (err) return done(err)
          val = cookie(res)
          request(server)
          .get('/foo')
          .set('Cookie', val)
          .expect(200, 'saw /bar', done)
        })
      })

      it('should error is session missing', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ store: store }, function (req, res) {
          if (req.url === '/') {
            req.session.active = true
            res.end('session created')
            return
          }

          store.clear(function (err) {
            if (err) return done(err)
            req.session.reload(function (err) {
              res.statusCode = err ? 500 : 200
              res.end(err ? err.message : '')
            })
          })
        })

        request(server)
        .get('/')
        .expect(200, 'session created', function (err, res) {
          if (err) return done(err)
          request(server)
          .get('/foo')
          .set('Cookie', cookie(res))
          .expect(500, 'failed to load session', done)
        })
      })
    })

    describe('.save()', function () {
      it('should save session to store', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ store: store }, function (req, res) {
          req.session.hit = true
          req.session.save(function (err) {
            if (err) return res.end(err.message)
            store.get(req.session.id, function (err, sess) {
              if (err) return res.end(err.message)
              res.end(sess ? 'stored' : 'empty')
            })
          })
        })

        request(server)
        .get('/')
        .expect(200, 'stored', done)
      })

      it('should prevent end-of-request save', function (done) {
        var count = 0
        var store = new session.MemoryStore()
        var server = createServer({ store: store }, function (req, res) {
          req.session.hit = true
          req.session.save(function (err) {
            if (err) return res.end(err.message)
            res.end('saved')
          })
        })

        var _set = store.set
        store.set = function set(sid, sess, callback) {
          count++
          _set.call(store, sid, sess, callback)
        }

        request(server)
        .get('/')
        .expect(200, 'saved', function (err, res) {
          if (err) return done(err)
          assert.equal(count, 1)
          count = 0
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, 'saved', function (err) {
            if (err) return done(err)
            assert.equal(count, 1)
            done()
          })
        })
      })
    })

    describe('.touch()', function () {
      it('should reset session expiration', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ resave: false, store: store, cookie: { maxAge: min } }, function (req, res) {
          req.session.hit = true
          req.session.touch()
          res.end()
        })

        request(server)
        .get('/')
        .expect(200, function (err, res) {
          if (err) return done(err)
          var id = sid(res)
          store.get(id, function (err, sess) {
            if (err) return done(err)
            var exp = new Date(sess.cookie.expires)
            setTimeout(function () {
              request(server)
              .get('/')
              .set('Cookie', cookie(res))
              .expect(200, function (err, res) {
                if (err) return done(err);
                store.get(id, function (err, sess) {
                  if (err) return done(err)
                  assert.notEqual(new Date(sess.cookie.expires).getTime(), exp.getTime())
                  done()
                })
              })
            }, 100)
          })
        })
      })
    })

    describe('.cookie', function(){
      describe('.*', function(){
        it('should serialize as parameters', function(done){
          var app = express()
            .use(session({ secret: 'keyboard cat', proxy: true, cookie: { maxAge: min }}))
            .use(function(req, res, next){
              req.session.cookie.httpOnly = false;
              req.session.cookie.secure = true;
              res.end();
            });

          request(app)
          .get('/')
          .set('X-Forwarded-Proto', 'https')
          .expect(200, function(err, res){
            if (err) return done(err);
            var val = cookie(res);
            assert.equal(val.indexOf('HttpOnly'), -1, 'should not be HttpOnly cookie')
            assert.notEqual(val.indexOf('Secure'), -1, 'should be Secure cookie')
            done();
          });
        })

        it('should default to a browser-session length cookie', function(done){
          var app = express()
            .use(session({ secret: 'keyboard cat', cookie: { path: '/admin' }}))
            .use(function(req, res, next){
              res.end();
            });

          request(app)
          .get('/admin')
          .expect(200, function(err, res){
            if (err) return done(err);
            var val = cookie(res);
            assert.equal(val.indexOf('Expires'), -1, 'should be not have cookie Expires')
            done();
          });
        })

        it('should Set-Cookie only once for browser-session cookies', function(done){
          var app = express()
            .use(session({ secret: 'keyboard cat', cookie: { path: '/admin' }}))
            .use(function(req, res, next){
              res.end();
            });

          request(app)
          .get('/admin/foo')
          .expect(shouldSetCookie('connect.sid'))
          .expect(200, function (err, res) {
            if (err) return done(err)
            request(app)
            .get('/admin')
            .set('Cookie', cookie(res))
            .expect(shouldNotHaveHeader('Set-Cookie'))
            .expect(200, done)
          });
        })

        it('should override defaults', function(done){
          var app = express()
            .use(session({ secret: 'keyboard cat', cookie: { path: '/admin', httpOnly: false, secure: true, maxAge: 5000 }}))
            .use(function(req, res, next){
              req.session.cookie.secure = false;
              res.end();
            });

          request(app)
          .get('/admin')
          .expect(200, function(err, res){
            if (err) return done(err);
            var val = cookie(res);
            assert.equal(val.indexOf('HttpOnly'), -1, 'should not be HttpOnly cookie')
            assert.equal(val.indexOf('Secure'), -1, 'should not be Secure cookie')
            assert.notEqual(val.indexOf('Path=/admin'), -1, 'should have cookie path /admin')
            assert.notEqual(val.indexOf('Expires'), -1, 'should have cookie Expires')
            done();
          });
        })

        it('should preserve cookies set before writeHead is called', function(done){
          var app = express()
            .use(session({ secret: 'keyboard cat' }))
            .use(function(req, res, next){
              var cookie = new Cookie();
              res.setHeader('Set-Cookie', cookie.serialize('previous', 'cookieValue'));
              res.end();
            });

          request(app)
          .get('/')
          .expect(shouldSetCookieToValue('previous', 'cookieValue'))
          .expect(200, done)
        })
      })

      describe('.secure', function(){
        var app

        before(function () {
          app = createRequestListener({ secret: 'keyboard cat', cookie: { secure: true } })
        })

        it('should set cookie when secure', function (done) {
          var cert = fs.readFileSync(__dirname + '/fixtures/server.crt', 'ascii')
          var server = https.createServer({
            key: fs.readFileSync(__dirname + '/fixtures/server.key', 'ascii'),
            cert: cert
          })

          server.on('request', app)

          var agent = new https.Agent({ca: cert})
          var createConnection = agent.createConnection

          agent.createConnection = function (options) {
            options.servername = 'express-session.local'
            return createConnection.call(this, options)
          }

          var req = request(server).get('/')
          req.agent(agent)
          req.expect(shouldSetCookie('connect.sid'))
          req.expect(200, done)
        })

        it('should not set-cookie when insecure', function(done){
          var server = http.createServer(app)

          request(server)
          .get('/')
          .expect(shouldNotHaveHeader('Set-Cookie'))
          .expect(200, done)
        })
      })

      describe('when the pathname does not match cookie.path', function(){
        it('should not set-cookie', function(done){
          var app = express()
            .use(session({ secret: 'keyboard cat', cookie: { path: '/foo/bar' }}))
            .use(function(req, res, next){
              if (!req.session) {
                return res.end();
              }
              req.session.foo = Math.random();
              res.end();
            });

          request(app)
          .get('/')
          .expect(shouldNotHaveHeader('Set-Cookie'))
          .expect(200, done)
        })

        it('should not set-cookie even for FQDN', function(done){
          var app = express()
            .use(session({ secret: 'keyboard cat', cookie: { path: '/foo/bar' }}))
            .use(function(req, res, next){
              if (!req.session) {
                return res.end();
              }

              req.session.foo = Math.random();
              res.end();
            });

          request(app)
          .get('/')
          .set('host', 'http://foo/bar')
          .expect(shouldNotHaveHeader('Set-Cookie'))
          .expect(200, done)
        })
      })

      describe('when the pathname does match cookie.path', function(){
        it('should set-cookie', function(done){
          var app = express()
            .use(session({ secret: 'keyboard cat', cookie: { path: '/foo/bar' }}))
            .use(function(req, res, next){
              req.session.foo = Math.random();
              res.end();
            });

          request(app)
          .get('/foo/bar/baz')
          .expect(shouldSetCookie('connect.sid'))
          .expect(200, done)
        })

        it('should set-cookie even for FQDN', function(done){
          var app = express()
            .use(session({ secret: 'keyboard cat', cookie: { path: '/foo/bar' }}))
            .use(function(req, res, next){
              req.session.foo = Math.random();
              res.end();
            });

          request(app)
          .get('/foo/bar/baz')
          .set('host', 'http://example.com')
          .expect(shouldSetCookie('connect.sid'))
          .expect(200, done)
        })
      })

      describe('.maxAge', function(){
        var val;
        var app = express()
          .use(session({ secret: 'keyboard cat', cookie: { maxAge: 2000 }}))
          .use(function(req, res, next){
            req.session.count = req.session.count || 0;
            req.session.count++;
            if (req.session.count == 2) req.session.cookie.maxAge = 5000;
            if (req.session.count == 3) req.session.cookie.maxAge = 3000000000;
            res.end(req.session.count.toString());
          });

        it('should set relative in milliseconds', function(done){
          request(app)
          .get('/')
          .expect(200, '1', function (err, res) {
            var a = new Date(expires(res))
            var b = new Date
            var delta = a.valueOf() - b.valueOf()

            val = cookie(res);

            assert.ok(delta > 1000 && delta <= 2000)
            done();
          });
        });

        it('should modify cookie when changed', function(done){
          request(app)
          .get('/')
          .set('Cookie', val)
          .expect(200, '2', function (err, res) {
            var a = new Date(expires(res))
            var b = new Date
            var delta = a.valueOf() - b.valueOf()

            val = cookie(res);

            assert.ok(delta > 4000 && delta <= 5000)
            done();
          });
        });

        it('should modify cookie when changed to large value', function(done){
          request(app)
          .get('/')
          .set('Cookie', val)
          .expect(200, '3', function (err, res) {
            var a = new Date(expires(res))
            var b = new Date
            var delta = a.valueOf() - b.valueOf()

            val = cookie(res);

            assert.ok(delta > 2999999000 && delta <= 3000000000)
            done();
          });
        });
      })

      describe('.expires', function(){
        describe('when given a Date', function(){
          it('should set absolute', function(done){
            var app = express()
              .use(session({ secret: 'keyboard cat' }))
              .use(function(req, res, next){
                req.session.cookie.expires = new Date(0);
                res.end();
              });

            request(app)
            .get('/')
            .end(function(err, res){
              if (err) return done(err)
              assert.equal(expires(res), 'Thu, 01 Jan 1970 00:00:00 GMT')
              done();
            });
          })
        })

        describe('when null', function(){
          it('should be a browser-session cookie', function(done){
            var app = express()
              .use(session({ secret: 'keyboard cat' }))
              .use(function(req, res, next){
                req.session.cookie.expires = null;
                res.end();
              });

            request(app)
            .get('/')
            .expect(200, function(err, res){
              if (err) return done(err);
              var val = cookie(res);
              assert.equal(val.indexOf('Expires'), -1, 'should be not have cookie Expires')
              done();
            });
          })
        })
      })
    })
  })

  describe('synchronous store', function(){
    it('should respond correctly on save', function(done){
      var store = new SyncStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.count = req.session.count || 0
        req.session.count++
        res.end('hits: ' + req.session.count)
      })

      request(server)
      .get('/')
      .expect(200, 'hits: 1', done)
    })

    it('should respond correctly on destroy', function(done){
      var store = new SyncStore()
      var server = createServer({ store: store, unset: 'destroy' }, function (req, res) {
        req.session.count = req.session.count || 0
        var count = ++req.session.count
        if (req.session.count > 1) {
          req.session = null
          res.write('destroyed\n')
        }
        res.end('hits: ' + count)
      })

      request(server)
      .get('/')
      .expect(200, 'hits: 1', function (err, res) {
        if (err) return done(err)
        request(server)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(200, 'destroyed\nhits: 2', done)
      })
    })
  })

  describe('cookieParser()', function () {
    it('should read from req.cookies', function(done){
      var app = express()
        .use(cookieParser())
        .use(function(req, res, next){ req.headers.cookie = 'foo=bar'; next() })
        .use(session({ secret: 'keyboard cat' }))
        .use(function(req, res, next){
          req.session.count = req.session.count || 0
          req.session.count++
          res.end(req.session.count.toString())
        })

      request(app)
      .get('/')
      .expect(200, '1', function (err, res) {
        if (err) return done(err)
        request(app)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(200, '2', done)
      })
    })

    it('should reject unsigned from req.cookies', function(done){
      var app = express()
        .use(cookieParser())
        .use(function(req, res, next){ req.headers.cookie = 'foo=bar'; next() })
        .use(session({ secret: 'keyboard cat', key: 'sessid' }))
        .use(function(req, res, next){
          req.session.count = req.session.count || 0
          req.session.count++
          res.end(req.session.count.toString())
        })

      request(app)
      .get('/')
      .expect(200, '1', function (err, res) {
        if (err) return done(err)
        request(app)
        .get('/')
        .set('Cookie', 'sessid=' + sid(res))
        .expect(200, '1', done)
      })
    })

    it('should reject invalid signature from req.cookies', function(done){
      var app = express()
        .use(cookieParser())
        .use(function(req, res, next){ req.headers.cookie = 'foo=bar'; next() })
        .use(session({ secret: 'keyboard cat', key: 'sessid' }))
        .use(function(req, res, next){
          req.session.count = req.session.count || 0
          req.session.count++
          res.end(req.session.count.toString())
        })

      request(app)
      .get('/')
      .expect(200, '1', function (err, res) {
        if (err) return done(err)
        var val = cookie(res).replace(/...\./, '.')
        request(app)
        .get('/')
        .set('Cookie', val)
        .expect(200, '1', done)
      })
    })

    it('should read from req.signedCookies', function(done){
      var app = express()
        .use(cookieParser('keyboard cat'))
        .use(function(req, res, next){ delete req.headers.cookie; next() })
        .use(session())
        .use(function(req, res, next){
          req.session.count = req.session.count || 0
          req.session.count++
          res.end(req.session.count.toString())
        })

      request(app)
      .get('/')
      .expect(200, '1', function (err, res) {
        if (err) return done(err)
        request(app)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(200, '2', done)
      })
    })
  })
})

function cookie(res) {
  var setCookie = res.headers['set-cookie'];
  return (setCookie && setCookie[0]) || undefined;
}

function createServer(opts, fn) {
  return http.createServer(createRequestListener(opts, fn))
}

function createRequestListener(opts, fn) {
  var _session = createSession(opts)
  var respond = fn || end

  return function onRequest(req, res) {
    var server = this

    _session(req, res, function (err) {
      if (err && !res._header) {
        res.statusCode = err.status || 500
        res.end(err.message)
        return
      }

      if (err) {
        server.emit('error', err)
        return
      }

      respond(req, res)
    })
  }
}

function createSession(opts) {
  var options = opts || {}

  if (!('cookie' in options)) {
    options.cookie = { maxAge: 60 * 1000 }
  }

  if (!('secret' in options)) {
    options.secret = 'keyboard cat'
  }

  return session(options)
}

function end(req, res) {
  res.end()
}

function expires(res) {
  var match = /Expires=([^;]+)/.exec(cookie(res));
  return match ? match[1] : undefined;
}

function shouldNotHaveHeader(header) {
  return function (res) {
    assert.ok(!(header.toLowerCase() in res.headers), 'should not have ' + header + ' header')
  }
}

function shouldSetCookie(name) {
  return function (res) {
    var header = cookie(res)
    assert.ok(header, 'should have a cookie header')
    assert.equal(header.split('=')[0], name, 'should set cookie ' + name)
  }
}

function shouldSetCookieToValue(name, val) {
  return function (res) {
    var header = cookie(res);
    assert.ok(header, 'should have a cookie header')
    assert.equal(header.split('=')[0], name, 'should set cookie ' + name)
    assert.equal(header.split('=')[1].split(';')[0], val, 'should set cookie ' + name + ' to ' + val)
  }
}

function sid(res) {
  var match = /^[^=]+=s%3A([^;\.]+)[\.;]/.exec(cookie(res))
  var val = match ? match[1] : undefined
  return val
}

function writePatch() {
  var ended = false
  return function addWritePatch(req, res, next) {
    var _end = res.end
    var _write = res.write

    res.end = function end() {
      ended = true
      return _end.apply(this, arguments)
    }

    res.write = function write() {
      if (ended) {
        throw new Error('write after end')
      }

      return _write.apply(this, arguments)
    }

    next()
  }
}

function SyncStore() {
  this.sessions = Object.create(null);
}

SyncStore.prototype.__proto__ = session.Store.prototype;

SyncStore.prototype.destroy = function destroy(sid, callback) {
  delete this.sessions[sid];
  callback();
};

SyncStore.prototype.get = function get(sid, callback) {
  callback(null, JSON.parse(this.sessions[sid]));
};

SyncStore.prototype.set = function set(sid, sess, callback) {
  this.sessions[sid] = JSON.stringify(sess);
  callback();
};
