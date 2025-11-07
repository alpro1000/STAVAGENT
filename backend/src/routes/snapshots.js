/**
 * Snapshots routes
 * API for snapshot management (create, list, restore, unlock, delete)
 */

import express from 'express';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';
import {
  createSnapshot,
  verifySnapshotIntegrity,
  calculateSnapshotDelta,
  createDraftFromSnapshot
} from '../services/snapshot.js';

const router = express.Router();

// POST /api/snapshots/create - Create new snapshot
router.post('/create', (req, res) => {
  try {
    const { bridge_id, positions, header_kpi, description, snapshot_name, created_by } = req.body;

    if (!bridge_id || !positions || !Array.isArray(positions)) {
      return res.status(400).json({ error: 'bridge_id and positions are required' });
    }

    // Create snapshot
    const snapshot = createSnapshot(bridge_id, positions, header_kpi, {
      snapshot_name,
      description,
      created_by
    });

    // Insert into database
    db.prepare(`
      INSERT INTO snapshots (
        id, bridge_id, snapshot_name, snapshot_hash, created_by,
        positions_snapshot, header_kpi_snapshot, description,
        is_locked, sum_kros_at_lock
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      snapshot.id,
      snapshot.bridge_id,
      snapshot.snapshot_name,
      snapshot.snapshot_hash,
      snapshot.created_by,
      snapshot.positions_snapshot,
      snapshot.header_kpi_snapshot,
      snapshot.description,
      snapshot.is_locked,
      snapshot.sum_kros_at_lock
    );

    logger.info(`Created snapshot: ${snapshot.id} for bridge ${bridge_id}`);

    res.json({
      success: true,
      snapshot_id: snapshot.id,
      snapshot_hash: snapshot.snapshot_hash,
      created_at: new Date().toISOString(),
      sum_kros_at_lock: snapshot.sum_kros_at_lock,
      is_locked: true
    });
  } catch (error) {
    logger.error('Error creating snapshot:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/snapshots/:bridge_id - List all snapshots for bridge
router.get('/:bridge_id', (req, res) => {
  try {
    const { bridge_id } = req.params;

    const snapshots = db.prepare(`
      SELECT
        id as snapshot_id,
        snapshot_name,
        created_at,
        created_by,
        sum_kros_at_lock,
        description,
        is_locked,
        parent_snapshot_id
      FROM snapshots
      WHERE bridge_id = ?
      ORDER BY created_at DESC
    `).all(bridge_id);

    // Calculate deltas
    const snapshotsWithDeltas = snapshots.map((snap, index) => {
      const previousSnapshot = snapshots[index + 1];
      const delta = previousSnapshot
        ? snap.sum_kros_at_lock - previousSnapshot.sum_kros_at_lock
        : null;

      return {
        ...snap,
        delta_to_previous: delta,
        is_locked: Boolean(snap.is_locked)
      };
    });

    res.json(snapshotsWithDeltas);
  } catch (error) {
    logger.error('Error fetching snapshots:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/snapshots/detail/:snapshot_id - Get snapshot details
router.get('/detail/:snapshot_id', (req, res) => {
  try {
    const { snapshot_id } = req.params;

    const snapshot = db.prepare(`
      SELECT * FROM snapshots WHERE id = ?
    `).get(snapshot_id);

    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    // Verify integrity
    const integrity = verifySnapshotIntegrity(snapshot);

    // Parse JSON fields
    const positions = JSON.parse(snapshot.positions_snapshot);
    const header_kpi = JSON.parse(snapshot.header_kpi_snapshot);

    res.json({
      snapshot_id: snapshot.id,
      bridge_id: snapshot.bridge_id,
      snapshot_name: snapshot.snapshot_name,
      created_at: snapshot.created_at,
      created_by: snapshot.created_by,
      description: snapshot.description,
      is_locked: Boolean(snapshot.is_locked),
      sum_kros_at_lock: snapshot.sum_kros_at_lock,
      positions,
      header_kpi,
      integrity
    });
  } catch (error) {
    logger.error('Error fetching snapshot detail:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/snapshots/:snapshot_id/restore - Restore snapshot
router.post('/:snapshot_id/restore', (req, res) => {
  try {
    const { snapshot_id } = req.params;
    const { comment, created_by } = req.body;

    const snapshot = db.prepare(`
      SELECT * FROM snapshots WHERE id = ?
    `).get(snapshot_id);

    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    // Parse positions and header_kpi
    const positions = JSON.parse(snapshot.positions_snapshot);
    const header_kpi = JSON.parse(snapshot.header_kpi_snapshot);

    // Create new snapshot from restored data
    const newSnapshot = createSnapshot(
      snapshot.bridge_id,
      positions,
      header_kpi,
      {
        snapshot_name: `Obnoveno z ${snapshot.snapshot_name || snapshot_id}`,
        description: comment || `Obnoveno ze snapshot ${snapshot_id}`,
        created_by: created_by || null
      }
    );

    // Set parent to original snapshot
    newSnapshot.parent_snapshot_id = snapshot_id;

    // Insert new snapshot
    db.prepare(`
      INSERT INTO snapshots (
        id, bridge_id, snapshot_name, snapshot_hash, created_by,
        positions_snapshot, header_kpi_snapshot, description,
        is_locked, sum_kros_at_lock, parent_snapshot_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newSnapshot.id,
      newSnapshot.bridge_id,
      newSnapshot.snapshot_name,
      newSnapshot.snapshot_hash,
      newSnapshot.created_by,
      newSnapshot.positions_snapshot,
      newSnapshot.header_kpi_snapshot,
      newSnapshot.description,
      newSnapshot.is_locked,
      newSnapshot.sum_kros_at_lock,
      newSnapshot.parent_snapshot_id
    );

    logger.info(`Restored snapshot ${snapshot_id} as new snapshot ${newSnapshot.id}`);

    res.json({
      success: true,
      restored: true,
      new_snapshot_id: newSnapshot.id,
      positions,
      header_kpi
    });
  } catch (error) {
    logger.error('Error restoring snapshot:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/snapshots/:snapshot_id/unlock - Unlock snapshot
router.post('/:snapshot_id/unlock', (req, res) => {
  try {
    const { snapshot_id } = req.params;
    const { reason, created_by } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Důvod je povinný' });
    }

    const snapshot = db.prepare(`
      SELECT * FROM snapshots WHERE id = ?
    `).get(snapshot_id);

    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    // Create draft snapshot
    const draftSnapshot = createDraftFromSnapshot(snapshot, reason, created_by);

    // Insert draft
    db.prepare(`
      INSERT INTO snapshots (
        id, bridge_id, snapshot_name, snapshot_hash, created_by,
        positions_snapshot, header_kpi_snapshot, description,
        is_locked, sum_kros_at_lock, parent_snapshot_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      draftSnapshot.id,
      draftSnapshot.bridge_id,
      draftSnapshot.snapshot_name,
      draftSnapshot.snapshot_hash,
      draftSnapshot.created_by,
      draftSnapshot.positions_snapshot,
      draftSnapshot.header_kpi_snapshot,
      draftSnapshot.description,
      draftSnapshot.is_locked,
      draftSnapshot.sum_kros_at_lock,
      draftSnapshot.parent_snapshot_id
    );

    logger.info(`Unlocked snapshot ${snapshot_id}, created draft ${draftSnapshot.id}`);

    res.json({
      success: true,
      is_locked: false,
      unlocked_at: new Date().toISOString(),
      new_draft_snapshot_id: draftSnapshot.id,
      reason
    });
  } catch (error) {
    logger.error('Error unlocking snapshot:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/snapshots/:snapshot_id - Delete snapshot
router.delete('/:snapshot_id', (req, res) => {
  try {
    const { snapshot_id } = req.params;

    const snapshot = db.prepare(`
      SELECT is_locked FROM snapshots WHERE id = ?
    `).get(snapshot_id);

    if (!snapshot) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    if (snapshot.is_locked) {
      return res.status(400).json({ error: 'Nelze smazat zamčený snapshot' });
    }

    const result = db.prepare('DELETE FROM snapshots WHERE id = ?').run(snapshot_id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    logger.info(`Deleted snapshot: ${snapshot_id}`);
    res.json({ success: true, deleted_id: snapshot_id });
  } catch (error) {
    logger.error('Error deleting snapshot:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/snapshots/active/:bridge_id - Get active (locked) snapshot for bridge
router.get('/active/:bridge_id', (req, res) => {
  try {
    const { bridge_id } = req.params;

    const snapshot = db.prepare(`
      SELECT
        id as snapshot_id,
        snapshot_name,
        created_at,
        created_by,
        sum_kros_at_lock,
        snapshot_hash
      FROM snapshots
      WHERE bridge_id = ? AND is_locked = 1
      ORDER BY created_at DESC
      LIMIT 1
    `).get(bridge_id);

    if (!snapshot) {
      return res.json({ active_snapshot: null });
    }

    res.json({
      active_snapshot: snapshot,
      has_active_snapshot: true
    });
  } catch (error) {
    logger.error('Error fetching active snapshot:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
