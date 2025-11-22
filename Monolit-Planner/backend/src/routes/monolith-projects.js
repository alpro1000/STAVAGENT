/**
 * MonolithProjects routes
 * Universal object API for all construction types (bridge, building, parking, road)
 *
 * GET    /api/monolith-projects              - List all projects
 * POST   /api/monolith-projects              - Create new project
 * GET    /api/monolith-projects/:id          - Get project details
 * PUT    /api/monolith-projects/:id          - Update project
 * DELETE /api/monolith-projects/:id          - Delete project
 * GET    /api/monolith-projects/search/:type - Search by type
 */

import express from 'express';
import db from '../db/init.js';
import { getPool } from '../db/postgres.js';
import { logger } from '../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';
import { createDefaultPositions } from '../utils/positionDefaults.js';

const router = express.Router();

// Apply authentication to all routes
router.use(requireAuth);

/**
 * GET /api/monolith-projects
 * List all projects for current user
 * Query params: type (optional), status (optional)
 */
router.get('/', async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { type, status } = req.query;

    let query = `
      SELECT
        mp.project_id,
        mp.project_id as bridge_id,
        mp.object_type,
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

    if (type) {
      query += ` AND mp.object_type = ?`;
      params.push(type);
    }

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
 * Create new project with parts (using transaction for PostgreSQL)
 */
router.post('/', async (req, res) => {
  // PostgreSQL client for transaction
  let client = null;

  try {
    const ownerId = req.user.userId;
    const {
      project_id,
      object_type,
      project_name,
      object_name,
      description,
      // Type-specific fields
      span_length_m,
      deck_width_m,
      pd_weeks,
      building_area_m2,
      building_floors,
      road_length_km,
      road_width_m
    } = req.body;

    logger.info(`[CREATE PROJECT] Starting creation for project_id: ${project_id}, type: ${object_type}`);
    logger.info(`[CREATE PROJECT] Owner ID: ${ownerId}, User: ${req.user?.email || 'unknown'}`);

    // Validation
    if (!project_id || !object_type) {
      logger.warn(`[CREATE PROJECT] Validation failed - missing required fields`);
      return res.status(400).json({ error: 'project_id and object_type are required' });
    }

    if (!['bridge', 'building', 'parking', 'road', 'custom'].includes(object_type)) {
      return res.status(400).json({ error: 'Invalid object_type' });
    }

    // Validate numeric fields (must be positive if provided)
    const numericFields = {
      span_length_m, deck_width_m, pd_weeks, building_area_m2,
      building_floors, road_length_km, road_width_m
    };

    for (const [field, value] of Object.entries(numericFields)) {
      if (value !== undefined && value !== null) {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
          return res.status(400).json({ error: `${field} must be a positive number` });
        }
      }
    }

    // Check if project already exists
    const existing = await db.prepare('SELECT project_id FROM monolith_projects WHERE project_id = ?').get(project_id);
    if (existing) {
      return res.status(409).json({ error: 'Project already exists' });
    }

    // Check if templates exist for this object type (CRITICAL: needed for default parts)
    logger.info(`[CREATE PROJECT] Checking for templates with object_type: ${object_type}`);
    const templates = await db.prepare(`
      SELECT * FROM part_templates
      WHERE object_type = ? AND is_default = true
      ORDER BY display_order
    `).all(object_type);

    logger.info(`[CREATE PROJECT] Found ${templates?.length || 0} templates for ${object_type}`);
    if (templates && templates.length > 0) {
      logger.info(`[CREATE PROJECT] Templates: ${templates.map(t => t.part_name).join(', ')}`);
    }

    if (!templates || templates.length === 0) {
      logger.error(`[CREATE PROJECT] ❌ No templates found for object_type: ${object_type}`);
      return res.status(503).json({
        error: `No part templates found for object type '${object_type}'. Please contact administrator to load templates.`,
        details: {
          object_type,
          available_templates: 0,
          required_for_creation: true
        }
      });
    }

    // ===== TRANSACTION START =====
    // Use single PostgreSQL client for atomicity
    try {
      const pool = getPool();
      client = await pool.connect();
      await client.query('BEGIN');
      logger.info(`[CREATE PROJECT] Transaction started`);

      // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
      const insertProjectSql = `
        INSERT INTO monolith_projects (
          project_id, object_type, project_name, object_name, owner_id, description,
          span_length_m, deck_width_m, pd_weeks,
          building_area_m2, building_floors,
          road_length_km, road_width_m
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `;

      logger.info(`[CREATE PROJECT] Creating project in database...`);
      await client.query(insertProjectSql, [
        project_id,
        object_type,
        project_name || '',
        object_name || '',
        ownerId,
        description || '',
        span_length_m || null,
        deck_width_m || null,
        pd_weeks || null,
        building_area_m2 || null,
        building_floors || null,
        road_length_km || null,
        road_width_m || null
      ]);
      logger.info(`[CREATE PROJECT] ✓ Project created successfully`);

      // Create default parts from templates (in same transaction)
      logger.info(`[CREATE PROJECT] Creating ${templates.length} default parts...`);
      const insertPartSql = `
        INSERT INTO parts (part_id, project_id, part_name, is_predefined)
        VALUES ($1, $2, $3, $4)
      `;

      // Batch insert all parts (MUCH FASTER with parameterized query)
      if (templates.length > 0) {
        const placeholders = templates.map((_, idx) => {
          const offset = idx * 4;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
        }).join(',');

        const values = [];
        for (const template of templates) {
          const partId = `${project_id}_${template.part_name}`;
          values.push(partId, project_id, template.part_name, true);
        }

        const batchInsertSql = `
          INSERT INTO parts (part_id, project_id, part_name, is_predefined)
          VALUES ${placeholders}
        `;

        await client.query(batchInsertSql, values);
        logger.info(`[CREATE PROJECT] 🚀 Batch inserted ${templates.length} parts successfully`);
      }

      // Create default positions for each template part (to show in manual mode)
      // This makes parts visible in the frontend even before adding specific items
      // Uses centralized position defaults from positionDefaults utility
      logger.info(`[CREATE PROJECT] Creating ${templates.length} default positions for manual mode...`);
      if (templates.length > 0) {
        try {
          // Use utility to create positions with consistent defaults
          const defaultPositions = createDefaultPositions(templates, project_id);

          if (!defaultPositions || defaultPositions.length === 0) {
            logger.warn(`[CREATE PROJECT] ⚠️  createDefaultPositions returned empty array`);
          } else {
            // Build batch INSERT statement
            const positionPlaceholders = defaultPositions.map((_, idx) => {
              const offset = idx * 11;
              return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`;
            }).join(',');

            const positionValues = [];
            for (const pos of defaultPositions) {
              positionValues.push(
                pos.id,
                pos.bridge_id,
                pos.part_name,
                pos.item_name,
                pos.subtype,
                pos.unit,
                pos.qty,
                pos.qty_m3_helper,
                pos.crew_size,
                pos.wage_czk_ph,
                pos.shift_hours,
                pos.days
              );
            }

            const insertPositionsSql = `
              INSERT INTO positions (id, bridge_id, part_name, item_name, subtype, unit, qty, qty_m3_helper, crew_size, wage_czk_ph, shift_hours, days)
              VALUES ${positionPlaceholders}
              ON CONFLICT (id) DO NOTHING
            `;

            await client.query(insertPositionsSql, positionValues);
            logger.info(`[CREATE PROJECT] ✓ Created ${templates.length} default positions with unified defaults`);
          }
        } catch (posError) {
          // Warn but don't fail if positions table has different schema
          logger.warn(`[CREATE PROJECT] ⚠️  Could not create default positions (may not be critical):`, posError.message);
        }
      }

      // Commit transaction
      await client.query('COMMIT');
      logger.info(`[CREATE PROJECT] Transaction committed`);
    } catch (txError) {
      if (client) {
        await client.query('ROLLBACK');
        logger.error(`[CREATE PROJECT] Transaction rolled back due to error`);
      }
      throw txError;
    } finally {
      if (client) {
        client.release();
      }
    }
    // ===== TRANSACTION END =====

    // Fetch created project
    const project = await db.prepare('SELECT * FROM monolith_projects WHERE project_id = ?').get(project_id);

    logger.info(`[CREATE PROJECT] ✅ SUCCESS - Project ${project_id} created with ${templates.length} parts`);

    res.status(201).json({
      ...project,
      bridge_id: project.project_id,  // Backward compatibility alias
      parts_count: templates.length
    });

    logger.info(`Created monolith project: ${project_id} (${object_type})`);
  } catch (error) {
    logger.error(`[CREATE PROJECT] ❌ FAILED - Error creating project:`, error);
    logger.error(`[CREATE PROJECT] Error stack:`, error.stack);
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

    // Get part templates for this object type
    const templates = await db.prepare(`
      SELECT * FROM part_templates WHERE object_type = ? ORDER BY display_order
    `).all(project.object_type);

    res.json({
      ...project,
      bridge_id: project.project_id,  // Backward compatibility alias
      parts,
      templates
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
      span_length_m,
      deck_width_m,
      pd_weeks,
      building_area_m2,
      building_floors,
      road_length_km,
      road_width_m,
      element_count,
      concrete_m3,
      sum_kros_czk
    } = req.body;

    // Validate numeric fields (must be positive if provided)
    const numericFields = {
      span_length_m, deck_width_m, pd_weeks, building_area_m2,
      building_floors, road_length_km, road_width_m,
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
        span_length_m = COALESCE(?, span_length_m),
        deck_width_m = COALESCE(?, deck_width_m),
        pd_weeks = COALESCE(?, pd_weeks),
        building_area_m2 = COALESCE(?, building_area_m2),
        building_floors = COALESCE(?, building_floors),
        road_length_km = COALESCE(?, road_length_km),
        road_width_m = COALESCE(?, road_width_m),
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
      span_length_m,
      deck_width_m,
      pd_weeks,
      building_area_m2,
      building_floors,
      road_length_km,
      road_width_m,
      element_count,
      concrete_m3,
      sum_kros_czk,
      id
    );

    const updated = await db.prepare('SELECT * FROM monolith_projects WHERE project_id = ?').get(id);

    res.json({
      ...updated,
      bridge_id: updated.project_id  // Backward compatibility alias
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

/**
 * GET /api/monolith-projects/search/:type
 * Search projects by type
 */
router.get('/search/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const ownerId = req.user.userId;

    if (!['bridge', 'building', 'parking', 'road', 'custom'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const projects = await db.prepare(`
      SELECT * FROM monolith_projects
      WHERE object_type = ? AND owner_id = ?
      ORDER BY created_at DESC
    `).all(type, ownerId);

    res.json(projects);
  } catch (error) {
    logger.error('Error searching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
