/**
 * JWT Authentication Middleware for Monolit Planner
 *
 * Verifies Portal JWT tokens passed via Authorization: Bearer <token>.
 * Uses the same JWT_SECRET as stavagent-portal for cross-service auth.
 *
 * optionalAuth — populates req.user if valid token present, does NOT block.
 * Used on project routes so authenticated users see only their projects,
 * while unauthenticated kiosk access still works (legacy mode).
 */

import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

// Fail-closed (Sprint A): in production a missing JWT_SECRET would mean
// verifying tokens against a publicly-known dev string — anyone could
// forge an owner identity. Refuse to start instead.
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
if (IS_PRODUCTION && !process.env.JWT_SECRET) {
  throw new Error('[Auth] JWT_SECRET must be set in production (same value as Portal).');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

/**
 * Optional auth middleware — populates req.user if valid token present, but does NOT block.
 * req.user shape: { userId: number, email: string, name: string, role: string }
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      try {
        req.user = jwt.verify(token, JWT_SECRET);
        logger.info(`[AUTH] Authenticated user: ${req.user.email} (id=${req.user.userId})`);
      } catch (err) {
        // Invalid/expired token — continue as anonymous (kiosk mode)
        logger.debug(`[AUTH] Invalid token ignored: ${err.message}`);
      }
    }
  }
  next();
}

/**
 * Shared server-to-server key (same value across STAVAGENT services). The
 * Monolit→Portal write-back already authenticates with this env var
 * (portalWriteBack.js); the reverse Core→Monolit MCP delegate now does too.
 */
const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

/**
 * Fail-closed auth for COMPUTE / AI endpoints (HOTFIX-2, 2026-07-16).
 *
 * Motivation: prod logs showed an anonymous python-httpx bot (Microsoft IP)
 * running full POST /api/calculate — these endpoints burn money (calculator
 * compute, Core/Perplexity/Gemini AI) yet sat in front of no auth. The browser
 * calculator computes IN-PROCESS (shared planElement), so gating the HTTP
 * surface does NOT touch the kiosk UI; only MCP/agent callers reach it.
 *
 * Accepts EITHER a valid Portal JWT (interactive user) OR the shared
 * X-Service-Key (server-to-server, e.g. the Core MCP delegate). Mirrors
 * Portal's `requireAuthOrServiceKey` precedent. Anything else → 401.
 *
 * Data-CRUD routes deliberately keep `optionalAuth` + per-row isolation so the
 * anonymous kiosk mode (legacy projects) still works — decision 2026-07-16.
 */
export function requireAuthOrServiceKey(req, res, next) {
  // 1) Server-to-server: constant-time-ish exact match on the shared key.
  const provided = req.headers['x-service-key'];
  if (SERVICE_API_KEY && provided && provided === SERVICE_API_KEY) {
    req.serviceCaller = true;
    return next();
  }

  // 2) Interactive: valid Portal JWT.
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      try {
        req.user = jwt.verify(token, JWT_SECRET);
        return next();
      } catch (err) {
        logger.debug(`[AUTH] requireAuthOrServiceKey rejected token: ${err.message}`);
      }
    }
  }

  // 3) Anonymous → blocked. 401 (not 404) — these routes are known-public
  // paths, we just require a credential to run the compute.
  logger.warn(`[AUTH] 401 anonymous compute attempt: ${req.method} ${req.originalUrl} from ${req.ip}`);
  return res.status(401).json({
    error: 'unauthorized',
    message: 'Tento endpoint vyžaduje přihlášení (Portal token) nebo servisní klíč.',
  });
}
