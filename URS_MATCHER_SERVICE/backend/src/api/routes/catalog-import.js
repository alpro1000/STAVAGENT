/**
 * Catalog Import Management API
 *
 * Endpoints for automated, versioned URS catalog imports with approval workflow
 *
 * Routes:
 * - GET  /api/catalog/status          - Current catalog status & health
 * - POST /api/catalog/import          - Start new import
 * - GET  /api/catalog/versions        - List all versions
 * - GET  /api/catalog/versions/:id    - Get version details
 * - POST /api/catalog/versions/:id/approve  - Approve pending version
 * - POST /api/catalog/versions/:id/reject   - Reject pending version
 * - POST /api/catalog/rollback/:id    - Rollback to previous version
 * - GET  /api/catalog/audit-log       - View import audit trail
 * - GET  /api/catalog/health-check    - Health check
 */

import express from 'express';
import { importService } from '../../services/catalogImportService.js';
import { logger } from '../../utils/logger.js';
import { getDatabase } from '../../db/init.js';

const router = express.Router();

// ============================================================================
// GET /api/catalog/status - Current Status
// ============================================================================

router.get('/status', async (req, res) => {
  try {
    const status = await importService.getStatus();
    res.json({
      status: 'ok',
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`[CATALOG-API] Status error: ${error.message}`);
    res.status(500).json({
      error: 'Failed to get catalog status',
      message: error.message
    });
  }
});

// ============================================================================
// POST /api/catalog/import - Start Import
// ============================================================================

router.post('/import', async (req, res) => {
  try {
    const { source, source_path, auto_approve } = req.body;

    if (!source) {
      return res.status(400).json({ error: 'Missing required field: source' });
    }

    logger.info(`[CATALOG-API] Starting import from: ${source}`);

    const result = await importService.importFromLicensedSource({
      source,
      path: source_path,
      autoApprove: auto_approve || false
    });

    res.status(202).json({
      status: 'import_started',
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[CATALOG-API] Import error: ${error.message}`);
    res.status(400).json({
      error: 'Import failed',
      message: error.message
    });
  }
});

// ============================================================================
// GET /api/catalog/versions - List Versions
// ============================================================================

router.get('/versions', async (req, res) => {
  try {
    const db = await getDatabase();
    const { status } = req.query;

    let query = 'SELECT * FROM catalog_versions ORDER BY created_at DESC';
    const params = [];

    if (status) {
      query = 'SELECT * FROM catalog_versions WHERE status = ? ORDER BY created_at DESC';
      params.push(status);
    }

    const versions = await db.all(query, params);

    res.json({
      status: 'ok',
      count: versions.length,
      data: versions,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[CATALOG-API] List versions error: ${error.message}`);
    res.status(500).json({
      error: 'Failed to list versions',
      message: error.message
    });
  }
});

// ============================================================================
// GET /api/catalog/versions/:id - Version Details
// ============================================================================

router.get('/versions/:id', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;

    const version = await db.get(
      'SELECT * FROM catalog_versions WHERE version_id = ?',
      [id]
    );

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Parse JSON fields
    if (version.stats) version.stats = JSON.parse(version.stats);
    if (version.validation_details) version.validation_details = JSON.parse(version.validation_details);
    if (version.source_info) version.source_info = JSON.parse(version.source_info);

    res.json({
      status: 'ok',
      data: version,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[CATALOG-API] Get version error: ${error.message}`);
    res.status(500).json({
      error: 'Failed to get version',
      message: error.message
    });
  }
});

// ============================================================================
// POST /api/catalog/versions/:id/approve - Approve Version
// ============================================================================

router.post('/versions/:id/approve', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { notes } = req.body;

    // Verify version exists and is pending
    const version = await db.get(
      'SELECT * FROM catalog_versions WHERE version_id = ? AND status = ?',
      [id, 'pending']
    );

    if (!version) {
      return res.status(404).json({ error: 'Pending version not found' });
    }

    // Get validation score
    const stats = version.validation_details ? JSON.parse(version.validation_details) : {};
    const validationScore = version.validation_score || 0;

    // Warn if score is low
    if (validationScore < 70) {
      logger.warn(`[CATALOG-API] Approving version with low score: ${validationScore}`);
    }

    // Approve and activate
    await importService.versionManager.approveVersion(id, notes || 'Manual approval via API');

    res.json({
      status: 'approved_and_activated',
      data: {
        version_id: id,
        approved_at: new Date().toISOString(),
        validation_score: validationScore
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[CATALOG-API] Approve error: ${error.message}`);
    res.status(400).json({
      error: 'Failed to approve version',
      message: error.message
    });
  }
});

// ============================================================================
// POST /api/catalog/versions/:id/reject - Reject Version
// ============================================================================

router.post('/versions/:id/reject', async (req, res) => {
  try {
    const db = await getDatabase();
    const { id } = req.params;
    const { reason } = req.body;

    // Verify version exists and is pending
    const version = await db.get(
      'SELECT * FROM catalog_versions WHERE version_id = ? AND status = ?',
      [id, 'pending']
    );

    if (!version) {
      return res.status(404).json({ error: 'Pending version not found' });
    }

    // Reject
    await importService.versionManager.rejectVersion(id, reason || 'Manual rejection via API');

    res.json({
      status: 'rejected',
      data: {
        version_id: id,
        rejected_at: new Date().toISOString(),
        reason: reason || 'No reason provided'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[CATALOG-API] Reject error: ${error.message}`);
    res.status(400).json({
      error: 'Failed to reject version',
      message: error.message
    });
  }
});

// ============================================================================
// POST /api/catalog/rollback/:id - Rollback to Version
// ============================================================================

router.post('/rollback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    logger.warn(`[CATALOG-API] Rollback requested to version: ${id}`);

    // Verify version exists and was previously active
    const db = await getDatabase();
    const version = await db.get(
      'SELECT * FROM catalog_versions WHERE version_id = ?',
      [id]
    );

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Perform rollback
    await importService.versionManager.rollbackToVersion(id);

    res.json({
      status: 'rollback_started',
      data: {
        version_id: id,
        rollback_started_at: new Date().toISOString(),
        reason: reason || 'Manual rollback via API'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[CATALOG-API] Rollback error: ${error.message}`);
    res.status(400).json({
      error: 'Rollback failed',
      message: error.message
    });
  }
});

// ============================================================================
// GET /api/catalog/audit-log - Audit Trail
// ============================================================================

router.get('/audit-log', async (req, res) => {
  try {
    const { limit } = req.query;
    const auditLog = await importService.getAuditLog(limit ? parseInt(limit) : 50);

    // Parse JSON details
    const parsed = auditLog.map(entry => ({
      ...entry,
      details: entry.details ? JSON.parse(entry.details) : null
    }));

    res.json({
      status: 'ok',
      count: parsed.length,
      data: parsed,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[CATALOG-API] Audit log error: ${error.message}`);
    res.status(500).json({
      error: 'Failed to get audit log',
      message: error.message
    });
  }
});

// ============================================================================
// GET /api/catalog/health-check - Health Check
// ============================================================================

router.get('/health-check', async (req, res) => {
  try {
    const health = await importService.healthCheck.check();

    const statusCode = health.status === 'healthy' ? 200 : (health.status === 'degraded' ? 200 : 503);

    res.status(statusCode).json({
      status: health.status,
      data: health,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[CATALOG-API] Health check error: ${error.message}`);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================================
// GET /api/catalog/pending-approvals - Pending Approvals
// ============================================================================

router.get('/pending-approvals', async (req, res) => {
  try {
    const pending = await importService.getPendingApprovals();

    // Parse stats
    const parsed = pending.map(v => ({
      ...v,
      stats: v.stats ? JSON.parse(v.stats) : null
    }));

    res.json({
      status: 'ok',
      count: parsed.length,
      data: parsed,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[CATALOG-API] Pending approvals error: ${error.message}`);
    res.status(500).json({
      error: 'Failed to get pending approvals',
      message: error.message
    });
  }
});

export default router;
