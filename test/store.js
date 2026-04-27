const assert = require('assert')

// express-session way
const MemoryStore = require('../')({ Store: class {} })
const session = { MemoryStore }

function createStore (options) {
  return new session.MemoryStore(options)
}

describe('MemoryStore', function (done) {
  afterEach(function () {
    if (this.store) {
      this.store.stopInterval()
    }
  })

  it('constructor should use default options', function (done) {
    this.store = createStore()
    const store = this.store
    assert.ok(store.options, 'should have an option object')
    assert.strictEqual(store.options.max, Infinity, 'max option should be Infinity')
    assert.strictEqual(store.options.checkPeriod, undefined, 'checkPeriod undefined by default')
    assert.ok(store.store, 'should have the LRU cache store')
    assert.strictEqual(store._checkInterval, undefined, 'should not have the pruning loop')
    done()
  })

  it('should set options', function (done) {
    this.store = createStore({
      max: 10,
      checkPeriod: 10 * 1000,
      ttl: 36000,
      dispose: null,
      stale: true
    })
    const store = this.store
    assert.strictEqual(store.options.max, 10, 'should set the max option')
    assert.strictEqual(store.options.checkPeriod, 10 * 1000, 'should set checkPeriod')
    assert.strictEqual(store.options.ttl, 36000, 'should set the TTL')
    assert.strictEqual(store.options.dispose, null, 'should set dispose')
    assert.strictEqual(store.options.stale, true, 'should set stale')
    done()
  })

  it('should preserve falsy numeric options', function (done) {
    this.store = createStore({ max: 0 })
    assert.strictEqual(this.store.options.max, 0, 'should keep max=0 instead of replacing it')
    done()
  })

  it('should not set the interval to check for expired entries by default', function (done) {
    this.store = createStore()
    const store = this.store
    assert.strictEqual(store._checkInterval, undefined, 'should not exist')
    done()
  })

  it('should only contain 10 items', function (done) {
    this.store = createStore({ max: 10 })
    const store = this.store

    for (let i = 0; i < 15; i++) {
      store.set(i, { cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) } })
    }

    store.length(function (err, length) {
      if (err) return done(err)
      assert.strictEqual(length, 10)
      done()
    })
  })

  it('should delete the first item', function (done) {
    this.store = createStore({ max: 10 })
    const store = this.store

    for (let i = 0; i < 15; i++) {
      store.set(i, { cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) } })
    }

    store.destroy(14)

    store.length(function (err, length) {
      if (err) return done(err)
      assert.strictEqual(length, 9)
      done()
    })
  })

  it('should delete the last item', function (done) {
    this.store = createStore({ max: 10 })
    const store = this.store

    for (let i = 0; i < 10; i++) {
      store.set(i, { cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) } })
    }

    store.destroy(0)
    store.destroy(1)

    store.length(function (err, length) {
      if (err) return done(err)
      assert.strictEqual(length, 8)
    })

    for (let i = 10; i < 12; i++) {
      store.set(i, { cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) } })
    }

    store.length(function (err, length) {
      if (err) return done(err)
      assert.strictEqual(length, 10)
      done()
    })
  })

  it('should set and get a sample entry', function (done) {
    this.store = createStore()
    const store = this.store

    store.set('hello', { cookie: {}, sample: true })
    store.get('hello', function (err, val) {
      if (err) return done(err)
      assert.strictEqual(val.sample, true, 'set and got expected value')
      done()
    })
  })

  it('should not persist sessions that fail to serialize', function (done) {
    this.store = createStore()
    const store = this.store
    const circularSession = { cookie: {} }
    circularSession.self = circularSession

    let callbackCount = 0

    store.set('bad', circularSession, function (err) {
      callbackCount += 1
      assert.ok(err instanceof TypeError, 'should surface the serialization error')
      assert.strictEqual(callbackCount, 1, 'should call the callback once')

      store.get('bad', function (getErr, val) {
        if (getErr) return done(getErr)
        assert.strictEqual(val, undefined, 'should not keep a failed session in the cache')
        done()
      })
    })
  })

  it('should allow custom serializers', function (done) {
    this.store = createStore({
      serializer: {
        stringify: function (value) {
          return Buffer.from(JSON.stringify(value)).toString('base64')
        },
        parse: function (value) {
          return JSON.parse(Buffer.from(value, 'base64').toString('utf8'))
        }
      }
    })
    const store = this.store

    store.set('hello', { cookie: {}, sample: true }, function (err) {
      if (err) return done(err)
      store.get('hello', function (getErr, val) {
        if (getErr) return done(getErr)
        assert.strictEqual(val.sample, true, 'should round-trip with the custom serializer')
        done()
      })
    })
  })

  it('should set TTL from cookie.maxAge', function (done) {
    this.store = createStore()
    const store = this.store

    store.set('hello', { cookie: { maxAge: 400 }, sample: true })
    store.get('hello', function (err, val) {
      if (err) return done(err)
      assert.strictEqual(val.sample, true, 'entry should be valid')
    })
    setTimeout(function () {
      store.get('hello', function (err, val) {
        if (err) return done(err)
        assert.strictEqual(val, undefined, 'entry should be expired')
        done()
      })
    }, 500)
  })

  it('should not get empty entry', function (done) {
    this.store = createStore()
    const store = this.store

    store.get('', function (err, val) {
      if (err) return done(err)
      assert.strictEqual(val, undefined)
      done()
    })
  })

  it('should not get a deleted entry', function (done) {
    this.store = createStore()
    const store = this.store

    store.set('foo', { cookie: {} })
    store.get('foo', function (err, val) {
      if (err) return done(err)
      assert.ok(val, 'entry exists')
      store.destroy('foo')
      store.get('foo', function (err, val) {
        if (err) return done(err)
        assert.strictEqual(val, undefined, 'entry actually deleted')
        done()
      })
    })
  })

  it('should not get an expired entry', function (done) {
    this.store = createStore()
    const store = this.store

    store.set('hello', { cookie: { maxAge: 200 }, sample: true })
    setTimeout(function () {
      store.get('hello', function (err, val) {
        if (err) return done(err)
        assert.strictEqual(val, undefined, 'entry should be expired')
        done()
      })
    }, 300)
  })

  it('should enable automatic prune for expired entries', function (done) {
    this.store = createStore({ checkPeriod: 300 })
    const store = this.store

    store.set('foo', { cookie: { maxAge: 150 } })
    store.set('bar', { cookie: { maxAge: 150 } })
    store.length(function (err, count) {
      if (err) return done(err)
      assert.strictEqual(count, 2, 'should count 2 entries')
    })
    setTimeout(function () {
      store.length(function (err, count) {
        if (err) return done(err)
        assert.strictEqual(count, 0, 'expired entries should be pruned')
        done()
      })
    }, 500)
  })

  it('automatic check for expired entries should be disabled', function (done) {
    this.store = createStore()
    const store = this.store

    store.set('foo', { cookie: { maxAge: 150 } })
    store.set('bar', { cookie: { maxAge: 150 } })
    store.length(function (err, count) {
      if (err) return done(err)
      assert.strictEqual(count, 2, 'should count 2 entries')
    })
    setTimeout(function () {
      store.length(function (err, count) {
        if (err) return done(err)
        assert.strictEqual(count, 2, 'expired entries should not be pruned')
        done()
      })
    }, 500)
  })

  it('should touch a given entry', function (done) {
    this.store = createStore()
    const store = this.store

    store.set('hei', { cookie: { maxAge: 50 } })
    store.touch('hei', { cookie: { maxAge: 300 } })
    setTimeout(function () {
      store.get('hei', function (err, val) {
        if (err) return done(err)
        assert.ok(val, 'entry should be touched')
        done()
      })
    }, 200)
  })

  it('should fetch all entries Ids', function (done) {
    this.store = createStore()
    const store = this.store

    const k = 10
    for (let i = 0; i < k; i++) { store.set('sess' + i, { cookie: { maxAge: 1000 } }) }

    store.ids(function (err, ids) {
      if (err) return done(err)
      assert.ok(Array.isArray(ids), 'ids should be an Array')
      let i = 10
      ids.forEach(function (sid) {
        assert.strictEqual(sid, 'sess' + (--i), 'got expected key')
      })
      done()
    })
  })

  it('should fetch all entries values', function (done) {
    this.store = createStore()
    const store = this.store

    const k = 10
    for (let i = 0; i < k; i++) { store.set('sess-' + i, { cookie: { maxAge: 1000 }, i }) }

    store.all(function (err, all) {
      if (err) return done(err)
      assert.strictEqual(typeof all, 'object', 'all should be an Object')
      Object.keys(all).forEach(function (sid) {
        const v = sid.split('-')[1]
        assert.strictEqual(String(all[sid].i), v, 'got expected value')
      })
      done()
    })
  })

  it('should count all entries in the store', function (done) {
    this.store = createStore()
    const store = this.store

    const k = 10
    for (let i = 0; i < k; i++) { store.set(i, { cookie: { maxAge: 1000 } }) }

    store.length(function (err, n) {
      if (err) return done(err)
      assert.strictEqual(n, k, 'got expected length')
      done()
    })
  })

  it('should delete all entries from the store', function (done) {
    this.store = createStore()
    const store = this.store

    const k = 10
    for (let i = 0; i < k; i++) { store.set(i, { cookie: { maxAge: 1000 } }) }

    store.length(function (err, n) {
      if (err) return done(err)
      assert.strictEqual(n, k, 'store is not empty')
    })
    store.clear()
    store.length(function (err, n) {
      if (err) return done(err)
      assert.strictEqual(n, 0, 'store should be empty')
      done()
    })
  })
})
