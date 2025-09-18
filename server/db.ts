import { createDatabaseConnection } from './database-config';

// Initialize database connection with production configuration
const { pool, db, healthCheck } = createDatabaseConnection();

export { pool, db, healthCheck };
