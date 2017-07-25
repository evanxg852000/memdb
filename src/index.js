const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const memdb = function (dbName, opts) {
  const VERSION = '0.0.1'
  const CRYPTO_ALGORITHM = 'aes-256-cbc'
  const DEFAULT_STAGING_SIZE = 600
  const INSERT_LOG_ACTION = 1
  const DELETE_LOG_ACTION = -1

  this._version = VERSION
  const defaultOpts = {
    stagingSize: DEFAULT_STAGING_SIZE,
    encryptionKey: null
  }
  opts = Object.assign(defaultOpts, opts || {})

  /* set member variables */
  this._path = dbName
  this._dbFile = path.join(this._path, 'meow.mdb')
  this._logFile = path.join(this._path, 'meow.log')
  this._opts = opts
  this._db = { _rev: -1 }
  this._log = []

  /* error management */
  const DbError = function (type, msg, err) {
    this.name = 'MEMDB_ERROR'
    this.type = type
    this.message = msg || 'An error occured in memdb'
    if (err) {
      this.message += '\n' + err.message
    }
    this.stack = (new Error()).stack
  }
  DbError.prototype = Object.create(Error.prototype)
  DbError.prototype.constructor = DbError

  /* open and initialise db file */
  this._boot = function () {
    if (fs.existsSync(this._path)) {
      try {
        this._db = this._decrypt(fs.readFileSync(this._dbFile, 'utf8'))
        this._log = this._decrypt(fs.readFileSync(this._logFile, 'utf8'))
        this._replay()
        this._flush()
      } catch (err) {
        throw new DbError('FILE_ERROR', 'Unable to read database files!', err)
      }
      return
    }

    try {
      fs.mkdirSync(this._path)
      this._flush()
    } catch (err) {
      throw new DbError('FILE_ERROR', 'Unable to create your database!', err)
    }
  }

  // Replay log history on top of db ...
  this._replay = function () {
    this._log.sort(function (l, r) {
      if (l._time < r._time) {
        return -1
      }
      if (l._time > r._time) {
        return 1
      }
      return 0
    })

    this._log.reduce(function (promise, log) {
      return promise.then(function () {
        if (log._action === INSERT_LOG_ACTION) {
          return this.put(log._payload.key, log._payload.value, log._payload.loose)
        }
        if (log._action === DELETE_LOG_ACTION) {
          return this.delete(log._payload.key)
        }
        return Promise.resolve()
      })
    }, Promise.resolve())
  }

  this._flush = function () {
    var isOk = true
    const savedState = {_rev: this._db._rev, _log: this._log}
    try {
      this._db._rev++
      this._log = []
      fs.writeFileSync(this._dbFile, this._encrypt(this._db), 'utf-8')
      fs.writeFileSync(this._logFile, this._encrypt([]), 'utf-8')
    } catch (err) {
      this._db._rev = savedState._db._rev
      this._log = savedState._log
      isOk = false
      console.error(new DbError('FILE_ERROR', 'Unable to save current database state, will retry ...', err))
    }
    return isOk
  }

  this._extract = function (key) {
    var regex = /^(\w+)(\.\w+)*$/g
    if (!regex.test(key)) {
      return false
    }
    return key.split('.')
  }

  this._encrypt = function (obj) {
    if (!this._opts.encryptionKey) {
      return JSON.stringify(obj)
    }
    var cipher = crypto.createCipher(CRYPTO_ALGORITHM, this._opts.encryptionKey)
    return cipher.update(JSON.stringify(obj), 'utf8', 'hex') + cipher.final('hex')
  }

  this._decrypt = function (str) {
    if (!this._opts.encryptionKey) {
      return JSON.parse(str)
    }
    var decipher = crypto.createDecipher(CRYPTO_ALGORITHM, this._opts.encryptionKey)
    return JSON.parse(decipher.update(str, 'hex', 'utf8') + decipher.final('utf8'))
  }

  this.version = function () {
    return this._version
  }

  this.options = function () {
    return this._opts
  }

  this.revision = function () {
    return this._db._rev
  }

  this.all = function () {
    var copy = Object.assign({}, this._db)
    delete copy._rev
    return copy
  }

  this.put = function (key, value, loose) {
    return new Promise(function (resolve, reject) {
      const path = this._extract(key)
      if (path === false) {
        return reject(new DbError('BAD_KEY_FORMAT', 'Invalid key specified!'))
      }

      var obj = this._db
      const result = !path.some(function (key, idx) {
        if (!obj[key] && path.length !== 1) {
          if (!loose) {
            return true
          } else {
            obj[key] = {}
          }
        }
        (idx < path.length - 1) ? obj = obj[key] : obj[key] = value
        return false
      })

      if (result === false) {
        return reject(new DbError('KEY_NOT_FOUND', 'The specified key was not found!'))
      }

      this._log.push({
        _time: Math.floor(Date.now()),
        _action: INSERT_LOG_ACTION,
        _payload: {key: key, value: value, loose: loose}
      })
      if (this._log.length >= this._opts.stagingSize) {
        this._flush()
      } else {
        fs.writeFileSync(this._logFile, this._encrypt(this._log), 'utf-8')
      }
      resolve(true)
    }.bind(this))
  }

  this.get = function (key, defaultValue) {
    return new Promise(function (resolve, reject) {
      const path = this._extract(key)
      if (path === false) {
        return reject(new DbError('BAD_KEY_FORMAT', 'Invalid key specified!'))
      }

      var result = path.reduce(function (obj, key) {
        obj = obj[key]
        if (!obj) {
          return new DbError('KEY_NOT_FOUND', 'A value for the specified key was not found!')
        }
        return obj
      }, this._db)

      if (result.type === 'KEY_NOT_FOUND') {
        if (!defaultValue) {
          return reject(result)
        }
        return resolve(defaultValue)
      }
      resolve(result)
    }.bind(this))
  }

  this.delete = function (key) {
    return new Promise(function (resolve, reject) {
      const path = this._extract(key)
      if (path === false) {
        return reject(new DbError('BAD_KEY_FORMAT', 'Invalid key specified!'))
      }

      var obj = this._db
      const value = !path.some(function (key, idx) {
        if (!obj[key]) {
          return true
        }
        (idx < path.length - 1) ? obj = obj[key] : delete obj[key]
        return false
      })

      if (value === false) {
        return reject(new DbError('KEY_NOT_FOUND', 'The specified key was not found!'))
      }

      this._log.push({
        _time: Math.floor(Date.now()),
        _action: DELETE_LOG_ACTION,
        _payload: {key: key}
      })
      if (this._log.length >= this._opts.stagingSize) {
        this._flush()
      } else {
        fs.writeFileSync(this._logFile, this._encrypt(this._log), 'utf-8')
      }
      resolve(true)
    }.bind(this))
  }

  this._boot()
}

module.exports = memdb
