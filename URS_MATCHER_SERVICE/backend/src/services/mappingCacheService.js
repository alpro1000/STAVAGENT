/**
 * Mapping Cache Service
 * Управление kb_mappings и kb_related_items для сохранения и переиспользования знаний
 *
 * Функции:
 * 1. Сохранить маппинг с доверием (ручное или автоматическое)
 * 2. Получить связанные работы (tech-rules) для маппинга
 * 3. Добавить новую связанную работу с причиной
 * 4. Получить статистику и метрики
 */

import { getDatabase } from '../db/init.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// SAVE COMPLETE MAPPING WITH RELATED ITEMS
// ============================================================================

/**
 * Save a complete mapping with all related items
 * @param {string} normalizedTextCs - Normalized Czech description
 * @param {Object} mainMapping - { urs_code, urs_name, unit, confidence }
 * @param {Array} relatedItems - Array of { urs_code, urs_name, unit, reason_cs, relationship_type }
 * @param {Object} projectContext - Project context for contextual matching
 * @param {boolean} validatedByUser - Whether user confirmed this mapping
 */
export async function saveCompleteMapping(normalizedTextCs, mainMapping, relatedItems = [], projectContext = {}, validatedByUser = false) {
  const db = await getDatabase();
  const contextHash = buildContextHash(projectContext);

  try {
    // 1️⃣ Save or update main mapping in kb_mappings
    const existingId = await db.get(
      'SELECT id FROM kb_mappings WHERE normalized_text_cs = ? AND context_hash = ?',
      [normalizedTextCs, contextHash]
    );

    let kbMappingId;

    if (existingId) {
      // Update existing
      await db.run(
        `UPDATE kb_mappings
         SET urs_code = ?, urs_name = ?, unit = ?, confidence = ?, validated_by_user = ?,
             usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [mainMapping.urs_code, mainMapping.urs_name, mainMapping.unit, mainMapping.confidence, validatedByUser ? 1 : 0, existingId.id]
      );

      kbMappingId = existingId.id;
      logger.debug(`[CACHE] Updated main mapping: ${mainMapping.urs_code}`);
    } else {
      // Insert new
      const result = await db.run(
        `INSERT INTO kb_mappings
         (normalized_text_cs, context_hash, project_type, building_system, urs_code, urs_name, unit, confidence, validated_by_user, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          normalizedTextCs,
          contextHash,
          projectContext.building_type || null,
          projectContext.main_system?.join(',') || null,
          mainMapping.urs_code,
          mainMapping.urs_name,
          mainMapping.unit,
          mainMapping.confidence,
          validatedByUser ? 1 : 0
        ]
      );

      kbMappingId = result.lastID;
      logger.debug(`[CACHE] Saved new main mapping: ${mainMapping.urs_code}`);
    }

    // 2️⃣ Save related items
    for (const relatedItem of relatedItems) {
      await saveRelatedItem(kbMappingId, relatedItem);
    }

    logger.info(`[CACHE] Saved mapping with ${relatedItems.length} related items`);
    return kbMappingId;

  } catch (error) {
    logger.error(`[CACHE] Save error: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// SAVE RELATED ITEM
// ============================================================================

/**
 * Save a single related item (tech-rule)
 */
async function saveRelatedItem(kbMappingId, relatedItem) {
  const db = await getDatabase();

  try {
    // Check if already exists
    const existing = await db.get(
      'SELECT id FROM kb_related_items WHERE kb_mapping_id = ? AND urs_code = ?',
      [kbMappingId, relatedItem.urs_code]
    );

    if (existing) {
      // Update co-occurrence count
      await db.run(
        'UPDATE kb_related_items SET co_occurrence_count = co_occurrence_count + 1 WHERE id = ?',
        [existing.id]
      );
    } else {
      // Insert new
      await db.run(
        `INSERT INTO kb_related_items
         (kb_mapping_id, urs_code, urs_name, unit, reason_cs, relationship_type, typical_sequence_order, co_occurrence_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          kbMappingId,
          relatedItem.urs_code,
          relatedItem.urs_name,
          relatedItem.unit,
          relatedItem.reason_cs || null,
          relatedItem.relationship_type || 'complementary',
          relatedItem.typical_sequence_order || 0
        ]
      );
    }

  } catch (error) {
    logger.warn(`[CACHE] Related item save error: ${error.message}`);
    // Don't throw, just log warning
  }
}

// ============================================================================
// GET RELATED ITEMS
// ============================================================================

/**
 * Get all related items for a mapping
 */
export async function getRelatedItems(ursCode, projectContext = {}) {
  const db = await getDatabase();

  try {
    // Get related items for this URS code
    // First find any kb_mapping with this code
    const mappings = await db.all(
      'SELECT id FROM kb_mappings WHERE urs_code = ? LIMIT 5',
      [ursCode]
    );

    if (mappings.length === 0) {
      return [];
    }

    // Get related items (most common ones first)
    const relatedItems = await db.all(
      `SELECT DISTINCT urs_code, urs_name, unit, reason_cs, relationship_type, typical_sequence_order
       FROM kb_related_items
       WHERE kb_mapping_id IN (${mappings.map(() => '?').join(',')})
       ORDER BY co_occurrence_count DESC, typical_sequence_order ASC
       LIMIT 10`,
      mappings.map(m => m.id)
    );

    return relatedItems;

  } catch (error) {
    logger.warn(`[CACHE] Get related items error: ${error.message}`);
    return [];
  }
}

// ============================================================================
// LOOKUP WITH CONTEXT
// ============================================================================

/**
 * Lookup cached mapping with context awareness
 */
export async function lookupWithContext(normalizedTextCs, projectContext = {}) {
  const db = await getDatabase();
  const contextHash = buildContextHash(projectContext);

  try {
    // Try exact context match first
    const exactMatch = await db.get(
      `SELECT * FROM kb_mappings
       WHERE normalized_text_cs = ? AND context_hash = ?
       AND validated_by_user = 1
       LIMIT 1`,
      [normalizedTextCs, contextHash]
    );

    if (exactMatch) {
      const relatedItems = await getRelatedItems(exactMatch.urs_code, projectContext);
      return {
        ...exactMatch,
        related_items: relatedItems,
        match_type: 'exact_context'
      };
    }

    // Try without context (broader search)
    const generalMatch = await db.get(
      `SELECT * FROM kb_mappings
       WHERE normalized_text_cs = ?
       AND validated_by_user = 1
       ORDER BY confidence DESC, usage_count DESC
       LIMIT 1`,
      [normalizedTextCs]
    );

    if (generalMatch) {
      const relatedItems = await getRelatedItems(generalMatch.urs_code, projectContext);
      return {
        ...generalMatch,
        related_items: relatedItems,
        match_type: 'general'
      };
    }

    return null;

  } catch (error) {
    logger.warn(`[CACHE] Lookup error: ${error.message}`);
    return null;
  }
}

// ============================================================================
// APPROVE MAPPING (user validation)
// ============================================================================

/**
 * User approves a mapping - increases confidence and marks as validated
 */
export async function approveMappingByUser(normalizedTextCs, ursCode, projectContext = {}, comment = '') {
  const db = await getDatabase();
  const contextHash = buildContextHash(projectContext);

  try {
    const result = await db.run(
      `UPDATE kb_mappings
       SET validated_by_user = 1, confidence = MIN(confidence + 0.05, 1.0), validation_comment = ?, updated_at = CURRENT_TIMESTAMP
       WHERE normalized_text_cs = ? AND context_hash = ? AND urs_code = ?`,
      [comment || null, normalizedTextCs, contextHash, ursCode]
    );

    if (result.changes === 0) {
      logger.warn('[CACHE] No mapping found to approve');
      return false;
    }

    logger.info(`[CACHE] Approved mapping: ${ursCode}`);
    return true;

  } catch (error) {
    logger.error(`[CACHE] Approve error: ${error.message}`);
    return false;
  }
}

// ============================================================================
// REJECT MAPPING (user says it's wrong)
// ============================================================================

/**
 * User rejects a mapping - decreases confidence
 */
export async function rejectMappingByUser(normalizedTextCs, ursCode, projectContext = {}, reason = '') {
  const db = await getDatabase();
  const contextHash = buildContextHash(projectContext);

  try {
    const result = await db.run(
      `UPDATE kb_mappings
       SET confidence = MAX(confidence - 0.10, 0.3), validation_comment = ?, updated_at = CURRENT_TIMESTAMP
       WHERE normalized_text_cs = ? AND context_hash = ? AND urs_code = ?`,
      [reason || 'User rejected', normalizedTextCs, contextHash, ursCode]
    );

    if (result.changes === 0) {
      logger.warn('[CACHE] No mapping found to reject');
      return false;
    }

    logger.info(`[CACHE] Rejected mapping: ${ursCode}`);
    return true;

  } catch (error) {
    logger.error(`[CACHE] Reject error: ${error.message}`);
    return false;
  }
}

// ============================================================================
// CACHE STATISTICS
// ============================================================================

/**
 * Get detailed cache statistics
 */
export async function getCacheStats() {
  const db = await getDatabase();

  try {
    const totalMappings = await db.get('SELECT COUNT(*) as count FROM kb_mappings');
    const approvedMappings = await db.get('SELECT COUNT(*) as count FROM kb_mappings WHERE validated_by_user = 1');
    const avgConfidence = await db.get('SELECT AVG(confidence) as avg_conf FROM kb_mappings');
    const totalUsages = await db.get('SELECT SUM(usage_count) as total FROM kb_mappings');

    const totalRelated = await db.get('SELECT COUNT(*) as count FROM kb_related_items');
    const avgRelatedPerMapping = await db.get(
      'SELECT AVG(item_count) as avg FROM (SELECT COUNT(*) as item_count FROM kb_related_items GROUP BY kb_mapping_id)'
    );

    return {
      mappings: {
        total: totalMappings.count,
        approved: approvedMappings.count,
        auto_learned: totalMappings.count - approvedMappings.count
      },
      quality: {
        avg_confidence: parseFloat(avgConfidence.avg_conf || 0).toFixed(2),
        total_usages: totalUsages.total || 0
      },
      related_items: {
        total: totalRelated.count,
        avg_per_mapping: parseFloat(avgRelatedPerMapping.avg || 0).toFixed(1)
      }
    };

  } catch (error) {
    logger.error(`[CACHE] Stats error: ${error.message}`);
    return null;
  }
}

// ============================================================================
// CLEANUP OLD CACHE ENTRIES
// ============================================================================

/**
 * Remove auto-learned mappings that haven't been used in 30 days
 */
export async function cleanupOldCache(daysThreshold = 30) {
  const db = await getDatabase();

  try {
    const result = await db.run(
      `DELETE FROM kb_mappings
       WHERE validated_by_user = 0
       AND last_used_at < datetime('now', '-' || ? || ' days')`,
      [daysThreshold]
    );

    logger.info(`[CACHE] Cleaned up ${result.changes} old auto-learned mappings`);
    return result.changes;

  } catch (error) {
    logger.error(`[CACHE] Cleanup error: ${error.message}`);
    return 0;
  }
}

// ============================================================================
// HELPER: Build context hash
// ============================================================================

function buildContextHash(projectContext) {
  const contextStr = JSON.stringify({
    building_type: projectContext.building_type || 'unknown',
    storeys: projectContext.storeys || 0,
    main_system: projectContext.main_system?.sort().join(',') || ''
  });

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < contextStr.length; i++) {
    const char = contextStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(16);
}

export default {
  saveCompleteMapping,
  getRelatedItems,
  lookupWithContext,
  approveMappingByUser,
  rejectMappingByUser,
  getCacheStats,
  cleanupOldCache
};
