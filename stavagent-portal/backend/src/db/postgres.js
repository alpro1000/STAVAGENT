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
 * Initialize PostgreSQL connection
 */
export function initPostgres() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // 10s — Render Postgres needs time to wake from sleep
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
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
 * Execute SQL query with one retry on connection timeout.
 * Handles Render Free Tier PostgreSQL sleep (DB needs ~2-5s to wake up).
 */
export async function query(text, params = []) {
  return _queryWithRetry(text, params, 1);
}

async function _queryWithRetry(text, params, retriesLeft) {
  let client;
  try {
    client = await pool.connect();
  } catch (connErr) {
    // pool.connect() itself failed (DB sleeping)
    const isConnErr = connErr.message?.includes('timeout') ||
      connErr.message?.includes('Connection terminated') ||
      connErr.code === 'ECONNREFUSED' ||
      connErr.code === 'ETIMEDOUT';
    if (isConnErr && retriesLeft > 0) {
      console.warn('[PostgreSQL] Cannot connect, retrying in 2s... (' + retriesLeft + ' left)');
      await new Promise(r => setTimeout(r, 2000));
      return _queryWithRetry(text, params, retriesLeft - 1);
    }
    throw connErr;
  }

  try {
    const result = await client.query(text, params);
    client.release();
    return result;
  } catch (queryErr) {
    client.release(queryErr); // mark client as bad
    const isConnErr = queryErr.message?.includes('timeout') ||
      queryErr.message?.includes('Connection terminated') ||
      queryErr.code === 'ECONNREFUSED' ||
      queryErr.code === 'ETIMEDOUT';
    if (isConnErr && retriesLeft > 0) {
      console.warn('[PostgreSQL] Query failed on connection error, retrying in 2s...');
      await new Promise(r => setTimeout(r, 2000));
      return _queryWithRetry(text, params, retriesLeft - 1);
    }
    throw queryErr;
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
      const result = await query(convertedSql, params);
      return {
        changes: result.rowCount,
        lastID: result.rows[0]?.id || null
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
