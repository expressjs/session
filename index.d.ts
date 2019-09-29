// Definitions by: HoldYourWaffle <https://github.com/HoldYourWaffle>

import express from 'express'
import node from 'events'



declare global {
  namespace Express {
    interface Request { //inject additional properties on express.Request
      session: Session;
      sessionID: string;
    }
  }

  export interface SessionData {
    //seperate interface to allow application-specific declaration merging (see README)
  }
}



export default function session(options?: SessionOptions): express.RequestHandler;


interface CookieOptions {
  maxAge?: number;
  signed?: boolean;
  expires?: Date;
  httpOnly?: boolean;
  path?: string;
  domain?: string;
  secure?: boolean | 'auto';
  sameSite?: boolean | string;
}

export class Cookie implements CookieOptions {
  originalMaxAge: number;

  maxAge?: number;
  signed?: boolean;
  expires?: Date;
  httpOnly?: boolean;
  path?: string;
  domain?: string;
  secure?: boolean | 'auto';
  sameSite?: boolean | string;
}



interface SessionOptions {
  secret: string | string[];

  genid?(req: express.Request): string;
  name?: string;
  store?: Store;
  cookie?: CookieOptions;
  rolling?: boolean;
  resave?: boolean;
  proxy?: boolean;
  saveUninitialized?: boolean;
  unset?: string;
}

interface Session extends SessionData {
  id: string;
  cookie: Cookie;

  regenerate(callback: (err: any) => void): Session;
  destroy(callback: (err: any) => void): Session;
  reload(callback: (err: any) => void): Session;
  save(callback?: (err: any) => void): Session;
  touch(): Session;
}



export abstract class Store extends node.EventEmitter {
  regenerate(req: express.Request, callback: (err?: any) => any): void
  load(sid: string, callback: (err: any, session?: SessionData) => any): void
  createSession(req: express.Request, session: SessionData): void

  abstract get(sid: string, callback: (err: any, session?: SessionData | null) => void): void
  abstract set(sid: string, session: SessionData, callback?: (err?: any) => void): void
  abstract destroy(sid: string, callback?: (err?: any) => void): void

  all?(callback: (err: any, obj?: { [sid: string]: SessionData; } | null) => void): void
  length?(callback: (err: any, length: number) => void): void
  clear?(callback?: (err?: any) => void): void
  touch?(sid: string, session: SessionData, callback?: () => void): void
}

export class MemoryStore extends Store {
  get(sid: string, callback: (err: any, session?: SessionData | null) => void): void
  set(sid: string, session: SessionData, callback?: (err?: any) => void): void
  destroy(sid: string, callback?: (err?: any) => void): void

  all(callback: (err: any, obj?: { [sid: string]: SessionData; } | null) => void): void
  length(callback: (err: any, length: number) => void): void
  clear(callback?: (err?: any) => void): void
  touch(sid: string, session: SessionData, callback?: () => void): void
}
