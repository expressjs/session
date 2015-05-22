# express-session

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Build Status][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]
[![Gratipay][gratipay-image]][gratipay-url]

## Installation

```bash
$ npm install express-session
```

## API

```js
var session = require('express-session')
```

### session(options)

Create a session middleware with the given `options`.

**Note** Session data is _not_ saved in the cookie itself, just the session ID.
Session data is stored server-side.

**Warning** The default server-side session storage, `MemoryStore`, is _purposely_
not designed for a production environment. It will leak memory under most
conditions, does not scale past a single process, and is meant for debugging and
developing.

For a list of stores, see [compatible session stores](#compatible-session-stores).

#### Options

`express-session` accepts these properties in the options object.

##### cookie

Settings for the session ID cookie. See the "Cookie options" section below for
more information on the different values.

The default value is `{ path: '/', httpOnly: true, secure: false, maxAge: null }`.

##### genid

Function to call to generate a new session ID. Provide a function that returns
a string that will be used as a session ID. The function is given `req` as the
first argument if you want to use some value attached to `req` when generating
the ID.

The default value is a function which uses the `uid2` library to generate IDs.

**NOTE** be careful to generate unique IDs so your sessions do not conflict.

```js
app.use(session({
  genid: function(req) {
    return genuuid() // use UUIDs for session IDs
  },
  secret: 'keyboard cat'
}))
```

##### name

The name of the session ID cookie to set in the response (and read from in the
request).

The default value is `'connect.sid'`.

**Note** if you have multiple apps running on the same host (hostname + port),
then you need to separate the session cookies from each other. The simplest
method is to simply set different `name`s per app.

##### proxy

Trust the reverse proxy when setting secure cookies (via the "X-Forwarded-Proto"
header).

The default value is `undefined`.

  - `true` The "X-Forwarded-Proto" header will be used.
  - `false` All headers are ignored and the connection is considered secure only
    if there is a direct TLS/SSL connection.
  - `undefined` Uses the "trust proxy" setting from express

##### resave

Forces the session to be saved back to the session store, even if the session
was never modified during the request. Depending on your store this may be
necessary, but it can also create race conditions where a client makes two
parallel requests to your server and changes made to the session in one
request may get overwritten when the other request ends, even if it made no
changes (this behavior also depends on what store you're using).

The default value is `true`, but using the default has been deprecated,
as the default will change in the future. Please research into this setting
and choose what is appropriate to your use-case. Typically, you'll want
`false`.

How do I know if this is necessary for my store? The best way to know is to
check with your store if it implements the `touch` method. If it does, then
you can safely set `resave: false`. If it does not implement the `touch`
method and your store sets an expiration date on stored sessions, then you
likely need `resave: true`.

##### rolling

Force a cookie to be set on every response. This resets the expiration date.

The default value is `false`.

##### saveUninitialized

Forces a session that is "uninitialized" to be saved to the store. A session is
uninitialized when it is new but not modified. Choosing `false` is useful for
implementing login sessions, reducing server storage usage, or complying with
laws that require permission before setting a cookie. Choosing `false` will also
help with race conditions where a client makes multiple parallel requests
without a session.

The default value is `true`, but using the default has been deprecated, as the
default will change in the future. Please research into this setting and
choose what is appropriate to your use-case.

**Note** if you are using Session in conjunction with PassportJS, Passport
will add an empty Passport object to the session for use after a user is
authenticated, which will be treated as a modification to the session, causing
it to be saved.

##### secret

**Required option**

This is the secret used to sign the session ID cookie. This can be either a string
for a single secret, or an array of multiple secrets. If an array of secrets is
provided, only the first element will be used to sign the session ID cookie, while
all the elements will be considered when verifying the signature in requests.

##### store

The session store instance, defaults to a new `MemoryStore` instance.

##### unset

Control the result of unsetting `req.session` (through `delete`, setting to `null`,
etc.).

The default value is `'keep'`.

  - `'destroy'` The session will be destroyed (deleted) when the response ends.
  - `'keep'` The session in the store will be kept, but modifications made during
    the request are ignored and not saved.

#### Cookie options

**Note** Since version 1.5.0, the [`cookie-parser` middleware](https://www.npmjs.com/package/cookie-parser)
no longer needs to be used for this module to work. This module now directly reads
and writes cookies on `req`/`res`. Using `cookie-parser` may result in issues
if the `secret` is not the same between this module and `cookie-parser`.

Please note that `secure: true` is a **recommended** option. However, it requires an https-enabled website, i.e., HTTPS is necessary for secure cookies.
If `secure` is set, and you access your site over HTTP, the cookie will not be set. If you have your node.js behind a proxy and are using `secure: true`, you need to set "trust proxy" in express:

```js
var app = express()
app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}))
```

For using secure cookies in production, but allowing for testing in development, the following is an example of enabling this setup based on `NODE_ENV` in express:

```js
var app = express()
var sess = {
  secret: 'keyboard cat',
  cookie: {}
}

if (app.get('env') === 'production') {
  app.set('trust proxy', 1) // trust first proxy
  sess.cookie.secure = true // serve secure cookies
}

app.use(session(sess))
```

By default `cookie.maxAge` is `null`, meaning no "expires" parameter is set
so the cookie becomes a browser-session cookie. When the user closes the
browser the cookie (and session) will be removed.

### req.session

To store or access session data, simply use the request property `req.session`,
which is (generally) serialized as JSON by the store, so nested objects
are typically fine. For example below is a user-specific view counter:

```js
app.use(session({ secret: 'keyboard cat', cookie: { maxAge: 60000 }}))

app.use(function(req, res, next) {
  var sess = req.session
  if (sess.views) {
    sess.views++
    res.setHeader('Content-Type', 'text/html')
    res.write('<p>views: ' + sess.views + '</p>')
    res.write('<p>expires in: ' + (sess.cookie.maxAge / 1000) + 's</p>')
    res.end()
  } else {
    sess.views = 1
    res.end('welcome to the session demo. refresh!')
  }
})
```

#### Session.regenerate()

To regenerate the session simply invoke the method, once complete
a new SID and `Session` instance will be initialized at `req.session`.

```js
req.session.regenerate(function(err) {
  // will have a new session here
})
```

#### Session.destroy()

Destroys the session, removing `req.session`, will be re-generated next request.

```js
req.session.destroy(function(err) {
  // cannot access session here
})
```

#### Session.reload()

Reloads the session data.

```js
req.session.reload(function(err) {
  // session updated
})
```

#### Session.save()

```js
req.session.save(function(err) {
  // session saved
})
```

#### Session.touch()

Updates the `.maxAge` property. Typically this is
not necessary to call, as the session middleware does this for you.

### req.session.cookie

Each session has a unique cookie object accompany it. This allows
you to alter the session cookie per visitor. For example we can
set `req.session.cookie.expires` to `false` to enable the cookie
to remain for only the duration of the user-agent.

#### Cookie.maxAge

Alternatively `req.session.cookie.maxAge` will return the time
remaining in milliseconds, which we may also re-assign a new value
to adjust the `.expires` property appropriately. The following
are essentially equivalent

```js
var hour = 3600000
req.session.cookie.expires = new Date(Date.now() + hour)
req.session.cookie.maxAge = hour
```

For example when `maxAge` is set to `60000` (one minute), and 30 seconds
has elapsed it will return `30000` until the current request has completed,
at which time `req.session.touch()` is called to reset `req.session.maxAge`
to its original value.

```js
req.session.cookie.maxAge // => 30000
```

## Session Store Implementation

Every session store _must_ be an `EventEmitter` and implement the following
methods:

   - `.get(sid, callback)`
   - `.set(sid, session, callback)`
   - `.destroy(sid, callback)`

Recommended methods include, but are not limited to:

   - `.touch(sid, session, callback)`
   - `.length(callback)`
   - `.clear(callback)`

For an example implementation view the [connect-redis](http://github.com/visionmedia/connect-redis) repo.

## Compatible Session Stores

The following modules implement a session store that is compatible with this
module. Please make a PR to add additional modules :)

[![Github Stars][cassandra-store-image] cassandra-store][cassandra-store-url] An Apache Cassandra-based session store.
[cassandra-store-url]: https://www.npmjs.com/package/cassandra-store
[cassandra-store-image]: https://img.shields.io/github/stars/webcc/cassandra-store.svg?label=%E2%98%85

[![Github Stars][connect-mssql-image] connect-mssql][connect-mssql-url] A SQL Server-based session store.
[connect-mssql-url]: https://www.npmjs.com/package/connect-mssql
[connect-mssql-image]: https://img.shields.io/github/stars/patriksimek/connect-mssql.svg?label=%E2%98%85

[![Github Stars][connect-mongo-image] connect-mongo][connect-mongo-url] A MongoDB-based session store.
[connect-mongo-url]: https://www.npmjs.com/package/connect-mongo
[connect-mongo-image]: https://img.shields.io/github/stars/kcbanner/connect-mongo.svg?label=%E2%98%85

[![Github Stars][connect-mongodb-session-image] connect-mongodb-session][connect-mongodb-session-url] Lightweight MongoDB-based session store built and maintained by MongoDB.
[connect-mongodb-session-url]: https://www.npmjs.com/package/connect-mongodb-session
[connect-mongodb-session-image]: https://img.shields.io/github/stars/mongodb-js/connect-mongodb-session.svg?label=%E2%98%85

[![Github Stars][connect-redis-image] connect-redis][connect-redis-url] A Redis-based session store.
[connect-redis-url]: https://www.npmjs.com/package/connect-redis
[connect-redis-image]: https://img.shields.io/github/stars/tj/connect-redis.svg?label=%E2%98%85

[![Github Stars][connect-session-knex-image] connect-session-knex][connect-session-knex-url] A session store using
[Knex.js](http://knexjs.org/), which is a SQL query builder for PostgreSQL, MySQL, MariaDB, SQLite3, and Oracle.
[connect-session-knex-url]: https://www.npmjs.com/package/connect-session-knex
[connect-session-knex-image]: https://img.shields.io/github/stars/llambda/connect-session-knex.svg?label=%E2%98%85

[![Github Stars][level-session-store-image] level-session-store][level-session-store-url] A LevelDB-based session store.
[level-session-store-url]: https://www.npmjs.com/package/level-session-store
[level-session-store-image]: https://img.shields.io/github/stars/scriptollc/level-session-store.svg?label=%E2%98%85

[![Github Stars][mssql-session-store-image] mssql-session-store][mssql-session-store-url] A SQL Server-based session store.
[mssql-session-store-url]: https://www.npmjs.com/package/mssql-session-store
[mssql-session-store-image]: https://img.shields.io/github/stars/jwathen/mssql-session-store.svg?label=%E2%98%85

[![Github Stars][session-file-store-image] session-file-store][session-file-store-url] A file system-based session store.
[session-file-store-url]: https://www.npmjs.com/package/session-file-store
[session-file-store-image]: https://img.shields.io/github/stars/valery-barysok/session-file-store.svg?label=%E2%98%85

[![Github Stars][session-rethinkdb-image] session-rethinkdb][session-rethinkdb-url] A [RethinkDB](http://rethinkdb.com/)-based session store.
[session-rethinkdb-url]: https://www.npmjs.com/package/session-rethinkdb
[session-rethinkdb-image]: https://img.shields.io/github/stars/llambda/session-rethinkdb.svg?label=%E2%98%85

## Example

A simple example using `express-session` to store page views for a user.

```js
var express = require('express')
var parseurl = require('parseurl')
var session = require('express-session')

var app = express()

app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true
}))

app.use(function (req, res, next) {
  var views = req.session.views

  if (!views) {
    views = req.session.views = {}
  }

  // get the url pathname
  var pathname = parseurl(req).pathname

  // count the views
  views[pathname] = (views[pathname] || 0) + 1

  next()
})

app.get('/foo', function (req, res, next) {
  res.send('you viewed this page ' + req.session.views['/foo'] + ' times')
})

app.get('/bar', function (req, res, next) {
  res.send('you viewed this page ' + req.session.views['/bar'] + ' times')
})
```

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/express-session.svg
[npm-url]: https://npmjs.org/package/express-session
[travis-image]: https://img.shields.io/travis/expressjs/session/master.svg
[travis-url]: https://travis-ci.org/expressjs/session
[coveralls-image]: https://img.shields.io/coveralls/expressjs/session/master.svg
[coveralls-url]: https://coveralls.io/r/expressjs/session?branch=master
[downloads-image]: https://img.shields.io/npm/dm/express-session.svg
[downloads-url]: https://npmjs.org/package/express-session
[gratipay-image]: https://img.shields.io/gratipay/dougwilson.svg
[gratipay-url]: https://gratipay.com/dougwilson/
