/**
 * Admin-Only Middleware
 * Ensures user has admin role before allowing access
 * Must be used AFTER requireAuth middleware
 */

import { logger } from '../utils/logger.js';

/**
 * Middleware to require admin role
 * Must be chained after requireAuth middleware
 * @example
 * router.post('/admin/users', requireAuth, adminOnly, (req, res) => { ... })
 */
export function adminOnly(req, res, next) {
  try {
    // Verify that requireAuth has been called and user is set
    if (!req.user) {
      logger.warn(`Admin access attempt without user context on ${req.method} ${req.path}`);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Chybí autentizace'
      });
    }

    // Check if user has admin role
    if (req.user.role !== 'admin') {
      logger.warn(`Unauthorized admin access attempt by user ${req.user.userId} (role: ${req.user.role}) to ${req.method} ${req.path}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Nedostatečná práva pro tuto operaci (vyžaduje admin)'
      });
    }

    // User is authenticated and has admin role
    next();
  } catch (error) {
    logger.error('Admin-only middleware error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Chyba při kontrole práv'
    });
  }
}
