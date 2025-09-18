import { DatabaseStorage } from './database-storage';

interface AdminBootstrapOptions {
  username: string;
  password: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR';
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
        role: 'SUPER_ADMIN'
      });
      
      console.log('[ADMIN_BOOTSTRAP] Development admin initialization complete');
    } 
    // In production, only create if explicitly enabled with environment variables
    else if (process.env.ADMIN_BOOTSTRAP_ENABLED === 'true') {
      const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
      
      if (!bootstrapPassword || bootstrapPassword.length < 12) {
        console.warn('[ADMIN_BOOTSTRAP] ADMIN_BOOTSTRAP_PASSWORD not set or too short (minimum 12 characters), skipping admin creation');
        return;
      }
      
      console.log('[ADMIN_BOOTSTRAP] Production environment - creating admin with provided credentials');
      
      await bootstrapDefaultAdmin(storage, {
        username: 'chatadmin',
        password: bootstrapPassword,
        role: 'SUPER_ADMIN'
      });
      
      console.log('[ADMIN_BOOTSTRAP] Production admin initialization complete');
    } else {
      console.log('[ADMIN_BOOTSTRAP] Production environment - admin bootstrap disabled for security (set ADMIN_BOOTSTRAP_ENABLED=true to enable)');
    }
    
  } catch (error) {
    console.error('[ADMIN_BOOTSTRAP] System admin initialization failed:', error);
    // Don't crash the app on bootstrap failure
  }
}