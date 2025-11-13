/**
 * Parts routes
 * Part templates and parts management API
 *
 * GET    /api/part-templates              - Get all templates or by type (query param)
 * GET    /api/parts/list/:projectId       - Get parts for project
 * POST   /api/parts                       - Create new part
 * PUT    /api/parts/:partId               - Update part
 * DELETE /api/parts/:partId               - Delete part
 */

import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// ===================== PART TEMPLATES (NO AUTH REQUIRED) =====================

/**
 * GET /api/parts/templates
 * Get all part templates, optionally filtered by type
 * Query params: type (optional)
 */
router.get('/templates', async (req, res) => {
  try {
    const { type } = req.query;

    let query = 'SELECT * FROM part_templates';
    const params = [];

    if (type) {
      query += ' WHERE object_type = ?';
      params.push(type);
    }

    query += ' ORDER BY object_type, display_order';

    const templates = await db.prepare(query).all(...params);

    res.json(templates);
  } catch (error) {
    logger.error('Error fetching part templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===================== PROTECTED ROUTES (AUTH REQUIRED) =====================

// Apply authentication to remaining routes
router.use(requireAuth);

/**
 * GET /api/parts/list/:projectId
 * Get all parts for a project
 */
router.get('/list/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const ownerId = req.user.userId;

    // Verify project ownership
    const project = await db.prepare(`
      SELECT project_id FROM monolith_projects WHERE project_id = ? AND owner_id = ?
    `).get(projectId, ownerId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    // Get all parts for this project
    // Note: positions are still linked to legacy bridges table, not monolith_projects
    // So we count by part_name only (architectural issue to fix in Phase 2)
    const parts = await db.prepare(`
      SELECT
        p.part_id,
        p.project_id,
        p.part_name,
        p.is_predefined,
        p.created_at,
        p.updated_at,
        COUNT(DISTINCT pos.id) as positions_count
      FROM parts p
      LEFT JOIN positions pos ON p.part_name = pos.part_name
      WHERE p.project_id = ?
      GROUP BY p.part_id
      ORDER BY p.part_name
    `).all(projectId);

    res.json(parts);
  } catch (error) {
    logger.error('Error fetching parts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/parts
 * Create new part for a project
 */
router.post('/', async (req, res) => {
  try {
    const { project_id, part_name, is_predefined } = req.body;
    const ownerId = req.user.userId;

    // Validation
    if (!project_id || !part_name) {
      return res.status(400).json({ error: 'project_id and part_name are required' });
    }

    // Verify project ownership
    const project = await db.prepare(`
      SELECT project_id FROM monolith_projects WHERE project_id = ? AND owner_id = ?
    `).get(project_id, ownerId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    // Generate part ID using UUID for collision-free uniqueness
    const partId = randomUUID();

    // Create part
    await db.prepare(`
      INSERT INTO parts (part_id, project_id, part_name, is_predefined)
      VALUES (?, ?, ?, ?)
    `).run(
      partId,
      project_id,
      part_name,
      is_predefined ? 1 : 0
    );

    const part = await db.prepare('SELECT * FROM parts WHERE part_id = ?').get(partId);

    res.status(201).json(part);
    logger.info(`Created part: ${partId}`);
  } catch (error) {
    logger.error('Error creating part:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/parts/:partId
 * Update part
 */
router.put('/:partId', async (req, res) => {
  try {
    const { partId } = req.params;
    const { part_name } = req.body;
    const ownerId = req.user.userId;

    // Get part and verify ownership
    const part = await db.prepare(`
      SELECT p.* FROM parts p
      JOIN monolith_projects mp ON p.project_id = mp.project_id
      WHERE p.part_id = ? AND mp.owner_id = ?
    `).get(partId, ownerId);

    if (!part) {
      return res.status(404).json({ error: 'Part not found or access denied' });
    }

    // Check if part_name is being changed
    if (part_name !== undefined && part_name !== part.part_name) {
      // Check if there are any positions associated with this part
      const positionsCount = await db.prepare(`
        SELECT COUNT(*) as count FROM positions WHERE part_name = ?
      `).get(part.part_name);

      if (positionsCount && positionsCount.count > 0) {
        return res.status(400).json({
          error: `Cannot rename part "${part.part_name}" because it has ${positionsCount.count} associated position(s). Delete all positions before renaming.`,
          details: {
            current_name: part.part_name,
            new_name: part_name,
            associated_positions: positionsCount.count
          }
        });
      }
    }

    // Update part
    const updates = [];
    const values = [];

    if (part_name !== undefined) {
      updates.push('part_name = ?');
      values.push(part_name);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(partId);

    await db.prepare(`
      UPDATE parts SET ${updates.join(', ')} WHERE part_id = ?
    `).run(...values);

    const updated = await db.prepare('SELECT * FROM parts WHERE part_id = ?').get(partId);

    res.json(updated);
    logger.info(`Updated part: ${partId}`);
  } catch (error) {
    logger.error('Error updating part:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/parts/:partId
 * Delete part
 */
router.delete('/:partId', async (req, res) => {
  try {
    const { partId } = req.params;
    const ownerId = req.user.userId;

    // Get part and verify ownership
    const part = await db.prepare(`
      SELECT p.* FROM parts p
      JOIN monolith_projects mp ON p.project_id = mp.project_id
      WHERE p.part_id = ? AND mp.owner_id = ?
    `).get(partId, ownerId);

    if (!part) {
      return res.status(404).json({ error: 'Part not found or access denied' });
    }

    // Delete part
    await db.prepare('DELETE FROM parts WHERE part_id = ?').run(partId);

    res.json({ message: 'Part deleted successfully' });
    logger.info(`Deleted part: ${partId}`);
  } catch (error) {
    logger.error('Error deleting part:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/parts/:projectId (keep for backward compatibility)
 * Redirect to /api/parts/list/:projectId
 */
router.get('/:projectId', async (req, res) => {
  // Check if this is actually a list request (not template request)
  if (req.params.projectId && req.params.projectId !== 'templates') {
    return res.redirect(307, `/api/parts/list/${req.params.projectId}`);
  }
  res.status(404).json({ error: 'Not Found' });
});

export default router;
