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
 * GET /api/debug/templates
 * Check part templates in database
 */
router.get('/templates', async (req, res) => {
  try {
    // Get all templates
    const allTemplates = await db.prepare(`
      SELECT * FROM part_templates ORDER BY object_type, display_order
    `).all();

    // Count by type
    const bridgeTemplates = allTemplates.filter(t => t.object_type === 'bridge');
    const buildingTemplates = allTemplates.filter(t => t.object_type === 'building');
    const parkingTemplates = allTemplates.filter(t => t.object_type === 'parking');
    const roadTemplates = allTemplates.filter(t => t.object_type === 'road');

    res.json({
      success: true,
      summary: {
        total: allTemplates.length,
        bridge: bridgeTemplates.length,
        building: buildingTemplates.length,
        parking: parkingTemplates.length,
        road: roadTemplates.length
      },
      templates: {
        bridge: bridgeTemplates,
        building: buildingTemplates,
        parking: parkingTemplates,
        road: roadTemplates
      },
      auth: {
        userId: req.user?.userId,
        email: req.user?.email,
        role: req.user?.role,
        authBypass: process.env.DISABLE_AUTH === 'true'
      }
    });
  } catch (error) {
    logger.error('Error in debug/templates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/debug/projects
 * List all projects with parts count
 */
router.get('/projects', async (req, res) => {
  try {
    const projects = await db.prepare(`
      SELECT
        mp.*,
        COUNT(DISTINCT p.part_id) as parts_count
      FROM monolith_projects mp
      LEFT JOIN parts p ON mp.project_id = p.project_id
      GROUP BY mp.project_id
      ORDER BY mp.created_at DESC
    `).all();

    res.json({
      success: true,
      count: projects.length,
      projects,
      auth: {
        userId: req.user?.userId,
        email: req.user?.email,
        role: req.user?.role
      }
    });
  } catch (error) {
    logger.error('Error in debug/projects:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/debug/parts/:projectId
 * List all parts for a project
 */
router.get('/parts/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const parts = await db.prepare(`
      SELECT * FROM parts WHERE project_id = ? ORDER BY part_name
    `).all(projectId);

    res.json({
      success: true,
      project_id: projectId,
      count: parts.length,
      parts
    });
  } catch (error) {
    logger.error('Error in debug/parts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/debug/health
 * Check overall system health
 */
router.get('/health', async (req, res) => {
  try {
    const templatesCount = await db.prepare('SELECT COUNT(*) as count FROM part_templates').get();
    const projectsCount = await db.prepare('SELECT COUNT(*) as count FROM monolith_projects').get();
    const partsCount = await db.prepare('SELECT COUNT(*) as count FROM parts').get();
    const usersCount = await db.prepare('SELECT COUNT(*) as count FROM users').get();

    res.json({
      success: true,
      database: {
        templates: templatesCount.count,
        projects: projectsCount.count,
        parts: partsCount.count,
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
