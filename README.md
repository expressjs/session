# express-session

对express-session功能增强。可同时设置两个 `Set-cookie` 

## 设置一个

同 [github](https://github.com/expressjs/session)
## 设置两个

两个 Cookie 都用于记录同一个sid，但一个设置为 SameSite: None; Secure，另外一个使用默认值。
然后在处理 Session 时，兼容这两种 Cookie

```javascript
const session = require('express-session-pro');

app.use(session(
  {
    secret: 'keyboard cat',
    name: 'first',
    cookie: {maxAge: 60000}
  },
  {
    secure: 'Secure',
    httpOnly: false,
    sameSite: 'None',
  }
  ));
```