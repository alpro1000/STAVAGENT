/**
 * Portal Documents API Routes
 *
 * Manages generated documents (passports, summaries, kiosk outputs)
 * attached to portal projects.
 *
 * Routes:
 * - POST   /api/portal-documents/:projectId          - Save document to project
 * - GET    /api/portal-documents/:projectId           - List project documents
 * - GET    /api/portal-documents/:projectId/:docId    - Get single document
 * - DELETE /api/portal-documents/:projectId/:docId    - Delete document
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../db/postgres.js';

const router = express.Router();

function safeGetPool() {
  try {
    return getPool();
  } catch {
    return null;
  }
}

// =============================================================================
// SAVE DOCUMENT (passport, summary, kiosk output)
// =============================================================================

/**
 * POST /api/portal-documents/:projectId
 *
 * Body: {
 *   document_type: 'passport' | 'summary' | 'kiosk_output' | 'audit_report',
 *   title: string,
 *   content: object,          // Full passport/summary JSON
 *   source_file_id?: string,  // If generated from a specific file
 *   metadata?: object,        // Processing metadata
 *   created_by?: string
 * }
 */
router.post('/:projectId', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  try {
    const { projectId } = req.params;
    const {
      document_type,
      title,
      content,
      source_file_id = null,
      metadata = {},
      created_by = 'system'
    } = req.body;

    if (!document_type || !title || !content) {
      return res.status(400).json({
        success: false,
        error: 'document_type, title, and content are required'
      });
    }

    // Verify project exists
    const projectResult = await pool.query(
      'SELECT portal_project_id FROM portal_projects WHERE portal_project_id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Check if document of same type + source already exists (versioning)
    let version = 1;
    if (source_file_id) {
      const existingResult = await pool.query(
        `SELECT MAX(version) as max_ver FROM portal_documents
         WHERE portal_project_id = $1 AND document_type = $2 AND source_file_id = $3`,
        [projectId, document_type, source_file_id]
      );
      if (existingResult.rows[0]?.max_ver) {
        version = existingResult.rows[0].max_ver + 1;
      }
    } else {
      const existingResult = await pool.query(
        `SELECT MAX(version) as max_ver FROM portal_documents
         WHERE portal_project_id = $1 AND document_type = $2 AND source_file_id IS NULL`,
        [projectId, document_type]
      );
      if (existingResult.rows[0]?.max_ver) {
        version = existingResult.rows[0].max_ver + 1;
      }
    }

    const documentId = `doc_${uuidv4().slice(0, 12)}`;

    await pool.query(
      `INSERT INTO portal_documents (
        document_id, portal_project_id, document_type, title,
        source_file_id, content, metadata, version, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        documentId, projectId, document_type, title,
        source_file_id,
        JSON.stringify(content),
        JSON.stringify(metadata),
        version,
        created_by
      ]
    );

    console.log(`[PortalDocuments] Saved ${document_type} v${version} for project ${projectId}`);

    res.json({
      success: true,
      document_id: documentId,
      document_type,
      version,
      title
    });

  } catch (error) {
    console.error('[PortalDocuments] Error saving document:', error);
    res.status(500).json({ success: false, error: 'Failed to save document' });
  }
});

// =============================================================================
// LIST PROJECT DOCUMENTS
// =============================================================================

/**
 * GET /api/portal-documents/:projectId
 *
 * Query params:
 *   ?type=passport          - Filter by document type
 *   ?latest=true            - Only latest version of each type
 */
router.get('/:projectId', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  try {
    const { projectId } = req.params;
    const { type, latest } = req.query;

    let query = `SELECT document_id, portal_project_id, document_type, title,
                        source_file_id, metadata, version, created_by,
                        created_at, updated_at
                 FROM portal_documents
                 WHERE portal_project_id = $1`;
    const params = [projectId];

    if (type) {
      query += ` AND document_type = $2`;
      params.push(type);
    }

    query += ` ORDER BY document_type, version DESC, created_at DESC`;

    const result = await pool.query(query, params);

    let documents = result.rows;

    // If latest=true, keep only the highest version per type+source
    if (latest === 'true') {
      const seen = new Map();
      documents = documents.filter(doc => {
        const key = `${doc.document_type}:${doc.source_file_id || 'null'}`;
        if (seen.has(key)) return false;
        seen.set(key, true);
        return true;
      });
    }

    res.json({
      success: true,
      documents: documents.map(doc => ({
        document_id: doc.document_id,
        project_id: doc.portal_project_id,
        document_type: doc.document_type,
        title: doc.title,
        source_file_id: doc.source_file_id,
        metadata: doc.metadata,
        version: doc.version,
        created_by: doc.created_by,
        created_at: doc.created_at,
        updated_at: doc.updated_at
      })),
      total: documents.length
    });

  } catch (error) {
    console.error('[PortalDocuments] Error listing documents:', error);
    res.status(500).json({ success: false, error: 'Failed to list documents' });
  }
});

// =============================================================================
// GET SINGLE DOCUMENT (with full content)
// =============================================================================

/**
 * GET /api/portal-documents/:projectId/:documentId
 */
router.get('/:projectId/:documentId', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  try {
    const { projectId, documentId } = req.params;

    const result = await pool.query(
      `SELECT * FROM portal_documents
       WHERE document_id = $1 AND portal_project_id = $2`,
      [documentId, projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const doc = result.rows[0];

    res.json({
      success: true,
      document: {
        document_id: doc.document_id,
        project_id: doc.portal_project_id,
        document_type: doc.document_type,
        title: doc.title,
        source_file_id: doc.source_file_id,
        content: doc.content,
        metadata: doc.metadata,
        version: doc.version,
        created_by: doc.created_by,
        created_at: doc.created_at,
        updated_at: doc.updated_at
      }
    });

  } catch (error) {
    console.error('[PortalDocuments] Error getting document:', error);
    res.status(500).json({ success: false, error: 'Failed to get document' });
  }
});

// =============================================================================
// DELETE DOCUMENT
// =============================================================================

/**
 * DELETE /api/portal-documents/:projectId/:documentId
 */
router.delete('/:projectId/:documentId', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  try {
    const { projectId, documentId } = req.params;

    const result = await pool.query(
      `DELETE FROM portal_documents
       WHERE document_id = $1 AND portal_project_id = $2
       RETURNING document_id`,
      [documentId, projectId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    res.json({ success: true, deleted: documentId });

  } catch (error) {
    console.error('[PortalDocuments] Error deleting document:', error);
    res.status(500).json({ success: false, error: 'Failed to delete document' });
  }
});

export default router;
