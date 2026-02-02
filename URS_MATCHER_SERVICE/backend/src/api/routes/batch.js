/**
 * Batch URS Matcher API Routes
 *
 * Endpoints:
 * - POST   /api/batch/create         - Create new batch job
 * - POST   /api/batch/:id/start      - Start processing batch
 * - POST   /api/batch/:id/pause      - Pause batch processing
 * - POST   /api/batch/:id/resume     - Resume paused batch
 * - GET    /api/batch/:id/status     - Get batch status and progress
 * - GET    /api/batch/:id/results    - Get batch results
 * - GET    /api/batch/:id/export/xlsx - Export results to Excel
 *
 * @module api/routes/batch
 */

import express from 'express';
import { logger } from '../../utils/logger.js';
import batchProcessor from '../../services/batch/batchProcessor.js';
import batchExcelExporter from '../../services/batch/batchExcelExporter.js';

const router = express.Router();

// ============================================================================
// POST /api/batch/create
// Create new batch job
// ============================================================================

router.post('/create', async (req, res) => {
  const startTime = Date.now();

  try {
    const { name, items, settings, portalProjectId } = req.body;

    // Validation
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "name" field'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid "items" array (must have at least 1 item)'
      });
    }

    // Validate each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.text || typeof item.text !== 'string') {
        return res.status(400).json({
          error: `Item ${i}: missing or invalid "text" field`
        });
      }
    }

    // Default settings
    const defaultSettings = {
      candidatesPerWork: 4,
      maxSubWorks: 5,
      searchDepth: 'normal',
      language: 'cs'
    };

    const mergedSettings = { ...defaultSettings, ...settings };

    logger.info(`[BatchAPI] POST /api/batch/create: name="${name}", items=${items.length}`);

    // Create batch job
    const result = await batchProcessor.createBatchJob({
      name: name,
      items: items,
      settings: mergedSettings,
      portalProjectId: portalProjectId || null
    });

    const elapsed = Date.now() - startTime;
    logger.info(`[BatchAPI] Batch job created: ${result.batchId} (${elapsed}ms)`);

    return res.status(201).json({
      success: true,
      data: result,
      timing: { totalMs: elapsed }
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(`[BatchAPI] POST /api/batch/create error: ${error.message}`);

    return res.status(500).json({
      error: error.message,
      timing: { totalMs: elapsed }
    });
  }
});

// ============================================================================
// POST /api/batch/:id/start
// Start processing batch
// ============================================================================

router.post('/:id/start', async (req, res) => {
  const startTime = Date.now();
  const batchId = req.params.id;

  try {
    logger.info(`[BatchAPI] POST /api/batch/${batchId}/start`);

    // Start batch processing (non-blocking - runs in background)
    // Don't await - return immediately
    batchProcessor.startBatchJob(batchId).catch(error => {
      logger.error(`[BatchAPI] Batch job ${batchId} background error: ${error.message}`);
    });

    const elapsed = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      message: 'Batch processing started',
      batchId: batchId,
      timing: { totalMs: elapsed }
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(`[BatchAPI] POST /api/batch/${batchId}/start error: ${error.message}`);

    return res.status(500).json({
      error: error.message,
      timing: { totalMs: elapsed }
    });
  }
});

// ============================================================================
// POST /api/batch/:id/pause
// Pause batch processing
// ============================================================================

router.post('/:id/pause', async (req, res) => {
  const startTime = Date.now();
  const batchId = req.params.id;

  try {
    logger.info(`[BatchAPI] POST /api/batch/${batchId}/pause`);

    await batchProcessor.pauseBatchJob(batchId);

    const elapsed = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      message: 'Batch processing paused',
      batchId: batchId,
      timing: { totalMs: elapsed }
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(`[BatchAPI] POST /api/batch/${batchId}/pause error: ${error.message}`);

    return res.status(500).json({
      error: error.message,
      timing: { totalMs: elapsed }
    });
  }
});

// ============================================================================
// POST /api/batch/:id/resume
// Resume paused batch
// ============================================================================

router.post('/:id/resume', async (req, res) => {
  const startTime = Date.now();
  const batchId = req.params.id;

  try {
    logger.info(`[BatchAPI] POST /api/batch/${batchId}/resume`);

    // Resume batch processing (non-blocking - runs in background)
    // Don't await - return immediately
    batchProcessor.resumeBatchJob(batchId).catch(error => {
      logger.error(`[BatchAPI] Batch job ${batchId} resume error: ${error.message}`);
    });

    const elapsed = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      message: 'Batch processing resumed',
      batchId: batchId,
      timing: { totalMs: elapsed }
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(`[BatchAPI] POST /api/batch/${batchId}/resume error: ${error.message}`);

    return res.status(500).json({
      error: error.message,
      timing: { totalMs: elapsed }
    });
  }
});

// ============================================================================
// GET /api/batch/:id/status
// Get batch status and progress
// ============================================================================

router.get('/:id/status', async (req, res) => {
  const startTime = Date.now();
  const batchId = req.params.id;

  try {
    logger.debug(`[BatchAPI] GET /api/batch/${batchId}/status`);

    const status = await batchProcessor.getBatchJobStatus(batchId);

    const elapsed = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      data: status,
      timing: { totalMs: elapsed }
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(`[BatchAPI] GET /api/batch/${batchId}/status error: ${error.message}`);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: error.message,
        timing: { totalMs: elapsed }
      });
    }

    return res.status(500).json({
      error: error.message,
      timing: { totalMs: elapsed }
    });
  }
});

// ============================================================================
// GET /api/batch/:id/results
// Get batch results
// ============================================================================

router.get('/:id/results', async (req, res) => {
  const startTime = Date.now();
  const batchId = req.params.id;

  try {
    logger.info(`[BatchAPI] GET /api/batch/${batchId}/results`);

    const results = await batchProcessor.getBatchJobResults(batchId);

    const elapsed = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      data: results,
      timing: { totalMs: elapsed }
    });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(`[BatchAPI] GET /api/batch/${batchId}/results error: ${error.message}`);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: error.message,
        timing: { totalMs: elapsed }
      });
    }

    return res.status(500).json({
      error: error.message,
      timing: { totalMs: elapsed }
    });
  }
});

// ============================================================================
// GET /api/batch/:id/export/xlsx
// Export results to Excel
// ============================================================================

router.get('/:id/export/xlsx', async (req, res) => {
  const startTime = Date.now();
  const batchId = req.params.id;

  try {
    logger.info(`[BatchAPI] GET /api/batch/${batchId}/export/xlsx`);

    // Get batch results
    const batchData = await batchProcessor.getBatchJobResults(batchId);

    // Generate Excel file
    const excelBuffer = await batchExcelExporter.exportToExcel(batchData);

    const elapsed = Date.now() - startTime;
    logger.info(`[BatchAPI] Excel export complete: ${batchData.batchId}, ${excelBuffer.length} bytes, ${elapsed}ms`);

    // Set headers for file download
    const filename = `batch_${batchData.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    return res.send(excelBuffer);

  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(`[BatchAPI] GET /api/batch/${batchId}/export/xlsx error: ${error.message}`);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: error.message,
        timing: { totalMs: elapsed }
      });
    }

    return res.status(500).json({
      error: error.message,
      timing: { totalMs: elapsed }
    });
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

export default router;
