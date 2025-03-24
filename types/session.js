/*!
 * Connect - session - Session
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */
'use strict';
// FIXME: ES5-style classes no support for @implements or @augments https://github.com/microsoft/TypeScript/issues/38985
// FIXME: ES5-style classes no support for @extends https://github.com/microsoft/TypeScript/issues/36369
/**
 * @import { Request } from "./request.types"
 * @import { SessionData } from "./session.types"
 * @typedef {Request['sessionStore']} SessionStore
 */
/**
 * Create a new `Session` with the given request and `data`.
 */
class Session {
  /**
   * @type {Request}
   */
  // @ts-ignore
  #req;
  /**
   * The request sessionID at the time of Session construction, i.e., req.sessionID.
   * @type {string}
   */
  // @ts-ignore
  #id;
  /**
   * Each session has a unique ID associated with it.
   * This property is an alias of `req.sessionID` and cannot be modified.
   * It has been added to make the session ID accessible from the session object.
   * @returns {string}
   * @public
   */
  get id() {
    return this.#id;
  }
  /**
   * Create a new `Session` with the given request and `data`.
   *
   * @constructor
   * @param {Request} req
   * @param {Partial<SessionData>} data
   */
  constructor(req, data) {
    this.#req = req;
    this.#id = req.sessionID;
    if (typeof data === 'object' && data !== null) {
      /** @type {{[x: string]: any}} */
      const thisAsObject = this;
      /** @type {{[x: string]: any}} */
      const dataAsObject = data;
      // merge data into this, ignoring prototype properties
      for (var prop in dataAsObject) {
        if (!(prop in thisAsObject)) {
          console.log(`thisAsObject[${prop}] = dataAsObject[${prop}]: ${typeof dataAsObject[prop]}`);
          thisAsObject[prop] = dataAsObject[prop];
        }
      }
    }
  }
  /**
   * Update reset `.cookie.maxAge` to prevent
   * the cookie from expiring when the
   * session is still active.
   *
   * @return {Session} for chaining
   * @public
   */
  touch() {
    return this.resetMaxAge();
  }
  /**
   * Reset `.maxAge` to `.originalMaxAge`.
   *
   * @this {Session & Partial<SessionData>}
   * @return {Session} for chaining
   * @public
   */
  resetMaxAge() {
    if (this.cookie) {
      this.cookie.maxAge = this.cookie.originalMaxAge;
    }
    return this;
  }
  /**
   * Save the session data with optional callback `fn(err)`.
   *
   * @param {(err?: any) => void} fn
   * @return {Session} for chaining
   * @public
   */
  save(fn) {
    const sessionData = /** @type {SessionData} */ ( /** @type {any} */(this));
    this.#req.sessionStore.set(this.id, sessionData, fn || function() { });
    return this;
  }
  /**
   * Re-loads the session data _without_ altering
   * the maxAge properties. Invokes the callback `fn(err)`,
   * after which time if no exception has occurred the
   * `req.session` property will be a new `Session` object,
   * although representing the same session.
   *
   * @param {(err?: any) => void} fn
   * @return {Session} for chaining
   * @public
   */
  reload(fn) {
    const req = this.#req;
    const store = this.#req.sessionStore;
    store.get(this.id,
      /**
       * @param {any|undefined} err
       * @param {SessionData|null|undefined} sess
       */
      function(err, sess) {
        if (err)
          return fn(err);
        if (!sess)
          return fn(new Error('failed to load session'));
        store.createSession(req, sess);
        fn();
      });
    return this;
  }
  /**
   * Destroy `this` session.
   *
   * @param {(err?: any) => void} fn
   * @returns {Session} for chaining
   * @public
   */
  destroy(fn) {
    delete ( /** @type {{session?: Session}} */( /** @type {any} */this.#req)).session;
    this.#req.sessionStore.destroy(this.id, fn);
    return this;
  }
  /**
   * Regenerate this request's session.
   *
   * @param {(err?: any) => void} fn
   * @returns {Session} for chaining
   * @public
   */
  regenerate(fn) {
    this.#req.sessionStore.regenerate(this.#req, fn);
    return this;
  }
}
/**
 * Expose Session.
 */
module.exports = {
  Session,
};
