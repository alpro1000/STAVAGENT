/**
 * PostgreSQL Database Adapter
 * Provides unified interface compatible with SQLite queries
 */

import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// PostgreSQL connection pool
let pool = null;

/**
 * Parse DATABASE_URL robustly.
 * Handles:
 * - Standard: postgresql://user:pass@host:5432/db
 * - Cloud SQL unix socket: postgresql://user:pass@/db?host=/cloudsql/project:region:instance
 * - Passwords with special chars (not URL-encoded)
 * - Trailing newlines (common when pasting into GCP Secret Manager)
 */
function parseConnectionConfig(rawConnectionString) {
  const connectionString = rawConnectionString.trim();

  try {
    const url = new URL(connectionString);
    const socketHost = url.searchParams.get('host');
    return {
      user: decodeURIComponent(url.username || ''),
      password: decodeURIComponent(url.password || ''),
      database: (url.pathname || '').replace(/^\//, ''),
      host: socketHost || url.hostname || 'localhost',
      port: url.port ? parseInt(url.port, 10) : 5432,
    };
  } catch (_urlErr) {
    // Fallback: regex parser for passwords with unencoded special chars
    const m = connectionString.match(
      /^(?:postgresql|postgres):\/\/([^:]+):(.+)@([^/?]*)(?::(\d+))?\/?([^?]*)(?:\?(.*))?$/
    );
    if (!m) {
      throw new Error(
        `[PostgreSQL] Cannot parse DATABASE_URL. ` +
        `Ensure format: postgresql://user:pass@host:5432/db ` +
        `or postgresql://user:pass@/db?host=/cloudsql/project:region:instance. ` +
        `If password contains special chars (@, #, ?, /), URL-encode them.`
      );
    }
    const [, user, password, host, port, database, query] = m;
    const socketHost = query
      ? Object.fromEntries(new URLSearchParams(query)).host
      : null;
    return {
      user,
      password,
      database: database || '',
      host: socketHost || host || 'localhost',
      port: port ? parseInt(port, 10) : 5432,
    };
  }
}

/**
 * Initialize PostgreSQL connection
 */
export function initPostgres() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
  }

  let connConfig;
  try {
    connConfig = parseConnectionConfig(process.env.DATABASE_URL);
  } catch (parseErr) {
    console.error('[PostgreSQL] Failed to parse DATABASE_URL:', parseErr.message);
    throw parseErr;
  }

  console.log(`[PostgreSQL] Connecting to database "${connConfig.database}" at host "${connConfig.host}"`);

  // Cloud SQL Proxy uses Unix socket — SSL is not supported on Unix sockets.
  // On Cloud Run (K_SERVICE is auto-set), always disable SSL.
  // For other production environments (e.g. Render with remote PG), enable SSL.
  const isCloudRun = !!process.env.K_SERVICE;
  const needsSsl = !isCloudRun && process.env.NODE_ENV === 'production';

  pool = new Pool({
    user: connConfig.user,
    password: connConfig.password,
    database: connConfig.database,
    host: connConfig.host,
    port: connConfig.port,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Test connection
  pool.on('error', (err) => {
    console.error('[PostgreSQL] Unexpected error on idle client', err);
  });

  console.log('[PostgreSQL] Connection pool initialized');
  return pool;
}

/**
 * Get database pool
 */
export function getPool() {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized. Call initPostgres() first.');
  }
  return pool;
}

/**
 * Execute SQL query (wrapper for compatibility)
 */
export async function query(text, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * Prepare statement adapter (converts SQLite-style ? to PostgreSQL $1, $2, etc.)
 */
export function prepare(sql) {
  // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
  let paramIndex = 0;
  const convertedSql = sql.replace(/\?/g, () => {
    paramIndex++;
    return `$${paramIndex}`;
  });

  return {
    all: async (...params) => {
      const result = await query(convertedSql, params);
      return result.rows;
    },

    get: async (...params) => {
      const result = await query(convertedSql, params);
      return result.rows[0] || null;
    },

    run: async (...params) => {
      let finalSql = convertedSql;
      // Automatically add 'RETURNING *' to get all columns from INSERT
      // We'll extract the primary key intelligently (id, *_id, or first column)
      if (/^\s*INSERT/i.test(finalSql) && !/RETURNING/i.test(finalSql)) {
        finalSql += ' RETURNING *';
      }
      const result = await query(finalSql, params);
      const row = result.rows[0];
      // Find PK: 'id' field, or field ending with '_id', or first value
      const lastID = row?.id ??
                     Object.entries(row || {}).find(([k]) => k.endsWith('_id'))?.[1] ??
                     Object.values(row || {})[0] ??
                     null;
      return {
        changes: result.rowCount,
        lastID
      };
    }
  };
}

/**
 * Execute raw SQL (for CREATE TABLE, migrations, etc.)
 */
export async function exec(sql) {
  const client = await pool.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

/**
 * Transaction helper
 */
export function transaction(callback) {
  return async (...args) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await callback(...args);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };
}

/**
 * Pragma adapter (no-op for PostgreSQL, used for SQLite compatibility)
 */
export function pragma() {
  // No-op: PostgreSQL doesn't use PRAGMA
  return null;
}

/**
 * Close connection pool
 */
export async function close() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[PostgreSQL] Connection pool closed');
  }
}

// Export pool as default for direct access
export default {
  pool,
  query,
  prepare,
  exec,
  transaction,
  pragma,
  close,
  initPostgres,
  getPool
};
