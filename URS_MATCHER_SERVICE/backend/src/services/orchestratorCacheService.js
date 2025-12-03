/**
 * Orchestrator Results Caching Service
 * Фаза 4: Cache Phase 3 Advanced analysis results to reduce API costs
 *
 * Caches:
 * - Block analysis by content hash
 * - Role outputs by analysis hash
 * - Conflict resolutions
 * - Completeness assessments
 */

import { logger } from '../utils/logger.js';
import crypto from 'crypto';

/**
 * In-memory cache store
 * In production, would use Redis
 */
const cacheStore = new Map();

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  MAX_ENTRIES: 1000,
  TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
  BLOCK_ANALYSIS_TTL: 7 * 24 * 60 * 60 * 1000, // 7 days for block analysis
  ROLE_OUTPUT_TTL: 24 * 60 * 60 * 1000, // 24 hours for role outputs
};

/**
 * Generate cache key from block data
 * Uses content hash to detect duplicates
 */
function generateBlockCacheKey(boqBlock, projectContext, userId = 'default') {
  const blockContent = JSON.stringify({
    rows: boqBlock.rows?.map(r => r.raw_text || r.text).sort(),
    context_hash: projectContext ? JSON.stringify(projectContext).substring(0, 50) : 'none'
  });

  const hash = crypto
    .createHash('sha256')
    .update(blockContent)
    .digest('hex')
    .substring(0, 16);

  return `block:${userId}:${hash}`;
}

/**
 * Generate cache key for role output
 */
function generateRoleCacheKey(role, boqBlock, projectContext, userId = 'default') {
  const blockHash = generateBlockCacheKey(boqBlock, projectContext, userId);
  return `${blockHash}:role:${role}`;
}

/**
 * Generate cache key for conflict resolution
 */
function generateConflictCacheKey(conflict, userId = 'default') {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(conflict))
    .digest('hex')
    .substring(0, 16);

  return `conflict:${userId}:${hash}`;
}

/**
 * Get cached block analysis result
 * @param {Object} boqBlock - BOQ block
 * @param {Object} projectContext - Project context
 * @param {string} userId - User ID
 * @returns {Object|null} Cached result or null if not found
 */
export function getCachedBlockAnalysis(boqBlock, projectContext, userId = 'default') {
  const cacheKey = generateBlockCacheKey(boqBlock, projectContext, userId);
  return getCacheEntry(cacheKey);
}

/**
 * Set cached block analysis result
 * @param {Object} boqBlock - BOQ block
 * @param {Object} projectContext - Project context
 * @param {Object} result - Analysis result
 * @param {string} userId - User ID
 */
export function setCachedBlockAnalysis(boqBlock, projectContext, result, userId = 'default') {
  const cacheKey = generateBlockCacheKey(boqBlock, projectContext, userId);
  setCacheEntry(cacheKey, result, CACHE_CONFIG.BLOCK_ANALYSIS_TTL);

  logger.info(`[CACHE] Block analysis cached: ${cacheKey}`);
  return cacheKey;
}

/**
 * Get cached role output
 * @param {string} role - Role name
 * @param {Object} boqBlock - BOQ block
 * @param {Object} projectContext - Project context
 * @param {string} userId - User ID
 * @returns {Object|null} Cached output or null
 */
export function getCachedRoleOutput(role, boqBlock, projectContext, userId = 'default') {
  const cacheKey = generateRoleCacheKey(role, boqBlock, projectContext, userId);
  return getCacheEntry(cacheKey);
}

/**
 * Set cached role output
 * @param {string} role - Role name
 * @param {Object} boqBlock - BOQ block
 * @param {Object} projectContext - Project context
 * @param {Object} output - Role output
 * @param {string} userId - User ID
 */
export function setCachedRoleOutput(role, boqBlock, projectContext, output, userId = 'default') {
  const cacheKey = generateRoleCacheKey(role, boqBlock, projectContext, userId);
  setCacheEntry(cacheKey, output, CACHE_CONFIG.ROLE_OUTPUT_TTL);

  logger.info(`[CACHE] Role output cached: ${role} - ${cacheKey}`);
  return cacheKey;
}

/**
 * Get cached conflict resolution
 * @param {Object} conflict - Conflict object
 * @param {string} userId - User ID
 * @returns {Object|null} Cached resolution or null
 */
export function getCachedConflictResolution(conflict, userId = 'default') {
  const cacheKey = generateConflictCacheKey(conflict, userId);
  return getCacheEntry(cacheKey);
}

/**
 * Set cached conflict resolution
 * @param {Object} conflict - Conflict object
 * @param {Object} resolution - Resolution result
 * @param {string} userId - User ID
 */
export function setCachedConflictResolution(conflict, resolution, userId = 'default') {
  const cacheKey = generateConflictCacheKey(conflict, userId);
  setCacheEntry(cacheKey, resolution, CACHE_CONFIG.TTL_MS);

  logger.info(`[CACHE] Conflict resolution cached: ${cacheKey}`);
  return cacheKey;
}

/**
 * Internal: Get cache entry with TTL check
 * @private
 */
function getCacheEntry(cacheKey) {
  const entry = cacheStore.get(cacheKey);

  if (!entry) {
    return null;
  }

  // Check if entry has expired
  if (entry.expiry && entry.expiry < Date.now()) {
    cacheStore.delete(cacheKey);
    logger.debug(`[CACHE] Entry expired: ${cacheKey}`);
    return null;
  }

  logger.debug(`[CACHE] Cache HIT: ${cacheKey}`);
  return entry.value;
}

/**
 * Internal: Set cache entry with TTL
 * @private
 */
function setCacheEntry(cacheKey, value, ttl = CACHE_CONFIG.TTL_MS) {
  // Evict old entries if cache is too large
  if (cacheStore.size >= CACHE_CONFIG.MAX_ENTRIES) {
    const oldestKey = cacheStore.keys().next().value;
    cacheStore.delete(oldestKey);
    logger.debug(`[CACHE] Evicted old entry to make space: ${oldestKey}`);
  }

  const entry = {
    value,
    expiry: Date.now() + ttl,
    createdAt: Date.now()
  };

  cacheStore.set(cacheKey, entry);
}

/**
 * Clear cache entry
 * @param {string} cacheKey - Cache key to clear
 */
export function clearCacheEntry(cacheKey) {
  cacheStore.delete(cacheKey);
  logger.info(`[CACHE] Entry cleared: ${cacheKey}`);
}

/**
 * Clear all cache (for testing or maintenance)
 */
export function clearAllCache() {
  const size = cacheStore.size;
  cacheStore.clear();
  logger.warn(`[CACHE] All cache cleared (${size} entries removed)`);
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats
 */
export function getCacheStats() {
  let validEntries = 0;
  let expiredEntries = 0;

  cacheStore.forEach(entry => {
    if (entry.expiry && entry.expiry < Date.now()) {
      expiredEntries++;
    } else {
      validEntries++;
    }
  });

  return {
    total_entries: cacheStore.size,
    valid_entries: validEntries,
    expired_entries: expiredEntries,
    cache_size_estimate_mb: (cacheStore.size * 0.001).toFixed(2),
    max_entries: CACHE_CONFIG.MAX_ENTRIES,
    hit_rate: calculateHitRate()
  };
}

/**
 * Cache performance metrics (simple implementation)
 */
let cacheHits = 0;
let cacheMisses = 0;

function calculateHitRate() {
  const total = cacheHits + cacheMisses;
  return total > 0 ? ((cacheHits / total) * 100).toFixed(2) : 0;
}

/**
 * Record cache hit (internal)
 */
export function recordCacheHit() {
  cacheHits++;
}

/**
 * Record cache miss (internal)
 */
export function recordCacheMiss() {
  cacheMisses++;
}

/**
 * Reset cache metrics
 */
export function resetCacheMetrics() {
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Clean expired entries (periodic maintenance)
 * Should be called periodically (e.g., every hour)
 */
export function cleanExpiredEntries() {
  let removedCount = 0;

  cacheStore.forEach((entry, key) => {
    if (entry.expiry && entry.expiry < Date.now()) {
      cacheStore.delete(key);
      removedCount++;
    }
  });

  if (removedCount > 0) {
    logger.info(`[CACHE] Cleanup: Removed ${removedCount} expired entries`);
  }

  return removedCount;
}
