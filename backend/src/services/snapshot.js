/**
 * Snapshot Service
 * Creates snapshots with SHA256 hash and integrity verification
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a snapshot with hash calculation
 */
export function createSnapshot(
  bridge_id,
  positions,
  header_kpi,
  config = {}
) {
  const { snapshot_name, description, created_by, is_final } = config;

  // Calculate hash from positions
  const positionsJson = JSON.stringify(positions);
  const hash = crypto
    .createHash('sha256')
    .update(positionsJson)
    .digest('hex');

  // Calculate total KROS sum
  const sum_kros = positions.reduce((sum, p) => sum + (p.kros_total_czk || 0), 0);

  return {
    id: uuidv4(),
    bridge_id,
    snapshot_hash: hash,
    positions_snapshot: positionsJson,
    header_kpi_snapshot: JSON.stringify(header_kpi),
    sum_kros_at_lock: sum_kros,
    snapshot_name: snapshot_name || null,
    description: description || null,
    created_by: created_by || null,
    is_locked: 1, // По умолчанию locked
    is_final: is_final ? 1 : 0, // Final snapshot flag
    parent_snapshot_id: null
  };
}

/**
 * Verify snapshot integrity
 */
export function verifySnapshotIntegrity(snapshot) {
  const recalculatedHash = crypto
    .createHash('sha256')
    .update(snapshot.positions_snapshot)
    .digest('hex');

  const hashMatches = recalculatedHash === snapshot.snapshot_hash;

  return {
    is_valid: hashMatches,
    hash_matches: hashMatches,
    stored_hash: snapshot.snapshot_hash,
    calculated_hash: recalculatedHash,
    positions_count: JSON.parse(snapshot.positions_snapshot).length
  };
}

/**
 * Calculate delta between two snapshots
 */
export function calculateSnapshotDelta(currentSnapshot, previousSnapshot) {
  if (!previousSnapshot) {
    return null;
  }

  const currentSum = currentSnapshot.sum_kros_at_lock || 0;
  const previousSum = previousSnapshot.sum_kros_at_lock || 0;

  return currentSum - previousSum;
}

/**
 * Create a draft snapshot from unlocked snapshot
 */
export function createDraftFromSnapshot(
  originalSnapshot,
  reason,
  created_by
) {
  const positions = JSON.parse(originalSnapshot.positions_snapshot);
  const header_kpi = JSON.parse(originalSnapshot.header_kpi_snapshot);

  return {
    id: uuidv4(),
    bridge_id: originalSnapshot.bridge_id,
    snapshot_hash: originalSnapshot.snapshot_hash, // Same hash initially
    positions_snapshot: originalSnapshot.positions_snapshot,
    header_kpi_snapshot: originalSnapshot.header_kpi_snapshot,
    sum_kros_at_lock: originalSnapshot.sum_kros_at_lock,
    snapshot_name: `Koncept z ${originalSnapshot.snapshot_name || originalSnapshot.id}`,
    description: `Odemčeno: ${reason}`,
    created_by: created_by || null,
    is_locked: 0, // Draft = unlocked
    parent_snapshot_id: originalSnapshot.id
  };
}
