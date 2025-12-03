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
import { universalMatch, recordUserFeedback } from '../../services/universalMatcher.js';
import { getDatabase } from '../../db/init.js';
import { logger } from '../../utils/logger.js';
import { validateUniversalMatch, validateFeedback } from '../middleware/inputValidation.js';
import {
  createSafeUniversalMatchLog,
  createSafeFeedbackLog,
  createFileOperationLog,
  createSecurityEventLog,
  createContextualLogMessage,
  createAuditLog,
  logAuditEvent,
  sanitizeForLogging,
  redactText
} from '../../utils/loggingHelper.js';
import { validateDocumentCompleteness, getDocumentRequirements } from '../../services/documentValidatorService.js';
import { getCachedDocumentParsing, cacheDocumentParsing, initCache } from '../../services/cacheService.js';
import { validateFileContent } from '../../utils/fileValidator.js';
import { Orchestrator } from '../../services/roleIntegration/orchestrator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * SECURITY: Validate file path is confined to uploads directory
 * Prevents path traversal attacks (e.g., ../../etc/passwd)
 */
function validateUploadPath(filePath) {
  const resolvedPath = path.resolve(filePath);
  const resolvedUploadsDir = path.resolve(uploadsDir);

  // Check if resolved path is within uploads directory
  if (!resolvedPath.startsWith(resolvedUploadsDir)) {
    throw new Error('Invalid file path: path traversal detected');
  }

  return resolvedPath;
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
// HELPER FUNCTIONS FOR PHASE 3 ADVANCED
// ============================================================================

/**
 * Detect special keywords in block name that indicate complexity
 */
function detectSpecialKeywords(blockName) {
  const keywords = [
    'optimization', 'alternative', 'special', 'unusual',
    'experimental', 'custom', 'innovative', 'beton', 'betonář',
    'ocel', 'železo', 'konstrukce', 'nosná', 'kritická'
  ];

  const blockLower = blockName.toLowerCase();
  return keywords.filter(kw => blockLower.includes(kw));
}

/**
 * Format conflicts from orchestrator to frontend format
 */
function formatConflicts(orchestratorConflicts) {
  if (!Array.isArray(orchestratorConflicts)) {
    return [];
  }

  return orchestratorConflicts.map(conflict => ({
    type: conflict.type || 'UNKNOWN',
    description: conflict.description || 'Nebyl poskytnut popis konfliktu',
    severity: conflict.severity || 'MEDIUM',
    resolution: conflict.resolution || 'Čeká na ruční řešení'
  }));
}

/**
 * Create audit trail from orchestrator results
 */
function createAuditTrailFromOrchestrator(orchestratorResult, blockName) {
  const trail = [];
  const timestamp = new Date().toISOString();

  trail.push({
    timestamp,
    action: 'Phase 3 Advanced Analysis Started',
    details: `Analýza bloku: ${blockName}`
  });

  trail.push({
    timestamp: new Date(Date.now() + 100).toISOString(),
    action: 'Complexity Classification',
    details: `Klasifikace: ${orchestratorResult.complexity || 'N/A'}`
  });

  if (orchestratorResult.roles_consulted && orchestratorResult.roles_consulted.length > 0) {
    trail.push({
      timestamp: new Date(Date.now() + 200).toISOString(),
      action: 'Specialist Roles Selected',
      details: `Vybrané role: ${orchestratorResult.roles_consulted.join(', ')}`
    });
  }

  if (orchestratorResult.conflicts && orchestratorResult.conflicts.length > 0) {
    trail.push({
      timestamp: new Date(Date.now() + 300).toISOString(),
      action: 'Conflict Detection',
      details: `Detekováno ${orchestratorResult.conflicts.length} konflikt(ů)`
    });
  }

  trail.push({
    timestamp: new Date(Date.now() + orchestratorResult.execution_time_ms).toISOString(),
    action: 'Phase 3 Advanced Analysis Completed',
    details: `Čas zpracování: ${orchestratorResult.execution_time_ms}ms`
  });

  return trail;
}

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

    // SECURITY: Validate file content matches extension (magic bytes check)
    const fileValidation = await validateFileContent(filePath, req.file.originalname);
    if (!fileValidation.valid) {
      logger.warn(`[JOBS] File validation failed: ${fileValidation.error}`);

      // Log security event
      const securityLog = createSecurityEventLog({
        userId: req.user?.id || 'anonymous',
        eventType: 'invalid_file',
        severity: 'warning',
        description: `File validation failed: ${fileValidation.error}`,
        ipAddress: req.ip,
        details: { filename: req.file.originalname }
      });
      logger.warn(JSON.stringify(securityLog));

      // Clean up uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        // Ignore cleanup errors
      }
      return res.status(400).json({
        error: 'File validation failed',
        details: fileValidation.error
      });
    }

    logger.info(`[JOBS] File validation passed: ${fileValidation.fileType}`);

    // Log successful file upload
    const fileOpLog = createFileOperationLog({
      userId: req.user?.id || 'anonymous',
      jobId: jobId,
      operation: 'upload',
      filename: req.file.originalname,
      fileSize: req.file.size,
      fileType: fileValidation.fileType,
      status: 'success'
    });
    logger.info(JSON.stringify(fileOpLog));

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

      // Phase 3: Multi-Role validation + Advanced Orchestrator (if available)
      try {
        const { checkMultiRoleAvailability, validateBoqBlock } =
          await import('../../services/multiRoleClient.js');

        const multiRoleAvailable = await checkMultiRoleAvailability();

        if (multiRoleAvailable) {
          logger.info(`[JOBS] Running Multi-Role validation for block: ${blockName}`);

          const multiRoleValidation = await validateBoqBlock(boqBlock, projectContext);

          logger.info(`[JOBS] Multi-Role validation completed (completeness: ${multiRoleValidation.completeness_score}%)`);

          // Enhance block analysis with Multi-Role insights
          blockAnalysis.multi_role_validation = {
            completeness_score: multiRoleValidation.completeness_score,
            missing_items: multiRoleValidation.missing_items,
            warnings: multiRoleValidation.warnings,
            critical_issues: multiRoleValidation.critical_issues,
            confidence: multiRoleValidation.confidence,
            roles_consulted: multiRoleValidation.roles_consulted
          };

          // Add missing items to global_related_items if not already present
          if (multiRoleValidation.missing_items.length > 0) {
            if (!blockAnalysis.global_related_items) {
              blockAnalysis.global_related_items = [];
            }

            multiRoleValidation.missing_items.forEach(item => {
              blockAnalysis.global_related_items.push({
                urs_code: null,
                urs_name: item,
                reason: 'Identified as missing by Multi-Role AI validation',
                source: 'multi_role_validator'
              });
            });
          }

          // Phase 3 Advanced: Try to run full orchestrator analysis
          try {
            logger.info(`[JOBS] Running Phase 3 Advanced Orchestrator for block: ${blockName}`);
            const multiRoleClient = (await import('../../services/multiRoleClient.js')).default;
            const orchestrator = new Orchestrator(multiRoleClient);
            const orchestratorResult = await orchestrator.analyzeBlock(boqBlock, projectContext);

            logger.info(`[JOBS] Phase 3 Advanced analysis completed for: ${blockName}`);

            // Format orchestrator results for frontend
            blockAnalysis.phase3_advanced = {
              complexity_classification: {
                classification: orchestratorResult.complexity,
                row_count: boqBlock.rows?.length || 0,
                completeness_score: multiRoleValidation.completeness_score,
                special_keywords: detectSpecialKeywords(blockName)
              },
              selected_roles: orchestratorResult.roles_consulted || [],
              conflicts: formatConflicts(orchestratorResult.conflicts || []),
              analysis_results: orchestratorResult,
              execution_time_ms: orchestratorResult.execution_time_ms,
              audit_trail: createAuditTrailFromOrchestrator(orchestratorResult, blockName)
            };

          } catch (orchestratorError) {
            logger.warn(`[JOBS] Phase 3 Advanced analysis failed (non-critical): ${orchestratorError.message}`);
            // Graceful degradation: continue with basic multi-role validation
          }

        } else {
          logger.info(`[JOBS] Multi-Role API not available, skipping validation`);
        }
      } catch (multiRoleError) {
        logger.warn(`[JOBS] Multi-Role validation failed: ${multiRoleError.message}`);
        // Continue without Multi-Role validation (graceful degradation)
      }

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

// ============================================================================
// POST /api/jobs/parse-document
// Parse document and extract project context using STAVAGENT SmartParser
// Фаза 2: Auto-context extraction
// ============================================================================

router.post('/parse-document', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    filePath = req.file.path;
    const jobId = uuidv4();
    const userId = req.user?.id || 'default'; // Extract user ID if available

    // SECURITY: Validate file path is confined to uploads directory
    try {
      filePath = validateUploadPath(filePath);
    } catch (pathError) {
      logger.error(`[SECURITY] Path traversal attempt detected: ${pathError.message}`);
      const securityLog = createSecurityEventLog({
        userId: userId,
        eventType: 'path_traversal',
        severity: 'critical',
        description: 'Path traversal attack attempted',
        ipAddress: req.ip,
        details: { attempt: req.file.path?.substring(0, 50) } // Redacted for safety
      });
      logger.error(JSON.stringify(securityLog));
      return res.status(400).json({ error: 'Invalid file path' });
    }

    logger.info(`[JOBS] Document parsing started: ${jobId}`);

    // SECURITY: Validate file content matches extension (magic bytes check)
    const fileValidation = await validateFileContent(filePath, req.file.originalname);
    if (!fileValidation.valid) {
      logger.warn(`[JOBS] File validation failed: ${fileValidation.error}`);

      // Log security event
      const securityLog = createSecurityEventLog({
        userId: userId,
        eventType: 'invalid_file',
        severity: 'warning',
        description: `Document parsing - File validation failed: ${fileValidation.error}`,
        ipAddress: req.ip,
        details: { filename: req.file.originalname }
      });
      logger.warn(JSON.stringify(securityLog));

      // Clean up uploaded file
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        // Ignore cleanup errors
      }
      return res.status(400).json({
        error: 'File validation failed',
        details: fileValidation.error
      });
    }

    logger.info(`[JOBS] File validation passed: ${fileValidation.fileType}`);

    // Log successful file upload for document parsing
    const fileOpLog = createFileOperationLog({
      userId: userId,
      jobId: jobId,
      operation: 'upload',
      filename: req.file.originalname,
      fileSize: req.file.size,
      fileType: fileValidation.fileType,
      status: 'success'
    });
    logger.info(JSON.stringify(fileOpLog));

    // FIXED: Check cache FIRST before expensive processing
    logger.info(`[JOBS] Checking cache for parsed document...`);
    const cachedResult = await getCachedDocumentParsing(req.file.originalname, userId, jobId);
    if (cachedResult) {
      logger.info(`[JOBS] Cache HIT - returning cached result for: ${req.file.originalname}`);

      // Clean up the uploaded file as it's not needed (prevents disk space exhaustion)
      try {
        await fs.promises.unlink(filePath);

        // Log file cleanup with user context
        const fileExt = req.file.originalname.split('.').pop()?.toLowerCase() || 'unknown';
        const fileOpLog = createFileOperationLog({
          userId: userId,
          jobId: jobId,
          operation: 'delete',
          filename: req.file.originalname,
          fileSize: req.file.size,
          fileType: fileExt,
          status: 'success'
        });
        logger.debug(JSON.stringify(fileOpLog));
      } catch (err) {
        // Log cleanup failure with redacted error details
        const fileExt = req.file.originalname.split('.').pop()?.toLowerCase() || 'unknown';
        const fileOpLog = createFileOperationLog({
          userId: userId,
          jobId: jobId,
          operation: 'delete',
          filename: req.file.originalname,
          fileSize: req.file.size,
          fileType: fileExt,
          status: 'failure',
          reason: err.code || 'unknown' // Log error code only, not full message
        });
        logger.warn(JSON.stringify(fileOpLog));
        // Don't fail the request if cleanup fails
      }

      return res.status(200).json({
        job_id: jobId,
        status: 'completed',
        filename: req.file.originalname,
        from_cache: true,
        cached_at: new Date().toISOString(),
        parsed_document: {
          file_type: cachedResult.parsedDocument?.file_type,
          pages_count: cachedResult.parsedDocument?.pages_count || 0,
          has_tables: cachedResult.parsedDocument?.has_tables || false
        },
        project_context: cachedResult.projectContext,
        qa_flow: cachedResult.qaResults,
        document_validation: cachedResult.documentValidation,
        message: 'Document parsed from cache'
      });
    }

    logger.info(`[JOBS] Cache MISS - processing document...`);

    // AUDIT: Log parsing start (triggered by cache miss)
    logAuditEvent(
      {
        userId: userId,
        jobId: jobId,
        action: 'parse_document_start',
        resource: 'document_parsing',
        status: 'in_progress',
        ipAddress: req.ip,
        details: {
          filename: req.file.originalname,
          trigger: 'cache_miss'
        }
      },
      logger,
      'info'
    );

    // Import STAVAGENT client
    const { parseDocumentWithStavagent, extractProjectContext, checkStavagentAvailability } =
      await import('../../services/stavagentClient.js');

    // Check if STAVAGENT is available
    const stavagentAvailable = await checkStavagentAvailability();

    if (!stavagentAvailable) {
      logger.warn(`[JOBS] STAVAGENT SmartParser not available, using fallback`);
      return res.status(503).json({
        error: 'STAVAGENT SmartParser is not available',
        suggestion: 'Please ensure concrete-agent Python dependencies are installed'
      });
    }

    // Parse document using STAVAGENT SmartParser
    logger.info(`[JOBS] Calling STAVAGENT SmartParser...`);
    const parsedDocument = await parseDocumentWithStavagent(filePath);

    logger.info(`[JOBS] Document parsed successfully`);

    // Extract project context (building_type, storeys, main_system, etc.)
    logger.info(`[JOBS] Extracting project context...`);
    const projectContext = await extractProjectContext(filePath);

    logger.info(`[JOBS] Context extracted: ${JSON.stringify(projectContext)}`);

    // Run Document Q&A Flow to fill gaps
    logger.info(`[JOBS] Running Document Q&A Flow...`);
    const { runQAFlow } = await import('../../services/documentQAService.js');

    parsedDocument.filename = req.file.originalname; // Add filename for source tracking
    const qaResults = await runQAFlow(parsedDocument, projectContext);

    logger.info(`[JOBS] Q&A Flow completed: ${qaResults.answered_count} answered, ${qaResults.unanswered_count} need input`);

    // Validate document completeness
    logger.info(`[JOBS] Validating document completeness...`);
    const uploadedFiles = req.file ? [{ filename: req.file.originalname, size: req.file.size }] : [];
    const documentValidation = await validateDocumentCompleteness(uploadedFiles, qaResults.enhanced_context);

    logger.info(`[JOBS] Document validation: ${documentValidation.completeness_score}% complete`);

    // AUDIT: Log validation outcome with user context
    logAuditEvent(
      {
        userId: userId,
        jobId: jobId,
        action: 'validate_completeness',
        resource: 'document_validation',
        status: 'completed',
        severity: documentValidation.severity,
        ipAddress: req.ip,
        details: {
          completeness_score: documentValidation.completeness_score,
          has_critical_rfi: documentValidation.has_critical_rfi,
          missing_docs_count: documentValidation.missing_documents.length,
          rfi_items_count: documentValidation.rfi_items.length
        }
      },
      logger,
      'info'
    );

    // Cache parsing results for future use
    try {
      await cacheDocumentParsing(
        req.file.originalname,
        {
          parsedDocument,
          projectContext,
          qaResults,
          documentValidation
        },
        userId,
        jobId
      );
      logger.debug(`[JOBS] Document parsing cached for future use`);
    } catch (cacheError) {
      logger.error(`[Cache] Failed to cache document (will not affect response): ${cacheError.message}`);
      // Don't fail the request if cache fails
    }

    // Save to database
    const db = await getDatabase();
    await db.run(
      `INSERT INTO jobs (id, filename, status, total_rows, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [jobId, req.file.originalname, 'completed', 0]
    );

    // AUDIT: Log parsing finish with success outcome
    logAuditEvent(
      {
        userId: userId,
        jobId: jobId,
        action: 'parse_document_finish',
        resource: 'document_parsing',
        status: 'success',
        ipAddress: req.ip,
        details: {
          filename: req.file.originalname,
          pages_count: parsedDocument.metadata?.total_pages || parsedDocument.metadata?.total_sheets || 0,
          qa_answered: qaResults.answered_count,
          qa_unanswered: qaResults.unanswered_count,
          completeness_score: documentValidation.completeness_score
        }
      },
      logger,
      'info'
    );

    res.status(200).json({
      job_id: jobId,
      status: 'completed',
      filename: req.file.originalname,
      parsed_document: {
        file_type: parsedDocument.file_type || path.extname(req.file.originalname),
        pages_count: parsedDocument.metadata?.total_pages || parsedDocument.metadata?.total_sheets || 0,
        has_tables: parsedDocument.metadata?.has_tables || false
      },
      project_context: qaResults.enhanced_context,
      qa_flow: {
        questions: qaResults.questions,
        answered_count: qaResults.answered_count,
        unanswered_count: qaResults.unanswered_count,
        enhanced_context: qaResults.enhanced_context,
        requires_user_input: qaResults.requires_user_input,
        rfi_needed: qaResults.rfi_needed
      },
      document_validation: {
        completeness_score: documentValidation.completeness_score,
        uploaded_documents: documentValidation.uploaded_documents,
        missing_documents: documentValidation.missing_documents,
        context_validation: documentValidation.context_validation,
        rfi_items: documentValidation.rfi_items,
        severity: documentValidation.severity,
        recommendations: documentValidation.recommendations
      },
      message: 'Document parsed, context extracted, Q&A flow completed, and validation performed'
    });

    // Clean up uploaded file after successful processing
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

  } catch (error) {
    logger.error(`[JOBS] Document parsing error: ${error.message}`);
    logger.error(error.stack);

    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(400).json({
      error: error.message,
      details: 'Failed to parse document or extract context'
    });
  }
});

// ============================================================================
// POST /api/jobs/:jobId/confirm-qa
// User confirms or edits Q&A answers before running block-match
// Фаза 2: Q&A confirmation workflow
// ============================================================================

router.post('/:jobId/confirm-qa', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { confirmed_answers } = req.body;

    if (!confirmed_answers) {
      return res.status(400).json({ error: 'confirmed_answers is required' });
    }

    logger.info(`[JOBS] Q&A confirmation for job: ${jobId}`);
    logger.info(`[JOBS] Received ${Object.keys(confirmed_answers).length} confirmed answers`);

    // Build final project context from confirmed answers
    const finalContext = {
      building_type: 'neurčeno',
      storeys: 0,
      main_system: [],
      notes: []
    };

    Object.entries(confirmed_answers).forEach(([questionId, answer]) => {
      switch (questionId) {
        case 'q_building_type':
          finalContext.building_type = answer.value;
          break;
        case 'q_storeys':
          finalContext.storeys = parseInt(answer.value, 10);
          break;
        case 'q_foundation_concrete':
          finalContext.foundation_concrete = answer.value;
          break;
        case 'q_wall_material':
        case 'q_main_system':
          if (!finalContext.main_system.includes(answer.value)) {
            finalContext.main_system.push(answer.value);
          }
          break;
        case 'q_insulation':
          finalContext.insulation = answer.value;
          break;
        case 'q_roofing':
          finalContext.roofing = answer.value;
          break;
      }

      // Add note if user edited the answer
      if (answer.user_edited) {
        finalContext.notes.push(`${questionId}: ${answer.note || 'User provided custom value'}`);
      }
    });

    logger.info(`[JOBS] Final context built: ${JSON.stringify(finalContext)}`);

    // Save confirmed context to database (optional)
    const db = await getDatabase();
    await db.run(
      `UPDATE jobs SET status = ? WHERE id = ?`,
      ['ready_for_analysis', jobId]
    );

    res.status(200).json({
      job_id: jobId,
      status: 'ready_for_analysis',
      final_context: finalContext,
      message: 'Q&A answers confirmed. Ready for block analysis.',
      next_step: {
        action: 'Upload BOQ file for block-match analysis',
        endpoint: 'POST /api/jobs/block-match',
        required_fields: {
          file: 'BOQ Excel file',
          project_context: finalContext
        }
      }
    });

  } catch (error) {
    logger.error(`[JOBS] Q&A confirmation error: ${error.message}`);
    res.status(400).json({ error: error.message });
  }
});

/**
 * =====================================================================
 * UNIVERSAL MATCH ENDPOINT
 * =====================================================================
 * POST /api/jobs/universal-match
 *
 * Purpose: Match any language construction work description to ÚRS codes
 * - Detects input language
 * - Normalizes to technical Czech
 * - Checks Knowledge Base for fast path
 * - Falls back to LLM matching if needed
 * - Returns structured result with explanations
 *
 * Request JSON:
 * {
 *   "text": "any construction work description (any language)",
 *   "quantity": 45,                     // optional
 *   "unit": "m2",                       // optional
 *   "projectType": "bytový dům",        // optional
 *   "buildingSystem": "monolitický ŽB", // optional
 *   "candidateItems": [
 *     {
 *       "urs_code": "34135",
 *       "urs_name": "Stěny z betonu...",
 *       "unit": "m3",
 *       "description": "..."
 *     }
 *   ]
 * }
 *
 * Response JSON:
 * {
 *   "query": { detected_language, normalized_text_cs, quantity, unit },
 *   "matches": [ { urs_code, urs_name, unit, confidence, role } ],
 *   "related_items": [ { urs_code, urs_name, unit, reason_cs } ],
 *   "explanation_cs": "Czech explanation",
 *   "knowledge_suggestions": [...],
 *   "status": "ok" | "ambiguous" | "error",
 *   "notes_cs": "...",
 *   "execution_time_ms": 1234
 * }
 */
router.post('/universal-match', validateUniversalMatch, async (req, res) => {
  try {
    const { text, quantity, unit, projectType, buildingSystem, candidateItems } = req.body;

    // Log with redacted user input
    const safeLog = createSafeUniversalMatchLog(req.body);
    logger.info(`[UNIVERSAL-MATCH] Request: ${JSON.stringify(safeLog)}`);

    // Call universal matcher
    const result = await universalMatch({
      text,
      quantity: quantity || null,
      unit: unit || null,
      projectType: projectType || null,
      buildingSystem: buildingSystem || null,
      candidateItems: candidateItems || []
    });

    // Return structured result
    res.status(200).json(result);

    logger.info(
      `[UNIVERSAL-MATCH] Complete: ${result.matches.length} matches, status=${result.status}`
    );

  } catch (error) {
    logger.error(`[UNIVERSAL-MATCH] Error: ${error.message}`);
    res.status(500).json({
      error: 'Invalid request parameters',
      status: 'error'
    });
  }
});

/**
 * =====================================================================
 * UNIVERSAL MATCH FEEDBACK ENDPOINT
 * =====================================================================
 * POST /api/jobs/universal-match/feedback
 *
 * Purpose: Record user validation/correction of matches
 * Stores confirmed mappings in Knowledge Base for future reuse
 *
 * Request JSON:
 * {
 *   "urs_code": "34135",
 *   "urs_name": "Stěny z betonu železového",
 *   "unit": "m3",
 *   "normalized_text_cs": "stěny z betonu ŽB",
 *   "detected_language": "cs",
 *   "project_type": "bytový dům",
 *   "building_system": "monolitický ŽB",
 *   "is_correct": true,
 *   "user_comment": "User validated this match"
 * }
 */
router.post('/universal-match/feedback', validateFeedback, async (req, res) => {
  try {
    const {
      urs_code,
      urs_name,
      unit,
      normalized_text_cs,
      detected_language,
      project_type,
      building_system,
      is_correct,
      user_comment
    } = req.body;

    // Log with redacted user input
    const safeLog = createSafeFeedbackLog(req.body);
    logger.info(
      `[FEEDBACK] Recording: ${JSON.stringify(safeLog)}`
    );

    // Record feedback
    const result = await recordUserFeedback(
      {}, // matchResult (not used now, but could be expanded)
      {
        urs_code,
        urs_name,
        unit,
        normalized_text_cs,
        detected_language,
        project_type,
        building_system,
        is_correct,
        user_comment
      }
    );

    res.status(200).json({
      success: true,
      message: 'Feedback recorded successfully',
      data: result
    });

  } catch (error) {
    logger.error(`[FEEDBACK] Error: ${error.message}`);
    res.status(500).json({
      error: 'Invalid request parameters'
    });
  }
});

export default router;
