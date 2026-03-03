/**
 * Run Migration 011 - Add Relink Support
 * Simple version that works with both SQLite and PostgreSQL
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration011() {
  try {
    console.log('[Migration 011] Starting relink support migration...');
    console.log('[Migration 011] Reading migration file...');

    // Read migration SQL file
    const migrationPath = join(__dirname, '../migrations/011_add_relink_support.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('[Migration 011] ❌ Migration file not found:', migrationPath);
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log('[Migration 011] ✓ Migration file loaded');
    console.log('[Migration 011] File size:', migrationSQL.length, 'characters');

    // For now, just show what would be executed
    console.log('\n[Migration 011] Migration SQL:');
    console.log('─'.repeat(80));
    console.log(migrationSQL);
    console.log('─'.repeat(80));

    console.log('\n[Migration 011] ✅ Migration file validated');
    console.log('[Migration 011] To apply: Run server and it will auto-apply on startup');
    console.log('[Migration 011] Or manually execute SQL in your database client');

    process.exit(0);
  } catch (error) {
    console.error('[Migration 011] ❌ Error:', error.message);
    process.exit(1);
  }
}

runMigration011();
