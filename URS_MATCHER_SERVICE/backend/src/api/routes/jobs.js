/**
 * Jobs Routes
 * Handles file uploads, text matching, and result retrieval
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { parseExcelFile } from '../../services/fileParser.js';
import { matchUrsItems, generateRelatedItems } from '../../services/ursMatcher.js';
import { getDatabase } from '../../db/init.js';
import { logger } from '../../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.ods', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${ext}`));
    }
  }
});

// ============================================================================
// POST /api/jobs/file-upload
// ============================================================================

router.post('/file-upload', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    filePath = req.file.path;
    const jobId = uuidv4();

    logger.info(`[JOBS] File upload started: ${jobId}`);

    // Parse the file
    const rows = await parseExcelFile(filePath);
    logger.info(`[JOBS] Parsed ${rows.length} rows from ${req.file.originalname}`);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No data rows found in file' });
    }

    // Save job to database
    const db = await getDatabase();
    await db.run(
      `INSERT INTO jobs (id, filename, status, total_rows, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [jobId, req.file.originalname, 'processing', rows.length]
    );

    // Match URS items for each row
    const items = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const matches = await matchUrsItems(row.description, row.quantity, row.unit);

      // Select best match
      const bestMatch = matches.length > 0 ? matches[0] : null;

      if (bestMatch) {
        items.push({
          id: uuidv4(),
          job_id: jobId,
          input_row_id: i + 1,
          input_text: row.description,
          urs_code: bestMatch.urs_code,
          urs_name: bestMatch.urs_name,
          unit: bestMatch.unit || row.unit,
          quantity: row.quantity,
          confidence: bestMatch.confidence || 0,
          source: 'local_match',
          extra_generated: false
        });
      }
    }

    // Generate related items (tech-rules)
    const relatedItems = await generateRelatedItems(items);
    items.push(...relatedItems);

    // Save items to database
    for (const item of items) {
      await db.run(
        `INSERT INTO job_items
         (id, job_id, input_row_id, input_text, urs_code, urs_name, unit, quantity, confidence, source, extra_generated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.job_id,
          item.input_row_id,
          item.input_text,
          item.urs_code,
          item.urs_name,
          item.unit,
          item.quantity,
          item.confidence,
          item.source,
          item.extra_generated ? 1 : 0
        ]
      );
    }

    // Update job status
    await db.run(
      `UPDATE jobs SET status = ?, processed_rows = ? WHERE id = ?`,
      ['completed', items.length, jobId]
    );

    logger.info(`[JOBS] File upload completed: ${jobId} (${items.length} items)`);

    res.status(201).json({
      job_id: jobId,
      status: 'completed',
      filename: req.file.originalname,
      total_rows: rows.length,
      items_created: items.length,
      message: 'File processed successfully'
    });

  } catch (error) {
    logger.error(`[JOBS] File upload error: ${error.message}`);

    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// POST /api/jobs/text-match
// ============================================================================

router.post('/text-match', async (req, res) => {
  const startTime = Date.now();
  try {
    const { text, quantity = 0, unit = 'ks' } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    logger.info(`[JOBS] Text match: "${text.substring(0, 50)}..."`);

    // Match URS items
    const matches = await matchUrsItems(text, quantity, unit);

    if (matches.length === 0) {
      return res.status(200).json({
        candidates: [],
        related_items: [],
        message: 'No matching ÚRS items found',
        processing_time_ms: Date.now() - startTime
      });
    }

    // For text-match, return top 3 candidates
    const candidates = matches.slice(0, 3).map(m => ({
      urs_code: m.urs_code,
      urs_name: m.urs_name,
      unit: m.unit,
      confidence: m.confidence
    }));

    // Generate related items for best match
    const bestMatch = matches[0];
    const mockItems = [{
      urs_code: bestMatch.urs_code,
      urs_name: bestMatch.urs_name,
      unit: bestMatch.unit
    }];
    const relatedItems = await generateRelatedItems(mockItems);

    const processingTime = Date.now() - startTime;
    res.json({
      candidates,
      related_items: relatedItems,
      processing_time_ms: processingTime
    });

  } catch (error) {
    logger.error(`[JOBS] Text match error: ${error.message}`);
    res.status(400).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/jobs/:jobId
// ============================================================================

router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const db = await getDatabase();

    // Get job
    const job = await db.get(
      `SELECT * FROM jobs WHERE id = ?`,
      [jobId]
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Get items
    const items = await db.all(
      `SELECT * FROM job_items WHERE job_id = ? ORDER BY input_row_id`,
      [jobId]
    );

    res.json({
      job_id: job.id,
      status: job.status,
      filename: job.filename,
      created_at: job.created_at,
      total_rows: job.total_rows,
      processed_rows: job.processed_rows,
      items: items.map(item => ({
        input_row_id: item.input_row_id,
        input_text: item.input_text,
        urs_code: item.urs_code,
        urs_name: item.urs_name,
        unit: item.unit,
        quantity: item.quantity,
        confidence: item.confidence,
        source: item.source,
        extra_generated: Boolean(item.extra_generated)
      }))
    });

  } catch (error) {
    logger.error(`[JOBS] Get job error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/jobs
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();

    const jobs = await db.all(
      `SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50`
    );

    res.json({
      total: jobs.length,
      jobs: jobs.map(job => ({
        id: job.id,
        filename: job.filename,
        status: job.status,
        created_at: job.created_at,
        total_rows: job.total_rows,
        processed_rows: job.processed_rows
      }))
    });

  } catch (error) {
    logger.error(`[JOBS] List jobs error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// POST /api/jobs/:jobId/export
// ============================================================================

router.post('/:jobId/export', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { format = 'xlsx' } = req.body;

    const db = await getDatabase();

    const job = await db.get(
      `SELECT * FROM jobs WHERE id = ?`,
      [jobId]
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const items = await db.all(
      `SELECT * FROM job_items WHERE job_id = ?`,
      [jobId]
    );

    // TODO: Implement export to Excel/CSV
    // For now, return JSON
    res.json({
      message: 'Export functionality coming soon',
      job_id: jobId,
      items_count: items.length
    });

  } catch (error) {
    logger.error(`[JOBS] Export error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
