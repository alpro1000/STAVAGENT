/**
 * Clear ALL projects from database
 * WARNING: This will DELETE all data!
 *
 * Usage:
 *   node scripts/clear-all-projects.js
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../database.sqlite');

console.log('='.repeat(60));
console.log('⚠️  CLEAR ALL PROJECTS - WARNING!');
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
  // Show counts BEFORE deletion
  console.log('📊 Current database state:');
  const projectsCount = db.prepare('SELECT COUNT(*) as count FROM monolith_projects').get();
  const bridgesCount = db.prepare('SELECT COUNT(*) as count FROM bridges').get();
  const positionsCount = db.prepare('SELECT COUNT(*) as count FROM positions').get();
  const partsCount = db.prepare('SELECT COUNT(*) as count FROM parts').get();
  const snapshotsCount = db.prepare('SELECT COUNT(*) as count FROM snapshots').get();

  console.log(`  Projects: ${projectsCount.count}`);
  console.log(`  Bridges: ${bridgesCount.count}`);
  console.log(`  Positions: ${positionsCount.count}`);
  console.log(`  Parts: ${partsCount.count}`);
  console.log(`  Snapshots: ${snapshotsCount.count}`);
  console.log('');

  if (projectsCount.count === 0) {
    console.log('✅ Database is already empty. Nothing to delete.');
    process.exit(0);
  }

  // Confirm deletion
  console.log('⚠️  This will DELETE ALL projects and related data!');
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to proceed...');
  console.log('');

  // Wait 3 seconds
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('🗑️  Deleting all data...');
  console.log('');

  // Delete in correct order (respect FK constraints)
  db.exec(`
    -- Delete positions first (references bridge_id)
    DELETE FROM positions;

    -- Delete parts (references project_id)
    DELETE FROM parts;

    -- Delete snapshots (references bridge_id)
    DELETE FROM snapshots;

    -- Delete bridges
    DELETE FROM bridges;

    -- Delete projects
    DELETE FROM monolith_projects;

    -- Reset autoincrement counters (SQLite specific)
    DELETE FROM sqlite_sequence WHERE name IN ('monolith_projects', 'bridges', 'positions', 'parts', 'snapshots');
  `);

  console.log('✅ All projects deleted successfully!');
  console.log('');

  // Show counts AFTER deletion
  console.log('📊 Final database state:');
  const projectsAfter = db.prepare('SELECT COUNT(*) as count FROM monolith_projects').get();
  const bridgesAfter = db.prepare('SELECT COUNT(*) as count FROM bridges').get();
  const positionsAfter = db.prepare('SELECT COUNT(*) as count FROM positions').get();
  const partsAfter = db.prepare('SELECT COUNT(*) as count FROM parts').get();
  const snapshotsAfter = db.prepare('SELECT COUNT(*) as count FROM snapshots').get();

  console.log(`  Projects: ${projectsAfter.count}`);
  console.log(`  Bridges: ${bridgesAfter.count}`);
  console.log(`  Positions: ${positionsAfter.count}`);
  console.log(`  Parts: ${partsAfter.count}`);
  console.log(`  Snapshots: ${snapshotsAfter.count}`);

  if (projectsAfter.count === 0 && bridgesAfter.count === 0 && positionsAfter.count === 0) {
    console.log('');
    console.log('✅ Database cleared successfully!');
  } else {
    console.warn('');
    console.warn('⚠️  Warning: Some data still remains in database.');
  }

} catch (error) {
  console.error('❌ Error clearing database:', error.message);
  console.error(error.stack);
  process.exit(1);
} finally {
  db.close();
}

console.log('');
console.log('='.repeat(60));
console.log('Operation complete!');
console.log('='.repeat(60));
