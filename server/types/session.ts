import type { Request } from "express";
import type { Session } from "express-session";
import type { User } from "@shared/schema";

// Extend the express-session module to include our custom session data
declare module "express-session" {
  interface SessionData {
    admin?: {
      id: string;
      username: string;
      role: string;
      loginTime: number;
    };
    isAuthenticated?: boolean;
  }
}

// Request interface with session typing
export interface AuthenticatedRequest extends Request {
  session: Session & {
    admin?: {
      id: string;
      username: string;
      role: string;
      loginTime: number;
    };
    isAuthenticated?: boolean;
  };
  adminUser?: {
    id: string;
    username: string;
    role: string;
    loginTime: number;
  };
}

export interface AdminSessionData {
  id: string;
  username: string;
  role: string;
  loginTime: number;
}