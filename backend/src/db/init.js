/**
 * Database initialization and schema
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || join(__dirname, '../../data/monolit.db');

// Ensure data directory exists
const dataDir = dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

export function initDatabase() {
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

  // Migration: Add object_name column if it doesn't exist
  const columns = db.prepare("PRAGMA table_info(bridges)").all();
  const hasObjectName = columns.some(col => col.name === 'object_name');
  if (!hasObjectName) {
    db.exec("ALTER TABLE bridges ADD COLUMN object_name TEXT NOT NULL DEFAULT ''");
  }

  // Migration: Add item_name column to positions if it doesn't exist
  const posColumns = db.prepare("PRAGMA table_info(positions)").all();
  const hasItemName = posColumns.some(col => col.name === 'item_name');
  if (!hasItemName) {
    db.exec("ALTER TABLE positions ADD COLUMN item_name TEXT");
  }

  // Migration: Add otskp_code column to positions if it doesn't exist
  const hasOtskpCode = posColumns.some(col => col.name === 'otskp_code');
  if (!hasOtskpCode) {
    db.exec("ALTER TABLE positions ADD COLUMN otskp_code TEXT");
  }

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

  // Create indexes for snapshots
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_snapshots_bridge ON snapshots(bridge_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_snapshots_locked ON snapshots(is_locked);
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_positions_bridge ON positions(bridge_id);
    CREATE INDEX IF NOT EXISTS idx_positions_part ON positions(part_name);
    CREATE INDEX IF NOT EXISTS idx_positions_subtype ON positions(subtype);
    CREATE INDEX IF NOT EXISTS idx_positions_otskp ON positions(otskp_code);
    CREATE INDEX IF NOT EXISTS idx_otskp_name ON otskp_codes(name);
  `);

  return db;
}

export default db;
