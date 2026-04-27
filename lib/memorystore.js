/*!
 * memorystore
 * Copyright(c) 2020 Rocco Musolino <@roccomuso>
 * MIT Licensed
 */

const debug = require('debug')('memorystore')
const LRU = require('lru-cache')

/**
 * One day in milliseconds.
 */

const ONE_DAY = 86400000

const defer = typeof setImmediate === 'function'
  ? setImmediate
  : function (fn) {
    process.nextTick(fn.bind.apply(fn, arguments))
  }

function runCallback (fn) {
  if (typeof fn === 'function') {
    defer(fn, ...Array.prototype.slice.call(arguments, 1))
  }
}

function getTTL (options, sess, sid) {
  if (typeof options.ttl === 'number') return options.ttl
  if (typeof options.ttl === 'function') return options.ttl(options, sess, sid)
  if (options.ttl) throw new TypeError('`options.ttl` must be a number or function.')

  const maxAge = sess && sess.cookie ? sess.cookie.maxAge : null
  return (typeof maxAge === 'number'
    ? Math.floor(maxAge)
    : ONE_DAY)
}

function prune (store) {
  debug('Pruning expired entries')
  store.forEach(function (_, key) {
    store.get(key)
  })
}

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

  const Store = session.Store

  /**
   * Initialize MemoryStore with the given `options`.
   *
   * @param {Object} options
   * @api public
   */

  return class MemoryStore extends Store {
    constructor (options = {}) {
      super(options)

      this.options = {
        checkPeriod: options.checkPeriod,
        max: options.max == null ? Infinity : options.max,
        ttl: options.ttl,
        dispose: options.dispose,
        stale: options.stale,
        noDisposeOnSet: options.noDisposeOnSet
      }

      this.serializer = options.serializer || JSON
      this.store = LRU(this.options)
      debug('Init MemoryStore')

      this.startInterval()
    }

    /**
     * Attempt to fetch session by the given `sid`.
     *
     * @param {String} sid
     * @param {Function} fn
     * @api public
     */

    get (sid, fn) {
      debug('GET "%s"', sid)

      const data = this.store.get(sid)
      if (!data) {
        return runCallback(fn)
      }

      debug('GOT %s', data)
      let result
      let err = null
      try {
        result = this.serializer.parse(data)
      } catch (parseError) {
        err = parseError
      }

      runCallback(fn, err, result)
    }

    /**
     * Commit the given `sess` object associated with the given `sid`.
     *
     * @param {String} sid
     * @param {Session} sess
     * @param {Function} fn
     * @api public
     */

    set (sid, sess, fn) {
      const ttl = getTTL(this.options, sess, sid)
      let serializedSession

      try {
        serializedSession = this.serializer.stringify(sess)
      } catch (err) {
        return runCallback(fn, err)
      }

      this.store.set(sid, serializedSession, ttl)
      debug('SET "%s" %s ttl:%s', sid, serializedSession, ttl)
      runCallback(fn, null)
    }

    /**
     * Destroy the session associated with the given `sid`.
     *
     * @param {String} sid
     * @api public
     */

    destroy (sid, fn) {
      const sessionIds = Array.isArray(sid) ? sid : [sid]

      sessionIds.forEach((sessionId) => {
        debug('DEL "%s"', sessionId)
        this.store.del(sessionId)
      })

      runCallback(fn, null)
    }

    /**
     * Refresh the time-to-live for the session with the given `sid`.
     *
     * @param {String} sid
     * @param {Session} sess
     * @param {Function} fn
     * @api public
     */

    touch (sid, sess, fn) {
      const ttl = getTTL(this.options, sess, sid)

      debug('EXPIRE "%s" ttl:%s', sid, ttl)
      const data = this.store.get(sid)
      if (data === undefined) {
        return runCallback(fn, null)
      }

      try {
        const storedSession = this.serializer.parse(data)
        storedSession.cookie = sess.cookie
        this.store.set(sid, this.serializer.stringify(storedSession), ttl)
        runCallback(fn, null)
      } catch (err) {
        runCallback(fn, err)
      }
    }

    /**
     * Fetch all sessions' ids
     *
     * @param {Function} fn
     * @api public
     */

    ids (fn) {
      const ids = this.store.keys()
      debug('Getting IDs: %s', ids)
      runCallback(fn, null, ids)
    }

    /**
     * Fetch all sessions
     *
     * @param {Function} fn
     * @api public
     */

    all (fn) {
      debug('Fetching all sessions')
      const result = {}

      try {
        this.store.forEach((value, key) => {
          result[key] = this.serializer.parse(value)
        })

        runCallback(fn, null, result)
      } catch (err) {
        runCallback(fn, err)
      }
    }

    /**
     * Delete all sessions from the store
     *
     * @param {Function} fn
     * @api public
     */

    clear (fn) {
      debug('Delete all sessions from the store')
      this.store.reset()
      runCallback(fn, null)
    }

    /**
     * Get the count of all sessions in the store
     *
     * @param {Function} fn
     * @api public
     */

    length (fn) {
      debug('Getting length: %s', this.store.itemCount)
      runCallback(fn, null, this.store.itemCount)
    }

    /**
     * Start the check interval
     * @api public
     */

    startInterval () {
      const ms = this.options.checkPeriod
      if (!Number.isFinite(ms) || ms <= 0) {
        return
      }

      clearInterval(this._checkInterval)
      debug('Starting periodic check for expired sessions')
      this._checkInterval = setInterval(() => {
        prune(this.store) // iterates over the entire cache proactively pruning old entries
      }, Math.floor(ms))

      this._checkInterval.unref()
    }

    /**
     * Stop the check interval
     * @api public
     */

    stopInterval () {
      debug('Stopping periodic check for expired sessions')
      clearInterval(this._checkInterval)
      this._checkInterval = undefined
    }

    /**
     * Remove only expired entries from the store
     * @api public
     */

    prune () {
      prune(this.store)
    }
  }
}
