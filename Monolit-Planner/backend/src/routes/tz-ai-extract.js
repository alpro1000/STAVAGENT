/**
 * TZ AI extraction API — the «Doplnit pomocí AI» button seam.
 * POST /api/tz-ai-extract
 *
 * The frontend's deterministic regex pass runs first (conf 1.0/0.9); this
 * route asks CORE to fill ONLY the gaps. The prompt is built server-side from
 * the SHARED extraction manifest (tz-ai-extraction.ts) — ONE source for "what
 * to extract" (single-source, no drift); the response is validated per-item by
 * the same shared mergeAiParams on the frontend.
 *
 * HOTFIX-1 (2026-07-16, variant B2 ratified): switched CORE transport from the
 * free-form chat endpoint (/api/v1/multi-role/ask — no schema, prose parsed by
 * heuristic → the 502/422 / ai_no_parse class) to the canonical schema-validated
 * force-JSON route (/api/v1/tz/extract-calculator-fields). The manifest prompt
 * stays single-source in shared; Core is the force-JSON transport. multi-role/ask
 * is untouched (other consumers). API keys never reach the browser.
 */

import express from 'express';
import { logger } from '../utils/logger.js';
import { buildAiExtractionPrompt } from '@stavagent/monolit-shared';

const router = express.Router();

const CORE_API_URL = process.env.CORE_API_URL || process.env.STAVAGENT_CORE_URL || 'https://concrete-agent-1086027517695.europe-west3.run.app';
const TIMEOUT_MS = 60_000; // Cloud Run cold starts

async function fetchWithRetry(url, options, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      const isRetryable = err.cause?.code === 'ECONNRESET' ||
        err.cause?.code === 'UND_ERR_SOCKET' ||
        err.message?.includes('fetch failed') ||
        err.message?.includes('ECONNRESET');
      if (attempt < retries && isRetryable) {
        logger.info(`[TzAiExtract] Retry ${attempt + 1} after ${err.message}`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }
}

/**
 * POST /api/tz-ai-extract
 * Body: { element_type, tz_text }
 * Returns: { params: [{field, value, quote, confidence}], model }
 *          | { error: 'bad_request' | 'ai_invalid_json' | 'llm_unavailable'
 *                     | 'core_unavailable', message }  (message = one layer)
 */
router.post('/', async (req, res) => {
  const { element_type, tz_text } = req.body || {};
  if (!element_type || typeof tz_text !== 'string' || !tz_text.trim()) {
    return res.status(400).json({
      error: 'bad_request',
      message: 'element_type a neprázdný tz_text jsou povinné.',
    });
  }

  let prompt;
  try {
    prompt = buildAiExtractionPrompt(element_type, tz_text);
  } catch (err) {
    return res.status(400).json({ error: 'bad_request', message: err.message });
  }

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);
    // Canonical schema-validated force-JSON route (HOTFIX-1). Prompt is the
    // shared-manifest-built prompt (single-source); Core is the force-JSON
    // transport and returns { params:[{field,value,quote,confidence}], model }
    // or a TYPED error we propagate verbatim (one error layer, no 502/422 mix).
    const coreRes = await fetchWithRetry(`${CORE_API_URL}/api/v1/tz/extract-calculator-fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, element_type }),
      signal: controller.signal,
    });
    clearTimeout(tid);

    const data = await coreRes.json().catch(() => ({}));

    if (!coreRes.ok) {
      // Log the Core DETAIL body (not just the code) so a future contract drift
      // is debuggable from the planner logs; surface ONE layer to the UI.
      const detail = data?.message || data?.error || `HTTP ${coreRes.status}`;
      logger.warn(`[TzAiExtract] Core ${coreRes.status}: ${JSON.stringify(data).slice(0, 300)}`);
      return res.status(coreRes.status === 422 ? 422 : 502).json({
        error: data?.error || 'core_unavailable',
        message: `Extrakce selhala: ${detail}`,
      });
    }

    const params = Array.isArray(data.params) ? data.params : null;
    if (params === null) {
      logger.warn('[TzAiExtract] Core 200 but no params array');
      return res.status(422).json({
        error: 'ai_invalid_json',
        message: 'Extrakce selhala: AI nevrátila platný seznam parametrů — zkuste to znovu.',
      });
    }
    return res.json({ params, model: data.model || 'vertex-gemini' });
  } catch (err) {
    logger.warn(`[TzAiExtract] transport error: ${err.message}`);
    return res.status(502).json({
      error: 'core_unavailable',
      message: `Extrakce selhala: AI služba není dostupná (${err.message}) — deterministická extrakce funguje dál.`,
    });
  }
});

export default router;
