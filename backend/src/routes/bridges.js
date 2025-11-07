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
        object_name,
        span_length_m,
        deck_width_m,
        pd_weeks,
        created_at,
        updated_at
      FROM bridges
      ORDER BY created_at DESC
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

// POST create new bridge manually
router.post('/', (req, res) => {
  try {
    const { bridge_id, object_name, span_length_m, deck_width_m, pd_weeks } = req.body;

    if (!bridge_id || !object_name) {
      return res.status(400).json({ error: 'bridge_id and object_name are required' });
    }

    // Check if bridge already exists
    const existing = db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge_id);
    if (existing) {
      return res.status(400).json({ error: `Bridge ${bridge_id} already exists` });
    }

    // Insert new bridge
    db.prepare(`
      INSERT INTO bridges (bridge_id, object_name, span_length_m, deck_width_m, pd_weeks)
      VALUES (?, ?, ?, ?, ?)
    `).run(bridge_id, object_name, span_length_m || null, deck_width_m || null, pd_weeks || null);

    logger.info(`Created new bridge: ${bridge_id} (${object_name})`);
    res.json({ success: true, bridge_id, object_name });
  } catch (error) {
    logger.error('Error creating bridge:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update bridge metadata
router.put('/:bridge_id', (req, res) => {
  try {
    const { bridge_id } = req.params;
    const { object_name, span_length_m, deck_width_m, pd_weeks } = req.body;

    const existing = db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge_id);
    if (!existing) {
      return res.status(404).json({ error: 'Bridge not found' });
    }

    // Update
    db.prepare(`
      UPDATE bridges
      SET object_name = COALESCE(?, object_name),
          span_length_m = COALESCE(?, span_length_m),
          deck_width_m = COALESCE(?, deck_width_m),
          pd_weeks = COALESCE(?, pd_weeks),
          updated_at = CURRENT_TIMESTAMP
      WHERE bridge_id = ?
    `).run(object_name, span_length_m, deck_width_m, pd_weeks, bridge_id);

    res.json({ success: true, bridge_id });
  } catch (error) {
    logger.error('Error updating bridge:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE bridge
router.delete('/:bridge_id', (req, res) => {
  try {
    const { bridge_id } = req.params;

    // Delete positions first
    db.prepare('DELETE FROM positions WHERE bridge_id = ?').run(bridge_id);

    // Delete bridge
    const result = db.prepare('DELETE FROM bridges WHERE bridge_id = ?').run(bridge_id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Bridge not found' });
    }

    logger.info(`Deleted bridge: ${bridge_id}`);
    res.json({ success: true, bridge_id });
  } catch (error) {
    logger.error('Error deleting bridge:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
