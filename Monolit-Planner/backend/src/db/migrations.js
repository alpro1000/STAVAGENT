/**
 * Database Migrations
 * Handles schema creation and migrations for both SQLite and PostgreSQL
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db, { USE_POSTGRES } from './index.js';
import { normalizeForSearch } from '../utils/text.js';
import { getAllTemplates, getTemplateSummary } from '../constants/objectTemplates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Initialize database schema
 */
export async function initDatabase() {
  if (USE_POSTGRES) {
    await initPostgresSchema();
  } else {
    await initSqliteSchema();
  }

  console.log('[Database] Schema initialized successfully');
}

/**
 * Initialize PostgreSQL schema from SQL file
 */
async function initPostgresSchema() {
  const schemaPath = join(__dirname, 'schema-postgres.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  // Split by semicolons and execute each statement
  const allStatements = schema
    .split(';')
    .map(s => {
      // Trim and remove comment lines
      const lines = s.trim().split('\n');
      const cleanedLines = lines.filter(line => !line.trim().startsWith('--'));
      return cleanedLines.join('\n').trim();
    })
    .filter(s => s.length > 0);

  // Separate CREATE TABLE statements (must run first) from others
  const createTableStatements = allStatements.filter(s =>
    s.trim().toUpperCase().startsWith('CREATE TABLE')
  );
  const otherStatements = allStatements.filter(s =>
    !s.trim().toUpperCase().startsWith('CREATE TABLE')
  );

  console.log(`[PostgreSQL] Running ${createTableStatements.length} CREATE TABLE statements...`);

  // Execute CREATE TABLE first (critical for foreign keys and dependencies)
  for (const statement of createTableStatements) {
    try {
      await db.exec(statement + ';');
      console.log(`[PostgreSQL] ✓ Created table`);
    } catch (error) {
      // Ignore "already exists" errors
      if (error.message?.includes('already exists') || error.code === '42P01') {
        console.log(`[PostgreSQL] Table already exists (skipped)`);
      } else {
        console.error('[PostgreSQL] Error executing statement:', statement);
        throw error;
      }
    }
  }

  console.log(`[PostgreSQL] Running ${otherStatements.length} other statements (indexes, inserts)...`);

  // Execute other statements (CREATE INDEX, INSERT, etc.)
  for (const statement of otherStatements) {
    try {
      await db.exec(statement + ';');
    } catch (error) {
      // Ignore "already exists" and "relation does not exist" errors
      // These are safe to ignore during migrations
      const ignoreErrors = ['already exists', 'does not exist', '42P01'];
      const shouldIgnore = ignoreErrors.some(errMsg => {
        const messageMatch = error.message && error.message.includes(errMsg);
        const codeMatch = error.code === errMsg;
        return messageMatch || codeMatch;
      });

      if (!shouldIgnore) {
        console.error('[PostgreSQL] Error executing statement:', statement);
        throw error;
      } else {
        // Log ignored errors for debugging
        console.log(`[PostgreSQL] ℹ️ Ignored expected error: ${error.code || error.message}`);
      }
    }
  }

  // Insert default config if not exists
  const configExists = await db.prepare('SELECT id FROM project_config WHERE id = 1').get();
  if (!configExists) {
    const defaultFeatureFlags = JSON.stringify({
      FF_AI_DAYS_SUGGEST: true,  // ✅ AI-powered days estimation (Time Norms Automation)
      FF_PUMP_MODULE: false,
      FF_ADVANCED_METRICS: false,
      FF_DARK_MODE: false,
      FF_SPEED_ANALYSIS: false
    });

    const defaultDefaults = JSON.stringify({
      ROUNDING_STEP_KROS: 50,
      RHO_T_PER_M3: 2.4,
      LOCALE: 'cs-CZ',
      CURRENCY: 'CZK',
      DAYS_PER_MONTH_OPTIONS: [30, 22],
      DAYS_PER_MONTH_DEFAULT: 30,
      SNAPSHOT_RETENTION_DAYS: 30,
      REQUIRE_SNAPSHOT_FOR_EXPORT: true,
      AUTO_SNAPSHOT_ON_EXPORT: false
    });

    await db.prepare(`
      INSERT INTO project_config (id, feature_flags, defaults, days_per_month_mode)
      VALUES (1, ?, ?, 30)
    `).run(defaultFeatureFlags, defaultDefaults);
  }

  // Run Phase 1 & 2 migrations (add missing columns/tables for existing databases)
  await runPhase1Phase2Migrations();

  // Run Phase 3 migrations (add admin panel and audit logging)
  await runPhase3Migrations();

  // Run Phase 4 migrations (document upload and analysis)
  await runPhase4Migrations();

  // Run Phase 5 migration (migrate bridges → monolith_projects)
  await runPhase5Migration();

  // Run Phase 6 migration (R0 Deterministic Core tables)
  await runPhase6R0Migrations();

  // Run Phase 7 migration (Portal Integration for monolith_projects)
  await runPhase7PortalIntegration();

  // Run Phase 8 migration (Formwork Calculator + curing_days)
  await runPhase8FormworkCalculator();

  // Auto-load OTSKP codes if database is empty
  await autoLoadOtskpCodesIfNeeded();

  // Auto-load part templates if database is empty
  await autoLoadPartTemplatesIfNeeded();
}

/**
 * Migrations for Phase 1 & 2 - Add missing columns and tables to existing PostgreSQL databases
 * This ensures existing production databases get the new schema without manual intervention
 */
async function runPhase1Phase2Migrations() {
  try {
    console.log('[PostgreSQL Migrations] Running Phase 1 & 2 migrations...');

    // Phase 1: Add email_verified column to users table if it doesn't exist
    try {
      console.log('[Migration] Checking users table for email_verified column...');
      await db.exec(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
      `);
      console.log('[Migration] ✓ email_verified column added or already exists');
    } catch (error) {
      // Column might already exist, that's fine
      if (!error.message.includes('already exists') && !error.message.includes('column')) {
        console.error('[Migration] Unexpected error adding email_verified:', error);
      } else {
        console.log('[Migration] ✓ email_verified column already exists');
      }
    }

    // Phase 1: Add email_verified_at column to users table if it doesn't exist
    try {
      console.log('[Migration] Checking users table for email_verified_at column...');
      await db.exec(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
      `);
      console.log('[Migration] ✓ email_verified_at column added or already exists');
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('column')) {
        console.error('[Migration] Unexpected error adding email_verified_at:', error);
      } else {
        console.log('[Migration] ✓ email_verified_at column already exists');
      }
    }

    // Phase 1: Create email_verification_tokens table if it doesn't exist
    try {
      console.log('[Migration] Checking for email_verification_tokens table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
          id VARCHAR(255) PRIMARY KEY,
          user_id INTEGER NOT NULL UNIQUE,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      console.log('[Migration] ✓ email_verification_tokens table created or already exists');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration] Error creating email_verification_tokens:', error);
      } else {
        console.log('[Migration] ✓ email_verification_tokens table already exists');
      }
    }

    // Phase 2: Create password_reset_tokens table if it doesn't exist
    try {
      console.log('[Migration] Checking for password_reset_tokens table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id VARCHAR(255) PRIMARY KEY,
          user_id INTEGER NOT NULL,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      console.log('[Migration] ✓ password_reset_tokens table created or already exists');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration] Error creating password_reset_tokens:', error);
      } else {
        console.log('[Migration] ✓ password_reset_tokens table already exists');
      }
    }

    console.log('[PostgreSQL Migrations] ✅ Phase 1 & 2 migrations completed successfully');
  } catch (error) {
    console.error('[PostgreSQL Migrations] Error during migrations:', error);
    // Don't fail startup if migrations fail - they might already exist
  }
}

/**
 * Migrations for Phase 3 - Add admin panel and audit logging
 */
async function runPhase3Migrations() {
  try {
    console.log('[PostgreSQL Migrations] Running Phase 3 migrations (Admin Panel & Audit Logging)...');

    // Phase 3: Create audit_logs table if it doesn't exist
    try {
      console.log('[Migration] Checking for audit_logs table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(255) PRIMARY KEY,
          admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          action VARCHAR(50) NOT NULL,
          data TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[Migration] ✓ audit_logs table created or already exists');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration] Error creating audit_logs:', error);
      } else {
        console.log('[Migration] ✓ audit_logs table already exists');
      }
    }

    // Create indexes for audit_logs table
    try {
      console.log('[Migration] Creating indexes for audit_logs table...');
      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
      `);
      console.log('[Migration] ✓ audit_logs indexes created');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration] Error creating indexes:', error);
      } else {
        console.log('[Migration] ✓ audit_logs indexes already exist');
      }
    }

    console.log('[PostgreSQL Migrations] ✅ Phase 3 migrations completed successfully');
  } catch (error) {
    console.error('[PostgreSQL Migrations] Error during Phase 3 migrations:', error);
    // Don't fail startup if migrations fail
  }
}

/**
 * Migrations for Phase 4 - Document Upload & Analysis
 */
async function runPhase4Migrations() {
  try {
    console.log('[PostgreSQL Migrations] Running Phase 4 migrations (Document Upload & Analysis)...');

    // Phase 4: Create documents table
    try {
      console.log('[Migration] Creating documents table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS documents (
          id VARCHAR(255) PRIMARY KEY,
          project_id VARCHAR(255) NOT NULL,
          user_id INTEGER NOT NULL,
          original_filename VARCHAR(255) NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER,
          file_type VARCHAR(50),
          status VARCHAR(50) DEFAULT 'uploaded',
          analysis_status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      console.log('[Migration] ✓ documents table created or already exists');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration] Error creating documents:', error);
      } else {
        console.log('[Migration] ✓ documents table already exists');
      }
    }

    // Phase 4: Create document_analyses table (results from CORE Engine)
    try {
      console.log('[Migration] Creating document_analyses table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS document_analyses (
          id VARCHAR(255) PRIMARY KEY,
          document_id VARCHAR(255) NOT NULL,
          workflow_id VARCHAR(255),
          workflow_type VARCHAR(50),
          parsed_positions TEXT,
          materials TEXT,
          dimensions TEXT,
          analysis_metadata TEXT,
          audit_results TEXT,
          ai_enrichment TEXT,
          status VARCHAR(50) DEFAULT 'completed',
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        );
      `);
      console.log('[Migration] ✓ document_analyses table created or already exists');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration] Error creating document_analyses:', error);
      } else {
        console.log('[Migration] ✓ document_analyses table already exists');
      }
    }

    // Phase 4: Create work_lists table
    try {
      console.log('[Migration] Creating work_lists table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS work_lists (
          id VARCHAR(255) PRIMARY KEY,
          project_id VARCHAR(255) NOT NULL,
          document_id VARCHAR(255),
          user_id INTEGER NOT NULL,
          title VARCHAR(255),
          description TEXT,
          status VARCHAR(50) DEFAULT 'draft',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id) ON DELETE CASCADE,
          FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `);
      console.log('[Migration] ✓ work_lists table created or already exists');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration] Error creating work_lists:', error);
      } else {
        console.log('[Migration] ✓ work_lists table already exists');
      }
    }

    // Phase 4: Create work_list_items table (individual items in a work list)
    try {
      console.log('[Migration] Creating work_list_items table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS work_list_items (
          id VARCHAR(255) PRIMARY KEY,
          work_list_id VARCHAR(255) NOT NULL,
          description VARCHAR(500) NOT NULL,
          category VARCHAR(100),
          unit VARCHAR(50),
          quantity REAL,
          otskp_code VARCHAR(50),
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (work_list_id) REFERENCES work_lists(id) ON DELETE CASCADE
        );
      `);
      console.log('[Migration] ✓ work_list_items table created or already exists');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration] Error creating work_list_items:', error);
      } else {
        console.log('[Migration] ✓ work_list_items table already exists');
      }
    }

    // Phase 4: Create indexes for document tables
    try {
      console.log('[Migration] Creating indexes for document tables...');
      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
        CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
        CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
        CREATE INDEX IF NOT EXISTS idx_document_analyses_document ON document_analyses(document_id);
        CREATE INDEX IF NOT EXISTS idx_document_analyses_status ON document_analyses(status);
        CREATE INDEX IF NOT EXISTS idx_work_lists_project ON work_lists(project_id);
        CREATE INDEX IF NOT EXISTS idx_work_lists_user ON work_lists(user_id);
        CREATE INDEX IF NOT EXISTS idx_work_list_items_work_list ON work_list_items(work_list_id);
      `);
      console.log('[Migration] ✓ document indexes created');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration] Error creating indexes:', error);
      } else {
        console.log('[Migration] ✓ document indexes already exist');
      }
    }

    console.log('[PostgreSQL Migrations] ✅ Phase 4 migrations completed successfully');
  } catch (error) {
    console.error('[PostgreSQL Migrations] Error during Phase 4 migrations:', error);
    // Don't fail startup if migrations fail
  }
}

/**
 * Migration Phase 5 - Migrate data from bridges to monolith_projects
 * This fixes the issue where old data was in 'bridges' table but API reads from 'monolith_projects'
 */
async function runPhase5Migration() {
  try {
    console.log('[PostgreSQL Migrations] Running Phase 5 migration (bridges → monolith_projects)...');

    // Check if migration is needed
    const bridgesCount = await db.prepare('SELECT COUNT(*) as count FROM bridges').get();
    const projectsCount = await db.prepare('SELECT COUNT(*) as count FROM monolith_projects').get();

    console.log(`[Migration 005] Current state: bridges=${bridgesCount.count}, monolith_projects=${projectsCount.count}`);

    if (bridgesCount.count === 0) {
      console.log('[Migration 005] ℹ️  No data in bridges table, skipping migration');
      return;
    }

    if (projectsCount.count >= bridgesCount.count) {
      console.log('[Migration 005] ✓ Migration already completed (monolith_projects has all data)');
      return;
    }

    console.log(`[Migration 005] Migrating ${bridgesCount.count - projectsCount.count} records...`);

    // Execute migration SQL
    await db.exec(`
      INSERT INTO monolith_projects (
        project_id,
        project_name,
        object_name,
        element_count,
        concrete_m3,
        sum_kros_czk,
        span_length_m,
        deck_width_m,
        pd_weeks,
        status,
        owner_id,
        created_at,
        updated_at,
        object_type
      )
      SELECT
        bridge_id as project_id,
        project_name,
        object_name,
        element_count,
        concrete_m3,
        sum_kros_czk,
        span_length_m,
        deck_width_m,
        pd_weeks,
        COALESCE(status, 'active') as status,
        COALESCE(owner_id, 1) as owner_id,
        created_at,
        updated_at,
        'custom' as object_type
      FROM bridges
      WHERE bridge_id NOT IN (SELECT project_id FROM monolith_projects);
    `);

    // Verify results
    const newProjectsCount = await db.prepare('SELECT COUNT(*) as count FROM monolith_projects').get();
    const migratedCount = newProjectsCount.count - projectsCount.count;

    console.log(`[Migration 005] ✅ Successfully migrated ${migratedCount} records`);
    console.log(`[Migration 005] Total projects now: ${newProjectsCount.count}`);

    // Show sample migrated data
    const samples = await db.prepare(`
      SELECT project_id, object_name, concrete_m3
      FROM monolith_projects
      ORDER BY created_at DESC
      LIMIT 5
    `).all();

    console.log('[Migration 005] Sample migrated projects:');
    samples.forEach(p => {
      console.log(`  - ${p.project_id}: "${p.object_name}" (${p.concrete_m3 || 0} m³)`);
    });

    console.log('[PostgreSQL Migrations] ✅ Phase 5 migration completed successfully');
  } catch (error) {
    console.error('[PostgreSQL Migrations] Error during Phase 5 migration:', error);
    // Log error but don't fail startup - let app try to run
    console.error('[Migration 005] ⚠️  Migration failed, but continuing startup...');
  }
}

/**
 * Migration Phase 6 - R0 Deterministic Core Tables
 * Creates all tables needed for the R0 calculation engine:
 * - r0_projects: R0 projects with parameters
 * - elements: Construction elements (slab, wall, beam, footing, column)
 * - normsets: Production norms from ÚRS, RTS, KROS, Internal
 * - captures: Takts for grouping elements
 * - tasks: Generated tasks for each capture
 * - schedule: Calculated schedule entries
 * - cost_breakdown: Cost traceability
 * - bottlenecks: Resource bottleneck detection
 */
async function runPhase6R0Migrations() {
  try {
    console.log('[PostgreSQL Migrations] Running Phase 6 migrations (R0 Deterministic Core)...');

    // 1. Create r0_projects table
    try {
      console.log('[Migration 006] Creating r0_projects table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS r0_projects (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,

          -- Work parameters
          shift_hours REAL NOT NULL DEFAULT 10,
          time_utilization_k REAL NOT NULL DEFAULT 0.85,
          days_per_month INTEGER NOT NULL DEFAULT 22,

          -- Link to monolith_projects (optional)
          monolith_project_id VARCHAR(255),

          -- ⭐ UNIFIED: Link to Portal project
          portal_project_id VARCHAR(255),

          -- Metadata
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[Migration 006] ✓ r0_projects table created');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration 006] Error creating r0_projects:', error);
      } else {
        console.log('[Migration 006] ✓ r0_projects table already exists');
      }
    }

    // 2. Create elements table
    try {
      console.log('[Migration 006] Creating elements table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS elements (
          id VARCHAR(255) PRIMARY KEY,
          r0_project_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          element_type VARCHAR(50) NOT NULL,

          -- Dimensions
          length_m REAL,
          width_m REAL,
          height_m REAL,
          thickness_m REAL,

          -- Calculated quantities
          volume_m3 REAL NOT NULL DEFAULT 0,
          area_m2 REAL,
          perimeter_m REAL,

          -- Material properties
          concrete_class VARCHAR(50),
          rebar_kg_m3 REAL DEFAULT 100,

          -- Display order
          display_order INTEGER DEFAULT 0,

          -- Metadata
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

          FOREIGN KEY (r0_project_id) REFERENCES r0_projects(id) ON DELETE CASCADE
        );
      `);
      console.log('[Migration 006] ✓ elements table created');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration 006] Error creating elements:', error);
      } else {
        console.log('[Migration 006] ✓ elements table already exists');
      }
    }

    // 3. Create normsets table (production norms)
    try {
      console.log('[Migration 006] Creating normsets table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS normsets (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          source_tag VARCHAR(50) NOT NULL,

          -- Rebar norms
          rebar_h_per_t REAL NOT NULL,
          rebar_crew_size INTEGER DEFAULT 4,

          -- Formwork norms
          formwork_h_per_m2 REAL NOT NULL,
          formwork_crew_size INTEGER DEFAULT 3,
          stripping_h_per_m2 REAL,

          -- Concreting norms
          concreting_h_per_m3 REAL NOT NULL,
          concreting_crew_size INTEGER DEFAULT 4,
          curing_days INTEGER DEFAULT 3,

          -- Move/clean norms
          move_clean_h_per_cycle REAL DEFAULT 2,

          -- Labor costs
          labor_cost_czk_h REAL DEFAULT 450,
          machine_cost_czk_h REAL DEFAULT 800,

          -- Confidence and metadata
          confidence REAL DEFAULT 0.9,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[Migration 006] ✓ normsets table created');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration 006] Error creating normsets:', error);
      } else {
        console.log('[Migration 006] ✓ normsets table already exists');
      }
    }

    // 4. Seed normsets with default data
    try {
      console.log('[Migration 006] Seeding normsets with default data...');
      const normsetCount = await db.prepare('SELECT COUNT(*) as count FROM normsets').get();

      if (normsetCount.count === 0) {
        await db.exec(`
          INSERT INTO normsets (id, name, source_tag, rebar_h_per_t, rebar_crew_size, formwork_h_per_m2, formwork_crew_size, stripping_h_per_m2, concreting_h_per_m3, concreting_crew_size, curing_days, move_clean_h_per_cycle, labor_cost_czk_h, machine_cost_czk_h, confidence)
          VALUES
            ('urs2024', 'ÚRS 2024', 'URS', 16.0, 4, 1.2, 3, 0.4, 0.8, 4, 3, 2.0, 450, 800, 0.95),
            ('rts2023', 'RTS 2023', 'RTS', 18.0, 4, 1.5, 3, 0.5, 1.0, 4, 3, 2.5, 420, 750, 0.90),
            ('kros2024', 'KROS 2024', 'KROS', 15.0, 4, 1.0, 3, 0.35, 0.7, 4, 3, 1.8, 480, 850, 0.92),
            ('internal', 'Internal', 'INTERNAL', 14.0, 4, 0.9, 3, 0.3, 0.6, 4, 2, 1.5, 500, 900, 0.85);
        `);
        console.log('[Migration 006] ✓ Seeded 4 normsets');
      } else {
        console.log('[Migration 006] ✓ Normsets already seeded');
      }
    } catch (error) {
      console.error('[Migration 006] Error seeding normsets:', error);
    }

    // 5. Create captures table (takts)
    try {
      console.log('[Migration 006] Creating captures table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS captures (
          id VARCHAR(255) PRIMARY KEY,
          r0_project_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,

          -- Capture parameters
          sequence INTEGER NOT NULL,
          element_id VARCHAR(255),

          -- Volume for this capture
          volume_m3 REAL NOT NULL DEFAULT 0,
          formwork_m2 REAL DEFAULT 0,
          rebar_t REAL DEFAULT 0,

          -- Selected normset
          normset_id VARCHAR(255) DEFAULT 'urs2024',

          -- Metadata
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

          FOREIGN KEY (r0_project_id) REFERENCES r0_projects(id) ON DELETE CASCADE,
          FOREIGN KEY (element_id) REFERENCES elements(id) ON DELETE SET NULL,
          FOREIGN KEY (normset_id) REFERENCES normsets(id) ON DELETE SET NULL
        );
      `);
      console.log('[Migration 006] ✓ captures table created');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration 006] Error creating captures:', error);
      } else {
        console.log('[Migration 006] ✓ captures table already exists');
      }
    }

    // 6. Create tasks table (generated tasks)
    try {
      console.log('[Migration 006] Creating tasks table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id VARCHAR(255) PRIMARY KEY,
          capture_id VARCHAR(255) NOT NULL,

          -- Task info
          type VARCHAR(50) NOT NULL,
          sequence INTEGER NOT NULL,
          description VARCHAR(500),

          -- Duration and resources
          duration_days REAL NOT NULL DEFAULT 0,
          labor_hours REAL NOT NULL DEFAULT 0,
          crew_size INTEGER DEFAULT 4,

          -- Costs (calculated)
          cost_labor REAL DEFAULT 0,
          cost_machine REAL DEFAULT 0,

          -- Dependencies
          depends_on TEXT,

          -- Traceability
          source_tag VARCHAR(50),
          confidence REAL DEFAULT 0.9,
          assumptions_log TEXT,

          -- Metadata
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

          FOREIGN KEY (capture_id) REFERENCES captures(id) ON DELETE CASCADE
        );
      `);
      console.log('[Migration 006] ✓ tasks table created');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration 006] Error creating tasks:', error);
      } else {
        console.log('[Migration 006] ✓ tasks table already exists');
      }
    }

    // 7. Create schedule table
    try {
      console.log('[Migration 006] Creating schedule table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS schedule (
          id VARCHAR(255) PRIMARY KEY,
          r0_project_id VARCHAR(255) NOT NULL,
          task_id VARCHAR(255) NOT NULL,

          -- Timing
          start_day REAL NOT NULL,
          end_day REAL NOT NULL,

          -- Critical path
          is_critical BOOLEAN DEFAULT FALSE,
          slack_days REAL DEFAULT 0,

          -- Resource assignment
          resource_id VARCHAR(255),
          resource_utilization REAL DEFAULT 1.0,

          -- Metadata
          calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

          FOREIGN KEY (r0_project_id) REFERENCES r0_projects(id) ON DELETE CASCADE,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
      `);
      console.log('[Migration 006] ✓ schedule table created');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration 006] Error creating schedule:', error);
      } else {
        console.log('[Migration 006] ✓ schedule table already exists');
      }
    }

    // 8. Create cost_breakdown table
    try {
      console.log('[Migration 006] Creating cost_breakdown table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS cost_breakdown (
          id VARCHAR(255) PRIMARY KEY,
          r0_project_id VARCHAR(255) NOT NULL,
          task_id VARCHAR(255),

          -- Cost category
          category VARCHAR(50) NOT NULL,
          subcategory VARCHAR(100),

          -- Amounts
          amount_czk REAL NOT NULL DEFAULT 0,
          quantity REAL,
          unit VARCHAR(20),
          unit_price REAL,

          -- Traceability
          source_tag VARCHAR(50),
          formula_used TEXT,
          assumptions_log TEXT,

          -- Metadata
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

          FOREIGN KEY (r0_project_id) REFERENCES r0_projects(id) ON DELETE CASCADE,
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
        );
      `);
      console.log('[Migration 006] ✓ cost_breakdown table created');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration 006] Error creating cost_breakdown:', error);
      } else {
        console.log('[Migration 006] ✓ cost_breakdown table already exists');
      }
    }

    // 9. Create bottlenecks table
    try {
      console.log('[Migration 006] Creating bottlenecks table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS bottlenecks (
          id VARCHAR(255) PRIMARY KEY,
          r0_project_id VARCHAR(255) NOT NULL,

          -- Bottleneck info
          resource_type VARCHAR(50) NOT NULL,
          resource_id VARCHAR(255),

          -- Period
          start_day REAL NOT NULL,
          end_day REAL NOT NULL,

          -- Severity
          severity VARCHAR(20) NOT NULL,
          overload_percent REAL,

          -- Suggestion
          suggestion TEXT,

          -- Metadata
          detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

          FOREIGN KEY (r0_project_id) REFERENCES r0_projects(id) ON DELETE CASCADE
        );
      `);
      console.log('[Migration 006] ✓ bottlenecks table created');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration 006] Error creating bottlenecks:', error);
      } else {
        console.log('[Migration 006] ✓ bottlenecks table already exists');
      }
    }

    // 10. Create indexes for R0 tables
    try {
      console.log('[Migration 006] Creating indexes for R0 tables...');
      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_r0_projects_portal ON r0_projects(portal_project_id);
        CREATE INDEX IF NOT EXISTS idx_elements_r0_project ON elements(r0_project_id);
        CREATE INDEX IF NOT EXISTS idx_elements_type ON elements(element_type);
        CREATE INDEX IF NOT EXISTS idx_captures_r0_project ON captures(r0_project_id);
        CREATE INDEX IF NOT EXISTS idx_captures_sequence ON captures(sequence);
        CREATE INDEX IF NOT EXISTS idx_tasks_capture ON tasks(capture_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
        CREATE INDEX IF NOT EXISTS idx_schedule_r0_project ON schedule(r0_project_id);
        CREATE INDEX IF NOT EXISTS idx_schedule_task ON schedule(task_id);
        CREATE INDEX IF NOT EXISTS idx_schedule_critical ON schedule(is_critical);
        CREATE INDEX IF NOT EXISTS idx_cost_breakdown_project ON cost_breakdown(r0_project_id);
        CREATE INDEX IF NOT EXISTS idx_cost_breakdown_category ON cost_breakdown(category);
        CREATE INDEX IF NOT EXISTS idx_bottlenecks_project ON bottlenecks(r0_project_id);
        CREATE INDEX IF NOT EXISTS idx_bottlenecks_severity ON bottlenecks(severity);
      `);
      console.log('[Migration 006] ✓ R0 indexes created');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration 006] Error creating indexes:', error);
      } else {
        console.log('[Migration 006] ✓ R0 indexes already exist');
      }
    }

    console.log('[PostgreSQL Migrations] ✅ Phase 6 R0 migrations completed successfully');
  } catch (error) {
    console.error('[PostgreSQL Migrations] Error during Phase 6 migrations:', error);
    console.error('[Migration 006] ⚠️  R0 migration failed, but continuing startup...');
  }
}

/**
 * Migration Phase 7 - Portal Integration
 * Adds portal_project_id to monolith_projects for linking to stavagent-portal
 * This enables data synchronization between Monolit-Planner and other kiosks
 */
async function runPhase7PortalIntegration() {
  try {
    console.log('[PostgreSQL Migrations] Running Phase 7 migration (Portal Integration)...');

    // Add portal_project_id column to monolith_projects
    try {
      console.log('[Migration 007] Adding portal_project_id to monolith_projects...');
      await db.exec(`
        ALTER TABLE monolith_projects
        ADD COLUMN IF NOT EXISTS portal_project_id VARCHAR(255);
      `);
      console.log('[Migration 007] ✓ portal_project_id column added');
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('column')) {
        console.error('[Migration 007] Error adding portal_project_id:', error);
      } else {
        console.log('[Migration 007] ✓ portal_project_id column already exists');
      }
    }

    // Add portal_linked_at timestamp column
    try {
      console.log('[Migration 007] Adding portal_linked_at to monolith_projects...');
      await db.exec(`
        ALTER TABLE monolith_projects
        ADD COLUMN IF NOT EXISTS portal_linked_at TIMESTAMP;
      `);
      console.log('[Migration 007] ✓ portal_linked_at column added');
    } catch (error) {
      if (!error.message.includes('already exists') && !error.message.includes('column')) {
        console.error('[Migration 007] Error adding portal_linked_at:', error);
      } else {
        console.log('[Migration 007] ✓ portal_linked_at column already exists');
      }
    }

    // Create index for portal_project_id
    try {
      console.log('[Migration 007] Creating index for portal_project_id...');
      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_monolith_projects_portal ON monolith_projects(portal_project_id);
      `);
      console.log('[Migration 007] ✓ Portal index created');
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('[Migration 007] Error creating index:', error);
      } else {
        console.log('[Migration 007] ✓ Portal index already exists');
      }
    }

    console.log('[PostgreSQL Migrations] ✅ Phase 7 Portal Integration completed successfully');
  } catch (error) {
    console.error('[PostgreSQL Migrations] Error during Phase 7 migration:', error);
    console.error('[Migration 007] ⚠️  Portal migration failed, but continuing startup...');
  }
}

/**
 * Migration Phase 8 - Formwork Calculator + curing_days
 */
async function runPhase8FormworkCalculator() {
  try {
    console.log('[PostgreSQL Migrations] Running Phase 8 (Formwork Calculator + curing_days)...');

    // Add curing_days to positions
    try {
      await db.exec(`ALTER TABLE positions ADD COLUMN curing_days INTEGER DEFAULT 3`);
      console.log('[Migration 008] ✓ curing_days column added (default 3)');
    } catch (error) {
      if (error.message?.includes('already exists') || error.message?.includes('duplicate column')) {
        console.log('[Migration 008] ✓ curing_days column already exists');
      } else {
        console.error('[Migration 008] Error adding curing_days:', error);
      }
    }

    // Create formwork_calculator table
    try {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS formwork_calculator (
          id VARCHAR(255) PRIMARY KEY,
          bridge_id VARCHAR(255) NOT NULL,
          construction_name VARCHAR(500) NOT NULL,
          total_area_m2 REAL NOT NULL DEFAULT 0,
          set_area_m2 REAL NOT NULL DEFAULT 0,
          num_tacts INTEGER NOT NULL DEFAULT 1,
          num_sets INTEGER NOT NULL DEFAULT 1,
          assembly_days_per_tact REAL DEFAULT 0,
          disassembly_days_per_tact REAL DEFAULT 0,
          days_per_tact REAL DEFAULT 0,
          formwork_term_days REAL DEFAULT 0,
          system_name VARCHAR(255) DEFAULT 'Frami Xlife',
          system_height VARCHAR(100) DEFAULT '',
          rental_czk_per_m2_month REAL DEFAULT 0,
          monthly_rental_per_set REAL DEFAULT 0,
          final_rental_czk REAL DEFAULT 0,
          kros_code VARCHAR(50),
          kros_description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[Migration 008] ✓ formwork_calculator table created');
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log('[Migration 008] ✓ formwork_calculator table already exists');
      } else {
        console.error('[Migration 008] Error creating formwork_calculator:', error);
      }
    }

    console.log('[PostgreSQL Migrations] ✅ Phase 8 Formwork Calculator completed');
  } catch (error) {
    console.error('[PostgreSQL Migrations] Error during Phase 8:', error);
    console.error('[Migration 008] ⚠️  Phase 8 failed, but continuing startup...');
  }
}

/**
 * Initialize SQLite schema (existing logic from init.js)
 */
async function initSqliteSchema() {
  // Positions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      bridge_id TEXT NOT NULL,
      part_name TEXT NOT NULL,
      subtype TEXT NOT NULL,
      unit TEXT NOT NULL,
      qty REAL NOT NULL,
      qty_m3_helper REAL,
      crew_size INTEGER NOT NULL DEFAULT 4,
      wage_czk_ph REAL NOT NULL DEFAULT 398,
      shift_hours REAL NOT NULL DEFAULT 10,
      days REAL NOT NULL DEFAULT 0,
      labor_hours REAL,
      cost_czk REAL,
      unit_cost_native REAL,
      concrete_m3 REAL,
      unit_cost_on_m3 REAL,
      kros_unit_czk REAL,
      kros_total_czk REAL,
      curing_days INTEGER DEFAULT 3,
      has_rfi INTEGER DEFAULT 0,
      rfi_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add curing_days column if missing (for existing databases)
  try {
    db.exec(`ALTER TABLE positions ADD COLUMN curing_days INTEGER DEFAULT 3`);
  } catch (_) { /* column already exists */ }

  // Formwork calculator table
  db.exec(`
    CREATE TABLE IF NOT EXISTS formwork_calculator (
      id TEXT PRIMARY KEY,
      bridge_id TEXT NOT NULL,
      construction_name TEXT NOT NULL,
      total_area_m2 REAL NOT NULL DEFAULT 0,
      set_area_m2 REAL NOT NULL DEFAULT 0,
      num_tacts INTEGER NOT NULL DEFAULT 1,
      num_sets INTEGER NOT NULL DEFAULT 1,
      assembly_days_per_tact REAL DEFAULT 0,
      disassembly_days_per_tact REAL DEFAULT 0,
      days_per_tact REAL DEFAULT 0,
      formwork_term_days REAL DEFAULT 0,
      system_name TEXT DEFAULT 'Frami Xlife',
      system_height TEXT DEFAULT '',
      rental_czk_per_m2_month REAL DEFAULT 0,
      monthly_rental_per_set REAL DEFAULT 0,
      final_rental_czk REAL DEFAULT 0,
      kros_code TEXT,
      kros_description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bridge_id) REFERENCES bridges(bridge_id)
    );
  `);

  // Bridges table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bridges (
      bridge_id TEXT PRIMARY KEY,
      object_name TEXT NOT NULL DEFAULT '',
      element_count INTEGER DEFAULT 0,
      concrete_m3 REAL DEFAULT 0,
      sum_kros_czk REAL DEFAULT 0,
      span_length_m REAL,
      deck_width_m REAL,
      pd_weeks REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Phase 4: Documents table (SQLite)
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      original_filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      file_type TEXT,
      status TEXT DEFAULT 'uploaded',
      analysis_status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Phase 4: Document analyses table (SQLite)
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_analyses (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      workflow_id TEXT,
      workflow_type TEXT,
      parsed_positions TEXT,
      materials TEXT,
      dimensions TEXT,
      analysis_metadata TEXT,
      audit_results TEXT,
      ai_enrichment TEXT,
      status TEXT DEFAULT 'completed',
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
  `);

  // Phase 4: Work lists table (SQLite)
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_lists (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      document_id TEXT,
      user_id INTEGER NOT NULL,
      title TEXT,
      description TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Phase 4: Work list items table (SQLite)
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_list_items (
      id TEXT PRIMARY KEY,
      work_list_id TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT,
      unit TEXT,
      quantity REAL,
      otskp_code TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_list_id) REFERENCES work_lists(id) ON DELETE CASCADE
    );
  `);

  // Apply SQLite-specific migrations
  await applySqliteMigrations();

  // Snapshots table
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      bridge_id TEXT NOT NULL,
      snapshot_name TEXT,
      snapshot_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      positions_snapshot TEXT NOT NULL,
      header_kpi_snapshot TEXT NOT NULL,
      description TEXT,
      is_locked INTEGER DEFAULT 1,
      parent_snapshot_id TEXT,
      sum_kros_at_lock REAL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bridge_id) REFERENCES bridges(bridge_id),
      FOREIGN KEY (parent_snapshot_id) REFERENCES snapshots(id)
    );
  `);

  // Migration: Add is_final column to snapshots if it doesn't exist
  const snapshotColumns = db.prepare("PRAGMA table_info(snapshots)").all();
  const hasIsFinal = snapshotColumns.some(col => col.name === 'is_final');
  if (!hasIsFinal) {
    db.exec("ALTER TABLE snapshots ADD COLUMN is_final INTEGER DEFAULT 0");
    console.log('[MIGRATION] Added is_final column to snapshots table');
  }

  // Add owner_id to bridges
  const bridgeColumns = db.prepare("PRAGMA table_info(bridges)").all();
  const hasOwnerId = bridgeColumns.some(col => col.name === 'owner_id');
  if (!hasOwnerId) {
    db.exec("ALTER TABLE bridges ADD COLUMN owner_id INTEGER");
    console.log('[MIGRATION] Added owner_id column to bridges table');
  }

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      email_verified INTEGER DEFAULT 0,
      email_verified_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create email verification tokens table (Phase 1: Email Verification)
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create password reset tokens table (Phase 2: Password Reset)
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create audit logs table (Phase 3: Admin Panel & Audit Logging)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      data TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create indexes for snapshots and audit_logs
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_bridge ON snapshots(bridge_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_snapshots_locked ON snapshots(is_locked);
    CREATE INDEX IF NOT EXISTS idx_snapshots_final ON snapshots(is_final);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
  `);

  // Mapping profiles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS mapping_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      column_mapping TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Project config table
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      feature_flags TEXT NOT NULL,
      defaults TEXT NOT NULL,
      days_per_month_mode INTEGER NOT NULL DEFAULT 30,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default config if not exists
  const configExists = db.prepare('SELECT id FROM project_config WHERE id = 1').get();
  if (!configExists) {
    const defaultFeatureFlags = JSON.stringify({
      FF_AI_DAYS_SUGGEST: true,  // ✅ AI-powered days estimation (Time Norms Automation)
      FF_PUMP_MODULE: false,
      FF_ADVANCED_METRICS: false,
      FF_DARK_MODE: false,
      FF_SPEED_ANALYSIS: false
    });

    const defaultDefaults = JSON.stringify({
      ROUNDING_STEP_KROS: 50,
      RHO_T_PER_M3: 2.4,
      LOCALE: 'cs-CZ',
      CURRENCY: 'CZK',
      DAYS_PER_MONTH_OPTIONS: [30, 22],
      DAYS_PER_MONTH_DEFAULT: 30,
      SNAPSHOT_RETENTION_DAYS: 30,
      REQUIRE_SNAPSHOT_FOR_EXPORT: true,
      AUTO_SNAPSHOT_ON_EXPORT: false
    });

    db.prepare(`
      INSERT INTO project_config (id, feature_flags, defaults, days_per_month_mode)
      VALUES (1, ?, ?, 30)
    `).run(defaultFeatureFlags, defaultDefaults);
  }

  // OTSKP codes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS otskp_codes (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      unit_price REAL NOT NULL,
      specification TEXT,
      search_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: ensure search_name column exists
  const otskpColumns = db.prepare("PRAGMA table_info(otskp_codes)").all();
  const hasSearchName = otskpColumns.some(col => col.name === 'search_name');
  if (!hasSearchName) {
    db.exec("ALTER TABLE otskp_codes ADD COLUMN search_name TEXT");
  }

  // Backfill search_name for existing records
  const missingSearchName = db.prepare(`
    SELECT COUNT(*) as count
    FROM otskp_codes
    WHERE search_name IS NULL OR search_name = ''
  `).get();

  if (missingSearchName.count > 0) {
    const rows = db.prepare(`
      SELECT code, name
      FROM otskp_codes
      WHERE search_name IS NULL OR search_name = ''
    `).all();

    const updateStmt = db.prepare(`
      UPDATE otskp_codes
      SET search_name = ?
      WHERE code = ?
    `);

    const updateMany = db.transaction((items) => {
      for (const item of items) {
        updateStmt.run(normalizeForSearch(item.name), item.code);
      }
    });

    updateMany(rows);
    console.log(`[MIGRATION] Backfilled search_name for ${rows.length} OTSKP codes`);
  }

  // MonolithProjects table (simple universal object for all construction types)
  // VARIANT 1: Single object type - user describes type in object_name
  db.exec(`
    CREATE TABLE IF NOT EXISTS monolith_projects (
      project_id TEXT PRIMARY KEY,
      project_name TEXT,
      object_name TEXT NOT NULL DEFAULT '',
      owner_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      element_count INTEGER DEFAULT 0,
      concrete_m3 REAL DEFAULT 0,
      sum_kros_czk REAL DEFAULT 0,
      description TEXT,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Part Templates table (universal parts for all object types)
  db.exec(`
    CREATE TABLE IF NOT EXISTS part_templates (
      template_id TEXT PRIMARY KEY,
      part_name TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 1,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Parts table (actual parts for each project)
  db.exec(`
    CREATE TABLE IF NOT EXISTS parts (
      part_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      part_name TEXT NOT NULL,
      is_predefined INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id) ON DELETE CASCADE
    );

    -- Sheathing Captures table for formwork calculations (checkerboard method)
    CREATE TABLE IF NOT EXISTS sheathing_captures (
      capture_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      part_name TEXT NOT NULL,

      -- Dimensions
      length_m REAL NOT NULL,
      width_m REAL NOT NULL,
      height_m REAL,
      area_m2 REAL NOT NULL,
      volume_m3 REAL,

      -- Work characteristics
      assembly_norm_ph_m2 REAL NOT NULL DEFAULT 1.0,
      concrete_class TEXT,
      concrete_curing_days INTEGER NOT NULL DEFAULT 5,

      -- Kit/rental info
      num_kits INTEGER NOT NULL DEFAULT 2,
      kit_type TEXT,
      daily_rental_cost_czk REAL,

      -- Work method: 'sequential' or 'staggered' (checkerboard)
      work_method TEXT NOT NULL DEFAULT 'staggered',

      -- Calculated fields
      single_cycle_days INTEGER,
      project_duration_days INTEGER,
      crew_size INTEGER DEFAULT 4,
      shift_hours INTEGER DEFAULT 10,
      days_per_month INTEGER DEFAULT 22,

      -- Cost estimates
      assembly_labor_hours REAL,
      disassembly_labor_hours REAL,
      total_rental_cost_czk REAL,

      -- Metadata
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id) ON DELETE CASCADE
    );

    -- Sheathing Project Configuration
    CREATE TABLE IF NOT EXISTS sheathing_project_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL UNIQUE,

      -- Default values for new captures
      default_assembly_norm_ph_m2 REAL NOT NULL DEFAULT 1.0,
      default_concrete_curing_days INTEGER NOT NULL DEFAULT 5,
      default_num_kits INTEGER NOT NULL DEFAULT 2,
      default_work_method TEXT NOT NULL DEFAULT 'staggered',

      -- Concrete defaults
      concrete_class_default TEXT,

      -- Rental info
      daily_rental_cost_per_kit_czk REAL,

      -- Labor defaults
      crew_size INTEGER NOT NULL DEFAULT 4,
      shift_hours INTEGER NOT NULL DEFAULT 10,
      days_per_month INTEGER NOT NULL DEFAULT 22,

      -- Metadata
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id) ON DELETE CASCADE
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_positions_bridge ON positions(bridge_id);
    CREATE INDEX IF NOT EXISTS idx_positions_part ON positions(part_name);
    CREATE INDEX IF NOT EXISTS idx_positions_subtype ON positions(subtype);
    CREATE INDEX IF NOT EXISTS idx_positions_otskp ON positions(otskp_code);
    CREATE INDEX IF NOT EXISTS idx_otskp_code ON otskp_codes(code);
    CREATE INDEX IF NOT EXISTS idx_otskp_name ON otskp_codes(name);
    CREATE INDEX IF NOT EXISTS idx_otskp_search_name ON otskp_codes(search_name);
    CREATE INDEX IF NOT EXISTS idx_bridges_owner ON bridges(owner_id);
    CREATE INDEX IF NOT EXISTS idx_bridges_status ON bridges(status);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_monolith_projects_owner ON monolith_projects(owner_id);
    CREATE INDEX IF NOT EXISTS idx_monolith_projects_status ON monolith_projects(status);
    CREATE INDEX IF NOT EXISTS idx_parts_project ON parts(project_id);
    CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
    CREATE INDEX IF NOT EXISTS idx_document_analyses_document ON document_analyses(document_id);
    CREATE INDEX IF NOT EXISTS idx_document_analyses_status ON document_analyses(status);
    CREATE INDEX IF NOT EXISTS idx_work_lists_project ON work_lists(project_id);
    CREATE INDEX IF NOT EXISTS idx_work_lists_user ON work_lists(user_id);
    CREATE INDEX IF NOT EXISTS idx_work_list_items_work_list ON work_list_items(work_list_id);
    CREATE INDEX IF NOT EXISTS idx_sheathing_captures_project ON sheathing_captures(project_id);
    CREATE INDEX IF NOT EXISTS idx_sheathing_captures_part ON sheathing_captures(part_name);
    CREATE INDEX IF NOT EXISTS idx_sheathing_configs_project ON sheathing_project_configs(project_id);
  `);

  // Seed part templates for all construction types
  const partTemplates = [
    // Bridge parts
    { template_id: 'bridge_ZÁKLADY', object_type: 'bridge', part_name: 'ZÁKLADY', display_order: 1, is_default: 1, description: 'Hloubkové a plošné založení' },
    { template_id: 'bridge_OPĚRY', object_type: 'bridge', part_name: 'OPĚRY', display_order: 2, is_default: 1, description: 'Koncové opěry/krajní podpory' },
    { template_id: 'bridge_PILÍŘE', object_type: 'bridge', part_name: 'PILÍŘE', display_order: 3, is_default: 1, description: 'Mezipolí/středové pilíře' },
    { template_id: 'bridge_KLENBY', object_type: 'bridge', part_name: 'KLENBY', display_order: 4, is_default: 1, description: 'Rozpětná pole/pěšinka' },
    { template_id: 'bridge_ŘÍMSY', object_type: 'bridge', part_name: 'ŘÍMSY', display_order: 5, is_default: 1, description: 'Římsové profily a ochranné prvky' },
    // Building parts
    { template_id: 'building_ZÁKLADY', object_type: 'building', part_name: 'ZÁKLADY', display_order: 1, is_default: 1, description: 'Hloubkové a plošné základy' },
    { template_id: 'building_SLOUPY', object_type: 'building', part_name: 'SLOUPY', display_order: 2, is_default: 1, description: 'Nosné sloupy' },
    { template_id: 'building_STĚNY', object_type: 'building', part_name: 'STĚNY', display_order: 3, is_default: 1, description: 'Nosné a obvodové stěny' },
    { template_id: 'building_STROPY', object_type: 'building', part_name: 'STROPY', display_order: 4, is_default: 1, description: 'Stropní desky a konstrukce' },
    { template_id: 'building_SCHODIŠTĚ', object_type: 'building', part_name: 'SCHODIŠTĚ', display_order: 5, is_default: 0, description: 'Schodiště a výtahové šachty' },
    // Parking parts
    { template_id: 'parking_ZÁKLADY', object_type: 'parking', part_name: 'ZÁKLADY', display_order: 1, is_default: 1, description: 'Hloubkové založení' },
    { template_id: 'parking_SLOUPY', object_type: 'parking', part_name: 'SLOUPY', display_order: 2, is_default: 1, description: 'Nosné sloupy' },
    { template_id: 'parking_STĚNY', object_type: 'parking', part_name: 'STĚNY', display_order: 3, is_default: 1, description: 'Obvodové a nosné stěny' },
    { template_id: 'parking_STROPY', object_type: 'parking', part_name: 'STROPY', display_order: 4, is_default: 1, description: 'Stropní platformy' },
    { template_id: 'parking_RAMPY', object_type: 'parking', part_name: 'RAMPY', display_order: 5, is_default: 1, description: 'Sjezdové rampy a komunikace' },
    // Road parts
    { template_id: 'road_ZÁKLADY', object_type: 'road', part_name: 'ZÁKLADY', display_order: 1, is_default: 1, description: 'Zemní těleso/podklad' },
    { template_id: 'road_PODBASE', object_type: 'road', part_name: 'PODBASE', display_order: 2, is_default: 1, description: 'Podkladní stabilizační vrstva' },
    { template_id: 'road_ASFALT', object_type: 'road', part_name: 'ASFALT', display_order: 3, is_default: 1, description: 'Asfaltobetonová vrstva' },
    { template_id: 'road_DRENÁŽ', object_type: 'road', part_name: 'DRENÁŽ', display_order: 4, is_default: 1, description: 'Drenážní systém' }
  ];

  const insertTemplate = db.prepare(`
    INSERT OR IGNORE INTO part_templates (template_id, part_name, display_order, is_default, description)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertManyTemplates = db.transaction((templates) => {
    for (const tpl of templates) {
      insertTemplate.run(tpl.template_id, tpl.part_name, tpl.display_order, tpl.is_default, tpl.description);
    }
  });

  insertManyTemplates(partTemplates);
  console.log('[MIGRATION] Seeded part templates (universal for all object types)');

  // Auto-load OTSKP codes if database is empty
  await autoLoadOtskpCodesIfNeeded();

  // Auto-load part templates if database is empty (SQLite)
  await autoLoadPartTemplatesIfNeeded();
}

/**
 * Apply SQLite-specific column migrations
 */
async function applySqliteMigrations() {
  const columns = db.prepare("PRAGMA table_info(bridges)").all();

  // object_name
  const hasObjectName = columns.some(col => col.name === 'object_name');
  if (!hasObjectName) {
    db.exec("ALTER TABLE bridges ADD COLUMN object_name TEXT NOT NULL DEFAULT ''");
  }

  // project_name
  const hasProjectName = columns.some(col => col.name === 'project_name');
  if (!hasProjectName) {
    db.exec("ALTER TABLE bridges ADD COLUMN project_name TEXT DEFAULT ''");
    console.log('[MIGRATION] Added project_name column to bridges table');
  }

  // status
  const hasStatus = columns.some(col => col.name === 'status');
  if (!hasStatus) {
    db.exec("ALTER TABLE bridges ADD COLUMN status TEXT DEFAULT 'active'");
    console.log('[MIGRATION] Added status column to bridges table');
  }

  // Positions table migrations
  const posColumns = db.prepare("PRAGMA table_info(positions)").all();

  const hasItemName = posColumns.some(col => col.name === 'item_name');
  if (!hasItemName) {
    db.exec("ALTER TABLE positions ADD COLUMN item_name TEXT");
  }

  const hasOtskpCode = posColumns.some(col => col.name === 'otskp_code');
  if (!hasOtskpCode) {
    db.exec("ALTER TABLE positions ADD COLUMN otskp_code TEXT");
  }

  // Phase 7: Portal Integration columns for monolith_projects (SQLite)
  const mpColumns = db.prepare("PRAGMA table_info(monolith_projects)").all();

  const hasPortalProjectId = mpColumns.some(col => col.name === 'portal_project_id');
  if (!hasPortalProjectId) {
    db.exec("ALTER TABLE monolith_projects ADD COLUMN portal_project_id TEXT");
    console.log('[MIGRATION] Added portal_project_id column to monolith_projects table');
  }

  const hasPortalLinkedAt = mpColumns.some(col => col.name === 'portal_linked_at');
  if (!hasPortalLinkedAt) {
    db.exec("ALTER TABLE monolith_projects ADD COLUMN portal_linked_at TEXT");
    console.log('[MIGRATION] Added portal_linked_at column to monolith_projects table');
  }
}

/**
 * Auto-load OTSKP codes from XML file if database is empty
 * Works with both SQLite and PostgreSQL
 */
async function autoLoadOtskpCodesIfNeeded() {
  try {
    const countResult = await db.prepare('SELECT COUNT(*) as count FROM otskp_codes').get();

    if (countResult && countResult.count > 0) {
      console.log(`[OTSKP] Database already has ${countResult.count} codes, skipping auto-load`);
      return;
    }

    console.log('[OTSKP] Database is empty, attempting to auto-load codes from XML...');

    // Try multiple paths for XML file
    const possiblePaths = [
      join(__dirname, '../../2025_03 OTSKP.xml'),
      join(__dirname, '../../../2025_03 OTSKP.xml'),
      '/app/2025_03 OTSKP.xml',
      '/workspace/2025_03 OTSKP.xml',
      process.cwd() + '/2025_03 OTSKP.xml'
    ];

    let xmlPath = null;
    for (const path of possiblePaths) {
      if (fs.existsSync(path)) {
        xmlPath = path;
        console.log(`[OTSKP] Found XML file at: ${xmlPath}`);
        break;
      }
    }

    if (!xmlPath) {
      console.warn('[OTSKP] ⚠️  XML file not found. Codes will not be loaded.');
      return;
    }

    // Parse and load XML
    const xmlContent = fs.readFileSync(xmlPath, 'utf-8');
    const items = parseOtskpXml(xmlContent);

    if (items.length === 0) {
      console.warn('[OTSKP] XML parsing returned 0 items');
      return;
    }

    // Insert into database (works with both SQLite and PostgreSQL)
    const insertStmt = db.prepare(`
      INSERT INTO otskp_codes (code, name, unit, unit_price, specification, search_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // For SQLite: use synchronous transaction
    // For PostgreSQL: db.transaction just calls the callback immediately (not a real transaction)
    if (db.isSqlite) {
      const insertMany = db.transaction((itemsToInsert) => {
        for (const item of itemsToInsert) {
          insertStmt.run(
            item.code,
            item.name,
            item.unit,
            item.unit_price,
            item.specification,
            item.searchName
          );
        }
      });
      insertMany(items);
    } else {
      // For PostgreSQL, execute inserts asynchronously
      for (const item of items) {
        await insertStmt.run(
          item.code,
          item.name,
          item.unit,
          item.unit_price,
          item.specification,
          item.searchName
        );
      }
    }

    console.log(`[OTSKP] ✅ Successfully auto-loaded ${items.length} codes from XML`);

  } catch (error) {
    console.error('[OTSKP] ⚠️  Error during auto-load:', error.message);
    console.warn('[OTSKP] Continuing startup without codes.');
  }
}

/**
 * Parse OTSKP XML file
 */
function parseOtskpXml(xmlContent) {
  const items = [];

  xmlContent = xmlContent.replace(/^\uFEFF/, '');
  const polozkaRegex = /<Polozka>([\s\S]*?)<\/Polozka>/g;
  const matches = xmlContent.matchAll(polozkaRegex);

  for (const match of matches) {
    const polozkaContent = match[1];

    const codeMatch = polozkaContent.match(/<znacka>(.*?)<\/znacka>/);
    const nameMatch = polozkaContent.match(/<nazev>(.*?)<\/nazev>/);
    const unitMatch = polozkaContent.match(/<MJ>(.*?)<\/MJ>/);
    const priceMatch = polozkaContent.match(/<jedn_cena>(.*?)<\/jedn_cena>/);
    const specMatch = polozkaContent.match(/<technicka_specifikace>([\s\S]*?)<\/technicka_specifikace>/);

    // Validate required fields
    if (!codeMatch || !codeMatch[1].trim() ||
        !nameMatch || !nameMatch[1].trim() ||
        !unitMatch || !unitMatch[1].trim() ||
        !priceMatch || isNaN(parseFloat(priceMatch[1].trim()))) {
      continue;
    }

    items.push({
      code: codeMatch[1].trim(),
      name: nameMatch[1].trim(),
      unit: unitMatch[1].trim(),
      unit_price: parseFloat(priceMatch[1].trim()),
      specification: specMatch ? specMatch[1].trim() : null,
      searchName: normalizeForSearch(nameMatch[1].trim())
    });
  }

  return items;
}

/**
 * Auto-load part templates if database is empty
 * This ensures predefined parts exist for each object type
 */
async function autoLoadPartTemplatesIfNeeded() {
  try {
    console.log('[Part Templates] Checking if templates need to be loaded...');

    // Check if templates already exist
    const count = await db.prepare('SELECT COUNT(*) as count FROM part_templates').get();
    console.log(`[Part Templates] Current count in database: ${count.count}`);

    // Get expected count from unified object templates module
    const templateSummary = getTemplateSummary();
    const expectedTotal = Object.values(templateSummary).reduce((a, b) => a + b, 0);

    // If templates exist and count matches expected, skip loading
    if (count.count >= expectedTotal) {
      console.log(`[Part Templates] ✓ Already loaded (${count.count} templates exist)`);
      console.log('[Part Templates] Summary by type:', templateSummary);
      return;
    }

    // If old templates exist (fewer than expected), delete and reload
    if (count.count > 0 && count.count < expectedTotal) {
      console.log(`[Part Templates] Found ${count.count} templates. Reloading with unified definitions (${expectedTotal} total)...`);
      await db.prepare('DELETE FROM part_templates').run();
      console.log('[Part Templates] Old templates deleted.');
    }

    console.log(`[Part Templates] Loading predefined templates from objectTemplates module (${expectedTotal} total)...`);

    // Load templates from unified objectTemplates module
    const templates = getAllTemplates();

    if (!templates || templates.length === 0) {
      console.warn('[Part Templates] ⚠️  No templates returned from objectTemplates module!');
      return;
    }

    // Insert all templates
    let inserted = 0;
    let errors = 0;
    for (const template of templates) {
      try {
        await db.prepare(`
          INSERT INTO part_templates (template_id, part_name, display_order, is_default, description)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          template.template_id,
          template.part_name,
          template.display_order,
          template.is_default,
          template.description || null
        );
        inserted++;
        console.log(`[Part Templates]   ✓ Inserted: ${template.part_name}`);
      } catch (error) {
        // Ignore duplicates
        if (error.message?.includes('UNIQUE constraint') || error.code?.includes('23505')) {
          console.log(`[Part Templates]   ⊘ Duplicate skipped: ${template.part_name}`);
        } else {
          errors++;
          console.error(`[Part Templates]   ✗ Error inserting ${template.part_name}:`, error.message);
        }
      }
    }

    if (errors > 0) {
      console.warn(`[Part Templates] ⚠️  ${errors} errors occurred during insertion`);
    }

    console.log(`[Part Templates] ✅ Successfully loaded ${inserted} templates`);

    // Show summary
    const totalCount = await db.prepare(`
      SELECT COUNT(*) as total FROM part_templates
    `).get();

    console.log('[Part Templates] Summary:');
    console.log(`  - Universal templates: ${totalCount.total} parts`);

  } catch (error) {
    console.error('[Part Templates] ⚠️  Error during auto-load:', error.message);
    console.warn('[Part Templates] Continuing startup without templates.');
  }
}

export default { initDatabase };
