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
    max: 20, // Maximum connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
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
      // Automatically add 'RETURNING id' to get the last inserted ID from an INSERT statement
      if (/^\s*INSERT/i.test(finalSql) && !/RETURNING/i.test(finalSql)) {
        finalSql += ' RETURNING id';
      }
      const result = await query(finalSql, params);
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
