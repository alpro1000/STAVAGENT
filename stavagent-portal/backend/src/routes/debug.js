/**
 * DEBUG ROUTES - For development/testing only
 * 🚨 DISABLE IN PRODUCTION!
 */

import express from 'express';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * GET /api/debug/health
 * Check overall system health
 */
router.get('/health', async (req, res) => {
  try {
    const projectsCount = await db.prepare('SELECT COUNT(*) as count FROM monolith_projects').get();
    const usersCount = await db.prepare('SELECT COUNT(*) as count FROM users').get();

    res.json({
      success: true,
      database: {
        projects: projectsCount.count,
        users: usersCount.count
      },
      auth: {
        bypassEnabled: process.env.DISABLE_AUTH === 'true',
        userId: req.user?.userId,
        email: req.user?.email,
        role: req.user?.role
      },
      environment: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        DATABASE: process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite'
      }
    });
  } catch (error) {
    logger.error('Error in debug/health:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
