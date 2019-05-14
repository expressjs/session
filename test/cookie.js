
var assert = require('assert')
var Cookie = require('../session/cookie')

describe('new Cookie()', function () {
  it('should create a new cookie object', function () {
    assert.strictEqual(typeof new Cookie(), 'object')
  })

  it('should default expires to null', function () {
    var cookie = new Cookie()
    assert.strictEqual(cookie.expires, null)
  })

  it('should default maxAge to null', function () {
    var cookie = new Cookie()
    assert.strictEqual(cookie.maxAge, null)
  })

  it('should default httpOnly to true', function () {
    var cookie = new Cookie()
    assert.strictEqual(cookie.httpOnly, true)
  })

  it('should default path to "/"', function () {
    var cookie = new Cookie()
    assert.strictEqual(cookie.path, '/')
  })

  it('should default maxAge to null', function () {
    var cookie = new Cookie()
    assert.strictEqual(cookie.maxAge, null)
  })

  describe('with options', function () {
    it('should create a new cookie object', function () {
      assert.strictEqual(typeof new Cookie({}), 'object')
    })

    it('should reject non-objects', function () {
      assert.throws(function () { new Cookie(42) }, /argument options/)
      assert.throws(function () { new Cookie('foo') }, /argument options/)
      assert.throws(function () { new Cookie(true) }, /argument options/)
      assert.throws(function () { new Cookie(function () {}) }, /argument options/)
    })

    it('should ignore "data" option', function () {
      var cookie = new Cookie({ data: { foo: 'bar' }, path: '/foo' })

      assert.strictEqual(typeof cookie, 'object')
      assert.strictEqual(typeof cookie.data, 'object')
      assert.strictEqual(cookie.data.path, '/foo')
      assert.notStrictEqual(cookie.data.foo, 'bar')
    })

    describe('expires', function () {
      it('should set expires', function () {
        var expires = new Date(Date.now() + 60000)
        var cookie = new Cookie({ expires: expires })

        assert.strictEqual(cookie.expires, expires)
      })

      it('should set maxAge', function () {
        var expires = new Date(Date.now() + 60000)
        var cookie = new Cookie({ expires: expires })

        assert.ok(expires.getTime() - Date.now() - 1000 <= cookie.maxAge)
        assert.ok(expires.getTime() - Date.now() + 1000 >= cookie.maxAge)
      })
    })

    describe('httpOnly', function () {
      it('should set httpOnly', function () {
        var cookie = new Cookie({ httpOnly: false })

        assert.strictEqual(cookie.httpOnly, false)
      })
    })

    describe('maxAge', function () {
      it('should set expires', function () {
        var maxAge = 60000
        var cookie = new Cookie({ maxAge: maxAge })

        assert.ok(cookie.expires.getTime() - Date.now() - 1000 <= maxAge)
        assert.ok(cookie.expires.getTime() - Date.now() + 1000 >= maxAge)
      })

      it('should set maxAge', function () {
        var maxAge = 60000
        var cookie = new Cookie({ maxAge: maxAge })

        assert.strictEqual(cookie.maxAge, maxAge)
      })

      it('should accept Date object', function () {
        var maxAge = new Date(Date.now() + 60000)
        var cookie = new Cookie({ maxAge: maxAge })

        assert.strictEqual(cookie.expires.getTime(), maxAge.getTime())
        assert.ok(maxAge.getTime() - Date.now() - 1000 <= cookie.maxAge)
        assert.ok(maxAge.getTime() - Date.now() + 1000 >= cookie.maxAge)
      })

      it('should reject invalid types', function() {
        assert.throws(function() { new Cookie({ maxAge: '42' }) }, /maxAge/)
        assert.throws(function() { new Cookie({ maxAge: true }) }, /maxAge/)
        assert.throws(function() { new Cookie({ maxAge: function () {} }) }, /maxAge/)
      })
    })

    describe('path', function () {
      it('should set path', function () {
        var cookie = new Cookie({ path: '/foo' })

        assert.strictEqual(cookie.path, '/foo')
      })
    })
  })
})
