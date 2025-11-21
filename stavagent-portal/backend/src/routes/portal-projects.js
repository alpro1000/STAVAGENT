/**
 * Portal Projects API Routes
 *
 * Manages the main project registry in Portal.
 * Portal is the main entry point - stores all files and coordinates between Kiosks and CORE.
 *
 * Routes:
 * - GET    /api/portal-projects          - List all projects for current user
 * - POST   /api/portal-projects          - Create new portal project
 * - GET    /api/portal-projects/:id      - Get specific project
 * - PUT    /api/portal-projects/:id      - Update project
 * - DELETE /api/portal-projects/:id      - Delete project
 * - POST   /api/portal-projects/:id/send-to-core - Send project to CORE
 * - GET    /api/portal-projects/:id/files       - Get all files for project
 * - GET    /api/portal-projects/:id/kiosks      - Get all kiosk links for project
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { getPool } from '../db/postgres.js';
import * as concreteAgent from '../services/concreteAgentClient.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/portal-projects
 * List all portal projects for current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const pool = getPool();

    const result = await pool.query(
      `SELECT
        portal_project_id,
        project_name,
        project_type,
        description,
        owner_id,
        core_project_id,
        core_status,
        core_audit_result,
        core_last_sync,
        created_at,
        updated_at
       FROM portal_projects
       WHERE owner_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      projects: result.rows
    });

  } catch (error) {
    console.error('[PortalProjects] Error listing projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list projects'
    });
  }
});

/**
 * POST /api/portal-projects
 * Create new portal project
 *
 * Body:
 * - project_name: string (required)
 * - project_type: 'bridge' | 'building' | 'road' | 'parking' | 'custom'
 * - description: string
 */
router.post('/', async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { project_name, project_type, description } = req.body;

    // Validation
    if (!project_name) {
      return res.status(400).json({
        success: false,
        error: 'project_name is required'
      });
    }

    const portal_project_id = `proj_${uuidv4()}`;

    await client.query('BEGIN');

    // Create portal project
    const result = await client.query(
      `INSERT INTO portal_projects (
        portal_project_id,
        project_name,
        project_type,
        description,
        owner_id,
        core_status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'not_sent', NOW(), NOW())
      RETURNING *`,
      [portal_project_id, project_name, project_type || 'custom', description || '', userId]
    );

    await client.query('COMMIT');

    console.log(`[PortalProjects] Created project: ${portal_project_id} (${project_name})`);

    res.status(201).json({
      success: true,
      project: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PortalProjects] Error creating project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create project'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/portal-projects/:id
 * Get specific portal project with full details
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM portal_projects
       WHERE portal_project_id = $1 AND owner_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    res.json({
      success: true,
      project: result.rows[0]
    });

  } catch (error) {
    console.error('[PortalProjects] Error fetching project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project'
    });
  }
});

/**
 * PUT /api/portal-projects/:id
 * Update portal project
 *
 * Body:
 * - project_name: string
 * - project_type: string
 * - description: string
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { project_name, project_type, description } = req.body;
    const pool = getPool();

    // Check ownership
    const checkResult = await pool.query(
      'SELECT portal_project_id FROM portal_projects WHERE portal_project_id = $1 AND owner_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let valueIndex = 1;

    if (project_name !== undefined) {
      updates.push(`project_name = $${valueIndex++}`);
      values.push(project_name);
    }
    if (project_type !== undefined) {
      updates.push(`project_type = $${valueIndex++}`);
      values.push(project_type);
    }
    if (description !== undefined) {
      updates.push(`description = $${valueIndex++}`);
      values.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);
    values.push(userId);

    const result = await pool.query(
      `UPDATE portal_projects
       SET ${updates.join(', ')}
       WHERE portal_project_id = $${valueIndex++} AND owner_id = $${valueIndex++}
       RETURNING *`,
      values
    );

    console.log(`[PortalProjects] Updated project: ${id}`);

    res.json({
      success: true,
      project: result.rows[0]
    });

  } catch (error) {
    console.error('[PortalProjects] Error updating project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update project'
    });
  }
});

/**
 * DELETE /api/portal-projects/:id
 * Delete portal project (CASCADE deletes files, kiosk links, chat sessions)
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const pool = getPool();

    const result = await pool.query(
      `DELETE FROM portal_projects
       WHERE portal_project_id = $1 AND owner_id = $2
       RETURNING portal_project_id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    console.log(`[PortalProjects] Deleted project: ${id}`);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('[PortalProjects] Error deleting project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete project'
    });
  }
});

/**
 * POST /api/portal-projects/:id/send-to-core
 * Send project to CORE for analysis
 *
 * This triggers CORE to analyze all uploaded files for the project.
 * Currently uses Workflow A (document parsing).
 */
router.post('/:id/send-to-core', async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const userId = req.user.userId;
    const { id } = req.params;

    // Get project
    const projectResult = await client.query(
      `SELECT * FROM portal_projects
       WHERE portal_project_id = $1 AND owner_id = $2`,
      [id, userId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const project = projectResult.rows[0];

    // Get files for this project
    const filesResult = await client.query(
      `SELECT * FROM portal_files
       WHERE portal_project_id = $1
       ORDER BY uploaded_at ASC`,
      [id]
    );

    if (filesResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded for this project'
      });
    }

    // Send first file to CORE for analysis (Workflow A)
    const firstFile = filesResult.rows[0];

    console.log(`[PortalProjects] Sending project ${id} to CORE via file: ${firstFile.file_name}`);

    const coreResult = await concreteAgent.workflowAStart(firstFile.file_path, {
      projectId: id,
      projectName: project.project_name,
      objectType: project.project_type
    });

    await client.query('BEGIN');

    // Update project with CORE info
    await client.query(
      `UPDATE portal_projects
       SET core_project_id = $1,
           core_status = 'processing',
           core_last_sync = NOW(),
           updated_at = NOW()
       WHERE portal_project_id = $2`,
      [coreResult.workflow_id, id]
    );

    // Update file with CORE workflow info
    await client.query(
      `UPDATE portal_files
       SET core_workflow_id = $1,
           core_status = 'completed',
           analysis_result = $2,
           processed_at = NOW()
       WHERE file_id = $3`,
      [coreResult.workflow_id, JSON.stringify(coreResult), firstFile.file_id]
    );

    await client.query('COMMIT');

    console.log(`[PortalProjects] Successfully sent to CORE. Workflow ID: ${coreResult.workflow_id}`);

    res.json({
      success: true,
      core_project_id: coreResult.workflow_id,
      core_result: coreResult
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PortalProjects] Error sending to CORE:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send to CORE'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/portal-projects/:id/files
 * Get all files for a project
 */
router.get('/:id/files', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const pool = getPool();

    // Check project ownership
    const projectCheck = await pool.query(
      'SELECT portal_project_id FROM portal_projects WHERE portal_project_id = $1 AND owner_id = $2',
      [id, userId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const result = await pool.query(
      `SELECT * FROM portal_files
       WHERE portal_project_id = $1
       ORDER BY uploaded_at DESC`,
      [id]
    );

    res.json({
      success: true,
      files: result.rows
    });

  } catch (error) {
    console.error('[PortalProjects] Error fetching files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch files'
    });
  }
});

/**
 * GET /api/portal-projects/:id/kiosks
 * Get all kiosk links for a project
 */
router.get('/:id/kiosks', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const pool = getPool();

    // Check project ownership
    const projectCheck = await pool.query(
      'SELECT portal_project_id FROM portal_projects WHERE portal_project_id = $1 AND owner_id = $2',
      [id, userId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const result = await pool.query(
      `SELECT * FROM kiosk_links
       WHERE portal_project_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      kiosks: result.rows
    });

  } catch (error) {
    console.error('[PortalProjects] Error fetching kiosk links:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch kiosk links'
    });
  }
});

export default router;
