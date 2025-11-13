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
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      await db.exec(statement + ';');
    } catch (error) {
      // Ignore "already exists" errors
      if (!error.message.includes('already exists')) {
        console.error('[PostgreSQL] Error executing statement:', statement);
        throw error;
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes for snapshots
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_bridge ON snapshots(bridge_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_snapshots_locked ON snapshots(is_locked);
    CREATE INDEX IF NOT EXISTS idx_snapshots_final ON snapshots(is_final);
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
  `);

  // Auto-load OTSKP codes if database is empty
  autoLoadOtskpCodesIfNeeded();
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
 */
function autoLoadOtskpCodesIfNeeded() {
  try {
    const countResult = db.prepare('SELECT COUNT(*) as count FROM otskp_codes').get();

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

    // Insert into database
    const insertStmt = db.prepare(`
      INSERT INTO otskp_codes (code, name, unit, unit_price, specification, search_name)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

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
