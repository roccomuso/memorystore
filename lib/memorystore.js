/*!
 * memorystore
 * Copyright(c) 2017 Rocco Musolino <@roccomuso>
 * MIT Licensed
 */

var debug = require('debug')('memorystore')
var LRU = require('lru-cache')
var util = require('util')

/**
 * One day in milliseconds.
 */

var oneDay = 86400000

function getTTL (options, sess, sid) {
  if (typeof options.ttl === 'number') return options.ttl
  if (typeof options.ttl === 'function') return options.ttl(options, sess, sid)
  if (options.ttl) throw new TypeError('`options.ttl` must be a number or function.')

  var maxAge = (sess && sess.cookie) ? sess.cookie.maxAge : null
  return (typeof maxAge === 'number'
    ? Math.floor(maxAge)
    : oneDay)
}

function prune (store) {
  debug('Pruning expired entries')
  store.forEach(function (value, key) {
    store.get(key)
  })
}

var defer = typeof setImmediate === 'function'
  ? setImmediate
  : function (fn) { process.nextTick(fn.bind.apply(fn, arguments)) }

/**
 * Return the `MemoryStore` extending `express`'s session Store.
 *
 * @param {object} express session
 * @return {Function}
 * @api public
 */

module.exports = function (session) {
  /**
   * Express's session Store.
   */

  var Store = session.Store

  /**
   * Initialize MemoryStore with the given `options`.
   *
   * @param {Object} options
   * @api public
   */

  function MemoryStore (options) {
    if (!(this instanceof MemoryStore)) {
      throw new TypeError('Cannot call MemoryStore constructor as a function')
    }

    options = options || {}
    Store.call(this, options)

    this.options = {}
    this.options.checkPeriod = options.checkPeriod
    this.options.max = options.max || Infinity
    this.options.ttl = options.ttl
    this.options.dispose = options.dispose
    this.options.stale = options.stale
    this.options.noDisposeOnSet = options.noDisposeOnSet

    if (options.secret) {
      this.secret = options.secret
      this.kruptein = require('kruptein')(options)
    }

    this.serializer = options.serializer || JSON
    this.store = LRU(this.options)
    debug('Init MemoryStore')

    this.startInterval()
  }

  /**
   * Inherit from `Store`.
   */

  util.inherits(MemoryStore, Store)

  /**
   * Attempt to fetch session by the given `sid`.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */

  MemoryStore.prototype.get = function (sid, fn) {
    var store = this.store

    debug('GET "%s"', sid)

    var data = store.get(sid)
    if (!data) return fn()

    debug('GOT %s', data)
    var err = null
    var result

    if (this.secret) {
      this.kruptein.get(this.secret, data, function(err, ct) {
        if (err)
          return fn(err)

        data = JSON.parse(ct)
      })
    }

    try {
      result = this.serializer.parse(data)
    } catch (er) {
      err = er
    }

    fn && defer(fn, err, result)
  }

  /**
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */

  MemoryStore.prototype.set = function (sid, sess, fn) {
    var store = this.store

    var ttl = getTTL(this.options, sess, sid)
    try {
      var jsess = this.serializer.stringify(sess)
    } catch (err) {
      fn && defer(fn, err)
    }

    if (this.secret) {
      this.kruptein.set(this.secret, jsess, function(err, ct) {
        if (err)
          return fn(err)

        jsess = ct
      })
    }

    store.set(sid, jsess, ttl)
    debug('SET "%s" %s ttl:%s', sid, jsess, ttl)
    fn && defer(fn, null)
  }

  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @api public
   */

  MemoryStore.prototype.destroy = function (sid, fn) {
    var store = this.store

    if (Array.isArray(sid)) {
      sid.forEach(function (s) {
        debug('DEL "%s"', s)
        store.del(s)
      })
    } else {
      debug('DEL "%s"', sid)
      store.del(sid)
    }
    fn && defer(fn, null)
  }

  /**
   * Refresh the time-to-live for the session with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */

  MemoryStore.prototype.touch = function (sid, sess, fn) {
    var store = this.store

    var ttl = getTTL(this.options, sess, sid)

    debug('EXPIRE "%s" ttl:%s', sid, ttl)
    
    var data = store.get(sid)
    if (!data) return fn()
    
    var err = null

    if (store.secret) {
      store.kruptein.get(store.secret, data, function(err, ct) {
        if (err)
          return fn(err)
        
        data = ct
      })
    }

    try {
      var s = this.serializer.parse(data)
      s.cookie = sess.cookie
      store.set(sid, this.serializer.stringify(s), ttl)
    } catch (e) {
      err = e
    }

    if (store.secret) {
      store.kruptein.set(store.secret, s, function(err, ct) {
        if (err)
          return fn(err)
          
        s = ct
      })
    }

    try {
      store.set(sid, this.serializer.stringify(s), ttl)
    } catch (e) {
      err = e
    }

    fn && defer(fn, err)
  }

  /**
   * Fetch all sessions' ids
   *
   * @param {Function} fn
   * @api public
   */

  MemoryStore.prototype.ids = function (fn) {
    var store = this.store

    var Ids = store.keys()
    debug('Getting IDs: %s', Ids)
    fn && defer(fn, null, Ids)
  }

  /**
   * Fetch all sessions
   *
   * @param {Function} fn
   * @api public
   */

  MemoryStore.prototype.all = function (fn) {
    var store = this.store
    var self = this

    debug('Fetching all sessions')
    var err = null
    var result = {}
    try {
      store.forEach(function (val, key) {
        if (self.secret) {
          self.kruptein.get(self.secret, val, function(err, ct) {
            if (err)
              return fn(err)
              
            val = JSON.parse(ct)
          })
        }
        
        result[key] = self.serializer.parse(val)
      })
    } catch (e) {
      err = e
    }
    fn && defer(fn, err, result)
  }

  /**
   * Delete all sessions from the store
   *
   * @param {Function} fn
   * @api public
   */

  MemoryStore.prototype.clear = function (fn) {
    var store = this.store
    debug('delete all sessions from the store')
    store.reset()
    fn && defer(fn, null)
  }

  /**
   * Get the count of all sessions in the store
   *
   * @param {Function} fn
   * @api public
   */

  MemoryStore.prototype.length = function (fn) {
    var store = this.store
    debug('getting length', store.itemCount)
    fn && defer(fn, null, store.itemCount)
  }

  /**
   * Start the check interval
   * @api public
   */

  MemoryStore.prototype.startInterval = function () {
    var self = this
    var ms = this.options.checkPeriod
    if (ms && typeof ms === 'number') {
      clearInterval(this._checkInterval)
      debug('starting periodic check for expired sessions')
      this._checkInterval = setInterval(function () {
        prune(self.store) // iterates over the entire cache proactively pruning old entries
      }, Math.floor(ms))
    }
  }

  /**
   * Stop the check interval
   * @api public
   */

  MemoryStore.prototype.stopInterval = function () {
    debug('stopping periodic check for expired sessions')
    clearInterval(this._checkInterval)
  }

  /**
   * Remove only expired entries from the store
   * @api public
   */

  MemoryStore.prototype.prune = function () {
    prune(this.store)
  }

  return MemoryStore
}
