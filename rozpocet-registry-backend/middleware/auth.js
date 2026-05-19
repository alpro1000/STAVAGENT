/**
 * JWT Authentication Middleware for rozpocet-registry-backend.
 *
 * Mirrors the pattern in Monolit-Planner/backend/src/middleware/auth.js
 * — verifies the same Portal-issued JWT against the shared JWT_SECRET
 * env var so a user signed in to www.stavagent.cz can transparently
 * call the Registry backend.
 *
 * Token resolution priority:
 *   1. Authorization: Bearer <jwt>     (explicit, cross-origin)
 *   2. req.cookies.stavagent_jwt        (cross-subdomain cookie)
 *
 * Two flavours exported:
 *   - requireAuth   — rejects anonymous calls with 401 + warn-log.
 *                     Use on every write/delete endpoint.
 *   - optionalAuth  — populates req.user when a valid JWT is present,
 *                     otherwise lets the handler decide (used on reads
 *                     during the soft-rollout window if needed).
 *
 * req.user shape (decoded JWT claims, matches Portal):
 *   { userId: number, email: string, name: string, role: string }
 */

import jwt from 'jsonwebtoken';

// Fail-fast on missing JWT_SECRET — refuses to start with a known
// fallback value, which would silently let any attacker forge tokens
// signed against the literal string 'dev-secret-key-change-in-production'.
// Local dev / test sets JWT_SECRET explicitly via .env or
// `process.env.JWT_SECRET = '…'` at the top of the test file (see
// `stavagent-portal/backend/tests/isolation.e2e.test.js`).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    '[Auth] FATAL: JWT_SECRET environment variable is required. ' +
    'Set it via Cloud Run / Secret Manager (production) or .env (local).'
  );
}

function _extractToken(req) {
  const authHeader = req.headers && req.headers.authorization;
  const headerToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;
  // express only populates req.cookies when cookie-parser is wired; the
  // registry-backend currently doesn't load cookie-parser so this stays
  // null in practice. Kept here for forward-compat with the Portal /
  // Monolit pattern.
  const cookieToken =
    req.cookies && req.cookies.stavagent_jwt
      ? String(req.cookies.stavagent_jwt).trim()
      : null;
  return headerToken || cookieToken;
}

export function requireAuth(req, res, next) {
  const token = _extractToken(req);
  if (!token) {
    console.warn(
      `[Auth] 401 — anonymous ${req.method} ${req.originalUrl || req.url} ` +
      '(no Bearer header, no stavagent_jwt cookie)'
    );
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Portal JWT required. Forward Authorization: Bearer <token>.',
    });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    const code = err && err.name === 'TokenExpiredError' ? 'expired' : 'invalid';
    console.warn(
      `[Auth] 401 — ${code} JWT on ${req.method} ${req.originalUrl || req.url}: ${err.message}`
    );
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: code === 'expired' ? 'Token vypršel' : 'Neplatný token',
    });
  }
}

export function optionalAuth(req, res, next) {
  const token = _extractToken(req);
  if (!token) return next();
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.warn(`[Auth] optionalAuth ignored invalid token: ${err.message}`);
  }
  next();
}
