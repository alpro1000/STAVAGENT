/**
 * MonolithProjects routes - VARIANT 1 (Single Object Type)
 * Simple universal API for all projects (bridges, buildings, roads, etc.)
 * User describes type in object_name field.
 *
 * GET    /api/monolith-projects              - List all projects
 * POST   /api/monolith-projects              - Create new project
 * GET    /api/monolith-projects/:id          - Get project details
 * PUT    /api/monolith-projects/:id          - Update project
 * DELETE /api/monolith-projects/:id          - Delete project
 */

import express from 'express';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { createDefaultPositions } from '../utils/positionDefaults.js';

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * GET /api/monolith-projects
 * List all projects for current user
 * Query params: status (optional)
 */
router.get('/', async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { status } = req.query;

    let query = `
      SELECT
        mp.project_id,
        mp.project_id as bridge_id,
        mp.project_name,
        mp.object_name,
        mp.status,
        mp.created_at,
        mp.updated_at,
        mp.element_count,
        mp.concrete_m3,
        mp.sum_kros_czk,
        mp.description,
        COUNT(DISTINCT p.part_id) as parts_count
      FROM monolith_projects mp
      LEFT JOIN parts p ON mp.project_id = p.project_id
      WHERE mp.owner_id = ?
    `;

    const params = [ownerId];

    if (status) {
      query += ` AND mp.status = ?`;
      params.push(status);
    }

    query += ` GROUP BY mp.project_id ORDER BY mp.status DESC, mp.created_at DESC`;

    const projects = await db.prepare(query).all(...params);

    res.json(projects);
  } catch (error) {
    logger.error('Error fetching monolith projects:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/monolith-projects
 * Create new project with default parts
 *
 * Request body:
 * {
 *   project_id: "SO201"           (required)
 *   project_name: "D6 Project"    (optional)
 *   object_name: "Мост через реку" (optional)
 *   description: "..."            (optional)
 * }
 */
router.post('/', async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const {
      project_id,
      project_name,
      object_name,
      description
    } = req.body;

    logger.info(`[CREATE PROJECT] Starting creation for project_id: ${project_id}`);
    logger.info(`[CREATE PROJECT] Owner ID: ${ownerId}, User: ${req.user?.email || 'unknown'}`);

    // Validation
    if (!project_id) {
      logger.warn(`[CREATE PROJECT] Validation failed - missing project_id`);
      return res.status(400).json({ error: 'project_id is required' });
    }

    // Check if project already exists
    const existing = await db.prepare('SELECT project_id FROM monolith_projects WHERE project_id = ?').get(project_id);
    if (existing) {
      return res.status(409).json({ error: 'Project already exists' });
    }

    // Get default templates (universal, not type-specific)
    logger.info(`[CREATE PROJECT] 🔍 Loading default part templates...`);
    const templates = await db.prepare(`
      SELECT * FROM part_templates
      WHERE is_default = true
      ORDER BY display_order
    `).all();

    const templateCount = templates?.length || 0;
    logger.info(`[CREATE PROJECT] Found ${templateCount} default templates`);

    if (templates && templates.length > 0) {
      logger.debug(`[CREATE PROJECT] Template names: ${templates.map(t => t.part_name).join(', ')}`);
    }

    // ===== TRANSACTION START =====
    await db.transaction(async (client) => {
      logger.info(`[CREATE PROJECT] Transaction started`);

      // Create project
      const insertProjectSql = `
        INSERT INTO monolith_projects (
          project_id, project_name, object_name, owner_id, description
        ) VALUES (?, ?, ?, ?, ?)
      `;

      logger.info(`[CREATE PROJECT] Creating project in database...`);
      await db.prepare(insertProjectSql).run(
        project_id,
        project_name || '',
        object_name || '',
        ownerId,
        description || ''
      );
      logger.info(`[CREATE PROJECT] ✓ Project created successfully`);

      // Create default parts from templates
      logger.info(`[CREATE PROJECT] Creating ${templates.length} default parts...`);
      if (templates.length > 0) {
        for (const template of templates) {
          const partId = `${project_id}_${template.part_name}`;
          await db.prepare(`
            INSERT INTO parts (part_id, project_id, part_name, is_predefined)
            VALUES (?, ?, ?, ?)
          `).run(partId, project_id, template.part_name, 1);
        }
        logger.info(`[CREATE PROJECT] ✓ Created ${templates.length} parts successfully`);
      }

      // Create default positions for each template part
      logger.info(`[CREATE PROJECT] Creating ${templates.length} default positions...`);
      if (templates.length > 0) {
        try {
          const defaultPositions = createDefaultPositions(templates, project_id);

          if (defaultPositions && defaultPositions.length > 0) {
            for (const pos of defaultPositions) {
              await db.prepare(`
                INSERT INTO positions (
                  id, bridge_id, part_name, item_name, subtype, unit,
                  qty, crew_size, wage_czk_ph, shift_hours, days
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                pos.id,
                pos.bridge_id,
                pos.part_name,
                pos.item_name,
                pos.subtype,
                pos.unit,
                pos.qty,
                pos.crew_size,
                pos.wage_czk_ph,
                pos.shift_hours,
                pos.days
              );
            }
            logger.info(`[CREATE PROJECT] ✓ Created ${defaultPositions.length} default positions`);
          }
        } catch (posError) {
          // Non-fatal: position creation failed but project/parts were created
          logger.warn(`[CREATE PROJECT] ⚠️  Could not create default positions:`, posError.message);
        }
      }

      logger.info(`[CREATE PROJECT] Transaction committed`);
    })(); // db.transaction() handles BEGIN/COMMIT/ROLLBACK automatically
    // ===== TRANSACTION END =====

    // Fetch created project
    const project = await db.prepare('SELECT * FROM monolith_projects WHERE project_id = ?').get(project_id);

    if (!project) {
      logger.error(`[CREATE PROJECT] ⚠️  Project was created but could not be fetched back`);
      return res.status(201).json({
        project_id,
        project_name: project_name || '',
        object_name: object_name || '',
        bridge_id: project_id  // Backward compatibility
      });
    }

    logger.info(`[CREATE PROJECT] ✅ SUCCESS - Project ${project_id} created with ${templateCount} parts`);

    return res.status(201).json({
      ...project,
      bridge_id: project.project_id  // Backward compatibility
    });
  } catch (error) {
    logger.error(`[CREATE PROJECT] ❌ FAILED:`, error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monolith-projects/:id
 * Get project details with all parts
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user.userId;

    // Get project (check ownership)
    const project = await db.prepare(`
      SELECT * FROM monolith_projects WHERE project_id = ? AND owner_id = ?
    `).get(id, ownerId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    // Get all parts for this project
    const parts = await db.prepare(`
      SELECT * FROM parts WHERE project_id = ? ORDER BY part_name
    `).all(id);

    res.json({
      ...project,
      bridge_id: project.project_id,  // Backward compatibility
      parts
    });
  } catch (error) {
    logger.error('Error fetching monolith project:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/monolith-projects/:id
 * Update project
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user.userId;

    // Check ownership
    const project = await db.prepare(`
      SELECT * FROM monolith_projects WHERE project_id = ? AND owner_id = ?
    `).get(id, ownerId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const {
      project_name,
      object_name,
      description,
      status,
      element_count,
      concrete_m3,
      sum_kros_czk
    } = req.body;

    // Validate numeric fields (must be positive if provided)
    const numericFields = {
      element_count, concrete_m3, sum_kros_czk
    };

    for (const [field, value] of Object.entries(numericFields)) {
      if (value !== undefined && value !== null) {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
          return res.status(400).json({ error: `${field} must be a positive number` });
        }
      }
    }

    // Update project
    await db.prepare(`
      UPDATE monolith_projects SET
        project_name = COALESCE(?, project_name),
        object_name = COALESCE(?, object_name),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        element_count = COALESCE(?, element_count),
        concrete_m3 = COALESCE(?, concrete_m3),
        sum_kros_czk = COALESCE(?, sum_kros_czk),
        updated_at = CURRENT_TIMESTAMP
      WHERE project_id = ?
    `).run(
      project_name,
      object_name,
      description,
      status,
      element_count,
      concrete_m3,
      sum_kros_czk,
      id
    );

    const updated = await db.prepare('SELECT * FROM monolith_projects WHERE project_id = ?').get(id);

    res.json({
      ...updated,
      bridge_id: updated.project_id
    });
    logger.info(`Updated monolith project: ${id}`);
  } catch (error) {
    logger.error('Error updating monolith project:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/monolith-projects/:id
 * Delete project (and all related parts)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ownerId = req.user.userId;

    // Check ownership
    const project = await db.prepare(`
      SELECT * FROM monolith_projects WHERE project_id = ? AND owner_id = ?
    `).get(id, ownerId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    // Delete project (parts will be deleted by CASCADE)
    await db.prepare('DELETE FROM monolith_projects WHERE project_id = ?').run(id);

    res.json({ message: 'Project deleted successfully' });
    logger.info(`Deleted monolith project: ${id}`);
  } catch (error) {
    logger.error('Error deleting monolith project:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
