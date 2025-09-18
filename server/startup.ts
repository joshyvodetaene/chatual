import { DatabaseStorage } from './database-storage';

interface AdminBootstrapOptions {
  username: string;
  password: string;
  role: 'super_admin' | 'admin' | 'moderator';
}

export async function bootstrapDefaultAdmin(
  storage: DatabaseStorage, 
  options: AdminBootstrapOptions
): Promise<{ created: boolean; message: string }> {
  try {
    console.log(`[ADMIN_BOOTSTRAP] Checking for admin user: ${options.username}`);
    
    // Check if admin user already exists using direct database query
    const { adminUsers } = await import('@shared/schema');
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');
    
    const [existingAdmin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, options.username));
    
    if (existingAdmin) {
      console.log(`[ADMIN_BOOTSTRAP] Admin user '${options.username}' already exists, skipping creation`);
      return { created: false, message: `Admin user '${options.username}' already exists` };
    }

    // Create new admin user using storage method
    console.log(`[ADMIN_BOOTSTRAP] Creating new admin user: ${options.username}`);
    await storage.createAdminUser({
      username: options.username,
      password: options.password,
      role: options.role
    }, 'system-bootstrap');

    console.log(`[ADMIN_BOOTSTRAP] Successfully created admin user '${options.username}' with role ${options.role}`);
    return { created: true, message: `Admin user '${options.username}' created successfully` };

  } catch (error: any) {
    // Handle unique constraint violation (user already exists)
    if (error?.code === '23505' || error?.constraint?.includes('username')) {
      console.log(`[ADMIN_BOOTSTRAP] Admin user '${options.username}' already exists (caught constraint violation), skipping creation`);
      return { created: false, message: `Admin user '${options.username}' already exists` };
    }

    console.error(`[ADMIN_BOOTSTRAP] Failed to create admin user '${options.username}':`, error.message);
    throw error;
  }
}

export async function initializeSystemAdmins(): Promise<void> {
  try {
    console.log('[ADMIN_BOOTSTRAP] Starting system admin initialization');
    
    const storage = new DatabaseStorage();
    
    // Always create chatadmin in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[ADMIN_BOOTSTRAP] Development environment - creating default admin users');
      
      // Create chatadmin user
      await bootstrapDefaultAdmin(storage, {
        username: 'chatadmin',
        password: 'Hardcore123!',
        role: 'super_admin'
      });
      
      console.log('[ADMIN_BOOTSTRAP] Development admin initialization complete');
    } 
    // ⚠️  SECURITY RISK: Production admin creation is ENABLED by default
    // This is a KNOWN SECURITY VULNERABILITY that allows automatic creation of admin users in production
    // This poses significant security risks including:
    // - Predictable admin usernames that can be targeted by attackers
    // - Automatic privilege escalation without manual oversight
    // - Potential unauthorized administrative access if credentials are compromised
    // - Violation of security best practices for production deployments
    else {
      console.warn('🚨 [SECURITY WARNING] Production admin bootstrap is ENABLED - This is a KNOWN SECURITY RISK');
      console.warn('🚨 [SECURITY WARNING] Automatic admin creation in production violates security best practices');
      console.warn('🚨 [SECURITY WARNING] Consider disabling this feature and creating admin users manually');
      
      const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
      
      if (!bootstrapPassword || bootstrapPassword.length < 12) {
        console.error('🚨 [SECURITY ERROR] ADMIN_BOOTSTRAP_PASSWORD not set or too short (minimum 12 characters)');
        console.error('🚨 [SECURITY ERROR] Cannot create admin user without strong password - this is a critical security requirement');
        return;
      }
      
      console.warn('[ADMIN_BOOTSTRAP] ⚠️  Production environment - creating admin with provided credentials (SECURITY RISK)');
      
      await bootstrapDefaultAdmin(storage, {
        username: 'chatadmin',
        password: bootstrapPassword,
        role: 'super_admin'
      });
      
      console.warn('[ADMIN_BOOTSTRAP] ⚠️  Production admin initialization complete - SECURITY RISK ACKNOWLEDGED');
    }
    
  } catch (error) {
    console.error('[ADMIN_BOOTSTRAP] System admin initialization failed:', error);
    // Don't crash the app on bootstrap failure
  }
}