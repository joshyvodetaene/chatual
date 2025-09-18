import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/session";
import { storage } from "../storage";
import { UserRole, Permission, hasPermission, hasMinimumRole, PERMISSIONS } from '@shared/schema';

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
    const adminUser = await storage.getAdminUser(admin.id);
    if (!adminUser || !adminUser.isActive) {
      console.log('[ADMIN_AUTH] Admin user not found in database or inactive');
      // Clear invalid session
      authReq.session.admin = undefined;
      authReq.session.isAuthenticated = false;
      return res.status(401).json({ 
        error: 'Admin user not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Update session with fresh data if needed
    if (authReq.session.admin.username !== adminUser.username) {
      authReq.session.admin.username = adminUser.username;
    }

    // Attach admin user with role to request for use in route handlers
    (authReq as any).adminUser = {
      ...adminUser,
      role: adminUser.role as UserRole
    };
    
    console.log(`[ADMIN_AUTH] Admin authentication successful for: ${admin.username} (${admin.id}) with role: ${adminUser.role}`);
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
      const adminUser = await storage.getAdminUser(authReq.session.admin.id);
      if (adminUser && adminUser.isActive) {
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

/**
 * Create permission-specific middleware for RBAC enforcement
 */
export const requirePermission = (requiredPermission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      
      // First ensure admin is authenticated
      if (!authReq.adminUser || !authReq.adminUser.role) {
        console.warn(`[RBAC] Permission check failed: No authenticated admin user found`);
        return res.status(401).json({ 
          error: 'Admin authentication required for this action',
          code: 'NO_ADMIN_AUTH',
          requiredPermission
        });
      }

      const userRole = authReq.adminUser.role as UserRole;
      const hasAccess = hasPermission(userRole, requiredPermission);

      if (!hasAccess) {
        console.warn(`[RBAC] Access denied: Admin '${authReq.adminUser.username}' (role: ${userRole}) lacks permission '${requiredPermission}'`);
        return res.status(403).json({ 
          error: `Insufficient permissions. Required: ${requiredPermission}`,
          code: 'INSUFFICIENT_PERMISSIONS',
          userRole,
          requiredPermission
        });
      }

      console.log(`[RBAC] Permission granted: Admin '${authReq.adminUser.username}' (role: ${userRole}) has permission '${requiredPermission}'`);
      next();
    } catch (error) {
      console.error('[RBAC] Permission middleware error:', error);
      res.status(500).json({ 
        error: 'Permission verification failed',
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};

/**
 * Create minimum role requirement middleware
 */
export const requireMinimumRole = (minimumRole: UserRole) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      
      if (!authReq.adminUser || !authReq.adminUser.role) {
        return res.status(401).json({ 
          error: 'Admin authentication required',
          code: 'NO_ADMIN_AUTH'
        });
      }

      const userRole = authReq.adminUser.role as UserRole;
      const hasAccess = hasMinimumRole(userRole, minimumRole);

      if (!hasAccess) {
        console.warn(`[RBAC] Access denied: Admin '${authReq.adminUser.username}' (role: ${userRole}) below minimum role '${minimumRole}'`);
        return res.status(403).json({ 
          error: `Insufficient role level. Minimum required: ${minimumRole}`,
          code: 'INSUFFICIENT_ROLE',
          userRole,
          minimumRole
        });
      }

      next();
    } catch (error) {
      console.error('[RBAC] Role middleware error:', error);
      res.status(500).json({ 
        error: 'Role verification failed',
        code: 'ROLE_CHECK_ERROR'
      });
    }
  };
};