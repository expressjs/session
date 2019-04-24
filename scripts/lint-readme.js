var assert = require('assert')
var fs = require('fs')
var path = require('path')

var BADGE_STAR_LINK_REGEXP = /^https:\/\/badgen.net\/github\/stars\/[^/]+\/[^/]+?label=%E2%98%85$/
var MARKDOWN_LINK_REGEXP = /^\[([^ \]]+)\]: ([^ ]+)$/
var MARKDOWN_SECTION_REGEXP = /^#+ (.+)$/
var NEWLINE_REGEXP = /\r?\n/
var README_PATH = path.join(__dirname, '..', 'README.md')
var README_CONTENTS = fs.readFileSync(README_PATH, 'utf-8')
var STORE_HEADER_REGEXP = /^\[!\[★\]\[([^ \]]+)\] ([^ \]]+)\]\[([^ \]]+)\](?: .+)?$/

var header = null
var lintedStores = false
var section = null
var state = 0

README_CONTENTS.split(NEWLINE_REGEXP).forEach(function (line, lineidx) {
  section = (MARKDOWN_SECTION_REGEXP.exec(line) || [])[1] || section

  if (section === 'Compatible Session Stores') {
    lintedStores = true

    switch (state) {
      case 0: // premble
        if (line[0] !== '[') break
        state = 1
      case 1: // header
        var prev = header

        if (!(header = STORE_HEADER_REGEXP.exec(line))) {
          expect(lineidx, 'session store header', line)
        } else if (prev && prev[2].replace(/^[^/]+\//, '').localeCompare(header[2].replace(/^[^/]+\//, '')) > 0) {
          expect(lineidx, (header[2] + ' to be alphabetically after ' + prev[2]), line)
          state = 2
        } else {
          state = 2
        }

        break
      case 2: // blank line
        if (line && MARKDOWN_LINK_REGEXP.test(line)) {
          expect(lineidx, 'blank line or wrapped description', line)
        } else if (line === '') {
          state = 3
        }
        break
      case 3: // url link
        var urlLink = MARKDOWN_LINK_REGEXP.exec(line)

        if (!urlLink) {
          expect(lineidx, 'link reference', line)
        } else if (urlLink[1] !== header[3]) {
          expect(lineidx, ('link name of ' + header[3]), line)
        } else if (urlLink[2] !== ('https://www.npmjs.com/package/' + header[2])) {
          expect(lineidx, ('link url of https://www.npmjs.com/package/' + header[2]), line)
        } else {
          state = 4
        }

        break
      case 4: // image link
        var imageLink = MARKDOWN_LINK_REGEXP.exec(line)

        if (!imageLink) {
          expect(lineidx, 'link reference', line)
        } else if (imageLink[1] !== header[1]) {
          expect(lineidx, ('link name of ' + header[1]), line)
        } else if (!BADGE_STAR_LINK_REGEXP.test(imageLink[2])) {
          expect(lineidx, ('link url to github stars badge'), line)
        } else {
          state = 5
        }

        break
      case 5: // blank line
        if (line !== '') {
          expect(lineidx, 'blank line after links', line)
        } else {
          state = 1
        }
        break
    }
  }
})

assert.ok(lintedStores, 'Compatible Session Stores section linted')

function expect (lineidx, message, line) {
  console.log('Expected %s on line %d', message, (lineidx + 1))
  console.log('  Got: %s', line)
  process.exitCode = 1
}
