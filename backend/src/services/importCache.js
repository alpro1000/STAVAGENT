/**
 * Import Cache Service
 * Caches parsed Excel results to avoid re-parsing identical files
 * Uses file hash (MD5) as cache key
 */

import crypto from 'crypto';
import fs from 'fs';
import { logger } from '../utils/logger.js';

class ImportCache {
  constructor() {
    this.memory = new Map();  // In-memory cache
    this.maxCacheSize = 100;  // Max items in cache
    this.ttl = 24 * 60 * 60 * 1000;  // 24 hours
  }

  /**
   * Generate MD5 hash of file
   * @param {string} filePath - Path to Excel file
   * @returns {string} MD5 hash
   */
  static generateFileHash(filePath) {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const hashSum = crypto.createHash('md5');
      hashSum.update(fileBuffer);
      return hashSum.digest('hex');
    } catch (error) {
      logger.error(`[Cache] Error generating file hash: ${error.message}`);
      return null;
    }
  }

  /**
   * Get cached result if exists
   * @param {string} filePath - Path to Excel file
   * @returns {Object|null} Cached result or null
   */
  get(filePath) {
    const fileHash = ImportCache.generateFileHash(filePath);
    if (!fileHash) return null;

    const cacheKey = `import_${fileHash}`;
    const cached = this.memory.get(cacheKey);

    if (cached) {
      // Check if cache expired
      if (Date.now() - cached.timestamp > this.ttl) {
        logger.info(`[Cache] Cache expired for ${fileHash.substring(0, 8)}...`);
        this.memory.delete(cacheKey);
        return null;
      }

      logger.info(`[Cache] ✅ Cache HIT for ${fileHash.substring(0, 8)}... (${cached.source})`);
      return cached.data;
    }

    logger.info(`[Cache] ❌ Cache MISS for ${fileHash.substring(0, 8)}...`);
    return null;
  }

  /**
   * Store result in cache
   * @param {string} filePath - Path to Excel file
   * @param {Object} data - Data to cache
   * @param {string} source - Where data came from (CORE|LOCAL|TEMPLATE)
   */
  set(filePath, data, source = 'unknown') {
    const fileHash = ImportCache.generateFileHash(filePath);
    if (!fileHash) return;

    const cacheKey = `import_${fileHash}`;

    // Evict oldest entry if cache is full
    if (this.memory.size >= this.maxCacheSize) {
      const firstKey = this.memory.keys().next().value;
      this.memory.delete(firstKey);
      logger.info(`[Cache] Evicted oldest entry to make room`);
    }

    this.memory.set(cacheKey, {
      data,
      source,
      timestamp: Date.now(),
      fileHash: fileHash.substring(0, 8)
    });

    logger.info(
      `[Cache] 💾 Cached result (${source}, ${fileHash.substring(0, 8)}..., ` +
      `items: ${this.memory.size}/${this.maxCacheSize})`
    );
  }

  /**
   * Clear specific cache entry
   * @param {string} fileHash - File hash to clear
   */
  clear(fileHash) {
    const cacheKey = `import_${fileHash}`;
    if (this.memory.has(cacheKey)) {
      this.memory.delete(cacheKey);
      logger.info(`[Cache] 🗑️ Cleared cache for ${fileHash.substring(0, 8)}...`);
    }
  }

  /**
   * Clear all cache
   */
  clearAll() {
    const size = this.memory.size;
    this.memory.clear();
    logger.info(`[Cache] 🗑️ Cleared all cache (${size} entries)`);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      size: this.memory.size,
      maxSize: this.maxCacheSize,
      ttl: this.ttl,
      entries: Array.from(this.memory.values()).map(entry => ({
        source: entry.source,
        fileHash: entry.fileHash,
        age: Math.floor((Date.now() - entry.timestamp) / 1000) + 's'
      }))
    };
  }
}

// Export singleton instance
export const importCache = new ImportCache();

/**
 * Middleware to add cache stats to response headers
 */
export function cacheStatsMiddleware(req, res, next) {
  const originalJson = res.json;

  res.json = function(data) {
    const stats = importCache.getStats();
    res.set('X-Cache-Size', stats.size.toString());
    res.set('X-Cache-Max-Size', stats.maxSize.toString());
    return originalJson.call(this, data);
  };

  next();
}
