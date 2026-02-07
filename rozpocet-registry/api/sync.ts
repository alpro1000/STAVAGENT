/**
 * Unified Sync API Endpoint
 *
 * Consolidates all sync operations into a single serverless function
 * to stay within Vercel Hobby plan limits (12 functions max).
 *
 * Routes based on ?action= query parameter:
 *   - import-positions: Import positions from other kiosks
 *   - export-positions: Export positions to unified format
 *   - link-portal: Link Registry project to Portal
 *
 * @see docs/UNIFICATION_PLAN.md - Phase 2.1
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Types
type KioskType = 'monolit' | 'urs' | 'registry' | 'core' | 'manual';
type MergeStrategy = 'append' | 'replace' | 'merge';

interface UnifiedPosition {
  id: string;
  portalProjectId: string;
  sourceKiosk: KioskType;
  sourceItemId: string;
  code: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  category: string | null;
  rowRole: 'main' | 'section' | 'subordinate' | 'unknown';
  confidence: number | null;
  matchSource: string | null;
  source: {
    fileName?: string;
    sheetName?: string;
    rowNumber?: number;
    importedAt: string;
  };
}

const VALID_KIOSKS: KioskType[] = ['monolit', 'urs', 'registry', 'core', 'manual'];
const VALID_STRATEGIES: MergeStrategy[] = ['append', 'replace', 'merge'];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const action = req.query.action as string;

  if (!action) {
    return res.status(400).json({
      error: 'Missing action parameter',
      availableActions: ['import-positions', 'export-positions', 'link-portal'],
    });
  }

  try {
    switch (action) {
      case 'import-positions':
        return handleImportPositions(req, res);
      case 'export-positions':
        return handleExportPositions(req, res);
      case 'link-portal':
        return handleLinkPortal(req, res);
      default:
        return res.status(400).json({
          error: `Unknown action: ${action}`,
          availableActions: ['import-positions', 'export-positions', 'link-portal'],
        });
    }
  } catch (error) {
    console.error('[SYNC] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

// ============================================================================
// IMPORT POSITIONS
// ============================================================================

async function handleImportPositions(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const body = req.body as {
    portalProjectId: string;
    positions: UnifiedPosition[];
    source: KioskType;
    mergeStrategy?: MergeStrategy;
  };

  // Validate required fields
  if (!body.portalProjectId) {
    return res.status(400).json({ success: false, error: 'portalProjectId is required' });
  }

  if (!body.positions || !Array.isArray(body.positions)) {
    return res.status(400).json({ success: false, error: 'positions array is required' });
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

  // Validate and normalize positions
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
      source: pos.source || { importedAt: new Date().toISOString() },
    });
  }

  return res.status(200).json({
    success: true,
    imported: validPositions.length,
    updated: 0,
    skipped: body.positions.length - validPositions.length,
    errors: errors.length > 0 ? errors : undefined,
    positions: validPositions,
  });
}

// ============================================================================
// EXPORT POSITIONS
// ============================================================================

async function handleExportPositions(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const portalProjectId = req.query.portalProjectId as string;

    if (!portalProjectId) {
      return res.status(400).json({
        success: false,
        error: 'portalProjectId query parameter is required',
      });
    }

    // In browser-only mode, return schema info
    return res.status(200).json({
      portalProjectId,
      positions: [],
      exportedAt: new Date().toISOString(),
      message: 'Registry uses browser localStorage. Use POST with items array to transform to unified format.',
    });
  }

  if (req.method === 'POST') {
    const { portalProjectId, items } = req.body;

    if (!portalProjectId) {
      return res.status(400).json({ success: false, error: 'portalProjectId is required' });
    }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'items array is required' });
    }

    // Transform Registry items to unified format
    const positions: UnifiedPosition[] = items.map((item: Record<string, unknown>) => ({
      id: item.id as string,
      portalProjectId,
      sourceKiosk: 'registry' as const,
      sourceItemId: item.id as string,
      code: (item.kod as string) || null,
      description: (item.popisFull as string) || (item.popis as string) || '',
      quantity: (item.mnozstvi as number) ?? null,
      unit: (item.mj as string) || null,
      unitPrice: (item.cenaJednotkova as number) ?? null,
      totalPrice: (item.cenaCelkem as number) ?? null,
      category: (item.skupina as string) || null,
      rowRole: (item.rowRole as 'main' | 'section' | 'subordinate' | 'unknown') || 'unknown',
      confidence: mapConfidenceToNumber(item.classificationConfidence as 'high' | 'medium' | 'low' | undefined),
      matchSource: item.skupinaSuggested ? 'ai' : item.skupina ? 'manual' : null,
      source: {
        fileName: (item.source as Record<string, unknown>)?.fileName as string | undefined,
        sheetName: (item.source as Record<string, unknown>)?.sheetName as string | undefined,
        rowNumber: (item.source as Record<string, unknown>)?.rowStart as number | undefined,
        importedAt: new Date().toISOString(),
      },
    }));

    return res.status(200).json({
      portalProjectId,
      positions,
      exportedAt: new Date().toISOString(),
    });
  }

  return res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
}

// ============================================================================
// LINK PORTAL
// ============================================================================

async function handleLinkPortal(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'DELETE') {
    const { portalProjectId, registryProjectId } = req.query;

    if (!portalProjectId || !registryProjectId) {
      return res.status(400).json({
        success: false,
        error: 'portalProjectId and registryProjectId query params are required',
      });
    }

    return res.status(200).json({
      success: true,
      unlinked: true,
      portalProjectId,
      registryProjectId,
      unlinkedAt: new Date().toISOString(),
      message: 'Unlink request validated. Apply to localStorage on client.',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST or DELETE.' });
  }

  const body = req.body as {
    portalProjectId: string;
    registryProjectId: string;
    portalProjectName?: string;
  };

  if (!body.portalProjectId) {
    return res.status(400).json({ success: false, error: 'portalProjectId is required' });
  }

  if (!body.registryProjectId) {
    return res.status(400).json({ success: false, error: 'registryProjectId is required' });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(body.portalProjectId)) {
    return res.status(400).json({ success: false, error: 'portalProjectId must be a valid UUID' });
  }

  return res.status(200).json({
    success: true,
    linked: true,
    portalProjectId: body.portalProjectId,
    registryProjectId: body.registryProjectId,
    linkedAt: new Date().toISOString(),
    message: 'Link request validated. Apply to localStorage on client.',
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function mapConfidenceToNumber(confidence?: 'high' | 'medium' | 'low'): number | null {
  switch (confidence) {
    case 'high': return 90;
    case 'medium': return 60;
    case 'low': return 30;
    default: return null;
  }
}
