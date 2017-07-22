MEMDB ika (meowDB)
======

[![Build Status](https://travis-ci.org/flatiron/cradle.svg?branch=master)](https://travis-ci.org/flatiron/cradle)
[![Dependency Status](https://david-dm.org/flatiron/cradle.svg)](https://david-dm.org/flatiron/cradle)

A simple, fast and pure Javascript key-value in memory database for Node JS.

Introduction
------------

This lightweight engine can be used in place of things like [LevelDB](https://github.com/google/leveldb), [Redis](https://redis.io) while keeping things light and very simple.
Internaly, memDB uses json as storage format with an opt-in support for encryption. In order to achieve performance, memdb keeps things in a staging area for fast access. No worries, every booking is handled for you :). We are developers too, thus we hate keeping tract of things.

Synopsis
--------

``` js
  const MemDB = require('memdb')
  const db = new MemDB('_starwars', {encryptionKey: 'secret'}) 

  db.put('skywalker', {
      force: 'light',
      name: 'Luke Skywalker'
  }).then((status) => {
    console.log(status) // => true
  })
  
  db.get('skywalker').then((rsp) => {
    console.log(rps) // => [Object skywalker...]
  })

```

Installation
------------

``` bash
  $ npm install memdb
```

API
---

MemDB's API is pretty simple and straigth forward. all async action api return a promise.

- `version()`: Get MemDB current version
- `revision()`: Get the current database revision
- `options()`: Get the database instance options
- `put(keychain, value, loose)`: Save data in the database
- `get(keychain, defaultValue)`: Get data from the database
- `all()`: Get all data fron the database
- `delete(keychain)`: Delete data from the database

NB: What the heck is keychain ?
keychain is a concatenation of multiple object keys to obtain a path for acessing an object property in a deep level. This is a convenient way of puting/getting deeply nestes object properties. The folowing keychain `server.dev.host` means accessing the `host` property form `dev` object which is in turn available in the `server` object as a property.   

### Creating or Opening a database ###

``` js
  /*
    By default, the databse is not encrypted ans the stagging 
    operation size is 600 max of course you can move it up or down
  */
  const db = new MemDB('db_file_path', {
      stagingSize: 600, // maximum staging operation size before flushing the data 
      encryptionKey: null // optional if you need to encypt your data
  })
```

### Saving data ###

`put(keychain, value, loose)`

| Parameters | Description |
|--------------|--------------|
| keychain| Path where the data should be stored |
| value | The value to be stored |
| loose | Will create internal object of the chain if non existant, default to false |
 
``` js
  db.put('server.dev.host', 'https://dev.alex.com', true).then((status) => {
    console.log(status) // => true
  })
```

### Retrieving data ###

`get(keychain, defaultValue)`

| Parameters | Description |
|--------------|--------------|
| keychain | Path where the data should be retrieved |
| defaultValue | The default value to be returned if not found |
 
``` js
  db.get('server.dev.host', 'https://dev.alex.com').then((rsp) => {
    console.log(rsp) // => https://dev.alex.com
  })
```

`all()`
``` js
  db.all().then((rsp) => {
    console.log(rsp) // => whole database document
  })
```

### Deleting data ###

`delete(keychain)`

| Parameters | Description |
|-------------|-------------|
| keychain | Path where the data should be deleted |

``` js
  db.delete('server.dev.host').then((rsp) => {
    console.log(rsp) // => true
  })
```

Testing
-------

After cloning the repo and installing all dependencies (using `npm install`) you can run all tests using [mocha](http://vowsjs.org):

```
$ npm test
```