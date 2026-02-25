/**
 * KB Research Proxy Route
 *
 * Proxies requests to concrete-agent KB Research endpoint.
 * Allows Portal frontend to search Czech construction norms/pricing
 * without exposing the CORE URL directly.
 *
 * POST /api/kb/research
 *   Body: { question, save_to_kb?, category? }
 *   Proxies to: CORE_API_URL/api/v1/kb/research
 */

import express from 'express';

const router = express.Router();

const CORE_API_URL = process.env.STAVAGENT_CORE_URL || 'https://concrete-agent.onrender.com';
const TIMEOUT_MS = 55_000; // Perplexity can be slow

/**
 * POST /api/kb/research
 */
router.post('/', async (req, res) => {
  const { question, save_to_kb, category } = req.body;

  if (!question || typeof question !== 'string' || question.trim().length < 3) {
    return res.status(400).json({ success: false, error: 'question is required (min 3 chars)' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(`${CORE_API_URL}/api/v1/kb/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.trim(), save_to_kb, category }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        success: false,
        error: data?.detail || data?.error || 'KB research failed',
      });
    }

    res.json({ success: true, ...data });
  } catch (err) {
    clearTimeout(timeout);

    if (err.name === 'AbortError') {
      return res.status(504).json({ success: false, error: 'KB research timed out (55s)' });
    }

    console.error('[KB Research] Proxy error:', err.message);
    res.status(502).json({ success: false, error: 'Failed to reach CORE service' });
  }
});

export default router;
