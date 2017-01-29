'use strict';
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
var util = require('util')
var cookie = require('cookie')
var signature = require('cookie-signature')

var min = 60 * 1000;

describe('session getcookie()', function(){

  var sessionKey = 'foo';
  var sessionSecret = 'bar';

  var app = express()
    .use(session({ 
      name: sessionKey, 
      secret: sessionSecret,
      getcookie: function(req) {
        var cookies = cookie.parse(req.headers.authorization || '');
        return signature.unsign(cookies[sessionKey] || '', sessionSecret);
      },
      setcookie: function(res, name, val, secret, options) {
        var signed = signature.sign(val, secret);
        var data = cookie.serialize(name, signed, options);
        // res.setHeader('Access-Control-Expose-Headers', 'Authorization'); necessary with cors
        res.setHeader('authorization', data);
      }
    }))
    .post('/', function(req, res) {
      req.session.user = 'John';
      return res.json({ok: 1})
    })
    .get('/', function(req, res) {
      res.json({user: req.session.user});
    });


  var data;

  it('should set a session, and send it in authorization header', function(done){

    request(app)
    .post('/')
    .expect(function (res) {
      data = res.headers.authorization;
    })
    .expect(200, done)
  })

  it('should get the session using authorization header', function(done){

    request(app)
    .get('/')
    .set('Authorization', data)
    .expect(function (res) {
      assert.equal(res.body.user, 'John')
    })
    .expect(200, done)

  })

})

