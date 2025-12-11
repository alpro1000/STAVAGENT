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
 * Create new project with parts (using unified transaction interface)
 */
router.post('/', async (req, res) => {
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

    // SAFETY CHECK: Verify templates exist for this object type (CRITICAL: needed for default parts)
    logger.info(`[CREATE PROJECT] 🔍 Checking for templates with object_type: ${object_type}`);
    const templates = await db.prepare(`
      SELECT * FROM part_templates
      WHERE object_type = ? AND is_default = true
      ORDER BY display_order
    `).all(object_type);

    const templateCount = templates?.length || 0;
    logger.info(`[CREATE PROJECT] Found ${templateCount} templates for ${object_type}`);

    if (templates && templates.length > 0) {
      logger.debug(`[CREATE PROJECT] Template names: ${templates.map(t => t.part_name).join(', ')}`);
    }

    // SAFETY: Reject project creation if no templates found
    if (!templates || templates.length === 0) {
      logger.error(`[CREATE PROJECT] ❌ SAFETY CHECK FAILED - No templates found for object_type: ${object_type}`);
      logger.error(`[CREATE PROJECT] ℹ️  Template loading may have failed during startup. Check autoLoadPartTemplatesIfNeeded() logs.`);

      // Try to provide helpful debugging info
      const allTemplateCount = await db.prepare('SELECT COUNT(*) as count FROM part_templates').get();
      logger.error(`[CREATE PROJECT] Total templates in database: ${allTemplateCount.count}`);

      const typesCounts = await db.prepare(`
        SELECT object_type, COUNT(*) as count
        FROM part_templates
        GROUP BY object_type
      `).all();
      logger.error(`[CREATE PROJECT] Available object types with counts:`, JSON.stringify(typesCounts));

      return res.status(503).json({
        error: `Template loading failed for '${object_type}'. Please contact administrator.`,
        details: {
          object_type,
          available_templates: templateCount,
          total_templates_in_db: allTemplateCount.count,
          available_types: typesCounts.map(t => ({ type: t.object_type, count: t.count })),
          required_for_creation: true,
          suggestion: 'Restart application to trigger template loading, or check server logs for autoLoadPartTemplatesIfNeeded() errors'
        }
      });
    }

    // SAFETY: Log that we passed the template check
    logger.info(`[CREATE PROJECT] ✅ SAFETY CHECK PASSED - ${templateCount} templates ready for ${object_type}`);

    // ===== TRANSACTION START =====
    // Use unified db.transaction() interface for atomicity
    // Works with both SQLite (development) and PostgreSQL (production)
    await db.transaction(async (client) => {
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

      // Create corresponding bridge record for FK constraint satisfaction (if type is bridge)
      // This ensures positions table can reference bridge_id
      if (object_type === 'bridge') {
        logger.info(`[CREATE PROJECT] Creating bridge record for FK constraint...`);
        const insertBridgeSql = `
          INSERT INTO bridges (bridge_id, object_name, span_length_m, deck_width_m, pd_weeks, owner_id)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;

        await client.query(insertBridgeSql, [
          project_id,
          object_name || '',
          span_length_m || null,
          deck_width_m || null,
          pd_weeks || null,
          ownerId
        ]);
        logger.info(`[CREATE PROJECT] ✓ Bridge record created for FK satisfaction`);
      }

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
      // NOTE: Position creation is optional for monolith-projects due to FK constraint to bridges table
      // TODO: Refactor to support positions for all object types (not just bridges)
      logger.info(`[CREATE PROJECT] Creating ${templates.length} default positions for manual mode...`);
      if (templates.length > 0 && object_type === 'bridge') {
        try {
          // Only create positions for bridge type (positions table has FK to bridges)
          // Use utility to create positions with consistent defaults
          const defaultPositions = createDefaultPositions(templates, project_id);

          if (!defaultPositions || defaultPositions.length === 0) {
            logger.warn(`[CREATE PROJECT] ⚠️  createDefaultPositions returned empty array`);
          } else {
            // Build batch INSERT statement
            // Note: 12 columns require 12 placeholders per position
            const positionPlaceholders = defaultPositions.map((_, idx) => {
              const offset = idx * 12;  // 12 columns: id, bridge_id, part_name, item_name, subtype, unit, qty, qty_m3_helper, crew_size, wage_czk_ph, shift_hours, days
              return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12})`;
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
          // Non-fatal: position creation failed but project/parts were created
          logger.warn(`[CREATE PROJECT] ⚠️  Could not create default positions:`, posError.message);
        }
      } else if (templates.length > 0) {
        // For non-bridge types, skip position creation (schema limitation)
        logger.info(`[CREATE PROJECT] ℹ️  Skipped position creation for object_type=${object_type} (currently only supported for bridges)`);
      }

      logger.info(`[CREATE PROJECT] Transaction committed`);
    })(); // db.transaction() handles BEGIN/COMMIT/ROLLBACK automatically
    // ===== TRANSACTION END =====

    // Fetch created project AFTER transaction
    // Using unified db interface (automatically selects SQLite or PostgreSQL)
    const project = await db.prepare('SELECT * FROM monolith_projects WHERE project_id = ?').get(project_id);

    if (!project) {
      logger.error(`[CREATE PROJECT] ⚠️  Project was created but could not be fetched back`);
      // Return basic response even if fetch failed
      return res.status(201).json({
        project_id,
        object_type,
        project_name: project_name || '',
        object_name: object_name || '',
        bridge_id: project_id,  // Backward compatibility alias
        parts_count: templates.length
      });
    }

    logger.info(`[CREATE PROJECT] ✅ SUCCESS - Project ${project_id} created with ${templates.length} parts`);

    return res.status(201).json({
      ...project,
      bridge_id: project.project_id,  // Backward compatibility alias
      parts_count: templates.length
    });
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
