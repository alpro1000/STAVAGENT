/**
 * Bridges routes
 * GET /api/bridges - List all bridges with summary
 */

import express from 'express';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET all bridges with summary
router.get('/', (req, res) => {
  try {
    const bridges = db.prepare(`
      SELECT
        bridge_id,
        span_length_m,
        deck_width_m,
        pd_weeks,
        created_at,
        updated_at
      FROM bridges
      ORDER BY bridge_id
    `).all();

    // Get aggregated data for each bridge
    const bridgesWithStats = bridges.map(bridge => {
      const stats = db.prepare(`
        SELECT
          COUNT(*) as element_count,
          SUM(CASE WHEN subtype = 'beton' THEN concrete_m3 ELSE 0 END) as concrete_m3,
          SUM(kros_total_czk) as sum_kros_czk
        FROM positions
        WHERE bridge_id = ?
      `).get(bridge.bridge_id);

      return {
        ...bridge,
        element_count: stats.element_count || 0,
        concrete_m3: stats.concrete_m3 || 0,
        sum_kros_czk: stats.sum_kros_czk || 0
      };
    });

    res.json(bridgesWithStats);
  } catch (error) {
    logger.error('Error fetching bridges:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single bridge
router.get('/:bridge_id', (req, res) => {
  try {
    const { bridge_id } = req.params;

    const bridge = db.prepare(`
      SELECT * FROM bridges WHERE bridge_id = ?
    `).get(bridge_id);

    if (!bridge) {
      return res.status(404).json({ error: 'Bridge not found' });
    }

    // Get stats
    const stats = db.prepare(`
      SELECT
        COUNT(*) as element_count,
        SUM(CASE WHEN subtype = 'beton' THEN concrete_m3 ELSE 0 END) as concrete_m3,
        SUM(kros_total_czk) as sum_kros_czk
      FROM positions
      WHERE bridge_id = ?
    `).get(bridge_id);

    res.json({
      ...bridge,
      element_count: stats.element_count || 0,
      concrete_m3: stats.concrete_m3 || 0,
      sum_kros_czk: stats.sum_kros_czk || 0
    });
  } catch (error) {
    logger.error('Error fetching bridge:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST/PUT bridge metadata
router.post('/:bridge_id', (req, res) => {
  try {
    const { bridge_id } = req.params;
    const { span_length_m, deck_width_m, pd_weeks } = req.body;

    const existing = db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge_id);

    if (existing) {
      // Update
      db.prepare(`
        UPDATE bridges
        SET span_length_m = ?, deck_width_m = ?, pd_weeks = ?, updated_at = CURRENT_TIMESTAMP
        WHERE bridge_id = ?
      `).run(span_length_m, deck_width_m, pd_weeks, bridge_id);
    } else {
      // Insert
      db.prepare(`
        INSERT INTO bridges (bridge_id, span_length_m, deck_width_m, pd_weeks)
        VALUES (?, ?, ?, ?)
      `).run(bridge_id, span_length_m, deck_width_m, pd_weeks);
    }

    res.json({ success: true, bridge_id });
  } catch (error) {
    logger.error('Error saving bridge:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
