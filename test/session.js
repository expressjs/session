
var after = require('after')
var assert = require('assert')
var cookieParser = require('cookie-parser')
var crypto = require('crypto')
var express = require('express')
var fs = require('fs')
var http = require('http')
var https = require('https')
var request = require('supertest')
var session = require('../')
var SmartStore = require('./support/smart-store')
var SyncStore = require('./support/sync-store')
var utils = require('./support/utils')

var Cookie = require('../session/cookie')

var min = 60 * 1000;

describe('session()', function(){
  it('should export constructors', function(){
    assert.strictEqual(typeof session.Session, 'function')
    assert.strictEqual(typeof session.Store, 'function')
    assert.strictEqual(typeof session.MemoryStore, 'function')
  })

  it('should do nothing if req.session exists', function(done){
    function setup (req) {
      req.session = {}
    }

    request(createServer(setup))
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
    function setup (req) {
      req.secret = 'keyboard cat'
    }

    request(createServer(setup, { secret: undefined }))
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
        assert.strictEqual(len, 1)
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
        assert.strictEqual(Object.keys(sess).length, 2)
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

  it('should handle empty req.url', function (done) {
    function setup (req) {
      req.url = ''
    }

    request(createServer(setup))
    .get('/')
    .expect(shouldSetCookie('connect.sid'))
    .expect(200, done)
  })

  it('should handle multiple res.end calls', function(done){
    var server = createServer(null, function (req, res) {
      res.setHeader('Content-Type', 'text/plain')
      res.end('Hello, world!')
      res.end()
    })

    request(server)
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
        assert.strictEqual(length, 0)
        done()
      })
    })
  })

  it('should update cookie expiration when slow write', function (done) {
    var server = createServer({ rolling: true }, function (req, res) {
      req.session.user = 'bob'
      res.write('hello, ')
      setTimeout(function () {
        res.end('world!')
      }, 200)
    })

    request(server)
    .get('/')
    .expect(shouldSetCookie('connect.sid'))
    .expect(200, function (err, res) {
      if (err) return done(err);
      var originalExpires = expires(res);
      setTimeout(function () {
        request(server)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(shouldSetCookie('connect.sid'))
        .expect(function (res) { assert.notStrictEqual(originalExpires, expires(res)); })
        .expect(200, done);
      }, (1000 - (Date.now() % 1000) + 200));
    });
  });

  describe('when response ended', function () {
    it('should have saved session', function (done) {
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.hit = true
        res.end('session saved')
      })

      request(server)
        .get('/')
        .expect(200)
        .expect(shouldSetSessionInStore(store, 200))
        .expect('session saved')
        .end(done)
    })

    it('should have saved session even with empty response', function (done) {
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.hit = true
        res.setHeader('Content-Length', '0')
        res.end()
      })

      request(server)
        .get('/')
        .expect(200)
        .expect(shouldSetSessionInStore(store, 200))
        .end(done)
    })

    it('should have saved session even with multi-write', function (done) {
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.hit = true
        res.setHeader('Content-Length', '12')
        res.write('hello, ')
        res.end('world')
      })

      request(server)
        .get('/')
        .expect(200)
        .expect(shouldSetSessionInStore(store, 200))
        .expect('hello, world')
        .end(done)
    })

    it('should have saved session even with non-chunked response', function (done) {
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.hit = true
        res.setHeader('Content-Length', '13')
        res.end('session saved')
      })

      request(server)
        .get('/')
        .expect(200)
        .expect(shouldSetSessionInStore(store, 200))
        .expect('session saved')
        .end(done)
    })

    it('should have saved session with updated cookie expiration', function (done) {
      var store = new session.MemoryStore()
      var server = createServer({ cookie: { maxAge: min }, store: store }, function (req, res) {
        req.session.user = 'bob'
        res.end(req.session.id)
      })

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, function (err, res) {
        if (err) return done(err)
        var id = res.text
        store.get(id, function (err, sess) {
          if (err) return done(err)
          assert.ok(sess, 'session saved to store')
          var exp = new Date(sess.cookie.expires)
          assert.strictEqual(exp.toUTCString(), expires(res))
          setTimeout(function () {
            request(server)
            .get('/')
            .set('Cookie', cookie(res))
            .expect(200, function (err, res) {
              if (err) return done(err)
              store.get(id, function (err, sess) {
                if (err) return done(err)
                assert.strictEqual(res.text, id)
                assert.ok(sess, 'session still in store')
                assert.notStrictEqual(new Date(sess.cookie.expires).toUTCString(), exp.toUTCString(), 'session cookie expiration updated')
                done()
              })
            })
          }, (1000 - (Date.now() % 1000) + 200))
        })
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
        store.clear(function (err) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetCookie('connect.sid'))
          .expect(shouldSetCookieToDifferentSessionId(sid(res)))
          .expect(200, 'session 2', done)
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
        .expect(shouldSetCookieToDifferentSessionId(val))
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
        setTimeout(function () {
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetCookie('connect.sid'))
          .expect(shouldSetCookieToDifferentSessionId(sid(res)))
          .expect(200, 'session 2', done)
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
            assert.strictEqual(Object.keys(sess).length, 0)
            done()
          })
        }, 10)
      })
    })
  })

  describe('when session without cookie property in store', function () {
    it('should pass error from inflate', function (done) {
      var count = 0
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.num = req.session.num || ++count
        res.end('session ' + req.session.num)
      })

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        store.set(sid(res), { foo: 'bar' }, function (err) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(500, /Cannot read prop/, done)
        })
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
      before(function () {
        function setup (req) {
          req.secure = req.headers['x-secure']
            ? JSON.parse(req.headers['x-secure'])
            : undefined
        }

        function respond (req, res) {
          res.end(String(req.secure))
        }

        this.server = createServer(setup, { proxy: false, cookie: { secure: true }}, respond)
      })

      it('should not trust X-Forwarded-Proto', function(done){
        request(this.server)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
      })

      it('should ignore req.secure', function (done) {
        request(this.server)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Secure', 'true')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, 'true', done)
      })
    })

    describe('when unspecified', function(){
      before(function () {
        function setup (req) {
          req.secure = req.headers['x-secure']
            ? JSON.parse(req.headers['x-secure'])
            : undefined
        }

        function respond (req, res) {
          res.end(String(req.secure))
        }

        this.server = createServer(setup, { cookie: { secure: true }}, respond)
      })

      it('should not trust X-Forwarded-Proto', function(done){
        request(this.server)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
      })

      it('should use req.secure', function (done) {
        request(this.server)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Secure', 'true')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, 'true', done)
      })
    })
  })

  describe('cookie option', function () {
    describe('when "path" set to "/foo/bar"', function () {
      before(function () {
        this.server = createServer({ cookie: { path: '/foo/bar' } })
      })

      it('should not set cookie for "/" request', function (done) {
        request(this.server)
        .get('/')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
      })

      it('should not set cookie for "http://foo/bar" request', function (done) {
        request(this.server)
        .get('/')
        .set('host', 'http://foo/bar')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
      })

      it('should set cookie for "/foo/bar" request', function (done) {
        request(this.server)
        .get('/foo/bar/baz')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, done)
      })

      it('should set cookie for "/foo/bar/baz" request', function (done) {
        request(this.server)
        .get('/foo/bar/baz')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, done)
      })

      describe('when mounted at "/foo"', function () {
        before(function () {
          this.server = createServer(mountAt('/foo'), { cookie: { path: '/foo/bar' } })
        })

        it('should set cookie for "/foo/bar" request', function (done) {
          request(this.server)
          .get('/foo/bar')
          .expect(shouldSetCookie('connect.sid'))
          .expect(200, done)
        })

        it('should not set cookie for "/foo/foo/bar" request', function (done) {
          request(this.server)
          .get('/foo/foo/bar')
          .expect(shouldNotHaveHeader('Set-Cookie'))
          .expect(200, done)
        })
      })
    })

    describe('when "secure" set to "auto"', function () {
      describe('when "proxy" is "true"', function () {
        before(function () {
          this.server = createServer({ proxy: true, cookie: { maxAge: 5, secure: 'auto' }})
        })

        it('should set secure when X-Forwarded-Proto is https', function (done) {
          request(this.server)
          .get('/')
          .set('X-Forwarded-Proto', 'https')
          .expect(shouldSetCookieWithAttribute('connect.sid', 'Secure'))
          .expect(200, done)
        })
      })

      describe('when "proxy" is "false"', function () {
        before(function () {
          this.server = createServer({ proxy: false, cookie: { maxAge: 5, secure: 'auto' }})
        })

        it('should not set secure when X-Forwarded-Proto is https', function (done) {
          request(this.server)
          .get('/')
          .set('X-Forwarded-Proto', 'https')
          .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Secure'))
          .expect(200, done)
        })
      })

      describe('when "proxy" is undefined', function() {
        before(function () {
          function setup (req) {
            req.secure = JSON.parse(req.headers['x-secure'])
          }

          function respond (req, res) {
            res.end(String(req.secure))
          }

          this.server = createServer(setup, { cookie: { secure: 'auto' } }, respond)
        })

        it('should set secure if req.secure = true', function (done) {
          request(this.server)
          .get('/')
          .set('X-Secure', 'true')
          .expect(shouldSetCookieWithAttribute('connect.sid', 'Secure'))
          .expect(200, 'true', done)
        })

        it('should not set secure if req.secure = false', function (done) {
          request(this.server)
          .get('/')
          .set('X-Secure', 'false')
          .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Secure'))
          .expect(200, 'false', done)
        })
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

  describe('name option', function () {
    it('should default to "connect.sid"', function (done) {
      request(createServer())
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done)
    })

    it('should set the cookie name', function (done) {
      request(createServer({ name: 'session_id' }))
      .get('/')
      .expect(shouldSetCookie('session_id'))
      .expect(200, done)
    })
  })

  describe('rolling option', function(){
    it('should default to false', function(done){
      var server = createServer(null, function (req, res) {
        req.session.user = 'bob'
        res.end()
      })

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, function(err, res){
        if (err) return done(err);
        request(server)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, done)
      });
    });

    it('should force cookie on unmodified session', function(done){
      var server = createServer({ rolling: true }, function (req, res) {
        req.session.user = 'bob'
        res.end()
      })

      request(server)
      .get('/')
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, function(err, res){
        if (err) return done(err);
        request(server)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, done)
      });
    });

    it('should not force cookie on uninitialized session if saveUninitialized option is set to false', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store, rolling: true, saveUninitialized: false })

      request(server)
      .get('/')
      .expect(shouldNotSetSessionInStore(store))
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, done)
    });

    it('should force cookie and save uninitialized session if saveUninitialized option is set to true', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store, rolling: true, saveUninitialized: true })

      request(server)
      .get('/')
      .expect(shouldSetSessionInStore(store))
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done)
    });

    it('should force cookie and save modified session even if saveUninitialized option is set to false', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store, rolling: true, saveUninitialized: false }, function (req, res) {
        req.session.user = 'bob'
        res.end()
      })

      request(server)
      .get('/')
      .expect(shouldSetSessionInStore(store))
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done);
    });
  });

  describe('resave option', function(){
    it('should default to true', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        req.session.user = 'bob'
        res.end()
      })

      request(server)
      .get('/')
      .expect(shouldSetSessionInStore(store))
      .expect(200, function(err, res){
        if (err) return done(err);
        request(server)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(shouldSetSessionInStore(store))
        .expect(200, done);
      });
    });

    describe('when true', function () {
      it('should force save on unmodified session', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ store: store, resave: true }, function (req, res) {
          req.session.user = 'bob'
          res.end()
        })

        request(server)
        .get('/')
        .expect(shouldSetSessionInStore(store))
        .expect(200, function (err, res) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetSessionInStore(store))
          .expect(200, done)
        })
      })
    })

    describe('when false', function () {
      it('should prevent save on unmodified session', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ store: store, resave: false }, function (req, res) {
          req.session.user = 'bob'
          res.end()
        })

        request(server)
        .get('/')
        .expect(shouldSetSessionInStore(store))
        .expect(200, function (err, res) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldNotSetSessionInStore(store))
          .expect(200, done)
        })
      })

      it('should still save modified session', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ resave: false, store: store }, function (req, res) {
          if (req.method === 'PUT') {
            req.session.token = req.url.substr(1)
          }
          res.end('token=' + (req.session.token || ''))
        })

        request(server)
        .put('/w6RHhwaA')
        .expect(200)
        .expect(shouldSetSessionInStore(store))
        .expect('token=w6RHhwaA')
        .end(function (err, res) {
          if (err) return done(err)
          var sess = cookie(res)
          request(server)
          .get('/')
          .set('Cookie', sess)
          .expect(200)
          .expect(shouldNotSetSessionInStore(store))
          .expect('token=w6RHhwaA')
          .end(function (err) {
            if (err) return done(err)
            request(server)
            .put('/zfQ3rzM3')
            .set('Cookie', sess)
            .expect(200)
            .expect(shouldSetSessionInStore(store))
            .expect('token=zfQ3rzM3')
            .end(done)
          })
        })
      })

      it('should detect a "cookie" property as modified', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ store: store, resave: false }, function (req, res) {
          req.session.user = req.session.user || {}
          req.session.user.name = 'bob'
          req.session.user.cookie = req.session.user.cookie || 0
          req.session.user.cookie++
          res.end()
        })

        request(server)
        .get('/')
        .expect(shouldSetSessionInStore(store))
        .expect(200, function (err, res) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetSessionInStore(store))
          .expect(200, done)
        })
      })

      it('should pass session touch error', function (done) {
        var cb = after(2, done)
        var store = new session.MemoryStore()
        var server = createServer({ store: store, resave: false }, function (req, res) {
          req.session.hit = true
          res.end('session saved')
        })

        store.touch = function touch (sid, sess, callback) {
          callback(new Error('boom!'))
        }

        server.on('error', function onerror (err) {
          assert.ok(err)
          assert.strictEqual(err.message, 'boom!')
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
    })
  });

  describe('saveUninitialized option', function(){
    it('should default to true', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store })

      request(server)
      .get('/')
      .expect(shouldSetSessionInStore(store))
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done);
    });

    it('should force save of uninitialized session', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store, saveUninitialized: true })

      request(server)
      .get('/')
      .expect(shouldSetSessionInStore(store))
      .expect(shouldSetCookie('connect.sid'))
      .expect(200, done);
    });

    it('should prevent save of uninitialized session', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store, saveUninitialized: false })

      request(server)
      .get('/')
      .expect(shouldNotSetSessionInStore(store))
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, done)
    });

    it('should still save modified session', function(done){
      var store = new session.MemoryStore()
      var server = createServer({ store: store, saveUninitialized: false }, function (req, res) {
        req.session.count = req.session.count || 0
        req.session.count++
        res.end()
      })

      request(server)
      .get('/')
      .expect(shouldSetSessionInStore(store))
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
        assert.strictEqual(err.message, 'boom!')
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

    it('should sign and unsign with a string', function (done) {
      var server = createServer({ secret: 'awesome cat' }, function (req, res) {
        if (!req.session.user) {
          req.session.user = 'bob'
          res.end('set')
        } else {
          res.end('get:' + JSON.stringify(req.session.user))
        }
      })

      request(server)
        .get('/')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, 'set', function (err, res) {
          if (err) return done(err)
          request(server)
            .get('/')
            .set('Cookie', cookie(res))
            .expect(200, 'get:"bob"', done)
        })
    })

    it('should sign and unsign with a Buffer', function (done) {
      var server = createServer({ secret: crypto.randomBytes(32) }, function (req, res) {
        if (!req.session.user) {
          req.session.user = 'bob'
          res.end('set')
        } else {
          res.end('get:' + JSON.stringify(req.session.user))
        }
      })

      request(server)
        .get('/')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, 'set', function (err, res) {
          if (err) return done(err)
          request(server)
            .get('/')
            .set('Cookie', cookie(res))
            .expect(200, 'get:"bob"', done)
        })
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
      var server = createServer({ store: store }, function (req, res) {
        req.session.count = req.session.count || 0
        req.session.count++
        if (req.session.count === 2) req.session = null
        res.end()
      })

      request(server)
      .get('/')
      .expect(200, function(err, res){
        if (err) return done(err);
        store.length(function(err, len){
          if (err) return done(err);
          assert.strictEqual(len, 1)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, function(err, res){
            if (err) return done(err);
            store.length(function(err, len){
              if (err) return done(err);
              assert.strictEqual(len, 1)
              done();
            });
          });
        });
      });
    });

    it('should allow destroy on req.session = null', function(done){
      var store = new session.MemoryStore();
      var server = createServer({ store: store, unset: 'destroy' }, function (req, res) {
        req.session.count = req.session.count || 0
        req.session.count++
        if (req.session.count === 2) req.session = null
        res.end()
      })

      request(server)
      .get('/')
      .expect(200, function(err, res){
        if (err) return done(err);
        store.length(function(err, len){
          if (err) return done(err);
          assert.strictEqual(len, 1)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, function(err, res){
            if (err) return done(err);
            store.length(function(err, len){
              if (err) return done(err);
              assert.strictEqual(len, 0)
              done();
            });
          });
        });
      });
    });

    it('should not set cookie if initial session destroyed', function(done){
      var store = new session.MemoryStore();
      var server = createServer({ store: store, unset: 'destroy' }, function (req, res) {
        req.session = null
        res.end()
      })

      request(server)
      .get('/')
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, function(err, res){
        if (err) return done(err);
        store.length(function(err, len){
          if (err) return done(err);
          assert.strictEqual(len, 0)
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
        assert.strictEqual(err.message, 'boom!')
        cb()
      })

      request(server)
      .get('/')
      .expect(200, 'session destroyed', cb)
    })
  });

  describe('res.end patch', function () {
    it('should correctly handle res.end/res.write patched prior', function (done) {
      function setup (req, res) {
        utils.writePatch(res)
      }

      function respond (req, res) {
        req.session.hit = true
        res.write('hello, ')
        res.end('world')
      }

      request(createServer(setup, null, respond))
      .get('/')
      .expect(200, 'hello, world', done)
    })

    it('should correctly handle res.end/res.write patched after', function (done) {
      function respond (req, res) {
        utils.writePatch(res)
        req.session.hit = true
        res.write('hello, ')
        res.end('world')
      }

      request(createServer(null, respond))
      .get('/')
      .expect(200, 'hello, world', done)
    })

    it('should error when res.end is called twice', function (done) {
      var error1 = null
      var error2 = null
      var server = http.createServer(function (req, res) {
        res.end()

        try {
          res.setHeader('Content-Length', '3')
          res.end('foo')
        } catch (e) {
          error1 = e
        }
      })

      function respond (req, res) {
        res.end()

        try {
          res.setHeader('Content-Length', '3')
          res.end('foo')
        } catch (e) {
          error2 = e
        }
      }

      request(server)
        .get('/')
        .end(function (err, res) {
          if (err) return done(err)
          request(createServer(null, respond))
            .get('/')
            .expect(function () { assert.strictEqual((error1 && error1.message), (error2 && error2.message)) })
            .expect(res.statusCode, res.text, done)
        })
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
      var server = createServer(null, function (req, res) {
        if (modify) {
          req.session.count = req.session.count || 0
          req.session.count++
        }
        res.end(req.session.count.toString())
      })

      request(server)
      .get('/')
      .expect(200, '1', function (err, res) {
        if (err) return done(err)
        request(server)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(200, '2', function (err, res) {
          if (err) return done(err)
          var val = cookie(res);
          modify = false;

          request(server)
          .get('/')
          .set('Cookie', val)
          .expect(shouldNotHaveHeader('Set-Cookie'))
          .expect(200, '2', function (err, res) {
            if (err) return done(err)
            modify = true;

            request(server)
            .get('/')
            .set('Cookie', val)
            .expect(shouldSetCookie('connect.sid'))
            .expect(200, '3', done)
          });
        });
      });
    })

    it('should not have enumerable methods', function (done) {
      var server = createServer(null, function (req, res) {
        req.session.foo = 'foo'
        req.session.bar = 'bar'
        var keys = []
        for (var key in req.session) {
          keys.push(key)
        }
        res.end(keys.sort().join(','))
      })

      request(server)
      .get('/')
      .expect(200, 'bar,cookie,foo', done);
    });

    it('should not be set if store is disconnected', function (done) {
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        res.end(typeof req.session)
      })

      store.emit('disconnect')

      request(server)
      .get('/')
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, 'undefined', done)
    })

    it('should be set when store reconnects', function (done) {
      var store = new session.MemoryStore()
      var server = createServer({ store: store }, function (req, res) {
        res.end(typeof req.session)
      })

      store.emit('disconnect')

      request(server)
      .get('/')
      .expect(shouldNotHaveHeader('Set-Cookie'))
      .expect(200, 'undefined', function (err) {
        if (err) return done(err)

        store.emit('connect')

        request(server)
        .get('/')
        .expect(200, 'object', done)
      })
    })

    describe('.destroy()', function(){
      it('should destroy the previous session', function(done){
        var server = createServer(null, function (req, res) {
          req.session.destroy(function (err) {
            if (err) res.statusCode = 500
            res.end(String(req.session))
          })
        })

        request(server)
        .get('/')
        .expect(shouldNotHaveHeader('Set-Cookie'))
        .expect(200, 'undefined', done)
      })
    })

    describe('.regenerate()', function(){
      it('should destroy/replace the previous session', function(done){
        var server = createServer(null, function (req, res) {
          var id = req.session.id
          req.session.regenerate(function (err) {
            if (err) res.statusCode = 500
            res.end(String(req.session.id === id))
          })
        })

        request(server)
        .get('/')
        .expect(shouldSetCookie('connect.sid'))
        .expect(200, function (err, res) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetCookie('connect.sid'))
          .expect(shouldSetCookieToDifferentSessionId(sid(res)))
          .expect(200, 'false', done)
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

      it('should not override an overridden `reload` in case of errors',  function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ store: store, resave: false }, function (req, res) {
          if (req.url === '/') {
            req.session.active = true
            res.end('session created')
            return
          }

          store.clear(function (err) {
            if (err) return done(err)

            // reload way too many times on top of each other,
            // attempting to overflow the call stack
            var iters = 20
            reload()
            function reload () {
              if (!--iters) {
                res.end('ok')
                return
              }

              try {
                req.session.reload(reload)
              } catch (e) {
                res.statusCode = 500
                res.end(e.message)
              }
            }
          })
        })

        request(server)
          .get('/')
          .expect(200, 'session created', function (err, res) {
            if (err) return done(err)
            request(server)
              .get('/foo')
              .set('Cookie', cookie(res))
              .expect(200, 'ok', done)
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
        var store = new session.MemoryStore()
        var server = createServer({ store: store }, function (req, res) {
          req.session.hit = true
          req.session.save(function (err) {
            if (err) return res.end(err.message)
            res.end('saved')
          })
        })

        request(server)
        .get('/')
        .expect(shouldSetSessionInStore(store))
        .expect(200, 'saved', function (err, res) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetSessionInStore(store))
          .expect(200, 'saved', done)
        })
      })

      it('should prevent end-of-request save on reloaded session', function (done) {
        var store = new session.MemoryStore()
        var server = createServer({ store: store }, function (req, res) {
          req.session.hit = true
          req.session.reload(function () {
            req.session.save(function (err) {
              if (err) return res.end(err.message)
              res.end('saved')
            })
          })
        })

        request(server)
        .get('/')
        .expect(shouldSetSessionInStore(store))
        .expect(200, 'saved', function (err, res) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(shouldSetSessionInStore(store))
          .expect(200, 'saved', done)
        })
      })

      describe('when saveUninitialized is false', function () {
        it('should prevent end-of-request save', function (done) {
          var store = new session.MemoryStore()
          var server = createServer({ saveUninitialized: false, store: store }, function (req, res) {
            req.session.hit = true
            req.session.save(function (err) {
              if (err) return res.end(err.message)
              res.end('saved')
            })
          })

          request(server)
            .get('/')
            .expect(shouldSetSessionInStore(store))
            .expect(200, 'saved', function (err, res) {
              if (err) return done(err)
              request(server)
                .get('/')
                .set('Cookie', cookie(res))
                .expect(shouldSetSessionInStore(store))
                .expect(200, 'saved', done)
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
                  assert.notStrictEqual(new Date(sess.cookie.expires).getTime(), exp.getTime())
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
          var server = createServer({ proxy: true }, function (req, res) {
            req.session.cookie.httpOnly = false
            req.session.cookie.secure = true
            res.end()
          })

          request(server)
          .get('/')
          .set('X-Forwarded-Proto', 'https')
          .expect(shouldSetCookieWithoutAttribute('connect.sid', 'HttpOnly'))
          .expect(shouldSetCookieWithAttribute('connect.sid', 'Secure'))
          .expect(200, done)
        })

        it('should default to a browser-session length cookie', function(done){
          request(createServer({ cookie: { path: '/admin' } }))
          .get('/admin')
          .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Expires'))
          .expect(200, done)
        })

        it('should Set-Cookie only once for browser-session cookies', function(done){
          var server = createServer({ cookie: { path: '/admin' } })

          request(server)
          .get('/admin/foo')
          .expect(shouldSetCookie('connect.sid'))
          .expect(200, function (err, res) {
            if (err) return done(err)
            request(server)
            .get('/admin')
            .set('Cookie', cookie(res))
            .expect(shouldNotHaveHeader('Set-Cookie'))
            .expect(200, done)
          });
        })

        it('should override defaults', function(done){
          var opts = {
            httpOnly: false,
            maxAge: 5000,
            path: '/admin',
            priority: 'high',
            secure: true
          }
          var server = createServer({ cookie: opts }, function (req, res) {
            req.session.cookie.secure = false
            res.end()
          })

          request(server)
            .get('/admin')
            .expect(shouldSetCookieWithAttribute('connect.sid', 'Expires'))
            .expect(shouldSetCookieWithoutAttribute('connect.sid', 'HttpOnly'))
            .expect(shouldSetCookieWithAttributeAndValue('connect.sid', 'Path', '/admin'))
            .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Secure'))
            .expect(shouldSetCookieWithAttributeAndValue('connect.sid', 'Priority', 'High'))
            .expect(200, done)
        })

        it('should forward errors setting cookie', function (done) {
          var cb = after(2, done)
          var server = createServer({ cookie: { expires: new Date(NaN) } }, function (req, res) {
            res.end()
          })

          server.on('error', function onerror (err) {
            assert.ok(err)
            assert.strictEqual(err.message, 'option expires is invalid')
            cb()
          })

          request(server)
            .get('/admin')
            .expect(200, cb)
        })

        it('should preserve cookies set before writeHead is called', function(done){
          var server = createServer(null, function (req, res) {
            var cookie = new Cookie()
            res.setHeader('Set-Cookie', cookie.serialize('previous', 'cookieValue'))
            res.end()
          })

          request(server)
          .get('/')
          .expect(shouldSetCookieToValue('previous', 'cookieValue'))
          .expect(200, done)
        })

        it('should preserve cookies set in writeHead', function (done) {
          var server = createServer(null, function (req, res) {
            var cookie = new Cookie()
            res.writeHead(200, {
              'Set-Cookie': cookie.serialize('previous', 'cookieValue')
            })
            res.end()
          })

          request(server)
            .get('/')
            .expect(shouldSetCookieToValue('previous', 'cookieValue'))
            .expect(200, done)
        })
      })

      describe('.originalMaxAge', function () {
        it('should equal original maxAge', function (done) {
          var server = createServer({ cookie: { maxAge: 2000 } }, function (req, res) {
            res.end(JSON.stringify(req.session.cookie.originalMaxAge))
          })

          request(server)
            .get('/')
            .expect(200)
            .expect(function (res) {
              // account for 1ms latency
              assert.ok(res.text === '2000' || res.text === '1999',
                'expected 2000, got ' + res.text)
            })
            .end(done)
        })

        it('should equal original maxAge for all requests', function (done) {
          var server = createServer({ cookie: { maxAge: 2000 } }, function (req, res) {
            res.end(JSON.stringify(req.session.cookie.originalMaxAge))
          })

          request(server)
            .get('/')
            .expect(200)
            .expect(function (res) {
              // account for 1ms latency
              assert.ok(res.text === '2000' || res.text === '1999',
                'expected 2000, got ' + res.text)
            })
            .end(function (err, res) {
              if (err) return done(err)
              setTimeout(function () {
                request(server)
                  .get('/')
                  .set('Cookie', cookie(res))
                  .expect(200)
                  .expect(function (res) {
                    // account for 1ms latency
                    assert.ok(res.text === '2000' || res.text === '1999',
                      'expected 2000, got ' + res.text)
                  })
                  .end(done)
              }, 100)
            })
        })

        it('should equal original maxAge for all requests', function (done) {
          var store = new SmartStore()
          var server = createServer({ cookie: { maxAge: 2000 }, store: store }, function (req, res) {
            res.end(JSON.stringify(req.session.cookie.originalMaxAge))
          })

          request(server)
            .get('/')
            .expect(200)
            .expect(function (res) {
              // account for 1ms latency
              assert.ok(res.text === '2000' || res.text === '1999',
                'expected 2000, got ' + res.text)
            })
            .end(function (err, res) {
              if (err) return done(err)
              setTimeout(function () {
                request(server)
                  .get('/')
                  .set('Cookie', cookie(res))
                  .expect(200)
                  .expect(function (res) {
                    // account for 1ms latency
                    assert.ok(res.text === '2000' || res.text === '1999',
                      'expected 2000, got ' + res.text)
                  })
                  .end(done)
              }, 100)
            })
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

      describe('.maxAge', function () {
        before(function (done) {
          var ctx = this

          ctx.cookie = ''
          ctx.server = createServer({ cookie: { maxAge: 2000 } }, function (req, res) {
            switch (++req.session.count) {
              case 1:
                break
              case 2:
                req.session.cookie.maxAge = 5000
                break
              case 3:
                req.session.cookie.maxAge = 3000000000
                break
              default:
                req.session.count = 0
                break
            }
            res.end(req.session.count.toString())
          })

          request(ctx.server)
          .get('/')
          .end(function (err, res) {
            ctx.cookie = res && cookie(res)
            done(err)
          })
        })

        it('should set cookie expires relative to maxAge', function (done) {
          request(this.server)
          .get('/')
          .set('Cookie', this.cookie)
          .expect(shouldSetCookieToExpireIn('connect.sid', 2000))
          .expect(200, '1', done)
        })

        it('should modify cookie expires when changed', function (done) {
          request(this.server)
          .get('/')
          .set('Cookie', this.cookie)
          .expect(shouldSetCookieToExpireIn('connect.sid', 5000))
          .expect(200, '2', done)
        })

        it('should modify cookie expires when changed to large value', function (done) {
          request(this.server)
          .get('/')
          .set('Cookie', this.cookie)
          .expect(shouldSetCookieToExpireIn('connect.sid', 3000000000))
          .expect(200, '3', done)
        })
      })

      describe('.expires', function(){
        describe('when given a Date', function(){
          it('should set absolute', function(done){
            var server = createServer(null, function (req, res) {
              req.session.cookie.expires = new Date(0)
              res.end()
            })

            request(server)
            .get('/')
            .expect(shouldSetCookieWithAttributeAndValue('connect.sid', 'Expires', 'Thu, 01 Jan 1970 00:00:00 GMT'))
            .expect(200, done)
          })
        })

        describe('when null', function(){
          it('should be a browser-session cookie', function(done){
            var server = createServer(null, function (req, res) {
              req.session.cookie.expires = null
              res.end()
            })

            request(server)
            .get('/')
            .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Expires'))
            .expect(200, done)
          })

          it('should not reset cookie', function (done) {
            var server = createServer(null, function (req, res) {
              req.session.cookie.expires = null;
              res.end();
            });

            request(server)
            .get('/')
            .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Expires'))
            .expect(200, function (err, res) {
              if (err) return done(err);
              request(server)
              .get('/')
              .set('Cookie', cookie(res))
              .expect(shouldNotHaveHeader('Set-Cookie'))
              .expect(200, done)
            });
          })

          it('should not reset cookie when modified', function (done) {
            var server = createServer(null, function (req, res) {
              req.session.cookie.expires = null;
              req.session.hit = (req.session.hit || 0) + 1;
              res.end();
            });

            request(server)
            .get('/')
            .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Expires'))
            .expect(200, function (err, res) {
              if (err) return done(err);
              request(server)
              .get('/')
              .set('Cookie', cookie(res))
              .expect(shouldNotHaveHeader('Set-Cookie'))
              .expect(200, done)
            });
          })
        })
      })

      describe('.partitioned', function () {
        describe('by default', function () {
          it('should not set partitioned attribute', function (done) {
            var server = createServer()

            request(server)
              .get('/')
              .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Partitioned'))
              .expect(200, done)
          })
        })

        describe('when "false"', function () {
          it('should not set partitioned attribute', function (done) {
            var server = createServer({ cookie: { partitioned: false } })

            request(server)
              .get('/')
              .expect(shouldSetCookieWithoutAttribute('connect.sid', 'Partitioned'))
              .expect(200, done)
          })
        })

        describe('when "true"', function () {
          it('should set partitioned attribute', function (done) {
            var server = createServer({ cookie: { partitioned: true } })

            request(server)
              .get('/')
              .expect(shouldSetCookieWithAttribute('connect.sid', 'Partitioned'))
              .expect(200, done)
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
        .use(createSession())
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
        .use(createSession({ key: 'sessid' }))
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
        .use(createSession({ key: 'sessid' }))
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
        .use(createSession())
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

function createServer (options, respond) {
  var fn = respond
  var opts = options
  var server = http.createServer()

  // setup, options, respond
  if (typeof arguments[0] === 'function') {
    opts = arguments[1]
    fn = arguments[2]

    server.on('request', arguments[0])
  }

  return server.on('request', createRequestListener(opts, fn))
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

function expires (res) {
  var header = cookie(res)
  return header && utils.parseSetCookie(header).expires
}

function mountAt (path) {
  return function (req, res) {
    if (req.url.indexOf(path) === 0) {
      req.originalUrl = req.url
      req.url = req.url.slice(path.length)
    }
  }
}

function shouldNotHaveHeader(header) {
  return function (res) {
    assert.ok(!(header.toLowerCase() in res.headers), 'should not have ' + header + ' header')
  }
}

function shouldNotSetSessionInStore(store) {
  var _set = store.set
  var count = 0

  store.set = function set () {
    count++
    return _set.apply(this, arguments)
  }

  return function () {
    assert.ok(count === 0, 'should not set session in store')
  }
}

function shouldSetCookie (name) {
  return function (res) {
    var header = cookie(res)
    var data = header && utils.parseSetCookie(header)
    assert.ok(header, 'should have a cookie header')
    assert.strictEqual(data.name, name, 'should set cookie ' + name)
  }
}

function shouldSetCookieToDifferentSessionId (id) {
  return function (res) {
    assert.notStrictEqual(sid(res), id)
  }
}

function shouldSetCookieToExpireIn (name, delta) {
  return function (res) {
    var header = cookie(res)
    var data = header && utils.parseSetCookie(header)
    assert.ok(header, 'should have a cookie header')
    assert.strictEqual(data.name, name, 'should set cookie ' + name)
    assert.ok(('expires' in data), 'should set cookie with attribute Expires')
    assert.ok(('date' in res.headers), 'should have a date header')
    assert.strictEqual((Date.parse(data.expires) - Date.parse(res.headers.date)), delta, 'should set cookie ' + name + ' to expire in ' + delta + ' ms')
  }
}

function shouldSetCookieToValue (name, val) {
  return function (res) {
    var header = cookie(res)
    var data = header && utils.parseSetCookie(header)
    assert.ok(header, 'should have a cookie header')
    assert.strictEqual(data.name, name, 'should set cookie ' + name)
    assert.strictEqual(data.value, val, 'should set cookie ' + name + ' to ' + val)
  }
}

function shouldSetCookieWithAttribute (name, attrib) {
  return function (res) {
    var header = cookie(res)
    var data = header && utils.parseSetCookie(header)
    assert.ok(header, 'should have a cookie header')
    assert.strictEqual(data.name, name, 'should set cookie ' + name)
    assert.ok((attrib.toLowerCase() in data), 'should set cookie with attribute ' + attrib)
  }
}

function shouldSetCookieWithAttributeAndValue (name, attrib, value) {
  return function (res) {
    var header = cookie(res)
    var data = header && utils.parseSetCookie(header)
    assert.ok(header, 'should have a cookie header')
    assert.strictEqual(data.name, name, 'should set cookie ' + name)
    assert.ok((attrib.toLowerCase() in data), 'should set cookie with attribute ' + attrib)
    assert.strictEqual(data[attrib.toLowerCase()], value, 'should set cookie with attribute ' + attrib + ' set to ' + value)
  }
}

function shouldSetCookieWithoutAttribute (name, attrib) {
  return function (res) {
    var header = cookie(res)
    var data = header && utils.parseSetCookie(header)
    assert.ok(header, 'should have a cookie header')
    assert.strictEqual(data.name, name, 'should set cookie ' + name)
    assert.ok(!(attrib.toLowerCase() in data), 'should set cookie without attribute ' + attrib)
  }
}

function shouldSetSessionInStore (store, delay) {
  var _set = store.set
  var count = 0

  store.set = function set () {
    count++

    if (!delay) {
      return _set.apply(this, arguments)
    }

    var args = new Array(arguments.length + 1)

    args[0] = this
    for (var i = 1; i < args.length; i++) {
      args[i] = arguments[i - 1]
    }

    setTimeout(_set.bind.apply(_set, args), delay)
  }

  return function () {
    assert.ok(count === 1, 'should set session in store')
  }
}

function sid (res) {
  var header = cookie(res)
  var data = header && utils.parseSetCookie(header)
  var value = data && unescape(data.value)
  var sid = value && value.substring(2, value.indexOf('.'))
  return sid || undefined
}
