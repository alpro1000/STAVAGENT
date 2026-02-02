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
import { matchUrsItemWithAI, explainMapping, isLLMEnabled, getLLMInfo } from '../../services/llmClient.js';
import { universalMatch, recordUserFeedback } from '../../services/universalMatcher.js';
import { searchNormsAndStandards } from '../../services/perplexityClient.js';
import { searchKnowledgeBase, getKBStatus } from '../../services/concreteAgentKB.js';
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
import { extractWorksFromDocument } from '../../services/documentExtractionService.js';
import { validateFileContent } from '../../utils/fileValidator.js';
import { Orchestrator } from '../../services/roleIntegration/orchestrator.js';
import {
  getCachedBlockAnalysis,
  setCachedBlockAnalysis,
  getCacheStats,
  cleanExpiredEntries
} from '../../services/orchestratorCacheService.js';
import {
  startRequestTimer,
  addTimerMarker,
  endRequestTimer,
  recordRoleExecution,
  getPerformanceSummary,
  getDetailedPerformanceReport,
  getEndpointMetrics,
  getRoleMetrics
} from '../../services/performanceOptimizer.js';

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

// Document extraction multer (PDF, DOCX)
const uploadDocument = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed for document extraction: ${ext}`));
    }
  }
});

// Separate multer for document uploads (Phase 2)
const documentUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for documents
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.xlsx', '.xls', '.dwg', '.jpg', '.jpeg', '.png', '.txt', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed for document upload: ${ext}`));
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
      'UPDATE jobs SET status = ?, processed_rows = ? WHERE id = ?',
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
      logger.warn('[JOBS/TEXT-MATCH] Empty text provided');
      return res.status(400).json({ error: 'Text is required' });
    }

    const lmmEnabled = use_llm && isLLMEnabled();
    logger.info(`[JOBS/TEXT-MATCH] 🔍 Searching for: "${text.substring(0, 50)}..." (LLM: ${lmmEnabled ? 'enabled' : 'disabled'}, Quantity: ${quantity}, Unit: ${unit})`);

    // Match URS items (local similarity or Perplexity)
    logger.debug('[JOBS/TEXT-MATCH] Calling matchUrsItems...');
    const matches = await matchUrsItems(text, quantity, unit);

    logger.info(`[JOBS/TEXT-MATCH] ✓ Found ${matches.length} matches`);
    if (matches.length > 0) {
      logger.debug(`[JOBS/TEXT-MATCH] Top match: ${matches[0]?.urs_code} - ${matches[0]?.urs_name} (confidence: ${matches[0]?.confidence})`);
    }

    if (matches.length === 0) {
      logger.info('[JOBS/TEXT-MATCH] No matching ÚRS items found');
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
      'SELECT * FROM jobs WHERE id = ?',
      [jobId]
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Get items
    const items = await db.all(
      'SELECT * FROM job_items WHERE job_id = ? ORDER BY input_row_id',
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
      'SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50'
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
      'SELECT * FROM jobs WHERE id = ?',
      [jobId]
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check if we have results_json (new block-match format)
    if (job.results_json) {
      // Import Excel exporter
      const { createBlockMatchExcel } = await import('../../utils/excelExporter.js');

      const resultsData = JSON.parse(job.results_json);
      const excelBuffer = createBlockMatchExcel(resultsData);

      // Send Excel file
      const filename = `URS_Match_${job.filename.replace(/\.[^.]+$/, '')}_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);

      return res.send(excelBuffer);
    }

    // Fallback: Old format (job_items table)
    const items = await db.all(
      'SELECT * FROM job_items WHERE job_id = ?',
      [jobId]
    );

    if (items.length > 0) {
      const { createJobItemsExcel } = await import('../../utils/excelExporter.js');
      const excelBuffer = createJobItemsExcel(job, items);

      const filename = `URS_Match_${job.filename.replace(/\.[^.]+$/, '')}_${new Date().toISOString().split('T')[0]}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);

      return res.send(excelBuffer);
    }

    // No data found
    return res.status(404).json({
      error: 'No results found for this job',
      job_id: jobId
    });

  } catch (error) {
    logger.error(`[JOBS] Export error: ${error.message}`);
    logger.error(error.stack);
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

    // Save job to database with project context
    const db = await getDatabase();
    await db.run(
      `INSERT INTO jobs (id, filename, status, total_rows, project_context, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [jobId, req.file.originalname, 'processing', rows.length, JSON.stringify(projectContext)]
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

      // Search URS candidates, norms, AND knowledge base in parallel
      logger.info(`[JOBS] Searching URS candidates for ${blockRows.length} rows...`);

      // Create combined search query from all row descriptions for norms search
      const blockDescriptions = blockRows.map(r => r.description).join(', ');
      const normsSearchQuery = `${blockName}: ${blockDescriptions.substring(0, 200)}`;

      // Run URS candidates search, norms search, AND KB search in parallel
      const [ursCandidatesArray, normsData, kbData] = await Promise.all([
        // URS candidates for each row
        Promise.all(
          blockRows.map(async (row) => {
            try {
              const candidates = await matchUrsItems(row.description, row.quantity, row.unit);
              return candidates.slice(0, 5); // Top 5 candidates
            } catch (error) {
              logger.warn(`[JOBS] Failed to find candidates for "${row.description}": ${error.message}`);
              return [];
            }
          })
        ),
        // Norms and standards search for the entire block (Perplexity)
        (async () => {
          try {
            const norms = await searchNormsAndStandards(normsSearchQuery);
            if (norms.norms?.length > 0 || norms.technical_conditions?.length > 0) {
              logger.info(`[JOBS] Found ${norms.norms?.length || 0} norms, ${norms.technical_conditions?.length || 0} tech conditions for block: ${blockName}`);
            }
            return norms;
          } catch (error) {
            logger.warn(`[JOBS] Norms search failed for block "${blockName}": ${error.message}`);
            return { norms: [], technical_conditions: [], methodology_notes: null };
          }
        })(),
        // Knowledge Base search (local concrete-agent data)
        (async () => {
          try {
            // Search KB for each row description
            const kbResults = blockRows.map(row => searchKnowledgeBase(row.description));
            const combined = {
              concreteClasses: [],
              exposureClasses: [],
              relevantNorms: [],
              recommendations: []
            };

            for (const result of kbResults) {
              if (result.concreteClass) combined.concreteClasses.push(result.concreteClass);
              combined.exposureClasses.push(...result.exposureClasses);
              combined.relevantNorms.push(...result.relevantNorms);
              combined.recommendations.push(...result.recommendations);
            }

            // Deduplicate
            combined.exposureClasses = [...new Map(combined.exposureClasses.map(e => [e.class, e])).values()];
            combined.relevantNorms = [...new Set(combined.relevantNorms)];
            combined.recommendations = [...new Set(combined.recommendations)];

            if (combined.concreteClasses.length > 0 || combined.exposureClasses.length > 0) {
              logger.info(`[JOBS] KB found: ${combined.concreteClasses.length} concrete classes, ${combined.exposureClasses.length} exposure classes for block: ${blockName}`);
            }

            return combined;
          } catch (error) {
            logger.warn(`[JOBS] KB search failed for block "${blockName}": ${error.message}`);
            return { concreteClasses: [], exposureClasses: [], relevantNorms: [], recommendations: [] };
          }
        })()
      ]);

      // Merge KB norms with Perplexity norms
      if (kbData.relevantNorms.length > 0) {
        normsData.norms = normsData.norms || [];
        for (const norm of kbData.relevantNorms) {
          if (!normsData.norms.some(n => n.code === norm)) {
            normsData.norms.push({ code: norm, title: norm, source: 'knowledge_base' });
          }
        }
      }

      // Convert array to object { row_id: candidates[] }
      const ursCandidates = {};
      blockRows.forEach((row, idx) => {
        ursCandidates[idx + 1] = ursCandidatesArray[idx] || [];
      });

      logger.info(`[JOBS] Found candidates for ${Object.keys(ursCandidates).length} rows`);

      // Call LLM for block analysis (with norms context)
      const { analyzeBlock } = await import('../../services/llmClient.js');

      const blockAnalysis = await analyzeBlock(projectContext, boqBlock, ursCandidates, normsData);

      // Add norms and KB data to block analysis result
      blockAnalysis.referenced_norms = normsData.norms || [];
      blockAnalysis.technical_conditions = normsData.technical_conditions || [];

      // Add knowledge base insights
      blockAnalysis.knowledge_base = {
        concrete_classes: kbData.concreteClasses || [],
        exposure_classes: kbData.exposureClasses || [],
        recommendations: kbData.recommendations || []
      };

      logger.info(`[JOBS] Block analysis completed for: ${blockName}`);

      // Phase 3: Multi-Role validation + Advanced Orchestrator (if available)
      // Connects to concrete-agent.onrender.com (STAVAGENT Core / Ядро)
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

            // Start performance timer for orchestrator
            const orchestratorTimer = startRequestTimer(`orchestrator-${blockName}`, '/block-match');

            // Check cache FIRST (before expensive analysis)
            const cachedResult = getCachedBlockAnalysis(boqBlock, projectContext);
            let orchestratorResult;
            let fromCache = false;

            if (cachedResult) {
              logger.info(`[JOBS] 🎯 Cache HIT for block: ${blockName}`);
              orchestratorResult = cachedResult;
              fromCache = true;
              addTimerMarker(orchestratorTimer, 'cache_hit');

            } else {
              logger.info(`[JOBS] 🔄 Cache MISS for block: ${blockName}, running orchestrator...`);
              addTimerMarker(orchestratorTimer, 'orchestrator_start');

              const multiRoleClient = (await import('../../services/multiRoleClient.js')).default;
              const orchestrator = new Orchestrator(multiRoleClient);
              orchestratorResult = await orchestrator.analyzeBlock(boqBlock, projectContext);

              addTimerMarker(orchestratorTimer, 'orchestrator_complete');

              // Cache the result for future requests
              const cacheKey = setCachedBlockAnalysis(boqBlock, projectContext, orchestratorResult);
              logger.info(`[JOBS] ✓ Orchestrator result cached: ${cacheKey}`);
            }

            // End performance timer
            const perfMetric = endRequestTimer(orchestratorTimer, {
              endpoint: '/block-match',
              block_name: blockName,
              from_cache: fromCache
            });
            logger.info(`[JOBS] Orchestrator execution time: ${perfMetric.duration_ms}ms (cache: ${fromCache})`);

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
              audit_trail: createAuditTrailFromOrchestrator(orchestratorResult, blockName),
              cache_status: {
                from_cache: fromCache,
                cached_at: fromCache ? new Date().toISOString() : null
              }
            };

          } catch (orchestratorError) {
            logger.warn(`[JOBS] Phase 3 Advanced analysis failed (non-critical): ${orchestratorError.message}`);
            // Graceful degradation: continue with basic multi-role validation
          }

        } else {
          logger.info('[JOBS] Multi-Role API not available, skipping validation');
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

    // Save complete results to database for Excel export
    const resultsForDB = {
      filename: req.file.originalname,
      project_context: projectContext,
      blocks: blockResults,
      llm_info: getLLMInfo()
    };

    // Update job status and save results
    await db.run(
      'UPDATE jobs SET status = ?, processed_rows = ?, results_json = ? WHERE id = ?',
      ['completed', rows.length, JSON.stringify(resultsForDB), jobId]
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
      llm_info: getLLMInfo(),
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
    logger.info('[JOBS] Checking cache for parsed document...');
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

    logger.info('[JOBS] Cache MISS - processing document...');

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
      logger.warn('[JOBS] STAVAGENT SmartParser not available, using fallback');
      return res.status(503).json({
        error: 'STAVAGENT SmartParser is not available',
        suggestion: 'Please ensure concrete-agent Python dependencies are installed'
      });
    }

    // Parse document using STAVAGENT SmartParser
    logger.info('[JOBS] Calling STAVAGENT SmartParser...');
    const parsedDocument = await parseDocumentWithStavagent(filePath);

    logger.info('[JOBS] Document parsed successfully');

    // Extract project context (building_type, storeys, main_system, etc.)
    logger.info('[JOBS] Extracting project context...');
    const projectContext = await extractProjectContext(filePath);

    logger.info(`[JOBS] Context extracted: ${JSON.stringify(projectContext)}`);

    // Run Document Q&A Flow to fill gaps
    logger.info('[JOBS] Running Document Q&A Flow...');
    const { runQAFlow } = await import('../../services/documentQAService.js');

    parsedDocument.filename = req.file.originalname; // Add filename for source tracking
    const qaResults = await runQAFlow(parsedDocument, projectContext);

    logger.info(`[JOBS] Q&A Flow completed: ${qaResults.answered_count} answered, ${qaResults.unanswered_count} need input`);

    // Validate document completeness
    logger.info('[JOBS] Validating document completeness...');
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
      logger.debug('[JOBS] Document parsing cached for future use');
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
      'UPDATE jobs SET status = ? WHERE id = ?',
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

/**
 * Document Upload Endpoint - Phase 2
 * POST /api/jobs/document-upload
 *
 * Handles multi-file document uploads with completeness validation
 * Returns document validation results and RFI (Request For Information)
 */
router.post('/document-upload', documentUpload.array('files', 10), async (req, res) => {
  let uploadedFiles = [];

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const jobId = req.body.jobId || uuidv4();
    const userId = req.user?.id || 'default';
    let projectContext = {};

    // Parse project context if provided as JSON
    if (req.body.project_context) {
      try {
        projectContext = typeof req.body.project_context === 'string'
          ? JSON.parse(req.body.project_context)
          : req.body.project_context;
      } catch (e) {
        logger.warn(`[JOBS] Invalid project_context JSON: ${e.message}`);
      }
    }

    logger.info(`[DOCUMENT-UPLOAD] Started: ${jobId} with ${req.files.length} files`);

    // Validate each uploaded file
    for (const file of req.files) {
      try {
        // SECURITY: Validate file path
        let filePath = validateUploadPath(file.path);

        // SECURITY: Validate file content matches extension
        const fileValidation = await validateFileContent(filePath, file.originalname);
        if (!fileValidation.valid) {
          logger.warn(`[DOCUMENT-UPLOAD] File validation failed: ${file.originalname}`);
          // Clean up invalid file
          try {
            fs.unlinkSync(filePath);
          } catch (e) {
            // Ignore cleanup errors
          }
          continue;
        }

        uploadedFiles.push({
          filename: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          path: filePath,
          file_type: fileValidation.fileType
        });

        // Log successful file upload
        const fileOpLog = createFileOperationLog({
          userId: userId,
          jobId: jobId,
          operation: 'upload',
          filename: file.originalname,
          fileSize: file.size,
          fileType: fileValidation.fileType,
          status: 'success'
        });
        logger.info(JSON.stringify(fileOpLog));

      } catch (error) {
        logger.error(`[DOCUMENT-UPLOAD] File processing error: ${file.originalname} - ${error.message}`);
        // Continue processing other files
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(400).json({
        error: 'No valid files could be processed',
        details: 'All uploaded files failed validation'
      });
    }

    logger.info(`[DOCUMENT-UPLOAD] Validated ${uploadedFiles.length} files`);

    // Validate document completeness
    const documentValidation = await validateDocumentCompleteness(
      uploadedFiles,
      projectContext
    );

    logger.info(`[DOCUMENT-UPLOAD] Completeness: ${documentValidation.completeness_score}%`);

    // AUDIT: Log document upload event
    logAuditEvent(
      {
        userId: userId,
        jobId: jobId,
        action: 'document_upload',
        resource: 'documents',
        status: 'success',
        ipAddress: req.ip,
        details: {
          files_uploaded: uploadedFiles.length,
          completeness_score: documentValidation.completeness_score,
          severity: documentValidation.severity
        }
      },
      logger,
      'info'
    );

    // Return comprehensive validation results
    return res.status(200).json({
      job_id: jobId,
      status: 'completed',
      files_uploaded: uploadedFiles.length,
      uploaded_files: uploadedFiles.map(f => ({
        name: f.filename,
        size: f.size,
        type: f.file_type
      })),
      document_validation: {
        completeness_score: documentValidation.completeness_score,
        severity: documentValidation.severity,
        uploaded_documents: documentValidation.uploaded_documents,
        missing_documents: documentValidation.missing_documents,
        context_validation: documentValidation.context_validation,
        rfi_items: documentValidation.rfi_items,
        recommendations: documentValidation.recommendations
      },
      next_steps: documentValidation.completeness_score >= 80
        ? 'Ready for block-match analysis'
        : 'Complete missing documents to improve analysis quality'
    });

  } catch (error) {
    logger.error(`[DOCUMENT-UPLOAD] Error: ${error.message}`);

    // Clean up any uploaded files on error
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        try {
          fs.unlinkSync(file.path);
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    }

    res.status(500).json({
      error: 'Document upload failed',
      details: error.message
    });
  }
});

/**
 * Document Work Extraction Endpoint
 * POST /api/jobs/document-extract
 *
 * Extracts work descriptions from PDF/DOCX document and matches to URS codes
 * Pipeline: MinerU → LLM → TSKP → Deduplication → Batch URS Matching
 */
router.post('/document-extract', uploadDocument.single('file'), async (req, res) => {
  let filePath;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const jobId = uuidv4();
    const userId = req.user?.id || 'default';

    // SECURITY: Validate file path
    filePath = validateUploadPath(req.file.path);

    // SECURITY: Validate file content matches extension
    const fileValidation = await validateFileContent(filePath, req.file.originalname);
    if (!fileValidation.valid) {
      logger.warn(`[DOC-EXTRACT] File validation failed: ${req.file.originalname}`);

      // Clean up invalid file
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        // Ignore cleanup errors
      }

      return res.status(400).json({
        error: 'File validation failed',
        details: 'File content does not match extension or is invalid'
      });
    }

    logger.info(`[DOC-EXTRACT] Started: ${jobId} with file: ${req.file.originalname}`);

    // Log file upload
    const fileOpLog = createFileOperationLog({
      userId: userId,
      jobId: jobId,
      operation: 'document_extract_upload',
      filename: req.file.originalname,
      fileSize: req.file.size,
      fileType: fileValidation.fileType,
      status: 'success'
    });
    logger.info(JSON.stringify(fileOpLog));

    // Extract works from document
    logger.info(`[DOC-EXTRACT] Starting work extraction...`);
    const extractionResult = await extractWorksFromDocument(filePath);

    logger.info(`[DOC-EXTRACT] ✓ Extracted ${extractionResult.works.length} works in ${extractionResult.sections.length} sections`);

    // Clean up uploaded file
    try {
      fs.unlinkSync(filePath);
      logger.info(`[DOC-EXTRACT] Cleaned up: ${filePath}`);
    } catch (e) {
      logger.warn(`[DOC-EXTRACT] Cleanup failed: ${e.message}`);
    }

    // AUDIT: Log extraction event
    logAuditEvent(
      {
        userId: userId,
        jobId: jobId,
        action: 'document_extract',
        resource: 'works',
        status: 'success',
        ipAddress: req.ip,
        details: {
          filename: req.file.originalname,
          works_extracted: extractionResult.works.length,
          sections: extractionResult.sections.length,
          tskp_matched: extractionResult.stats.tskp_matched
        }
      },
      logger,
      'info'
    );

    // Return extraction results
    return res.status(200).json({
      job_id: jobId,
      status: 'completed',
      filename: req.file.originalname,
      extraction: {
        works: extractionResult.works,
        sections: extractionResult.sections,
        stats: extractionResult.stats,
        metadata: extractionResult.metadata
      },
      next_steps: 'Use extracted works for batch URS matching',
      message: `Successfully extracted ${extractionResult.works.length} works from document`
    });

  } catch (error) {
    logger.error(`[DOC-EXTRACT] Error: ${error.message}`);
    logger.error(error.stack);

    // Clean up file on error
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    res.status(500).json({
      error: 'Document extraction failed',
      details: error.message
    });
  }
});

/**
 * Admin Metrics Endpoint - Phase 4 Optimization
 * GET /api/jobs/admin/metrics
 *
 * Returns system performance metrics and cache statistics
 * Protected endpoint (in production, would require authentication)
 */
router.get('/admin/metrics', async (req, res) => {
  try {
    // Perform cache cleanup before returning stats
    const cleanedCount = cleanExpiredEntries();

    // Get cache statistics
    const cacheStats = getCacheStats();

    // Get performance summary
    const perfSummary = getPerformanceSummary();

    // Get detailed report with bottleneck analysis
    const detailedReport = getDetailedPerformanceReport();

    logger.info(`[ADMIN] Metrics endpoint called - cache cleaned: ${cleanedCount} entries`);

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      cache: {
        stats: cacheStats,
        cleanup: {
          last_run: new Date().toISOString(),
          entries_cleaned: cleanedCount
        }
      },
      performance: {
        summary: perfSummary,
        detailed_report: detailedReport
      },
      health: {
        cache_utilization: `${((cacheStats.valid_entries / cacheStats.max_entries) * 100).toFixed(2)}%`,
        slow_requests_percentage: perfSummary.slow_requests > 0
          ? ((perfSummary.slow_requests / perfSummary.requests.total) * 100).toFixed(2) + '%'
          : '0%',
        system_status: cacheStats.valid_entries > 0 && perfSummary.requests.total > 0 ? 'healthy' : 'initializing'
      }
    });

  } catch (error) {
    logger.error(`[ADMIN] Metrics endpoint error: ${error.message}`);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      details: error.message
    });
  }
});

/**
 * Admin Cache Control Endpoint - Phase 4 Optimization
 * POST /api/jobs/admin/cache/cleanup
 *
 * Manually trigger cache cleanup
 */
router.post('/admin/cache/cleanup', async (req, res) => {
  try {
    const cleanedCount = cleanExpiredEntries();

    logger.info(`[ADMIN] Manual cache cleanup triggered - removed ${cleanedCount} entries`);

    return res.status(200).json({
      success: true,
      message: 'Cache cleanup completed',
      entries_cleaned: cleanedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[ADMIN] Cache cleanup error: ${error.message}`);
    res.status(500).json({
      error: 'Cache cleanup failed',
      details: error.message
    });
  }
});

/**
 * Admin Endpoint Metrics - Phase 4 Optimization
 * GET /api/jobs/admin/metrics/endpoint/:endpoint
 *
 * Get performance metrics for a specific endpoint
 */
router.get('/admin/metrics/endpoint/:endpoint', async (req, res) => {
  try {
    const endpoint = req.params.endpoint;
    const metrics = getEndpointMetrics(`/${endpoint}`);

    logger.info(`[ADMIN] Endpoint metrics requested: ${endpoint}`);

    return res.status(200).json({
      endpoint: endpoint,
      metrics: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[ADMIN] Endpoint metrics error: ${error.message}`);
    res.status(500).json({
      error: 'Failed to retrieve endpoint metrics',
      details: error.message
    });
  }
});

/**
 * Admin Role Metrics - Phase 4 Optimization
 * GET /api/jobs/admin/metrics/role/:role
 *
 * Get performance metrics for a specific specialist role
 */
router.get('/admin/metrics/role/:role', async (req, res) => {
  try {
    const role = req.params.role;
    const metrics = getRoleMetrics(role);

    logger.info(`[ADMIN] Role metrics requested: ${role}`);

    return res.status(200).json({
      role: role,
      metrics: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`[ADMIN] Role metrics error: ${error.message}`);
    res.status(500).json({
      error: 'Failed to retrieve role metrics',
      details: error.message
    });
  }
});

// ============================================================================
// POST /api/jobs/block-match-fast (NEW OPTIMIZED ENDPOINT)
// ============================================================================
// Optimized block matching WITHOUT Multi-Role orchestrator
// Uses: Gemini classification → Local DB search → Perplexity selection (queue-based)
// ============================================================================

router.post('/block-match-fast', upload.single('file'), async (req, res) => {
  let filePath = null;
  const jobStartTime = Date.now();

  try {
    // 1️⃣ VALIDATE INPUT
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    filePath = req.file.path;
    const jobId = uuidv4();
    const logPrefix = `[BLOCK-MATCH-FAST]`;

    logger.info(`${logPrefix} Job ${jobId} started`);

    // Parse project context
    let projectContext = {
      building_type: 'neurčeno',
      storeys: 0,
      main_system: [],
      notes: []
    };

    if (req.body.project_context) {
      try {
        projectContext = typeof req.body.project_context === 'string'
          ? JSON.parse(req.body.project_context)
          : req.body.project_context;
      } catch (e) {
        logger.warn(`${logPrefix} Invalid project context, using defaults`);
      }
    }

    // 2️⃣ PARSE FILE
    const parseStartTime = Date.now();
    const rows = await parseExcelFile(filePath);
    const parseDuration = Date.now() - parseStartTime;

    logger.info(`${logPrefix} Parsed ${rows.length} rows in ${parseDuration}ms`);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No data rows found in file' });
    }

    // Save job to database
    const db = await getDatabase();
    await db.run(
      `INSERT INTO jobs (id, filename, status, total_rows, project_context, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [jobId, req.file.originalname, 'processing', rows.length, JSON.stringify(projectContext)]
    );

    // 3️⃣ CLASSIFY BOQ WITH GEMINI (20s timeout, with fallback)
    const classifyStartTime = Date.now();
    logger.info(`${logPrefix} Classifying rows with Gemini...`);

    const { classifyBoqWithGemini } = await import('../../services/geminiBlockClassifier.js');
    const classificationResult = await classifyBoqWithGemini(rows, projectContext);
    const classifyDuration = Date.now() - classifyStartTime;

    logger.info(`${logPrefix} Classification done: ${classificationResult.blocks.length} blocks in ${classifyDuration}ms (source: ${classificationResult.stats.source})`);

    // 4️⃣ PROCESS EACH BLOCK
    const blockResults = [];
    const perplexityQueue = [];

    for (const block of classificationResult.blocks) {
      logger.info(`${logPrefix} Processing block: ${block.block_name} (${block.rows.length} rows)`);

      const blockStartTime = Date.now();
      const blockAnalysis = {
        block_name: block.block_name,
        block_id: block.block_name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase(),
        rows_count: block.rows.length,
        tridnik_prefix: block.tridnik_prefix,
        items: []
      };

      // Process each row in block
      for (const row of block.rows) {
        try {
          const { matchRowToUrs, saveToCache } = await import('../../services/ursLocalMatcher.js');

          // Try local matching FIRST (fast path)
          const localResult = await matchRowToUrs(row.normalized_text_cs, projectContext);

          if (localResult.candidates.length > 0) {
            const bestCandidate = localResult.candidates[0];

            // Check if we need Perplexity help
            if (localResult.needs_perplexity) {
              logger.debug(`${logPrefix} Low confidence (${bestCandidate.confidence}) - queuing for Perplexity`);

              // Queue for Perplexity selection
              perplexityQueue.push({
                row_id: row.original_index,
                normalized_text_cs: row.normalized_text_cs,
                candidates: localResult.candidates,
                projectContext: projectContext,
                callback: (selectedResult) => {
                  // Save result to block after Perplexity processing
                  blockAnalysis.items.push({
                    row_id: row.original_index,
                    input_text: row.normalized_text_cs,
                    urs_code: selectedResult.urs_code,
                    urs_name: selectedResult.urs_name,
                    unit: selectedResult.unit,
                    quantity: row.quantity,
                    confidence: selectedResult.confidence,
                    source: selectedResult.source,
                    explanation_cs: selectedResult.explanation_cs,
                    related_items: selectedResult.related_items || []
                  });
                }
              });
            } else {
              // High confidence - save directly
              logger.debug(`${logPrefix} High confidence (${bestCandidate.confidence}) - using local match`);

              // Save to cache
              await saveToCache(row.normalized_text_cs, bestCandidate.urs_code, bestCandidate.urs_name, bestCandidate.unit, projectContext, bestCandidate.confidence);

              blockAnalysis.items.push({
                row_id: row.original_index,
                input_text: row.normalized_text_cs,
                urs_code: bestCandidate.urs_code,
                urs_name: bestCandidate.urs_name,
                unit: bestCandidate.unit,
                quantity: row.quantity,
                confidence: bestCandidate.confidence,
                source: 'local_match',
                explanation_cs: 'Vysoká shoda v lokální databázi',
                related_items: []
              });
            }
          } else {
            logger.warn(`${logPrefix} No local candidates found for: "${row.normalized_text_cs.substring(0, 30)}..."`);

            blockAnalysis.items.push({
              row_id: row.original_index,
              input_text: row.normalized_text_cs,
              urs_code: null,
              urs_name: 'Nenalezeno',
              unit: row.unit,
              quantity: row.quantity,
              confidence: 0,
              source: 'not_found',
              explanation_cs: 'Práce se nepodařilo identifikovat',
              related_items: []
            });
          }

        } catch (rowError) {
          logger.warn(`${logPrefix} Error processing row ${row.original_index}: ${rowError.message}`);

          blockAnalysis.items.push({
            row_id: row.original_index,
            input_text: row.normalized_text_cs,
            urs_code: null,
            urs_name: 'Chyba',
            unit: row.unit,
            quantity: row.quantity,
            confidence: 0,
            source: 'error',
            explanation_cs: rowError.message,
            related_items: []
          });
        }
      }

      blockResults.push(blockAnalysis);
      const blockDuration = Date.now() - blockStartTime;
      logger.info(`${logPrefix} Block "${block.block_name}" done in ${blockDuration}ms`);
    }

    // 5️⃣ PROCESS PERPLEXITY QUEUE (SEQUENTIAL!)
    if (perplexityQueue.length > 0) {
      logger.info(`${logPrefix} Processing Perplexity queue: ${perplexityQueue.length} items (sequential)`);

      const { selectBestCandidate } = await import('../../services/perplexityClient.js');

      for (let i = 0; i < perplexityQueue.length; i++) {
        const queueItem = perplexityQueue[i];
        const queueItemStart = Date.now();

        try {
          logger.debug(`${logPrefix} Perplexity queue [${i + 1}/${perplexityQueue.length}]: Processing row ${queueItem.row_id}`);

          const selectedResult = await selectBestCandidate(queueItem.normalized_text_cs, queueItem.candidates, queueItem.projectContext);

          if (selectedResult) {
            // Save to cache
            const { saveToCache } = await import('../../services/ursLocalMatcher.js');
            await saveToCache(queueItem.normalized_text_cs, selectedResult.urs_code, selectedResult.urs_name, selectedResult.unit, queueItem.projectContext, selectedResult.confidence);

            // Call the callback to save result
            queueItem.callback(selectedResult);

            logger.debug(`${logPrefix} Perplexity selected: ${selectedResult.urs_code} (${selectedResult.confidence})`);
          } else {
            logger.warn(`${logPrefix} Perplexity returned null for row ${queueItem.row_id}`);
          }

        } catch (perplexityError) {
          logger.error(`${logPrefix} Perplexity error for row ${queueItem.row_id}: ${perplexityError.message}`);
        }

        const queueItemDuration = Date.now() - queueItemStart;
        logger.debug(`${logPrefix} Perplexity queue item completed in ${queueItemDuration}ms`);

        // Small delay between Perplexity requests (rate limiting)
        if (i < perplexityQueue.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      logger.info(`${logPrefix} Perplexity queue processing complete`);
    }

    // 6️⃣ SAVE RESULTS & UPDATE JOB
    const resultsForDB = {
      filename: req.file.originalname,
      project_context: projectContext,
      blocks: blockResults,
      stats: {
        total_rows: rows.length,
        total_blocks: blockResults.length,
        items_matched: blockResults.reduce((sum, b) => sum + b.items.length, 0),
        perplexity_queue_processed: perplexityQueue.length,
        execution_time_ms: Date.now() - jobStartTime
      }
    };

    // Update job in database
    await db.run(
      'UPDATE jobs SET status = ?, processed_rows = ?, results_json = ? WHERE id = ?',
      ['completed', rows.length, JSON.stringify(resultsForDB), jobId]
    );

    const totalDuration = Date.now() - jobStartTime;
    logger.info(`${logPrefix} Job ${jobId} COMPLETE in ${totalDuration}ms`);

    // 7️⃣ RETURN RESPONSE
    res.status(201).json({
      job_id: jobId,
      status: 'completed',
      filename: req.file.originalname,
      total_rows: rows.length,
      blocks_count: blockResults.length,
      blocks: blockResults,
      project_context: projectContext,
      stats: {
        classification_time_ms: classifyDuration,
        total_execution_time_ms: totalDuration,
        perplexity_items: perplexityQueue.length,
        classification_source: classificationResult.stats.source
      },
      message: 'Block matching completed (optimized pipeline without Multi-Role)'
    });

  } catch (error) {
    logger.error(`[BLOCK-MATCH-FAST] Error: ${error.message}`);
    logger.error(error.stack);

    // Clean up
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    res.status(500).json({
      error: error.message,
      details: 'Block-match-fast processing failed'
    });
  }
});

export default router;
