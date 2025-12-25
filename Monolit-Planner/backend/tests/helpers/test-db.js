/**
 * Test Database Setup Utilities
 * Provides isolated test database for integration tests
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test database path (in-memory for speed, or file for debugging)
const USE_IN_MEMORY = process.env.TEST_DB_IN_MEMORY !== 'false';
const TEST_DB_PATH = USE_IN_MEMORY
  ? ':memory:'
  : join(__dirname, '../../data/test.db');

let testDb = null;

// Counters for unique IDs
let partIdCounter = 0;
let bridgeIdCounter = 0;
let positionIdCounter = 0;

/**
 * Initialize test database with schema
 */
export async function setupTestDatabase() {
  // Clean up existing test database file if not in-memory
  if (!USE_IN_MEMORY && fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Create new database
  testDb = new Database(TEST_DB_PATH);
  testDb.pragma('journal_mode = WAL');

  // Create schema
  createSchema();

  // Insert default config
  insertDefaultConfig();

  return testDb;
}

/**
 * Create database schema
 */
function createSchema() {
  // Users table
  testDb.exec(`
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

  // Monolith Projects table
  testDb.exec(`
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

  // Bridges table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS bridges (
      bridge_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      project_name TEXT,
      object_name TEXT NOT NULL DEFAULT '',
      element_count INTEGER DEFAULT 0,
      concrete_m3 REAL DEFAULT 0,
      sum_kros_czk REAL DEFAULT 0,
      span_length_m REAL,
      deck_width_m REAL,
      pd_weeks REAL,
      status TEXT DEFAULT 'active',
      owner_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Parts table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS parts (
      part_id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      part_name TEXT NOT NULL,
      is_predefined INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES monolith_projects(project_id) ON DELETE CASCADE
    );
  `);

  // Positions table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      bridge_id TEXT NOT NULL,
      part_id TEXT,
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
      item_name TEXT,
      otskp_code TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (bridge_id) REFERENCES bridges(bridge_id) ON DELETE CASCADE,
      FOREIGN KEY (part_id) REFERENCES parts(part_id) ON DELETE SET NULL
    );
  `);

  // Project config table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS project_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      feature_flags TEXT NOT NULL,
      defaults TEXT NOT NULL,
      days_per_month_mode INTEGER NOT NULL DEFAULT 30,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Part templates table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS part_templates (
      template_id TEXT PRIMARY KEY,
      part_name TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 1,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // OTSKP codes table
  testDb.exec(`
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

  // Create indexes
  testDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_positions_bridge ON positions(bridge_id);
    CREATE INDEX IF NOT EXISTS idx_positions_part ON positions(part_name);
    CREATE INDEX IF NOT EXISTS idx_positions_subtype ON positions(subtype);
    CREATE INDEX IF NOT EXISTS idx_bridges_project ON bridges(project_id);
    CREATE INDEX IF NOT EXISTS idx_parts_project ON parts(project_id);
    CREATE INDEX IF NOT EXISTS idx_monolith_projects_owner ON monolith_projects(owner_id);
  `);
}

/**
 * Insert default config
 */
function insertDefaultConfig() {
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

  testDb.prepare(`
    INSERT INTO project_config (id, feature_flags, defaults, days_per_month_mode)
    VALUES (1, ?, ?, 30)
  `).run(defaultFeatureFlags, defaultDefaults);
}

/**
 * Clean up test database
 */
export async function teardownTestDatabase() {
  if (testDb) {
    testDb.close();
    testDb = null;
  }

  // Delete test database file if not in-memory
  if (!USE_IN_MEMORY && fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

/**
 * Get test database instance
 */
export function getTestDb() {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDb;
}

/**
 * Clear all data from tables (keep schema)
 */
export function clearTestData() {
  const tables = [
    'positions',
    'parts',
    'bridges',
    'monolith_projects',
    'users',
    'otskp_codes',
    'part_templates'
  ];

  for (const table of tables) {
    testDb.exec(`DELETE FROM ${table}`);
  }
}

/**
 * Create test user
 */
export function createTestUser(data = {}) {
  const defaultUser = {
    email: 'test@example.com',
    password_hash: '$2b$10$test.hash.here',
    name: 'Test User',
    role: 'user',
    ...data
  };

  const result = testDb.prepare(`
    INSERT INTO users (email, password_hash, name, role)
    VALUES (?, ?, ?, ?)
  `).run(defaultUser.email, defaultUser.password_hash, defaultUser.name, defaultUser.role);

  return { id: result.lastInsertRowid, ...defaultUser };
}

/**
 * Create test project
 */
export function createTestProject(ownerId, data = {}) {
  const defaultProject = {
    project_id: `test-project-${Date.now()}`,
    project_name: 'Test Project',
    object_name: 'Test Bridge',
    owner_id: ownerId,
    status: 'active',
    ...data
  };

  testDb.prepare(`
    INSERT INTO monolith_projects (project_id, project_name, object_name, owner_id, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    defaultProject.project_id,
    defaultProject.project_name,
    defaultProject.object_name,
    defaultProject.owner_id,
    defaultProject.status
  );

  return defaultProject;
}

/**
 * Create test bridge
 */
export function createTestBridge(projectId, data = {}) {
  const defaultBridge = {
    bridge_id: data.bridge_id || `test-bridge-${Date.now()}-${bridgeIdCounter++}`,
    project_id: projectId,
    project_name: 'Test Project',
    object_name: 'Test Bridge',
    element_count: 0,
    concrete_m3: 0,
    sum_kros_czk: 0,
    status: 'active',
    ...data
  };

  testDb.prepare(`
    INSERT INTO bridges (bridge_id, project_id, project_name, object_name, element_count, concrete_m3, sum_kros_czk, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    defaultBridge.bridge_id,
    defaultBridge.project_id,
    defaultBridge.project_name,
    defaultBridge.object_name,
    defaultBridge.element_count,
    defaultBridge.concrete_m3,
    defaultBridge.sum_kros_czk,
    defaultBridge.status
  );

  return defaultBridge;
}

/**
 * Create test part
 */
export function createTestPart(projectId, data = {}) {
  const defaultPart = {
    part_id: data.part_id || `test-part-${Date.now()}-${partIdCounter++}`,
    project_id: projectId,
    part_name: 'ZÁKLADY',
    is_predefined: 1,
    ...data
  };

  testDb.prepare(`
    INSERT INTO parts (part_id, project_id, part_name, is_predefined)
    VALUES (?, ?, ?, ?)
  `).run(
    defaultPart.part_id,
    defaultPart.project_id,
    defaultPart.part_name,
    defaultPart.is_predefined
  );

  return defaultPart;
}

/**
 * Create test position
 */
export function createTestPosition(bridgeId, partId, data = {}) {
  const defaultPosition = {
    id: data.id || `test-pos-${Date.now()}-${positionIdCounter++}`,
    bridge_id: bridgeId,
    part_id: partId,
    part_name: 'ZÁKLADY',
    subtype: 'beton',
    unit: 'm³',
    qty: 100,
    crew_size: 4,
    wage_czk_ph: 398,
    shift_hours: 10,
    days: 10,
    concrete_m3: 100,
    cost_czk: 50000,
    unit_cost_on_m3: 500,
    kros_unit_czk: 500,
    kros_total_czk: 50000,
    ...data
  };

  testDb.prepare(`
    INSERT INTO positions (
      id, bridge_id, part_id, part_name, subtype, unit, qty,
      crew_size, wage_czk_ph, shift_hours, days,
      concrete_m3, cost_czk, unit_cost_on_m3, kros_unit_czk, kros_total_czk
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    defaultPosition.id,
    defaultPosition.bridge_id,
    defaultPosition.part_id,
    defaultPosition.part_name,
    defaultPosition.subtype,
    defaultPosition.unit,
    defaultPosition.qty,
    defaultPosition.crew_size,
    defaultPosition.wage_czk_ph,
    defaultPosition.shift_hours,
    defaultPosition.days,
    defaultPosition.concrete_m3,
    defaultPosition.cost_czk,
    defaultPosition.unit_cost_on_m3,
    defaultPosition.kros_unit_czk,
    defaultPosition.kros_total_czk
  );

  return defaultPosition;
}

/**
 * Seed OTSKP codes for testing
 */
export function seedTestOtskpCodes() {
  const codes = [
    { code: '431311010', name: 'Beton prostý C 16/20', unit: 'm³', unit_price: 2500, specification: 'Bez výztuže' },
    { code: '431311020', name: 'Beton prostý C 20/25', unit: 'm³', unit_price: 2700, specification: 'Bez výztuže' },
    { code: '431311030', name: 'Beton prostý C 25/30', unit: 'm³', unit_price: 2900, specification: 'Bez výztuže' },
    { code: '431312010', name: 'Beton železový C 16/20', unit: 'm³', unit_price: 2800, specification: 'S výztuží' },
    { code: '431312020', name: 'Beton železový C 20/25', unit: 'm³', unit_price: 3000, specification: 'S výztuží' },
    { code: '431312030', name: 'Beton železový C 25/30', unit: 'm³', unit_price: 3200, specification: 'S výztuží' }
  ];

  const insertStmt = testDb.prepare(`
    INSERT INTO otskp_codes (code, name, unit, unit_price, specification, search_name)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const code of codes) {
    insertStmt.run(
      code.code,
      code.name,
      code.unit,
      code.unit_price,
      code.specification,
      code.name.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
  }
}

/**
 * Database adapter with SQLite-compatible interface for routes
 * This creates an object that matches the production db interface
 */
export function createTestDbAdapter() {
  const db = getTestDb();

  return {
    prepare: db.prepare.bind(db),
    exec: db.exec.bind(db),
    transaction: db.transaction.bind(db),
    pragma: db.pragma.bind(db),
    isPostgres: false,
    isSqlite: true
  };
}
