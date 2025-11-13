/**
 * Database initialization and schema
 * Now uses unified database interface (SQLite or PostgreSQL)
 */

import db from './index.js';
import { initDatabase } from './migrations.js';

// Re-export for backward compatibility
export { db, initDatabase };
export default db;
