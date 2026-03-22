/**
 * Service-level Authentication Middleware
 *
 * Protects kiosk ↔ portal endpoints with a shared API key.
 * Kiosks (Monolit, Registry) must send X-Service-Key header.
 *
 * Setup: set SERVICE_API_KEY env var on Portal + all kiosks.
 * Generate: openssl rand -hex 32
 */

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

  // Constant-time comparison to prevent timing attacks
  if (provided.length !== SERVICE_API_KEY.length || !timingSafeEqual(provided, SERVICE_API_KEY)) {
    logger.warn(`[ServiceAuth] Invalid X-Service-Key on ${req.method} ${req.path} from ${req.ip}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid service key'
    });
  }

  next();
}

/**
 * Constant-time string comparison (prevents timing attacks)
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
