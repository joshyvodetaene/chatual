/**
 * Production Environment Configuration Validation
 * 
 * This module validates that all required environment variables are properly
 * configured for production deployment and provides security recommendations.
 */

interface ProductionConfig {
  databaseUrl: string;
  sessionSecret: string;
  nodeEnv: string;
  port: number;
  adminBootstrapEnabled?: boolean;
  adminBootstrapPassword?: string;
  googleMapsApiKey?: string;
  privateObjectDir?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config?: ProductionConfig;
}

export function validateProductionEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required environment variables
  const requiredVars = {
    DATABASE_URL: process.env.DATABASE_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
  };

  // Check required variables
  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Validate SESSION_SECRET strength
  const sessionSecret = process.env.SESSION_SECRET;
  if (sessionSecret) {
    if (sessionSecret === 'dev-secret-change-in-production-12345') {
      errors.push('SESSION_SECRET is still using the default development value. This is a critical security risk.');
    } else if (sessionSecret.length < 32) {
      warnings.push('SESSION_SECRET should be at least 32 characters long for better security.');
    }
  }

  // Validate NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && !['development', 'production', 'test'].includes(nodeEnv)) {
    warnings.push(`NODE_ENV value "${nodeEnv}" is not standard. Use 'production' for deployment.`);
  }

  // Validate PORT
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push('PORT must be a valid number between 1 and 65535');
  }

  // Production-specific validations
  if (nodeEnv === 'production') {
    // Database URL validation for production
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
        warnings.push('DATABASE_URL should use postgresql:// or postgres:// protocol');
      }
      if (!dbUrl.includes('sslmode=require')) {
        warnings.push('DATABASE_URL should include sslmode=require for production security');
      }
    }

    // Admin bootstrap validation
    if (process.env.ADMIN_BOOTSTRAP_ENABLED === 'true') {
      const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
      if (!adminPassword || adminPassword.length < 12) {
        errors.push('ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters when ADMIN_BOOTSTRAP_ENABLED=true');
      }
    }

    // Optional service validations
    if (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY.length < 39) {
      warnings.push('GOOGLE_MAPS_API_KEY appears to be invalid (too short)');
    }
  }

  const config: ProductionConfig = {
    databaseUrl: process.env.DATABASE_URL || '',
    sessionSecret: process.env.SESSION_SECRET || '',
    nodeEnv: process.env.NODE_ENV || 'development',
    port,
    adminBootstrapEnabled: process.env.ADMIN_BOOTSTRAP_ENABLED === 'true',
    adminBootstrapPassword: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    privateObjectDir: process.env.PRIVATE_OBJECT_DIR,
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    config: errors.length === 0 ? config : undefined,
  };
}

export function logEnvironmentStatus(): void {
  const validation = validateProductionEnvironment();
  const isProduction = process.env.NODE_ENV === 'production';

  console.log(`[ENV_CONFIG] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[ENV_CONFIG] Port: ${process.env.PORT || '5000'}`);
  console.log(`[ENV_CONFIG] Database: ${process.env.DATABASE_URL ? 'Configured' : 'Missing'}`);
  console.log(`[ENV_CONFIG] Session Secret: ${process.env.SESSION_SECRET ? 'Configured' : 'Using default (INSECURE)'}`);

  if (validation.errors.length > 0) {
    console.error('[ENV_CONFIG] CRITICAL ENVIRONMENT ERRORS:');
    validation.errors.forEach(error => console.error(`[ENV_CONFIG] ❌ ${error}`));
    
    if (isProduction) {
      console.error('[ENV_CONFIG] 🚨 Production deployment with configuration errors detected!');
      console.error('[ENV_CONFIG] 🚨 Application may not function correctly or securely.');
    }
  }

  if (validation.warnings.length > 0) {
    console.warn('[ENV_CONFIG] Environment warnings:');
    validation.warnings.forEach(warning => console.warn(`[ENV_CONFIG] ⚠️  ${warning}`));
  }

  if (validation.isValid) {
    console.log('[ENV_CONFIG] ✅ Environment validation passed');
  }
}

/**
 * Security recommendations for production deployment
 */
export function getSecurityRecommendations(): string[] {
  return [
    'Set SESSION_SECRET to a randomly generated 64-character string',
    'Ensure DATABASE_URL includes sslmode=require for encrypted connections',
    'Use HTTPS/TLS termination at the load balancer or reverse proxy level',
    'Set secure environment variables in your deployment platform (not in code)',
    'Enable ADMIN_BOOTSTRAP_ENABLED=true only for initial deployment, then disable',
    'Use strong passwords (12+ characters) for ADMIN_BOOTSTRAP_PASSWORD',
    'Consider setting up monitoring and logging for security events',
    'Regularly update dependencies to patch security vulnerabilities',
  ];
}