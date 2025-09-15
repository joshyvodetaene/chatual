import type { User } from "@shared/schema";
import type { Request } from "express";

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
  session: Express.Session & {
    admin?: {
      id: string;
      username: string;
      role: string;
      loginTime: number;
    };
    isAuthenticated?: boolean;
  };
}

export interface AdminSessionData {
  id: string;
  username: string;
  role: string;
  loginTime: number;
}