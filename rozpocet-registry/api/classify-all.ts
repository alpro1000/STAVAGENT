/**
 * API Endpoint: Překlasifikovat vše
 * Re-classifies ALL main items
 * - If confidence is low/unknown → keeps existing skupina
 * - If confidence is high/medium → updates skupina
 * - Cascades to subordinate items
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ParsedItem } from './agent/types';
import { buildRowPack, extractSubordinates } from './agent/rowpack';
import { classifyBatch, getClassificationStats } from './agent/orchestrator';
import { classifyBatchRulesOnly } from './agent/classify-rules-only';

// Feature flag: Enable/disable AI (Gemini)
const AI_ENABLED = process.env.AI_ENABLED !== 'false'; // Default: true

interface ClassifyAllRequest {
  projectId: string;
  sheetId: string;
  items: ParsedItem[];
  forceUpdate?: boolean; // Force update even with low confidence
  aiEnabled?: boolean; // Override from client
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId, sheetId, items, forceUpdate = false, aiEnabled } = req.body as ClassifyAllRequest;

    if (!projectId || !sheetId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'projectId, sheetId, and items are required' });
    }

    // Determine if AI should be used
    const useAI = aiEnabled !== undefined ? aiEnabled : AI_ENABLED;

    console.log(`[classify-all] Processing ${items.length} items for project ${projectId} (force: ${forceUpdate}, AI: ${useAI ? 'ON' : 'OFF'})`);

    // Filter MAIN items (all, regardless of existing skupina)
    const mainItems = items.filter(item => {
      const isMain = item.rowRole
        ? (item.rowRole === 'main' || item.rowRole === 'section')
        : isMainCodeHeuristic(item.kod);

      return isMain;
    });

    console.log(`[classify-all] Found ${mainItems.length} main items to re-classify`);

    if (mainItems.length === 0) {
      return res.status(200).json({
        success: true,
        changed: 0,
        unchanged: items.length,
        unknown: 0,
        keptExisting: 0,
        stats: {
          total: 0,
          bySource: {},
          byConfidence: {},
          unknown: 0,
        },
        message: 'No main items found',
      });
    }

    // Classify items (with or without AI)
    let results;

    if (useAI) {
      // Build rowpacks for main items
      const rowpacks = mainItems.map(mainItem => {
        const subordinates = extractSubordinates(mainItem, items);
        return buildRowPack(mainItem, subordinates);
      });

      // Classify in batch (AI enabled: cache → rules → memory → gemini)
      results = await classifyBatch(rowpacks, {
        maxConcurrent: 5,
        onProgress: (completed, total) => {
          console.log(`[classify-all] Progress: ${completed}/${total}`);
        },
      });
    } else {
      // Rules-only classification (AI disabled)
      console.log(`[classify-all] AI disabled - using rules-only classification`);
      results = classifyBatchRulesOnly(items).filter(r => {
        return mainItems.some(m => m.id === r.itemId);
      });
    }

    // Process results: keep existing if confidence is low/unknown
    const itemUpdates = new Map();
    let changedCount = 0;
    let keptExistingCount = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const originalItem = mainItems[i];

      // Decision: update or keep existing?
      let shouldUpdate = forceUpdate;

      if (!forceUpdate) {
        // Update only if confidence is medium or high
        if (result.confidence === 'high' || result.confidence === 'medium') {
          shouldUpdate = true;
        } else if (result.skupina === 'unknown') {
          // Keep existing skupina if AI returned unknown
          shouldUpdate = false;
        } else if (result.confidence === 'low') {
          // Keep existing skupina if confidence is low
          shouldUpdate = false;
        }
      }

      if (shouldUpdate) {
        itemUpdates.set(result.itemId, {
          skupina: result.skupina,
          confidence: result.confidence,
          confidenceScore: result.confidenceScore,
          reasoning: result.reasoning,
          source: result.source,
          modelUsed: result.modelUsed,
          action: 'updated',
        });
        changedCount++;
      } else {
        // Keep existing
        itemUpdates.set(result.itemId, {
          skupina: originalItem.skupina || 'unknown',
          confidence: 'medium',
          confidenceScore: 50,
          reasoning: `Kept existing (AI confidence too low: ${result.confidence})`,
          source: 'kept_existing',
          action: 'kept',
        });
        keptExistingCount++;
      }
    }

    const stats = getClassificationStats(results);

    console.log(`[classify-all] Complete: ${changedCount} changed, ${keptExistingCount} kept existing`);
    console.log(`[classify-all] Stats:`, stats);

    return res.status(200).json({
      success: true,
      changed: changedCount,
      unchanged: items.length - mainItems.length, // Non-main items
      unknown: stats.unknown,
      keptExisting: keptExistingCount,
      aiEnabled: useAI,
      stats,
      results: Array.from(itemUpdates.entries()).map(([itemId, update]) => ({
        itemId,
        ...update,
      })),
    });

  } catch (error) {
    console.error('[classify-all] Error:', error);
    return res.status(500).json({
      error: 'Classification failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Heuristic to check if code represents main item
 */
function isMainCodeHeuristic(kod: string): boolean {
  if (!kod) return false;
  const mainPattern = /^\d{6,}$/;
  return mainPattern.test(kod.trim());
}
