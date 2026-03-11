/**
 * Batch Cache Service
 * Caches API results to avoid duplicate LLM/Perplexity calls
 *
 * Purpose:
 * - Cache split, retrieve, rerank results
 * - Enable resume from any point
 * - Reduce API costs (40%+ savings)
 * - Hash-based deduplication
 *
 * TTL Strategy:
 * - Split: 30 days (position text rarely changes)
 * - Retrieve: 7 days (ÚRS catalog updates slowly)
 * - Rerank: 7 days (scoring is deterministic)
 *
 * @module services/batch/batchCache
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import { getDatabase } from '../../db/init.js';

// ============================================================================
// TTL CONSTANTS
// ============================================================================

const TTL_MS = {
  split: 30 * 24 * 60 * 60 * 1000,    // 30 days
  retrieve: 7 * 24 * 60 * 60 * 1000,  // 7 days
  rerank: 7 * 24 * 60 * 60 * 1000     // 7 days
};

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Get cached result
 * @param {string} cacheKey - Cache key (hash)
 * @param {string} stage - Stage name (split, retrieve, rerank)
 * @returns {Object|null} Cached result or null if not found/expired
 */
export async function get(cacheKey, stage) {
  const startTime = Date.now();

  try {
    const db = await getDatabase();

    const cached = await db.get(
      `SELECT * FROM batch_cache WHERE cache_key = ? AND stage = ?`,
      [cacheKey, stage]
    );

    if (!cached) {
      logger.debug(`[BatchCache] MISS: ${stage}:${cacheKey.substring(0, 8)}...`);
      return null;
    }

    // Check expiration
    if (cached.expires_at) {
      const expiresAt = new Date(cached.expires_at);
      if (expiresAt < new Date()) {
        logger.debug(`[BatchCache] EXPIRED: ${stage}:${cacheKey.substring(0, 8)}... (expired: ${expiresAt.toISOString()})`);
        // Delete expired entry
        await db.run(`DELETE FROM batch_cache WHERE id = ?`, [cached.id]);
        return null;
      }
    }

    // Update hit count and last accessed
    await db.run(
      `UPDATE batch_cache SET hit_count = hit_count + 1, last_accessed_at = datetime('now') WHERE id = ?`,
      [cached.id]
    );

    const elapsed = Date.now() - startTime;
    logger.info(`[BatchCache] HIT: ${stage}:${cacheKey.substring(0, 8)}... (hits: ${cached.hit_count + 1}, ${elapsed}ms)`);

    return JSON.parse(cached.result);

  } catch (error) {
    logger.error(`[BatchCache] Get error: ${error.message}`);
    return null;  // Fail gracefully
  }
}

/**
 * Set (store) cached result
 * @param {string} cacheKey - Cache key (hash)
 * @param {string} stage - Stage name
 * @param {Object} result - Result to cache
 * @param {number} [ttlMs] - TTL in milliseconds (optional, uses default)
 * @returns {boolean} Success
 */
export async function set(cacheKey, stage, result, ttlMs = null) {
  const startTime = Date.now();

  try {
    const db = await getDatabase();

    // Determine TTL
    const ttl = ttlMs || TTL_MS[stage] || TTL_MS.retrieve;
    const expiresAt = ttl ? new Date(Date.now() + ttl).toISOString() : null;

    // Upsert (replace if exists)
    await db.run(
      `INSERT OR REPLACE INTO batch_cache (id, cache_key, stage, result, created_at, expires_at, hit_count, last_accessed_at)
       VALUES (?, ?, ?, ?, datetime('now'), ?, 0, datetime('now'))`,
      [uuidv4(), cacheKey, stage, JSON.stringify(result), expiresAt]
    );

    const elapsed = Date.now() - startTime;
    logger.info(`[BatchCache] SET: ${stage}:${cacheKey.substring(0, 8)}... (expires: ${expiresAt || 'never'}, ${elapsed}ms)`);

    return true;

  } catch (error) {
    logger.error(`[BatchCache] Set error: ${error.message}`);
    return false;  // Fail gracefully
  }
}

/**
 * Clear cache for a specific stage or all stages
 * @param {string} [stage] - Stage to clear (optional, clears all if not specified)
 * @returns {number} Number of entries deleted
 */
export async function clear(stage = null) {
  try {
    const db = await getDatabase();

    let result;
    if (stage) {
      result = await db.run(`DELETE FROM batch_cache WHERE stage = ?`, [stage]);
      logger.info(`[BatchCache] Cleared ${result.changes} entries for stage: ${stage}`);
    } else {
      result = await db.run(`DELETE FROM batch_cache`);
      logger.info(`[BatchCache] Cleared all ${result.changes} entries`);
    }

    return result.changes;

  } catch (error) {
    logger.error(`[BatchCache] Clear error: ${error.message}`);
    return 0;
  }
}

/**
 * Clean up expired entries
 * @returns {number} Number of entries deleted
 */
export async function cleanupExpired() {
  try {
    const db = await getDatabase();

    const result = await db.run(
      `DELETE FROM batch_cache WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`
    );

    if (result.changes > 0) {
      logger.info(`[BatchCache] Cleanup: Deleted ${result.changes} expired entries`);
    }

    return result.changes;

  } catch (error) {
    logger.error(`[BatchCache] Cleanup error: ${error.message}`);
    return 0;
  }
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export async function getStats() {
  try {
    const db = await getDatabase();

    const total = await db.get(`SELECT COUNT(*) as count FROM batch_cache`);
    const byStage = await db.all(`SELECT stage, COUNT(*) as count FROM batch_cache GROUP BY stage`);
    const totalHits = await db.get(`SELECT SUM(hit_count) as total FROM batch_cache`);
    const expired = await db.get(`SELECT COUNT(*) as count FROM batch_cache WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`);

    return {
      totalEntries: total.count,
      byStage: byStage.reduce((acc, row) => {
        acc[row.stage] = row.count;
        return acc;
      }, {}),
      totalHits: totalHits.total || 0,
      expiredEntries: expired.count
    };

  } catch (error) {
    logger.error(`[BatchCache] Stats error: ${error.message}`);
    return {
      totalEntries: 0,
      byStage: {},
      totalHits: 0,
      expiredEntries: 0
    };
  }
}

// ============================================================================
// HASH UTILITIES
// ============================================================================

/**
 * Generate cache key (hash) from input
 * @param {string|Object} input - Input to hash
 * @returns {string} SHA256 hash (hex)
 */
export function hash(input) {
  const str = typeof input === 'string' ? input : JSON.stringify(input);
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Generate cache key for split stage
 * @param {string} normalizedText - Normalized text
 * @param {Object} settings - Batch settings
 * @returns {string} Cache key
 */
export function splitCacheKey(normalizedText, settings) {
  return hash({
    text: normalizedText,
    maxSubWorks: settings.maxSubWorks
  });
}

/**
 * Generate cache key for retrieve stage
 * @param {Object} subWork - Subwork data
 * @param {string} searchDepth - Search depth
 * @returns {string} Cache key
 */
export function retrieveCacheKey(subWork, searchDepth) {
  return hash({
    text: subWork.text,
    keywords: subWork.keywords,
    searchDepth: searchDepth
  });
}

/**
 * Generate cache key for rerank stage
 * @param {Object} subWork - Subwork data
 * @param {Array<Object>} candidates - Candidates list
 * @param {number} topN - Top N candidates
 * @returns {string} Cache key
 */
export function rerankCacheKey(subWork, candidates, topN) {
  // Hash based on subwork text and candidate codes (not full candidates to allow some variation)
  const candidateCodes = candidates.map(c => c.code).sort().join(',');

  return hash({
    text: subWork.text,
    candidateCodes: candidateCodes,
    topN: topN
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  get,
  set,
  clear,
  cleanupExpired,
  getStats,
  hash,
  splitCacheKey,
  retrieveCacheKey,
  rerankCacheKey
};
