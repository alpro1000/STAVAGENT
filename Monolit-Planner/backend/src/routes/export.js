/**
 * Export routes with server-side storage
 * GET /api/export/xlsx - Download as browser download
 * POST /api/export/save - Save to server
 * GET /api/export/list - List all saved exports
 * GET /api/export/download/:filename - Download saved export
 * DELETE /api/export/:filename - Delete saved export
 */

import express from 'express';
import db from '../db/init.js';
import { calculatePositions, calculateKPI } from '../services/calculator.js';
import { exportToXLSX, getExportsList, getExportFile, deleteExportFile } from '../services/exporter.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Custom error class for 404 responses
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 404;
  }
}

// Helper function to fetch and calculate positions
async function getCalculatedPositions(bridge_id) {
  // Get positions (async/await for PostgreSQL)
  const positions = await db.prepare(`
    SELECT * FROM positions WHERE bridge_id = ?
  `).all(bridge_id);

  if (positions.length === 0) {
    throw new NotFoundError(`Žádné pozice pro most "${bridge_id}". Přidejte pozice před exportem.`);
  }

  // Get bridge metadata (async/await for PostgreSQL)
  const bridge = await db.prepare(`
    SELECT * FROM bridges WHERE bridge_id = ?
  `).get(bridge_id);

  // Get config (async/await for PostgreSQL)
  const configRow = await db.prepare(`
    SELECT defaults, days_per_month_mode FROM project_config WHERE id = 1
  `).get();

  const config = {
    defaults: typeof configRow.defaults === 'string' ? JSON.parse(configRow.defaults) : configRow.defaults,
    days_per_month_mode: configRow.days_per_month_mode
  };

  // Calculate
  const calculatedPositions = calculatePositions(positions, config);
  const header_kpi = calculateKPI(calculatedPositions, {
    span_length_m: bridge?.span_length_m,
    deck_width_m: bridge?.deck_width_m,
    pd_weeks: bridge?.pd_weeks,
    days_per_month_mode: config.days_per_month_mode
  }, config);

  return { calculatedPositions, header_kpi };
}

// GET export XLSX (direct download to browser)
router.get('/xlsx', async (req, res) => {
  try {
    const { bridge_id } = req.query;

    if (!bridge_id) {
      return res.status(400).json({ error: 'bridge_id query parameter is required' });
    }

    const { calculatedPositions, header_kpi } = await getCalculatedPositions(bridge_id);

    // Generate XLSX (don't save to server)
    const { buffer } = await exportToXLSX(calculatedPositions, header_kpi, bridge_id, false);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="monolit_${bridge_id}_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    logger.error('XLSX export error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
});

// POST save XLSX to server
router.post('/save', async (req, res) => {
  try {
    const { bridge_id } = req.query;

    if (!bridge_id) {
      return res.status(400).json({ error: 'bridge_id query parameter is required' });
    }

    const { calculatedPositions, header_kpi } = await getCalculatedPositions(bridge_id);

    // Generate and save XLSX
    const { filename, buffer } = await exportToXLSX(calculatedPositions, header_kpi, bridge_id, true);

    res.json({
      success: true,
      message: `Export saved to server`,
      filename: filename,
      size: Math.round(buffer.length / 1024) // KB
    });
  } catch (error) {
    logger.error('XLSX save error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message });
  }
});

// GET list of saved exports
router.get('/list', (req, res) => {
  try {
    const exports = getExportsList();
    res.json({ exports });
  } catch (error) {
    logger.error('List exports error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET download saved export
router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    const buffer = getExportFile(filename);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    logger.error('Download export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE saved export
router.delete('/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    deleteExportFile(filename);

    res.json({
      success: true,
      message: `Export deleted: ${filename}`
    });
  } catch (error) {
    logger.error('Delete export error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
