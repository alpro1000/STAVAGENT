/**
 * Secret configuration — single source for JWT_SECRET and SERVICE_API_KEY.
 *
 * Fail-closed policy (Sprint A, 2026-07):
 *   - In production (NODE_ENV=production or Cloud Run's K_SERVICE) both
 *     JWT_SECRET and SERVICE_API_KEY are REQUIRED. Missing either one
 *     throws at import time, so the new revision fails its startup probe
 *     and Cloud Run keeps serving the previous revision — the service
 *     never boots with a publicly-known dev secret or a fail-open
 *     kiosk gate.
 *   - In dev, JWT_SECRET falls back to the historical dev string and
 *     SERVICE_API_KEY may stay unset; the middleware still DENIES
 *     service-key-only requests when the key is unset (no silent allow).
 */

import { logger } from '../utils/logger.js';

const DEV_JWT_FALLBACK = 'dev-secret-key-change-in-production';

export const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;

if (IS_PRODUCTION && !process.env.JWT_SECRET) {
  throw new Error(
    '[Secrets] JWT_SECRET must be set in production. ' +
    'Set it in Cloud Run env vars (same value as Monolit/Registry).'
  );
}

if (IS_PRODUCTION && !process.env.SERVICE_API_KEY) {
  throw new Error(
    '[Secrets] SERVICE_API_KEY must be set in production. ' +
    'Generate with `openssl rand -hex 32` and set it on Portal + all kiosk backends.'
  );
}

export const JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_FALLBACK;
export const SERVICE_API_KEY = process.env.SERVICE_API_KEY || null;

if (!process.env.JWT_SECRET) {
  logger.warn('[Secrets] JWT_SECRET not set — using dev fallback (dev only, never in production)');
}
if (!SERVICE_API_KEY) {
  logger.warn('[Secrets] SERVICE_API_KEY not set — service-key-authenticated requests will be denied');
}
