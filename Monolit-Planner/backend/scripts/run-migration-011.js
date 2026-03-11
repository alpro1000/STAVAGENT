/**
 * Run Migration 011 - Add Relink Support
 * Adds columns and indexes for file version tracking and relink algorithm
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../src/db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration011() {
  try {
    console.log('[Migration 011] Starting relink support migration...');

    // Read migration SQL file
    const migrationPath = join(__dirname, '../migrations/011_add_relink_support.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`[Migration 011] Executing ${statements.length} statements...`);

    for (const statement of statements) {
      try {
        await db.exec(statement + ';');
        console.log('[Migration 011] ✓ Statement executed');
      } catch (error) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists') || error.code === '42P01') {
          console.log('[Migration 011] ⊘ Already exists (skipped)');
        } else {
          console.error('[Migration 011] Error:', error.message);
          throw error;
        }
      }
    }

    console.log('[Migration 011] ✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[Migration 011] ❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration011();
