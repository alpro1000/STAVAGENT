/**
 * URS Local Matcher
 * Локальный поиск URS кодов в базе данных з кэшемПозволяет:
 * 1. Проверить кэш (kb_mappings) для быстрого повторного использования
 * 2. Искать в каталозі (urs_items) по similarity/full-text
 * 3. Возвращать кандидатов с confidence score
 * 4. Определять, нужна ли Perplexity помощь (confidence < 0.7)
 */

import crypto from 'crypto';
import { getDatabase } from '../db/init.js';
import { logger } from '../utils/logger.js';
import { normalizeText } from '../utils/textNormalizer.js';
import { calculateSimilarity } from '../utils/similarity.js';

const CONFIDENCE_THRESHOLDS = {
  CACHED_APPROVED: 0.98,      // Пользователь утвердил - уверенность 98%
  EXACT_MATCH: 0.95,           // Точное совпадение в названии
  HIGH: 0.85,
  MEDIUM: 0.70,
  LOW: 0.50
};

// ============================================================================
// MAIN: Match row to URS candidates (with cache check first)
// ============================================================================

export async function matchRowToUrs(normalizedTextCs, projectContext = {}) {
  const startTime = Date.now();

  try {
    logger.debug(`[URS-LOCAL] Matching: "${normalizedTextCs.substring(0, 50)}..."`);

    // 1️⃣ CHECK CACHE FIRST (kb_mappings) - FASTEST PATH
    const cachedMapping = await lookupCachedMapping(normalizedTextCs, projectContext);
    if (cachedMapping) {
      logger.info(`[URS-LOCAL] ✅ Cache HIT: ${cachedMapping.urs_code} (confidence: ${cachedMapping.confidence})`);
      return {
        candidates: [cachedMapping],
        source: 'cache',
        needs_perplexity: false,
        execution_time_ms: Date.now() - startTime
      };
    }

    logger.debug('[URS-LOCAL] Cache miss, searching local catalog...');

    // 2️⃣ SEARCH IN LOCAL CATALOG (urs_items)
    const candidates = await searchLocalCatalog(normalizedTextCs);

    if (candidates.length === 0) {
      logger.info(`[URS-LOCAL] ❌ No local candidates found`);
      return {
        candidates: [],
        source: 'none',
        needs_perplexity: true, // Need Perplexity to find codes
        execution_time_ms: Date.now() - startTime
      };
    }

    logger.info(`[URS-LOCAL] Found ${candidates.length} candidates, best confidence: ${candidates[0].confidence}`);

    // 3️⃣ DETERMINE IF PERPLEXITY IS NEEDED
    const bestConfidence = candidates[0].confidence;
    const needsPerplexity = bestConfidence < CONFIDENCE_THRESHOLDS.MEDIUM;

    return {
      candidates: candidates.slice(0, 3), // Return top 3
      source: 'local_catalog',
      needs_perplexity: needsPerplexity,
      execution_time_ms: Date.now() - startTime
    };

  } catch (error) {
    logger.error(`[URS-LOCAL] Error: ${error.message}`);
    return {
      candidates: [],
      source: 'error',
      needs_perplexity: true,
      error: error.message,
      execution_time_ms: Date.now() - startTime
    };
  }
}

// ============================================================================
// HELPER: Look up cached mapping in kb_mappings
// ============================================================================

async function lookupCachedMapping(normalizedTextCs, projectContext = {}) {
  try {
    const db = await getDatabase();

    // Build context hash
    const contextHash = buildContextHash(projectContext);

    // Query kb_mappings
    const cached = await db.get(
      `SELECT * FROM kb_mappings
       WHERE normalized_text_cs = ? AND context_hash = ?
       ORDER BY confidence DESC, usage_count DESC LIMIT 1`,
      [normalizedTextCs, contextHash]
    );

    if (cached) {
      // Update last_used_at
      await db.run(
        'UPDATE kb_mappings SET last_used_at = CURRENT_TIMESTAMP, usage_count = usage_count + 1 WHERE id = ?',
        [cached.id]
      );

      return {
        urs_code: cached.urs_code,
        urs_name: cached.urs_name,
        unit: cached.unit,
        confidence: cached.confidence,
        match_type: cached.validated_by_user ? 'cache_approved' : 'cache_auto'
      };
    }

    return null;

  } catch (error) {
    logger.warn(`[URS-LOCAL] Cache lookup error: ${error.message}`);
    return null;
  }
}

// ============================================================================
// HELPER: Search in local URS catalog (optimized with section_code)
// ============================================================================

async function searchLocalCatalog(normalizedTextCs, sectionCodeHint = null) {
  try {
    const db = await getDatabase();

    // Prepare search terms
    const searchTerms = normalizedTextCs
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2);

    logger.debug(`[URS-LOCAL] Search terms: ${searchTerms.join(', ')}${sectionCodeHint ? ` (hint: ${sectionCodeHint})` : ''}`);

    // 1️⃣ TRY EXACT MATCH (optionally filtered by section)
    let exactMatch;
    if (sectionCodeHint) {
      exactMatch = await db.get(
        'SELECT * FROM urs_items WHERE LOWER(urs_name) = ? AND section_code = ? LIMIT 1',
        [normalizedTextCs.toLowerCase(), sectionCodeHint]
      );
    }
    if (!exactMatch) {
      exactMatch = await db.get(
        'SELECT * FROM urs_items WHERE LOWER(urs_name) = ? LIMIT 1',
        [normalizedTextCs.toLowerCase()]
      );
    }

    if (exactMatch) {
      logger.debug('[URS-LOCAL] Found EXACT match');
      return [{
        urs_code: exactMatch.urs_code,
        urs_name: exactMatch.urs_name,
        unit: exactMatch.unit,
        description: exactMatch.description,
        section_code: exactMatch.section_code,
        confidence: CONFIDENCE_THRESHOLDS.EXACT_MATCH,
        match_type: 'exact'
      }];
    }

    // 2️⃣ SEARCH BY SUBSTRING + SIMILARITY (optionally filtered by section)
    let candidates;
    if (sectionCodeHint) {
      candidates = await db.all(
        `SELECT * FROM urs_items
         WHERE section_code = ?
         AND (urs_name LIKE ? OR urs_name LIKE ? OR description LIKE ?)
         LIMIT 15`,
        [sectionCodeHint, `%${searchTerms[0]}%`, `%${searchTerms[searchTerms.length - 1]}%`, `%${searchTerms[0]}%`]
      );
    }

    if (!candidates || candidates.length === 0) {
      // Fallback: search without section hint
      candidates = await db.all(
        `SELECT * FROM urs_items
         WHERE urs_name LIKE ? OR urs_name LIKE ? OR description LIKE ?
         LIMIT 15`,
        [`%${searchTerms[0]}%`, `%${searchTerms[searchTerms.length - 1]}%`, `%${searchTerms[0]}%`]
      );
    }

    if (candidates.length === 0) {
      logger.debug('[URS-LOCAL] No substring matches found');
      return [];
    }

    // 3️⃣ SCORE CANDIDATES BY SIMILARITY
    const scored = candidates.map(item => {
      const similarity = calculateSimilarity(normalizedTextCs, item.urs_name);
      const confidence = Math.max(
        similarity * 0.9 + (matchesAllTerms(item.urs_name, searchTerms) ? 0.1 : 0)
      , 0.5);

      return {
        urs_code: item.urs_code,
        urs_name: item.urs_name,
        unit: item.unit,
        description: item.description,
        section_code: item.section_code,
        confidence: Math.min(confidence, CONFIDENCE_THRESHOLDS.HIGH),
        match_type: 'similarity'
      };
    });

    // Sort by confidence
    scored.sort((a, b) => b.confidence - a.confidence);

    logger.debug(`[URS-LOCAL] Scored ${scored.length} candidates`);

    return scored;

  } catch (error) {
    logger.error(`[URS-LOCAL] Catalog search error: ${error.message}`);
    return [];
  }
}

// NOTE: calculateSimilarity moved to utils/similarity.js

// ============================================================================
// HELPER: Check if candidate matches all search terms
// ============================================================================

function matchesAllTerms(candidateName, terms) {
  const lowerName = candidateName.toLowerCase();
  return terms.every(term => lowerName.includes(term));
}

// ============================================================================
// HELPER: Build context hash for kb_mappings
// ============================================================================

function buildContextHash(projectContext) {
  const contextStr = JSON.stringify({
    building_type: projectContext.building_type || 'unknown',
    storeys: projectContext.storeys || 0,
    main_system: projectContext.main_system?.sort().join(',') || ''
  });

  // Use cryptographic hash to avoid collisions
  return crypto.createHash('sha256').update(contextStr).digest('hex');
}

// ============================================================================
// CACHE MANAGEMENT: Save mapping to kb_mappings
// ============================================================================

export async function saveToCache(normalizedTextCs, ursCode, ursName, unit, projectContext = {}, confidence = 0.85, validatedByUser = false) {
  try {
    const db = await getDatabase();
    const contextHash = buildContextHash(projectContext);

    // Check if already exists
    const existing = await db.get(
      'SELECT id FROM kb_mappings WHERE normalized_text_cs = ? AND context_hash = ?',
      [normalizedTextCs, contextHash]
    );

    if (existing) {
      // Update existing
      await db.run(
        `UPDATE kb_mappings
         SET confidence = ?, validated_by_user = ?, usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [confidence, validatedByUser ? 1 : 0, existing.id]
      );

      logger.debug(`[URS-LOCAL-CACHE] Updated cached mapping: ${ursCode}`);
    } else {
      // Insert new
      await db.run(
        `INSERT INTO kb_mappings
         (normalized_text_cs, context_hash, project_type, building_system, urs_code, urs_name, unit, confidence, validated_by_user, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          normalizedTextCs,
          contextHash,
          projectContext.building_type || null,
          projectContext.main_system?.join(',') || null,
          ursCode,
          ursName,
          unit,
          confidence,
          validatedByUser ? 1 : 0
        ]
      );

      logger.debug(`[URS-LOCAL-CACHE] Saved new mapping: ${ursCode}`);
    }

    return true;

  } catch (error) {
    logger.error(`[URS-LOCAL-CACHE] Save error: ${error.message}`);
    return false;
  }
}

// ============================================================================
// CACHE MANAGEMENT: Get cache statistics
// ============================================================================

export async function getCacheStats() {
  try {
    const db = await getDatabase();

    const totalMappings = await db.get('SELECT COUNT(*) as count FROM kb_mappings');
    const approvedMappings = await db.get('SELECT COUNT(*) as count FROM kb_mappings WHERE validated_by_user = 1');
    const avgConfidence = await db.get('SELECT AVG(confidence) as avg_conf FROM kb_mappings');
    const totalUsages = await db.get('SELECT SUM(usage_count) as total FROM kb_mappings');

    return {
      total_mappings: totalMappings.count,
      approved_mappings: approvedMappings.count,
      auto_learned_mappings: totalMappings.count - approvedMappings.count,
      avg_confidence: avgConfidence.avg_conf?.toFixed(2) || 0,
      total_usages: totalUsages.total || 0
    };

  } catch (error) {
    logger.error(`[URS-LOCAL-CACHE] Stats error: ${error.message}`);
    return null;
  }
}

export default {
  matchRowToUrs,
  saveToCache,
  getCacheStats
};
