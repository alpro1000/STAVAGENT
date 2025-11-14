/**
 * JWT Authentication Middleware
 * Verifies JWT tokens in Authorization header
 * Format: Authorization: Bearer <token>
 */

import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

/**
 * Middleware to require valid JWT token
 * Attaches decoded token data to req.user
 *
 * 🚨 TEMPORARY DEV MODE: Set DISABLE_AUTH=true in env to bypass authentication
 */
export function requireAuth(req, res, next) {
  try {
    // 🚨 TEMPORARY: Dev mode bypass for calculator testing
    const TEMP_BYPASS_AUTH = process.env.DISABLE_AUTH === 'true';

    if (TEMP_BYPASS_AUTH) {
      // Mock user for dev mode
      req.user = {
        userId: 1,
        email: 'dev@test.com',
        role: 'admin',
        name: 'Dev User'
      };
      logger.warn('⚠️ [DEV MODE] Auth bypassed - using mock user');
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn(`Unauthorized access attempt to ${req.method} ${req.path} - no token provided`);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Chybí autorizační token'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      logger.warn(`Unauthorized access attempt to ${req.method} ${req.path} - invalid format`);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Neplatný formát tokenu (očekáváno: Bearer <token>)'
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        logger.warn(`Token expired for user: ${err.decoded?.userId}`);
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Token vypršel'
        });
      }

      logger.warn(`Invalid token provided - ${err.message}`);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Neplatný token'
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Chyba při ověřování autentizace'
    });
  }
}

/**
 * Generate JWT token for user
 * @param {Object} payload - User data to encode
 * @returns {string} JWT token
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify token without throwing error
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token or null if invalid
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}
