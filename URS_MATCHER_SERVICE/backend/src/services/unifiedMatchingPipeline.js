/**
 * Unified Matching Pipeline
 * Single entry point for all matching operations:
 * - Single item matching
 * - Batch matching
 * - TSKP classification (routing to sections)
 * - ÚRS code search (via Perplexity/Brave)
 * - OTSKP catalog search (local)
 *
 * Pipeline: normalize → classify (TSKP) → generateCandidates → score → select → [optionalLLM]
 *
 * @module services/unifiedMatchingPipeline
 */

import { logger } from '../utils/logger.js';
import { calculateSimilarity } from '../utils/similarity.js';
import tskpParserService from './tskpParserService.js';
import otskpCatalogService from './otskpCatalogService.js';
import { searchUrsSite } from './perplexityClient.js';
import { searchUrsSiteViaBrave } from './braveSearchClient.js';

// ============================================================================
// TYPES (JSDoc for reference)
// ============================================================================

/**
 * @typedef {'urs'|'otskp'|'both'} CatalogMode
 *
 * @typedef {Object} MatchRequest
 * @property {string} text - Work description
 * @property {string} [quantity] - Quantity
 * @property {string} [unit] - Unit of measurement
 * @property {CatalogMode} [catalog='urs'] - Which catalog to search
 * @property {string} [sectionHint] - TSKP section hint (code prefix)
 * @property {boolean} [classifyFirst=true] - Whether to classify to TSKP section first
 * @property {boolean} [useLLM=false] - Whether to use LLM for reranking
 * @property {number} [topN=5] - Number of top results to return
 * @property {number} [minConfidence=0.3] - Minimum confidence threshold
 *
 * @typedef {Object} MatchResult
 * @property {string} code - Matched code (ÚRS or OTSKP)
 * @property {string} name - Matched item name
 * @property {string} [unit] - Unit of measurement
 * @property {number} [price] - Unit price (OTSKP only)
 * @property {number} confidence - Match confidence (0.0-1.0)
 * @property {string} source - Source catalog ('urs', 'otskp', 'perplexity', 'brave_search')
 * @property {string} [reason] - Explanation
 *
 * @typedef {Object} ClassificationResult
 * @property {string} sectionCode - TSKP section code
 * @property {string} sectionName - TSKP section name
 * @property {Array} sectionPath - Full path from root to section
 * @property {number} confidence - Classification confidence
 * @property {Object} [bestItem] - Best specific TSKP item match
 *
 * @typedef {Object} PipelineResult
 * @property {Object} query - Original query info
 * @property {ClassificationResult} classification - TSKP classification
 * @property {Array<MatchResult>} candidates - Matched candidates
 * @property {string} catalog - Which catalog was used
 * @property {number} executionTimeMs - Total execution time
 */

// ============================================================================
// MAIN PIPELINE
// ============================================================================

/**
 * Run the unified matching pipeline for a single item
 *
 * @param {MatchRequest} request - Match request
 * @returns {Promise<PipelineResult>} Pipeline result
 */
export async function matchSingle(request) {
  const startTime = Date.now();
  const {
    text,
    quantity = null,
    unit = null,
    catalog = 'urs',
    sectionHint = null,
    classifyFirst = true,
    topN = 5,
    minConfidence = 0.3
  } = request;

  logger.info(`[Pipeline] matchSingle: catalog=${catalog}, text="${text.substring(0, 60)}..."`);

  // Step 1: Normalize
  const normalizedText = normalizeInput(text);

  // Step 2: Classify to TSKP section
  let classification = null;
  if (classifyFirst) {
    classification = tskpParserService.classifyToSection(normalizedText);
    if (classification.sectionCode) {
      logger.info(`[Pipeline] TSKP section: ${classification.sectionCode} "${classification.sectionName}" (conf: ${classification.confidence.toFixed(2)})`);
    }
  }

  // Use section hint if provided, otherwise use classification result
  const effectiveSection = sectionHint || classification?.sectionCode || null;

  // Step 3: Generate candidates from selected catalog(s)
  let candidates = [];

  if (catalog === 'otskp' || catalog === 'both') {
    const otskpResults = await searchOTSKP(normalizedText, effectiveSection, topN);
    candidates.push(...otskpResults);
  }

  if (catalog === 'urs' || catalog === 'both') {
    const ursResults = await searchURS(normalizedText, topN);
    candidates.push(...ursResults);
  }

  // Step 4: Score and deduplicate
  candidates = deduplicateAndSort(candidates, minConfidence);

  // Step 5: Limit to topN
  candidates = candidates.slice(0, topN);

  const executionTimeMs = Date.now() - startTime;
  logger.info(`[Pipeline] matchSingle complete: ${candidates.length} candidates in ${executionTimeMs}ms`);

  return {
    query: {
      originalText: text,
      normalizedText,
      quantity,
      unit,
      catalog
    },
    classification,
    candidates,
    catalog,
    executionTimeMs
  };
}

/**
 * Run the unified matching pipeline for a batch of items
 *
 * @param {Array<MatchRequest>} requests - Array of match requests
 * @param {Object} [batchOptions] - Batch options
 * @param {number} [batchOptions.concurrency=3] - Parallel concurrency
 * @returns {Promise<Array<PipelineResult>>} Array of pipeline results
 */
export async function matchBatch(requests, batchOptions = {}) {
  const { concurrency = 3 } = batchOptions;
  const startTime = Date.now();

  logger.info(`[Pipeline] matchBatch: ${requests.length} items, concurrency=${concurrency}`);

  // Process in chunks for controlled concurrency
  const results = [];
  for (let i = 0; i < requests.length; i += concurrency) {
    const chunk = requests.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(req => matchSingle(req)));
    results.push(...chunkResults);
  }

  const executionTimeMs = Date.now() - startTime;
  logger.info(`[Pipeline] matchBatch complete: ${results.length} results in ${executionTimeMs}ms`);

  return results;
}

/**
 * Classify-only mode: just determine the TSKP section, no candidate search
 *
 * @param {string} text - Work description
 * @returns {ClassificationResult}
 */
export function classifyOnly(text) {
  const normalized = normalizeInput(text);
  return tskpParserService.classifyToSection(normalized);
}

/**
 * Classify a batch of items to TSKP sections
 *
 * @param {Array<string>} texts - Array of work descriptions
 * @returns {Array<Object>} Classification results with original text
 */
export function classifyBatch(texts) {
  return texts.map(text => ({
    text,
    classification: classifyOnly(text)
  }));
}

// ============================================================================
// INTERNAL: NORMALIZE
// ============================================================================

/**
 * Normalize input text for matching
 * @param {string} text - Raw input text
 * @returns {string} Normalized text
 */
function normalizeInput(text) {
  if (!text) return '';

  let normalized = text
    // Remove drawing references
    .replace(/\b(výkres|č\.|číslo)\s*[:\-.]?\s*[\dA-Z\-\/]+/gi, '')
    // Remove section codes (HSV, PSV prefixes)
    .replace(/\b(HSV|PSV|DSP|KO|DIL|ODDÍL)\s*[:\-.]?\s*\d+/gi, '')
    // Remove percentage annotations
    .replace(/\bz\s*\d+\s*%/gi, '')
    // Clean up whitespace
    .replace(/\s{2,}/g, ' ')
    .trim();

  return normalized;
}

// ============================================================================
// INTERNAL: SEARCH CATALOGS
// ============================================================================

/**
 * Search OTSKP catalog locally
 */
async function searchOTSKP(text, sectionPrefix, limit) {
  try {
    await otskpCatalogService.load();
    const results = otskpCatalogService.search(text, {
      sectionPrefix,
      limit,
      minConfidence: 0.25
    });

    return results.map(r => ({
      code: r.code,
      name: r.name,
      unit: r.unit,
      price: r.price,
      confidence: r.confidence,
      source: 'otskp',
      reason: `OTSKP match (section ${r.tskpPrefix})`
    }));
  } catch (error) {
    logger.error(`[Pipeline] OTSKP search error: ${error.message}`);
    return [];
  }
}

/**
 * Search ÚRS codes via Perplexity + Brave fallback
 */
async function searchURS(text, limit) {
  try {
    // Primary: Perplexity
    let candidates = await searchUrsSite(text);

    if (candidates.length > 0) {
      return candidates.slice(0, limit).map(c => ({
        code: c.code,
        name: c.name,
        unit: c.unit || null,
        price: null,
        confidence: c.confidence || 0.7,
        source: 'perplexity',
        reason: c.reason || 'Perplexity URS search',
        url: c.url || null
      }));
    }

    // Fallback: Brave Search
    candidates = await searchUrsSiteViaBrave(text);

    return candidates.slice(0, limit).map(c => ({
      code: c.code,
      name: c.name,
      unit: c.unit || null,
      price: null,
      confidence: c.confidence || 0.6,
      source: 'brave_search',
      reason: c.reason || 'Brave Search fallback',
      url: c.url || null
    }));

  } catch (error) {
    logger.error(`[Pipeline] URS search error: ${error.message}`);
    return [];
  }
}

// ============================================================================
// INTERNAL: SCORING & DEDUP
// ============================================================================

/**
 * Deduplicate candidates by code and sort by confidence
 */
function deduplicateAndSort(candidates, minConfidence) {
  const seen = new Map();

  for (const c of candidates) {
    const existing = seen.get(c.code);
    if (!existing || c.confidence > existing.confidence) {
      seen.set(c.code, c);
    }
  }

  return Array.from(seen.values())
    .filter(c => c.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);
}

// ============================================================================
// CATALOG INFO
// ============================================================================

/**
 * Get available catalogs and their stats
 * @returns {Object}
 */
export function getCatalogInfo() {
  return {
    urs: {
      name: 'ÚRS (Ústav racionalizace ve stavebnictví)',
      type: 'online',
      source: 'podminky.urs.cz via Perplexity/Brave',
      available: true
    },
    otskp: {
      name: 'OTSKP (Oborový třídník stavebních konstrukcí a prací)',
      type: 'local',
      source: '2025_03_otskp.xml (Cenová soustava 1/2025)',
      available: otskpCatalogService.loaded && otskpCatalogService.items.size > 0,
      stats: otskpCatalogService.getStats()
    },
    tskp: {
      name: 'TSKP Třídník (classification tree)',
      type: 'local',
      source: 'xmk_tskp_tridnik.xml',
      available: tskpParserService.loaded,
      stats: {
        totalItems: tskpParserService.flatIndex.size,
        mainCategories: tskpParserService.getMainCategories().length
      }
    }
  };
}
