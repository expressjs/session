/*!
 * express-session
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 * @private
 */

var Store = require('./store')
var util = require('util')
var MemoryStore = require('memorystore')

/**
 * Module exports.
 */

module.exports = new MemoryStore({Store: Store})
