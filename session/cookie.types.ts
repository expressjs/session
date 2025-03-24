export interface CookieOptions {
  /**
   * Specifies the number (in milliseconds) to use when calculating the `Expires Set-Cookie` attribute.
   * This is done by taking the current server time and adding `maxAge` milliseconds to the value to calculate an `Expires` datetime. By default, no maximum age is set.
   *
   * If both `expires` and `maxAge` are set in the options, then the last one defined in the object is what is used.
   * `maxAge` should be preferred over `expires`.
   *
   * @see expires
   */
  maxAge?: number | undefined;

  /**
   * Specifies the `boolean` value for the [`Partitioned` `Set-Cookie`](https://tools.ietf.org/html/draft-cutler-httpbis-partitioned-cookies/)
   * attribute. When truthy, the `Partitioned` attribute is set, otherwise it is not.
   * By default, the `Partitioned` attribute is not set.
   *
   * **Note** This is an attribute that has not yet been fully standardized, and may
   * change in the future. This also means many clients may ignore this attribute until
   * they understand it.
   */
  partitioned?: boolean | undefined;

  /**
   * Specifies the `string` to be the value for the [`Priority` `Set-Cookie` attribute](https://tools.ietf.org/html/draft-west-cookie-priority-00#section-4.1).
   *
   * - `'low'` will set the `Priority` attribute to `Low`.
   * - `'medium'` will set the `Priority` attribute to `Medium`, the default priority when not set.
   * - `'high'` will set the `Priority` attribute to `High`.
   *
   * More information about the different priority levels can be found in
   * [the specification](https://tools.ietf.org/html/draft-west-cookie-priority-00#section-4.1).
   *
   * **Note** This is an attribute that has not yet been fully standardized, and may change in the future.
   * This also means many clients may ignore this attribute until they understand it.
   */
  priority?: "low" | "medium" | "high" | undefined;

  signed?: boolean | undefined;

  /**
   * Specifies the `Date` object to be the value for the `Expires Set-Cookie` attribute.
   * By default, no expiration is set, and most clients will consider this a "non-persistent cookie" and will delete it on a condition like exiting a web browser application.
   *
   * If both `expires` and `maxAge` are set in the options, then the last one defined in the object is what is used.
   *
   * @deprecated The `expires` option should not be set directly; instead only use the `maxAge` option
   * @see maxAge
   */
  expires?: Date | null | undefined;

  /**
   * Specifies the boolean value for the `HttpOnly Set-Cookie` attribute. When truthy, the `HttpOnly` attribute is set, otherwise it is not.
   * By default, the `HttpOnly` attribute is set.
   *
   * Be careful when setting this to `true`, as compliant clients will not allow client-side JavaScript to see the cookie in `document.cookie`.
   */
  httpOnly?: boolean | undefined;

  /**
   * Specifies the value for the `Path Set-Cookie` attribute.
   * By default, this is set to '/', which is the root path of the domain.
   */
  path?: string | undefined;

  /**
   * Specifies the value for the `Domain Set-Cookie` attribute.
   * By default, no domain is set, and most clients will consider the cookie to apply to only the current domain.
   */
  domain?: string | undefined;

  /**
   * Specifies the boolean value for the `Secure Set-Cookie` attribute. When truthy, the `Secure` attribute is set, otherwise it is not. By default, the `Secure` attribute is not set.
   * Be careful when setting this to true, as compliant clients will not send the cookie back to the server in the future if the browser does not have an HTTPS connection.
   *
   * Please note that `secure: true` is a **recommended option**.
   * However, it requires an https-enabled website, i.e., HTTPS is necessary for secure cookies.
   * If `secure` is set, and you access your site over HTTP, **the cookie will not be set**.
   *
   * The cookie.secure option can also be set to the special value `auto` to have this setting automatically match the determined security of the connection.
   * Be careful when using this setting if the site is available both as HTTP and HTTPS, as once the cookie is set on HTTPS, it will no longer be visible over HTTP.
   * This is useful when the Express "trust proxy" setting is properly setup to simplify development vs production configuration.
   *
   * If you have your node.js behind a proxy and are using `secure: true`, you need to set "trust proxy" in express. Please see the [README](https://github.com/expressjs/session) for details.
   *
   * Please see the [README](https://github.com/expressjs/session) for an example of using secure cookies in production, but allowing for testing in development based on NODE_ENV.
   */
  secure?: boolean | "auto" | undefined;

  encode?: ((val: string) => string) | undefined;

  /**
   * Specifies the boolean or string to be the value for the `SameSite Set-Cookie` attribute.
   * - `true` will set the `SameSite` attribute to `Strict` for strict same site enforcement.
   * - `false` will not set the `SameSite` attribute.
   * - `lax` will set the `SameSite` attribute to `Lax` for lax same site enforcement.
   * - `none` will set the `SameSite` attribute to `None` for an explicit cross-site cookie.
   * - `strict` will set the `SameSite` attribute to `Strict` for strict same site enforcement.
   *
   * More information about the different enforcement levels can be found in the specification.
   *
   * **Note:** This is an attribute that has not yet been fully standardized, and may change in the future.
   * This also means many clients may ignore this attribute until they understand it.
   */
  sameSite?: boolean | "lax" | "strict" | "none" | undefined;
}
