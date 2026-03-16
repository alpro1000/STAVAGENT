/**
 * Unified Database Interface
 * Automatically selects SQLite (development) or PostgreSQL (production)
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine database type based on environment
const USE_POSTGRES = !!process.env.DATABASE_URL;

let db;

if (USE_POSTGRES) {
  console.log('[Database] Using PostgreSQL (production mode)');
  const postgres = await import('./postgres.js');
  try {
    postgres.initPostgres();
  } catch (err) {
    console.error('[Database] PostgreSQL initialization failed:', err.message);
    console.error('[Database] Hint: Check PORTAL_DATABASE_URL in Secret Manager.');
    console.error('[Database] Expected format: postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance');
    console.error('[Database] If password has special chars (@#?/), URL-encode them (e.g. @ → %40)');
    // Re-throw so the process crashes on startup, not silently on first request
    throw err;
  }

  // Create adapter with SQLite-compatible interface
  db = {
    prepare: postgres.prepare,
    exec: postgres.exec,
    // Transaction for PostgreSQL: simplified - just execute callback
    // Each statement is auto-committed (PostgreSQL default)
    // TODO: Implement proper transaction support with client passing
    transaction: (callback) => callback,
    pragma: postgres.pragma,
    isPostgres: true,
    isSqlite: false
  };
} else {
  console.log('[Database] Using SQLite (development mode)');
  const Database = (await import('better-sqlite3')).default;

  const DB_PATH = process.env.DB_PATH || join(__dirname, '../../data/monolit.db');

  // Ensure data directory exists
  const dataDir = dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');

  db = {
    prepare: sqlite.prepare.bind(sqlite),
    exec: sqlite.exec.bind(sqlite),
    transaction: sqlite.transaction.bind(sqlite),
    pragma: sqlite.pragma.bind(sqlite),
    isPostgres: false,
    isSqlite: true
  };
}

export default db;
export { USE_POSTGRES };
