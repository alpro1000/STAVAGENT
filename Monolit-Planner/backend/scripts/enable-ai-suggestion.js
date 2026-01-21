#!/usr/bin/env node

/**
 * Automatic script to enable AI Suggestion feature
 *
 * This script will:
 * 1. Run Migration 007 (portal integration)
 * 2. Run Migration 008 (enable AI suggestion flag)
 * 3. Verify the changes
 *
 * Usage:
 *   node scripts/enable-ai-suggestion.js
 *
 * Requirements:
 *   - DATABASE_URL environment variable (PostgreSQL connection string)
 *   OR
 *   - Run from backend directory where it can access local SQLite
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USE_POSTGRES = !!process.env.DATABASE_URL;

console.log('🚀 AI Suggestion Enabler Script');
console.log('================================\n');

if (USE_POSTGRES) {
  console.log('📊 Database: PostgreSQL (production)');
  console.log(`🔗 URL: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n`);
  await enableWithPostgres();
} else {
  console.log('📊 Database: SQLite (local development)');
  console.log('❌ ERROR: This script requires PostgreSQL connection');
  console.log('💡 Please set DATABASE_URL environment variable\n');
  console.log('Example:');
  console.log('  export DATABASE_URL="postgresql://user:pass@host:5432/dbname"');
  console.log('  node scripts/enable-ai-suggestion.js\n');
  process.exit(1);
}

async function enableWithPostgres() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  });

  let client;

  try {
    client = await pool.connect();
    console.log('✅ Connected to PostgreSQL\n');

    // Step 1: Check if migrations are needed
    console.log('📋 Step 1: Checking current state...');

    const tablesCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('normsets', 'position_suggestions', 'project_config')
    `);

    const existingTables = tablesCheck.rows.map(r => r.table_name);
    console.log(`   Found tables: ${existingTables.join(', ') || 'none'}\n`);

    // Step 2: Run Migration 007 if needed
    if (!existingTables.includes('normsets') || !existingTables.includes('position_suggestions')) {
      console.log('📦 Step 2: Running Migration 007 (portal integration)...');
      const migration007Path = path.join(__dirname, '../migrations/007_portal_integration.sql');
      const migration007 = fs.readFileSync(migration007Path, 'utf8');

      // Remove comments and split by statement
      const statements = migration007
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement) {
          try {
            await client.query(statement);
          } catch (err) {
            // Ignore "already exists" errors
            if (!err.message.includes('already exists')) {
              throw err;
            }
          }
        }
      }
      console.log('   ✅ Migration 007 completed\n');
    } else {
      console.log('✅ Step 2: Migration 007 already applied\n');
    }

    // Step 3: Enable AI Suggestion feature flag
    console.log('🎯 Step 3: Enabling FF_AI_DAYS_SUGGEST...');

    const configCheck = await client.query('SELECT id FROM project_config WHERE id = 1');

    if (configCheck.rows.length > 0) {
      // Update existing config
      await client.query(`
        UPDATE project_config
        SET
          feature_flags = jsonb_set(
            COALESCE(feature_flags::jsonb, '{}'::jsonb),
            '{FF_AI_DAYS_SUGGEST}',
            'true'::jsonb,
            true
          )::text,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `);
      console.log('   ✅ Updated existing config\n');
    } else {
      // Insert new config
      await client.query(`
        INSERT INTO project_config (id, feature_flags, defaults, days_per_month_mode)
        VALUES (
          1,
          '{"FF_AI_DAYS_SUGGEST": true, "FF_PUMP_MODULE": false, "FF_ADVANCED_METRICS": false, "FF_DARK_MODE": false, "FF_SPEED_ANALYSIS": false}',
          '{"ROUNDING_STEP_KROS": 50, "RHO_T_PER_M3": 2.4, "LOCALE": "cs-CZ", "CURRENCY": "CZK", "DAYS_PER_MONTH_OPTIONS": [30, 22], "DAYS_PER_MONTH_DEFAULT": 30}',
          30
        )
      `);
      console.log('   ✅ Created new config\n');
    }

    // Step 4: Verify
    console.log('🔍 Step 4: Verification...');
    const verify = await client.query(`
      SELECT
        id,
        feature_flags::jsonb->>'FF_AI_DAYS_SUGGEST' AS ai_enabled,
        updated_at
      FROM project_config
      WHERE id = 1
    `);

    if (verify.rows.length > 0 && verify.rows[0].ai_enabled === 'true') {
      console.log('   ✅ FF_AI_DAYS_SUGGEST: ENABLED');
      console.log(`   📅 Updated: ${verify.rows[0].updated_at}\n`);

      console.log('🎉 SUCCESS! All done!\n');
      console.log('Next steps:');
      console.log('1. Open: https://monolit-planner-frontend.onrender.com');
      console.log('2. Press Ctrl+Shift+R to hard reload');
      console.log('3. Look for green ✨ button in "Dny" column\n');
    } else {
      console.log('   ❌ Verification failed - feature flag not enabled\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}
