/**
 * Service-level Authentication Middleware
 *
 * Protects kiosk ↔ portal endpoints with a shared API key.
 * Kiosks (Monolit, Registry) must send X-Service-Key header.
 *
 * Setup: set SERVICE_API_KEY env var on Portal + all kiosks.
 * Generate: openssl rand -hex 32
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

const SERVICE_API_KEY = process.env.SERVICE_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

/**
 * Middleware: require valid X-Service-Key header for kiosk-to-portal requests.
 * If SERVICE_API_KEY is not configured, logs a warning and allows the request
 * (graceful degradation for dev/migration period).
 */
export function requireServiceKey(req, res, next) {
  // If no key configured, warn but allow (dev mode / migration)
  if (!SERVICE_API_KEY) {
    logger.warn('[ServiceAuth] SERVICE_API_KEY not configured — allowing request (set it in production!)');
    return next();
  }

  const provided = req.headers['x-service-key'];

  if (!provided) {
    logger.warn(`[ServiceAuth] Missing X-Service-Key on ${req.method} ${req.path} from ${req.ip}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-Service-Key header'
    });
  }

  // Constant-time comparison to prevent timing attacks (CWE-208)
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(SERVICE_API_KEY, 'utf8');

  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    logger.warn(`[ServiceAuth] Invalid X-Service-Key on ${req.method} ${req.path} from ${req.ip}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid service key'
    });
  }

  next();
}

/**
 * Middleware: require EITHER valid JWT token OR valid X-Service-Key.
 * Use on endpoints accessed by both frontend (JWT) and kiosks (service key).
 *
 * Priority: JWT first (if Authorization header present), then service key.
 * If neither is valid, returns 401.
 */
export function requireAuthOrServiceKey(req, res, next) {
  // Dev mode bypass (same as requireAuth)
  if (process.env.DISABLE_AUTH === 'true') {
    req.user = { userId: 1, email: 'dev@test.com', role: 'admin', name: 'Dev User' };
    return next();
  }

  // Try JWT first (frontend)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        return next();
      } catch {
        // JWT invalid — fall through to service key check
      }
    }
  }

  // Try service key (kiosk)
  if (!SERVICE_API_KEY) {
    // No key configured — allow in dev (same as requireServiceKey behavior)
    logger.warn('[AuthOrService] No SERVICE_API_KEY + no JWT — allowing (dev mode)');
    return next();
  }

  const provided = req.headers['x-service-key'];
  if (provided) {
    const providedBuffer = Buffer.from(provided, 'utf8');
    const expectedBuffer = Buffer.from(SERVICE_API_KEY, 'utf8');
    if (providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
      return next();
    }
  }

  // Neither JWT nor service key valid
  logger.warn(`[AuthOrService] Unauthorized: ${req.method} ${req.path} from ${req.ip}`);
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Valid JWT token or X-Service-Key required'
  });
}
