/**
 * Portal Files API Routes
 *
 * Manages file uploads to Portal projects.
 * All files (TZ, výkaz výměr, drawings) are uploaded to Portal ONLY.
 *
 * Routes:
 * - POST   /api/portal-files/:projectId/upload  - Upload file to project
 * - GET    /api/portal-files/:fileId           - Get file metadata
 * - DELETE /api/portal-files/:fileId           - Delete file
 * - GET    /api/portal-files/:fileId/download  - Download file
 * - POST   /api/portal-files/:fileId/analyze   - Trigger CORE analysis for specific file
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/db.js';
import * as concreteAgent from '../services/concreteAgentClient.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'portal');

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept common document types
    const allowedMimes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet',
      'text/csv',
      'image/png',
      'image/jpeg',
      'application/zip'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  }
});

// All routes require authentication
router.use(authenticateToken);

/**
 * POST /api/portal-files/:projectId/upload
 * Upload file to portal project
 *
 * Body: multipart/form-data
 * - file: File (required)
 * - file_type: 'tz' | 'vykaz' | 'drawing' | 'other'
 */
router.post('/:projectId/upload', upload.single('file'), async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { projectId } = req.params;
    const { file_type } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Check project ownership
    const projectCheck = await client.query(
      'SELECT portal_project_id FROM portal_projects WHERE portal_project_id = $1 AND owner_id = $2',
      [projectId, userId]
    );

    if (projectCheck.rows.length === 0) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const file_id = `file_${uuidv4()}`;

    await client.query('BEGIN');

    // Insert file record
    const result = await client.query(
      `INSERT INTO portal_files (
        file_id,
        portal_project_id,
        file_type,
        file_name,
        file_path,
        file_size,
        mime_type,
        uploaded_by,
        core_status,
        uploaded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'not_sent', NOW())
      RETURNING *`,
      [
        file_id,
        projectId,
        file_type || 'other',
        req.file.originalname,
        req.file.path,
        req.file.size,
        req.file.mimetype,
        userId
      ]
    );

    await client.query('COMMIT');

    console.log(`[PortalFiles] Uploaded file: ${file_id} (${req.file.originalname}) to project ${projectId}`);

    res.status(201).json({
      success: true,
      file: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');

    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('[PortalFiles] Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/portal-files/:fileId
 * Get file metadata
 */
router.get('/:fileId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { fileId } = req.params;

    const result = await pool.query(
      `SELECT pf.*
       FROM portal_files pf
       JOIN portal_projects pp ON pf.portal_project_id = pp.portal_project_id
       WHERE pf.file_id = $1 AND pp.owner_id = $2`,
      [fileId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    res.json({
      success: true,
      file: result.rows[0]
    });

  } catch (error) {
    console.error('[PortalFiles] Error fetching file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch file'
    });
  }
});

/**
 * DELETE /api/portal-files/:fileId
 * Delete file from portal project
 */
router.delete('/:fileId', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { fileId } = req.params;

    await client.query('BEGIN');

    // Get file info (with ownership check)
    const fileResult = await client.query(
      `SELECT pf.*
       FROM portal_files pf
       JOIN portal_projects pp ON pf.portal_project_id = pp.portal_project_id
       WHERE pf.file_id = $1 AND pp.owner_id = $2`,
      [fileId, userId]
    );

    if (fileResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    const file = fileResult.rows[0];

    // Delete from database
    await client.query(
      'DELETE FROM portal_files WHERE file_id = $1',
      [fileId]
    );

    await client.query('COMMIT');

    // Delete physical file
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
      console.log(`[PortalFiles] Deleted physical file: ${file.file_path}`);
    }

    console.log(`[PortalFiles] Deleted file: ${fileId}`);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PortalFiles] Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file'
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/portal-files/:fileId/download
 * Download file
 */
router.get('/:fileId/download', async (req, res) => {
  try {
    const userId = req.user.id;
    const { fileId } = req.params;

    const result = await pool.query(
      `SELECT pf.*
       FROM portal_files pf
       JOIN portal_projects pp ON pf.portal_project_id = pp.portal_project_id
       WHERE pf.file_id = $1 AND pp.owner_id = $2`,
      [fileId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    const file = result.rows[0];

    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({
        success: false,
        error: 'Physical file not found'
      });
    }

    res.download(file.file_path, file.file_name);

  } catch (error) {
    console.error('[PortalFiles] Error downloading file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download file'
    });
  }
});

/**
 * POST /api/portal-files/:fileId/analyze
 * Trigger CORE analysis for specific file
 *
 * Body:
 * - workflow: 'A' | 'B' (default: 'A')
 */
router.post('/:fileId/analyze', async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { fileId } = req.params;
    const { workflow } = req.body;

    // Get file with project info (with ownership check)
    const fileResult = await client.query(
      `SELECT pf.*, pp.project_name, pp.project_type
       FROM portal_files pf
       JOIN portal_projects pp ON pf.portal_project_id = pp.portal_project_id
       WHERE pf.file_id = $1 AND pp.owner_id = $2`,
      [fileId, userId]
    );

    if (fileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    const file = fileResult.rows[0];

    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({
        success: false,
        error: 'Physical file not found'
      });
    }

    console.log(`[PortalFiles] Analyzing file ${fileId} with Workflow ${workflow || 'A'}`);

    // Call CORE based on workflow type
    let coreResult;
    if (workflow === 'B') {
      coreResult = await concreteAgent.workflowBStart(file.file_path, {
        projectId: file.portal_project_id,
        objectType: file.project_type
      });
    } else {
      // Default to Workflow A
      coreResult = await concreteAgent.workflowAStart(file.file_path, {
        projectId: file.portal_project_id,
        projectName: file.project_name,
        objectType: file.project_type
      });
    }

    await client.query('BEGIN');

    // Update file with analysis result
    await client.query(
      `UPDATE portal_files
       SET core_workflow_id = $1,
           core_status = 'completed',
           analysis_result = $2,
           processed_at = NOW()
       WHERE file_id = $3`,
      [coreResult.workflow_id, JSON.stringify(coreResult), fileId]
    );

    // Update project with CORE info if not already set
    await client.query(
      `UPDATE portal_projects
       SET core_project_id = COALESCE(core_project_id, $1),
           core_status = 'processing',
           core_last_sync = NOW(),
           updated_at = NOW()
       WHERE portal_project_id = $2`,
      [coreResult.workflow_id, file.portal_project_id]
    );

    await client.query('COMMIT');

    console.log(`[PortalFiles] Analysis complete. Workflow ID: ${coreResult.workflow_id}`);

    res.json({
      success: true,
      workflow_id: coreResult.workflow_id,
      result: coreResult
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PortalFiles] Error analyzing file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze file'
    });
  } finally {
    client.release();
  }
});

export default router;
