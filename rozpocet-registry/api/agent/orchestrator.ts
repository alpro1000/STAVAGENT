/**
 * Decision Orchestrator - Coordinates classification pipeline
 * Priority: Cache → Rules → Memory → Gemini
 */

import type { RowPack, ClassificationResult, MemoryExample } from './types.js';
import { classifyByRules, getAllowedSkupiny } from './rules.js';
import { checkCache, retrieveSimilarExamples } from './memory.js';
import { classifyWithGemini, confidenceToScore } from './gemini.js';
import { ALLOWED_SKUPINY } from './types.js';

/**
 * Main classification orchestrator
 * Tries layers in order: cache → rules → memory → gemini
 */
export async function classifyItem(rowpack: RowPack): Promise<ClassificationResult> {
  const startTime = Date.now();

  console.log(`[Orchestrator] Classifying item ${rowpack.meta.itemId}...`);

  // 1. Check cache (exact match by hash)
  const cached = checkCache(rowpack.hash, rowpack.meta.projectId);
  if (cached) {
    console.log(`[Orchestrator] Cache HIT - returning cached result`);
    return {
      itemId: rowpack.meta.itemId,
      skupina: cached.skupina,
      confidence: 'high',
      confidenceScore: 95,
      reasoning: 'Exact match from previous classification',
      source: 'cache',
      timestamp: Date.now(),
    };
  }

  // 2. Try rules (fast deterministic layer)
  const ruleMatch = classifyByRules(rowpack);
  if (ruleMatch && ruleMatch.confidence >= 80) {
    console.log(`[Orchestrator] Rules MATCH - high confidence (${ruleMatch.confidence})`);
    return {
      itemId: rowpack.meta.itemId,
      skupina: ruleMatch.skupina,
      confidence: 'high',
      confidenceScore: ruleMatch.confidence,
      reasoning: ruleMatch.reasoning,
      source: 'rule',
      timestamp: Date.now(),
    };
  }

  // 3. Retrieve similar examples from memory
  const similarExamples = retrieveSimilarExamples(rowpack, 3);

  // If we have strong memory matches, use them
  if (similarExamples.length > 0 && similarExamples[0]) {
    const bestExample = similarExamples[0];

    // If the best example is confirmed (user correction), trust it highly
    if (bestExample.confirmed) {
      console.log(`[Orchestrator] Memory MATCH - confirmed example`);
      return {
        itemId: rowpack.meta.itemId,
        skupina: bestExample.skupina,
        confidence: 'high',
        confidenceScore: 88,
        reasoning: 'Similar to confirmed user correction',
        source: 'memory',
        timestamp: Date.now(),
      };
    }
  }

  // 4. Call Gemini (with similar examples as context)
  try {
    console.log(`[Orchestrator] Calling Gemini with ${similarExamples.length} similar examples...`);

    const geminiResult = await classifyWithGemini({
      rowpack,
      retrievedExamples: similarExamples,
      allowedSkupiny: [...ALLOWED_SKUPINY, 'unknown'],
    });

    // Validate result
    const isValid = validateSkupina(geminiResult.skupina);
    if (!isValid) {
      console.warn(`[Orchestrator] Gemini returned invalid skupina: ${geminiResult.skupina}`);
      geminiResult.skupina = 'unknown';
      geminiResult.confidence = 'low';
    }

    const duration = Date.now() - startTime;
    console.log(`[Orchestrator] Gemini result: ${geminiResult.skupina} (${geminiResult.confidence}) in ${duration}ms`);

    return {
      itemId: rowpack.meta.itemId,
      skupina: geminiResult.skupina,
      confidence: geminiResult.confidence,
      confidenceScore: confidenceToScore(geminiResult.confidence),
      reasoning: geminiResult.reason,
      source: 'gemini',
      modelUsed: 'gemini-2.0-flash',
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error(`[Orchestrator] Gemini failed:`, error);

    // Fallback: Use rule match with lower confidence, or unknown
    if (ruleMatch) {
      console.log(`[Orchestrator] Fallback to rule match (medium confidence)`);
      return {
        itemId: rowpack.meta.itemId,
        skupina: ruleMatch.skupina,
        confidence: 'medium',
        confidenceScore: Math.min(ruleMatch.confidence, 70),
        reasoning: `${ruleMatch.reasoning} (AI unavailable)`,
        source: 'rule',
        timestamp: Date.now(),
      };
    }

    // Last resort: unknown
    console.log(`[Orchestrator] No fallback available - returning unknown`);
    return {
      itemId: rowpack.meta.itemId,
      skupina: 'unknown',
      confidence: 'low',
      confidenceScore: 20,
      reasoning: 'Classification failed, no rule match available',
      source: 'rule',
      timestamp: Date.now(),
    };
  }
}

/**
 * Validate that skupina is in allowed list
 */
function validateSkupina(skupina: string): boolean {
  return ALLOWED_SKUPINY.includes(skupina as any) || skupina === 'unknown';
}

/**
 * Batch classification (optimize for multiple items)
 */
export async function classifyBatch(
  rowpacks: RowPack[],
  options?: {
    maxConcurrent?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<ClassificationResult[]> {
  const maxConcurrent = options?.maxConcurrent || 5;
  const results: ClassificationResult[] = [];

  console.log(`[Orchestrator] Batch classifying ${rowpacks.length} items (concurrent: ${maxConcurrent})`);

  // Process in batches to avoid overwhelming Gemini API
  for (let i = 0; i < rowpacks.length; i += maxConcurrent) {
    const batch = rowpacks.slice(i, i + maxConcurrent);

    const batchResults = await Promise.all(
      batch.map(rowpack => classifyItem(rowpack))
    );

    results.push(...batchResults);

    if (options?.onProgress) {
      options.onProgress(results.length, rowpacks.length);
    }

    // Small delay between batches to avoid rate limiting
    if (i + maxConcurrent < rowpacks.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`[Orchestrator] Batch complete: ${results.length} items classified`);
  return results;
}

/**
 * Get classification statistics
 */
export function getClassificationStats(results: ClassificationResult[]): {
  total: number;
  bySource: Record<string, number>;
  byConfidence: Record<string, number>;
  unknown: number;
} {
  const stats = {
    total: results.length,
    bySource: {} as Record<string, number>,
    byConfidence: {} as Record<string, number>,
    unknown: 0,
  };

  for (const result of results) {
    // Count by source
    stats.bySource[result.source] = (stats.bySource[result.source] || 0) + 1;

    // Count by confidence
    stats.byConfidence[result.confidence] = (stats.byConfidence[result.confidence] || 0) + 1;

    // Count unknown
    if (result.skupina === 'unknown') {
      stats.unknown++;
    }
  }

  return stats;
}
