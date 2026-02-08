/**
 * Norms Service
 * Оркестратор для поиска, парсинга и хранения строительных норм
 *
 * Основные функции:
 * - Поиск норм через Web Search (Brave, Tavily)
 * - Парсинг и нормализация
 * - Сохранение в базу знаний
 * - Retrieval для анализа проектов
 */

import { logger } from '../../utils/logger.js';
import { searchNorms, searchCSNNorm, searchBuildingLaw, TRUSTED_SOURCES } from './webSearchClient.js';
import { parseNormReference, normalizeNorm, normalizeSearchResults, extractNormDetailsWithLLM, CSN_CATEGORIES, NORM_TYPES } from './normParser.js';
import { initKnowledgeBase, saveNorm, saveNormsBatch, getNorm, searchKnowledgeBase, getRelatedNorms, getStatistics, rebuildIndex } from './knowledgeBase.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

let isInitialized = false;

/**
 * Initialize norms service
 */
export async function initNormsService() {
  if (isInitialized) return true;

  try {
    logger.info('[NormsService] Initializing...');

    // Initialize knowledge base
    const kbInitialized = await initKnowledgeBase();
    if (!kbInitialized) {
      logger.warn('[NormsService] Knowledge base initialization failed, using memory-only mode');
    }

    isInitialized = true;
    logger.info('[NormsService] Initialized successfully');
    return true;
  } catch (error) {
    logger.error(`[NormsService] Init error: ${error.message}`);
    return false;
  }
}

// ============================================================================
// SEARCH AND FETCH
// ============================================================================

/**
 * Search for norms (combines web search + local KB)
 *
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results
 */
export async function findNorms(query, options = {}) {
  await initNormsService();

  const startTime = Date.now();
  logger.info(`[NormsService] Searching norms: "${query}"`);

  // Search local knowledge base first
  const localResults = await searchKnowledgeBase(query, {
    limit: options.limit || 10,
    type: options.type,
    category: options.category
  });

  // If enough local results, return them
  if (localResults.length >= (options.minResults || 5) && !options.forceWebSearch) {
    logger.info(`[NormsService] Found ${localResults.length} results in local KB`);
    return {
      source: 'local',
      results: localResults,
      webSearchPerformed: false,
      duration: Date.now() - startTime
    };
  }

  // Web search for additional results
  const webResults = await searchNorms(query, options);

  // Normalize and potentially save new norms
  const normalizedWeb = normalizeSearchResults(webResults.results);

  // Save trusted sources to KB (background)
  const trustedNorms = normalizedWeb.filter(n => n.metadata?.sourceUrl &&
    TRUSTED_SOURCES.some(s => n.metadata.sourceUrl.includes(s)));

  if (trustedNorms.length > 0) {
    saveNormsBatch(trustedNorms).catch(e =>
      logger.warn(`[NormsService] Failed to save norms: ${e.message}`)
    );
  }

  // Combine results (local first, then web)
  const combinedResults = deduplicateResults([...localResults, ...normalizedWeb]);

  const duration = Date.now() - startTime;
  logger.info(`[NormsService] Search completed in ${duration}ms: ${combinedResults.length} results`);

  return {
    source: 'combined',
    results: combinedResults,
    webSearchPerformed: true,
    webAnswer: webResults.answer,
    metadata: {
      localCount: localResults.length,
      webCount: normalizedWeb.length,
      savedCount: trustedNorms.length
    },
    duration
  };
}

/**
 * Fetch specific norm by code
 *
 * @param {string} normCode - Norm code (e.g., "ČSN EN 13670", "73 2400")
 * @returns {Promise<Object|null>} Norm data
 */
export async function fetchNorm(normCode) {
  await initNormsService();

  logger.info(`[NormsService] Fetching norm: ${normCode}`);

  // Try local KB first
  let norm = await getNorm(normCode);
  if (norm) {
    logger.debug(`[NormsService] Found in local KB: ${normCode}`);
    return norm;
  }

  // Web search
  const searchResults = await searchCSNNorm(normCode);

  if (searchResults.results.length === 0) {
    logger.warn(`[NormsService] Norm not found: ${normCode}`);
    return null;
  }

  // Get first trusted result
  const bestResult = searchResults.results.find(r => r.isTrusted) || searchResults.results[0];

  // Extract details with LLM if content available
  let details = null;
  if (bestResult.content || bestResult.rawContent) {
    details = await extractNormDetailsWithLLM(
      normCode,
      bestResult.content || bestResult.rawContent
    );
  }

  // Normalize and save
  norm = normalizeNorm({
    code: normCode,
    title: bestResult.title,
    description: bestResult.description || bestResult.content,
    url: bestResult.url,
    source: bestResult.source,
    isTrusted: bestResult.isTrusted,
    // Add LLM-extracted details
    ...(details && {
      scope: details.scope,
      requirements: details.keyRequirements,
      related: details.relatedNorms,
      topics: details.topics,
      abstract: details.summary
    })
  });

  // Save to KB
  await saveNorm(norm);

  return norm;
}

/**
 * Search building laws and regulations
 *
 * @param {string} topic - Topic (e.g., "stavební povolení", "kolaudace")
 * @returns {Promise<Object>} Search results
 */
export async function findBuildingLaws(topic) {
  await initNormsService();

  logger.info(`[NormsService] Searching building laws: ${topic}`);

  // Web search
  const webResults = await searchBuildingLaw(topic);

  // Normalize results
  const normalized = normalizeSearchResults(webResults.results);

  // Mark as law type
  normalized.forEach(n => {
    if (n.code.includes('Zákon') || n.code.includes('Vyhláška')) {
      // Already correct type
    } else {
      n.type = 'law';
      n.typeName = 'Právní předpis';
    }
  });

  return {
    topic,
    results: normalized,
    answer: webResults.answer,
    sources: webResults.results.map(r => r.url)
  };
}

// ============================================================================
// RETRIEVAL FOR PROJECT ANALYSIS
// ============================================================================

/**
 * Get relevant norms for project analysis
 *
 * @param {Object} projectContext - Project context
 * @returns {Promise<Array>} Relevant norms
 */
export async function getRelevantNormsForProject(projectContext) {
  await initNormsService();

  const relevantNorms = [];
  const searchQueries = [];

  // Build search queries based on project context
  if (projectContext.buildingType) {
    searchQueries.push(`${projectContext.buildingType} normy požadavky`);
  }

  if (projectContext.mainSystems?.length > 0) {
    for (const system of projectContext.mainSystems) {
      searchQueries.push(`${system} ČSN norma`);
    }
  }

  if (projectContext.positions?.length > 0) {
    // Extract unique work types from positions
    const workTypes = new Set();
    projectContext.positions.forEach(pos => {
      const text = (pos.description || pos.raw_text || '').toLowerCase();

      if (text.includes('beton')) workTypes.add('betonové konstrukce');
      if (text.includes('zdivo')) workTypes.add('zděné konstrukce');
      if (text.includes('izolace')) workTypes.add('izolace');
      if (text.includes('základy')) workTypes.add('zakládání');
      if (text.includes('střech')) workTypes.add('střešní konstrukce');
    });

    workTypes.forEach(wt => searchQueries.push(`${wt} ČSN norma`));
  }

  // Execute searches
  for (const query of searchQueries.slice(0, 5)) { // Limit to 5 queries
    const results = await findNorms(query, { limit: 3, minResults: 0 });
    relevantNorms.push(...results.results);
  }

  // Deduplicate and limit
  return deduplicateResults(relevantNorms).slice(0, 20);
}

/**
 * Get norms for specific construction work
 *
 * @param {string} workDescription - Work description
 * @returns {Promise<Array>} Relevant norms
 */
export async function getNormsForWork(workDescription) {
  await initNormsService();

  const lowerDesc = workDescription.toLowerCase();

  // Determine work category
  let category = null;
  let searchTerms = [];

  if (lowerDesc.includes('beton') || lowerDesc.includes('železobeton')) {
    category = '27';
    searchTerms = ['ČSN EN 13670', 'ČSN EN 206', 'betonáž norma'];
  } else if (lowerDesc.includes('zdivo') || lowerDesc.includes('cihl')) {
    category = '30';
    searchTerms = ['ČSN EN 1996', 'zdění norma'];
  } else if (lowerDesc.includes('základ')) {
    category = '73';
    searchTerms = ['ČSN EN 1997', 'zakládání norma'];
  } else if (lowerDesc.includes('izolace')) {
    searchTerms = ['hydroizolace norma', 'tepelná izolace ČSN'];
  } else if (lowerDesc.includes('střech')) {
    searchTerms = ['střešní konstrukce ČSN', 'ploché střechy norma'];
  }

  const results = [];

  // Search by category if available
  if (category) {
    const categoryNorms = await searchKnowledgeBase('', { category, limit: 5 });
    results.push(...categoryNorms);
  }

  // Search by terms
  for (const term of searchTerms.slice(0, 2)) {
    const searchResults = await findNorms(term, { limit: 3, minResults: 0 });
    results.push(...searchResults.results);
  }

  return deduplicateResults(results).slice(0, 10);
}

// ============================================================================
// KNOWLEDGE BASE MANAGEMENT
// ============================================================================

/**
 * Import norms from external source
 *
 * @param {Array} norms - Array of norm data
 * @returns {Promise<Object>} Import results
 */
export async function importNorms(norms) {
  await initNormsService();

  logger.info(`[NormsService] Importing ${norms.length} norms`);

  const normalized = norms.map(n => normalizeNorm(n));
  const results = await saveNormsBatch(normalized);

  return results;
}

/**
 * Get knowledge base statistics
 */
export async function getKBStatistics() {
  await initNormsService();
  return getStatistics();
}

/**
 * Rebuild knowledge base index
 */
export async function rebuildKBIndex() {
  await initNormsService();
  return rebuildIndex();
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Deduplicate results by code
 */
function deduplicateResults(results) {
  const seen = new Set();
  return results.filter(result => {
    const key = (result.code || result.id || '').toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

// Named re-exports for constants (used by routes)
export { CSN_CATEGORIES, NORM_TYPES } from './normParser.js';
export { TRUSTED_SOURCES } from './webSearchClient.js';

export default {
  initNormsService,
  findNorms,
  fetchNorm,
  findBuildingLaws,
  getRelevantNormsForProject,
  getNormsForWork,
  importNorms,
  getKBStatistics,
  rebuildKBIndex
};
