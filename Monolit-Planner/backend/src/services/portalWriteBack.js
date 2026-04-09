/**
 * Portal Write-Back Service
 *
 * When a Monolit position is updated (PUT /api/positions), this service
 * sends the MonolithPayload to Portal via:
 *   POST /api/positions/:instanceId/monolith
 *
 * Non-blocking: Portal failures never break Monolit operations.
 * Only fires if the position has a position_instance_id (Portal link).
 *
 * Spec: docs/POSITION_INSTANCE_ARCHITECTURE.ts
 */

import { logger } from '../utils/logger.js';

const PORTAL_API = process.env.PORTAL_API_URL || 'https://stavagent-portal-backend-1086027517695.europe-west3.run.app';
const MONOLIT_FRONTEND_URL = process.env.MONOLIT_FRONTEND_URL || 'https://kalkulator.stavagent.cz';
// Per-request timeout — default 15s to tolerate Cloud Run cold start (was 5s, too tight)
const WRITE_BACK_TIMEOUT = parseInt(process.env.PORTAL_WRITE_BACK_TIMEOUT) || 15000;
// Max concurrent write-back requests (prevents flooding Portal with 755+ parallel calls)
const WRITE_BACK_CONCURRENCY = parseInt(process.env.PORTAL_WRITE_BACK_CONCURRENCY) || 10;

/**
 * Build MonolithPayload from a DB position row.
 * Matches the spec in POSITION_INSTANCE_ARCHITECTURE.ts → MonolithPayload interface.
 *
 * @param {object} pos - Position row from Monolit DB (SELECT * FROM positions)
 * @param {string} bridgeId - Bridge/project ID
 * @returns {object} MonolithPayload
 */
export function buildMonolithPayload(pos, bridgeId) {
  return {
    monolit_position_id: pos.id,
    monolit_project_id: bridgeId || pos.bridge_id,
    part_name: pos.part_name || '',
    monolit_url: `${MONOLIT_FRONTEND_URL}/?project=${bridgeId || pos.bridge_id}`,
    subtype: pos.subtype || '',
    otskp_code: pos.otskp_code || null,
    item_name: pos.item_name || null,
    crew_size: pos.crew_size || 0,
    wage_czk_ph: pos.wage_czk_ph || 0,
    shift_hours: pos.shift_hours || 0,
    days: pos.days || 0,
    curing_days: pos.curing_days || null,
    labor_hours: pos.labor_hours || 0,
    cost_czk: pos.cost_czk || 0,
    unit_cost_native: pos.unit_cost_native || null,
    concrete_m3: pos.concrete_m3 || null,
    unit_cost_on_m3: pos.unit_cost_on_m3 || null,
    kros_unit_czk: pos.kros_unit_czk || null,
    kros_total_czk: pos.kros_total_czk || null,
    source_tag: 'MONOLIT_LIVE',
    assumptions_log: '',
    confidence: 1.0,
    calculated_at: new Date().toISOString()
  };
}

/**
 * Send MonolithPayload to Portal for a single position.
 * Non-blocking — logs errors but never throws.
 *
 * @param {string} positionInstanceId - Portal UUID (position_instance_id)
 * @param {object} payload - MonolithPayload object
 */
export async function writeBackToPortal(positionInstanceId, payload) {
  if (!positionInstanceId) return;

  const url = `${PORTAL_API}/api/positions/${positionInstanceId}/monolith`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
      signal: AbortSignal.timeout(WRITE_BACK_TIMEOUT)
    });

    if (response.ok) {
      logger.debug(`[WriteBack] ✅ Portal: ${positionInstanceId}`);
      return { ok: true };
    } else {
      logger.debug(`[WriteBack] Portal responded ${response.status} for ${positionInstanceId}`);
      return { ok: false, status: response.status };
    }
  } catch (error) {
    // Demoted to debug — Portal writeback is non-critical, positions are already in Monolit DB.
    // Timeouts during Cloud Run cold start are expected and will be retried on next PUT.
    logger.debug(`[WriteBack] Portal unavailable for ${positionInstanceId}: ${error.message}`);
    return { ok: false, error: error.message };
  }
}

/**
 * Write back MonolithPayload for multiple positions.
 * Used after batch PUT /api/positions.
 * Non-blocking — fires all requests in parallel, never throws.
 *
 * @param {object[]} positions - Array of position DB rows (must include position_instance_id)
 * @param {string} bridgeId - Bridge/project ID
 */
export async function writeBackBatch(positions, bridgeId) {
  const linked = positions.filter(p => p.position_instance_id);
  if (linked.length === 0) return;

  logger.info(`[WriteBack] Sending ${linked.length} monolith payloads to Portal (concurrency=${WRITE_BACK_CONCURRENCY})...`);

  // Chunked parallelism: process in batches of WRITE_BACK_CONCURRENCY
  // Prevents flooding Portal with hundreds of parallel requests which
  // causes Cloud Run to throttle / cold-start-timeout under load.
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < linked.length; i += WRITE_BACK_CONCURRENCY) {
    const chunk = linked.slice(i, i + WRITE_BACK_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(pos => {
        const payload = buildMonolithPayload(pos, bridgeId);
        return writeBackToPortal(pos.position_instance_id, payload);
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value?.ok) ok++;
      else failed++;
    }
  }

  if (failed > 0) {
    logger.info(`[WriteBack] Batch complete: ${ok} ok, ${failed} failed (Portal may be cold-starting, non-critical)`);
  } else {
    logger.info(`[WriteBack] Batch complete: ${ok} ok`);
  }
}
