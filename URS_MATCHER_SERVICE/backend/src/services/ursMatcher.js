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
 * Match URS items using local SQLite database
 * @private
 */
async function matchUrsItemsLocal(text) {
  try {
    const normalized = normalizeText(text);
    const db = await getDatabase();

    // Get all URS items from local database
    const items = await db.all('SELECT * FROM urs_items');

    if (items.length === 0) {
      logger.warn('[URSMatcher] No URS items in local database');
      return [];
    }

    // Score each item using Levenshtein distance
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

    // Get all available URS items from DB for validation
    const db = await getDatabase();
    const allCandidates = await db.all('SELECT urs_code, urs_name FROM urs_items');

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
