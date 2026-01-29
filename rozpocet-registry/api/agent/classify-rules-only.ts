/**
 * Classify Service - Rules-only classification (no AI)
 * Used when AI is disabled or unavailable
 */

import type { ParsedItem, ClassificationResult } from './agent/types';
import { buildRowPack, extractSubordinates } from './agent/rowpack';
import { classifyByRules } from './agent/rules';

/**
 * Classify items using rules only (no Gemini, no Memory)
 */
export function classifyWithRulesOnly(
  mainItem: ParsedItem,
  subordinates: ParsedItem[]
): ClassificationResult {
  // Build rowpack
  const rowpack = buildRowPack(mainItem, subordinates);

  // Try rules
  const ruleMatch = classifyByRules(rowpack);

  if (ruleMatch) {
    return {
      itemId: mainItem.id,
      skupina: ruleMatch.skupina,
      confidence: ruleMatch.confidence >= 80 ? 'high' :
                  ruleMatch.confidence >= 50 ? 'medium' : 'low',
      confidenceScore: ruleMatch.confidence,
      reasoning: ruleMatch.reasoning,
      source: 'rule',
      timestamp: Date.now(),
    };
  }

  // No rule matched → unknown
  return {
    itemId: mainItem.id,
    skupina: 'unknown',
    confidence: 'low',
    confidenceScore: 20,
    reasoning: 'No matching rule found',
    source: 'rule',
    timestamp: Date.now(),
  };
}

/**
 * Batch classify with rules only
 */
export function classifyBatchRulesOnly(
  items: ParsedItem[]
): ClassificationResult[] {
  // Filter main items
  const mainItems = items.filter(item => {
    const isMain = item.rowRole
      ? (item.rowRole === 'main' || item.rowRole === 'section')
      : isMainCodeHeuristic(item.kod);
    return isMain;
  });

  // Classify each main item
  return mainItems.map(mainItem => {
    const subordinates = extractSubordinates(mainItem, items);
    return classifyWithRulesOnly(mainItem, subordinates);
  });
}

function isMainCodeHeuristic(kod: string): boolean {
  if (!kod) return false;
  const mainPattern = /^\d{6,}$/;
  return mainPattern.test(kod.trim());
}
