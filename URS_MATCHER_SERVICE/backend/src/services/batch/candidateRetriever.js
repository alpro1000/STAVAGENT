/**
 * Candidate Retriever Service
 * Searches online ÚRS catalog via Perplexity API + Brave Search fallback
 *
 * Purpose:
 * - Generate 2-4 search queries for each subwork
 * - Call Perplexity API to search online ÚRS catalog (primary)
 * - Fallback to Brave Search if Perplexity returns 0 results
 * - Extract ÚRS codes, names, units from results
 * - Deduplicate candidates
 * - Return top 10-30 candidates per subwork
 *
 * @module services/batch/candidateRetriever
 */

import { logger } from '../../utils/logger.js';
import { searchUrsSite } from '../perplexityClient.js';
import { searchUrsSiteViaBrave } from '../braveSearchClient.js';
import otskpCatalogService from '../otskpCatalogService.js';
import tskpParserService from '../tskpParserService.js';

// ============================================================================
// MAIN RETRIEVAL FUNCTION
// ============================================================================

/**
 * Retrieve candidates for subwork from selected catalog
 * @param {Object} subWork - Subwork to search
 * @param {string} searchDepth - 'quick' | 'normal' | 'deep'
 * @param {Object} [options] - Additional options
 * @param {string} [options.catalog='urs'] - Catalog mode: 'urs', 'otskp', or 'both'
 * @returns {Object} Retrieval result
 */
export async function retrieve(subWork, searchDepth = 'normal', options = {}) {
  const startTime = Date.now();
  const catalog = options.catalog || 'urs';

  try {
    logger.info(`[CandidateRetriever] Subwork: "${subWork.text}" (catalog: ${catalog})`);
    logger.debug(`[CandidateRetriever] Operation: ${subWork.operation}`);
    logger.debug(`[CandidateRetriever] Keywords: ${JSON.stringify(subWork.keywords)}`);
    logger.debug(`[CandidateRetriever] Search depth: ${searchDepth}`);

    // OTSKP catalog: local search (fast, no API calls)
    if (catalog === 'otskp' || catalog === 'both') {
      const otskpCandidates = await searchOTSKPCatalog(subWork);
      if (otskpCandidates.length > 0 && catalog === 'otskp') {
        const elapsed = Date.now() - startTime;
        logger.info(`[CandidateRetriever] OTSKP: ${otskpCandidates.length} candidates in ${elapsed}ms`);
        return {
          subWork,
          candidates: otskpCandidates.slice(0, 30),
          queriesUsed: [`OTSKP local: ${subWork.text}`],
          timing: { totalMs: elapsed },
          catalog: 'otskp'
        };
      }

      // In 'both' mode, OTSKP results will be merged with ÚRS results below
      if (catalog === 'both' && otskpCandidates.length > 0) {
        // We'll merge these after the ÚRS search
        subWork._otskpCandidates = otskpCandidates;
      }
    }

    // Step 1: Generate search queries (for ÚRS search)
    const queries = generateSearchQueries(subWork, searchDepth);
    logger.info(`[CandidateRetriever] Generated ${queries.length} queries`);

    // Step 2: Search for each query
    const allCandidates = [];
    const timings = {};

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      logger.info(`[CandidateRetriever] Query ${i + 1}/${queries.length}: "${query}"`);

      const queryStartTime = Date.now();
      try {
        const results = await searchURS(query);
        const queryElapsed = Date.now() - queryStartTime;
        timings[`query${i + 1}Ms`] = queryElapsed;

        logger.info(`[CandidateRetriever] Query ${i + 1}: ${results.length} candidates (${queryElapsed}ms)`);
        allCandidates.push(...results);

      } catch (error) {
        const queryElapsed = Date.now() - queryStartTime;
        timings[`query${i + 1}Ms`] = queryElapsed;
        logger.warn(`[CandidateRetriever] Query ${i + 1} failed: ${error.message} (${queryElapsed}ms)`);
        // Continue with other queries
      }
    }

    // Step 2.5: Merge OTSKP candidates if in 'both' mode
    if (subWork._otskpCandidates) {
      allCandidates.push(...subWork._otskpCandidates);
      delete subWork._otskpCandidates;
      logger.info(`[CandidateRetriever] Merged OTSKP candidates, total: ${allCandidates.length}`);
    }

    // Step 3: Deduplicate by code
    const deduplicated = deduplicateCandidates(allCandidates);
    logger.info(`[CandidateRetriever] Deduplicated: ${allCandidates.length} → ${deduplicated.length}`);

    // Step 4: Limit to top 30
    const topCandidates = deduplicated.slice(0, 30);

    const elapsed = Date.now() - startTime;
    timings.totalMs = elapsed;

    // DIAGNOSTIC: Log when all queries returned 0 candidates
    if (topCandidates.length === 0 && queries.length > 0) {
      logger.warn(`[CandidateRetriever] WARNING: All ${queries.length} queries returned 0 candidates for "${subWork.text}"`);
      logger.warn(`[CandidateRetriever] This likely means Perplexity API is failing silently. Check PPLX_API_KEY validity and Render logs for [Perplexity] errors.`);
    }

    const result = {
      subWork: subWork,
      candidates: topCandidates,
      queriesUsed: queries,
      timing: timings,
      // Flag retrieval failure when enabled but got 0 results from all queries
      error: (topCandidates.length === 0 && queries.length > 0)
        ? 'All search queries returned 0 candidates - Perplexity may be failing'
        : undefined
    };

    logger.info(`[CandidateRetriever] Result: ${topCandidates.length} candidates, ${elapsed}ms total`);

    return result;

  } catch (error) {
    logger.error(`[CandidateRetriever] Error: ${error.message}`);
    logger.error(`[CandidateRetriever] Stack: ${error.stack}`);

    // Return empty result on error
    return {
      subWork: subWork,
      candidates: [],
      queriesUsed: [],
      timing: {
        totalMs: Date.now() - startTime
      },
      error: error.message
    };
  }
}

// ============================================================================
// QUERY GENERATION
// ============================================================================

/**
 * Generate search queries for subwork
 * @param {Object} subWork - Subwork data
 * @param {string} searchDepth - Query depth
 * @returns {Array<string>} Search queries
 */
function generateSearchQueries(subWork, searchDepth) {
  const queries = [];

  // Determine number of queries based on depth
  const queryCount = {
    quick: 2,
    normal: 3,
    deep: 4
  }[searchDepth] || 3;

  // Query 1: Strict (operation + keywords + "ÚRS")
  const strictQuery = buildStrictQuery(subWork);
  queries.push(strictQuery);

  // Query 2: Expanded (synonyms + variations)
  if (queryCount >= 2) {
    const expandedQuery = buildExpandedQuery(subWork);
    queries.push(expandedQuery);
  }

  // Query 3: Reverse (object/material + operation)
  if (queryCount >= 3) {
    const reverseQuery = buildReverseQuery(subWork);
    queries.push(reverseQuery);
  }

  // Query 4: Deep (all features + context)
  if (queryCount >= 4) {
    const deepQuery = buildDeepQuery(subWork);
    queries.push(deepQuery);
  }

  return queries;
}

/**
 * Build strict query (primary search)
 * @param {Object} subWork - Subwork data
 * @returns {string} Query string
 */
function buildStrictQuery(subWork) {
  const parts = [];

  // Add operation if available
  if (subWork.operation && subWork.operation !== 'unknown') {
    parts.push(getOperationCzech(subWork.operation));
  }

  // Add first 2-3 keywords
  const mainKeywords = subWork.keywords.slice(0, 3).filter(k => k.length > 2);
  parts.push(...mainKeywords);

  // Add "ÚRS" and "položka" (item)
  parts.push('ÚRS', 'položka');

  return parts.join(' ');
}

/**
 * Build expanded query (with synonyms)
 * @param {Object} subWork - Subwork data
 * @returns {string} Query string
 */
function buildExpandedQuery(subWork) {
  const parts = [];

  // Add operation + synonyms
  if (subWork.operation && subWork.operation !== 'unknown') {
    const synonyms = getOperationSynonyms(subWork.operation);
    parts.push(synonyms[0] || subWork.operation);
  }

  // Add keywords
  parts.push(...subWork.keywords.slice(0, 2));

  // Add "cenová soustava" (pricing system)
  parts.push('ÚRS', 'cenová soustava');

  return parts.join(' ');
}

/**
 * Build reverse query (object-first approach)
 * @param {Object} subWork - Subwork data
 * @returns {string} Query string
 */
function buildReverseQuery(subWork) {
  const parts = [];

  // Find object/material keywords (nouns)
  const objectKeywords = subWork.keywords.filter(k =>
    /^(jáma|stěna|sloup|deska|základy|beton|výztuž)/.test(k.toLowerCase())
  );

  if (objectKeywords.length > 0) {
    parts.push(objectKeywords[0]);
  } else {
    parts.push(subWork.keywords[0] || 'práce');
  }

  // Add operation
  if (subWork.operation && subWork.operation !== 'unknown') {
    parts.push(getOperationCzech(subWork.operation));
  }

  parts.push('ÚRS');

  return parts.join(' ');
}

/**
 * Build deep query (all features)
 * @param {Object} subWork - Subwork data
 * @returns {string} Query string
 */
function buildDeepQuery(subWork) {
  // Use full subwork text + ÚRS
  return `${subWork.text} ÚRS položka`;
}

// ============================================================================
// ÚRS SEARCH (via Perplexity)
// ============================================================================

/**
 * Search ÚRS catalog via Perplexity
 * @param {string} query - Search query
 * @returns {Array<Object>} Candidates
 */
async function searchURS(query) {
  try {
    // PRIMARY: Call Perplexity (AI-powered search with structured extraction)
    const candidates = await searchUrsSite(query);

    // searchUrsSite already returns structured candidates
    // Add searchQuery field to each candidate
    const mapped = candidates.map(c => ({
      ...c,
      code: c.urs_code || c.code,
      name: c.urs_name || c.name,
      searchQuery: query,
      source: c.source || 'perplexity'
    }));

    // If Perplexity returned results, use them
    if (mapped.length > 0) {
      return mapped;
    }

    // FALLBACK: Try Brave Search when Perplexity returns 0 candidates
    logger.info(`[CandidateRetriever] Perplexity returned 0 candidates, trying Brave Search fallback for: "${query}"`);

    const braveCandidates = await searchUrsSiteViaBrave(query);

    if (braveCandidates.length > 0) {
      logger.info(`[CandidateRetriever] Brave Search found ${braveCandidates.length} candidates (fallback)`);
      return braveCandidates.map(c => ({
        ...c,
        code: c.urs_code || c.code,
        name: c.urs_name || c.name,
        searchQuery: query,
        source: 'brave_search'
      }));
    }

    logger.warn(`[CandidateRetriever] Both Perplexity and Brave returned 0 candidates for: "${query}"`);
    return [];

  } catch (error) {
    logger.warn(`[CandidateRetriever] URS search failed: ${error.message}`);
    return [];
  }
}

// NOTE: parsePerplexityResponse and extractUnit removed (dead code - actual parsing
// happens inside perplexityClient.js, this was an unused local copy)

// ============================================================================
// OTSKP LOCAL SEARCH
// ============================================================================

/**
 * Search OTSKP catalog locally for a subwork
 * Uses TSKP classification to narrow down search to relevant section
 *
 * @param {Object} subWork - Subwork with text, keywords, operation
 * @returns {Promise<Array>} OTSKP candidates in standard format
 */
async function searchOTSKPCatalog(subWork) {
  try {
    await otskpCatalogService.load();

    if (otskpCatalogService.items.size === 0) {
      logger.warn('[CandidateRetriever] OTSKP catalog not loaded, skipping');
      return [];
    }

    // Classify to TSKP section for targeted search
    const classification = tskpParserService.classifyToSection(subWork.text);
    const sectionPrefix = classification.sectionCode ? classification.sectionCode.substring(0, 1) : null;

    logger.debug(`[CandidateRetriever] OTSKP search, section prefix: ${sectionPrefix || 'all'}`);

    // Search OTSKP with section context
    const results = otskpCatalogService.search(subWork.text, {
      sectionPrefix,
      limit: 15,
      minConfidence: 0.25
    });

    // Also search by keywords if we have them
    if (subWork.keywords && subWork.keywords.length > 0) {
      const keywordQuery = subWork.keywords.join(' ');
      const keywordResults = otskpCatalogService.search(keywordQuery, {
        sectionPrefix,
        limit: 10,
        minConfidence: 0.3
      });

      // Merge, avoiding duplicates
      const seenCodes = new Set(results.map(r => r.code));
      for (const kr of keywordResults) {
        if (!seenCodes.has(kr.code)) {
          results.push(kr);
          seenCodes.add(kr.code);
        }
      }
    }

    // Convert to standard candidate format
    return results.map(r => ({
      code: r.code,
      name: r.name,
      unit: r.unit,
      price: r.price,
      confidence: r.confidence,
      source: 'otskp',
      searchQuery: subWork.text,
      tskpSection: sectionPrefix
    }));

  } catch (error) {
    logger.error(`[CandidateRetriever] OTSKP search error: ${error.message}`);
    return [];
  }
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

/**
 * Deduplicate candidates by ÚRS code
 * @param {Array<Object>} candidates - All candidates
 * @returns {Array<Object>} Deduplicated candidates
 */
function deduplicateCandidates(candidates) {
  const seen = new Map();

  for (const candidate of candidates) {
    const code = candidate.code;

    if (!seen.has(code)) {
      seen.set(code, candidate);
    } else {
      // Keep candidate with longer snippet
      const existing = seen.get(code);
      if (candidate.snippet && candidate.snippet.length > (existing.snippet?.length || 0)) {
        seen.set(code, candidate);
      }
    }
  }

  return Array.from(seen.values());
}

// ============================================================================
// OPERATION TRANSLATIONS & SYNONYMS
// ============================================================================

/**
 * Get Czech term for operation
 * @param {string} operation - Operation type
 * @returns {string} Czech term
 */
function getOperationCzech(operation) {
  const translations = {
    excavation: 'výkop',
    demolition: 'demontáž',
    installation: 'montáž',
    concreting: 'betonáž',
    formwork: 'bednění',
    reinforcement: 'výztuž',
    transport: 'doprava',
    backfill: 'zásyp',
    compaction: 'hutnění',
    waterproofing: 'hydroizolace',
    plastering: 'omítka',
    painting: 'nátěr'
  };

  return translations[operation] || operation;
}

/**
 * Get synonyms for operation
 * @param {string} operation - Operation type
 * @returns {Array<string>} Synonyms
 */
function getOperationSynonyms(operation) {
  const synonyms = {
    excavation: ['výkop', 'hloubení', 'kopání', 'těžba'],
    demolition: ['demontáž', 'odstranění', 'bourání'],
    installation: ['montáž', 'osazení', 'instalace'],
    concreting: ['betonáž', 'betonování', 'zalití'],
    formwork: ['bednění', 'forma', 'bedněný'],
    reinforcement: ['výztuž', 'armatura', 'armování'],
    transport: ['doprava', 'odvoz', 'přesun'],
    backfill: ['zásyp', 'zasypání', 'navážka'],
    compaction: ['hutnění', 'zhutněn', 'zhutňování'],
    waterproofing: ['hydroizolace', 'izolace'],
    plastering: ['omítka', 'omítání'],
    painting: ['nátěr', 'malování']
  };

  return synonyms[operation] || [operation];
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  retrieve
};
