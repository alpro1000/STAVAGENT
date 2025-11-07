/**
 * Export routes
 * GET /api/export/xlsx - Export to XLSX
 * GET /api/export/csv - Export to CSV
 */

import express from 'express';
import db from '../db/init.js';
import { calculatePositions, calculateKPI } from '../services/calculator.js';
import { exportToXLSX, exportToCSV } from '../services/exporter.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET export XLSX
router.get('/xlsx', async (req, res) => {
  try {
    const { bridge_id } = req.query;

    if (!bridge_id) {
      return res.status(400).json({ error: 'bridge_id query parameter is required' });
    }

    // Get positions
    const positions = db.prepare(`
      SELECT * FROM positions WHERE bridge_id = ?
    `).all(bridge_id);

    if (positions.length === 0) {
      return res.status(404).json({ error: 'No positions found for this bridge' });
    }

    // Get bridge metadata
    const bridge = db.prepare(`
      SELECT * FROM bridges WHERE bridge_id = ?
    `).get(bridge_id);

    // Get config
    const configRow = db.prepare(`
      SELECT defaults, days_per_month_mode FROM project_config WHERE id = 1
    `).get();

    const config = {
      defaults: JSON.parse(configRow.defaults),
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

    // Generate XLSX
    const buffer = await exportToXLSX(calculatedPositions, header_kpi, bridge_id);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="monolit_${bridge_id}_${Date.now()}.xlsx"`);

    res.send(buffer);
  } catch (error) {
    logger.error('XLSX export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET export CSV
router.get('/csv', async (req, res) => {
  try {
    const { bridge_id, delimiter = ';' } = req.query;

    if (!bridge_id) {
      return res.status(400).json({ error: 'bridge_id query parameter is required' });
    }

    // Get positions
    const positions = db.prepare(`
      SELECT * FROM positions WHERE bridge_id = ?
    `).all(bridge_id);

    if (positions.length === 0) {
      return res.status(404).json({ error: 'No positions found for this bridge' });
    }

    // Get config
    const configRow = db.prepare(`
      SELECT defaults, days_per_month_mode FROM project_config WHERE id = 1
    `).get();

    const config = {
      defaults: JSON.parse(configRow.defaults),
      days_per_month_mode: configRow.days_per_month_mode
    };

    // Calculate
    const calculatedPositions = calculatePositions(positions, config);

    // Generate CSV
    const csvContent = exportToCSV(calculatedPositions, delimiter);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="monolit_${bridge_id}_${Date.now()}.csv"`);

    // Add BOM for Excel UTF-8 compatibility
    res.send('\uFEFF' + csvContent);
  } catch (error) {
    logger.error('CSV export error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
