var assert = require('assert')

// express-session way
var MemoryStore = require('../')({Store: function () {}})
var session = {MemoryStore: MemoryStore}

describe('MemoryStore', function (done) {
  afterEach(function () {
    // runs after each test in this block
    this.store.stopInterval()
  })

  it('constructor should use default options', function (done) {
    this.store = new session.MemoryStore()
    var store = this.store
    assert.ok(store.options, 'should have an option object')
    assert.equal(store.options.max, Infinity, 'max option should be Infinity')
    assert.equal(store.options.checkPeriod, undefined, 'checkPeriod undefined by default')
    assert.ok(store.store, 'should have the LRU cache store')
    assert.equal(store._checkInterval, undefined, 'should not have the pruning loop')
    done()
  })

  it('should set options', function (done) {
    this.store = new session.MemoryStore({
      max: 10,
      checkPeriod: 10 * 1000,
      ttl: 36000,
      dispose: null,
      stale: true
    })
    var store = this.store
    assert.equal(store.options.max, 10, 'should set the max option')
    assert.equal(store.options.checkPeriod, 10 * 1000, 'should set checkPeriod')
    assert.equal(store.options.ttl, 36000, 'should set the TTL')
    assert.equal(store.options.dispose, null, 'should set dispose')
    assert.equal(store.options.stale, true, 'should set stale')
    done()
  })

  it('should not set the interval to check for expired entries by default', function (done) {
    this.store = new session.MemoryStore()
    var store = this.store
    assert.equal(store._checkInterval, undefined, 'should not exists')
    done()
  })

  it('should only contain 10 items', function (done) {
    this.store = new session.MemoryStore({max: 10})
    var store = this.store

    for (var i = 0; i < 15; i++) {
      store.set(i, {cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) }})
    }

    store.length(function (err, length) {
      if (err) return done(err)
      assert.equal(length, 10)
      done()
    })
  })

  it('should delete the first item', function () {
    this.store = new session.MemoryStore({max: 10})
    var store = this.store

    for (var i = 0; i < 15; i++) {
      store.set(i, {cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) }})
    }

    store.destroy(14)

    store.length(function (err, length) {
      if (err) return done(err)
      assert.equal(length, 9)
      done()
    })
  })

  it('should delete the last item', function () {
    this.store = new session.MemoryStore({max: 10})
    var store = this.store

    for (var i = 0; i < 10; i++) {
      store.set(i, {cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) }})
    }

    store.destroy(0)
    store.destroy(1)

    store.length(function (err, length) {
      if (err) return done(err)
      assert.equal(length, 8)
      done()
    })

    for (i = 10; i < 12; i++) {
      store.set(i, {cookie: { expires: new Date((new Date()).valueOf() + 60 * 10 * 1000) }})
    }

    store.length(function (err, length) {
      if (err) return done(err)
      assert.equal(length, 10)
      done()
    })
  })

  it('should set and get a sample entry', function (done) {
    this.store = new session.MemoryStore()
    var store = this.store

    store.set('hello', {cookie: {}, sample: true})
    store.get('hello', function (err, val) {
      if (err) return done(err)
      assert.equal(val.sample, true, 'set and got expected value')
      done()
    })
  })

  it('should set TTL from cookie.maxAge', function (done) {
    this.store = new session.MemoryStore()
    var store = this.store

    store.set('hello', {cookie: {maxAge: 400}, sample: true})
    store.get('hello', function (err, val) {
      if (err) return done(err)
      assert.equal(val.sample, true, 'entry should be valid')
    })
    setTimeout(function () {
      store.get('hello', function (err, val) {
        if (err) return done(err)
        assert.equal(val, undefined, 'entry should be expired')
        done()
      })
    }, 500)
  })

  it('should not get empty entry', function (done) {
    this.store = new session.MemoryStore()
    var store = this.store

    store.get('', function (err, val) {
      if (err) return done(err)
      assert.equal(val, undefined)
      done()
    })
  })

  it('should not get a deleted entry', function (done) {
    this.store = new session.MemoryStore()
    var store = this.store

    store.set('foo', {cookie: {}})
    store.get('foo', function (err, val) {
      if (err) return done(err)
      assert.ok(val, 'entry exists')
      store.destroy('foo')
      store.get('foo', function (err, val) {
        if (err) return done(err)
        assert.equal(val, undefined, 'entry actually deleted')
        done()
      })
    })
  })

  it('should not get an expired entry', function (done) {
    this.store = new session.MemoryStore()
    var store = this.store

    store.set('hello', {cookie: {maxAge: 200}, sample: true})
    setTimeout(function () {
      store.get('hello', function (err, val) {
        if (err) return done(err)
        assert.equal(val, undefined, 'entry should be expired')
        done()
      })
    }, 300)
  })

  it('should enable automatic prune for expired entries', function (done) {
    this.store = new session.MemoryStore({checkPeriod: 300})
    var store = this.store

    store.set('foo', {cookie: {maxAge: 150}})
    store.set('bar', {cookie: {maxAge: 150}})
    store.length(function (err, count) {
      if (err) return done(err)
      assert.equal(count, 2, 'should count 2 entries')
    })
    setTimeout(function () {
      store.length(function (err, count) {
        if (err) return done(err)
        assert.equal(count, 0, 'expired entries should be pruned')
        done()
      })
    }, 500)
  })

  it('automatic check for expired entries should be disabled', function (done) {
    this.store = new session.MemoryStore()
    var store = this.store

    store.set('foo', {cookie: {maxAge: 150}})
    store.set('bar', {cookie: {maxAge: 150}})
    store.length(function (err, count) {
      if (err) return done(err)
      assert.equal(count, 2, 'should count 2 entries')
    })
    setTimeout(function () {
      store.length(function (err, count) {
        if (err) return done(err)
        assert.equal(count, 2, 'expired entries should not be pruned')
        done()
      })
    }, 500)
  })

  it('should touch a given entry', function (done) {
    this.store = new session.MemoryStore()
    var store = this.store

    store.set('hei', {cookie: {maxAge: 50}})
    store.touch('hei', {cookie: {maxAge: 300}})
    setTimeout(function () {
      store.get('hei', function (err, val) {
        if (err) return done(err)
        assert.ok(val, 'entry should be touched')
        done()
      })
    }, 200)
  })

  it('should fetch all entries Ids', function (done) {
    this.store = new session.MemoryStore()
    var store = this.store

    var k = 10
    var i = 0
    for (i = 0; i < k; i++) { store.set('sess' + i, {cookie: {maxAge: 1000}}) }

    store.ids(function (err, ids) {
      if (err) return done(err)
      assert.ok(Array.isArray(ids), 'ids should be an Array')
      i = 10
      ids.forEach(function (sid) {
        assert.equal(sid, 'sess' + (--i), 'got expected key')
      })
      done()
    })
  })

  it('should fetch all entries values', function (done) {
    this.store = new session.MemoryStore()
    var store = this.store

    var k = 10
    var i = 0
    for (i = 0; i < k; i++) { store.set('sess-' + i, {cookie: {maxAge: 1000}, i: i}) }

    store.all(function (err, all) {
      if (err) return done(err)
      assert.equal(typeof all, 'object', 'all should be an Object')
      Object.keys(all).forEach(function (sid) {
        var v = sid.split('-')[1]
        assert.equal(all[sid].i, v, 'got expected value')
      })
      done()
    })
  })

  it('should count all entries in the store', function (done) {
    this.store = new session.MemoryStore()
    var store = this.store

    var k = 10
    var i = 0
    for (i = 0; i < k; i++) { store.set(i, {cookie: {maxAge: 1000}}) }

    store.length(function (err, n) {
      if (err) return done(err)
      assert.equal(n, k, 'Got expected lenght')
      done()
    })
  })

  it('should delete all entries from the store', function (done) {
    this.store = new session.MemoryStore()
    var store = this.store

    var k = 10
    var i = 0
    for (i = 0; i < k; i++) { store.set(i, {cookie: {maxAge: 1000}}) }

    store.length(function (err, n) {
      if (err) return done(err)
      assert.equal(n, k, 'store is not empty')
    })
    store.clear()
    store.length(function (err, n) {
      if (err) return done(err)
      assert.equal(n, 0, 'store should be empty')
      done()
    })
  })
})
