# memorystore [![NPM Version](https://img.shields.io/npm/v/memorystore.svg)](https://www.npmjs.com/package/memorystore) ![node](https://img.shields.io/node/v/memorystore.svg) [![Build Status](https://travis-ci.org/roccomuso/memorystore.svg?branch=master)](https://travis-ci.org/roccomuso/memorystore) [![Dependency Status](https://david-dm.org/roccomuso/memorystore.png)](https://david-dm.org/roccomuso/memorystore) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

> express-session full featured `MemoryStore` module without leaks!

A session store implementation for Express using [lru-cache](https://github.com/isaacs/node-lru-cache).

Because the default `MemoryStore` for [express-session](https://github.com/expressjs/session) will lead to a memory leak due to it haven't a suitable way to make them expire.

The sessions are still stored in memory, so they're not shared with other processes or services.

## Setup

    $ npm install express-session memorystore

Pass the `express-session` store into `memorystore` to create a `MemoryStore` constructor.

```javascript
var session = require('express-session')
var MemoryStore = require('memorystore')(session)

app.use(session({
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    secret: 'keyboard cat'
}))
```

## Options

* `checkPeriod` Define how long MemoryStore will check for expired. The period is in ms. The automatic check is disabled by default! Not setting this is kind of silly, since that's the whole purpose of this lib.
* `max` The maximum size of the cache, checked by applying the length
  function to all values in the cache.  It defaults to `Infinity`.
* `ttl` Session TTL (expiration) in milliseconds. Defaults to session.maxAge (if set), or one day. This may also be set to a function of the form `(options, sess, sessionID) => number`.
* `dispose` Function that is called on sessions when they are dropped
  from the cache.  This can be handy if you want to close file
  descriptors or do other cleanup tasks when sessions are no longer
  accessible.  Called with `key, value`.  It's called *before*
  actually removing the item from the internal cache, so if you want
  to immediately put it back in, you'll have to do that in a
  `nextTick` or `setTimeout` callback or it won't do anything.
* `stale` By default, if you set a `maxAge`, it'll only actually pull
  stale items out of the cache when you `get(key)`.  (That is, it's
  not pre-emptively doing a `setTimeout` or anything.)  If you set
  `stale:true`, it'll return the stale value before deleting it.  If
  you don't set this, then it'll return `undefined` when you try to
  get a stale entry, as if it had already been deleted.
* `serializer` An object containing `stringify` and `parse` methods compatible with Javascript's `JSON` to override the serializer used.

## Methods

`memorystore` implements all the **required**, **recommended** and **optional** methods of the [express-session](https://github.com/expressjs/session#session-store-implementation) store. Plus a few more:

- `startInterval()` and `stopInterval()` methods to start/clear the automatic check for expired.

- `prune()` that you can use to manually remove only the expired entries from the store.

## Debug

To enable debug set the env var `DEBUG=memorystore`

# Author

Rocco Musolino ([@roccomuso](https://twitter.com/roccomuso))

# License

MIT
