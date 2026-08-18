import type { RequestUser } from '../auth/auth.types.js';

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      id: string;
    }
  }
}

export {};
