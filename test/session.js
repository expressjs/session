
process.env.NO_DEPRECATION = 'express-session';

var after = require('after')
var express = require('express')
  , assert = require('assert')
  , request = require('supertest')
  , should = require('should')
  , cookieParser = require('cookie-parser')
  , session = require('../')
  , Cookie = require('../session/cookie')
var http = require('http');

var min = 60 * 1000;

describe('session()', function(){
  it('should export constructors', function(){
    session.Session.should.be.a.Function;
    session.Store.should.be.a.Function;
    session.MemoryStore.should.be.a.Function;
  })

  it('should do nothing if req.session exists', function(done){
    var app = express()
      .use(function(req, res, next){ req.session = {}; next(); })
      .use(session({ secret: 'keyboard cat', cookie: { maxAge: min }}))
      .use(end);

      request(app)
      .get('/')
      .expect(200, function(err, res){
        if (err) return done(err);
        should(cookie(res)).be.empty;
        done();
      });
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
      .expect(200, '', done);
  })

  it('should create a new session', function (done) {
    var store = new session.MemoryStore()
    var server = createServer({ store: store }, function (req, res) {
      req.session.active = true
      res.end('session active')
    });

    request(server)
    .get('/')
    .expect(200, 'session active', function (err, res) {
      if (err) return done(err)
      should(sid(res)).not.be.empty
      store.length(function (err, len) {
        if (err) return done(err)
        len.should.equal(1)
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
    .expect(200, 'session 1', function (err, res) {
      if (err) return done(err)
      should(sid(res)).not.be.empty
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
    .expect(200, 'hello, world', function (err, res) {
      if (err) return done(err)
      should(sid(res)).not.be.empty
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
    .expect(200, 'session 1', function (err, res) {
      if (err) return done(err)
      should(sid(res)).not.be.empty
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
        Object.keys(sess).should.have.length(2)
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
        saved.should.be.true
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
        saved.should.be.true
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
        saved.should.be.true
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
        saved.should.be.true
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
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        should(sid(res)).not.be.empty
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
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        var val = sid(res)
        should(val).not.be.empty
        store.clear(function (err) {
          if (err) return done(err)
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, 'session 2', function (err, res) {
            if (err) return done(err)
            should(sid(res)).not.be.empty
            should(sid(res)).not.equal(val)
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
      .expect(200, 'session created', function (err, res) {
        if (err) return done(err)
        var val = sid(res)
        should(val).not.be.empty
        request(server)
        .get('/')
        .set('Cookie', 'sessid=' + val)
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
      .expect(200, 'session created', function (err, res) {
        if (err) return done(err)
        var val = cookie(res).replace(/...\./, '.')

        should(val).not.be.empty
        request(server)
        .get('/')
        .set('Cookie', val)
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
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        should(sid(res)).not.be.empty
        setTimeout(function () {
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, 'session 2', done)
        }, 10)
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
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        var val = sid(res)
        should(val).not.be.empty
        setTimeout(function () {
          request(server)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, 'session 2', function (err, res) {
            if (err) return done(err)
            should(sid(res)).not.be.empty
            should(sid(res)).not.equal(val)
            done()
          })
        }, 10)
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
      .expect(200, 'session 1', function (err, res) {
        if (err) return done(err)
        var val = sid(res)
        should(val).not.be.empty
        setTimeout(function () {
          store.all(function (err, sess) {
            if (err) return done(err)
            Object.keys(sess).should.have.length(0)
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
        .expect(200, function(err, res){
          if (err) return done(err);
          should(cookie(res)).not.be.empty;
          done();
        });
      })

      it('should trust X-Forwarded-Proto when comma-separated list', function(done){
        request(server)
        .get('/')
        .set('X-Forwarded-Proto', 'https,http')
        .expect(200, function(err, res){
          if (err) return done(err);
          should(cookie(res)).not.be.empty;
          done();
        });
      })

      it('should work when no header', function(done){
        request(server)
        .get('/')
        .expect(200, function(err, res){
          if (err) return done(err);
          should(cookie(res)).be.empty;
          done();
        });
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
        .expect(200, function(err, res){
          if (err) return done(err);
          should(cookie(res)).be.empty;
          done();
        });
      })

      it('should ignore req.secure from express', function(done){
        var app = express()
          .use(session({ secret: 'keyboard cat', proxy: false, cookie: { secure: true, maxAge: min }}))
          .use(function(req, res) { res.json(req.secure); });
        app.enable('trust proxy');

        request(app)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect(200, 'true', function(err, res){
          if (err) return done(err);
          should(cookie(res)).be.empty;
          done();
        });
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
        .expect(200, function(err, res){
          if (err) return done(err);
          should(cookie(res)).be.empty;
          done();
        });
      })

      it('should use req.secure from express', function(done){
        var app = express()
          .use(session({ secret: 'keyboard cat', cookie: { secure: true, maxAge: min }}))
          .use(function(req, res) { res.json(req.secure); });
        app.enable('trust proxy');

        request(app)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect(200, 'true', function(err, res){
          if (err) return done(err);
          should(cookie(res)).not.be.empty;
          done();
        });
      })
    })
  })

  describe('genid option', function(){
    it('should reject non-function values', function(){
      session.bind(null, { genid: 'bogus!' }).should.throw(/genid.*must/);
    });

    it('should provide default generator', function(done){
      request(createServer())
      .get('/')
      .expect(200, function (err, res) {
        if (err) return done(err)
        should(sid(res)).not.be.empty
        done()
      })
    });

    it('should allow custom function', function(done){
      function genid() { return 'apple' }

      request(createServer({ genid: genid }))
      .get('/')
      .expect(200, function (err, res) {
        if (err) return done(err)
        should(sid(res)).equal('apple')
        done()
      })
    });

    it('should encode unsafe chars', function(done){
      function genid() { return '%' }

      request(createServer({ genid: genid }))
      .get('/')
      .expect(200, function (err, res) {
        if (err) return done(err)
        should(sid(res)).equal('%25')
        done()
      })
    });

    it('should provide req argument', function(done){
      function genid(req) { return req.url }

      request(createServer({ genid: genid }))
      .get('/foo')
      .expect(200, function (err, res) {
        if (err) return done(err)
        should(sid(res)).equal('%2Ffoo')
        done()
      })
    });
  });

  describe('key option', function(){
    it('should default to "connect.sid"', function(done){
      request(createServer())
      .get('/')
      .end(function(err, res){
        res.headers['set-cookie'].should.have.length(1);
        res.headers['set-cookie'][0].should.match(/^connect\.sid/);
        done();
      });
    })

    it('should allow overriding', function(done){
      request(createServer({ key: 'sid' }))
      .get('/')
      .end(function(err, res){
        res.headers['set-cookie'].should.have.length(1);
        res.headers['set-cookie'][0].should.match(/^sid/);
        done();
      });
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
      .expect(200, function(err, res){
        if (err) return done(err);
        should(cookie(res)).not.be.empty;
        request(app)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(200, function(err, res){
          if (err) return done(err);
          should(cookie(res)).be.empty;
          done();
        });
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
      .expect(200, function(err, res){
        if (err) return done(err);
        should(cookie(res)).not.be.empty;
        request(app)
        .get('/')
        .set('Cookie', cookie(res))
        .expect(200, function(err, res){
          if (err) return done(err);
          should(cookie(res)).not.be.empty;
          done();
        });
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
      .expect('set-cookie', /connect\.sid=/)
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
      .expect('set-cookie', /connect\.sid=/)
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
      .expect(200, function(err, res){
        if (err) return done(err);
        should(cookie(res)).be.empty;
        done();
      });
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
      .expect('set-cookie', /connect\.sid=/)
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
        err.message.should.equal('boom!')
        cb()
      })

      request(server)
      .get('/')
      .expect(200, 'session saved', cb)
    })
  });

  describe('unset option', function () {
    it('should reject unknown values', function(){
      session.bind(null, { unset: 'bogus!' }).should.throw(/unset.*must/);
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
          len.should.equal(1);
          request(app)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, function(err, res){
            if (err) return done(err);
            store.length(function(err, len){
              if (err) return done(err);
              len.should.equal(1);
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
          len.should.equal(1);
          request(app)
          .get('/')
          .set('Cookie', cookie(res))
          .expect(200, function(err, res){
            if (err) return done(err);
            store.length(function(err, len){
              if (err) return done(err);
              len.should.equal(0);
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
      .expect(200, function(err, res){
        if (err) return done(err);
        store.length(function(err, len){
          if (err) return done(err);
          len.should.equal(0);
          should(cookie(res)).be.empty;
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
        err.message.should.equal('boom!')
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
          should(sess).not.be.empty
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
      .end(function(err, res){
        res.text.should.equal('1');

        request(app)
        .get('/')
        .set('Cookie', cookie(res))
        .end(function(err, res){
          var val = cookie(res);
          res.text.should.equal('2');
          modify = false;

          request(app)
          .get('/')
          .set('Cookie', val)
          .end(function(err, res){
            should(sid(res)).be.empty;
            res.text.should.equal('2');
            modify = true;

            request(app)
            .get('/')
            .set('Cookie', val)
            .end(function(err, res){
              sid(res).should.not.be.empty;
              res.text.should.equal('3');
              done();
            });
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
        .end(function(err, res){
          res.headers.should.not.have.property('set-cookie');
          done();
        });
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
              id.should.not.equal(req.session.id);
              res.end();
            });
          });

        request(app)
        .get('/')
        .end(function(err, res){
          if (err) return done(err)
          var id = sid(res)
          request(app)
          .get('/')
          .set('Cookie', cookie(res))
          .end(function(err, res){
            if (err) return done(err)
            should(sid(res)).not.be.empty
            should(sid(res)).should.not.equal(id)
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
            should(val).not.containEql('HttpOnly');
            should(val).containEql('Secure');
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
            should(val).not.containEql('Expires');
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
          .end(function(err, res){
            res.headers.should.have.property('set-cookie');

            request(app)
            .get('/admin')
            .set('Cookie', cookie(res))
            .end(function(err, res){
              res.headers.should.not.have.property('set-cookie');
              done();
            })
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
            should(val).not.containEql('HttpOnly');
            should(val).not.containEql('Secure');
            should(val).containEql('Path=/admin');
            should(val).containEql('Expires');
            done();
          });
        })

        it('should preserve cookies set before writeHead is called', function(done){
          function getPreviousCookie(res) {
            var val = res.headers['set-cookie'];
            if (!val) return '';
            return /previous=([^;]+);/.exec(val[0])[1];
          }

          var app = express()
            .use(session({ secret: 'keyboard cat' }))
            .use(function(req, res, next){
              var cookie = new Cookie();
              res.setHeader('Set-Cookie', cookie.serialize('previous', 'cookieValue'));
              res.end();
            });

          request(app)
          .get('/')
          .end(function(err, res){
            getPreviousCookie(res).should.equal('cookieValue');
            done();
          });
        })
      })

      describe('.secure', function(){
        it('should not set-cookie when insecure', function(done){
          var app = express()
            .use(session({ secret: 'keyboard cat' }))
            .use(function(req, res, next){
              req.session.cookie.secure = true;
              res.end();
            });

          request(app)
          .get('/')
          .end(function(err, res){
            res.headers.should.not.have.property('set-cookie');
            done();
          });
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
          .end(function(err, res){
            res.status.should.equal(200);
            res.headers.should.not.have.property('set-cookie');
            done();
          });
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
          .end(function(err, res){
            res.status.should.equal(200);
            res.headers.should.not.have.property('set-cookie');
            done();
          });
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
          .end(function(err, res){
            res.headers.should.have.property('set-cookie');
            done();
          });
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
          .end(function(err, res){
            res.status.should.equal(200);
            res.headers.should.have.property('set-cookie');
            done();
          });
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
          .end(function(err, res){
            var a = new Date(expires(res))
              , b = new Date;

            val = cookie(res);

            a.getYear().should.equal(b.getYear());
            a.getMonth().should.equal(b.getMonth());
            a.getDate().should.equal(b.getDate());
            a.getSeconds().should.not.equal(b.getSeconds());
            var delta = a.valueOf() - b.valueOf();
            (delta > 1000 && delta < 2000).should.be.ok;
            res.text.should.equal('1');
            done();
          });
        });

        it('should modify cookie when changed', function(done){
          request(app)
          .get('/')
          .set('Cookie', val)
          .end(function(err, res){
            var a = new Date(expires(res))
              , b = new Date;

            val = cookie(res);

            a.getYear().should.equal(b.getYear());
            a.getMonth().should.equal(b.getMonth());
            a.getSeconds().should.not.equal(b.getSeconds());
            var delta = a.valueOf() - b.valueOf();
            (delta > 4000 && delta < 5000).should.be.ok;
            res.text.should.equal('2');
            done();
          });
        });

        it('should modify cookie when changed to large value', function(done){
          request(app)
          .get('/')
          .set('Cookie', val)
          .end(function(err, res){
            var a = new Date(expires(res))
              , b = new Date;

            val = cookie(res);

            var delta = a.valueOf() - b.valueOf();
            (delta > 2999999000 && delta < 3000000000).should.be.ok;
            res.text.should.equal('3');
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
              expires(res).should.equal('Thu, 01 Jan 1970 00:00:00 GMT');
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
              should(val).not.containEql('Expires=');
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
  var _session = createSession(opts)
  var respond = fn || end

  var server = http.createServer(function (req, res) {
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
  })

  return server
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
