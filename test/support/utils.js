'use strict'

module.exports.parseSetCookie = parseSetCookie
module.exports.writePatch = writePatch
module.exports.getNodeVersion = getNodeVersion

function parseSetCookie (header) {
  var match
  var pairs = []
  var pattern = /\s*([^=;]+)(?:=([^;]*);?|;|$)/g

  while ((match = pattern.exec(header))) {
    pairs.push({ name: match[1], value: match[2] })
  }

  var cookie = pairs.shift()

  for (var i = 0; i < pairs.length; i++) {
    match = pairs[i]
    cookie[match.name.toLowerCase()] = (match.value || true)
  }

  return cookie
}

function writePatch (res) {
  var _end = res.end
  var _write = res.write
  var ended = false

  res.end = function end () {
    ended = true
    return _end.apply(this, arguments)
  }

  res.write = function write () {
    if (ended) {
      throw new Error('write after end')
    }

    return _write.apply(this, arguments)
  }
}

function getNodeVersion () {
  var nodeVersionStrings = process.versions.node.split('.');
  var nodeVersion = {
    major: Number(nodeVersionStrings[0]),
    minor: Number(nodeVersionStrings[1]),
    patch: Number(nodeVersionStrings[2])
  }

  return nodeVersion;
}
