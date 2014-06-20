
process.env.NO_DEPRECATION = 'express-session';

var express = require('express')
  , assert = require('assert')
  , request = require('supertest')
  , should = require('should')
  , cookieParser = require('cookie-parser')
  , session = require('../')
  , Cookie = require('../session/cookie')

var min = 60 * 1000;

function respond(req, res) {
  res.end();
}

var app = express()
  .use(session({ secret: 'keyboard cat', cookie: { maxAge: min }}))
  .use(respond);

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
      .use(respond);

      request(app)
      .get('/')
      .expect(200, function(err, res){
        if (err) return done(err);
        should(cookie(res)).be.empty;
        done();
      });
  })

  it('should error without secret', function(done){
    var app = express()
      .use(session({ cookie: { maxAge: min }}))
      .use(respond);
    app.set('env', 'test');

      request(app)
      .get('/')
      .expect(500, /secret.*required/, done);
  })

  it('should get secret from req.secret', function(done){
    var app = express()
      .use(function(req, res, next){ req.secret = 'keyboard cat'; next(); })
      .use(session({ cookie: { maxAge: min }}))
      .use(respond);
    app.set('env', 'test');

      request(app)
      .get('/')
      .expect(200, '', done);
  })

  describe('proxy option', function(){
    describe('when enabled', function(){
      it('should trust X-Forwarded-Proto when string', function(done){
        var app = express()
          .use(session({ secret: 'keyboard cat', proxy: true, cookie: { secure: true, maxAge: 5 }}))
          .use(respond);

        request(app)
        .get('/')
        .set('X-Forwarded-Proto', 'https')
        .expect(200, function(err, res){
          if (err) return done(err);
          should(cookie(res)).not.be.empty;
          done();
        });
      })

      it('should trust X-Forwarded-Proto when comma-separated list', function(done){
        var app = express()
          .use(session({ secret: 'keyboard cat', proxy: true, cookie: { secure: true, maxAge: 5 }}))
          .use(respond);

        request(app)
        .get('/')
        .set('X-Forwarded-Proto', 'https,http')
        .expect(200, function(err, res){
          if (err) return done(err);
          should(cookie(res)).not.be.empty;
          done();
        });
      })

      it('should work when no header', function(done){
        var app = express()
          .use(session({ secret: 'keyboard cat', proxy: true, cookie: { secure: true, maxAge: 5 }}))
          .use(respond);

        request(app)
        .get('/')
        .expect(200, function(err, res){
          if (err) return done(err);
          should(cookie(res)).be.empty;
          done();
        });
      })
    })

    describe('when disabled', function(){
      it('should not trust X-Forwarded-Proto', function(done){
        var app = express()
          .use(session({ secret: 'keyboard cat', proxy: false, cookie: { secure: true, maxAge: min }}))
          .use(respond);

        request(app)
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
      it('should not trust X-Forwarded-Proto', function(done){
        var app = express()
          .use(session({ secret: 'keyboard cat', cookie: { secure: true, maxAge: min }}))
          .use(respond);

        request(app)
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
      request(app)
      .get('/')
      .expect('set-cookie', /connect\.sid=s%3A([^\.]+)\./i)
      .expect(200, done);
    });

    it('should allow custom function', function(done){
      var app = express()
        .use(session({ genid: function(){ return 'a' }, secret: 'keyboard cat', cookie: { maxAge: min }}))
        .use(respond);

      request(app)
      .get('/')
      .expect('set-cookie', /connect\.sid=s%3Aa\./i)
      .expect(200, done);
    });

    it('should encode unsafe chars', function(done){
      var app = express()
        .use(session({ genid: function(){ return '%' }, secret: 'keyboard cat', cookie: { maxAge: min }}))
        .use(respond);

      request(app)
      .get('/')
      .expect('set-cookie', /connect\.sid=s%3A%25\./i)
      .expect(200, done);
    });

    it('should provide req argument', function(done){
      var app = express()
        .use(session({ genid: function(req){ return req.url }, secret: 'keyboard cat', cookie: { maxAge: min }}))
        .use(respond);

      request(app)
      .get('/foo')
      .expect('set-cookie', /connect\.sid=s%3A%2Ffoo\./i)
      .expect(200, done);
    });
  });

  describe('key option', function(){
    it('should default to "connect.sid"', function(done){
      request(app)
      .get('/')
      .end(function(err, res){
        res.headers['set-cookie'].should.have.length(1);
        res.headers['set-cookie'][0].should.match(/^connect\.sid/);
        done();
      });
    })

    it('should allow overriding', function(done){
      var app = express()
        .use(session({ secret: 'keyboard cat', key: 'sid', cookie: { maxAge: min }}))
        .use(respond);

      request(app)
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
        .set('Cookie', 'connect.sid=' + sid(res))
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
        .set('Cookie', 'connect.sid=' + sid(res))
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
        .set('Cookie', 'connect.sid=' + sid(res))
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
        .set('Cookie', 'connect.sid=' + sid(res))
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
        .set('Cookie', 'connect.sid=' + sid(res))
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
        .set('Cookie', 'connect.sid=' + sid(res))
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
          .set('Cookie', 'connect.sid=' + sid(res))
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
          .set('Cookie', 'connect.sid=' + sid(res))
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
  });

  it('should retain the sid', function(done){
    var n = 0;

    var app = express()
      .use(session({ secret: 'keyboard cat', cookie: { maxAge: min }}))
      .use(function(req, res){
        req.session.count = ++n;
        res.end();
      })

    request(app)
    .get('/')
    .end(function(err, res){

      var id = sid(res);
      request(app)
      .get('/')
      .set('Cookie', 'connect.sid=' + id)
      .end(function(err, res){
        sid(res).should.equal(id);
        done();
      });
    });
  })

  describe('when an invalid sid is given', function(){
    it('should generate a new one', function(done){
      request(app)
      .get('/')
      .set('Cookie', 'connect.sid=foobarbaz')
      .end(function(err, res){
        sid(res).should.not.equal('foobarbaz');
        done();
      });
    })
  })

  it('should issue separate sids', function(done){
    var n = 0;

    var app = express()
      .use(session({ secret: 'keyboard cat', cookie: { maxAge: min }}))
      .use(function(req, res){
        req.session.count = ++n;
        res.end();
      })

    request(app)
    .get('/')
    .end(function(err, res){

      var id = sid(res);
      request(app)
      .get('/')
      .set('Cookie', 'connect.sid=' + id)
      .end(function(err, res){
        sid(res).should.equal(id);

        request(app)
        .get('/')
        .end(function(err, res){
          sid(res).should.not.equal(id);
          done();
        });
      });
    });
  })

  describe('req.session', function(){
    it('should persist', function(done){
      var app = express()
        .use(session({ secret: 'keyboard cat', cookie: { maxAge: min, httpOnly: false }}))
        .use(function(req, res, next){
          // checks that cookie options persisted
          req.session.cookie.httpOnly.should.equal(false);

          req.session.count = req.session.count || 0;
          req.session.count++;
          res.end(req.session.count.toString());
        });

      request(app)
      .get('/')
      .end(function(err, res){
        res.text.should.equal('1');

        request(app)
        .get('/')
        .set('Cookie', 'connect.sid=' + sid(res))
        .end(function(err, res){
          res.text.should.equal('2');
          done();
        });
      });
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
        .set('Cookie', 'connect.sid=' + sid(res))
        .end(function(err, res){
          var id = sid(res);
          res.text.should.equal('2');
          modify = false;

          request(app)
          .get('/')
          .set('Cookie', 'connect.sid=' + sid(res))
          .end(function(err, res){
            should(sid(res)).be.empty;
            res.text.should.equal('2');
            modify = true;

            request(app)
            .get('/')
            .set('Cookie', 'connect.sid=' + id)
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
          var id = sid(res);

          request(app)
          .get('/')
          .set('Cookie', 'connect.sid=' + id)
          .end(function(err, res){
            sid(res).should.not.equal('');
            sid(res).should.not.equal(id);
            done();
          });
        });
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
            .set('Cookie', 'connect.sid=' + sid(res))
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
        var id;
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

            id = sid(res);

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
          .set('Cookie', 'connect.sid=' + id)
          .end(function(err, res){
            var a = new Date(expires(res))
              , b = new Date;

            id = sid(res);

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
          .set('Cookie', 'connect.sid=' + id)
          .end(function(err, res){
            var a = new Date(expires(res))
              , b = new Date;

            id = sid(res);

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

    it('should support cookieParser()', function(done){
      var app = express()
        .use(cookieParser('keyboard cat'))
        .use(function(req, res, next){ delete req.headers.cookie; next(); })
        .use(session())
        .use(function(req, res, next){
          req.session.count = req.session.count || 0;
          req.session.count++;
          res.end(req.session.count.toString());
        });

      request(app)
      .get('/')
      .end(function(err, res){
        res.text.should.equal('1');

        request(app)
        .get('/')
        .set('Cookie', 'connect.sid=' + sid(res))
        .end(function(err, res){
          res.text.should.equal('2');
          done();
        });
      });
    })
  })
})

function cookie(res) {
  var setCookie = res.headers['set-cookie'];
  return (setCookie && setCookie[0]) || undefined;
}

function expires(res) {
  var match = /Expires=([^;]+)/.exec(cookie(res));
  return match ? match[1] : undefined;
}

function sid(res) {
  var match = /^connect\.sid=([^;]+);/.exec(cookie(res));
  return match ? match[1] : undefined;
}
