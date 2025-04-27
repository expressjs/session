/*!
 * Connect - session - Cookie
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */
'use strict';
/**
 * Module dependencies.
 */
const cookie = require('cookie');
const deprecate = require('depd')('express-session');
/**
 * @import { CookieOptions } from "./cookie.types"
 */
/**
 * @implements {CookieOptions}
 */
class Cookie {
  /** @private @type {Date | undefined} */
  _expires;
  /** @type {number | undefined} - Returns the original `maxAge` (time-to-live), in milliseconds, of the session cookie. */
  originalMaxAge;
  /** @type {CookieOptions['signed']} */
  signed;
  /** @type {CookieOptions['httpOnly']} */
  httpOnly;
  /** @type {CookieOptions['path']} */
  path;
  /** @type {CookieOptions['domain']} */
  domain;
  /** @type {CookieOptions['secure']} */
  secure;
  /** @type {CookieOptions['sameSite']} */
  sameSite;
  /**
   * Initialize a new `Cookie` with the given `options`.
   *
   * @param {CookieOptions} options
   */
  constructor(options) {
    this.path = '/';
    this.maxAge = undefined;
    this.httpOnly = true;
    if (options) {
      if (typeof options !== 'object') {
        throw new TypeError('argument options must be a object');
      }
      /** @type {{[x: string]: any}} */
      const thisAsObject = this;
      /** @type {{[x: string]: any}} */
      const optionsAsObject = options;
      for (var key in optionsAsObject) {
        if (key !== 'data') {
          thisAsObject[key] = optionsAsObject[key];
        }
      }
    }
    if (this.originalMaxAge === undefined || this.originalMaxAge === null) {
      this.originalMaxAge = this.maxAge;
    }
  }
  /**
   * Set expires `date`.
   *
   * @param {Date | undefined} date
   * @public
   */
  set expires(date) {
    /* @type {Date | undefined} */
    this._expires = date;
    /* @type {number | undefined} */
    this.originalMaxAge = this.maxAge;
  }
  /**
   * Get expires `date`.
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
   * @param {Number | Date | undefined} ms
   * @public
   */
  set maxAge(ms) {
    if (ms && typeof ms !== 'number' && !(ms instanceof Date)) {
      throw new TypeError('maxAge must be a number or Date');
    }
    if (ms instanceof Date) {
      deprecate('maxAge as Date; pass number of milliseconds instead');
    }
    this.expires = typeof ms === 'number'
      ? new Date(Date.now() + ms)
      : ms;
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
   * @this {Cookie & CookieOptions}
   * @return {Object}
   * @public
   */
  get data() {
    return {
      originalMaxAge: this.originalMaxAge,
      partitioned: this.partitioned,
      priority: this.priority,
      expires: this._expires,
      secure: this.secure,
      httpOnly: this.httpOnly,
      domain: this.domain,
      path: this.path,
      sameSite: this.sameSite
    };
  }
  /**
   * Return a serialized cookie string.
   *
   * @param {string} name
   * @param {string} val
   * @return {string}
   * @public
   */
  serialize(name, val) {
    return cookie.serialize(name, val, this.data);
  }
  /**
   * Return JSON representation of this cookie.
   *
   * @return {Object}
   * @private
   */
  toJSON() {
    return this.data;
  }
}
module.exports = {
  Cookie,
};
