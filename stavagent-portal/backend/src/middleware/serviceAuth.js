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
import { logger } from '../utils/logger.js';

const SERVICE_API_KEY = process.env.SERVICE_API_KEY;

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
