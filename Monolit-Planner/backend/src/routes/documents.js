/**
 * Document Management Routes
 * Phase 4: Document Upload & Analysis
 *
 * POST   /api/documents/upload       - Upload file and start analysis
 * GET    /api/documents/:id          - Get document details
 * GET    /api/documents/:id/analysis - Get analysis results from CORE Engine
 * POST   /api/documents/:id/confirm  - User confirms analysis, create work list
 * DELETE /api/documents/:id          - Delete document
 * GET    /api/documents?project_id=X - List documents for a project
 */

import express from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import db from '../db/init.js';
import { requireAuth } from '../middleware/auth.js';
import * as concreteAgent from '../services/concreteAgentClient.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_DIR || './uploads/documents';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${randomUUID()}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, Excel, images
    const allowedMimes = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/tiff'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

/**
 * POST /api/documents/upload
 * Upload file and start analysis with CORE Engine
 */
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  const documentId = randomUUID();

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { project_id, analysis_type } = req.body;
    const userId = req.user.id;

    // Validate project exists and user owns it
    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }

    const project = await db.prepare(
      'SELECT * FROM monolith_projects WHERE project_id = ? AND owner_id = ?'
    ).get(project_id, userId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found or not authorized' });
    }

    // Save document metadata to database
    const documentRecord = {
      id: documentId,
      project_id: project_id,
      user_id: userId,
      original_filename: req.file.originalname,
      file_path: req.file.path,
      file_size: req.file.size,
      file_type: path.extname(req.file.originalname).toLowerCase(),
      status: 'uploaded',
      analysis_status: 'pending'
    };

    await db.prepare(`
      INSERT INTO documents (id, project_id, user_id, original_filename, file_path, file_size, file_type, status, analysis_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      documentRecord.id,
      documentRecord.project_id,
      documentRecord.user_id,
      documentRecord.original_filename,
      documentRecord.file_path,
      documentRecord.file_size,
      documentRecord.file_type,
      documentRecord.status,
      documentRecord.analysis_status
    );

    logger.info(`[Documents] Document uploaded: ${documentId}`, {
      filename: req.file.originalname,
      size: req.file.size,
      userId
    });

    // Start analysis asynchronously (don't wait for it)
    analyzeDocumentAsync(documentId, project_id, req.file.path, analysis_type || 'auto', userId);

    // Return immediately with document info
    res.status(201).json({
      success: true,
      document_id: documentId,
      message: 'Document uploaded. Analysis is being processed...',
      status: 'processing'
    });

  } catch (error) {
    logger.error('[Documents] Upload error', {
      error: error.message,
      userId: req.user.id
    });

    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        // Ignore cleanup errors
      }
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/documents/:id
 * Get document details and current analysis status
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get document
    const document = await db.prepare(`
      SELECT d.*, p.object_name
      FROM documents d
      JOIN monolith_projects p ON d.project_id = p.project_id
      WHERE d.id = ? AND d.user_id = ?
    `).get(id, userId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found or not authorized' });
    }

    // Get analysis if it exists
    const analysis = await db.prepare(`
      SELECT * FROM document_analyses WHERE document_id = ?
    `).get(id);

    res.json({
      document: {
        id: document.id,
        project_id: document.project_id,
        project_name: document.object_name,
        filename: document.original_filename,
        size: document.file_size,
        type: document.file_type,
        status: document.status,
        analysis_status: document.analysis_status,
        created_at: document.created_at,
        updated_at: document.updated_at
      },
      analysis: analysis ? {
        id: analysis.id,
        workflow_id: analysis.workflow_id,
        workflow_type: analysis.workflow_type,
        status: analysis.status,
        parsed_positions: analysis.parsed_positions ? JSON.parse(analysis.parsed_positions) : null,
        materials: analysis.materials ? JSON.parse(analysis.materials) : null,
        dimensions: analysis.dimensions ? JSON.parse(analysis.dimensions) : null,
        error_message: analysis.error_message,
        created_at: analysis.created_at
      } : null
    });

  } catch (error) {
    logger.error('[Documents] Get error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/documents/:id/analysis
 * Get detailed analysis results
 */
router.get('/:id/analysis', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify user owns the document
    const document = await db.prepare(`
      SELECT id FROM documents WHERE id = ? AND user_id = ?
    `).get(id, userId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found or not authorized' });
    }

    // Get analysis
    const analysis = await db.prepare(`
      SELECT * FROM document_analyses WHERE document_id = ?
    `).get(id);

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not yet available' });
    }

    // Parse JSON fields
    const result = {
      id: analysis.id,
      workflow_id: analysis.workflow_id,
      workflow_type: analysis.workflow_type,
      status: analysis.status,
      parsed_positions: analysis.parsed_positions ? JSON.parse(analysis.parsed_positions) : [],
      materials: analysis.materials ? JSON.parse(analysis.materials) : [],
      dimensions: analysis.dimensions ? JSON.parse(analysis.dimensions) : {},
      audit_results: analysis.audit_results ? JSON.parse(analysis.audit_results) : null,
      ai_enrichment: analysis.ai_enrichment ? JSON.parse(analysis.ai_enrichment) : null,
      error_message: analysis.error_message,
      created_at: analysis.created_at
    };

    res.json(result);

  } catch (error) {
    logger.error('[Documents] Analysis error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/documents/:id/confirm
 * User confirms analysis, create work list from results
 */
router.post('/:id/confirm', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, description } = req.body;

    // Verify user owns the document
    const document = await db.prepare(`
      SELECT d.project_id FROM documents d WHERE d.id = ? AND d.user_id = ?
    `).get(id, userId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found or not authorized' });
    }

    // Get analysis
    const analysis = await db.prepare(`
      SELECT * FROM document_analyses WHERE document_id = ?
    `).get(id);

    if (!analysis || analysis.status !== 'completed') {
      return res.status(400).json({ error: 'Analysis not completed yet' });
    }

    // Create work list
    const workListId = randomUUID();
    const positions = analysis.parsed_positions ? JSON.parse(analysis.parsed_positions) : [];

    await db.prepare(`
      INSERT INTO work_lists (id, project_id, document_id, user_id, title, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      workListId,
      document.project_id,
      id,
      userId,
      title || 'Work List from ' + new Date().toLocaleDateString(),
      description || null,
      'draft'
    );

    // Add work list items from analysis
    const insertItem = db.prepare(`
      INSERT INTO work_list_items (id, work_list_id, description, category, unit, quantity, otskp_code, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const position of positions) {
      const itemId = randomUUID();
      await insertItem.run(
        itemId,
        workListId,
        position.name || position.description || 'Item',
        position.category || 'general',
        position.unit || 'pcs',
        position.quantity || 1,
        position.otskp_code || null,
        'pending'
      );
    }

    logger.info(`[Documents] Analysis confirmed and work list created: ${workListId}`, {
      documentId: id,
      userId,
      itemCount: positions.length
    });

    res.json({
      success: true,
      work_list_id: workListId,
      item_count: positions.length,
      message: 'Work list created successfully'
    });

  } catch (error) {
    logger.error('[Documents] Confirm error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete document and associated analysis
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get document
    const document = await db.prepare(`
      SELECT * FROM documents WHERE id = ? AND user_id = ?
    `).get(id, userId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found or not authorized' });
    }

    // Delete physical file
    try {
      if (document.file_path && fs.existsSync(document.file_path)) {
        fs.unlinkSync(document.file_path);
      }
    } catch (fsError) {
      logger.warn('[Documents] Could not delete file', { path: document.file_path });
    }

    // Delete from database (cascades will delete analysis)
    await db.prepare('DELETE FROM documents WHERE id = ?').run(id);

    logger.info(`[Documents] Document deleted: ${id}`, { userId });

    res.json({ success: true, message: 'Document deleted' });

  } catch (error) {
    logger.error('[Documents] Delete error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/documents
 * List documents for a project
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const { project_id } = req.query;
    const userId = req.user.id;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id query parameter is required' });
    }

    // Verify user owns the project
    const project = await db.prepare(`
      SELECT id FROM monolith_projects WHERE project_id = ? AND owner_id = ?
    `).get(project_id, userId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found or not authorized' });
    }

    // Get all documents for the project
    const documents = await db.prepare(`
      SELECT d.id, d.original_filename, d.file_size, d.file_type,
             d.status, d.analysis_status, d.created_at, d.updated_at
      FROM documents d
      WHERE d.project_id = ? AND d.user_id = ?
      ORDER BY d.created_at DESC
    `).all(project_id, userId);

    res.json({
      count: documents.length,
      documents: documents.map(doc => ({
        id: doc.id,
        filename: doc.original_filename,
        size: doc.file_size,
        type: doc.file_type,
        status: doc.status,
        analysis_status: doc.analysis_status,
        created_at: doc.created_at,
        updated_at: doc.updated_at
      }))
    });

  } catch (error) {
    logger.error('[Documents] List error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Async function to analyze document with CORE Engine
 * Runs in background, updates database when done
 */
async function analyzeDocumentAsync(documentId, projectId, filePath, analysisType, userId) {
  try {
    console.log(`[Analyzer] Starting analysis for document: ${documentId}`);

    // Determine which workflow to use
    const isDrawing = filePath.toLowerCase().endsWith('.pdf') ||
                     analysisType === 'drawing' ||
                     filePath.toLowerCase().match(/\.(jpg|jpeg|png|tiff)$/);

    let analysisResult;
    const metadata = {
      projectId: projectId,
      objectType: 'custom' // Default, could be determined from project
    };

    if (isDrawing) {
      // Use Workflow B for drawings
      analysisResult = await concreteAgent.workflowBStart(filePath, metadata);
      analysisResult.workflow_type = 'workflow-b';
    } else {
      // Use Workflow A for imports (Excel, KROS files)
      analysisResult = await concreteAgent.workflowAStart(filePath, metadata);
      analysisResult.workflow_type = 'workflow-a';
    }

    // Update document status
    await db.prepare(`
      UPDATE documents
      SET analysis_status = 'completed', status = 'analyzed'
      WHERE id = ?
    `).run(documentId);

    // Create analysis record
    const analysisId = randomUUID();
    const parsedPositions = analysisResult.positions || analysisResult.suggested_works || [];

    await db.prepare(`
      INSERT INTO document_analyses
      (id, document_id, workflow_id, workflow_type, parsed_positions, materials, dimensions, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      analysisId,
      documentId,
      analysisResult.workflow_id,
      analysisResult.workflow_type,
      JSON.stringify(parsedPositions),
      JSON.stringify(analysisResult.materials || []),
      JSON.stringify(analysisResult.dimensions || {}),
      'completed'
    );

    console.log(`[Analyzer] Analysis completed for document: ${documentId}`);

  } catch (error) {
    console.error(`[Analyzer] Error analyzing document ${documentId}:`, error.message);

    try {
      // Update document with error status
      await db.prepare(`
        UPDATE documents
        SET analysis_status = 'error', status = 'failed'
        WHERE id = ?
      `).run(documentId);

      // Create error record
      const analysisId = randomUUID();
      await db.prepare(`
        INSERT INTO document_analyses
        (id, document_id, status, error_message)
        VALUES (?, ?, ?, ?)
      `).run(
        analysisId,
        documentId,
        'error',
        error.message
      );
    } catch (dbError) {
      console.error('[Analyzer] Could not update database:', dbError.message);
    }
  }
}

export default router;
