/**
 * API Endpoint: Record Skupina Correction
 * Saves user corrections to Memory Store for learning
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ParsedItem, MemoryExample } from './agent/types';
import { buildRowPack, extractSubordinates } from './agent/rowpack';
import { storeMemoryExample } from './agent/memory';
import { v4 as uuidv4 } from 'uuid';

interface RecordCorrectionRequest {
  projectId: string;
  sheetId: string;
  itemId: string;
  newSkupina: string;
  allItems: ParsedItem[]; // Needed to extract subordinates
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
    const { projectId, sheetId, itemId, newSkupina, allItems } = req.body as RecordCorrectionRequest;

    if (!projectId || !itemId || !newSkupina || !allItems) {
      return res.status(400).json({
        error: 'projectId, itemId, newSkupina, and allItems are required',
      });
    }

    console.log(`[record-correction] Recording correction for item ${itemId}: ${newSkupina}`);

    // Find the corrected item
    const mainItem = allItems.find(item => item.id === itemId);
    if (!mainItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Verify it's a main item
    const isMain = mainItem.rowRole
      ? (mainItem.rowRole === 'main' || mainItem.rowRole === 'section')
      : isMainCodeHeuristic(mainItem.kod);

    if (!isMain) {
      return res.status(400).json({
        error: 'Can only record corrections for main items',
      });
    }

    // Build rowpack (for context)
    const subordinates = extractSubordinates(mainItem, allItems);
    const rowpack = buildRowPack(mainItem, subordinates);

    // Create memory example
    const memoryExample: MemoryExample = {
      id: uuidv4(),
      rowpackHash: rowpack.hash,
      mainText: rowpack.main_text,
      childText: rowpack.child_text,
      skupina: newSkupina,
      confirmed: true, // User correction = confirmed
      projectId: projectId,
      createdAt: Date.now(),
      metadata: {
        kod: mainItem.kod,
        confidence: 100, // User correction = 100% confidence
      },
    };

    // Store in memory
    storeMemoryExample(memoryExample);

    console.log(`[record-correction] Stored correction: ${newSkupina} (hash: ${rowpack.hash.substring(0, 8)}...)`);

    return res.status(200).json({
      success: true,
      message: 'Correction recorded successfully',
      memoryId: memoryExample.id,
      skupina: newSkupina,
      learned: true,
    });

  } catch (error) {
    console.error('[record-correction] Error:', error);
    return res.status(500).json({
      error: 'Failed to record correction',
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
