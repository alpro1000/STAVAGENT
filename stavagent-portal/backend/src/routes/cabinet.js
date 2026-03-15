/**
 * Cabinet routes — personal dashboard stats for authenticated user
 * GET /api/cabinet/stats
 */

import express from 'express';
import db from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET /api/cabinet/stats — projects count, files, storage used, org memberships
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Projects owned by user
    const projectsRow = await db.prepare(`
      SELECT COUNT(*) AS total FROM portal_projects WHERE owner_id = ?
    `).get(userId);

    // Files uploaded by user
    const filesRow = await db.prepare(`
      SELECT COUNT(*) AS total, COALESCE(SUM(file_size), 0) AS total_bytes
      FROM portal_files WHERE uploaded_by = ?
    `).get(userId);

    // Organizations the user belongs to (as active member)
    const orgs = await db.prepare(`
      SELECT o.id, o.name, o.slug, o.plan, m.role, m.joined_at
      FROM org_members m
      JOIN organizations o ON o.id = m.org_id
      WHERE m.user_id = ? AND m.joined_at IS NOT NULL
      ORDER BY m.joined_at DESC
    `).all(userId);

    // Owned organizations
    const ownedOrgsRow = await db.prepare(`
      SELECT COUNT(*) AS total FROM organizations WHERE owner_id = ?
    `).get(userId);

    res.json({
      success: true,
      stats: {
        projects: {
          total: parseInt(projectsRow?.total || 0, 10)
        },
        files: {
          total: parseInt(filesRow?.total || 0, 10),
          total_bytes: parseInt(filesRow?.total_bytes || 0, 10)
        },
        orgs: {
          member_of: orgs,
          owned: parseInt(ownedOrgsRow?.total || 0, 10)
        }
      }
    });
  } catch (error) {
    logger.error('Cabinet stats error:', error);
    res.status(500).json({ error: 'Server error fetching cabinet stats' });
  }
});

export default router;
