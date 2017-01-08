# express-session-ext

## Installation

This is a [Node.js](https://nodejs.org/en/) module available through the
[npm registry](https://www.npmjs.com/). Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```bash
$ npm install express-session-ext
```

## API

```js
var session = require('express-session-ext')
```


#### touchException
Allow user to set some special urls which be requested would not invoke .touch() function.
This means requesting those urls would not extend session expiry date.

touchException:['/example/test']
