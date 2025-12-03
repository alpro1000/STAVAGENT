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
    ttl: 30 * 24 * 60 * 60, // 30 days
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
 * Attempts to connect to Redis, falls back to in-memory cache
 */
export async function initCache() {
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
      logger.warn(`[Cache] Redis error: ${err.message}, falling back to in-memory cache`);
      cacheClient = inMemoryCache;
    });

    await cacheClient.connect();
    logger.info('[Cache] Redis cache initialized successfully');
    return true;
  } catch (error) {
    logger.warn(`[Cache] Redis not available: ${error.message}, using in-memory cache`);
    cacheClient = inMemoryCache;
    return false;
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
 */
function generateCacheKey(prefix, input) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  return `${prefix}${hash}`;
}

/**
 * Cache document parsing results
 */
export async function cacheDocumentParsing(filePath, parsedResult) {
  try {
    const key = generateCacheKey(CACHE_CONFIG.document_parsing.prefix, filePath);
    const cache = getCache();

    await cache.set(
      key,
      {
        filePath,
        parsedResult,
        cached_at: new Date().toISOString()
      },
      CACHE_CONFIG.document_parsing.ttl
    );

    logger.debug(`[Cache] Document parsing cached: ${key}`);
    return key;
  } catch (error) {
    logger.warn(`[Cache] Failed to cache document parsing: ${error.message}`);
    return null;
  }
}

/**
 * Get cached document parsing
 */
export async function getCachedDocumentParsing(filePath) {
  try {
    const key = generateCacheKey(CACHE_CONFIG.document_parsing.prefix, filePath);
    const cache = getCache();

    const cached = await cache.get(key);
    if (cached) {
      logger.debug(`[Cache] Document parsing cache hit: ${key}`);
      return cached.parsedResult;
    }

    logger.debug(`[Cache] Document parsing cache miss: ${key}`);
    return null;
  } catch (error) {
    logger.warn(`[Cache] Failed to get cached document: ${error.message}`);
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
 */
export async function cacheLLMResponse(prompt, llmModel, response) {
  try {
    const key = generateCacheKey(CACHE_CONFIG.llm_response.prefix, { prompt, llmModel });
    const cache = getCache();

    await cache.set(
      key,
      {
        prompt: prompt.substring(0, 500), // Store truncated prompt
        llmModel,
        response,
        cached_at: new Date().toISOString()
      },
      CACHE_CONFIG.llm_response.ttl
    );

    logger.debug(`[Cache] LLM response cached: ${key}`);
    return key;
  } catch (error) {
    logger.warn(`[Cache] Failed to cache LLM response: ${error.message}`);
    return null;
  }
}

/**
 * Get cached LLM response
 */
export async function getCachedLLMResponse(prompt, llmModel) {
  try {
    const key = generateCacheKey(CACHE_CONFIG.llm_response.prefix, { prompt, llmModel });
    const cache = getCache();

    const cached = await cache.get(key);
    if (cached) {
      logger.debug(`[Cache] LLM response cache hit: ${key}`);
      return cached.response;
    }

    logger.debug(`[Cache] LLM response cache miss: ${key}`);
    return null;
  } catch (error) {
    logger.warn(`[Cache] Failed to get cached LLM response: ${error.message}`);
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
 */
export async function clearAllCache() {
  try {
    const cache = getCache();
    if (cache === inMemoryCache) {
      await cache.clear();
    } else {
      // For Redis, delete all keys with our prefixes
      const patterns = Object.values(CACHE_CONFIG).map(c => `${c.prefix}*`);
      for (const pattern of patterns) {
        const keys = await cache.keys(pattern);
        if (keys.length > 0) {
          await Promise.all(keys.map(key => cache.del(key)));
        }
      }
    }
    logger.info('[Cache] All cache cleared');
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
