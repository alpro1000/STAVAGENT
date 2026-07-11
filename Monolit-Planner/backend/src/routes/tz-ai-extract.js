/**
 * TZ AI extraction API — the «Doplnit pomocí AI» button seam.
 * POST /api/tz-ai-extract
 *
 * The frontend's deterministic regex pass runs first (conf 1.0/0.9); this
 * route asks CORE (Vertex Gemini via Multi-Role) to fill ONLY the gaps.
 * The prompt is built server-side from the SHARED extraction manifest
 * (tz-ai-extraction.ts) — one source for "what to extract"; the response is
 * validated per-item by the same shared mergeAiParams on the frontend, so
 * this route stays a thin transport: prompt → LLM → robust JSON extraction
 * → raw candidate list. API keys never reach the browser.
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
 * Robust JSON-array extraction from an LLM answer. Gemini via Multi-Role has
 * no force-JSON yet (known Core TODO) — the answer may wrap the array in
 * prose or a ```json fence. Returns null when no parseable array is found
 * (the route then answers with a typed error, never a fabricated list).
 */
export function extractJsonArray(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.indexOf('[');
    const end = c.lastIndexOf(']');
    if (start === -1 || end <= start) continue;
    try {
      const parsed = JSON.parse(c.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch { /* try next candidate */ }
  }
  return null;
}

/**
 * POST /api/tz-ai-extract
 * Body: { element_type, tz_text }
 * Returns: { params: [{field, value, quote, confidence}], model }
 *          | { error: 'ai_no_parse' | 'core_unavailable' | 'bad_request', message }
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
    const coreRes = await fetchWithRetry(`${CORE_API_URL}/api/v1/multi-role/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'concrete_specialist',
        question: prompt,
        context: { element_type, task: 'tz_field_extraction' },
      }),
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (!coreRes.ok) {
      logger.warn(`[TzAiExtract] Core returned ${coreRes.status}`);
      return res.status(502).json({
        error: 'core_unavailable',
        message: `AI služba vrátila ${coreRes.status} — zkuste to později.`,
      });
    }
    const data = await coreRes.json();
    const answer = data.answer || data.response || '';
    const params = extractJsonArray(answer);
    if (params === null) {
      logger.warn('[TzAiExtract] LLM answer had no parseable JSON array');
      return res.status(422).json({
        error: 'ai_no_parse',
        message: 'AI nevrátila parsovatelný seznam parametrů — zkuste to znovu.',
      });
    }
    return res.json({ params, model: data.model_used || 'multi-role' });
  } catch (err) {
    logger.warn(`[TzAiExtract] error: ${err.message}`);
    return res.status(502).json({
      error: 'core_unavailable',
      message: 'AI služba není dostupná — deterministická extrakce funguje dál.',
    });
  }
});

export default router;
