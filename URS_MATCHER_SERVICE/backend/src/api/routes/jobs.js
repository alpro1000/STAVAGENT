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
import { matchUrsItemWithAI, explainMapping, isLLMEnabled } from '../../services/llmClient.js';
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
      let matches = await matchUrsItems(row.description, row.quantity, row.unit);

      // Apply LLM re-ranking if enabled
      let usedLLM = false;
      if (matches.length > 0 && isLLMEnabled()) {
        logger.debug(`[JOBS] Applying LLM re-ranking for row ${i + 1}`);
        matches = await matchUrsItemWithAI(row.description, row.quantity, row.unit, matches);
        usedLLM = true;
      }

      // Select best match
      const bestMatch = matches.length > 0 ? matches[0] : null;

      if (bestMatch) {
        // Generate explanation for best match
        let explanation = null;
        try {
          const explainResult = await explainMapping(row.description, {
            urs_code: bestMatch.urs_code,
            urs_name: bestMatch.urs_name,
            unit: bestMatch.unit || row.unit,
            description: bestMatch.description
          });
          explanation = explainResult?.reason || null;
        } catch (err) {
          logger.warn(`[JOBS] Failed to generate explanation for row ${i + 1}: ${err.message}`);
          explanation = null;
        }

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
          source: usedLLM ? 'llm_match' : 'local_match',
          explanation: explanation,
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
         (id, job_id, input_row_id, input_text, urs_code, urs_name, unit, quantity, confidence, source, explanation, extra_generated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          item.explanation || null,
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
    const { text, quantity = 0, unit = 'ks', use_llm = true } = req.body;

    logger.debug(`[JOBS/TEXT-MATCH] Request payload: ${JSON.stringify({ text: text?.substring(0, 50), quantity, unit, use_llm })}`);

    if (!text || text.trim().length === 0) {
      logger.warn(`[JOBS/TEXT-MATCH] Empty text provided`);
      return res.status(400).json({ error: 'Text is required' });
    }

    const lmmEnabled = use_llm && isLLMEnabled();
    logger.info(`[JOBS/TEXT-MATCH] 🔍 Searching for: "${text.substring(0, 50)}..." (LLM: ${lmmEnabled ? 'enabled' : 'disabled'}, Quantity: ${quantity}, Unit: ${unit})`);

    // Match URS items (local similarity or Perplexity)
    logger.debug(`[JOBS/TEXT-MATCH] Calling matchUrsItems...`);
    const matches = await matchUrsItems(text, quantity, unit);

    logger.info(`[JOBS/TEXT-MATCH] ✓ Found ${matches.length} matches`);
    if (matches.length > 0) {
      logger.debug(`[JOBS/TEXT-MATCH] Top match: ${matches[0]?.urs_code} - ${matches[0]?.urs_name} (confidence: ${matches[0]?.confidence})`);
    }

    if (matches.length === 0) {
      logger.info(`[JOBS/TEXT-MATCH] No matching ÚRS items found`);
      return res.status(200).json({
        candidates: [],
        related_items: [],
        message: 'No matching ÚRS items found',
        processing_time_ms: Date.now() - startTime
      });
    }

    // For text-match, use top 5 as candidates for LLM re-ranking
    let candidates = matches.slice(0, 5);

    // Apply LLM re-ranking if enabled
    if (use_llm && isLLMEnabled()) {
      logger.debug(`[JOBS] Applying LLM re-ranking for top ${candidates.length} candidates`);
      candidates = await matchUrsItemWithAI(text, quantity, unit, candidates);
    }

    // Return top 3 after re-ranking
    const topCandidates = candidates.slice(0, 3).map(m => ({
      urs_code: m.urs_code,
      urs_name: m.urs_name,
      unit: m.unit,
      confidence: m.confidence,
      match_type: m.match_type || 'local'
    }));

    // Generate explanation for best match
    let explanation = null;
    if (topCandidates.length > 0) {
      const bestMatch = candidates[0];
      explanation = await explainMapping(text, {
        urs_code: bestMatch.urs_code,
        urs_name: bestMatch.urs_name,
        unit: bestMatch.unit,
        description: bestMatch.description
      });
      logger.debug(`[JOBS] Generated explanation: ${explanation.source}`);
    }

    // Generate related items for best match
    const bestMatch = candidates[0];
    const mockItems = [{
      urs_code: bestMatch.urs_code,
      urs_name: bestMatch.urs_name,
      unit: bestMatch.unit
    }];
    const relatedItems = await generateRelatedItems(mockItems);

    const processingTime = Date.now() - startTime;
    res.json({
      candidates: topCandidates,
      best_match: topCandidates.length > 0 ? {
        ...topCandidates[0],
        explanation: explanation?.reason || null
      } : null,
      related_items: relatedItems,
      llm_enabled: isLLMEnabled(),
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
        explanation: item.explanation || null,
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

// ============================================================================
// POST /api/jobs/block-match
// Analyze a block of work items with project context
// MVP: Фаза 1 - ручной project_context input
// ============================================================================

router.post('/block-match', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    filePath = req.file.path;
    const jobId = uuidv4();

    // Get project context from request body
    const projectContext = req.body.project_context
      ? JSON.parse(req.body.project_context)
      : {
          building_type: 'neurčeno',
          storeys: 0,
          main_system: [],
          notes: []
        };

    logger.info(`[JOBS] Block-match started: ${jobId}`);
    logger.info(`[JOBS] Project context: ${JSON.stringify(projectContext)}`);

    // Parse the file
    const rows = await parseExcelFile(filePath);
    logger.info(`[JOBS] Parsed ${rows.length} rows from ${req.file.originalname}`);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No data rows found in file' });
    }

    // Import TŘÍDNÍK grouping function
    const { groupItemsByWorkType } = await import('../../services/tridnikParser.js');

    // Group rows by TŘÍDNÍK classification
    const grouped = groupItemsByWorkType(rows);
    const blockNames = Object.keys(grouped);

    logger.info(`[JOBS] Grouped into ${blockNames.length} blocks: ${blockNames.join(', ')}`);

    // Save job to database
    const db = await getDatabase();
    await db.run(
      `INSERT INTO jobs (id, filename, status, total_rows, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [jobId, req.file.originalname, 'processing', rows.length]
    );

    // Process each block
    const blockResults = [];

    for (const [blockName, blockRows] of Object.entries(grouped)) {
      logger.info(`[JOBS] Processing block: ${blockName} (${blockRows.length} rows)`);

      // Prepare block structure
      const boqBlock = {
        block_id: blockName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase(),
        title: blockName,
        rows: blockRows.map((row, idx) => ({
          row_id: idx + 1,
          group: blockName,
          raw_text: row.description,
          level: '1NP', // TODO: Extract from description if available
          quantity: row.quantity,
          unit: row.unit
        }))
      };

      // Search URS candidates for each row in parallel
      logger.info(`[JOBS] Searching URS candidates for ${blockRows.length} rows...`);

      const ursCandidatesArray = await Promise.all(
        blockRows.map(async (row) => {
          try {
            const candidates = await matchUrsItems(row.description, row.quantity, row.unit);
            return candidates.slice(0, 5); // Top 5 candidates
          } catch (error) {
            logger.warn(`[JOBS] Failed to find candidates for "${row.description}": ${error.message}`);
            return [];
          }
        })
      );

      // Convert array to object { row_id: candidates[] }
      const ursCandidates = {};
      blockRows.forEach((row, idx) => {
        ursCandidates[idx + 1] = ursCandidatesArray[idx] || [];
      });

      logger.info(`[JOBS] Found candidates for ${Object.keys(ursCandidates).length} rows`);

      // Call LLM for block analysis
      const { analyzeBlock } = await import('../../services/llmClient.js');

      const blockAnalysis = await analyzeBlock(projectContext, boqBlock, ursCandidates);

      logger.info(`[JOBS] Block analysis completed for: ${blockName}`);

      blockResults.push({
        block_name: blockName,
        block_id: boqBlock.block_id,
        rows_count: blockRows.length,
        analysis: blockAnalysis
      });
    }

    // Update job status
    await db.run(
      `UPDATE jobs SET status = ?, processed_rows = ? WHERE id = ?`,
      ['completed', rows.length, jobId]
    );

    logger.info(`[JOBS] Block-match completed: ${jobId} (${blockResults.length} blocks)`);

    res.status(201).json({
      job_id: jobId,
      status: 'completed',
      filename: req.file.originalname,
      total_rows: rows.length,
      blocks_count: blockResults.length,
      project_context: projectContext,
      blocks: blockResults,
      message: 'Block analysis completed successfully'
    });

  } catch (error) {
    logger.error(`[JOBS] Block-match error: ${error.message}`);
    logger.error(error.stack);

    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(400).json({ error: error.message });
  }
});

export default router;
