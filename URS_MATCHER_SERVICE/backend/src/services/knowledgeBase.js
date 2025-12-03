/**
 * Knowledge Base Service
 * Manages confirmed text-to-URS mappings for fast lookup and learning
 *
 * Purpose:
 * - Cache confirmed mappings to reduce LLM calls
 * - Learn from user validations (KB grows over time)
 * - Suggest complementary works (related_items)
 * - Track confidence and usage patterns
 */

import { getDatabase } from '../db/init.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

/**
 * Compute context hash from project context
 * Used to group similar projects (bytový dům, rodinný dům, průmyslová hala)
 */
export function computeContextHash(projectType, buildingSystem) {
  if (!projectType && !buildingSystem) return null;

  const contextStr = `${projectType || ''}|${buildingSystem || ''}`;
  return crypto
    .createHash('sha256')
    .update(contextStr)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Normalize text to Czech technical description
 * Remove noise, keep key technical terms
 */
export function normalizeTextToCzech(text) {
  if (!text) return '';

  // Convert to lowercase
  let normalized = text.toLowerCase().trim();

  // Remove common noise patterns
  normalized = normalized
    .replace(/\b(byt|číslo|č\.)\s*\d+/gi, '')  // remove "byt 45", "č.15"
    .replace(/\b(kvádr\.?|m2|m3|kg|t|ks|l)\b/gi, '') // remove units
    .replace(/\s+/g, ' ')  // collapse spaces
    .trim();

  return normalized;
}

/**
 * Search Knowledge Base for matching mappings
 * Returns candidates sorted by similarity and usage
 *
 * Security: Prevents DoS by limiting input size and query results
 */
export async function searchKnowledgeBase(normalizedText, projectType, buildingSystem) {
  try {
    const db = getDatabase();
    const contextHash = computeContextHash(projectType, buildingSystem);

    // Validate input length (prevent DoS)
    const MAX_NORMALIZED_LENGTH = 100;
    if (!normalizedText || normalizedText.length > MAX_NORMALIZED_LENGTH) {
      logger.warn(
        `[KB] Search text too long: ${normalizedText?.length || 0} chars (max: ${MAX_NORMALIZED_LENGTH})`
      );
      return [];
    }

    // Try exact match first (same text + context)
    if (contextHash) {
      const exactMatch = await db.get(
        `SELECT * FROM kb_mappings
         WHERE normalized_text_cs = ? AND context_hash = ?
         ORDER BY confidence DESC, usage_count DESC
         LIMIT 1`,
        [normalizedText, contextHash]
      );

      if (exactMatch) {
        logger.info(
          `[KB] Exact match found: "${normalizedText}" → ${exactMatch.urs_code} (conf: ${exactMatch.confidence})`
        );
        return [exactMatch];
      }
    }

    // Try prefix match (more efficient than substring, prevents full-text scanning)
    // Use prefix matching with length limit to prevent large result sets
    const fuzzyMatches = await db.all(
      `SELECT * FROM kb_mappings
       WHERE (normalized_text_cs LIKE ? OR normalized_text_cs LIKE ?)
         AND length(normalized_text_cs) <= ?
       ORDER BY confidence DESC, usage_count DESC
       LIMIT 5`,
      [
        normalizedText.substring(0, 20) + '%',
        normalizedText.substring(0, 20) + '%',
        MAX_NORMALIZED_LENGTH * 2
      ]
    );

    if (fuzzyMatches.length > 0) {
      logger.info(
        `[KB] Fuzzy matches found: "${normalizedText}" → ${fuzzyMatches.length} candidates`
      );
      return fuzzyMatches;
    }

    logger.debug(
      `[KB] No knowledge base matches for: "${normalizedText}" (context: ${projectType || 'none'})`
    );
    return [];
  } catch (error) {
    logger.error(`[KB] Search failed: ${error.message}`);
    return [];
  }
}

/**
 * Get related items for a KB mapping
 * Suggests complementary works (bednění, výztuž, přesun hmot, etc.)
 */
export async function getRelatedItems(kbMappingId) {
  try {
    const db = getDatabase();

    const related = await db.all(
      `SELECT * FROM kb_related_items
       WHERE kb_mapping_id = ?
       ORDER BY typical_sequence_order ASC, co_occurrence_count DESC`,
      [kbMappingId]
    );

    return related || [];
  } catch (error) {
    logger.error(`[KB] Failed to get related items: ${error.message}`);
    return [];
  }
}

/**
 * Insert a new mapping to Knowledge Base
 * Called after user confirms a match or LLM provides high-confidence match
 *
 * Security: Validates URS code exists in catalog before storing (prevents KB poisoning)
 */
export async function insertMapping(
  normalizedTextCs,
  languageHint,
  projectType,
  buildingSystem,
  ursCode,
  ursName,
  unit,
  confidence = 0.8,
  validatedByUser = false
) {
  try {
    const db = getDatabase();
    const contextHash = computeContextHash(projectType, buildingSystem);

    // Security: Validate that URS code exists in catalog
    // This prevents KB poisoning attacks (injecting fake URS codes)
    const catalogItem = await db.get(
      `SELECT urs_code FROM urs_items WHERE urs_code = ?`,
      [ursCode]
    );

    if (!catalogItem) {
      logger.error(`[KB] Invalid URS code in mapping: ${ursCode} (not found in catalog)`);
      throw new Error(`Invalid URS code: ${ursCode}. Code not found in catalog.`);
    }

    // Input validation: Check normalized text length
    const MAX_TEXT_LENGTH = 200;
    if (normalizedTextCs.length > MAX_TEXT_LENGTH) {
      logger.warn(`[KB] Normalized text too long: ${normalizedTextCs.length} chars (max: ${MAX_TEXT_LENGTH})`);
      throw new Error(`Normalized text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`);
    }

    // Validate confidence is a number between 0 and 1
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      logger.warn(`[KB] Invalid confidence value: ${confidence}`);
      confidence = 0.5; // Default to medium confidence
    }

    const result = await db.run(
      `INSERT INTO kb_mappings
       (normalized_text_cs, language_hint, context_hash, project_type, building_system,
        urs_code, urs_name, unit, confidence, usage_count, validated_by_user, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(normalized_text_cs, context_hash) DO UPDATE SET
         usage_count = usage_count + 1,
         confidence = MAX(confidence, ?),
         validated_by_user = MAX(validated_by_user, ?),
         last_used_at = CURRENT_TIMESTAMP`,
      [
        normalizedTextCs,
        languageHint,
        contextHash,
        projectType,
        buildingSystem,
        ursCode,
        ursName,
        unit,
        confidence,
        validatedByUser ? 1 : 0,
        confidence,
        validatedByUser ? 1 : 0
      ]
    );

    logger.info(
      `[KB] Mapping stored: "${normalizedTextCs}" → ${ursCode} (validated: ${validatedByUser}, confidence: ${confidence})`
    );

    return result;
  } catch (error) {
    logger.error(`[KB] Insert mapping failed: ${error.message}`);
    throw error;
  }
}

/**
 * Add related item to a mapping
 * Links complementary works (e.g., bednění + výztuž → beton)
 */
export async function insertRelatedItem(
  kbMappingId,
  ursCode,
  ursName,
  unit,
  reasonCs,
  relationshipType = 'complementary',
  typicalSequenceOrder = null
) {
  try {
    const db = getDatabase();

    await db.run(
      `INSERT INTO kb_related_items
       (kb_mapping_id, urs_code, urs_name, unit, reason_cs, relationship_type, typical_sequence_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(kb_mapping_id, urs_code) DO UPDATE SET
         co_occurrence_count = co_occurrence_count + 1`,
      [
        kbMappingId,
        ursCode,
        ursName,
        unit,
        reasonCs,
        relationshipType,
        typicalSequenceOrder
      ]
    );

    logger.debug(
      `[KB] Related item added: ${kbMappingId} → ${ursCode} (${relationshipType})`
    );
  } catch (error) {
    logger.error(`[KB] Insert related item failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get Knowledge Base statistics
 * Shows what's been learned and how often
 */
export async function getKBStats() {
  try {
    const db = getDatabase();

    const stats = {
      totalMappings: 0,
      validatedMappings: 0,
      totalRelatedItems: 0,
      topUsedMappings: [],
      topConfidentMappings: [],
      projectTypes: []
    };

    // Total mappings
    const countResult = await db.get(
      `SELECT COUNT(*) as count,
              SUM(CASE WHEN validated_by_user = 1 THEN 1 ELSE 0 END) as validated
       FROM kb_mappings`
    );
    stats.totalMappings = countResult?.count || 0;
    stats.validatedMappings = countResult?.validated || 0;

    // Total related items
    const relatedCount = await db.get(
      `SELECT COUNT(*) as count FROM kb_related_items`
    );
    stats.totalRelatedItems = relatedCount?.count || 0;

    // Top used mappings
    stats.topUsedMappings = await db.all(
      `SELECT normalized_text_cs, urs_code, urs_name, usage_count, confidence
       FROM kb_mappings
       ORDER BY usage_count DESC
       LIMIT 10`
    );

    // Top confident mappings
    stats.topConfidentMappings = await db.all(
      `SELECT normalized_text_cs, urs_code, urs_name, confidence, validated_by_user
       FROM kb_mappings
       WHERE confidence >= 0.8
       ORDER BY confidence DESC
       LIMIT 10`
    );

    // Project types
    stats.projectTypes = await db.all(
      `SELECT project_type, COUNT(*) as count
       FROM kb_mappings
       WHERE project_type IS NOT NULL
       GROUP BY project_type
       ORDER BY count DESC`
    );

    return stats;
  } catch (error) {
    logger.error(`[KB] Failed to get stats: ${error.message}`);
    return null;
  }
}

/**
 * Clear low-confidence or unused mappings
 * Maintenance function to keep KB clean
 *
 * Security: Use <= instead of < for more accurate cleanup
 */
export async function cleanupKnowledgeBase(minConfidence = 0.5, minUsageCount = 1) {
  try {
    const db = getDatabase();

    // Delete low quality, unused mappings
    // Fix: Changed usage_count < ? to usage_count <= ? for correct deletion logic
    const result = await db.run(
      `DELETE FROM kb_mappings
       WHERE confidence < ? AND usage_count <= ? AND validated_by_user = 0`,
      [minConfidence, minUsageCount]
    );

    logger.info(
      `[KB] Cleanup: removed ${result.changes} low-quality mappings`
    );

    return result.changes;
  } catch (error) {
    logger.error(`[KB] Cleanup failed: ${error.message}`);
    throw error;
  }
}

/**
 * Export Knowledge Base as JSON
 * For backup, migration, or external analysis
 */
export async function exportKnowledgeBase() {
  try {
    const db = getDatabase();

    const mappings = await db.all(`
      SELECT * FROM kb_mappings
      ORDER BY usage_count DESC, confidence DESC
    `);

    const relatedItems = await db.all(`
      SELECT * FROM kb_related_items
      ORDER BY kb_mapping_id, typical_sequence_order
    `);

    return {
      exported_at: new Date().toISOString(),
      kb_mappings: mappings,
      kb_related_items: relatedItems,
      summary: await getKBStats()
    };
  } catch (error) {
    logger.error(`[KB] Export failed: ${error.message}`);
    throw error;
  }
}
