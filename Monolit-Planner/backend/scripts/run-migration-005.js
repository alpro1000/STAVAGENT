/**
 * Run Migration 005: Migrate bridges → monolith_projects
 *
 * This script copies all data from the old 'bridges' table to the new 'monolith_projects' table.
 *
 * Usage:
 *   node backend/scripts/run-migration-005.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../src/db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('='.repeat(80));
  console.log('Migration 005: Migrate bridges → monolith_projects');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1: Check current state
    console.log('[STEP 1] Checking current database state...');

    const bridgesCount = await db.prepare('SELECT COUNT(*) as count FROM bridges').get();
    const projectsCount = await db.prepare('SELECT COUNT(*) as count FROM monolith_projects').get();
    const positionsCount = await db.prepare('SELECT COUNT(*) as count FROM positions').get();

    console.log(`  - bridges table: ${bridgesCount.count} records`);
    console.log(`  - monolith_projects table: ${projectsCount.count} records`);
    console.log(`  - positions table: ${positionsCount.count} records`);
    console.log('');

    if (bridgesCount.count === 0) {
      console.log('⚠️  Warning: bridges table is empty. Nothing to migrate.');
      return;
    }

    if (projectsCount.count >= bridgesCount.count) {
      console.log('✅ Migration already completed (monolith_projects has all data)');
      return;
    }

    // Step 2: Read migration SQL
    console.log('[STEP 2] Loading migration SQL...');
    const migrationPath = path.join(__dirname, '../migrations/005_migrate_bridges_to_monolith_projects.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    console.log('  ✓ SQL loaded');
    console.log('');

    // Step 3: Execute migration
    console.log('[STEP 3] Executing migration...');

    // Split SQL into statements (simple split by semicolon)
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      // Skip comments
      if (statement.trim().startsWith('--')) continue;

      console.log('  - Executing statement...');
      await db.exec(statement);
    }

    console.log('  ✓ Migration executed successfully');
    console.log('');

    // Step 4: Verify results
    console.log('[STEP 4] Verifying migration results...');

    const newProjectsCount = await db.prepare('SELECT COUNT(*) as count FROM monolith_projects').get();
    const migratedCount = newProjectsCount.count - projectsCount.count;

    console.log(`  - Before: ${projectsCount.count} records in monolith_projects`);
    console.log(`  - After: ${newProjectsCount.count} records in monolith_projects`);
    console.log(`  - Migrated: ${migratedCount} records`);
    console.log('');

    // Step 5: Show sample migrated data
    console.log('[STEP 5] Sample migrated projects:');
    const samples = await db.prepare(`
      SELECT project_id, object_name, concrete_m3, created_at
      FROM monolith_projects
      ORDER BY created_at DESC
      LIMIT 10
    `).all();

    samples.forEach(p => {
      console.log(`  - ${p.project_id}: "${p.object_name}" (${p.concrete_m3} m³)`);
    });
    console.log('');

    console.log('='.repeat(80));
    console.log('✅ Migration 005 completed successfully!');
    console.log('='.repeat(80));
    console.log('');
    console.log('Next steps:');
    console.log('  1. Test that you can now edit projects in the UI');
    console.log('  2. Verify that F5 refresh keeps the projects visible');
    console.log('  3. If everything works, the old bridges table can be kept for backup');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('Migration script completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
