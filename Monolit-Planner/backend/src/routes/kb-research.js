/**
 * KB Research Proxy
 * Proxies /api/kb/research → concrete-agent /api/v1/kb/research
 *
 * Используется вкладкой "Poradna norem" в FormworkAIModal:
 *  POST /api/kb/research  { question, save_to_kb?, category? }
 *  → { answer, sources[], from_kb, kb_saved, kb_category, model_used }
 */

import express from 'express';
import { logger } from '../utils/logger.js';

const router = express.Router();

const CORE_API_URL = process.env.STAVAGENT_CORE_URL || 'https://concrete-agent.onrender.com';
const TIMEOUT_MS   = 50_000; // Perplexity бывает медленным

router.post('/', async (req, res) => {
  const { question, save_to_kb = true, category } = req.body;

  if (!question?.trim()) {
    return res.status(400).json({ error: 'Otázka je povinná' });
  }

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const coreRes = await fetch(`${CORE_API_URL}/api/v1/kb/research`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        question:   question.trim(),
        save_to_kb,
        category:   category || null,
      }),
      signal:  controller.signal,
    });

    clearTimeout(tid);

    if (!coreRes.ok) {
      const body = await coreRes.text().catch(() => '');
      logger.warn(`[KBResearch] Core returned ${coreRes.status}: ${body}`);
      return res.status(502).json({ error: `Core API chyba ${coreRes.status}` });
    }

    const data = await coreRes.json();
    res.json(data);

  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    logger.warn(`[KBResearch] ${isTimeout ? 'Timeout' : 'Error'}: ${err.message}`);
    res.status(502).json({
      error: isTimeout
        ? 'Timeout — Perplexity trvá déle, zkuste znovu za chvíli'
        : 'Chyba při komunikaci s KB Research API',
    });
  }
});

export default router;
