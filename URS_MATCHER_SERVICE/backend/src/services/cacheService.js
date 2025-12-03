/**
 * Cache Service
 * Фаза 2 & 4: Оптимизация производительности через кэширование
 *
 * Поддерживает Redis кэш для:
 * - Результатов парсинга документов
 * - Результатов анализа блоков
 * - Результатов Q&A Flow
 * - LLM запросов к Perplexity/Claude
 */

import { logger } from '../utils/logger.js';
import crypto from 'crypto';

/**
 * Cache configuration
 * SECURITY: Updated TTLs and prefixes for multi-tenant isolation
 */
const CACHE_CONFIG = {
  document_parsing: {
    ttl: 7 * 24 * 60 * 60, // 7 days
    prefix: 'doc_parse:'
  },
  block_analysis: {
    ttl: 24 * 60 * 60, // 1 day
    prefix: 'block_analysis:'
  },
  qa_flow: {
    ttl: 24 * 60 * 60, // 1 day
    prefix: 'qa_flow:'
  },
  llm_response: {
    ttl: 7 * 24 * 60 * 60, // FIXED: 7 days instead of 30 (sensitive data)
    prefix: 'llm_response:'
  },
  perplexity_search: {
    ttl: 7 * 24 * 60 * 60, // 7 days
    prefix: 'perplexity:'
  }
};

/**
 * In-memory cache fallback when Redis is not available
 * Used for development/testing
 */
class InMemoryCache {
  constructor() {
    this.store = new Map();
    this.timestamps = new Map();
  }

  async set(key, value, ttl = 3600) {
    this.store.set(key, JSON.stringify(value));
    this.timestamps.set(key, Date.now() + (ttl * 1000));
    return true;
  }

  async get(key) {
    const expireTime = this.timestamps.get(key);
    if (expireTime && expireTime < Date.now()) {
      this.store.delete(key);
      this.timestamps.delete(key);
      return null;
    }
    const value = this.store.get(key);
    return value ? JSON.parse(value) : null;
  }

  async del(key) {
    this.store.delete(key);
    this.timestamps.delete(key);
    return true;
  }

  async clear() {
    this.store.clear();
    this.timestamps.clear();
    return true;
  }
}

// Global cache instance (will be Redis or in-memory)
let cacheClient = null;
const inMemoryCache = new InMemoryCache();

/**
 * Initialize cache service
 * SECURITY: Attempts to connect to Redis, fails hard in production
 */
export async function initCache() {
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';

  try {
    // Try to import Redis client
    const redis = await import('redis');
    cacheClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    });

    cacheClient.on('error', (err) => {
      logger.error(`[Cache] Redis error: ${err.message}`);
      if (isProduction) {
        // Fail hard in production - don't silently degrade
        throw new Error(`Cache service unavailable in production: ${err.message}`);
      } else {
        // Allow fallback only in development
        logger.warn(`[Cache] Falling back to in-memory cache (development only)`);
        cacheClient = inMemoryCache;
      }
    });

    await cacheClient.connect();
    logger.info('[Cache] Redis cache initialized successfully');
    return true;
  } catch (error) {
    logger.error(`[Cache] Failed to initialize cache: ${error.message}`);

    if (isProduction) {
      // Re-throw in production - don't continue with degraded cache
      throw new Error(`Cache initialization failed in production: ${error.message}`);
    } else {
      // Fallback to in-memory only for development
      logger.warn(`[Cache] Using in-memory cache (development environment)`);
      cacheClient = inMemoryCache;
      return false;
    }
  }
}

/**
 * Get cache client (Redis or in-memory)
 */
function getCache() {
  if (!cacheClient) {
    cacheClient = inMemoryCache;
  }
  return cacheClient;
}

/**
 * Generate cache key from input parameters
 * SECURITY: Includes userId and jobId for multi-tenant isolation
 *
 * @param {string} prefix - Cache prefix (from CACHE_CONFIG)
 * @param {object} input - Input object with stable key ordering
 * @param {string} userId - User ID for tenant isolation (optional)
 * @param {string} jobId - Job ID for isolation (optional)
 * @returns {string} Unique cache key
 */
function generateCacheKey(prefix, input, userId = 'default', jobId = 'default') {
  // Normalize input to prevent collision from key ordering
  const normalized = JSON.stringify(input, Object.keys(input || {}).sort());
  const contentHash = crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 12);

  // Include user and job in key for multi-tenant isolation
  return `${prefix}${userId}:${jobId}:${contentHash}`;
}

/**
 * Cache document parsing results
 * SECURITY: JSON serialization for Redis compatibility, includes userId/jobId
 */
export async function cacheDocumentParsing(filePath, parsedResult, userId = 'default', jobId = 'default') {
  try {
    const key = generateCacheKey(CACHE_CONFIG.document_parsing.prefix, filePath, userId, jobId);
    const cache = getCache();

    // FIXED: Must serialize to JSON string for Redis
    const cacheData = JSON.stringify({
      filePath,
      parsedResult,
      cached_at: new Date().toISOString()
    });

    if (cache === inMemoryCache) {
      // In-memory cache accepts JSON string
      await cache.set(key, { data: cacheData }, CACHE_CONFIG.document_parsing.ttl);
    } else {
      // Redis requires options object with EX for TTL
      await cache.set(key, cacheData, { EX: CACHE_CONFIG.document_parsing.ttl });
    }

    logger.debug(`[Cache] Document parsing cached: ${key}`);
    return key;
  } catch (error) {
    logger.error(`[Cache] Failed to cache document parsing: ${error.message}`);
    return null;
  }
}

/**
 * Get cached document parsing
 * SECURITY: JSON deserialization for Redis compatibility
 */
export async function getCachedDocumentParsing(filePath, userId = 'default', jobId = 'default') {
  try {
    const key = generateCacheKey(CACHE_CONFIG.document_parsing.prefix, filePath, userId, jobId);
    const cache = getCache();

    // FIXED: Must deserialize JSON string from Redis
    const cachedString = await cache.get(key);
    if (cachedString) {
      logger.debug(`[Cache] Document parsing cache hit: ${key}`);
      try {
        // Handle both direct objects (in-memory) and JSON strings (Redis)
        const cached = typeof cachedString === 'string' ? JSON.parse(cachedString) : cachedString.data ? JSON.parse(cachedString.data) : cachedString;
        return cached.parsedResult;
      } catch (parseError) {
        logger.error(`[Cache] Failed to parse cached data: ${parseError.message}`);
        return null;
      }
    }

    logger.debug(`[Cache] Document parsing cache miss: ${key}`);
    return null;
  } catch (error) {
    logger.error(`[Cache] Failed to get cached document: ${error.message}`);
    return null;
  }
}

/**
 * Cache block analysis results
 */
export async function cacheBlockAnalysis(blockId, blockContent, analysisResult) {
  try {
    const key = generateCacheKey(CACHE_CONFIG.block_analysis.prefix, { blockId, blockContent });
    const cache = getCache();

    await cache.set(
      key,
      {
        blockId,
        blockContent,
        analysisResult,
        cached_at: new Date().toISOString()
      },
      CACHE_CONFIG.block_analysis.ttl
    );

    logger.debug(`[Cache] Block analysis cached: ${key}`);
    return key;
  } catch (error) {
    logger.warn(`[Cache] Failed to cache block analysis: ${error.message}`);
    return null;
  }
}

/**
 * Get cached block analysis
 */
export async function getCachedBlockAnalysis(blockId, blockContent) {
  try {
    const key = generateCacheKey(CACHE_CONFIG.block_analysis.prefix, { blockId, blockContent });
    const cache = getCache();

    const cached = await cache.get(key);
    if (cached) {
      logger.debug(`[Cache] Block analysis cache hit: ${key}`);
      return cached.analysisResult;
    }

    logger.debug(`[Cache] Block analysis cache miss: ${key}`);
    return null;
  } catch (error) {
    logger.warn(`[Cache] Failed to get cached block analysis: ${error.message}`);
    return null;
  }
}

/**
 * Cache Q&A flow results
 */
export async function cacheQAFlow(documentPath, contextData, qaResult) {
  try {
    const key = generateCacheKey(CACHE_CONFIG.qa_flow.prefix, { documentPath, contextData });
    const cache = getCache();

    await cache.set(
      key,
      {
        documentPath,
        contextData,
        qaResult,
        cached_at: new Date().toISOString()
      },
      CACHE_CONFIG.qa_flow.ttl
    );

    logger.debug(`[Cache] Q&A flow cached: ${key}`);
    return key;
  } catch (error) {
    logger.warn(`[Cache] Failed to cache Q&A flow: ${error.message}`);
    return null;
  }
}

/**
 * Get cached Q&A flow
 */
export async function getCachedQAFlow(documentPath, contextData) {
  try {
    const key = generateCacheKey(CACHE_CONFIG.qa_flow.prefix, { documentPath, contextData });
    const cache = getCache();

    const cached = await cache.get(key);
    if (cached) {
      logger.debug(`[Cache] Q&A flow cache hit: ${key}`);
      return cached.qaResult;
    }

    logger.debug(`[Cache] Q&A flow cache miss: ${key}`);
    return null;
  } catch (error) {
    logger.warn(`[Cache] Failed to get cached Q&A flow: ${error.message}`);
    return null;
  }
}

/**
 * Cache LLM response (for expensive API calls)
 * SECURITY: Redacts prompts, shorter TTL (7 days), hashes input
 */
export async function cacheLLMResponse(prompt, llmModel, response, userId = 'default') {
  try {
    // SECURITY: Hash the prompt input, don't store the full prompt
    const promptHash = crypto.createHash('sha256').update(prompt).digest('hex').substring(0, 8);
    const key = generateCacheKey(CACHE_CONFIG.llm_response.prefix, { promptHash, llmModel }, userId);

    const cache = getCache();

    // SECURITY: Only store redacted/hashed prompt for audit, not full content
    const cacheData = JSON.stringify({
      promptHash,
      promptLength: prompt.length,
      llmModel,
      response,
      cached_at: new Date().toISOString()
    });

    if (cache === inMemoryCache) {
      await cache.set(key, { data: cacheData }, CACHE_CONFIG.llm_response.ttl);
    } else {
      await cache.set(key, cacheData, { EX: CACHE_CONFIG.llm_response.ttl });
    }

    logger.debug(`[Cache] LLM response cached: ${key} (prompt_len=${prompt.length}, model=${llmModel})`);
    return key;
  } catch (error) {
    logger.error(`[Cache] Failed to cache LLM response: ${error.message}`);
    return null;
  }
}

/**
 * Get cached LLM response
 * SECURITY: Requires prompt to verify via hash
 */
export async function getCachedLLMResponse(prompt, llmModel, userId = 'default') {
  try {
    const promptHash = crypto.createHash('sha256').update(prompt).digest('hex').substring(0, 8);
    const key = generateCacheKey(CACHE_CONFIG.llm_response.prefix, { promptHash, llmModel }, userId);
    const cache = getCache();

    const cachedString = await cache.get(key);
    if (cachedString) {
      logger.debug(`[Cache] LLM response cache hit: ${key}`);
      try {
        const cached = typeof cachedString === 'string' ? JSON.parse(cachedString) : JSON.parse(cachedString.data || cachedString);
        return cached.response;
      } catch (parseError) {
        logger.error(`[Cache] Failed to parse cached LLM response: ${parseError.message}`);
        return null;
      }
    }

    logger.debug(`[Cache] LLM response cache miss: ${key}`);
    return null;
  } catch (error) {
    logger.error(`[Cache] Failed to get cached LLM response: ${error.message}`);
    return null;
  }
}

/**
 * Cache Perplexity search results
 */
export async function cachePerplexitySearch(searchQuery, searchResults) {
  try {
    const key = generateCacheKey(CACHE_CONFIG.perplexity_search.prefix, { searchQuery });
    const cache = getCache();

    await cache.set(
      key,
      {
        searchQuery,
        searchResults,
        cached_at: new Date().toISOString()
      },
      CACHE_CONFIG.perplexity_search.ttl
    );

    logger.debug(`[Cache] Perplexity search cached: ${key}`);
    return key;
  } catch (error) {
    logger.warn(`[Cache] Failed to cache Perplexity search: ${error.message}`);
    return null;
  }
}

/**
 * Get cached Perplexity search results
 */
export async function getCachedPerplexitySearch(searchQuery) {
  try {
    const key = generateCacheKey(CACHE_CONFIG.perplexity_search.prefix, { searchQuery });
    const cache = getCache();

    const cached = await cache.get(key);
    if (cached) {
      logger.debug(`[Cache] Perplexity search cache hit: ${key}`);
      return cached.searchResults;
    }

    logger.debug(`[Cache] Perplexity search cache miss: ${key}`);
    return null;
  } catch (error) {
    logger.warn(`[Cache] Failed to get cached Perplexity search: ${error.message}`);
    return null;
  }
}

/**
 * Clear all cache
 * SECURITY: Requires admin authorization to prevent DoS via cache invalidation
 *
 * @param {boolean} isAdmin - Must be explicitly true, requires admin context
 * @returns {Promise<boolean>}
 */
export async function clearAllCache(isAdmin = false) {
  try {
    // SECURITY: Require explicit admin flag to prevent unauthorized cache clearing
    if (!isAdmin) {
      logger.warn(`[Cache] Unauthorized cache clear attempt (requires admin)`);
      throw new Error('Cache clear requires admin authorization');
    }

    const cache = getCache();
    if (cache === inMemoryCache) {
      await cache.clear();
      logger.warn('[Cache] All in-memory cache cleared (admin)');
    } else {
      // For Redis, delete only our namespaced keys using SCAN to avoid blocking
      const patterns = Object.values(CACHE_CONFIG).map(c => `${c.prefix}*`);
      let totalDeleted = 0;

      // Collect all keys first
      const keysToDelete = [];

      for (const pattern of patterns) {
        let cursor = 0;
        do {
          // Use SCAN instead of KEYS to avoid blocking the Redis server
          const reply = await cache.scan(cursor, { MATCH: pattern, COUNT: 100 });
          keysToDelete.push(...reply.keys);
          cursor = reply.cursor;
        } while (cursor !== 0);
      }

      // Delete keys in batches with error handling
      if (keysToDelete.length > 0) {
        const batchSize = 1000; // Safe batch size for DEL command
        const deletePromises = [];

        for (let i = 0; i < keysToDelete.length; i += batchSize) {
          const batch = keysToDelete.slice(i, i + batchSize);
          // Use array instead of spread operator to avoid call stack exceeded
          const deletePromise = cache.del(batch)
            .then(result => {
              totalDeleted += result;
              logger.debug(`[Cache] Batch delete completed: ${result} keys removed`);
              return result;
            })
            .catch(batchError => {
              // Log batch-specific errors but continue with other batches
              const batchStart = i;
              const batchEnd = Math.min(i + batchSize, keysToDelete.length);
              logger.error(
                `[Cache] Failed to delete batch [${batchStart}-${batchEnd}]: ${batchError.message}`
              );
              return 0; // Return 0 for this batch if it fails
            });

          deletePromises.push(deletePromise);
        }

        // Execute all batches in parallel for better performance
        const batchResults = await Promise.all(deletePromises);
        totalDeleted = batchResults.reduce((sum, count) => sum + count, 0);
      }

      logger.warn(
        `[Cache] Cleared ${totalDeleted} Redis keys using SCAN with batches (admin) - ${Math.ceil(keysToDelete.length / 1000)} batches`
      );
    }

    return true;
  } catch (error) {
    logger.error(`[Cache] Failed to clear cache: ${error.message}`);
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  try {
    const cache = getCache();
    if (cache === inMemoryCache) {
      return {
        type: 'in-memory',
        size: cache.store.size,
        max_size: 'unlimited'
      };
    }

    // For Redis
    const info = await cache.info('memory');
    return {
      type: 'redis',
      info
    };
  } catch (error) {
    logger.warn(`[Cache] Failed to get cache stats: ${error.message}`);
    return null;
  }
}

/**
 * Close cache connection
 */
export async function closeCache() {
  try {
    if (cacheClient && cacheClient !== inMemoryCache) {
      await cacheClient.quit();
      logger.info('[Cache] Cache connection closed');
    }
    return true;
  } catch (error) {
    logger.error(`[Cache] Failed to close cache: ${error.message}`);
    return false;
  }
}
