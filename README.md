# express-session

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Build Status][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]
[![Gratipay][gratipay-image]][gratipay-url]

## Installation

This is a [Node.js](https://nodejs.org/en/) module available through the
[npm registry](https://www.npmjs.com/). Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```sh
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

**Note** Since version 1.5.0, the [`cookie-parser` middleware](https://www.npmjs.com/package/cookie-parser)
no longer needs to be used for this module to work. This module now directly reads
and writes cookies on `req`/`res`. Using `cookie-parser` may result in issues
if the `secret` is not the same between this module and `cookie-parser`.

**Warning** The default server-side session storage, `MemoryStore`, is _purposely_
not designed for a production environment. It will leak memory under most
conditions, does not scale past a single process, and is meant for debugging and
developing.

For a list of stores, see [compatible session stores](#compatible-session-stores).

#### Options

`express-session` accepts these properties in the options object.

##### cookie

Settings object for the session ID cookie. The default value is
`{ path: '/', httpOnly: true, secure: false, maxAge: null }`.

The following are options that can be set in this object.

##### cookie.domain

Specifies the value for the `Domain` `Set-Cookie` attribute. By default, no domain
is set, and most clients will consider the cookie to apply to only the current
domain.

##### cookie.expires

Specifies the `Date` object to be the value for the `Expires` `Set-Cookie` attribute.
By default, no expiration is set, and most clients will consider this a
"non-persistent cookie" and will delete it on a condition like exiting a web browser
application.

**Note** If both `expires` and `maxAge` are set in the options, then the last one
defined in the object is what is used.

**Note** The `expires` option should not be set directly; instead only use the `maxAge`
option.

##### cookie.httpOnly

Specifies the `boolean` value for the `HttpOnly` `Set-Cookie` attribute. When truthy,
the `HttpOnly` attribute is set, otherwise it is not. By default, the `HttpOnly`
attribute is set.

**Note** be careful when setting this to `true`, as compliant clients will not allow
client-side JavaScript to see the cookie in `document.cookie`.

##### cookie.maxAge

Specifies the `number` (in milliseconds) to use when calculating the `Expires`
`Set-Cookie` attribute. This is done by taking the current server time and adding
`maxAge` milliseconds to the value to calculate an `Expires` datetime. By default,
no maximum age is set.

**Note** If both `expires` and `maxAge` are set in the options, then the last one
defined in the object is what is used.

##### cookie.path

Specifies the value for the `Path` `Set-Cookie`. By default, this is set to `'/'`, which
is the root path of the domain.

##### cookie.sameSite

Specifies the `boolean` or `string` to be the value for the `SameSite` `Set-Cookie` attribute.

  - `true` will set the `SameSite` attribute to `Strict` for strict same site enforcement.
  - `false` will not set the `SameSite` attribute.
  - `'lax'` will set the `SameSite` attribute to `Lax` for lax same site enforcement.
  - `'strict'` will set the `SameSite` attribute to `Strict` for strict same site enforcement.

More information about the different enforcement levels can be found in the specification
https://tools.ietf.org/html/draft-west-first-party-cookies-07#section-4.1.1

**Note** This is an attribute that has not yet been fully standardized, and may change in
the future. This also means many clients may ignore this attribute until they understand it.

##### cookie.secure

Specifies the `boolean` value for the `Secure` `Set-Cookie` attribute. When truthy,
the `Secure` attribute is set, otherwise it is not. By default, the `Secure`
attribute is not set.

**Note** be careful when setting this to `true`, as compliant clients will not send
the cookie back to the server in the future if the browser does not have an HTTPS
connection.

Please note that `secure: true` is a **recommended** option. However, it requires
an https-enabled website, i.e., HTTPS is necessary for secure cookies. If `secure`
is set, and you access your site over HTTP, the cookie will not be set. If you
have your node.js behind a proxy and are using `secure: true`, you need to set
"trust proxy" in express:

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

For using secure cookies in production, but allowing for testing in development,
the following is an example of enabling this setup based on `NODE_ENV` in express:

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

The `cookie.secure` option can also be set to the special value `'auto'` to have
this setting automatically match the determined security of the connection. Be
careful when using this setting if the site is available both as HTTP and HTTPS,
as once the cookie is set on HTTPS, it will no longer be visible over HTTP. This
is useful when the Express `"trust proxy"` setting is properly setup to simplify
development vs production configuration.

##### genid

Function to call to generate a new session ID. Provide a function that returns
a string that will be used as a session ID. The function is given `req` as the
first argument if you want to use some value attached to `req` when generating
the ID.

The default value is a function which uses the `uid-safe` library to generate IDs.

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

**Note** if you have multiple apps running on the same hostname (this is just
the name, i.e. `localhost` or `127.0.0.1`; different schemes and ports do not
name a different hostname), then you need to separate the session cookies from
each other. The simplest method is to simply set different `name`s per app.

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

Force a session identifier cookie to be set on every response. The expiration
is reset to the original [`maxAge`](#cookiemaxage), resetting the expiration
countdown.

The default value is `false`.

**Note** When this option is set to `true` but the `saveUninitialized` option is
set to `false`, the cookie will not be set on a response with an uninitialized
session.

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
it to be saved. *This has been fixed in PassportJS 0.3.0*

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

### req.session

To store or access session data, simply use the request property `req.session`,
which is (generally) serialized as JSON by the store, so nested objects
are typically fine. For example below is a user-specific view counter:

```js
// Use the session middleware
app.use(session({ secret: 'keyboard cat', cookie: { maxAge: 60000 }}))

// Access the session as req.session
app.get('/', function(req, res, next) {
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

#### Session.regenerate(callback)

To regenerate the session simply invoke the method. Once complete,
a new SID and `Session` instance will be initialized at `req.session`
and the `callback` will be invoked.

```js
req.session.regenerate(function(err) {
  // will have a new session here
})
```

#### Session.destroy(callback)

Destroys the session and will unset the `req.session` property.
Once complete, the `callback` will be invoked.

```js
req.session.destroy(function(err) {
  // cannot access session here
})
```

#### Session.reload(callback)

Reloads the session data from the store and re-populates the
`req.session` object. Once complete, the `callback` will be invoked.

```js
req.session.reload(function(err) {
  // session updated
})
```

#### Session.save(callback)

Save the session back to the store, replacing the contents on the store with the
contents in memory (though a store may do something else--consult the store's
documentation for exact behavior).

This method is automatically called at the end of the HTTP response if the
session data has been altered (though this behavior can be altered with various
options in the middleware constructor). Because of this, typically this method
does not need to be called.

There are some cases where it is useful to call this method, for example,
redirects, long-lived requests or in WebSockets.

```js
req.session.save(function(err) {
  // session saved
})
```

#### Session.touch()

Updates the `.maxAge` property. Typically this is
not necessary to call, as the session middleware does this for you.

### req.session.id

Each session has a unique ID associated with it. This property is an
alias of [`req.sessionID`](#reqsessionid-1) and cannot be modified.
It has been added to make the session ID accessible from the `session`
object.

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

### req.sessionID

To get the ID of the loaded session, access the request property
`req.sessionID`. This is simply a read-only value set when a session
is loaded/created.

## Session Store Implementation

Every session store _must_ be an `EventEmitter` and implement specific
methods. The following methods are the list of **required**, **recommended**,
and **optional**.

  * Required methods are ones that this module will always call on the store.
  * Recommended methods are ones that this module will call on the store if
    available.
  * Optional methods are ones this module does not call at all, but helps
    present uniform stores to users.

For an example implementation view the [connect-redis](http://github.com/visionmedia/connect-redis) repo.

### store.all(callback)

**Optional**

This optional method is used to get all sessions in the store as an array. The
`callback` should be called as `callback(error, sessions)`.

### store.destroy(sid, callback)

**Required**

This required method is used to destroy/delete a session from the store given
a session ID (`sid`). The `callback` should be called as `callback(error)` once
the session is destroyed.

### store.clear(callback)

**Optional**

This optional method is used to delete all sessions from the store. The
`callback` should be called as `callback(error)` once the store is cleared.

### store.length(callback)

**Optional**

This optional method is used to get the count of all sessions in the store.
The `callback` should be called as `callback(error, len)`.

### store.get(sid, callback)

**Required**

This required method is used to get a session from the store given a session
ID (`sid`). The `callback` should be called as `callback(error, session)`.

The `session` argument should be a session if found, otherwise `null` or
`undefined` if the session was not found (and there was no error). A special
case is made when `error.code === 'ENOENT'` to act like `callback(null, null)`.

### store.set(sid, session, callback)

**Required**

This required method is used to upsert a session into the store given a
session ID (`sid`) and session (`session`) object. The callback should be
called as `callback(error)` once the session has been set in the store.

### store.touch(sid, session, callback)

**Recommended**

This recommended method is used to "touch" a given session given a
session ID (`sid`) and session (`session`) object. The `callback` should be
called as `callback(error)` once the session has been touched.

This is primarily used when the store will automatically delete idle sessions
and this method is used to signal to the store the given session is active,
potentially resetting the idle timer.

## Compatible Session Stores

The following modules implement a session store that is compatible with this
module. Please make a PR to add additional modules :)

[![★][aerospike-session-store-image] aerospike-session-store][aerospike-session-store-url] A session store using [Aerospike](http://www.aerospike.com/).

[aerospike-session-store-url]: https://www.npmjs.com/package/aerospike-session-store
[aerospike-session-store-image]: https://img.shields.io/github/stars/aerospike/aerospike-session-store-expressjs.svg?label=%E2%98%85

[![★][cassandra-store-image] cassandra-store][cassandra-store-url] An Apache Cassandra-based session store.

[cassandra-store-url]: https://www.npmjs.com/package/cassandra-store
[cassandra-store-image]: https://img.shields.io/github/stars/webcc/cassandra-store.svg?label=%E2%98%85

[![★][cluster-store-image] cluster-store][cluster-store-url] A wrapper for using in-process / embedded
stores - such as SQLite (via knex), leveldb, files, or memory - with node cluster (desirable for Raspberry Pi 2
and other multi-core embedded devices).

[cluster-store-url]: https://www.npmjs.com/package/cluster-store
[cluster-store-image]: https://img.shields.io/github/stars/coolaj86/cluster-store.svg?label=%E2%98%85

[![★][connect-azuretables-image] connect-azuretables][connect-azuretables-url] An [Azure Table Storage](https://azure.microsoft.com/en-gb/services/storage/tables/)-based session store.

[connect-azuretables-url]: https://www.npmjs.com/package/connect-azuretables
[connect-azuretables-image]: https://img.shields.io/github/stars/mike-goodwin/connect-azuretables.svg?label=%E2%98%85

[![★][connect-cloudant-store-image] connect-cloudant-store][connect-cloudant-store-url] An [IBM Cloudant](https://cloudant.com/)-based session store.

[connect-cloudant-store-url]: https://www.npmjs.com/package/connect-cloudant-store
[connect-cloudant-store-image]: https://img.shields.io/github/stars/adriantanasa/connect-cloudant-store.svg?label=%E2%98%85

[![★][connect-couchbase-image] connect-couchbase][connect-couchbase-url] A [couchbase](http://www.couchbase.com/)-based session store.

[connect-couchbase-url]: https://www.npmjs.com/package/connect-couchbase
[connect-couchbase-image]: https://img.shields.io/github/stars/christophermina/connect-couchbase.svg?label=%E2%98%85

[![★][connect-datacache-image] connect-datacache][connect-datacache-url] An [IBM Bluemix Data Cache](http://www.ibm.com/cloud-computing/bluemix/)-based session store.

[connect-datacache-url]: https://www.npmjs.com/package/connect-datacache
[connect-datacache-image]: https://img.shields.io/github/stars/adriantanasa/connect-datacache.svg?label=%E2%98%85

[![★][connect-db2-image] connect-db2][connect-db2-url] An IBM DB2-based session store built using [ibm_db](https://www.npmjs.com/package/ibm_db) module.

[connect-db2-url]: https://www.npmjs.com/package/connect-db2
[connect-db2-image]: https://img.shields.io/github/stars/wallali/connect-db2.svg?label=%E2%98%85

[![★][connect-dynamodb-image] connect-dynamodb][connect-dynamodb-url] A DynamoDB-based session store.

[connect-dynamodb-url]: https://github.com/ca98am79/connect-dynamodb
[connect-dynamodb-image]: https://img.shields.io/github/stars/ca98am79/connect-dynamodb.svg?label=%E2%98%85

[![★][connect-loki-image] connect-loki][connect-loki-url] A Loki.js-based session store.

[connect-loki-url]: https://www.npmjs.com/package/connect-loki
[connect-loki-image]: https://img.shields.io/github/stars/Requarks/connect-loki.svg?label=%E2%98%85

[![★][connect-ml-image] connect-ml][connect-ml-url] A MarkLogic Server-based session store.

[connect-ml-url]: https://www.npmjs.com/package/connect-ml
[connect-ml-image]: https://img.shields.io/github/stars/bluetorch/connect-ml.svg?label=%E2%98%85

[![★][connect-mssql-image] connect-mssql][connect-mssql-url] A SQL Server-based session store.

[connect-mssql-url]: https://www.npmjs.com/package/connect-mssql
[connect-mssql-image]: https://img.shields.io/github/stars/patriksimek/connect-mssql.svg?label=%E2%98%85

[![★][connect-monetdb-image] connect-monetdb][connect-monetdb-url] A MonetDB-based session store.

[connect-monetdb-url]: https://www.npmjs.com/package/connect-monetdb
[connect-monetdb-image]: https://img.shields.io/github/stars/MonetDB/npm-connect-monetdb.svg?label=%E2%98%85

[![★][connect-mongo-image] connect-mongo][connect-mongo-url] A MongoDB-based session store.

[connect-mongo-url]: https://www.npmjs.com/package/connect-mongo
[connect-mongo-image]: https://img.shields.io/github/stars/kcbanner/connect-mongo.svg?label=%E2%98%85

[![★][connect-mongodb-session-image] connect-mongodb-session][connect-mongodb-session-url] Lightweight MongoDB-based session store built and maintained by MongoDB.

[connect-mongodb-session-url]: https://www.npmjs.com/package/connect-mongodb-session
[connect-mongodb-session-image]: https://img.shields.io/github/stars/mongodb-js/connect-mongodb-session.svg?label=%E2%98%85

[![★][connect-pg-simple-image] connect-pg-simple][connect-pg-simple-url] A PostgreSQL-based session store.

[connect-pg-simple-url]: https://www.npmjs.com/package/connect-pg-simple
[connect-pg-simple-image]: https://img.shields.io/github/stars/voxpelli/node-connect-pg-simple.svg?label=%E2%98%85

[![★][connect-redis-image] connect-redis][connect-redis-url] A Redis-based session store.

[connect-redis-url]: https://www.npmjs.com/package/connect-redis
[connect-redis-image]: https://img.shields.io/github/stars/tj/connect-redis.svg?label=%E2%98%85

[![★][connect-memcached-image] connect-memcached][connect-memcached-url] A memcached-based session store.

[connect-memcached-url]: https://www.npmjs.com/package/connect-memcached
[connect-memcached-image]: https://img.shields.io/github/stars/balor/connect-memcached.svg?label=%E2%98%85

[![★][connect-memjs-image] connect-memjs][connect-memjs-url] A memcached-based session store using
[memjs](https://www.npmjs.com/package/memjs) as the memcached client.

[connect-memjs-url]: https://www.npmjs.com/package/connect-memjs
[connect-memjs-image]: https://img.shields.io/github/stars/liamdon/connect-memjs.svg?label=%E2%98%85

[![★][connect-session-knex-image] connect-session-knex][connect-session-knex-url] A session store using
[Knex.js](http://knexjs.org/), which is a SQL query builder for PostgreSQL, MySQL, MariaDB, SQLite3, and Oracle.

[connect-session-knex-url]: https://www.npmjs.com/package/connect-session-knex
[connect-session-knex-image]: https://img.shields.io/github/stars/llambda/connect-session-knex.svg?label=%E2%98%85

[![★][connect-session-sequelize-image] connect-session-sequelize][connect-session-sequelize-url] A session store using
[Sequelize.js](http://sequelizejs.com/), which is a Node.js / io.js ORM for PostgreSQL, MySQL, SQLite and MSSQL.

[connect-session-sequelize-url]: https://www.npmjs.com/package/connect-session-sequelize
[connect-session-sequelize-image]: https://img.shields.io/github/stars/mweibel/connect-session-sequelize.svg?label=%E2%98%85

[![★][dynamodb-store-image] dynamodb-store][dynamodb-store-url] A DynamoDB-based session store.

[dynamodb-store-url]: https://www.npmjs.com/package/dynamodb-store
[dynamodb-store-image]: https://img.shields.io/github/stars/rafaelrpinto/dynamodb-store.svg?label=%E2%98%85

[![★][express-mysql-session-image] express-mysql-session][express-mysql-session-url] A session store using native
[MySQL](https://www.mysql.com/) via the [node-mysql](https://github.com/felixge/node-mysql) module.

[express-mysql-session-url]: https://www.npmjs.com/package/express-mysql-session
[express-mysql-session-image]: https://img.shields.io/github/stars/chill117/express-mysql-session.svg?label=%E2%98%85

[![★][express-oracle-session-image] express-oracle-session][express-oracle-session-url] A session store using native
[oracle](https://www.oracle.com/) via the [node-oracledb](https://www.npmjs.com/package/oracledb) module.

[express-oracle-session-url]: https://www.npmjs.com/package/express-oracle-session
[express-oracle-session-image]: https://img.shields.io/github/stars/slumber86/express-oracle-session.svg?label=%E2%98%85

[![★][express-sessions-image] express-sessions][express-sessions-url]: A session store supporting both MongoDB and Redis.

[express-sessions-url]: https://www.npmjs.com/package/express-sessions
[express-sessions-image]: https://img.shields.io/github/stars/konteck/express-sessions.svg?label=%E2%98%85

[![★][connect-sqlite3-image] connect-sqlite3][connect-sqlite3-url] A [SQLite3](https://github.com/mapbox/node-sqlite3) session store modeled after the TJ's `connect-redis` store.

[connect-sqlite3-url]: https://www.npmjs.com/package/connect-sqlite3
[connect-sqlite3-image]: https://img.shields.io/github/stars/rawberg/connect-sqlite3.svg?label=%E2%98%85

[![★][documentdb-session-image] documentdb-session][documentdb-session-url] A session store for Microsoft Azure's [DocumentDB](https://azure.microsoft.com/en-us/services/documentdb/) NoSQL database service.

[documentdb-session-url]: https://www.npmjs.com/package/documentdb-session
[documentdb-session-image]: https://img.shields.io/github/stars/dwhieb/documentdb-session.svg?label=%E2%98%85

[![★][express-nedb-session-image] express-nedb-session][express-nedb-session-url] A NeDB-based session store.

[express-nedb-session-url]: https://www.npmjs.com/package/express-nedb-session
[express-nedb-session-image]: https://img.shields.io/github/stars/louischatriot/express-nedb-session.svg?label=%E2%98%85

[![★][express-session-cache-manager-image] express-session-cache-manager][express-session-cache-manager-url] 
A store that implements [cache-manager](https://www.npmjs.com/package/cache-manager), which supports
a [variety of storage types](https://www.npmjs.com/package/cache-manager#store-engines).

[express-session-cache-manager-url]: https://www.npmjs.com/package/express-session-cache-manager
[express-session-cache-manager-image]: https://img.shields.io/github/stars/theogravity/express-session-cache-manager.svg?label=%E2%98%85

[![★][express-session-level-image] express-session-level][express-session-level-url] A [LevelDB](https://github.com/Level/levelup) based session store.

[express-session-level-url]: https://www.npmjs.com/package/express-session-level
[express-session-level-image]: https://img.shields.io/github/stars/tgohn/express-session-level.svg?label=%E2%98%85

[![★][express-etcd-image] express-etcd][express-etcd-url] An [etcd](https://github.com/stianeikeland/node-etcd) based session store.

[express-etcd-url]: https://www.npmjs.com/package/express-etcd
[express-etcd-image]: https://img.shields.io/github/stars/gildean/express-etcd.svg?label=%E2%98%85

[![★][fortune-session-image] fortune-session][fortune-session-url] A [Fortune.js](https://github.com/fortunejs/fortune)
based session store. Supports all backends supported by Fortune (MongoDB, Redis, Postgres, NeDB).

[fortune-session-url]: https://www.npmjs.com/package/fortune-session
[fortune-session-image]: https://img.shields.io/github/stars/aliceklipper/fortune-session.svg?label=%E2%98%85

[![★][hazelcast-store-image] hazelcast-store][hazelcast-store-url] A Hazelcast-based session store built on the [Hazelcast Node Client](https://www.npmjs.com/package/hazelcast-client).

[hazelcast-store-url]: https://www.npmjs.com/package/hazelcast-store
[hazelcast-store-image]: https://img.shields.io/github/stars/jackspaniel/hazelcast-store.svg?label=%E2%98%85

[![★][level-session-store-image] level-session-store][level-session-store-url] A LevelDB-based session store.

[level-session-store-url]: https://www.npmjs.com/package/level-session-store
[level-session-store-image]: https://img.shields.io/github/stars/scriptollc/level-session-store.svg?label=%E2%98%85

[![★][medea-session-store-image] medea-session-store][medea-session-store-url] A Medea-based session store.

[medea-session-store-url]: https://www.npmjs.com/package/medea-session-store
[medea-session-store-image]: https://img.shields.io/github/stars/BenjaminVadant/medea-session-store.svg?label=%E2%98%85

[![★][mssql-session-store-image] mssql-session-store][mssql-session-store-url] A SQL Server-based session store.

[mssql-session-store-url]: https://www.npmjs.com/package/mssql-session-store
[mssql-session-store-image]: https://img.shields.io/github/stars/jwathen/mssql-session-store.svg?label=%E2%98%85

[![★][nedb-session-store-image] nedb-session-store][nedb-session-store-url] An alternate NeDB-based (either in-memory or file-persisted) session store.

[nedb-session-store-url]: https://www.npmjs.com/package/nedb-session-store
[nedb-session-store-image]: https://img.shields.io/github/stars/JamesMGreene/nedb-session-store.svg?label=%E2%98%85

[![★][sequelstore-connect-image] sequelstore-connect][sequelstore-connect-url] A session store using [Sequelize.js](http://sequelizejs.com/).

[sequelstore-connect-url]: https://www.npmjs.com/package/sequelstore-connect
[sequelstore-connect-image]: https://img.shields.io/github/stars/MattMcFarland/sequelstore-connect.svg?label=%E2%98%85

[![★][session-file-store-image] session-file-store][session-file-store-url] A file system-based session store.

[session-file-store-url]: https://www.npmjs.com/package/session-file-store
[session-file-store-image]: https://img.shields.io/github/stars/valery-barysok/session-file-store.svg?label=%E2%98%85

[![★][session-rethinkdb-image] session-rethinkdb][session-rethinkdb-url] A [RethinkDB](http://rethinkdb.com/)-based session store.

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
