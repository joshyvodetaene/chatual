import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/session";
import { storage } from "../storage";

/**
 * Middleware to verify admin authentication via session
 * Replaces the insecure header-based authentication
 */
export const requireAdminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Check if session exists and has admin data
    if (!authReq.session?.admin || !authReq.session?.isAuthenticated) {
      console.log('[ADMIN_AUTH] No valid admin session found');
      return res.status(401).json({ 
        error: 'Admin authentication required',
        code: 'NO_SESSION'
      });
    }

    const { admin } = authReq.session;
    
    // Verify session hasn't expired (additional check beyond cookie expiry)
    const sessionAge = Date.now() - admin.loginTime;
    const MAX_SESSION_AGE = 1000 * 60 * 60 * 2; // 2 hours
    
    if (sessionAge > MAX_SESSION_AGE) {
      console.log('[ADMIN_AUTH] Admin session expired');
      // Clear expired session
      authReq.session.admin = undefined;
      authReq.session.isAuthenticated = false;
      return res.status(401).json({ 
        error: 'Session expired',
        code: 'SESSION_EXPIRED'
      });
    }

    // Verify admin still exists in adminUsers table
    const { adminUsers } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const [adminUser] = await storage.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, admin.id));
      
    if (!adminUser) {
      console.log('[ADMIN_AUTH] Admin user not found in database');
      // Clear invalid session
      authReq.session.admin = undefined;
      authReq.session.isAuthenticated = false;
      return res.status(401).json({ 
        error: 'Admin user not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!adminUser.isActive) {
      console.log('[ADMIN_AUTH] Admin user is not active');
      // Clear invalid session
      authReq.session.admin = undefined;
      authReq.session.isAuthenticated = false;
      return res.status(403).json({ 
        error: 'Admin account is disabled',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Update session with fresh data if needed
    if (authReq.session.admin.username !== adminUser.username) {
      authReq.session.admin.username = adminUser.username;
    }

    // Attach admin user to request for use in route handlers
    (authReq as any).adminUser = adminUser;
    
    console.log(`[ADMIN_AUTH] Admin authentication successful for: ${admin.username} (${admin.id})`);
    next();
  } catch (error) {
    console.error('[ADMIN_AUTH] Authentication middleware error:', error);
    res.status(500).json({ 
      error: 'Authentication verification failed',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Optional middleware to check admin auth without requiring it
 * Sets req.adminUser if authenticated, but doesn't block the request
 */
export const optionalAdminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    if (authReq.session?.admin && authReq.session?.isAuthenticated) {
      const adminUser = await storage.getUser(authReq.session.admin.id);
      if (adminUser && adminUser.role === 'admin' && !adminUser.isBanned) {
        (authReq as any).adminUser = adminUser;
      }
    }
    
    next();
  } catch (error) {
    console.error('[ADMIN_AUTH] Optional auth middleware error:', error);
    // Don't block request on optional auth errors
    next();
  }
};