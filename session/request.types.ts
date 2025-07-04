import type { SessionData } from "./session.types"
import type { Store } from "./store"
import type { Session } from "./session"

declare global {
  namespace Express {
    type SessionStore = Store & { generate: (req: Request) => void };

    // Inject additional properties on express.Request
    interface Request {
      /**
       * This request's `Session` object.
       * Even though this property isn't marked as optional, it won't exist until you use the `express-session` middleware
       * [Declaration merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html) can be used to add your own properties.
       *
       * @see SessionData
       */
      session: Session & Partial<SessionData>;

      /**
       * This request's session ID.
       * Even though this property isn't marked as optional, it won't exist until you use the `express-session` middleware
       */
      sessionID: string;

      /**
       * The Store in use.
       * Even though this property isn't marked as optional, it won't exist until you use the `express-session` middleware
       * The function `generate` is added by express-session
       */
      sessionStore: SessionStore;
    }
  }
}

export type Request = Express.Request
