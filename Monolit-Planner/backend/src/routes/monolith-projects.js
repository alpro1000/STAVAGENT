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
 *
 * Portal Integration (Phase 7):
 * POST   /api/monolith-projects/:id/link-portal   - Link to Portal
 * DELETE /api/monolith-projects/:id/link-portal   - Unlink from Portal
 */

import express from 'express';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';
import { optionalAuth } from '../middleware/auth.js';
// NOTE: createDefaultPositions removed - templates only used during Excel import (parser-driven)

const router = express.Router();

// Optional auth: if Portal JWT is present, extract user for account isolation.
// Unauthenticated requests still work (kiosk mode) but see only legacy projects.
router.use(optionalAuth);

/**
 * GET /api/monolith-projects
 * List projects filtered by account.
 * - Authenticated (Portal JWT): only projects with matching portal_user_id
 * - Unauthenticated (kiosk mode): only legacy projects (portal_user_id IS NULL)
 * Query params: status (optional)
 */
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const portalUserId = req.user?.userId || null;

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

    const conditions = [];
    const params = [];

    // Account isolation: filter by portal_user_id
    if (portalUserId) {
      conditions.push('mp.portal_user_id = ?');
      params.push(portalUserId);
    } else {
      // Kiosk mode: only show legacy projects without owner
      conditions.push('mp.portal_user_id IS NULL');
    }

    if (status) {
      conditions.push('mp.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
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
    const ownerId = req.user?.userId || 1;
    const portalUserId = req.user?.userId || null;
    const {
      project_id,
      project_name,
      object_name,
      description
    } = req.body;

    logger.info(`[CREATE PROJECT] Starting creation for project_id: ${project_id}`);
    logger.info(`[CREATE PROJECT] Owner ID: ${ownerId}, Portal User ID: ${portalUserId}`);

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

    // Create project with portal_user_id for account isolation
    const insertProjectSql = `
      INSERT INTO monolith_projects (
        project_id, project_name, object_name, owner_id, description, portal_user_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.prepare(insertProjectSql).run(
      project_id,
      project_name || '',
      object_name || '',
      ownerId,
      description || '',
      portalUserId
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
 * PUT /api/monolith-projects/rename-project/:projectName
 * Rename project - updates project_name for ALL objects with this name
 * Body: { new_name: string }
 */
router.put('/rename-project/:projectName', async (req, res) => {
  try {
    const oldName = decodeURIComponent(req.params.projectName);
    const { new_name } = req.body;
    const portalUserId = req.user?.userId || null;

    if (!new_name || !new_name.trim()) {
      return res.status(400).json({ error: 'new_name is required' });
    }

    const newName = new_name.trim();
    logger.info(`[RENAME PROJECT] "${oldName}" → "${newName}"`);

    // Special handling: "Bez projektu" in UI means NULL in DB
    const isNullProject = oldName === 'Bez projektu';

    // Build ownership condition
    const ownerCondition = portalUserId
      ? 'AND portal_user_id = ?'
      : 'AND portal_user_id IS NULL';
    const ownerParam = portalUserId ? [portalUserId] : [];

    // Count affected objects (scoped to current account)
    let affectedObjects;
    if (isNullProject) {
      affectedObjects = await db.prepare(
        `SELECT COUNT(*) as count FROM monolith_projects WHERE project_name IS NULL ${ownerCondition}`
      ).get(...ownerParam);
    } else {
      affectedObjects = await db.prepare(
        `SELECT COUNT(*) as count FROM monolith_projects WHERE project_name = ? ${ownerCondition}`
      ).get(oldName, ...ownerParam);
    }

    if (affectedObjects.count === 0) {
      return res.status(404).json({ error: 'No objects found with this project name' });
    }

    // Update monolith_projects (scoped to current account)
    if (isNullProject) {
      await db.prepare(
        `UPDATE monolith_projects SET project_name = ?, updated_at = CURRENT_TIMESTAMP WHERE project_name IS NULL ${ownerCondition}`
      ).run(newName, ...ownerParam);
    } else {
      await db.prepare(
        `UPDATE monolith_projects SET project_name = ?, updated_at = CURRENT_TIMESTAMP WHERE project_name = ? ${ownerCondition}`
      ).run(newName, oldName, ...ownerParam);
    }

    // Update bridges table too (for consistency, scoped to current account)
    if (isNullProject) {
      await db.prepare(
        `UPDATE bridges SET project_name = ? WHERE project_name IS NULL ${ownerCondition}`
      ).run(newName, ...ownerParam);
    } else {
      await db.prepare(
        `UPDATE bridges SET project_name = ? WHERE project_name = ? ${ownerCondition}`
      ).run(newName, oldName, ...ownerParam);
    }

    logger.info(`[RENAME PROJECT] ✅ Renamed ${affectedObjects.count} objects: "${oldName}" → "${newName}"`);

    res.json({
      success: true,
      old_name: oldName,
      new_name: newName,
      objects_updated: affectedObjects.count
    });
  } catch (error) {
    logger.error('[RENAME PROJECT] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/monolith-projects/bulk-delete
 * Delete multiple objects by their IDs
 * Body: { project_ids: string[] }
 */
router.post('/bulk-delete', async (req, res) => {
  try {
    const { project_ids } = req.body;
    const portalUserId = req.user?.userId || null;

    if (!Array.isArray(project_ids) || project_ids.length === 0) {
      return res.status(400).json({ error: 'project_ids array is required' });
    }

    logger.info(`[BULK DELETE] Deleting ${project_ids.length} objects: ${project_ids.join(', ')}`);

    let deletedCount = 0;

    for (const id of project_ids) {
      try {
        // Account isolation: verify ownership before deleting
        const project = await db.prepare('SELECT portal_user_id FROM monolith_projects WHERE project_id = ?').get(id);
        if (project) {
          if (portalUserId && project.portal_user_id && project.portal_user_id !== portalUserId) {
            logger.warn(`[BULK DELETE] Skipped ${id}: owned by user ${project.portal_user_id}`);
            continue;
          }
          if (!portalUserId && project.portal_user_id) {
            logger.warn(`[BULK DELETE] Skipped ${id}: owned project, no auth`);
            continue;
          }
        }
        // Delete from bridges (CASCADE deletes positions)
        await db.prepare('DELETE FROM bridges WHERE bridge_id = ?').run(id);
        // Delete from monolith_projects (CASCADE deletes parts)
        await db.prepare('DELETE FROM monolith_projects WHERE project_id = ?').run(id);
        deletedCount++;
      } catch (err) {
        logger.warn(`[BULK DELETE] Failed to delete ${id}: ${err.message}`);
      }
    }

    logger.info(`[BULK DELETE] ✅ Deleted ${deletedCount}/${project_ids.length} objects`);

    res.json({
      success: true,
      deleted_count: deletedCount,
      deleted_ids: project_ids
    });
  } catch (error) {
    logger.error('[BULK DELETE] Error:', error);
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
    const portalUserId = req.user?.userId || null;

    logger.info(`[DELETE PROJECT] Deleting all objects with project_name: "${projectName}"`);

    // Special handling: "Bez projektu" in UI means NULL in DB
    const isNullProject = projectName === 'Bez projektu';

    // Build ownership condition
    const ownerCondition = portalUserId
      ? 'AND portal_user_id = ?'
      : 'AND portal_user_id IS NULL';
    const ownerParam = portalUserId ? [portalUserId] : [];

    // Find all projects with this project_name (scoped to current account)
    let projectsToDelete;
    if (isNullProject) {
      projectsToDelete = await db.prepare(`
        SELECT project_id FROM monolith_projects WHERE project_name IS NULL ${ownerCondition}
      `).all(...ownerParam);
    } else {
      projectsToDelete = await db.prepare(`
        SELECT project_id FROM monolith_projects WHERE project_name = ? ${ownerCondition}
      `).all(projectName, ...ownerParam);
    }

    if (projectsToDelete.length === 0) {
      logger.warn(`[DELETE PROJECT] No projects found with project_name: "${projectName}"`);
      return res.json({
        success: true,
        message: `No objects found with project_name "${projectName}" (already deleted or never existed)`,
        deleted_count: 0,
        deleted_ids: []
      });
    }

    const projectIds = projectsToDelete.map(p => p.project_id);
    logger.info(`[DELETE PROJECT] Found ${projectIds.length} objects to delete: ${projectIds.join(', ')}`);

    // Delete from monolith_projects (scoped to current account)
    let deleteProjectsResult;
    if (isNullProject) {
      deleteProjectsResult = await db.prepare(`
        DELETE FROM monolith_projects WHERE project_name IS NULL ${ownerCondition}
      `).run(...ownerParam);
    } else {
      deleteProjectsResult = await db.prepare(`
        DELETE FROM monolith_projects WHERE project_name = ? ${ownerCondition}
      `).run(projectName, ...ownerParam);
    }

    // Also delete from bridges table
    // Note: bridges table does not have portal_user_id column.
    // Ownership is already verified via monolith_projects query above.
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
 * Get project details with all parts.
 * Ownership check: authenticated users can only access their own projects.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const portalUserId = req.user?.userId || null;
    logger.info(`[GET PROJECT] Requesting project with ID: "${id}", portal_user: ${portalUserId}`);

    const project = await db.prepare(`
      SELECT * FROM monolith_projects WHERE project_id = ?
    `).get(id);

    if (!project) {
      logger.warn(`[GET PROJECT] Project not found with ID: "${id}"`);
      return res.status(404).json({ error: 'Project not found' });
    }

    // Account isolation: check ownership
    if (portalUserId && project.portal_user_id && project.portal_user_id !== portalUserId) {
      logger.warn(`[GET PROJECT] Access denied: user ${portalUserId} tried to access project owned by ${project.portal_user_id}`);
      return res.status(403).json({ error: 'Forbidden', message: 'Nemáte přístup k tomuto projektu' });
    }
    if (!portalUserId && project.portal_user_id) {
      // Unauthenticated user trying to access an owned project
      return res.status(403).json({ error: 'Forbidden', message: 'Nemáte přístup k tomuto projektu' });
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
 * Update project with ownership check.
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const portalUserId = req.user?.userId || null;
    logger.info(`[PUT PROJECT] Updating project with ID: "${id}"`);
    logger.info(`[PUT PROJECT] Update payload:`, req.body);

    const project = await db.prepare(`
      SELECT * FROM monolith_projects WHERE project_id = ?
    `).get(id);

    if (!project) {
      logger.warn(`[PUT PROJECT] Project not found with ID: "${id}"`);
      return res.status(404).json({ error: 'Project not found' });
    }

    // Account isolation: check ownership
    if (portalUserId && project.portal_user_id && project.portal_user_id !== portalUserId) {
      logger.warn(`[PUT PROJECT] Access denied: user ${portalUserId} tried to update project owned by ${project.portal_user_id}`);
      return res.status(403).json({ error: 'Forbidden', message: 'Nemáte přístup k tomuto projektu' });
    }
    if (!portalUserId && project.portal_user_id) {
      return res.status(403).json({ error: 'Forbidden', message: 'Nemáte přístup k tomuto projektu' });
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
 * POST /api/monolith-projects/:id/link-portal
 * Link project to stavagent-portal
 * Body: { portal_project_id: string }
 */
router.post('/:id/link-portal', async (req, res) => {
  try {
    const { id } = req.params;
    const { portal_project_id } = req.body;

    logger.info(`[LINK PORTAL] Linking project ${id} to Portal ${portal_project_id}`);

    if (!portal_project_id) {
      return res.status(400).json({ error: 'portal_project_id is required' });
    }

    // Check project exists
    const project = await db.prepare(`
      SELECT project_id FROM monolith_projects WHERE project_id = ?
    `).get(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Update project with portal link
    await db.prepare(`
      UPDATE monolith_projects SET
        portal_project_id = ?,
        portal_linked_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE project_id = ?
    `).run(portal_project_id, id);

    const updated = await db.prepare('SELECT * FROM monolith_projects WHERE project_id = ?').get(id);

    logger.info(`[LINK PORTAL] ✅ Successfully linked project ${id} to Portal ${portal_project_id}`);

    res.json({
      success: true,
      message: 'Project linked to Portal',
      project: {
        ...updated,
        bridge_id: updated.project_id
      }
    });
  } catch (error) {
    logger.error('[LINK PORTAL] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/monolith-projects/:id/link-portal
 * Unlink project from stavagent-portal
 */
router.delete('/:id/link-portal', async (req, res) => {
  try {
    const { id } = req.params;

    logger.info(`[UNLINK PORTAL] Unlinking project ${id} from Portal`);

    // Check project exists
    const project = await db.prepare(`
      SELECT project_id, portal_project_id FROM monolith_projects WHERE project_id = ?
    `).get(id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.portal_project_id) {
      return res.status(400).json({ error: 'Project is not linked to Portal' });
    }

    // Remove portal link
    await db.prepare(`
      UPDATE monolith_projects SET
        portal_project_id = NULL,
        portal_linked_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE project_id = ?
    `).run(id);

    const updated = await db.prepare('SELECT * FROM monolith_projects WHERE project_id = ?').get(id);

    logger.info(`[UNLINK PORTAL] ✅ Successfully unlinked project ${id} from Portal`);

    res.json({
      success: true,
      message: 'Project unlinked from Portal',
      project: {
        ...updated,
        bridge_id: updated.project_id
      }
    });
  } catch (error) {
    logger.error('[UNLINK PORTAL] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/monolith-projects/:id
 * Delete project (and all related parts) with ownership check.
 *
 * IMPORTANT: Deletes from BOTH tables (bridges + monolith_projects)
 * because positions are still FK-linked to bridges table
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const portalUserId = req.user?.userId || null;

    logger.info(`[DELETE PROJECT] Deleting project: ${id}`);

    // Check project exists in monolith_projects
    const project = await db.prepare(`
      SELECT * FROM monolith_projects WHERE project_id = ?
    `).get(id);

    // Check if exists in old bridges table too
    const bridge = await db.prepare(`
      SELECT * FROM bridges WHERE bridge_id = ?
    `).get(id);

    if (!project && !bridge) {
      logger.warn(`[DELETE PROJECT] Project not found: ${id}`);
      return res.status(404).json({ error: 'Project not found' });
    }

    // Account isolation: check ownership
    if (project) {
      if (portalUserId && project.portal_user_id && project.portal_user_id !== portalUserId) {
        logger.warn(`[DELETE PROJECT] Access denied: user ${portalUserId} tried to delete project owned by ${project.portal_user_id}`);
        return res.status(403).json({ error: 'Forbidden', message: 'Nemáte přístup k tomuto projektu' });
      }
      if (!portalUserId && project.portal_user_id) {
        return res.status(403).json({ error: 'Forbidden', message: 'Nemáte přístup k tomuto projektu' });
      }
    }

    // Count positions that will be deleted
    const positionsCount = await db.prepare(`
      SELECT COUNT(*) as count FROM positions WHERE bridge_id = ?
    `).get(id);

    logger.info(`[DELETE PROJECT] Will delete ${positionsCount.count} positions for project ${id}`);

    // Delete from bridges FIRST (CASCADE will delete positions automatically)
    if (bridge) {
      await db.prepare('DELETE FROM bridges WHERE bridge_id = ?').run(id);
      logger.info(`[DELETE PROJECT] ✓ Deleted from bridges table (and ${positionsCount.count} positions via CASCADE)`);
    }

    // Delete from monolith_projects (CASCADE will delete parts)
    if (project) {
      await db.prepare('DELETE FROM monolith_projects WHERE project_id = ?').run(id);
      logger.info(`[DELETE PROJECT] ✓ Deleted from monolith_projects table (and parts via CASCADE)`);
    }

    // Verify deletion
    const remainingPositions = await db.prepare(`
      SELECT COUNT(*) as count FROM positions WHERE bridge_id = ?
    `).get(id);

    if (remainingPositions.count > 0) {
      logger.warn(`[DELETE PROJECT] ⚠️  ${remainingPositions.count} positions still remain!`);
    }

    logger.info(`[DELETE PROJECT] ✅ Successfully deleted project: ${id}`);

    res.json({
      message: 'Project deleted successfully',
      deleted: {
        project: true,
        bridge: !!bridge,
        positions_count: positionsCount.count
      }
    });
  } catch (error) {
    logger.error('[DELETE PROJECT] Error deleting project:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
