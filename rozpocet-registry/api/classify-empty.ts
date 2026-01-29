/**
 * API Endpoint: Klasifikovat prázdné
 * Classifies ONLY items with empty skupina (main items only)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ParsedItem } from './agent/types';
import { buildRowPack, extractSubordinates } from './agent/rowpack';
import { classifyBatch, getClassificationStats } from './agent/orchestrator';

interface ClassifyEmptyRequest {
  projectId: string;
  sheetId: string;
  items: ParsedItem[];
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
    const { projectId, sheetId, items } = req.body as ClassifyEmptyRequest;

    if (!projectId || !sheetId || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'projectId, sheetId, and items are required' });
    }

    console.log(`[classify-empty] Processing ${items.length} items for project ${projectId}`);

    // Filter MAIN items with empty skupina
    const mainItems = items.filter(item => {
      // Check if it's a main item
      const isMain = item.rowRole
        ? (item.rowRole === 'main' || item.rowRole === 'section')
        : isMainCodeHeuristic(item.kod);

      // Check if skupina is empty
      const isEmpty = !item.skupina || item.skupina.trim() === '';

      return isMain && isEmpty;
    });

    console.log(`[classify-empty] Found ${mainItems.length} main items with empty skupina`);

    if (mainItems.length === 0) {
      return res.status(200).json({
        success: true,
        changed: 0,
        unchanged: items.length,
        unknown: 0,
        stats: {
          total: 0,
          bySource: {},
          byConfidence: {},
          unknown: 0,
        },
        message: 'No empty main items found',
      });
    }

    // Build rowpacks for main items
    const rowpacks = mainItems.map(mainItem => {
      const subordinates = extractSubordinates(mainItem, items);
      return buildRowPack(mainItem, subordinates);
    });

    // Classify in batch
    const results = await classifyBatch(rowpacks, {
      maxConcurrent: 5,
      onProgress: (completed, total) => {
        console.log(`[classify-empty] Progress: ${completed}/${total}`);
      },
    });

    // Build response with updated items
    const itemUpdates = new Map();

    for (const result of results) {
      itemUpdates.set(result.itemId, {
        skupina: result.skupina,
        confidence: result.confidence,
        confidenceScore: result.confidenceScore,
        reasoning: result.reasoning,
        source: result.source,
        modelUsed: result.modelUsed,
      });
    }

    const stats = getClassificationStats(results);

    console.log(`[classify-empty] Complete: ${results.length} items classified`);
    console.log(`[classify-empty] Stats:`, stats);

    return res.status(200).json({
      success: true,
      changed: results.length,
      unchanged: items.length - mainItems.length,
      unknown: stats.unknown,
      stats,
      results: Array.from(itemUpdates.entries()).map(([itemId, update]) => ({
        itemId,
        ...update,
      })),
    });

  } catch (error) {
    console.error('[classify-empty] Error:', error);
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
