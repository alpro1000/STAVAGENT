/**
 * Cache Cleanup Scheduler
 * Фаза 4: Periodically clean expired cache entries
 *
 * Runs automatic cleanup to prevent cache from growing unbounded
 * Logs cleanup statistics for monitoring
 */

import { logger } from '../utils/logger.js';
import { cleanExpiredEntries, getCacheStats } from './orchestratorCacheService.js';

/**
 * Cache cleanup schedule configuration
 */
const CLEANUP_CONFIG = {
  // Cleanup every 1 hour (in production, could be configurable)
  INTERVAL_MS: 60 * 60 * 1000,
  // Run initial cleanup after 5 minutes
  INITIAL_DELAY_MS: 5 * 60 * 1000,
  // Enable/disable scheduler
  ENABLED: process.env.CACHE_CLEANUP_ENABLED !== 'false'
};

let cleanupScheduler = null;

/**
 * Start the cache cleanup scheduler
 * Should be called once during application initialization
 */
export function startCacheCleanupScheduler() {
  if (!CLEANUP_CONFIG.ENABLED) {
    logger.info('[CACHE-CLEANUP] Scheduler disabled by configuration');
    return;
  }

  if (cleanupScheduler !== null) {
    logger.warn('[CACHE-CLEANUP] Scheduler already started, skipping...');
    return;
  }

  logger.info(
    `[CACHE-CLEANUP] Scheduler starting (initial delay: ${CLEANUP_CONFIG.INITIAL_DELAY_MS}ms, ` +
    `interval: ${CLEANUP_CONFIG.INTERVAL_MS}ms)`
  );

  // Schedule initial cleanup
  cleanupScheduler = setTimeout(() => {
    performCleanup();

    // Schedule recurring cleanup
    cleanupScheduler = setInterval(() => {
      performCleanup();
    }, CLEANUP_CONFIG.INTERVAL_MS);
  }, CLEANUP_CONFIG.INITIAL_DELAY_MS);
}

/**
 * Stop the cache cleanup scheduler
 * Should be called during application shutdown
 */
export function stopCacheCleanupScheduler() {
  if (cleanupScheduler === null) {
    logger.warn('[CACHE-CLEANUP] Scheduler not running');
    return;
  }

  if (typeof cleanupScheduler === 'number') {
    clearTimeout(cleanupScheduler);
  } else {
    clearInterval(cleanupScheduler);
  }

  cleanupScheduler = null;
  logger.info('[CACHE-CLEANUP] Scheduler stopped');
}

/**
 * Perform cache cleanup
 * Removes expired entries and logs statistics
 */
function performCleanup() {
  try {
    const startTime = Date.now();

    // Clean expired entries
    const cleanedCount = cleanExpiredEntries();

    // Get cache statistics
    const stats = getCacheStats();

    const duration = Date.now() - startTime;

    // Log cleanup results
    logger.info(
      `[CACHE-CLEANUP] Cleanup completed ` +
      `(removed: ${cleanedCount}, valid: ${stats.valid_entries}, ` +
      `expired: ${stats.expired_entries}, duration: ${duration}ms)`
    );

    // Check cache health and warn if needed
    if (stats.valid_entries > stats.max_entries * 0.9) {
      logger.warn(
        `[CACHE-CLEANUP] ⚠️ Cache near capacity: ${stats.valid_entries}/${stats.max_entries} ` +
        `(${((stats.valid_entries / stats.max_entries) * 100).toFixed(2)}%)`
      );
    }

    // Log hit rate if available
    if (stats.total > 0) {
      logger.debug(
        `[CACHE-CLEANUP] Cache hit rate: ${stats.hit_rate}% ` +
        `(${stats.total} total accesses)`
      );
    }

  } catch (error) {
    logger.error(`[CACHE-CLEANUP] Cleanup failed: ${error.message}`);
  }
}

/**
 * Get cleanup scheduler status
 * @returns {Object} Scheduler status information
 */
export function getSchedulerStatus() {
  return {
    enabled: CLEANUP_CONFIG.ENABLED,
    running: cleanupScheduler !== null,
    interval_ms: CLEANUP_CONFIG.INTERVAL_MS,
    initial_delay_ms: CLEANUP_CONFIG.INITIAL_DELAY_MS,
    next_cleanup_in_ms: cleanupScheduler ? 'scheduled' : 'not scheduled'
  };
}

/**
 * Manually trigger cleanup (for testing or admin endpoints)
 * @returns {Object} Cleanup result
 */
export function triggerManualCleanup() {
  try {
    const startTime = Date.now();
    const cleanedCount = cleanExpiredEntries();
    const duration = Date.now() - startTime;

    logger.info(`[CACHE-CLEANUP] Manual cleanup triggered - removed ${cleanedCount} entries in ${duration}ms`);

    return {
      success: true,
      entries_cleaned: cleanedCount,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    logger.error(`[CACHE-CLEANUP] Manual cleanup failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

export default {
  startCacheCleanupScheduler,
  stopCacheCleanupScheduler,
  getSchedulerStatus,
  triggerManualCleanup
};
