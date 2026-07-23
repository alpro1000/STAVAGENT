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
import { searchCatalog } from './frontofficeClient.js';
import { lookupLearnedMapping, learnMapping } from './concreteAgentKB.js';
import otskpCatalogService from './otskpCatalogService.js';
import { extractIntent } from './intentExtractor.js';

const CONFIDENCE_THRESHOLDS = {
  EXACT: 0.95,
  HIGH: 0.8,
  MEDIUM: 0.6,
  LOW: 0.3
};

// Honest-refusal floor for the FUZZY local door (ratified «go floor» 2026-07-23).
// A Levenshtein-scored candidate below MEDIUM is noise, not an answer — before
// this floor the door returned top-5 whatever the score, which on the ÚRS corpus
// fabricated codes for 5 of 6 confirmed-nonexistent lines (conf 0.23–0.41).
// SCOPE: the local fuzzy scale ONLY. Other doors (OTSKP in-memory service,
// frontoffice, web) run their own confidence scales — one number across
// different scales is exactly the miscalibration this service must not bake in
// (cross-scale calibration = Etapa 3). The threshold is the service's own
// pre-existing MEDIUM constant, not a corpus-fitted value.
// Rollback valve: URS_LOCAL_CONF_FLOOR overrides (e.g. '0' disables).
function localConfFloor() {
  const env = process.env.URS_LOCAL_CONF_FLOOR;
  if (env !== undefined && env !== '') {
    const v = Number(env);
    if (Number.isFinite(v)) {return v;}
  }
  return CONFIDENCE_THRESHOLDS.MEDIUM;
}

// Kill-switch for the learned-mappings layer (lookup + auto-learn together).
// Default ON (unchanged behaviour). URS_LEARNING=0 disables BOTH directions —
// needed by measurement runs (eval harness): the lookup short-circuit would
// answer from cache instead of the catalog, and the auto-learn write would
// let run A poison run B via the persistent learned_mappings.json.
function learningEnabled() {
  return !(process.env.URS_LEARNING === '0' || process.env.URS_LEARNING === 'false');
}

export async function matchUrsItems(text, quantity = 0, unit = 'ks') {
  try {
    // Filter out non-work items before sending to Perplexity
    const skipReason = shouldSkipText(text);
    if (skipReason) {
      logger.debug(`[URSMatcher] Skipping "${text.substring(0, 30)}..." - ${skipReason}`);
      return [];
    }

    // Check learned mappings first (knowledge accumulation)
    if (learningEnabled()) {
      const learnedMapping = lookupLearnedMapping(text);
      if (learnedMapping) {
        logger.info(`[URSMatcher] Using learned mapping for: "${text.substring(0, 30)}..."`);
        return [learnedMapping];
      }
    }

    logger.debug(`[URSMatcher] Matching (${CATALOG_MODE}): "${text.substring(0, 50)}..."`);

    // Deterministic-first (Determinismus před AI): read the REAL ÚRS catalog directly
    // via the frontoffice JSON API. A catalog hit outranks any web guess; on any
    // failure searchCatalog returns [] and we fall back to the existing route below.
    let results = await matchUrsItemsFrontoffice(text);
    if (results.length > 0) {
      logger.info(`[URSMatcher] Frontoffice catalog: ${results.length} item(s), best conf ${results[0].confidence.toFixed(2)}`);
    } else if (CATALOG_MODE === 'perplexity_only') {
      results = await matchUrsItemsPerplexity(text);
    } else {
      results = await matchUrsItemsLocal(text);
    }

    // OTSKP supplement runs ALWAYS (in-memory, no network). The old
    // `bestLocalConf < 0.7` gate was a first-responder-wins relic: a barely-
    // above-threshold local fuzzy hit (live case: 0.712) silenced the catalog
    // door that held the correct answer at 0.9. Per SPEC §5 all sources run in
    // parallel and the MERGE decides — a conditional call keyed on another
    // door's confidence is exactly the pattern the spec removes.
    const otskpResults = await matchUrsItemsOTSKP(text);
    if (otskpResults.length > 0) {
      logger.info(`[URSMatcher] OTSKP supplement: ${otskpResults.length} items (best conf: ${otskpResults[0].confidence.toFixed(2)})`);
      // Fuzzy vs catalog-natured sources live on DIFFERENT confidence scales
      // (full calibration = Etapa 3). Minimal rule until then: a catalog-
      // natured source at equal-or-greater confidence always outranks fuzzy —
      // the spec's «a model never demotes a deterministic match», extended to
      // fuzzy. At strictly greater fuzzy confidence, fuzzy still wins.
      const isFuzzy = r => r.source === 'local' || r.source === 'perplexity' || r.source === 'brave_search';
      // Merge: deduplicate by code — higher confidence wins; on a tie the
      // catalog-natured entry replaces the fuzzy one.
      const seen = new Map();
      for (const r of [...results, ...otskpResults]) {
        const key = r.urs_code || r.code;
        const existing = seen.get(key);
        if (!existing || r.confidence > existing.confidence ||
            (r.confidence === existing.confidence && isFuzzy(existing) && !isFuzzy(r))) {
          seen.set(key, r);
        }
      }
      results = Array.from(seen.values())
        .sort((a, b) => {
          if (b.confidence !== a.confidence) {return b.confidence - a.confidence;}
          return Number(isFuzzy(a)) - Number(isFuzzy(b));
        })
        .slice(0, 5);
    }

    // Auto-learn ONLY genuine deterministic local hits. Audit M3: auto-learning a
    // Perplexity/Brave web guess or a cross-catalog OTSKP road code poisons the KB
    // permanently — lookupLearnedMapping returns it first, unconditionally, on every
    // future run, short-circuiting all deterministic logic.
    const top = results[0];
    const learnable = top && top.confidence >= 0.85 &&
      top.source !== 'perplexity' && top.source !== 'brave_search' &&
      top.source !== 'otskp' && !top.is_cross_catalog;
    if (learnable && learningEnabled()) {
      learnMapping(text, top, 'auto');
    }

    // Honest provenance flag: web-search-sourced results are suggestions
    // to verify in the licensed ÚRS catalog, not catalog facts.
    return results.map(r => ({
      ...r,
      is_web_suggestion: r.source === 'perplexity' || r.source === 'brave_search',
    }));

  } catch (error) {
    logger.error(`[URSMatcher] Error: ${error.message}`);
    return [];
  }
}

/**
 * Check if text should be skipped (not sent to Perplexity)
 * Returns skip reason or null if should process
 */
export function shouldSkipText(text) {
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

// Folded search column with legacy fallback. search_name is written by the
// importers via the SAME normalizeText as the query side (fold-symmetric by
// construction — Etapa 1). Rows imported before the column existed fall back
// to the old ASCII-only comparison (no worse than the previous behaviour).
const SEARCH_EXPR =
  "COALESCE(search_name, LOWER(urs_name) || ' ' || LOWER(COALESCE(description, '')))";

/**
 * Match URS items using local SQLite database (39K+ items).
 * Uses SQL LIKE pre-filtering to avoid scoring all items in JS.
 * Etapa 1: the query side is an intent structure (extractIntent) — spec/dimension
 * phrases («dn 100», «tl 100 mm», «tr 3») run as a dedicated selective pass so
 * generic words can never crowd their matches out of the candidate LIMIT.
 * @private
 */
async function matchUrsItemsLocal(text) {
  try {
    const intent = extractIntent(text);
    const normalized = intent.normalized_text;
    const db = await getDatabase();

    const words = intent.search_words;

    let items = [];
    if (words.length > 0 || intent.search_phrases.length > 0) {
      // Pass 1 — spec/dimension phrases (highly selective, guaranteed inclusion)
      if (intent.search_phrases.length > 0) {
        const phrases = intent.search_phrases.slice(0, 3);
        const condP = phrases.map(() => `(${SEARCH_EXPR} LIKE ?)`);
        items = await db.all(
          `SELECT * FROM urs_items WHERE ${condP.join(' OR ')} LIMIT 200`,
          phrases.map(p => `%${p}%`)
        );
      }

      // Pass 2 — top 4 longest words (the pre-existing selectivity heuristic)
      if (words.length > 0) {
        const searchWords = [...words]
          .sort((a, b) => b.length - a.length)
          .slice(0, 4);

        const conditions = searchWords.map(() => `(${SEARCH_EXPR} LIKE ?)`);
        const wordItems = await db.all(
          `SELECT * FROM urs_items WHERE ${conditions.join(' OR ')} LIMIT 500`,
          searchWords.map(w => `%${w}%`)
        );
        const seen = new Set(items.map(i => i.urs_code));
        for (const e of wordItems) {
          if (!seen.has(e.urs_code)) {items.push(e);}
        }
      }

      // If too few results, try broader search with shorter words
      if (items.length < 5 && words.length > 1) {
        const shortWords = words.slice(0, 2);
        const cond2 = shortWords.map(() => `${SEARCH_EXPR} LIKE ?`);
        const params2 = shortWords.map(w => `%${w}%`);
        const extra = await db.all(
          `SELECT * FROM urs_items WHERE ${cond2.join(' OR ')} LIMIT 200`,
          params2
        );
        const seen = new Set(items.map(i => i.urs_code));
        for (const e of extra) {
          if (!seen.has(e.urs_code)) {items.push(e);}
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

    // Honest-refusal floor (see localConfFloor): sub-MEDIUM fuzzy scores are
    // dropped; an empty list here is an honest «no code», not a failure.
    const floor = localConfFloor();
    const aboveFloor = scored.filter(item => item.confidence >= floor);
    if (aboveFloor.length < scored.length) {
      logger.debug(`[URSMatcher] Floor ${floor}: dropped ${scored.length - aboveFloor.length} sub-floor fuzzy candidates for "${text.substring(0, 40)}"`);
    }

    // Sort by score descending
    const sorted = aboveFloor.sort((a, b) => b.score - a.score);

    // Return top 5 matches
    return sorted.slice(0, 5).map(item => ({
      urs_code: item.urs_code,
      urs_name: item.urs_name,
      unit: item.unit,
      description: item.description,
      confidence: item.confidence,
      price: item.price || 0,
      url: `https://podminky.urs.cz/item/CS_URS_2026_01/${item.urs_code}`,
      source: item.source
    }));

  } catch (error) {
    logger.error(`[URSMatcher] Local matching error: ${error.message}`);
    return [];
  }
}

/**
 * Match URS items against the real ÚRS catalog via the frontoffice JSON API.
 * Deterministic, non-web (confidence 1.0 on an exact code). Fails soft to [].
 * @private
 */
async function matchUrsItemsFrontoffice(text) {
  // Ops kill-switch (no redeploy): URS_FRONTOFFICE_SEARCH=0 disables the direct path.
  if (process.env.URS_FRONTOFFICE_SEARCH === '0' || process.env.URS_FRONTOFFICE_SEARCH === 'false') {
    return [];
  }
  try {
    const items = await searchCatalog(text, { limit: 20 });
    return items.slice(0, 5);
  } catch (error) {
    logger.error(`[URSMatcher] Frontoffice matching error: ${error.message}`);
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

    // Audit P0-3: OTSKP is the road/transport catalog (dopravní stavby). It must
    // NEVER be presented silently as an ÚRS building code. Tag every OTSKP result as
    // cross-catalog so consumers/UI can flag it and it is excluded from auto-learn.
    return results.map(r => ({
      urs_code: r.code,
      urs_name: r.name,
      unit: r.unit,
      description: `OTSKP (dopravní stavby): ${r.name}`,
      confidence: r.confidence,
      price: r.price,
      source: 'otskp',
      catalog: 'otskp',
      is_cross_catalog: true,
      note: 'OTSKP = katalog dopravních staveb; pro pozemní stavbu ověřit ekvivalent v ÚRS/TSKP',
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
