'use strict'

var fs = require('fs')
var path = require('path')

var HISTORY_FILE_PATH = path.join(__dirname, '..', 'HISTORY.md')
var MD_HEADER_REGEXP = /^====*$/
var VERSION = process.env.npm_package_version
var VERSION_PLACEHOLDER_REGEXP = /^(?:unreleased|(\d+\.)+x)$/

var historyFileLines = fs.readFileSync(HISTORY_FILE_PATH, 'utf-8').split('\n')

if (!MD_HEADER_REGEXP.test(historyFileLines[1])) {
  console.error('Missing header in HISTORY.md')
  process.exit(1)
}

if (!VERSION_PLACEHOLDER_REGEXP.test(historyFileLines[0])) {
  console.error('Missing placegolder version in HISTORY.md')
  process.exit(1)
}

if (historyFileLines[0].indexOf('x') !== -1) {
  var versionCheckRegExp = new RegExp('^' + historyFileLines[0].replace('x', '.+') + '$')

  if (!versionCheckRegExp.test(VERSION)) {
    console.error('Version %s does not match placeholder %s', VERSION, historyFileLines[0])
    process.exit(1)
  }
}

historyFileLines[0] = VERSION + ' / ' + getLocaleDate()
historyFileLines[1] = repeat('=', historyFileLines[0].length)

fs.writeFileSync(HISTORY_FILE_PATH, historyFileLines.join('\n'))

function getLocaleDate () {
  var now = new Date()

  return zeroPad(now.getFullYear(), 4) + '-' +
    zeroPad(now.getMonth() + 1, 2) + '-' +
    zeroPad(now.getDate(), 2)
}

function repeat (str, length) {
  var out = ''

  for (var i = 0; i < length; i++) {
    out += str
  }

  return out
}

function zeroPad (number, length) {
  var num = number.toString()

  while (num.length < length) {
    num = '0' + num
  }

  return num
}
