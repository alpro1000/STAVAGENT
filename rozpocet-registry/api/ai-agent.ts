/**
 * AI Agent API - Unified endpoint for all AI classification operations
 * Combines classify-empty, classify-all, and record-correction into one serverless function
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ParsedItem } from './agent/types.js';
import { buildRowPack, extractSubordinates } from './agent/rowpack.js';
import { classifyBatch, getClassificationStats } from './agent/orchestrator.js';
import { classifyBatchRulesOnly } from './agent/classify-rules-only.js';
import { storeMemoryExample } from './agent/memory.js';
import { v4 as uuidv4 } from 'uuid';

// Feature flag: Enable/disable AI (Gemini)
const AI_ENABLED = process.env.AI_ENABLED !== 'false'; // Default: true

/**
 * Main handler - routes to sub-handlers based on operation parameter
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { operation } = req.body;

    switch (operation) {
      case 'classify-empty':
        return await handleClassifyEmpty(req, res);
      case 'classify-all':
        return await handleClassifyAll(req, res);
      case 'record-correction':
        return await handleRecordCorrection(req, res);
      default:
        return res.status(400).json({ error: 'Invalid operation. Use: classify-empty, classify-all, or record-correction' });
    }
  } catch (error) {
    console.error('[ai-agent] Fatal error:', error);
    return res.status(500).json({
      error: 'Operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handler: Klasifikovat prázdné
 * Classifies ONLY items with empty skupina (main items only)
 */
async function handleClassifyEmpty(req: VercelRequest, res: VercelResponse) {
  const { projectId, sheetId, items, aiEnabled } = req.body;

  if (!projectId || !sheetId || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'projectId, sheetId, and items are required' });
  }

  const useAI = aiEnabled !== undefined ? aiEnabled : AI_ENABLED;
  console.log(`[classify-empty] Processing ${items.length} items (AI: ${useAI ? 'ON' : 'OFF'})`);

  // Filter MAIN items with empty skupina
  const mainItems = items.filter((item: ParsedItem) => {
    const isMain = item.rowRole
      ? (item.rowRole === 'main' || item.rowRole === 'section')
      : isMainCodeHeuristic(item.kod);
    const isEmpty = !item.skupina || item.skupina.trim() === '';
    return isMain && isEmpty;
  });

  if (mainItems.length === 0) {
    return res.status(200).json({
      success: true,
      changed: 0,
      unchanged: items.length,
      unknown: 0,
      aiEnabled: useAI,
      stats: { total: 0, bySource: {}, byConfidence: {}, unknown: 0 },
      message: 'No empty main items found',
    });
  }

  // Classify items
  let results;
  if (useAI) {
    const rowpacks = mainItems.map((mainItem: ParsedItem) => {
      const subordinates = extractSubordinates(mainItem, items);
      return buildRowPack(mainItem, subordinates);
    });
    results = await classifyBatch(rowpacks, { maxConcurrent: 5 });
  } else {
    results = classifyBatchRulesOnly(items).filter(r =>
      mainItems.some((m: ParsedItem) => m.id === r.itemId)
    );
  }

  const stats = getClassificationStats(results);
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

  return res.status(200).json({
    success: true,
    changed: results.length,
    unchanged: items.length - mainItems.length,
    unknown: stats.unknown,
    aiEnabled: useAI,
    stats,
    results: Array.from(itemUpdates.entries()).map(([itemId, update]) => ({
      itemId,
      ...update,
    })),
  });
}

/**
 * Handler: Překlasifikovat vše
 * Re-classifies ALL main items (keeps existing if confidence low)
 */
async function handleClassifyAll(req: VercelRequest, res: VercelResponse) {
  const { projectId, sheetId, items, forceUpdate = false, aiEnabled } = req.body;

  if (!projectId || !sheetId || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'projectId, sheetId, and items are required' });
  }

  const useAI = aiEnabled !== undefined ? aiEnabled : AI_ENABLED;
  console.log(`[classify-all] Processing ${items.length} items (force: ${forceUpdate}, AI: ${useAI ? 'ON' : 'OFF'})`);

  // Filter MAIN items
  const mainItems = items.filter((item: ParsedItem) => {
    const isMain = item.rowRole
      ? (item.rowRole === 'main' || item.rowRole === 'section')
      : isMainCodeHeuristic(item.kod);
    return isMain;
  });

  if (mainItems.length === 0) {
    return res.status(200).json({
      success: true,
      changed: 0,
      unchanged: items.length,
      unknown: 0,
      keptExisting: 0,
      aiEnabled: useAI,
      stats: { total: 0, bySource: {}, byConfidence: {}, unknown: 0 },
      message: 'No main items found',
    });
  }

  // Classify items
  let results;
  if (useAI) {
    const rowpacks = mainItems.map((mainItem: ParsedItem) => {
      const subordinates = extractSubordinates(mainItem, items);
      return buildRowPack(mainItem, subordinates);
    });
    results = await classifyBatch(rowpacks, { maxConcurrent: 5 });
  } else {
    results = classifyBatchRulesOnly(items).filter(r =>
      mainItems.some((m: ParsedItem) => m.id === r.itemId)
    );
  }

  // Process results: keep existing if confidence low
  const itemUpdates = new Map();
  let changedCount = 0;
  let keptExistingCount = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const originalItem = mainItems[i];

    let shouldUpdate = forceUpdate;
    if (!forceUpdate) {
      if (result.confidence === 'high' || result.confidence === 'medium') {
        shouldUpdate = true;
      } else if (result.skupina === 'unknown' || result.confidence === 'low') {
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

  return res.status(200).json({
    success: true,
    changed: changedCount,
    unchanged: items.length - mainItems.length,
    unknown: stats.unknown,
    keptExisting: keptExistingCount,
    aiEnabled: useAI,
    stats,
    results: Array.from(itemUpdates.entries()).map(([itemId, update]) => ({
      itemId,
      ...update,
    })),
  });
}

/**
 * Handler: Record Correction
 * Saves user correction to Memory Store for learning
 */
async function handleRecordCorrection(req: VercelRequest, res: VercelResponse) {
  const { projectId, sheetId, itemId, newSkupina, allItems } = req.body;

  if (!projectId || !itemId || !newSkupina || !allItems) {
    return res.status(400).json({
      error: 'projectId, itemId, newSkupina, and allItems are required',
    });
  }

  const mainItem = allItems.find((item: ParsedItem) => item.id === itemId);
  if (!mainItem) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const isMain = mainItem.rowRole
    ? (mainItem.rowRole === 'main' || mainItem.rowRole === 'section')
    : isMainCodeHeuristic(mainItem.kod);

  if (!isMain) {
    return res.status(400).json({
      error: 'Can only record corrections for main items',
    });
  }

  const subordinates = extractSubordinates(mainItem, allItems);
  const rowpack = buildRowPack(mainItem, subordinates);

  const memoryExample = {
    id: uuidv4(),
    rowpackHash: rowpack.hash,
    mainText: rowpack.main_text,
    childText: rowpack.child_text,
    skupina: newSkupina,
    confirmed: true,
    projectId: projectId,
    createdAt: Date.now(),
    metadata: {
      kod: mainItem.kod,
      confidence: 100,
    },
  };

  storeMemoryExample(memoryExample);

  return res.status(200).json({
    success: true,
    message: 'Correction recorded successfully',
    memoryId: memoryExample.id,
    skupina: newSkupina,
    learned: true,
  });
}

/**
 * Helper: Check if code represents main item
 */
function isMainCodeHeuristic(kod: string): boolean {
  if (!kod) return false;
  const mainPattern = /^\d{6,}$/;
  return mainPattern.test(kod.trim());
}
