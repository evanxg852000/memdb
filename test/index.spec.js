/* globals describe, it, before, beforeEach */

const assert = require('assert')
const utils = require('./utils')
const Db = require('../src/index')

const DB_FILE = './_memdb'

before(function () {
  utils.deleteFolder(DB_FILE)
})

describe('Database initialisation', function () {
  beforeEach(function () {
    utils.deleteFolder(DB_FILE)
  })
  var db, expected

  it('Should create a memdb object', function () {
    db = new Db(DB_FILE, {encryptionKey: 'secret'})
    assert.equal(typeof db, 'object')
    assert.equal(db.version(), '0.0.1')
    assert.equal(db.revision(), 0)
    assert.deepEqual(db.all(), {})
  })

  it('Should get options of the current db instance ', function () {
    db = new Db(DB_FILE)
    expected = {stagingSize: 600, encryptionKey: null}
    assert.deepEqual(db.options(), expected)
  })

  it('Should get options of the current db instance with encryption', function () {
    db = new Db(DB_FILE, {encryptionKey: 'secret'})
    expected = {stagingSize: 600, encryptionKey: 'secret'}
    assert.deepEqual(db.options(), expected)
  })
})

describe('Database internals', function () {
  beforeEach(function () {
    utils.deleteFolder(DB_FILE)
  })
  var db

  it('Should validate keys', function () {
    db = new Db(DB_FILE)
    assert.deepEqual(db._extract('name'), ['name'])
    assert.deepEqual(db._extract('dir.list.name'), ['dir', 'list', 'name'])
    assert.equal(db._extract('name-'), false)
    assert.equal(db._extract('.name'), false)
  })

  it('Should raise BAD_KEY_FORMAT', function (done) {
    db = new Db(DB_FILE, {encryptionKey: 'secret1234'})
    db.put('name-').catch(function (err) {
      assert.equal(err.type, 'BAD_KEY_FORMAT')
      db.get('.name').catch(function (err) {
        assert.equal(err.type, 'BAD_KEY_FORMAT')
        done()
      })
    })
  })

  it('Should encrypt and decrypt', function () {
    db = new Db(DB_FILE)

    var encrypted = db._encrypt('Evance')
    assert.equal(db._decrypt(encrypted), 'Evance')
    encrypted = db._encrypt('dir.list.name')
    assert.equal(db._decrypt(encrypted), 'dir.list.name')
  })
})

describe('Database insertion', function () {
  beforeEach(function () {
    utils.deleteFolder(DB_FILE)
  })
  var db, expected

  it('Should put value in db', function (done) {
    db = new Db(DB_FILE)
    expected = { name: 'Alex Soumaoro' }

    db.put('name', 'Alex Soumaoro')
    .then(function () {
      assert.deepEqual(db.all(), expected)
      done()
    })
  })

  it('Should put a value in db using loose property mode', function (done) {
    db = new Db(DB_FILE)
    expected = { family: { me: { members: [{ name: 'Alex Soumaoro' }] } } }
    db.put('family.me.members', [{ name: 'Alex Soumaoro' }], true)
    .then(function () {
      assert.deepEqual(db.all(), expected)
      db.put('family.name', 'Soumaoro')
      .then(function (value) {
        assert.deepEqual(value, true)
        expected.family.name = 'Soumaoro'
        assert.deepEqual(db.all(), expected)
        done()
      })
    })
  })

  it('Should not put a value in db using strict property mode', function (done) {
    db = new Db(DB_FILE)
    db.put('family.me.members', [{ name: 'Alex Soumaoro' }])
    .catch(function (err) {
      assert.equal(err.type, 'KEY_NOT_FOUND')
      done()
    })
  })
})

describe('Database query', function () {
  var db
  beforeEach(function (done) {
    utils.deleteFolder(DB_FILE)
    db = new Db(DB_FILE)
    Promise.all([
      db.put('users', [{ name: 'Evance' }, { name: 'Alex' }]),
      db.put('server.port', 3000, true)
    ]).then(function () {
      done()
    })
  })

  it('Should get a value', function (done) {
    Promise.all([
      db.get('server'),
      db.get('server.host', 'http://127.0.0.1'),
      db.get('users')
    ]).then(function (values) {
      assert.deepEqual(values[0], { port: 3000 })
      assert.equal(values[1], 'http://127.0.0.1')
      assert.deepEqual(values[2], [{ name: 'Evance' }, { name: 'Alex' }])
      done()
    })
  })

  it('Should raise a KEY_NOT_FOUND error', function (done) {
    db.get('serve').catch(function (err) {
      assert.equal(err.type, 'KEY_NOT_FOUND')
      db.get('server.host').catch(function (err) {
        assert.equal(err.type, 'KEY_NOT_FOUND')
        done()
      })
    })
  })
})

describe('Database deletion', function () {
  var db
  beforeEach(function (done) {
    utils.deleteFolder(DB_FILE)
    db = new Db(DB_FILE)
    Promise.all([
      db.put('users', [{ name: 'Evance' }, { name: 'Alex' }]),
      db.put('server.port', 3000, true)
    ]).then(function () {
      done()
    })
  })

  it('Should delete the values', function (done) {
    Promise.all([
      db.delete('users'),
      db.delete('server.port')
    ]).then(function (values) {
      assert.deepEqual(values, [true, true])
      assert.deepEqual(db.all(), { server: {} })
      done()
    })
  })
})

describe('Integration tests', function () {
  var opts = {stagingSize: 10, encryptionKey: 'alex'}
  var db, expected

  before(function () {
    utils.deleteFolder(DB_FILE)
  })

  it('Should create and insert data in db', function (done) {
    db = new Db(DB_FILE, opts)
    db.put('family.name', 'Soumaoro', true)
    .then(function (value) {
      assert.deepEqual(value, true)
      Promise.all([
        db.put('family.members', ['Evance', 'Alex']),
        db.put('config', {version: '1.2.3'})
      ]).then(function (values) {
        assert.deepEqual(values, [true, true])
        assert.equal(db._log.length, 3)
        done()
      })
    })
  })

  it('Should open and insert data in db with stagingSize', function (done) {
    db = new Db(DB_FILE, opts)
    Promise.all([
      db.get('family.name'),
      db.get('family.members'),
      db.get('config')
    ]).then(function (values) {
      assert.equal(values[0], 'Soumaoro')
      assert.deepEqual(values[1], ['Evance', 'Alex'])
      assert.equal(values[2].version, '1.2.3')

      var cfgs = []
      expected = []
      for (var i = 0; i < 10; i++) {
        cfgs.push(db.put(`config._${i}_`, i * 3))
        expected.push(true)
      }
      Promise.all(cfgs).then(function (values) {
        assert.deepEqual(values, expected)
        assert.equal(db._log.length, 0)
        cfgs = []
        expected = []
        for (var i = 10; i < 15; i++) {
          cfgs.push(db.put(`config._${i}_`, i * 3))
          expected.push(true)
        }
        Promise.all(cfgs).then(function (values) {
          assert.deepEqual(values, expected)
          assert.equal(db._log.length, 5)
          done()
        })
      })
    })
  })

  it('Should open and update data in db', function (done) {
    db = new Db(DB_FILE, opts)
    assert.equal(db._log.length, 0)
    Promise.all([
      db.get('config._3_'),
      db.get('config._7_')
    ]).then(function (values) {
      assert.deepEqual(values, [9, 21])
      Promise.all([
        db.put('family.name', 'Doe', true),
        db.put('family.members', ['Jhone', 'Jane']),
        db.put('config.version', '1.3.4'),
        db.put('config.server.host', '192.8.8.12', true)
      ]).then(function (values) {
        assert.deepEqual(values, [true, true, true, true])
        db.put('config.server.port', 8080).then(function (value) {
          assert.equal(value, true)
          done()
        })
      })
    })
  })

  it('Should open and delete data in db', function (done) {
    db = new Db(DB_FILE, opts)
    Promise.all([
      db.get('family.name'),
      db.get('family.members'),
      db.get('config.server')
    ]).then(function (values) {
      assert.equal(values[0], 'Doe')
      assert.deepEqual(values[1], ['Jhone', 'Jane'])
      assert.deepEqual(values[2], {host: '192.8.8.12', port: 8080})
      Promise.all([
        db.delete('family'),
        db.delete('config.server')
      ]).then(function (values) {
        assert.deepEqual(values, [true, true])
        done()
      })
    })
  })

  it('Should open and find db in good state', function () {
    db = new Db(DB_FILE, opts)
    var data = db.all()

    assert.equal(db._log.length, 0)
    assert.equal(data.family, undefined)
    assert.equal(data.config.server, undefined)
    assert.equal(typeof data.config, 'object')
    assert.equal(data.config.version, '1.3.4')
    assert.equal(Object.keys(data.config).length, 16)
  })
})
