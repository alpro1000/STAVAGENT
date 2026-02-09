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
import { USE_POSTGRES } from '../db/index.js';
import * as concreteAgent from '../services/concreteAgentClient.js';

/**
 * Helper to safely get PostgreSQL pool
 * Returns null if PostgreSQL is not configured
 */
function safeGetPool() {
  if (!USE_POSTGRES) {
    return null;
  }
  try {
    return getPool();
  } catch (error) {
    console.error('[PortalProjects] Failed to get database pool:', error.message);
    return null;
  }
}

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/portal-projects/by-kiosk/:kioskType/:kioskProjectId
 * Find portal project by kiosk reference (reverse lookup)
 * NOTE: Must be defined BEFORE /:id to avoid route conflicts
 */
router.get('/by-kiosk/:kioskType/:kioskProjectId', async (req, res) => {
  try {
    const { kioskType, kioskProjectId } = req.params;
    const pool = safeGetPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

    const result = await pool.query(
      `SELECT pp.* FROM portal_projects pp
       JOIN kiosk_links kl ON pp.portal_project_id = kl.portal_project_id
       WHERE kl.kiosk_type = $1 AND kl.kiosk_project_id = $2`,
      [kioskType, kioskProjectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No portal project found for this kiosk reference'
      });
    }

    res.json({
      success: true,
      project: result.rows[0]
    });

  } catch (error) {
    console.error('[PortalProjects] Error in reverse lookup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find portal project'
    });
  }
});

/**
 * GET /api/portal-projects
 * List all portal projects for current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Check if PostgreSQL is available
    const pool = safeGetPool();
    if (!pool) {
      // Return empty array if PostgreSQL not available (dev mode or misconfigured)
      console.warn('[PortalProjects] PostgreSQL not available, returning empty projects list');
      return res.json({
        success: true,
        projects: [],
        _warning: 'Database not configured - running in mock mode'
      });
    }

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

    // Check if PostgreSQL is available
    const pool = safeGetPool();
    if (!pool) {
      // Return mock project if PostgreSQL not available (dev mode or misconfigured)
      const mockProject = {
        portal_project_id,
        project_name,
        project_type: project_type || 'custom',
        description: description || '',
        owner_id: userId,
        core_status: 'not_sent',
        core_project_id: null,
        core_audit_result: null,
        core_last_sync: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log(`[PortalProjects] Mock project created (no DB): ${portal_project_id} (${project_name})`);
      return res.status(201).json({
        success: true,
        project: mockProject,
        _warning: 'Database not configured - project not persisted'
      });
    }
    const client = await pool.connect();

    try {
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
    } catch (dbError) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[PortalProjects] DB error creating project:', dbError);
      res.status(500).json({
        success: false,
        error: 'Failed to create project'
      });
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('[PortalProjects] Error creating project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create project'
    });
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
    const pool = safeGetPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

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
    const pool = safeGetPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

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
    const pool = safeGetPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

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
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({
      success: false,
      error: 'Database not available'
    });
  }
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
      client.release();
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
      client.release();
      return res.status(400).json({
        success: false,
        error: 'No files uploaded for this project'
      });
    }

    // Send first file to CORE for analysis (Workflow A)
    const firstFile = filesResult.rows[0];

    console.log(`[PortalProjects] Sending project ${id} to CORE via file: ${firstFile.file_name}`);
    console.log(`[PortalProjects] Note: Using Workflow A (document parsing only). Multi-Role audit disabled.`);

    // WARNING: performAudit() and enrichWithAI() have been removed (2025-12-10)
    // Multi-Role validation is not part of the send-to-core workflow
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
    const pool = safeGetPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

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
    const pool = safeGetPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

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

/**
 * GET /api/portal-projects/:id/unified
 * Get unified project view with data from all linked kiosks
 *
 * Returns:
 * - portal: Portal project data
 * - files: Uploaded files
 * - kiosks: Array of kiosk data with their project details
 * - summary: Aggregated metrics from all kiosks
 */
router.get('/:id/unified', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const pool = safeGetPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

    // 1. Get portal project
    const projectResult = await pool.query(
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

    // 2. Get files
    const filesResult = await pool.query(
      `SELECT * FROM portal_files WHERE portal_project_id = $1 ORDER BY uploaded_at DESC`,
      [id]
    );

    // 3. Get kiosk links
    const kiosksResult = await pool.query(
      `SELECT * FROM kiosk_links WHERE portal_project_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    // 4. Fetch data from each kiosk (async)
    const kioskDataPromises = kiosksResult.rows.map(async (link) => {
      try {
        const kioskData = await fetchKioskData(link.kiosk_type, link.kiosk_project_id);
        return {
          kiosk_type: link.kiosk_type,
          kiosk_project_id: link.kiosk_project_id,
          status: link.status,
          last_sync: link.last_sync,
          data: kioskData,
          error: null
        };
      } catch (error) {
        return {
          kiosk_type: link.kiosk_type,
          kiosk_project_id: link.kiosk_project_id,
          status: 'error',
          last_sync: link.last_sync,
          data: null,
          error: error.message
        };
      }
    });

    const kioskData = await Promise.all(kioskDataPromises);

    // 5. Calculate summary metrics
    const summary = calculateUnifiedSummary(kioskData);

    console.log(`[PortalProjects] Unified view for ${id}: ${kioskData.length} kiosks`);

    res.json({
      success: true,
      portal: project,
      files: filesResult.rows,
      kiosks: kioskData,
      summary
    });

  } catch (error) {
    console.error('[PortalProjects] Error fetching unified view:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unified project view'
    });
  }
});

/**
 * Fetch data from a specific kiosk service
 */
async function fetchKioskData(kioskType, kioskProjectId) {
  const kioskUrls = {
    'monolit': process.env.MONOLIT_API_URL || 'https://monolit-planner-api.onrender.com',
    'urs_matcher': process.env.URS_MATCHER_API_URL || 'https://urs-matcher-service.onrender.com',
    'r0': process.env.MONOLIT_API_URL || 'https://monolit-planner-api.onrender.com'
  };

  const baseUrl = kioskUrls[kioskType];
  if (!baseUrl) {
    throw new Error(`Unknown kiosk type: ${kioskType}`);
  }

  let endpoint;
  switch (kioskType) {
    case 'monolit':
      endpoint = `${baseUrl}/api/monolith-projects/${kioskProjectId}`;
      break;
    case 'r0':
      endpoint = `${baseUrl}/api/r0/projects/${kioskProjectId}`;
      break;
    case 'urs_matcher':
      endpoint = `${baseUrl}/api/jobs/${kioskProjectId}`;
      break;
    default:
      throw new Error(`Unsupported kiosk type: ${kioskType}`);
  }

  const response = await fetch(endpoint, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000
  });

  if (!response.ok) {
    throw new Error(`Kiosk returned ${response.status}`);
  }

  return await response.json();
}

/**
 * Calculate unified summary from all kiosk data
 */
function calculateUnifiedSummary(kioskData) {
  const summary = {
    total_kiosks: kioskData.length,
    active_kiosks: kioskData.filter(k => k.status === 'active' && k.data).length,
    error_kiosks: kioskData.filter(k => k.error).length,
    metrics: {
      total_concrete_m3: 0,
      total_cost_czk: 0,
      total_elements: 0,
      urs_matched_items: 0
    }
  };

  for (const kiosk of kioskData) {
    if (!kiosk.data) continue;

    switch (kiosk.kiosk_type) {
      case 'monolit':
        if (kiosk.data.project) {
          summary.metrics.total_concrete_m3 += kiosk.data.project.concrete_m3 || 0;
          summary.metrics.total_cost_czk += kiosk.data.project.sum_kros_czk || 0;
          summary.metrics.total_elements += kiosk.data.project.element_count || 0;
        }
        break;

      case 'r0':
        if (kiosk.data.project) {
          // R0 aggregates from captures
          const elements = kiosk.data.elements || [];
          summary.metrics.total_concrete_m3 += elements.reduce((sum, el) => sum + (el.volume_m3 || 0), 0);
          summary.metrics.total_elements += elements.length;
        }
        break;

      case 'urs_matcher':
        if (kiosk.data.job || kiosk.data) {
          const job = kiosk.data.job || kiosk.data;
          summary.metrics.urs_matched_items += job.processed_rows || 0;
        }
        break;
    }
  }

  return summary;
}

/**
 * POST /api/portal-projects/:id/link-kiosk
 * Link a kiosk project to this portal project
 *
 * Body:
 * - kiosk_type: 'monolit' | 'urs_matcher' | 'r0' | 'rozpocet'
 * - kiosk_project_id: string (ID in the kiosk's system)
 */
router.post('/:id/link-kiosk', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { kiosk_type, kiosk_project_id } = req.body;

    if (!kiosk_type || !kiosk_project_id) {
      return res.status(400).json({
        success: false,
        error: 'kiosk_type and kiosk_project_id are required'
      });
    }

    const pool = safeGetPool();
    if (!pool) {
      return res.status(503).json({
        success: false,
        error: 'Database not available'
      });
    }

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

    const link_id = `link_${uuidv4()}`;

    // Insert or update kiosk link (upsert)
    const result = await pool.query(
      `INSERT INTO kiosk_links (link_id, portal_project_id, kiosk_type, kiosk_project_id, status, created_at, last_sync)
       VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
       ON CONFLICT (portal_project_id, kiosk_type)
       DO UPDATE SET kiosk_project_id = $4, status = 'active', last_sync = NOW()
       RETURNING *`,
      [link_id, id, kiosk_type, kiosk_project_id]
    );

    console.log(`[PortalProjects] Linked kiosk ${kiosk_type}:${kiosk_project_id} to project ${id}`);

    res.json({
      success: true,
      link: result.rows[0]
    });

  } catch (error) {
    console.error('[PortalProjects] Error linking kiosk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to link kiosk'
    });
  }
});

export default router;
