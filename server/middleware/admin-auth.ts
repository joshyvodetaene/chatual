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

    // Verify admin still exists and has admin role (but use correct table - users, not adminUsers)
    // Use cached validation to balance security and performance
    const now = Date.now();
    const VALIDATION_TTL = 5 * 60 * 1000; // 5 minutes
    const lastValidated = authReq.session.adminLastValidated || 0;
    
    if (now - lastValidated > VALIDATION_TTL) {
      try {
        // Verify against the users table (not adminUsers) where role="admin"
        const adminUser = await storage.getUser(admin.id);
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

        if (adminUser.role !== 'admin') {
          console.log('[ADMIN_AUTH] User no longer has admin role');
          // Clear invalid session
          authReq.session.admin = undefined;
          authReq.session.isAuthenticated = false;
          return res.status(403).json({ 
            error: 'Admin privileges required',
            code: 'INSUFFICIENT_PRIVILEGES'
          });
        }

        if (adminUser.isBanned) {
          console.log('[ADMIN_AUTH] Admin user is banned');
          // Clear invalid session
          authReq.session.admin = undefined;
          authReq.session.isAuthenticated = false;
          return res.status(403).json({ 
            error: 'Account is banned',
            code: 'ACCOUNT_BANNED'
          });
        }
        
        // Update session with fresh data and validation timestamp
        authReq.session.adminLastValidated = now;
        if (authReq.session.admin.username !== adminUser.username) {
          authReq.session.admin.username = adminUser.username;
        }
        
        // Attach verified admin user to request
        (authReq as any).adminUser = adminUser;
      } catch (error) {
        console.error('[ADMIN_AUTH] Admin validation error:', error);
        return res.status(500).json({ 
          error: 'Authentication verification failed',
          code: 'AUTH_ERROR'
        });
      }
    } else {
      // Use cached validation - attach session admin data
      (authReq as any).adminUser = admin;
    }
    
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