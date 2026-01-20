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
// NOTE: createDefaultPositions removed - templates only used during Excel import (parser-driven)

const router = express.Router();

// NO AUTH REQUIRED - This is a public kiosk application
// Authentication is handled at the portal level (stavagent-portal)

/**
 * GET /api/monolith-projects
 * List all projects (no auth filtering - kiosk mode)
 * Query params: status (optional)
 */
router.get('/', async (req, res) => {
  try {
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
    `;

    const params = [];

    if (status) {
      query += ` WHERE mp.status = ?`;
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
 * Create new EMPTY project (no templates auto-loaded)
 * User adds parts manually via "🏗️ Přidat část konstrukce"
 * Templates are only used during Excel import (parser-driven)
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
    // No auth - use default owner_id (kiosk mode)
    const ownerId = req.user?.userId || 1;
    const {
      project_id,
      project_name,
      object_name,
      description
    } = req.body;

    logger.info(`[CREATE PROJECT] Starting creation for project_id: ${project_id}`);
    logger.info(`[CREATE PROJECT] Owner ID: ${ownerId} (kiosk mode)`);

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

    // ===== CREATE EMPTY PROJECT (no templates) =====
    logger.info(`[CREATE PROJECT] Creating empty project (no templates)...`);

    // Create project
    const insertProjectSql = `
      INSERT INTO monolith_projects (
        project_id, project_name, object_name, owner_id, description
      ) VALUES (?, ?, ?, ?, ?)
    `;

    await db.prepare(insertProjectSql).run(
      project_id,
      project_name || '',
      object_name || '',
      ownerId,
      description || ''
    );
    logger.info(`[CREATE PROJECT] ✓ Project created successfully`);

    // Create corresponding bridge entry for FK constraint compatibility
    // The positions table still references bridges(bridge_id), so we need this entry
    logger.info(`[CREATE PROJECT] Creating bridge entry for FK compatibility...`);
    try {
      await db.prepare(`
        INSERT INTO bridges (bridge_id, object_name, status, project_name)
        VALUES (?, ?, 'active', ?)
        ON CONFLICT (bridge_id) DO NOTHING
      `).run(project_id, object_name || project_id, project_name || 'Manual');
      logger.info(`[CREATE PROJECT] ✓ Bridge entry created (FK compatibility)`);
    } catch (bridgeError) {
      // Non-fatal: bridge entry creation failed but project was created
      logger.warn(`[CREATE PROJECT] ⚠️  Could not create bridge entry (non-fatal):`, bridgeError.message);
    }

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

    logger.info(`[CREATE PROJECT] ✅ SUCCESS - Empty project ${project_id} created (add parts manually)`);

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
 * DELETE /api/monolith-projects/by-project-name/:projectName
 * Delete ALL projects with matching project_name (group deletion)
 * This deletes an entire "project folder" in the sidebar
 *
 * IMPORTANT: This route MUST be defined BEFORE /:id to avoid conflicts!
 *
 * Special case: "Bez projektu" maps to NULL project_name in DB
 */
router.delete('/by-project-name/:projectName', async (req, res) => {
  try {
    const projectName = decodeURIComponent(req.params.projectName);

    logger.info(`[DELETE PROJECT] Deleting all objects with project_name: "${projectName}"`);

    // Special handling: "Bez projektu" in UI means NULL in DB
    const isNullProject = projectName === 'Bez projektu';

    // Find all projects with this project_name (or NULL if "Bez projektu")
    let projectsToDelete;
    if (isNullProject) {
      projectsToDelete = await db.prepare(`
        SELECT project_id FROM monolith_projects WHERE project_name IS NULL
      `).all();
    } else {
      projectsToDelete = await db.prepare(`
        SELECT project_id FROM monolith_projects WHERE project_name = ?
      `).all(projectName);
    }

    if (projectsToDelete.length === 0) {
      return res.status(404).json({ error: 'No projects found with this project_name' });
    }

    const projectIds = projectsToDelete.map(p => p.project_id);
    logger.info(`[DELETE PROJECT] Found ${projectIds.length} objects to delete: ${projectIds.join(', ')}`);

    // Delete from monolith_projects (positions will be deleted by CASCADE)
    let deleteProjectsResult;
    if (isNullProject) {
      deleteProjectsResult = await db.prepare(`
        DELETE FROM monolith_projects WHERE project_name IS NULL
      `).run();
    } else {
      deleteProjectsResult = await db.prepare(`
        DELETE FROM monolith_projects WHERE project_name = ?
      `).run(projectName);
    }

    // Also delete from bridges table (for FK compatibility)
    let deleteBridgesResult;
    if (isNullProject) {
      deleteBridgesResult = await db.prepare(`
        DELETE FROM bridges WHERE project_name IS NULL
      `).run();
    } else {
      deleteBridgesResult = await db.prepare(`
        DELETE FROM bridges WHERE project_name = ?
      `).run(projectName);
    }

    logger.info(`[DELETE PROJECT] ✓ Deleted ${deleteProjectsResult.changes} from monolith_projects, ${deleteBridgesResult.changes} from bridges`);

    res.json({
      success: true,
      message: `Deleted ${projectIds.length} objects from project "${projectName}"`,
      deleted_count: projectIds.length,
      deleted_ids: projectIds
    });
  } catch (error) {
    logger.error('[DELETE PROJECT] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monolith-projects/:id
 * Get project details with all parts (no auth - kiosk mode)
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`[GET PROJECT] Requesting project with ID: "${id}"`);

    // Get project (no ownership check - kiosk mode)
    const project = await db.prepare(`
      SELECT * FROM monolith_projects WHERE project_id = ?
    `).get(id);

    if (!project) {
      logger.warn(`[GET PROJECT] Project not found with ID: "${id}"`);
      // Log all existing project IDs for debugging
      const allProjects = await db.prepare(`
        SELECT project_id FROM monolith_projects LIMIT 20
      `).all();
      logger.info(`[GET PROJECT] Existing projects: ${allProjects.map(p => p.project_id).join(', ')}`);
      return res.status(404).json({ error: 'Project not found' });
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
 * Update project (no auth - kiosk mode)
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`[PUT PROJECT] Updating project with ID: "${id}"`);
    logger.info(`[PUT PROJECT] Update payload:`, req.body);

    // Check project exists (no ownership check - kiosk mode)
    const project = await db.prepare(`
      SELECT * FROM monolith_projects WHERE project_id = ?
    `).get(id);

    if (!project) {
      logger.warn(`[PUT PROJECT] Project not found with ID: "${id}"`);
      // Log all existing project IDs for debugging
      const allProjects = await db.prepare(`
        SELECT project_id FROM monolith_projects LIMIT 20
      `).all();
      logger.info(`[PUT PROJECT] Existing projects: ${allProjects.map(p => p.project_id).join(', ')}`);
      return res.status(404).json({ error: 'Project not found' });
    }

    logger.info(`[PUT PROJECT] Found project: ${project.project_id}, current status: ${project.status}`);

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

    logger.info(`[PUT PROJECT] ✓ Successfully updated project: ${id}, new status: ${updated.status}`);

    res.json({
      ...updated,
      bridge_id: updated.project_id
    });
  } catch (error) {
    logger.error('Error updating monolith project:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/monolith-projects/debug/database
 * TEMPORARY: Debug endpoint to check database contents
 */
router.get('/debug/database', async (req, res) => {
  try {
    logger.info('[DEBUG] Checking database contents...');

    // Get all projects with ALL columns
    const projects = await db.prepare(`
      SELECT * FROM monolith_projects ORDER BY created_at DESC LIMIT 100
    `).all();

    // Get all positions count
    const positionsCount = await db.prepare(`
      SELECT COUNT(*) as count FROM positions
    `).get();

    // Get all bridges (old table)
    const bridges = await db.prepare(`
      SELECT * FROM bridges ORDER BY created_at DESC LIMIT 100
    `).all();

    logger.info(`[DEBUG] Found ${projects.length} projects in monolith_projects`);
    logger.info(`[DEBUG] Found ${positionsCount.count} positions`);
    logger.info(`[DEBUG] Found ${bridges.length} bridges in old table`);

    res.json({
      monolith_projects: {
        count: projects.length,
        data: projects
      },
      positions: {
        count: positionsCount.count
      },
      bridges: {
        count: bridges.length,
        data: bridges
      },
      message: 'Database debug info - this endpoint will be removed after diagnosis'
    });
  } catch (error) {
    logger.error('[DEBUG] Error checking database:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

/**
 * DELETE /api/monolith-projects/:id
 * Delete project (and all related parts) - no auth (kiosk mode)
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check project exists (no ownership check - kiosk mode)
    const project = await db.prepare(`
      SELECT * FROM monolith_projects WHERE project_id = ?
    `).get(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
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
