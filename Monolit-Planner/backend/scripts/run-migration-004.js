/**
 * Run Migration 004: Normalize project IDs
 * Removes all spaces from project_id/bridge_id across all tables
 *
 * Usage:
 *   node scripts/run-migration-004.js
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../database.sqlite');

console.log('='.repeat(60));
console.log('Migration 004: Normalize project IDs');
console.log('='.repeat(60));
console.log(`Database: ${dbPath}`);
console.log('');

// Check if database exists
if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found: ${dbPath}`);
  process.exit(1);
}

// Open database
const db = new Database(dbPath);

try {
  // Read migration SQL
  const migrationPath = path.join(__dirname, '../migrations/004_normalize_project_ids.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('📋 Migration SQL loaded');
  console.log('');

  // Show what will be updated (BEFORE)
  console.log('🔍 Checking for project IDs with spaces...');
  const projectsWithSpaces = db.prepare(`
    SELECT project_id FROM monolith_projects WHERE project_id LIKE '% %'
  `).all();

  if (projectsWithSpaces.length === 0) {
    console.log('✅ No project IDs with spaces found. Nothing to migrate.');
    process.exit(0);
  }

  console.log(`Found ${projectsWithSpaces.length} project(s) with spaces:`);
  projectsWithSpaces.forEach(p => {
    const normalized = p.project_id.replace(/\s+/g, '');
    console.log(`  "${p.project_id}" → "${normalized}"`);
  });
  console.log('');

  // Execute migration
  console.log('🚀 Running migration...');
  db.exec(migrationSQL);
  console.log('✅ Migration completed successfully!');
  console.log('');

  // Verify results (AFTER)
  console.log('🔍 Verifying migration...');
  const remainingWithSpaces = db.prepare(`
    SELECT project_id FROM monolith_projects WHERE project_id LIKE '% %'
  `).all();

  if (remainingWithSpaces.length === 0) {
    console.log('✅ All project IDs normalized successfully!');
  } else {
    console.warn(`⚠️ Warning: ${remainingWithSpaces.length} project(s) still have spaces.`);
    remainingWithSpaces.forEach(p => console.log(`  "${p.project_id}"`));
  }

} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}

console.log('');
console.log('='.repeat(60));
console.log('Migration complete!');
console.log('='.repeat(60));
