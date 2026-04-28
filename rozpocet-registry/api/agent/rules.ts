/**
 * Rules Layer — Fast deterministic classification (serverless adapter)
 * Version: 3.0.0 (2026-04-26)
 *
 * Single source of truth: src/services/classification/classificationRules.ts
 * This file is a thin adapter that:
 *   1. Builds a single combined-text + unit input from a RowPack
 *   2. Delegates scoring to the shared `classifyItemWithConfidence` helper
 *   3. Translates the top result into the legacy `RuleMatch` shape
 *
 * Public API preserved:
 *   - `classifyByRules(rowpack: RowPack): RuleMatch | null`
 *   - `getAllowedSkupiny(): string[]`
 */

import type { RowPack, RuleMatch } from './types.js';
import {
  CLASSIFICATION_RULES,
  classifyItemWithConfidence,
} from '../../src/services/classification/classificationRules.js';

/**
 * Try to classify a RowPack using deterministic rules.
 * Returns null when no rule matches with sufficient signal — preserves the
 * "needs manual classification" contract used by the orchestrator and UI
 * (no OSTATNÍ fallback, see classificationRules.ts behaviour notes).
 */
export function classifyByRules(rowpack: RowPack): RuleMatch | null {
  const combinedText = `${rowpack.main_text} ${rowpack.child_text}`;

  // Extract unit from main text (e.g. "(1.0 m2)") — same regex as v2.x
  const unitMatch = rowpack.main_text.match(/\(([\d,\.]+)\s*([a-zA-Z0-9³²]+)\)/);
  const unit = unitMatch ? unitMatch[2].toLowerCase() : null;

  const ranked = classifyItemWithConfidence(combinedText, unit);
  if (ranked.length === 0) return null;

  const best = ranked[0];

  // Floor mirrors v2.x behaviour: don't classify on very weak signal.
  // Score-derived confidence < 30 ≈ original `score > 0.5` threshold.
  if (best.confidence < 30) return null;

  // Look up the per-rule baseline confidence (cap), per A3 schema.
  const rule = CLASSIFICATION_RULES.find(r => r.skupina === best.skupina);
  const cappedConfidence = rule
    ? Math.min(rule.confidence, best.confidence)
    : best.confidence;

  const matchedKeywords = best.matchedKeywords.slice(0, 3).join(', ');

  return {
    skupina: best.skupina,
    confidence: cappedConfidence,
    reasoning: matchedKeywords
      ? `Matched keywords: ${matchedKeywords}`
      : `Matched skupina: ${best.skupina}`,
    ruleName: best.skupina,
  };
}

/**
 * Get all allowed skupiny — derived from the single source of truth.
 */
export function getAllowedSkupiny(): string[] {
  const skupinySet = new Set(CLASSIFICATION_RULES.map(r => r.skupina));
  return Array.from(skupinySet);
}
