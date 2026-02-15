/**
 * Database Migrations
 * Handles schema creation and migrations for both SQLite and PostgreSQL
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db, { USE_POSTGRES } from './index.js';
import { normalizeForSearch } from '../utils/text.js';

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
      FF_AI_DAYS_SUGGEST: false,
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

  // Create default kiosk user (id=1) if not exists
  const userExists = await db.prepare('SELECT id FROM users WHERE id = 1').get();
  if (!userExists) {
    await db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, email_verified)
      VALUES (1, 'kiosk@stavagent.local', 'kiosk_default', 'Kiosk System', 'admin', true)
    `).run();
    console.log('[Database] Created default kiosk user (id=1)');
  }

  // Run Phase 1 & 2 migrations (add missing columns/tables for existing databases)
  await runPhase1Phase2Migrations();

  // Run Phase 3 migrations (add admin panel and audit logging)
  await runPhase3Migrations();

  // Run Phase 4 migrations (document upload and analysis)
  await runPhase4Migrations();

  // Run Phase 5 migrations (Monolit-Registry integration)
  await runPhase5Migrations();

  // Auto-load OTSKP codes if database is empty
  await autoLoadOtskpCodesIfNeeded();
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
  }
}

/**
 * Migrations for Phase 5 - Monolit-Registry Integration
 */
async function runPhase5Migrations() {
  try {
    console.log('[PostgreSQL Migrations] Running Phase 5 migrations (Monolit-Registry Integration)...');

    if (USE_POSTGRES) {
      try {
        await db.exec(`
          ALTER TABLE kiosk_links
          ADD CONSTRAINT kiosk_links_portal_project_id_kiosk_type_key
          UNIQUE (portal_project_id, kiosk_type);
        `);
        console.log('[Migration] ✓ kiosk_links UNIQUE constraint added');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('[Migration] ✓ kiosk_links UNIQUE constraint already exists');
        }
      }
    }

    const migrationPath = join(__dirname, 'migrations', 'add-unified-project-structure.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.log('[Migration] ⚠️  Migration file not found, skipping Phase 5');
      return;
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await db.exec(migrationSQL);

    console.log('[Migration] ✓ portal_objects and portal_positions tables created');
    console.log('[PostgreSQL Migrations] ✅ Phase 5 migrations completed successfully');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('[Migration] ✓ Integration tables already exist');
    } else {
      console.error('[PostgreSQL Migrations] Error during Phase 5 migrations:', error);
    }
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
      has_rfi INTEGER DEFAULT 0,
      rfi_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
      FF_AI_DAYS_SUGGEST: false,
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

  // MonolithProjects table (universal object for all construction types)
  db.exec(`
    CREATE TABLE IF NOT EXISTS monolith_projects (
      project_id TEXT PRIMARY KEY,
      object_type TEXT NOT NULL DEFAULT 'custom',
      project_name TEXT,
      object_name TEXT NOT NULL DEFAULT '',
      owner_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      element_count INTEGER DEFAULT 0,
      concrete_m3 REAL DEFAULT 0,
      sum_kros_czk REAL DEFAULT 0,
      span_length_m REAL,
      deck_width_m REAL,
      pd_weeks REAL,
      building_area_m2 REAL,
      building_floors INTEGER,
      road_length_km REAL,
      road_width_m REAL,
      description TEXT,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // (Removed part_templates and parts tables - not used in Portal after VARIANT 1 migration)

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
    CREATE INDEX IF NOT EXISTS idx_monolith_projects_type ON monolith_projects(object_type);
    CREATE INDEX IF NOT EXISTS idx_monolith_projects_status ON monolith_projects(status);
    CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
    CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
    CREATE INDEX IF NOT EXISTS idx_document_analyses_document ON document_analyses(document_id);
    CREATE INDEX IF NOT EXISTS idx_document_analyses_status ON document_analyses(status);
    CREATE INDEX IF NOT EXISTS idx_work_lists_project ON work_lists(project_id);
    CREATE INDEX IF NOT EXISTS idx_work_lists_user ON work_lists(user_id);
    CREATE INDEX IF NOT EXISTS idx_work_list_items_work_list ON work_list_items(work_list_id);
  `);

  // Auto-load OTSKP codes if database is empty
  await autoLoadOtskpCodesIfNeeded();
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

export default { initDatabase };
