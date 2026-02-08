/**
 * Web Search Client
 * Интеграция с Brave Search и Tavily для поиска строительных норм
 *
 * Brave Search - общий поиск (бесплатно 2000 запросов/месяц)
 * Tavily - специализированный поиск с извлечением контента
 */

import axios from 'axios';
import { logger } from '../../utils/logger.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search';
const TAVILY_API_URL = 'https://api.tavily.com/search';

const SEARCH_CONFIG = {
  brave: {
    timeout: 15000,
    resultsPerQuery: 10,
    country: 'cz',
    language: 'cs'
  },
  tavily: {
    timeout: 30000,
    maxResults: 5,
    searchDepth: 'advanced', // 'basic' or 'advanced'
    includeAnswer: true,
    includeRawContent: true
  }
};

// Czech construction norm sources
const TRUSTED_SOURCES = [
  'csnonline.agentura-cas.cz',  // ČSN online
  'technicke-normy.cz',          // Technické normy
  'unmz.cz',                      // Úřad pro technickou normalizaci
  'mmr.cz',                       // Ministerstvo pro místní rozvoj
  'mpo.cz',                       // Ministerstvo průmyslu a obchodu
  'zakonyprolidi.cz',            // Zákony pro lidi
  'stavebni-zakon.cz',           // Stavební zákon
  'tzb-info.cz',                  // TZB-info (technické informace)
  'asb-portal.cz',               // ASB Portal
  'estav.cz'                      // eStav
];

// ============================================================================
// BRAVE SEARCH
// ============================================================================

/**
 * Search using Brave Search API
 * Free tier: 2000 queries/month
 *
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Search results
 */
export async function searchWithBrave(query, options = {}) {
  const apiKey = process.env.BRAVE_API_KEY;

  if (!apiKey) {
    logger.warn('[WebSearch] BRAVE_API_KEY not set, skipping Brave search');
    return [];
  }

  try {
    const startTime = Date.now();
    logger.info(`[WebSearch/Brave] Searching: "${query.substring(0, 50)}..."`);

    const response = await axios.get(BRAVE_API_URL, {
      params: {
        q: query,
        count: options.count || SEARCH_CONFIG.brave.resultsPerQuery,
        country: options.country || SEARCH_CONFIG.brave.country,
        search_lang: options.language || SEARCH_CONFIG.brave.language,
        freshness: options.freshness || undefined, // 'pd', 'pw', 'pm', 'py'
        text_decorations: false,
        spellcheck: true
      },
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey
      },
      timeout: SEARCH_CONFIG.brave.timeout
    });

    const results = (response.data.web?.results || []).map(result => ({
      title: result.title,
      url: result.url,
      description: result.description,
      snippet: result.description,
      source: 'brave',
      isTrusted: TRUSTED_SOURCES.some(s => result.url.includes(s)),
      publishedDate: result.page_age || null,
      favicon: result.profile?.img || null
    }));

    const duration = Date.now() - startTime;
    logger.info(`[WebSearch/Brave] Found ${results.length} results in ${duration}ms`);

    return results;

  } catch (error) {
    logger.error(`[WebSearch/Brave] Error: ${error.message}`);
    if (error.response?.status === 429) {
      logger.warn('[WebSearch/Brave] Rate limit exceeded');
    }
    return [];
  }
}

// ============================================================================
// TAVILY SEARCH
// ============================================================================

/**
 * Search using Tavily API
 * Better for extracting structured content from pages
 *
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Search results with extracted content
 */
export async function searchWithTavily(query, options = {}) {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    logger.warn('[WebSearch] TAVILY_API_KEY not set, skipping Tavily search');
    return { results: [], answer: null };
  }

  try {
    const startTime = Date.now();
    logger.info(`[WebSearch/Tavily] Searching: "${query.substring(0, 50)}..."`);

    const response = await axios.post(TAVILY_API_URL, {
      api_key: apiKey,
      query: query,
      search_depth: options.searchDepth || SEARCH_CONFIG.tavily.searchDepth,
      include_answer: options.includeAnswer ?? SEARCH_CONFIG.tavily.includeAnswer,
      include_raw_content: options.includeRawContent ?? SEARCH_CONFIG.tavily.includeRawContent,
      max_results: options.maxResults || SEARCH_CONFIG.tavily.maxResults,
      include_domains: options.includeDomains || TRUSTED_SOURCES,
      exclude_domains: options.excludeDomains || []
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: SEARCH_CONFIG.tavily.timeout
    });

    const results = (response.data.results || []).map(result => ({
      title: result.title,
      url: result.url,
      content: result.content,
      rawContent: result.raw_content || null,
      score: result.score,
      source: 'tavily',
      isTrusted: TRUSTED_SOURCES.some(s => result.url.includes(s)),
      publishedDate: result.published_date || null
    }));

    const duration = Date.now() - startTime;
    logger.info(`[WebSearch/Tavily] Found ${results.length} results in ${duration}ms`);

    return {
      results,
      answer: response.data.answer || null,
      query: response.data.query
    };

  } catch (error) {
    logger.error(`[WebSearch/Tavily] Error: ${error.message}`);
    return { results: [], answer: null };
  }
}

// ============================================================================
// COMBINED SEARCH
// ============================================================================

/**
 * Search using both Brave and Tavily, merge results
 *
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Combined search results
 */
export async function searchNorms(query, options = {}) {
  const startTime = Date.now();

  // Prepare Czech construction-focused query
  const enhancedQuery = enhanceQueryForCzechNorms(query);

  // Run searches in parallel
  const [braveResults, tavilyResponse] = await Promise.all([
    searchWithBrave(enhancedQuery, options),
    searchWithTavily(enhancedQuery, options)
  ]);

  // Merge and deduplicate results
  const allResults = [...braveResults, ...tavilyResponse.results];
  const uniqueResults = deduplicateResults(allResults);

  // Sort by trust and relevance
  const sortedResults = uniqueResults.sort((a, b) => {
    // Trusted sources first
    if (a.isTrusted && !b.isTrusted) return -1;
    if (!a.isTrusted && b.isTrusted) return 1;
    // Then by score (if available)
    if (a.score && b.score) return b.score - a.score;
    return 0;
  });

  const duration = Date.now() - startTime;
  logger.info(`[WebSearch] Combined search completed in ${duration}ms: ${sortedResults.length} unique results`);

  return {
    query: enhancedQuery,
    originalQuery: query,
    results: sortedResults,
    answer: tavilyResponse.answer,
    metadata: {
      braveCount: braveResults.length,
      tavilyCount: tavilyResponse.results.length,
      uniqueCount: sortedResults.length,
      trustedCount: sortedResults.filter(r => r.isTrusted).length,
      durationMs: duration
    }
  };
}

/**
 * Search specifically for ČSN norms
 *
 * @param {string} normCode - Norm code (e.g., "ČSN EN 13670", "73 2400")
 * @returns {Promise<Object>} Search results
 */
export async function searchCSNNorm(normCode) {
  // Normalize norm code
  const normalizedCode = normCode
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  const queries = [
    `${normalizedCode} technická norma`,
    `${normalizedCode} stavebnictví`,
    `ČSN ${normalizedCode} požadavky`
  ];

  // Try multiple query variations
  for (const query of queries) {
    const results = await searchNorms(query, {
      includeDomains: TRUSTED_SOURCES.slice(0, 5) // Focus on norm sources
    });

    if (results.results.length > 0) {
      return results;
    }
  }

  return { query: normalizedCode, results: [], answer: null };
}

/**
 * Search for building regulations and laws
 *
 * @param {string} topic - Topic to search (e.g., "stavební povolení", "kolaudace")
 * @returns {Promise<Object>} Search results
 */
export async function searchBuildingLaw(topic) {
  const query = `${topic} stavební zákon Česká republika legislativa`;

  return searchNorms(query, {
    includeDomains: [
      'zakonyprolidi.cz',
      'mmr.cz',
      'stavebni-zakon.cz',
      'tzb-info.cz'
    ]
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Enhance query for Czech construction norms
 */
function enhanceQueryForCzechNorms(query) {
  const lowerQuery = query.toLowerCase();

  // Check if query mentions norms
  const hasNormReference = /čsn|en\s*\d|iso\s*\d|norma|standard/i.test(query);

  if (hasNormReference) {
    return `${query} technická norma stavebnictví Česko`;
  }

  // Check if query is about construction
  const constructionKeywords = [
    'beton', 'železobeton', 'zdivo', 'základy', 'střecha',
    'izolace', 'fasáda', 'podlaha', 'strop', 'schody',
    'okna', 'dveře', 'vytápění', 'elektro', 'voda', 'kanalizace'
  ];

  const isConstruction = constructionKeywords.some(kw => lowerQuery.includes(kw));

  if (isConstruction) {
    return `${query} ČSN norma požadavky stavba`;
  }

  return `${query} stavebnictví Česko`;
}

/**
 * Deduplicate search results by URL
 */
function deduplicateResults(results) {
  const seen = new Set();
  return results.filter(result => {
    const url = normalizeUrl(result.url);
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

/**
 * Normalize URL for comparison
 */
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export default {
  searchWithBrave,
  searchWithTavily,
  searchNorms,
  searchCSNNorm,
  searchBuildingLaw,
  TRUSTED_SOURCES
};
