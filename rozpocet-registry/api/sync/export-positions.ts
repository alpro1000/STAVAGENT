/**
 * GET /api/sync/export-positions
 *
 * Export positions from Registry in UnifiedPosition format.
 * Used by other kiosks (Monolit, URS, Portal) to fetch Registry data.
 *
 * Query params:
 *   - portalProjectId: UUID of Portal project (required)
 *   - format: 'unified' (default) or 'registry' (native format)
 *
 * Note: In browser-only mode, this endpoint provides the schema/validation.
 * Actual data comes from client's localStorage.
 *
 * @see docs/UNIFICATION_PLAN.md - Phase 2.1
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ExportPositionsResponse, UnifiedPosition } from '../../src/types/unified';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { portalProjectId, format = 'unified' } = req.query;

    // Validate required params
    if (!portalProjectId || typeof portalProjectId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'portalProjectId query parameter is required',
      });
    }

    // In browser-only mode, we return the schema and instructions
    // Client must provide positions via POST to /api/sync/export-positions
    // (which transforms them to unified format)

    // For now, return empty response with schema info
    // In future backend mode, this would query a database

    const response: ExportPositionsResponse = {
      portalProjectId,
      positions: [],
      exportedAt: new Date().toISOString(),
    };

    // Add metadata for client guidance
    return res.status(200).json({
      ...response,
      message: 'Registry uses browser localStorage. Use POST method with positions array to get unified format.',
      schema: {
        id: 'string (UUID)',
        portalProjectId: 'string (UUID)',
        sourceKiosk: "'monolit' | 'urs' | 'registry' | 'core' | 'manual'",
        sourceItemId: 'string',
        code: 'string | null',
        description: 'string (required)',
        quantity: 'number | null',
        unit: 'string | null',
        unitPrice: 'number | null',
        totalPrice: 'number | null',
        category: 'string | null',
        rowRole: "'main' | 'section' | 'subordinate' | 'unknown'",
        confidence: 'number (0-100) | null',
        matchSource: 'string | null',
        source: {
          fileName: 'string',
          sheetName: 'string',
          rowNumber: 'number',
          importedAt: 'string (ISO date)',
        },
      },
    });

  } catch (error) {
    console.error('[SYNC] Export error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

/**
 * POST /api/sync/export-positions
 *
 * Transform Registry positions to UnifiedPosition format.
 * Client sends ParsedItem[] and receives UnifiedPosition[].
 */
export async function POST(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { portalProjectId, items } = req.body;

    if (!portalProjectId) {
      return res.status(400).json({
        success: false,
        error: 'portalProjectId is required',
      });
    }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'items array is required',
      });
    }

    // Transform Registry items to unified format
    const positions: UnifiedPosition[] = items.map((item: any) => ({
      id: item.id,
      portalProjectId,
      sourceKiosk: 'registry' as const,
      sourceItemId: item.id,
      code: item.kod || null,
      description: item.popisFull || item.popis || '',
      quantity: item.mnozstvi ?? null,
      unit: item.mj || null,
      unitPrice: item.cenaJednotkova ?? null,
      totalPrice: item.cenaCelkem ?? null,
      category: item.skupina || null,
      rowRole: item.rowRole || 'unknown',
      confidence: mapConfidenceToNumber(item.classificationConfidence),
      matchSource: item.skupinaSuggested ? 'ai' : item.skupina ? 'manual' : null,
      source: {
        fileName: item.source?.fileName,
        sheetName: item.source?.sheetName,
        rowNumber: item.source?.rowStart,
        importedAt: new Date().toISOString(),
      },
    }));

    const response: ExportPositionsResponse = {
      portalProjectId,
      positions,
      exportedAt: new Date().toISOString(),
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('[SYNC] Export transform error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

// Helper function
function mapConfidenceToNumber(
  confidence?: 'high' | 'medium' | 'low'
): number | null {
  switch (confidence) {
    case 'high': return 90;
    case 'medium': return 60;
    case 'low': return 30;
    default: return null;
  }
}
