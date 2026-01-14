/**
 * Classification Service
 *
 * Phase 5: Bulk classification operations and statistics
 */

import type { ParsedItem } from '../../types/item';
import type { WorkGroup } from '../../utils/constants';
import { classifyItem, classifyItemWithConfidence } from './classificationRules';

/**
 * Classification result for single item
 */
export interface ItemClassificationResult {
  itemId: string;
  originalSkupina: string | null;
  suggestedSkupina: WorkGroup | null;
  confidence: number; // 0-100
  wasClassified: boolean;
}

/**
 * Bulk classification result
 */
export interface BulkClassificationResult {
  totalItems: number;
  classified: number;
  unclassified: number;
  results: ItemClassificationResult[];
  groupCounts: Record<string, number>;
}

/**
 * Classify single item
 */
export function classifySingleItem(item: ParsedItem): ItemClassificationResult {
  const suggested = classifyItem(item.popisFull);
  const matches = classifyItemWithConfidence(item.popisFull);
  const confidence = matches.length > 0 ? matches[0].confidence : 0;

  return {
    itemId: item.id,
    originalSkupina: item.skupina,
    suggestedSkupina: suggested,
    confidence,
    wasClassified: suggested !== null,
  };
}

/**
 * Classify array of items
 * Only classifies items without existing skupina (or overwrite=true)
 */
export function classifyItems(
  items: ParsedItem[],
  options: {
    overwrite?: boolean;        // Overwrite existing classifications
    minConfidence?: number;     // Minimum confidence to apply (0-100)
  } = {}
): BulkClassificationResult {
  const { overwrite = false, minConfidence = 0 } = options;

  const results: ItemClassificationResult[] = [];
  const groupCounts: Record<string, number> = {};
  let classified = 0;
  let unclassified = 0;

  for (const item of items) {
    // Skip if already classified and not overwriting
    if (item.skupina && !overwrite) {
      results.push({
        itemId: item.id,
        originalSkupina: item.skupina,
        suggestedSkupina: null,
        confidence: 0,
        wasClassified: false,
      });
      continue;
    }

    // Classify
    const result = classifySingleItem(item);

    // Apply only if confidence is high enough
    if (result.suggestedSkupina && result.confidence >= minConfidence) {
      classified++;

      // Count by group
      const group = result.suggestedSkupina;
      groupCounts[group] = (groupCounts[group] || 0) + 1;
    } else {
      unclassified++;
    }

    results.push(result);
  }

  return {
    totalItems: items.length,
    classified,
    unclassified,
    results,
    groupCounts,
  };
}

/**
 * Get classification suggestions for manual review
 * Returns items with suggested classifications but not yet applied
 */
export function getSuggestions(
  items: ParsedItem[],
  minConfidence: number = 50
): Array<{
  item: ParsedItem;
  suggestions: Array<{
    skupina: WorkGroup;
    confidence: number;
    matchedKeywords: string[];
  }>;
}> {
  const result: Array<{
    item: ParsedItem;
    suggestions: Array<{
      skupina: WorkGroup;
      confidence: number;
      matchedKeywords: string[];
    }>;
  }> = [];

  for (const item of items) {
    // Only suggest for unclassified items
    if (item.skupina) continue;

    const suggestions = classifyItemWithConfidence(item.popisFull);

    // Filter by confidence
    const filtered = suggestions.filter(s => s.confidence >= minConfidence);

    if (filtered.length > 0) {
      result.push({
        item,
        suggestions: filtered,
      });
    }
  }

  return result;
}

/**
 * Apply classifications to items (mutates items array)
 */
export function applyClassifications(
  items: ParsedItem[],
  classifications: Map<string, WorkGroup>
): number {
  let applied = 0;

  for (const item of items) {
    const suggested = classifications.get(item.id);
    if (suggested) {
      item.skupina = suggested;
      item.skupinaSuggested = suggested;
      applied++;
    }
  }

  return applied;
}

/**
 * Get classification statistics
 */
export function getClassificationStats(items: ParsedItem[]): {
  totalItems: number;
  classified: number;
  unclassified: number;
  classificationRate: number; // 0-100
  groupDistribution: Array<{ skupina: string; count: number; percentage: number }>;
} {
  const totalItems = items.length;
  const classified = items.filter(item => item.skupina !== null).length;
  const unclassified = totalItems - classified;
  const classificationRate = totalItems > 0 ? (classified / totalItems) * 100 : 0;

  // Group distribution
  const groupCounts: Record<string, number> = {};
  for (const item of items) {
    if (item.skupina) {
      groupCounts[item.skupina] = (groupCounts[item.skupina] || 0) + 1;
    }
  }

  const groupDistribution = Object.entries(groupCounts)
    .map(([skupina, count]) => ({
      skupina,
      count,
      percentage: (count / totalItems) * 100,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalItems,
    classified,
    unclassified,
    classificationRate: Math.round(classificationRate),
    groupDistribution,
  };
}
