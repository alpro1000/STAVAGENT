/**
 * URS Matcher Service
 * Matches work descriptions with URS catalog items
 * Supports two modes: local database and Perplexity API
 */

import { getDatabase } from '../db/init.js';
import { normalizeText } from '../utils/textNormalizer.js';
import { logger } from '../utils/logger.js';
import { calculateSimilarity } from '../utils/similarity.js';
import { CATALOG_MODE } from '../config/llmConfig.js';
import { searchUrsSite } from './perplexityClient.js';
import { lookupLearnedMapping, learnMapping } from './concreteAgentKB.js';
import otskpCatalogService from './otskpCatalogService.js';

const CONFIDENCE_THRESHOLDS = {
  EXACT: 0.95,
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.3
};

export async function matchUrsItems(text, quantity = 0, unit = 'ks') {
  try {
    // Filter out non-work items before sending to Perplexity
    const skipReason = shouldSkipText(text);
    if (skipReason) {
      logger.debug(`[URSMatcher] Skipping "${text.substring(0, 30)}..." - ${skipReason}`);
      return [];
    }

    // Check learned mappings first (knowledge accumulation)
    const learnedMapping = lookupLearnedMapping(text);
    if (learnedMapping) {
      logger.info(`[URSMatcher] Using learned mapping for: "${text.substring(0, 30)}..."`);
      return [learnedMapping];
    }

    logger.debug(`[URSMatcher] Matching (${CATALOG_MODE}): "${text.substring(0, 50)}..."`);

    // Route to appropriate matcher based on catalog mode
    let results;
    if (CATALOG_MODE === 'perplexity_only') {
      results = await matchUrsItemsPerplexity(text);
    } else {
      results = await matchUrsItemsLocal(text);
    }

    // Supplement with OTSKP catalog if local results are weak or empty
    const bestLocalConf = results.length > 0 ? results[0].confidence : 0;
    if (bestLocalConf < 0.7) {
      const otskpResults = await matchUrsItemsOTSKP(text);
      if (otskpResults.length > 0) {
        logger.info(`[URSMatcher] OTSKP supplement: ${otskpResults.length} items (best conf: ${otskpResults[0].confidence.toFixed(2)})`);
        // Merge: deduplicate by code, keep higher confidence
        const seen = new Map();
        for (const r of [...results, ...otskpResults]) {
          const key = r.urs_code || r.code;
          const existing = seen.get(key);
          if (!existing || r.confidence > existing.confidence) {
            seen.set(key, r);
          }
        }
        results = Array.from(seen.values())
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5);
      }
    }

    // Auto-learn high-confidence matches
    if (results.length > 0 && results[0].confidence >= 0.85) {
      learnMapping(text, results[0], 'auto');
    }

    return results;

  } catch (error) {
    logger.error(`[URSMatcher] Error: ${error.message}`);
    return [];
  }
}

/**
 * Check if text should be skipped (not sent to Perplexity)
 * Returns skip reason or null if should process
 */
function shouldSkipText(text) {
  if (!text || typeof text !== 'string') {
    return 'empty';
  }

  const trimmed = text.trim();

  // Too short
  if (trimmed.length < 5) {
    return 'too short';
  }

  // Pure number (like "10", "45.8", "1 234")
  if (/^[\d\s,.\-]+$/.test(trimmed)) {
    return 'pure number';
  }

  // Number with unit only (like "10 m³", "45.8 t", "100 kg")
  // Must have at least 3 words to be a work description
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  if (words.length <= 2 && /^\d/.test(trimmed)) {
    return 'quantity only';
  }

  // Section headers (like "01 Základy", "02 Nosné konstrukce")
  if (/^0?\d{1,2}\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ][a-záčďéěíňóřšťúůýž]+$/.test(trimmed)) {
    return 'section header';
  }

  // Notes/comments
  if (/^(pozn\.?|poznámka|note|celk|suma|součet|total)/i.test(trimmed)) {
    return 'note/comment';
  }

  // Column headers
  if (/^(popis|název|mj|jednotka|množství|cena|price)/i.test(trimmed) && words.length <= 3) {
    return 'column header';
  }

  return null; // Should process
}

/**
 * Match URS items using local SQLite database (39K+ items).
 * Uses SQL LIKE pre-filtering to avoid scoring all items in JS.
 * @private
 */
async function matchUrsItemsLocal(text) {
  try {
    const normalized = normalizeText(text);
    const db = await getDatabase();

    // Extract meaningful words (>2 chars) for SQL pre-filtering
    const words = normalized.split(/\s+/).filter(w => w.length > 2);

    let items;
    if (words.length > 0) {
      // Build WHERE clause: urs_name or description LIKE %word%
      // Use top 4 longest words for best selectivity
      const searchWords = words
        .sort((a, b) => b.length - a.length)
        .slice(0, 4);

      const conditions = searchWords.map(
        () => '(LOWER(urs_name) LIKE ? OR LOWER(COALESCE(description, \'\')) LIKE ?)'
      );
      const params = searchWords.flatMap(w => [`%${w}%`, `%${w}%`]);

      // Match items containing ANY of the search words, limit to 500 candidates
      items = await db.all(
        `SELECT * FROM urs_items WHERE ${conditions.join(' OR ')} LIMIT 500`,
        params
      );

      // If too few results, try broader search with shorter words
      if (items.length < 5 && words.length > 1) {
        const shortWords = words.slice(0, 2);
        const cond2 = shortWords.map(
          () => 'LOWER(urs_name) LIKE ?'
        );
        const params2 = shortWords.map(w => `%${w}%`);
        const extra = await db.all(
          `SELECT * FROM urs_items WHERE ${cond2.join(' OR ')} LIMIT 200`,
          params2
        );
        const seen = new Set(items.map(i => i.urs_code));
        for (const e of extra) {
          if (!seen.has(e.urs_code)) items.push(e);
        }
      }
    } else {
      // No meaningful words — return empty (skip full scan of 39K items)
      logger.debug('[URSMatcher] No searchable words in query');
      return [];
    }

    if (items.length === 0) {
      logger.debug(`[URSMatcher] No candidates from SQL pre-filter for: "${text.substring(0, 40)}"`);
      return [];
    }

    logger.debug(`[URSMatcher] SQL pre-filter: ${items.length} candidates for "${text.substring(0, 40)}"`);

    // Score candidates using Levenshtein distance
    const scored = items.map(item => {
      const normalizedItem = normalizeText(item.urs_name);
      const score = calculateSimilarity(normalized, normalizedItem);
      return {
        ...item,
        score,
        confidence: score > 0.8 ? 0.9 : score,
        source: 'local'
      };
    });

    // Sort by score descending
    const sorted = scored.sort((a, b) => b.score - a.score);

    // Return top 5 matches
    return sorted.slice(0, 5).map(item => ({
      urs_code: item.urs_code,
      urs_name: item.urs_name,
      unit: item.unit,
      description: item.description,
      confidence: item.confidence,
      price: item.price || 0,
      url: `https://podminky.urs.cz/item/CS_URS_2025_02/${item.urs_code}`,
      source: item.source
    }));

  } catch (error) {
    logger.error(`[URSMatcher] Local matching error: ${error.message}`);
    return [];
  }
}

/**
 * Match URS items using Perplexity API (no local database required)
 * @private
 */
async function matchUrsItemsPerplexity(text) {
  try {
    logger.info('[URSMatcher] Using Perplexity mode for catalog search');

    // Call Perplexity to search podminky.urs.cz
    const candidates = await searchUrsSite(text);

    if (!candidates || candidates.length === 0) {
      logger.info('[URSMatcher] No candidates found from Perplexity');
      return [];
    }

    // Normalize Perplexity response to standard format
    return candidates.map(c => ({
      urs_code: c.code,
      urs_name: c.name,
      unit: c.unit || 'ks',
      url: c.url,
      confidence: c.confidence ?? 0.7,
      reason: c.reason || '',
      source: 'perplexity'
    }));

  } catch (error) {
    logger.error(`[URSMatcher] Perplexity matching error: ${error.message}`);
    return [];
  }
}

/**
 * Match URS items using OTSKP catalog (17,904 items, local XML)
 * Used as supplement when local DB returns weak results
 * @private
 */
async function matchUrsItemsOTSKP(text) {
  try {
    await otskpCatalogService.load();
    if (!otskpCatalogService.loaded || otskpCatalogService.items.size === 0) {
      logger.warn('[URSMatcher] OTSKP catalog not available');
      return [];
    }

    const results = otskpCatalogService.search(text, {
      limit: 5,
      minConfidence: 0.3
    });

    return results.map(r => ({
      urs_code: r.code,
      urs_name: r.name,
      unit: r.unit,
      description: `OTSKP: ${r.name}`,
      confidence: r.confidence,
      price: r.price,
      source: 'otskp'
    }));
  } catch (error) {
    logger.error(`[URSMatcher] OTSKP matching error: ${error.message}`);
    return [];
  }
}

/**
 * Generate related/complementary work items using tech-rules
 * Called after matching main URS items
 * Note: Tech-rules require local database with complete URS catalog
 *
 * @param {Array} items - Already matched URS items
 * @returns {Promise<Array>} Related items generated by tech-rules
 */
export async function generateRelatedItems(items) {
  try {
    if (!items || items.length === 0) {
      logger.debug('[URSMatcher] No items to generate related items from');
      return [];
    }

    // Tech-rules only work with local database (full URS catalog required)
    if (CATALOG_MODE === 'perplexity_only') {
      logger.debug('[URSMatcher] Tech-rules disabled in perplexity_only mode (requires full catalog)');
      return [];
    }

    // Import tech-rules here to avoid circular dependency
    const { applyTechRules } = await import('./techRules.js');

    // Get URS items from same sections as input items for tech-rule validation
    const db = await getDatabase();
    const sectionCodes = [...new Set(items.map(i => (i.urs_code || '').substring(0, 2)).filter(Boolean))];
    let allCandidates;
    if (sectionCodes.length > 0) {
      const placeholders = sectionCodes.map(() => '?').join(',');
      allCandidates = await db.all(
        `SELECT urs_code, urs_name FROM urs_items WHERE section_code IN (${placeholders})`,
        sectionCodes
      );
    } else {
      allCandidates = await db.all('SELECT urs_code, urs_name FROM urs_items LIMIT 5000');
    }

    // Apply tech-rules
    const relatedItems = applyTechRules(items, allCandidates);

    logger.info(`[URSMatcher] Generated ${relatedItems.length} related items from tech-rules`);
    return relatedItems;

  } catch (error) {
    logger.error(`[URSMatcher] Error generating related items: ${error.message}`);
    return [];
  }
}

// NOTE: calculateSimilarity and getLevenshteinDistance moved to utils/similarity.js
