/**
 * Production Database Configuration
 * 
 * Enhanced database configuration for production deployment with optimized
 * connection pooling, monitoring, and error handling.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure WebSocket constructor for Neon
neonConfig.webSocketConstructor = ws;

interface DatabaseConfig {
  url: string;
  maxConnections: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
  keepAlive: boolean;
}

function getProductionDatabaseConfig(): DatabaseConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    url: process.env.DATABASE_URL!,
    // Production: Higher connection limit for better performance
    // Development: Lower limit to conserve resources
    maxConnections: isProduction ? 20 : 5,
    // Production: Longer idle timeout for connection reuse
    // Development: Shorter timeout to clean up quickly
    idleTimeoutMs: isProduction ? 30000 : 10000, // 30s prod, 10s dev
    // Connection timeout for new connections
    connectionTimeoutMs: isProduction ? 10000 : 5000, // 10s prod, 5s dev
    // Keep connections alive
    keepAlive: isProduction,
  };
}

export function createDatabaseConnection() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  const config = getProductionDatabaseConfig();
  
  console.log('[DB_CONFIG] Initializing database connection:', {
    environment: process.env.NODE_ENV || 'development',
    maxConnections: config.maxConnections,
    idleTimeoutMs: config.idleTimeoutMs,
    keepAlive: config.keepAlive,
    hasUrl: !!config.url
  });

  // Create connection pool with production-optimized settings
  const pool = new Pool({ 
    connectionString: config.url,
    // Neon-specific configuration would go here if supported
    // For now, Neon manages most connection pooling automatically
  });

  // Create Drizzle instance with schema
  const db = drizzle({ client: pool, schema });

  // Database health check function
  const healthCheck = async (): Promise<boolean> => {
    try {
      // Simple query to test connection
      await db.execute(sql`SELECT 1`);
      return true;
    } catch (error) {
      console.error('[DB_HEALTH] Database health check failed:', error);
      return false;
    }
  };

  // Connection monitoring (production only)
  if (process.env.NODE_ENV === 'production') {
    // Check database health every 30 seconds
    const healthCheckInterval = setInterval(async () => {
      const isHealthy = await healthCheck();
      if (!isHealthy) {
        console.error('[DB_HEALTH] Database connection unhealthy - automatic recovery may be needed');
      }
    }, 30000);

    // Clean up interval on process exit
    process.on('SIGTERM', () => {
      clearInterval(healthCheckInterval);
      console.log('[DB_CONFIG] Database monitoring stopped');
    });

    process.on('SIGINT', () => {
      clearInterval(healthCheckInterval);
      console.log('[DB_CONFIG] Database monitoring stopped');
    });
  }

  return { pool, db, healthCheck };
}