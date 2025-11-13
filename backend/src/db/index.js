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
  postgres.initPostgres();

  // Create adapter with SQLite-compatible interface
  db = {
    prepare: postgres.prepare,
    exec: postgres.exec,
    transaction: postgres.transaction,
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
