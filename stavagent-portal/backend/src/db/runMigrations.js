/**
 * Auto-run database migrations on server startup
 * Runs only if PostgreSQL is configured
 */

import { getPool } from './postgres.js';
import { USE_POSTGRES } from './index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  if (!USE_POSTGRES) {
    console.log('[Migrations] Skipping - PostgreSQL not configured');
    return;
  }

  try {
    const pool = getPool();
    const client = await pool.connect();

    console.log('[Migrations] Running database migrations...');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add-unified-project-structure.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await client.query(migrationSQL);

    console.log('[Migrations] ✅ Successfully created portal_objects and portal_positions tables');

    client.release();
  } catch (error) {
    console.error('[Migrations] ❌ Migration failed:', error.message);
    // Don't throw - allow server to start even if migration fails
  }
}
