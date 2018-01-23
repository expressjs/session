
var assert = require('assert')
var Cookie = require('../session/cookie')

describe('new Cookie()', function () {
  it('should create a new cookie object', function () {
    assert.equal(typeof new Cookie(), 'object')
  })

  it('should default expires to null', function () {
    var cookie = new Cookie()
    assert.strictEqual(cookie.expires, null)
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
      assert.equal(typeof new Cookie({}), 'object')
    })

    it('should reject non-objects', function () {
      assert.throws(function () { new Cookie(42) }, /argument options/)
      assert.throws(function () { new Cookie('foo') }, /argument options/)
      assert.throws(function () { new Cookie(true) }, /argument options/)
      assert.throws(function () { new Cookie(function () {}) }, /argument options/)
    })

    it('should set expires', function () {
      var expires = new Date()
      var cookie = new Cookie({ expires: expires })

      assert.strictEqual(cookie.expires, expires)
      assert.notStrictEqual(cookie.maxAge, null)
    })

    it('should set httpOnly', function () {
      var cookie = new Cookie({ httpOnly: false })

      assert.strictEqual(cookie.httpOnly, false)
    })

    it('should set path', function () {
      var cookie = new Cookie({ path: '/foo' })

      assert.strictEqual(cookie.path, '/foo')
    })
  })
})
