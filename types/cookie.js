/*!
 * Connect - session - Cookie
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */
'use strict';
/**
 * @import { CookieSerializeOptions } from "cookie"
 * @import { CookieOptions } from "./cookie-options"
 */
/**
 * Cookie TODO: add description
 * @class
 * @implements CookieOptions
 */
class Cookie {
  /** @type {Date | undefined} @private */
  _expires;
  /** @type {number | undefined} */
  originalMaxAge;
  /** @type {boolean | undefined} */
  partitioned;
  /** @type { "low" | "medium" | "high" | undefined} */
  priority;
  /** @type {boolean | undefined} */
  signed; // FIXME: how this is used??
  /** @type {boolean} */
  httpOnly;
  /** @type {string} */
  path;
  /** @type {string | undefined} */
  domain;
  /** @type {boolean | "auto" | undefined} */
  secure;
  /** @type {((val: string) => string) | undefined} */
  encode;
  /** @type {boolean | "lax" | "strict" | "none" | undefined} */
  sameSite;
  /**
   * Initialize a new `Cookie` with the given `options`.
   * @param {CookieOptions} options
   * @private
   */
  constructor(options) {
    if (options) {
      if (typeof options !== 'object') {
        throw new TypeError('argument options must be a object');
      }
      console.log(`CookieOptions: ${JSON.stringify(options)}`);
      this.maxAge = options.maxAge;
      this.originalMaxAge ??= options.maxAge; // FIXME: rethink this
      this.partitioned = options.partitioned;
      this.priority = options.priority;
      this.secure = options.secure;
      this.httpOnly = options.httpOnly ?? true;
      this.domain = options.domain;
      this.path = options.path || '/';
      this.sameSite = options.sameSite;
      this.signed = options.signed; // FIXME: how this is used??
      this.encode = options.encode; // FIXME: is this used / real ??
    }
    else {
      this.path = '/';
      this.httpOnly = true;
    }
  }
  /**
   * Initialize a new `Cookie` using stored cookie data.
   * @param {CookieOptions & {expires?: string, originalMaxAge?: number}} data
   * @returns {Cookie}
   * @protected
   */
  static fromJSON(data) {
    console.log(`Cookie.fromJSON: ${JSON.stringify(data)}`);
    const { expires, originalMaxAge, ...options } = data;
    const cookie = new Cookie(options);
    cookie.expires = expires ? new Date(expires) : undefined;
    cookie.originalMaxAge = originalMaxAge;
    return cookie;
  }
  /**
   * Set expires `date`.
   *
   * @param {Date | null | undefined} date
   * @public
   */
  set expires(date) {
    this._expires = date || undefined;
    this.originalMaxAge = this.maxAge;
  }
  /**
   * Get expires `Date` object to be the value for the `Expires Set-Cookie` attribute.
   * By default, no expiration is set, and most clients will consider this a "non-persistent cookie" and will delete it on a condition like exiting a web browser application.
   *
   * @return {Date | undefined}
   * @public
   */
  get expires() {
    return this._expires;
  }
  /**
   * Set expires via max-age in `ms`.
   *
   * @param {number | undefined} ms
   * @public
   */
  set maxAge(ms) {
    if (ms !== undefined) {
      if (typeof ms !== 'number') {
        throw new TypeError('maxAge must be a number');
      }
      this.expires = new Date(Date.now() + ms);
    }
    else {
      this.expires = undefined;
    }
  }
  /**
   * Get expires max-age in `ms`.
   *
   * @return {number | undefined}
   * @public
   */
  get maxAge() {
    return this.expires instanceof Date
      ? this.expires.valueOf() - Date.now()
      : this.expires;
  }
  /**
   * Return cookie data object.
   *
   * @return {CookieSerializeOptions}
   * @private
   */
  get data() {
    if (this.secure === 'auto') {
      throw new Error("Invalid runtime state, the Cookie.secure == 'auto', which should not be possible.");
    }
    return {
      partitioned: this.partitioned,
      priority: this.priority,
      expires: this.expires,
      secure: this.secure,
      httpOnly: this.httpOnly,
      domain: this.domain,
      path: this.path,
      sameSite: this.sameSite
    };
  }
  /**
   * Return JSON representation of this cookie.
   *
   * Used by `JSON.stringify`
   *
   * @returns {Object}
   * @protected
   */
  toJSON() {
    const data = {
      ...this.data,
      expires: this.expires,
      originalMaxAge: this.originalMaxAge,
    };
    console.log(`Cookie.toJSON: ${JSON.stringify(data)}`);
    return data;
  }
}
module.exports = Cookie;
