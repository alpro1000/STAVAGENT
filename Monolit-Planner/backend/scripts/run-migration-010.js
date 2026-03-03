import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const { Pool } = pg;

async function runMigration010() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Running migration 010: Create Unified Registry...');

    const migrationPath = join(__dirname, '../migrations/010_create_unified_registry.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await pool.query(sql);

    console.log('✅ Migration 010 completed successfully');
    console.log('📊 Created tables:');
    console.log('   - registry_projects');
    console.log('   - registry_objects');
    console.log('   - registry_source_files');
    console.log('   - registry_file_versions');
    console.log('   - registry_position_instances');
    console.log('   - registry_position_templates');
    console.log('   - registry_apply_logs');
    console.log('   - registry_relink_reports');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigration010();
