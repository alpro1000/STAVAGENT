/**
 * POST /api/sync/import-positions
 *
 * Import positions from other kiosks (Monolit, URS, CORE) into Registry.
 * Positions are converted from UnifiedPosition format to Registry's ParsedItem.
 *
 * @see docs/UNIFICATION_PLAN.md - Phase 2.1
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  ImportPositionsRequest,
  ImportPositionsResponse,
  UnifiedPosition,
  KioskType,
} from '../../src/types/unified';

// Validate kiosk type
const VALID_KIOSKS: KioskType[] = ['monolit', 'urs', 'registry', 'core', 'manual'];

// Validate merge strategy
const VALID_STRATEGIES = ['append', 'replace', 'merge'] as const;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as ImportPositionsRequest;

    // Validate required fields
    if (!body.portalProjectId) {
      return res.status(400).json({
        success: false,
        error: 'portalProjectId is required',
      });
    }

    if (!body.positions || !Array.isArray(body.positions)) {
      return res.status(400).json({
        success: false,
        error: 'positions array is required',
      });
    }

    if (!body.source || !VALID_KIOSKS.includes(body.source)) {
      return res.status(400).json({
        success: false,
        error: `source must be one of: ${VALID_KIOSKS.join(', ')}`,
      });
    }

    const mergeStrategy = body.mergeStrategy || 'append';
    if (!VALID_STRATEGIES.includes(mergeStrategy)) {
      return res.status(400).json({
        success: false,
        error: `mergeStrategy must be one of: ${VALID_STRATEGIES.join(', ')}`,
      });
    }

    // Validate each position has required fields
    const errors: string[] = [];
    const validPositions: UnifiedPosition[] = [];

    for (let i = 0; i < body.positions.length; i++) {
      const pos = body.positions[i];

      if (!pos.id) {
        errors.push(`Position ${i}: missing id`);
        continue;
      }

      if (!pos.description) {
        errors.push(`Position ${i}: missing description`);
        continue;
      }

      // Ensure required fields have defaults
      validPositions.push({
        ...pos,
        portalProjectId: body.portalProjectId,
        sourceKiosk: body.source,
        sourceItemId: pos.sourceItemId || pos.id,
        code: pos.code || null,
        quantity: pos.quantity ?? null,
        unit: pos.unit || null,
        unitPrice: pos.unitPrice ?? null,
        totalPrice: pos.totalPrice ?? null,
        category: pos.category || null,
        rowRole: pos.rowRole || 'unknown',
        confidence: pos.confidence ?? null,
        matchSource: pos.matchSource || body.source,
        source: pos.source || {
          importedAt: new Date().toISOString(),
        },
      });
    }

    // Note: In browser-only mode, Registry stores data in localStorage
    // This API validates and returns the transformed data for client-side storage
    // In a future version with backend, this would write to a database

    const response: ImportPositionsResponse = {
      success: true,
      imported: validPositions.length,
      updated: 0, // Would be non-zero with merge strategy in backend mode
      skipped: body.positions.length - validPositions.length,
      errors: errors.length > 0 ? errors : undefined,
    };

    // Return the validated positions so client can store them
    return res.status(200).json({
      ...response,
      positions: validPositions,
    });

  } catch (error) {
    console.error('[SYNC] Import error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
