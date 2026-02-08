/**
 * Knowledge Base
 * База знаний для хранения и поиска строительных норм
 *
 * Структура хранения:
 * - SQLite для метаданных и индексов
 * - JSON файлы для полного содержимого норм
 * - In-memory кэш для быстрого доступа
 *
 * Организация по папкам (категориям):
 * - norms/csn/           - ČSN нормы
 * - norms/csn_en/        - ČSN EN нормы
 * - norms/laws/          - Законы и выhlášky
 * - norms/tp/            - Технические условия
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { normalizeNorm, parseNormReference, CSN_CATEGORIES } from './normParser.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const KB_CONFIG = {
  basePath: process.env.KB_PATH || './data/knowledge_base',
  maxCacheSize: 1000,           // Max items in memory cache
  cacheExpireMs: 3600000,       // 1 hour cache expiration
  indexUpdateInterval: 60000    // Index update check interval
};

// In-memory cache
const cache = {
  norms: new Map(),
  index: null,
  lastUpdate: null
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize knowledge base directory structure
 */
export async function initKnowledgeBase() {
  const dirs = [
    'norms/csn',
    'norms/csn_en',
    'norms/csn_iso',
    'norms/laws',
    'norms/vyhlaska',
    'norms/tp',
    'norms/tkp',
    'index',
    'cache'
  ];

  try {
    for (const dir of dirs) {
      const fullPath = path.join(KB_CONFIG.basePath, dir);
      await fs.mkdir(fullPath, { recursive: true });
    }

    logger.info(`[KnowledgeBase] Initialized at ${KB_CONFIG.basePath}`);

    // Load index into memory
    await loadIndex();

    return true;
  } catch (error) {
    logger.error(`[KnowledgeBase] Init error: ${error.message}`);
    return false;
  }
}

// ============================================================================
// STORAGE OPERATIONS
// ============================================================================

/**
 * Save norm to knowledge base
 *
 * @param {Object} norm - Normalized norm object
 * @returns {Promise<boolean>} Success status
 */
export async function saveNorm(norm) {
  try {
    // Ensure norm is normalized
    const normalizedNorm = norm.machineReadable ? norm : normalizeNorm(norm);

    // Determine folder based on type
    const folder = getNormFolder(normalizedNorm.type);
    const fileName = `${normalizedNorm.id}.json`;
    const filePath = path.join(KB_CONFIG.basePath, 'norms', folder, fileName);

    // Save to file
    await fs.writeFile(filePath, JSON.stringify(normalizedNorm, null, 2), 'utf8');

    // Update cache
    cache.norms.set(normalizedNorm.id, {
      norm: normalizedNorm,
      timestamp: Date.now()
    });

    // Update index
    await updateIndex(normalizedNorm);

    logger.debug(`[KnowledgeBase] Saved norm: ${normalizedNorm.code}`);
    return true;

  } catch (error) {
    logger.error(`[KnowledgeBase] Save error: ${error.message}`);
    return false;
  }
}

/**
 * Save multiple norms in batch
 *
 * @param {Array} norms - Array of norms to save
 * @returns {Promise<Object>} Save results
 */
export async function saveNormsBatch(norms) {
  const results = {
    saved: 0,
    failed: 0,
    errors: []
  };

  for (const norm of norms) {
    const success = await saveNorm(norm);
    if (success) {
      results.saved++;
    } else {
      results.failed++;
      results.errors.push(norm.code || norm.id);
    }
  }

  logger.info(`[KnowledgeBase] Batch save: ${results.saved} saved, ${results.failed} failed`);
  return results;
}

/**
 * Get norm by ID or code
 *
 * @param {string} idOrCode - Norm ID or code
 * @returns {Promise<Object|null>} Norm or null
 */
export async function getNorm(idOrCode) {
  // Try cache first
  const normId = normalizeId(idOrCode);
  const cached = cache.norms.get(normId);

  if (cached && (Date.now() - cached.timestamp) < KB_CONFIG.cacheExpireMs) {
    return cached.norm;
  }

  // Try to load from file
  try {
    // Check all folders
    const folders = ['csn', 'csn_en', 'csn_iso', 'laws', 'vyhlaska', 'tp', 'tkp'];

    for (const folder of folders) {
      const filePath = path.join(KB_CONFIG.basePath, 'norms', folder, `${normId}.json`);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const norm = JSON.parse(content);

        // Update cache
        cache.norms.set(normId, {
          norm,
          timestamp: Date.now()
        });

        return norm;
      } catch {
        // File not found, try next folder
      }
    }

    return null;
  } catch (error) {
    logger.error(`[KnowledgeBase] Get norm error: ${error.message}`);
    return null;
  }
}

/**
 * Delete norm from knowledge base
 *
 * @param {string} idOrCode - Norm ID or code
 * @returns {Promise<boolean>} Success status
 */
export async function deleteNorm(idOrCode) {
  const normId = normalizeId(idOrCode);

  try {
    const folders = ['csn', 'csn_en', 'csn_iso', 'laws', 'vyhlaska', 'tp', 'tkp'];

    for (const folder of folders) {
      const filePath = path.join(KB_CONFIG.basePath, 'norms', folder, `${normId}.json`);
      try {
        await fs.unlink(filePath);
        cache.norms.delete(normId);
        await removeFromIndex(normId);
        logger.info(`[KnowledgeBase] Deleted norm: ${normId}`);
        return true;
      } catch {
        // File not found, try next folder
      }
    }

    return false;
  } catch (error) {
    logger.error(`[KnowledgeBase] Delete error: ${error.message}`);
    return false;
  }
}

// ============================================================================
// SEARCH AND RETRIEVAL
// ============================================================================

/**
 * Search norms in knowledge base
 *
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Matching norms
 */
export async function searchKnowledgeBase(query, options = {}) {
  const {
    type = null,           // Filter by norm type
    category = null,       // Filter by category
    limit = 20,            // Max results
    includeContent = false // Include full content
  } = options;

  const index = await loadIndex();
  if (!index) {
    return [];
  }

  const queryLower = query.toLowerCase();
  const results = [];

  for (const entry of index.entries) {
    // Skip if type filter doesn't match
    if (type && entry.type !== type) continue;

    // Skip if category filter doesn't match
    if (category && entry.category !== category) continue;

    // Calculate relevance score
    let score = 0;

    // Exact code match
    if (entry.code.toLowerCase().includes(queryLower)) {
      score += 10;
    }

    // Title match
    if (entry.title?.toLowerCase().includes(queryLower)) {
      score += 5;
    }

    // Keywords match
    if (entry.keywords?.some(k => k.includes(queryLower))) {
      score += 3;
    }

    // Topics match
    if (entry.topics?.some(t => t.toLowerCase().includes(queryLower))) {
      score += 2;
    }

    if (score > 0) {
      results.push({
        ...entry,
        score,
        ...(includeContent ? await getNorm(entry.id) : {})
      });
    }
  }

  // Sort by score and limit
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get norms by category
 *
 * @param {string} category - Category code (e.g., "73", "27")
 * @returns {Promise<Array>} Norms in category
 */
export async function getNormsByCategory(category) {
  return searchKnowledgeBase('', { category, limit: 100 });
}

/**
 * Get norms by type
 *
 * @param {string} type - Norm type (csn, csn_en, laws, etc.)
 * @returns {Promise<Array>} Norms of type
 */
export async function getNormsByType(type) {
  return searchKnowledgeBase('', { type, limit: 100 });
}

/**
 * Get related norms
 *
 * @param {string} normCode - Norm code
 * @returns {Promise<Array>} Related norms
 */
export async function getRelatedNorms(normCode) {
  const norm = await getNorm(normCode);
  if (!norm) return [];

  const related = [];

  // Get norms from references
  if (norm.references) {
    const refCodes = [
      ...(norm.references.related || []),
      ...(norm.references.replaces || []),
      ...(norm.references.replacedBy || [])
    ];

    for (const refCode of refCodes) {
      const refNorm = await getNorm(refCode);
      if (refNorm) {
        related.push(refNorm);
      }
    }
  }

  // Get norms with same category
  if (norm.category) {
    const categoryNorms = await getNormsByCategory(norm.category.code || norm.category);
    related.push(...categoryNorms.filter(n => n.id !== norm.id).slice(0, 5));
  }

  return related;
}

// ============================================================================
// INDEX MANAGEMENT
// ============================================================================

/**
 * Load index from file into memory
 */
async function loadIndex() {
  if (cache.index && (Date.now() - cache.lastUpdate) < KB_CONFIG.indexUpdateInterval) {
    return cache.index;
  }

  try {
    const indexPath = path.join(KB_CONFIG.basePath, 'index', 'main.json');
    const content = await fs.readFile(indexPath, 'utf8');
    cache.index = JSON.parse(content);
    cache.lastUpdate = Date.now();
    return cache.index;
  } catch {
    // Index doesn't exist, create empty one
    cache.index = { entries: [], lastUpdate: null };
    return cache.index;
  }
}

/**
 * Update index with new norm
 */
async function updateIndex(norm) {
  const index = await loadIndex();

  // Remove existing entry if present
  index.entries = index.entries.filter(e => e.id !== norm.id);

  // Add new entry
  index.entries.push({
    id: norm.id,
    code: norm.code,
    type: norm.type,
    title: norm.title,
    category: norm.category?.name || null,
    topics: norm.topics || [],
    keywords: norm.keywords || [],
    status: norm.metadata?.status || 'active',
    lastUpdate: norm.metadata?.lastUpdate
  });

  index.lastUpdate = new Date().toISOString();

  // Save index
  const indexPath = path.join(KB_CONFIG.basePath, 'index', 'main.json');
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');

  cache.index = index;
  cache.lastUpdate = Date.now();
}

/**
 * Remove norm from index
 */
async function removeFromIndex(normId) {
  const index = await loadIndex();
  index.entries = index.entries.filter(e => e.id !== normId);
  index.lastUpdate = new Date().toISOString();

  const indexPath = path.join(KB_CONFIG.basePath, 'index', 'main.json');
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');

  cache.index = index;
}

/**
 * Rebuild entire index from files
 */
export async function rebuildIndex() {
  logger.info('[KnowledgeBase] Rebuilding index...');

  const index = { entries: [], lastUpdate: null };
  const folders = ['csn', 'csn_en', 'csn_iso', 'laws', 'vyhlaska', 'tp', 'tkp'];

  for (const folder of folders) {
    const folderPath = path.join(KB_CONFIG.basePath, 'norms', folder);
    try {
      const files = await fs.readdir(folderPath);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const content = await fs.readFile(path.join(folderPath, file), 'utf8');
          const norm = JSON.parse(content);

          index.entries.push({
            id: norm.id,
            code: norm.code,
            type: norm.type,
            title: norm.title,
            category: norm.category?.name || null,
            topics: norm.topics || [],
            keywords: norm.keywords || [],
            status: norm.metadata?.status || 'active',
            lastUpdate: norm.metadata?.lastUpdate
          });
        } catch (e) {
          logger.warn(`[KnowledgeBase] Error reading ${file}: ${e.message}`);
        }
      }
    } catch {
      // Folder doesn't exist
    }
  }

  index.lastUpdate = new Date().toISOString();

  const indexPath = path.join(KB_CONFIG.basePath, 'index', 'main.json');
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf8');

  cache.index = index;
  cache.lastUpdate = Date.now();

  logger.info(`[KnowledgeBase] Index rebuilt: ${index.entries.length} entries`);
  return index;
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Get knowledge base statistics
 */
export async function getStatistics() {
  const index = await loadIndex();

  const stats = {
    totalNorms: index.entries.length,
    byType: {},
    byCategory: {},
    byStatus: {},
    lastUpdate: index.lastUpdate
  };

  for (const entry of index.entries) {
    // Count by type
    stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;

    // Count by category
    if (entry.category) {
      stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
    }

    // Count by status
    stats.byStatus[entry.status] = (stats.byStatus[entry.status] || 0) + 1;
  }

  return stats;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get folder for norm type
 */
function getNormFolder(type) {
  const folderMap = {
    'csn': 'csn',
    'csn_en': 'csn_en',
    'csn_iso': 'csn_iso',
    'vyhlaska': 'vyhlaska',
    'zakon': 'laws',
    'tp': 'tp',
    'tkp': 'tkp'
  };

  return folderMap[type] || 'csn';
}

/**
 * Normalize ID from code
 */
function normalizeId(idOrCode) {
  return idOrCode
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');
}

export default {
  initKnowledgeBase,
  saveNorm,
  saveNormsBatch,
  getNorm,
  deleteNorm,
  searchKnowledgeBase,
  getNormsByCategory,
  getNormsByType,
  getRelatedNorms,
  rebuildIndex,
  getStatistics,
  KB_CONFIG
};
