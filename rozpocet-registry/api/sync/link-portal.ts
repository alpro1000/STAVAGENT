/**
 * POST /api/sync/link-portal
 *
 * Link a Registry project to a Portal project.
 * This creates the association between Registry's local project
 * and the centralized Portal project.
 *
 * Note: In browser-only mode, actual linking is done client-side.
 * This endpoint validates the request and returns confirmation.
 *
 * @see docs/UNIFICATION_PLAN.md - Phase 2.1
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface LinkPortalRequest {
  portalProjectId: string;
  registryProjectId: string;
  portalProjectName?: string;
}

interface LinkPortalResponse {
  success: boolean;
  linked: boolean;
  portalProjectId: string;
  registryProjectId: string;
  linkedAt: string;
  message?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle unlink (DELETE)
  if (req.method === 'DELETE') {
    return handleUnlink(req, res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body as LinkPortalRequest;

    // Validate required fields
    if (!body.portalProjectId) {
      return res.status(400).json({
        success: false,
        error: 'portalProjectId is required',
      });
    }

    if (!body.registryProjectId) {
      return res.status(400).json({
        success: false,
        error: 'registryProjectId is required',
      });
    }

    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(body.portalProjectId)) {
      return res.status(400).json({
        success: false,
        error: 'portalProjectId must be a valid UUID',
      });
    }

    // In browser-only mode, actual linking happens client-side
    // This endpoint validates and confirms the link request
    // In future backend mode, this would update a database

    const response: LinkPortalResponse = {
      success: true,
      linked: true,
      portalProjectId: body.portalProjectId,
      registryProjectId: body.registryProjectId,
      linkedAt: new Date().toISOString(),
      message: 'Link request validated. Apply to localStorage on client.',
    };

    // Notify Portal about the link (future implementation)
    // await notifyPortal(body.portalProjectId, 'registry', body.registryProjectId);

    return res.status(200).json(response);

  } catch (error) {
    console.error('[SYNC] Link error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

/**
 * Handle unlink (DELETE) request
 */
async function handleUnlink(req: VercelRequest, res: VercelResponse) {
  try {
    const { portalProjectId, registryProjectId } = req.query;

    if (!portalProjectId || !registryProjectId) {
      return res.status(400).json({
        success: false,
        error: 'portalProjectId and registryProjectId query params are required',
      });
    }

    // Validate and confirm unlink
    return res.status(200).json({
      success: true,
      unlinked: true,
      portalProjectId,
      registryProjectId,
      unlinkedAt: new Date().toISOString(),
      message: 'Unlink request validated. Apply to localStorage on client.',
    });

  } catch (error) {
    console.error('[SYNC] Unlink error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
