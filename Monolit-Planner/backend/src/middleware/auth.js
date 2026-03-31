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
