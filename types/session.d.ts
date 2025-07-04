export type SessionStore = Request["sessionStore"];
/**
 * @import { Request } from "./request.types"
 * @import { SessionData } from "./session.types"
 * @typedef {Request['sessionStore']} SessionStore
 */
/**
 * Create a new `Session` with the given request and `data`.
 */
export class Session {
  /**
   * Create a new `Session` with the given request and `data`.
   *
   * @constructor
   * @param {Request} req
   * @param {Partial<SessionData>} data
   */
  constructor(req: Request, data: Partial<SessionData>);
  /**
   * Each session has a unique ID associated with it.
   * This property is an alias of `req.sessionID` and cannot be modified.
   * It has been added to make the session ID accessible from the session object.
   * @returns {string}
   * @public
   */
  public get id(): string;
  /**
   * Update reset `.cookie.maxAge` to prevent
   * the cookie from expiring when the
   * session is still active.
   *
   * @return {Session} for chaining
   * @public
   */
  public touch(): Session;
  /**
   * Reset `.maxAge` to `.originalMaxAge`.
   *
   * @this {Session & Partial<SessionData>}
   * @return {Session} for chaining
   * @public
   */
  public resetMaxAge(this: Session & Partial<SessionData>): Session;
  /**
   * Save the session data with optional callback `fn(err)`.
   *
   * @param {(err?: any) => void} fn
   * @return {Session} for chaining
   * @public
   */
  public save(fn: (err?: any) => void): Session;
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
  public reload(fn: (err?: any) => void): Session;
  /**
   * Destroy `this` session.
   *
   * @param {(err?: any) => void} fn
   * @returns {Session} for chaining
   * @public
   */
  public destroy(fn: (err?: any) => void): Session;
  /**
   * Regenerate this request's session.
   *
   * @param {(err?: any) => void} fn
   * @returns {Session} for chaining
   * @public
   */
  public regenerate(fn: (err?: any) => void): Session;
  #private;
}
import type { Request } from "./request.types";
import type { SessionData } from "./session.types";
