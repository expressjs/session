/**
 * @import { CookieOptions } from "./cookie.types"
 */
/**
 * @implements {CookieOptions}
 */
export class Cookie implements CookieOptions {
  /**
   * Initialize a new `Cookie` with the given `options`.
   *
   * @param {CookieOptions} options
   */
  constructor(options: CookieOptions);
  /** @private @type {Date | undefined} */
  private _expires;
  /** @type {number | undefined} - Returns the original `maxAge` (time-to-live), in milliseconds, of the session cookie. */
  originalMaxAge: number | undefined;
  /** @type {CookieOptions['signed']} */
  signed: CookieOptions["signed"];
  /** @type {CookieOptions['httpOnly']} */
  httpOnly: CookieOptions["httpOnly"];
  /** @type {CookieOptions['path']} */
  path: CookieOptions["path"];
  /** @type {CookieOptions['domain']} */
  domain: CookieOptions["domain"];
  /** @type {CookieOptions['secure']} */
  secure: CookieOptions["secure"];
  /** @type {CookieOptions['sameSite']} */
  sameSite: CookieOptions["sameSite"];
  /**
   * Set expires via max-age in `ms`.
   *
   * @param {Number | Date | undefined} ms
   * @public
   */
  public set maxAge(ms: number | Date | undefined);
  /**
   * Get expires max-age in `ms`.
   *
   * @return {number | undefined}
   * @public
   */
  public get maxAge(): number | undefined;
  /**
   * Set expires `date`.
   *
   * @param {Date | undefined} date
   * @public
   */
  public set expires(date: Date | undefined);
  /**
   * Get expires `date`.
   *
   * @return {Date | undefined}
   * @public
   */
  public get expires(): Date | undefined;
  /**
   * Return cookie data object.
   *
   * @this {Cookie & CookieOptions}
   * @return {Object}
   * @public
   */
  public get data(): Object;
  /**
   * Return a serialized cookie string.
   *
   * @param {string} name
   * @param {string} val
   * @return {string}
   * @public
   */
  public serialize(name: string, val: string): string;
  /**
   * Return JSON representation of this cookie.
   *
   * @return {Object}
   * @private
   */
  private toJSON;
}
import type { CookieOptions } from "./cookie.types";
