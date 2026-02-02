/**
 * Candidate Retriever Service
 * Searches online ÚRS catalog via Perplexity API
 *
 * Purpose:
 * - Generate 2-4 search queries for each subwork
 * - Call Perplexity API to search online ÚRS catalog
 * - Extract ÚRS codes, names, units from results
 * - Deduplicate candidates
 * - Return top 10-30 candidates per subwork
 *
 * @module services/batch/candidateRetriever
 */

import { logger } from '../../utils/logger.js';
import { searchUrsSite } from '../perplexityClient.js';

// ============================================================================
// MAIN RETRIEVAL FUNCTION
// ============================================================================

/**
 * Retrieve ÚRS candidates for subwork
 * @param {Object} subWork - Subwork to search
 * @param {string} searchDepth - 'quick' | 'normal' | 'deep'
 * @returns {Object} Retrieval result
 */
export async function retrieve(subWork, searchDepth = 'normal') {
  const startTime = Date.now();

  try {
    logger.info(`[CandidateRetriever] Subwork: "${subWork.text}"`);
    logger.debug(`[CandidateRetriever] Operation: ${subWork.operation}`);
    logger.debug(`[CandidateRetriever] Keywords: ${JSON.stringify(subWork.keywords)}`);
    logger.debug(`[CandidateRetriever] Search depth: ${searchDepth}`);

    // Step 1: Generate search queries
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

    // Step 3: Deduplicate by ÚRS code
    const deduplicated = deduplicateCandidates(allCandidates);
    logger.info(`[CandidateRetriever] Deduplicated: ${allCandidates.length} → ${deduplicated.length}`);

    // Step 4: Limit to top 30
    const topCandidates = deduplicated.slice(0, 30);

    const elapsed = Date.now() - startTime;
    timings.totalMs = elapsed;

    const result = {
      subWork: subWork,
      candidates: topCandidates,
      queriesUsed: queries,
      timing: timings
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
    // Call searchUrsSite (it builds the prompt internally)
    const candidates = await searchUrsSite(query);

    // searchUrsSite already returns structured candidates
    // Add searchQuery field to each candidate
    return candidates.map(c => ({
      ...c,
      code: c.urs_code || c.code,
      name: c.urs_name || c.name,
      searchQuery: query
    }));

  } catch (error) {
    logger.warn(`[CandidateRetriever] URS search failed: ${error.message}`);
    return [];
  }
}

/**
 * Parse Perplexity response into structured candidates
 * @param {string} response - Perplexity text response
 * @param {string} query - Original query
 * @returns {Array<Object>} Candidates
 */
function parsePerplexityResponse(response, query) {
  const candidates = [];

  try {
    // Split by lines
    const lines = response.split('\n');

    for (const line of lines) {
      // Match format: CODE | NAME | UNIT | SNIPPET
      const match = line.match(/^(\d{9})\s*\|\s*([^\|]+)\s*\|\s*([^\|]+)\s*\|\s*(.+)$/);

      if (match) {
        const [, code, name, unit, snippet] = match;

        candidates.push({
          code: code.trim(),
          name: name.trim(),
          unit: unit.trim(),
          snippet: snippet.trim(),
          source: 'perplexity',
          searchQuery: query
        });
      } else {
        // Try alternative formats (more lenient)
        const codeMatch = line.match(/(\d{9})/);
        if (codeMatch) {
          // Extract code, try to extract name after it
          const code = codeMatch[1];
          const afterCode = line.substring(line.indexOf(code) + code.length);
          const nameMatch = afterCode.match(/\s*[-–—:|\s]+\s*([^()\d]{10,})/);

          if (nameMatch) {
            candidates.push({
              code: code,
              name: nameMatch[1].trim(),
              unit: extractUnit(afterCode),
              snippet: afterCode.substring(0, 100).trim(),
              source: 'perplexity',
              searchQuery: query
            });
          }
        }
      }
    }

    logger.debug(`[CandidateRetriever] Parsed ${candidates.length} candidates from Perplexity response`);

  } catch (error) {
    logger.warn(`[CandidateRetriever] Parse error: ${error.message}`);
  }

  return candidates;
}

/**
 * Extract unit from text
 * @param {string} text - Text to search
 * @returns {string} Unit or empty string
 */
function extractUnit(text) {
  const unitMatch = text.match(/\b(m3|m2|m|kg|t|ks|kus|hod|soubor)\b/i);
  return unitMatch ? unitMatch[1].toLowerCase() : '';
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
