/**
 * Admin API-key gate (Sprint A, 2026-07).
 *
 * URS has no user auth at all — this is the minimal fail-closed gate for
 * routes that mutate GLOBAL service state (runtime LLM model) or burn
 * LLM budget. Callers send `X-API-Key: <URS_ADMIN_API_KEY>`.
 *
 * Fail-closed: when URS_ADMIN_API_KEY is not configured, gated routes
 * return 503 instead of silently allowing anonymous access.
 *
 * Open question for Alexander (handoff): long-term auth model for the
 * public matching routes — shared API key vs Portal JWT.
 */

import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

export function requireApiKey(req, res, next) {
  const configured = process.env.URS_ADMIN_API_KEY;

  if (!configured) {
    logger.error(`[ApiKey] URS_ADMIN_API_KEY not configured — denying ${req.method} ${req.originalUrl}`);
    return res.status(503).json({
      success: false,
      error: 'Admin API key authentication is not configured on this server'
    });
  }

  const provided = req.headers['x-api-key'];
  if (!provided) {
    logger.warn(`[ApiKey] Missing X-API-Key on ${req.method} ${req.originalUrl} from ${req.ip}`);
    return res.status(401).json({ success: false, error: 'X-API-Key header required' });
  }

  const providedBuf = Buffer.from(String(provided), 'utf8');
  const expectedBuf = Buffer.from(configured, 'utf8');
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    logger.warn(`[ApiKey] Invalid X-API-Key on ${req.method} ${req.originalUrl} from ${req.ip}`);
    return res.status(403).json({ success: false, error: 'Invalid API key' });
  }

  next();
}

/**
 * Opt-in gate for the LLM-cost routes (/api/jobs, /api/batch,
 * /api/pipeline). Enforced only when URS_REQUIRE_API_KEY=true so the
 * public klasifikator frontend keeps working until the auth model
 * (API key vs Portal JWT) is decided; rate limits still apply either way.
 */
export function requireApiKeyIfEnabled(req, res, next) {
  if (process.env.URS_REQUIRE_API_KEY === 'true') {
    return requireApiKey(req, res, next);
  }
  next();
}
