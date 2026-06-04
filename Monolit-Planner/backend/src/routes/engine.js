/**
 * Canonical calculator engine — HTTP delegate endpoints
 * (TASK_FIX_SSOT_MCP_Delegate, Phase 1).
 *
 * Single source of truth = the TS engine in `@stavagent/monolit-shared`
 * (planElement / classifyElement). These endpoints are THIN wrappers — they
 * add NO computational logic, they only expose the existing in-bundle engine
 * over HTTP so the MCP/agent surface (concrete-agent) can delegate to it and
 * stop diverging (audit T0 conflicts C5/C7/C8/C16).
 *
 *   POST /api/calculate  → planElement(PlannerInput): PlannerOutput
 *   POST /api/classify   → classifyElement(name, { is_bridge }): ElementProfile
 *
 * Pure compute — no DB, no auth side effects. The handlers stay synchronous
 * (the engine functions are sync) and return the engine output verbatim.
 */
import express from 'express';
import { planElement, classifyElement } from '@stavagent/monolit-shared';

const router = express.Router();

// Domain-sane input bounds (hardening — not blind, see engine.test.js probe notes).
const MAX_NAME_LEN = 500;          // element_name / classify name
const MAX_TYPE_LEN = 100;          // element_type code
const MAX_VOLUME_M3 = 100000;      // absurdly large for a single element, but finite

/**
 * Map the MCP classifier's 3-value `object_type` to the TS classifier's
 * boolean `is_bridge`. The TS context is intentionally narrower (only bridge
 * vs not) — both `retaining_wall` and `building` resolve to is_bridge=false.
 * An explicit `is_bridge` boolean in the body wins over `object_type`.
 */
function resolveIsBridge(body) {
  if (typeof body.is_bridge === 'boolean') return body.is_bridge;
  if (body.object_type != null) {
    const t = String(body.object_type).trim().toLowerCase();
    return t === 'bridge' || t === 'most';
  }
  return false;
}

/**
 * POST /api/calculate — full element plan via the canonical engine.
 * Body = PlannerInput. Requires volume_m3 (number) and either element_type or
 * element_name. Returns PlannerOutput verbatim.
 */
router.post('/calculate', (req, res) => {
  const input = req.body || {};

  // volume_m3: finite, >= 0, within a domain-sane ceiling. We deliberately allow
  // 0 (parity with the engine): pilota derives its volume from pile geometry and
  // runs fine at volume_m3=0, while non-pilota types make the rebar engine throw
  // ("mass_t must be positive") — that throw is surfaced as engine_error below,
  // not pre-rejected, so the endpoint mirrors the engine exactly.
  if (
    typeof input.volume_m3 !== 'number' ||
    !Number.isFinite(input.volume_m3) ||
    input.volume_m3 < 0 ||
    input.volume_m3 > MAX_VOLUME_M3
  ) {
    return res
      .status(400)
      .json({ error: `volume_m3 must be a number in [0, ${MAX_VOLUME_M3}]` });
  }
  if (!input.element_type && !input.element_name) {
    return res.status(400).json({ error: 'element_type or element_name is required' });
  }
  if (input.element_name != null && (typeof input.element_name !== 'string' || input.element_name.length > MAX_NAME_LEN)) {
    return res.status(400).json({ error: `element_name must be a string up to ${MAX_NAME_LEN} chars` });
  }
  if (input.element_type != null && (typeof input.element_type !== 'string' || input.element_type.length > MAX_TYPE_LEN)) {
    return res.status(400).json({ error: `element_type must be a string up to ${MAX_TYPE_LEN} chars` });
  }

  try {
    return res.json(planElement(input));
  } catch (err) {
    // Detail to server logs only (Phase 2 debugging); client gets a generic error.
    console.error('[engine] /api/calculate failed:', err);
    return res.status(500).json({ error: 'engine_error' });
  }
});

/**
 * POST /api/classify — element classification via the canonical classifier.
 * Body = { name: string, is_bridge?: boolean, object_type?: string }.
 * Returns ElementProfile verbatim.
 */
router.post('/classify', (req, res) => {
  const body = req.body || {};
  if (!body.name || typeof body.name !== 'string' || body.name.length > MAX_NAME_LEN) {
    return res.status(400).json({ error: `name (non-empty string up to ${MAX_NAME_LEN} chars) is required` });
  }

  try {
    return res.json(classifyElement(body.name, { is_bridge: resolveIsBridge(body) }));
  } catch (err) {
    console.error('[engine] /api/classify failed:', err);
    return res.status(500).json({ error: 'engine_error' });
  }
});

export default router;
