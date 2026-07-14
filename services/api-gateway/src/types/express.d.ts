import type { AuthenticatedUser } from "../auth/types.js";

export {};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
