export = Cookie;
/**
 * @import { CookieSerializeOptions } from "cookie"
 * @import { CookieOptions } from "./cookie-options"
 */
/**
 * Cookie TODO: add description
 * @class
 * @implements CookieOptions
 */
declare class Cookie implements CookieOptions {
    /**
     * Initialize a new `Cookie` using stored cookie data.
     * @param {CookieOptions & {expires?: string, originalMaxAge?: number}} data
     * @returns {Cookie}
     * @protected
     */
    protected static fromJSON(data: CookieOptions & {
        expires?: string;
        originalMaxAge?: number;
    }): Cookie;
    /**
     * Initialize a new `Cookie` with the given `options`.
     * @param {CookieOptions} options
     * @private
     */
    private constructor();
    /** @type {Date | undefined} @private */
    private _expires;
    /** @type {number | undefined} */
    originalMaxAge: number | undefined;
    /** @type {boolean | undefined} */
    partitioned: boolean | undefined;
    /** @type { "low" | "medium" | "high" | undefined} */
    priority: "low" | "medium" | "high" | undefined;
    /** @type {boolean | undefined} */
    signed: boolean | undefined;
    /** @type {boolean} */
    httpOnly: boolean;
    /** @type {string} */
    path: string;
    /** @type {string | undefined} */
    domain: string | undefined;
    /** @type {boolean | "auto" | undefined} */
    secure: boolean | "auto" | undefined;
    /** @type {((val: string) => string) | undefined} */
    encode: ((val: string) => string) | undefined;
    /** @type {boolean | "lax" | "strict" | "none" | undefined} */
    sameSite: boolean | "lax" | "strict" | "none" | undefined;
    /**
     * Set expires via max-age in `ms`.
     *
     * @param {number | undefined} ms
     * @public
     */
    public set maxAge(ms: number | undefined);
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
     * @param {Date | null | undefined} date
     * @public
     */
    public set expires(date: Date | null | undefined);
    /**
     * Get expires `Date` object to be the value for the `Expires Set-Cookie` attribute.
     * By default, no expiration is set, and most clients will consider this a "non-persistent cookie" and will delete it on a condition like exiting a web browser application.
     *
     * @return {Date | undefined}
     * @public
     */
    public get expires(): Date | undefined;
    /**
     * Return cookie data object.
     *
     * @return {CookieSerializeOptions}
     * @private
     */
    private get data();
    /**
     * Return JSON representation of this cookie.
     *
     * Used by `JSON.stringify`
     *
     * @returns {Object}
     * @protected
     */
    protected toJSON(): Object;
}
import type { CookieOptions } from "./cookie-options";
