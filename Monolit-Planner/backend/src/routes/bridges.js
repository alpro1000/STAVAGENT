/**
 * Bridges routes - NO AUTH (Kiosk Mode)
 * GET /api/bridges - List all bridges with summary
 */

import express from 'express';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';
import { createSnapshot } from '../services/snapshot.js';
// NOTE: BRIDGE_TEMPLATE_POSITIONS and createDefaultPositions removed
// Templates only used during Excel import (parser-driven)

const router = express.Router();

// NO AUTH REQUIRED - This is a public kiosk application
// Authentication is handled at the portal level (stavagent-portal)

// GET all bridges with summary (no auth - kiosk mode)
router.get('/', async (req, res) => {
  try {
    // No owner filtering - kiosk mode
    const bridgesWithStats = await db.prepare(`
      SELECT
        b.bridge_id,
        b.project_name,
        b.object_name,
        b.status,
        b.span_length_m,
        b.deck_width_m,
        b.pd_weeks,
        b.created_at,
        b.updated_at,
        COUNT(p.id) as element_count,
        COALESCE(SUM(CASE WHEN p.subtype = 'beton' THEN p.concrete_m3 ELSE 0 END), 0) as concrete_m3,
        COALESCE(SUM(p.kros_total_czk), 0) as sum_kros_czk
      FROM bridges b
      LEFT JOIN positions p ON b.bridge_id = p.bridge_id
      GROUP BY b.bridge_id, b.project_name, b.object_name, b.status, b.span_length_m, b.deck_width_m, b.pd_weeks, b.created_at, b.updated_at
      ORDER BY b.status DESC, b.project_name, b.created_at DESC
    `).all();

    res.json(bridgesWithStats);
  } catch (error) {
    logger.error('Error fetching bridges:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single bridge (no auth - kiosk mode)
router.get('/:bridge_id', async (req, res) => {
  try {
    const { bridge_id } = req.params;

    const bridge = await db.prepare(`
      SELECT * FROM bridges WHERE bridge_id = ?
    `).get(bridge_id);

    if (!bridge) {
      return res.status(404).json({ error: 'Bridge not found' });
    }

    // Get stats
    const stats = await db.prepare(`
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

// POST create new EMPTY bridge manually (no auth - kiosk mode)
// User adds parts manually via "🏗️ Přidat část konstrukce"
// Templates only used during Excel import (parser-driven)
router.post('/', async (req, res) => {
  try {
    const { bridge_id, project_name, object_name, span_length_m, deck_width_m, pd_weeks } = req.body;
    const ownerId = 1; // Default owner for kiosk mode

    if (!bridge_id) {
      return res.status(400).json({ error: 'bridge_id is required' });
    }

    // Check if bridge already exists
    const existing = await db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge_id);
    if (existing) {
      return res.status(400).json({ error: `Bridge ${bridge_id} already exists` });
    }

    // Insert new EMPTY bridge (no templates)
    await db.prepare(`
      INSERT INTO bridges (bridge_id, project_name, object_name, span_length_m, deck_width_m, pd_weeks, owner_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(
      bridge_id,
      project_name || 'Manual',
      object_name || bridge_id,
      span_length_m || null,
      deck_width_m || null,
      pd_weeks || null,
      ownerId
    );

    logger.info(`Created new empty bridge: ${bridge_id} (${object_name}) - add parts manually`);
    res.json({ success: true, bridge_id, object_name });
  } catch (error) {
    logger.error('Error creating bridge:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update bridge metadata (no auth - kiosk mode)
router.put('/:bridge_id', async (req, res) => {
  try {
    const { bridge_id } = req.params;
    const { project_name, object_name, span_length_m, deck_width_m, pd_weeks, concrete_m3 } = req.body;

    const existing = await db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge_id);
    if (!existing) {
      return res.status(404).json({ error: 'Bridge not found' });
    }

    // Update
    await db.prepare(`
      UPDATE bridges
      SET project_name = COALESCE(?, project_name),
          object_name = COALESCE(?, object_name),
          span_length_m = COALESCE(?, span_length_m),
          deck_width_m = COALESCE(?, deck_width_m),
          pd_weeks = COALESCE(?, pd_weeks),
          concrete_m3 = COALESCE(?, concrete_m3),
          updated_at = CURRENT_TIMESTAMP
      WHERE bridge_id = ?
    `).run(project_name, object_name, span_length_m, deck_width_m, pd_weeks, concrete_m3, bridge_id);

    res.json({ success: true, bridge_id });
  } catch (error) {
    logger.error('Error updating bridge:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH update bridge status (no auth - kiosk mode)
router.patch('/:bridge_id/status', async (req, res) => {
  try {
    const { bridge_id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'completed', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: active, completed, or archived' });
    }

    const existing = await db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge_id);
    if (!existing) {
      return res.status(404).json({ error: 'Bridge not found' });
    }

    await db.prepare(`
      UPDATE bridges
      SET status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE bridge_id = ?
    `).run(status, bridge_id);

    logger.info(`Updated bridge ${bridge_id} status to: ${status}`);
    res.json({ success: true, bridge_id, status });
  } catch (error) {
    logger.error('Error updating bridge status:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/bridges/:bridge_id/complete - Mark bridge as completed with final snapshot (no auth - kiosk mode)
router.post('/:bridge_id/complete', async (req, res) => {
  try {
    const { bridge_id } = req.params;
    const { created_by, description } = req.body;

    // Check if bridge exists
    const bridge = await db.prepare('SELECT bridge_id, object_name FROM bridges WHERE bridge_id = ?').get(bridge_id);
    if (!bridge) {
      return res.status(404).json({ error: 'Bridge not found' });
    }

    // Get current positions and calculate header_kpi
    const positions = db.prepare(`
      SELECT * FROM positions WHERE bridge_id = ?
    `).all(bridge_id);

    if (positions.length === 0) {
      return res.status(400).json({ error: 'Cannot complete bridge with no positions' });
    }

    // Calculate header_kpi
    const sum_concrete_m3 = positions.reduce((sum, p) => {
      if (p.subtype === 'beton') {
        return sum + (p.concrete_m3 || 0);
      }
      return sum;
    }, 0);

    const sum_kros_total_czk = positions.reduce((sum, p) => sum + (p.kros_total_czk || 0), 0);

    const header_kpi = {
      sum_concrete_m3,
      sum_kros_total_czk,
      project_unit_cost_czk_per_m3: sum_concrete_m3 > 0 ? sum_kros_total_czk / sum_concrete_m3 : 0,
      project_unit_cost_czk_per_t: sum_concrete_m3 > 0 ? sum_kros_total_czk / (sum_concrete_m3 * 2.4) : 0,
      rho_t_per_m3: 2.4
    };

    // Delete ALL existing snapshots (full replacement)
    const deleteResult = await db.prepare('DELETE FROM snapshots WHERE bridge_id = ?').run(bridge_id);
    logger.info(`Deleted ${deleteResult.changes} existing snapshots for bridge ${bridge_id}`);

    // Create ONE final snapshot with is_final=true
    const finalSnapshot = createSnapshot(
      bridge_id,
      positions,
      header_kpi,
      {
        snapshot_name: 'Finální verze',
        description: description || `Projekt dokončen - ${new Date().toLocaleDateString('cs-CZ')}`,
        created_by: created_by || null,
        is_final: true
      }
    );

    // Insert final snapshot
    db.prepare(`
      INSERT INTO snapshots (
        id, bridge_id, snapshot_name, snapshot_hash, created_by,
        positions_snapshot, header_kpi_snapshot, description,
        is_locked, is_final, sum_kros_at_lock
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      finalSnapshot.id,
      finalSnapshot.bridge_id,
      finalSnapshot.snapshot_name,
      finalSnapshot.snapshot_hash,
      finalSnapshot.created_by,
      finalSnapshot.positions_snapshot,
      finalSnapshot.header_kpi_snapshot,
      finalSnapshot.description,
      finalSnapshot.is_locked,
      finalSnapshot.is_final,
      finalSnapshot.sum_kros_at_lock
    );

    // Update bridge status to 'completed'
    db.prepare(`
      UPDATE bridges
      SET status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      WHERE bridge_id = ?
    `).run(bridge_id);

    logger.info(`Completed bridge ${bridge_id} (${bridge.object_name}) with final snapshot ${finalSnapshot.id}`);

    res.json({
      success: true,
      bridge_id,
      status: 'completed',
      final_snapshot_id: finalSnapshot.id,
      snapshots_deleted: deleteResult.changes,
      sum_kros_at_lock: finalSnapshot.sum_kros_at_lock
    });
  } catch (error) {
    logger.error('Error completing bridge:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE bridge (no auth - kiosk mode)
router.delete('/:bridge_id', async (req, res) => {
  try {
    const { bridge_id } = req.params;

    // Check if bridge exists
    const bridge = await db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge_id);
    if (!bridge) {
      return res.status(404).json({ error: 'Bridge not found' });
    }

    // Delete snapshots first (cascade)
    await db.prepare('DELETE FROM snapshots WHERE bridge_id = ?').run(bridge_id);

    // Delete positions
    await db.prepare('DELETE FROM positions WHERE bridge_id = ?').run(bridge_id);

    // Delete bridge
    await db.prepare('DELETE FROM bridges WHERE bridge_id = ?').run(bridge_id);

    logger.info(`Deleted bridge: ${bridge_id}`);
    res.json({ success: true, bridge_id });
  } catch (error) {
    logger.error('Error deleting bridge:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
