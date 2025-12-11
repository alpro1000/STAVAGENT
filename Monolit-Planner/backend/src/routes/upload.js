/**
 * Upload routes
 * POST /api/upload - Upload XLSX file with intelligent Excel import pipeline
 *
 * ============================================================================
 * EXCEL IMPORT PIPELINE ARCHITECTURE
 * ============================================================================
 *
 * Goal: Import XLSX files with intelligent material classification and fallback
 *       strategy, with CORE API as primary parser.
 *
 * PRIORITY ORDER (what gets used for position creation):
 *
 * 1. CORE PARSER (PRIMARY - AI-powered, intelligent material_type classification)
 *    - Sends preprocessed Excel rows to concrete-agent/CORE
 *    - CORE performs:
 *      * Czech text normalization
 *      * Intelligent material_type detection (e.g., "C30/37" → concrete grade)
 *      * Position extraction and classification
 *      * Project identification via extractProjectsFromCOREResponse()
 *    - Use case: Complex Excel files, mixed material types, Czech text
 *    - Advantage: Handles nuances that local parser can't (grades, standards)
 *    - Status code: sourceOfProjects = 'core_intelligent_classification'
 *
 * 2. LOCAL FALLBACK (FALLBACK - regex-based, simple heuristics)
 *    - Triggers when:
 *      * CORE fails (API error, timeout)
 *      * CORE returns empty response
 *      * CORE identifies positions but NO concrete (material_type != "concrete")
 *    - Uses:
 *      * concreteExtractor.extractConcretePositions() - regex C\d{2}/\d{2} pattern
 *      * Simple CSV/Excel parsing without AI
 *    - Status code: sourceOfProjects = 'local_extractor'
 *    - Limitation: Only detects concrete grades via regex, misses subtle variants
 *
 * 3. TEMPLATE POSITIONS (FINAL FALLBACK - predefined structure)
 *    - Triggers when:
 *      * Both CORE and local parser find no positions
 *      * User needs to manually edit a skeleton structure
 *    - Uses:
 *      * BRIDGE_TEMPLATE_POSITIONS constant (11 predefined parts)
 *      * Users then manually add quantities and details
 *    - Status code: positionsSource = 'templates'
 *
 * ============================================================================
 * DECISION LOGIC
 * ============================================================================
 *
 * File Upload
 *     ↓
 * Preprocess & validate
 *     ↓
 * Try CORE API (with error handling)
 *     ↓
 *     ├─ SUCCESS: CORE returned positions
 *     │   ├─ CORE found concrete projects? → Use CORE positions
 *     │   └─ No concrete found? → Try local fallback
 *     │
 *     ├─ FAILURE: CORE error/timeout → Try local fallback
 *     │
 *     └─ Local fallback found positions? → Use local
 *        └─ No? → Use templates + require manual editing
 *
 * ============================================================================
 * LOGGING: Look for these prefixes to debug import flow
 * ============================================================================
 * [Upload] ✨ - CORE parser starting
 * [Upload] ✅ - CORE success
 * [Upload] ⚠️ - CORE issue (not total failure)
 * [Upload] ❌ - CORE total failure → fallback
 * [Upload] 🔄 - Attempting fallback
 * [Upload] 🔧 - Fallback in progress
 * [Upload] 🎯 - Fallback success
 * [Upload] 🚀 - Batch insert success
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { parseXLSX, parseNumber, extractProjectsFromCOREResponse, extractFileMetadata, detectObjectTypeFromDescription, normalizeString } from '../services/parser.js';
import { extractConcretePositions, convertRawRowsToPositions } from '../services/concreteExtractor.js';
import { parseExcelByCORE, convertCOREToMonolitPosition, filterPositionsForBridge, validatePositions, enrichPosition } from '../services/coreAPI.js';
import { importCache, cacheStatsMiddleware } from '../services/importCache.js';
import DataPreprocessor from '../services/dataPreprocessor.js';
import { logger } from '../utils/logger.js';
import { BRIDGE_TEMPLATE_POSITIONS } from '../constants/bridgeTemplates.js';
import { POSITION_DEFAULTS } from '../utils/positionDefaults.js';
import db from '../db/init.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication and cache stats middleware
router.use(requireAuth);
router.use(cacheStatsMiddleware);

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Check file extension
    const allowedExt = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedExt.includes(ext)) {
      return cb(new Error('Pouze .xlsx a .xls soubory jsou povoleny'));
    }

    // Check MIME type
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/x-excel', // Alternative .xls MIME type
      'application/x-msexcel' // Another alternative
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      logger.warn(`Rejected file with invalid MIME type: ${file.mimetype} (${file.originalname})`);
      return cb(new Error(`Neplatný typ souboru: ${file.mimetype}. Očekáváno: Excel soubor (.xlsx nebo .xls)`));
    }

    cb(null, true);
  }
});

// POST upload XLSX
router.post('/', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    filePath = req.file.path;
    const import_id = uuidv4();

    logger.info(`Processing upload: ${req.file.originalname} (${import_id})`);

    // 🔍 CHECK CACHE: Is this file already imported?
    const cachedResult = importCache.get(filePath);
    if (cachedResult) {
      logger.info(`[Upload] 💾 Using cached result from previous import`);
      res.set('X-Cache-Hit', 'true');
      res.json(cachedResult);
      return;
    }

    // Parse XLSX - only need raw_rows for local extractor fallback
    let parseResult = await parseXLSX(filePath);

    // 🧹 PREPROCESS: Clean and normalize data for CORE
    logger.info(`[Upload] Starting data preprocessing pipeline...`);
    const preprocessed = DataPreprocessor.preprocess(parseResult.raw_rows);
    parseResult.raw_rows = preprocessed.rows;  // Use preprocessed rows
    parseResult.columnMapping = preprocessed.columnMapping;  // Store column detection
    parseResult.preprocessStats = preprocessed.stats;

    // Auto-create bridges in database
    const createdBridges = [];

    // Use shared template positions for default parts
    const templatePositions = BRIDGE_TEMPLATE_POSITIONS;

    // 🔍 Extract file metadata (Stavba, Objekt, Сoupis) - project hierarchy context
    const fileMetadata = extractFileMetadata(parseResult.raw_rows);
    logger.info(`[Upload] File metadata: Stavba="${fileMetadata.stavba}", Objekt="${fileMetadata.objekt}", Сoupis="${fileMetadata.soupis}"`);

    // ⭐ CORE-FIRST APPROACH (User requirement: Don't use M3 detection, rely on CORE)
    // Start with EMPTY projects - only CORE's intelligent classification populates this
    let projectsForImport = [];
    let parsedPositionsFromCORE = [];
    let sourceOfProjects = 'none';
    let stavbaProjectId = null;

    // Create project-level record (stavba) if metadata exists
    if (fileMetadata.stavba) {
      const projectId = normalizeString(fileMetadata.stavba);
      stavbaProjectId = projectId;

      try {
        // Check if stavba project already exists
        const existing = await db.prepare(
          'SELECT project_id FROM monolith_projects WHERE project_id = ? AND object_type = ?'
        ).get(projectId, 'project');

        if (!existing) {
          // Create stavba (project container) record using available columns
          await db.prepare(`
            INSERT INTO monolith_projects
            (project_id, object_type, project_name, description, owner_id)
            VALUES (?, ?, ?, ?, ?)
          `).run(projectId, 'project', fileMetadata.stavba, fileMetadata.stavba, req.user?.userId || null);

          logger.info(`[Upload] Created stavba project: ${projectId} ("${fileMetadata.stavba}")`);
        } else {
          logger.info(`[Upload] Stavba project already exists: ${projectId}`);
        }
      } catch (stavbaError) {
        logger.error(`[Upload] Error creating stavba record:`, stavbaError);
      }
    }

    try {
      logger.info(`[Upload] ✨ Attempting CORE parser (PRIMARY) - uses intelligent material_type classification...`);
      const corePositions = await parseExcelByCORE(filePath);

      if (corePositions && corePositions.length > 0) {
        logger.info(`[Upload] CORE parser returned ${corePositions.length} positions`);

        // Extract projects using CORE's intelligent material classification
        // detectObjectTypeFromDescription determines type from text, not SO code
        const coreProjects = extractProjectsFromCOREResponse(corePositions);

        if (coreProjects && coreProjects.length > 0) {
          logger.info(`[Upload] ✅ CORE identified ${coreProjects.length} concrete projects using material_type classification`);
          projectsForImport = coreProjects;
          parsedPositionsFromCORE = corePositions;
          sourceOfProjects = 'core_intelligent_classification';
        } else {
          logger.warn('[Upload] ⚠️ CORE returned positions but identified NO concrete bridges (material_type != "concrete")');
          // Enable fallback: Try local parser if CORE didn't identify concrete
          logger.info('[Upload] 🔄 Attempting fallback: local concrete extractor...');
        }
      } else {
        logger.warn('[Upload] ⚠️ CORE returned empty response (no positions parsed)');
        // Enable fallback: If CORE completely failed, use local parser
        logger.info('[Upload] 🔄 CORE returned no data, attempting fallback: local concrete extractor...');
      }
    } catch (coreError) {
      logger.error(`[Upload] ❌ CORE parser failed: ${coreError.message}`);
      logger.warn('[Upload] 🔄 Attempting fallback: local concrete extractor...');
      // Enable fallback: Try local parser if CORE crashes
    }

    // FALLBACK: Try local parser if CORE didn't identify projects
    if (projectsForImport.length === 0 && parseResult.raw_rows && parseResult.raw_rows.length > 0) {
      logger.info('[Upload] 🔧 FALLBACK: Trying local parser to extract positions...');

      try {
        const localPositions = extractConcretePositions(parseResult.raw_rows, 'SO_AUTO');

        // IMPROVED FALLBACK: Create project if we have ANY data rows
        // Even if parser couldn't extract properly-structured positions
        const hasDataRows = parseResult.raw_rows.some(row =>
          Object.values(row).some(val => val !== null && val !== '' && val !== undefined)
        );

        if (localPositions.length > 0 || hasDataRows) {
          const positionCount = localPositions.length > 0 ? localPositions.length : parseResult.raw_rows.length;
          logger.info(`[Upload] ✅ Local parser found ${positionCount} potential positions/rows`);

          // Create a generic project from local data
          projectsForImport.push({
            project_id: 'SO_' + Date.now(),
            object_name: fileMetadata.stavba || fileMetadata.objekt || ('Bridge_' + Date.now()),
            object_type: 'bridge',
            concrete_m3: localPositions.reduce((sum, p) => sum + (p.concrete_m3 || 0), 0),
            span_length_m: 0,
            deck_width_m: 0,
            pd_weeks: 0
          });

          // If concreteExtractor found nothing, convert raw rows to positions (fallback)
          if (localPositions.length === 0 && hasDataRows) {
            logger.info(`[Upload] 🔄 ConcreteExtractor found 0 positions, converting raw rows...`);
            parsedPositionsFromCORE = convertRawRowsToPositions(parseResult.raw_rows);
          } else {
            parsedPositionsFromCORE = localPositions;
          }

          sourceOfProjects = 'local_extractor';
          logger.info(`[Upload] 🎯 Created project from local parser data (${parsedPositionsFromCORE.length} positions)`);
        }
      } catch (localError) {
        logger.warn(`[Upload] ⚠️ Local parser also failed: ${localError.message}`);
      }
    }

    // FINAL CHECK: If still no projects, return error
    if (projectsForImport.length === 0) {
      logger.warn('[Upload] ⚠️ Import warning: Neither CORE nor local parser identified any concrete projects');
      logger.info('[Upload] Possible reasons:');
      logger.info('  1. No concrete items in the file');
      logger.info('  2. CORE parser is unavailable');
      logger.info('  3. File format not recognized');

      res.set('Content-Type', 'application/json; charset=utf-8');
      res.json({
        success: false,
        error: 'No concrete projects identified',
        import_id: import_id,
        message: 'Neither CORE nor local parser could identify concrete items. Please verify file content.',
        createdProjects: [],
        positionsCreated: 0
      });
      return;
    }

    for (const project of projectsForImport) {
      try {
        // Create object-level record in monolith_projects with hierarchy
        const objectId = project.project_id;

        // Check if object already exists
        const existing = await db.prepare(
          'SELECT project_id FROM monolith_projects WHERE project_id = ?'
        ).get(objectId);

        if (!existing) {
          // Create object record with available columns only
          // Note: stavba and parent_project_id are handled via description field
          await db.prepare(`
            INSERT INTO monolith_projects
            (project_id, object_type, object_name, description, concrete_m3, span_length_m, deck_width_m, pd_weeks, owner_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            objectId,
            project.object_type || 'custom',  // Type detected from description
            project.object_name,
            `Imported from: ${fileMetadata.stavba || 'Excel file'}`,  // Store stavba context in description
            project.concrete_m3 || 0,
            project.span_length_m || 0,
            project.deck_width_m || 0,
            project.pd_weeks || 0,
            req.user?.userId || null
          );

          logger.info(`[Upload] Created object: ${objectId} (type: ${project.object_type}, ${project.concrete_m3} m³)`);
        } else {
          logger.info(`[Upload] Object already exists: ${objectId}`);
        }

        // Also create/update bridges table for backward compatibility
        const bridgeId = objectId;  // Use same ID for now
        const bridgeExisting = await db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridgeId);

        if (!bridgeExisting) {
          // Create bridge record for backward compatibility
          await db.prepare(`
            INSERT INTO bridges (bridge_id, object_name, span_length_m, deck_width_m, pd_weeks, concrete_m3)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            bridgeId,
            project.object_name,
            project.span_length_m || 0,
            project.deck_width_m || 0,
            project.pd_weeks || 0,
            project.concrete_m3 || 0
          );

          logger.info(`[Upload] Created bridge record: ${bridgeId}`);
        }

        // Extract positions with intelligent fallback chain
        let positionsToInsert = [];
        let positionsSource = 'unknown';

        // PRIORITY 1: Use parsed positions from sourceOfProjects
        if (sourceOfProjects === 'core_intelligent_classification' && parsedPositionsFromCORE.length > 0) {
          logger.info(`[Upload] Using CORE positions (${parsedPositionsFromCORE.length} total)`);

          // Filter positions matching this project (only for CORE with multiple projects)
          const projectPositions = parsedPositionsFromCORE.filter(pos => {
            // Match by project_id from CORE metadata or by description similarity
            return pos.bridge_id === bridgeId ||
                   pos.project_id === project.project_id ||
                   (project.object_name && pos.description && pos.description.includes(project.object_name));
          });

          if (projectPositions.length > 0) {
            // Convert CORE format to Monolit format
            positionsToInsert = projectPositions.map(pos =>
              convertCOREToMonolitPosition(pos, bridgeId)
            );
            positionsSource = 'core_intelligent';
            logger.info(`[Upload] Using ${positionsToInsert.length} positions from CORE for ${objectId}`);
          }
        }

        // PRIORITY 1b: If local parser was used as fallback, use positions directly
        if (sourceOfProjects === 'local_extractor' && parsedPositionsFromCORE.length > 0) {
          logger.info(`[Upload] Using local extractor positions (${parsedPositionsFromCORE.length} total)`);
          positionsToInsert = parsedPositionsFromCORE;
          positionsSource = 'local_extractor';
          logger.info(`[Upload] Using ${positionsToInsert.length} positions from local extractor for ${objectId}`);
        }

        // PRIORITY 2: Try local extractor if CORE positions not available
        let extractedPositionsCount = 0;
        if (positionsToInsert.length === 0) {
          const extractedPositions = extractConcretePositions(parseResult.raw_rows, bridgeId);

          if (extractedPositions.length > 0) {
            positionsToInsert = extractedPositions;
            extractedPositionsCount = extractedPositions.length;
            positionsSource = 'local_extractor';
            logger.info(`[Upload] Using ${extractedPositions.length} positions from local extractor for ${objectId}`);
          }
        }

        // PRIORITY 3: Fallback to templates if nothing else worked
        if (positionsToInsert.length === 0) {
          logger.warn(`[Upload] No positions found for ${objectId}, using templates`);
          positionsToInsert = templatePositions;
          positionsSource = 'templates';
        }

        // 🔍 VALIDATE POSITIONS BEFORE INSERTION
        if (positionsToInsert.length > 0) {
          const validationResult = validatePositions(positionsToInsert);
          logger.info(`[Upload] Position validation: ${validationResult.stats.valid}/${validationResult.stats.total} valid (${validationResult.stats.validPercentage}%)`);

          if (validationResult.invalid.length > 0) {
            logger.warn(`[Upload] ⚠️ ${validationResult.invalid.length} positions failed validation, skipping invalid ones`);
            positionsToInsert = validationResult.valid;
          }

          // 💪 ENRICH VALID POSITIONS with calculated fields
          positionsToInsert = positionsToInsert.map(pos => enrichPosition(pos));
          logger.debug(`[Upload] Enriched ${positionsToInsert.length} positions with calculated fields`);
        }

        // Insert all positions using batch insert (MUCH FASTER)
        // Uses POSITION_DEFAULTS utility to ensure consistency across all creation methods
        if (positionsToInsert.length > 0) {
          // Use transaction for batch insert
          const insertMany = db.transaction((client, positions) => {
            const stmt = client.prepare(`
              INSERT INTO positions (
                id, bridge_id, part_name, item_name, subtype, unit,
                qty, crew_size, wage_czk_ph, shift_hours, days, otskp_code
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const pos of positions) {
              const id = `${bridgeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              stmt.run(
                id,
                bridgeId,
                pos.part_name,
                pos.item_name,
                pos.subtype || POSITION_DEFAULTS.subtype,
                pos.unit || POSITION_DEFAULTS.unit,
                pos.qty !== undefined ? pos.qty : POSITION_DEFAULTS.qty,
                pos.crew_size !== undefined ? pos.crew_size : POSITION_DEFAULTS.crew_size,
                pos.wage_czk_ph !== undefined ? pos.wage_czk_ph : POSITION_DEFAULTS.wage_czk_ph,
                pos.shift_hours !== undefined ? pos.shift_hours : POSITION_DEFAULTS.shift_hours,
                pos.days !== undefined ? pos.days : POSITION_DEFAULTS.days,
                pos.otskp_code || POSITION_DEFAULTS.otskp_code
              );
            }
          });

          insertMany(positionsToInsert);
          logger.info(`[Upload] 🚀 Batch inserted ${positionsToInsert.length} positions for ${objectId}`);
        }

        logger.info(
          `[Upload] Created ${positionsToInsert.length} positions for ${objectId} ` +
          `(type: ${project.object_type}, source: ${positionsSource})`
        );

        createdBridges.push({
          bridge_id: bridgeId,
          object_name: project.object_name,
          object_type: project.object_type,
          concrete_m3: project.concrete_m3 || 0,
          positions_created: positionsToInsert.length,
          positions_from_excel: extractedPositionsCount,
          positions_source: positionsSource,
          parent_project: stavbaProjectId || null  // Include hierarchy info
        });
      } catch (error) {
        logger.error(`Error creating project ${project.project_id}:`, error);
      }
    }

    // Count total positions created
    const totalPositions = createdBridges.reduce((sum, b) => sum + (b.positions_created || 0), 0);
    const totalFromExcel = createdBridges.reduce((sum, b) => sum + (b.positions_from_excel || 0), 0);

    // Prepare response object
    const responseData = {
      import_id,
      filename: req.file.originalname,
      stavba: fileMetadata.stavba || null,
      bridges: createdBridges,
      createdProjects: createdBridges.length,
      stavbaProject: stavbaProjectId || null,
      mapping_suggestions: parseResult.mapping_suggestions,
      raw_rows: parseResult.raw_rows,
      row_count: parseResult.raw_rows.length,
      status: 'success',
      message: `Created ${createdBridges.length} objects with ${totalPositions} positions (${totalFromExcel} from Excel, ${totalPositions - totalFromExcel} from templates)` +
               (stavbaProjectId ? ` in project "${fileMetadata.stavba}"` : ''),
      // Add preprocessing stats
      preprocessStats: parseResult.preprocessStats,
      columnMapping: parseResult.columnMapping
    };

    // 💾 CACHE the result for future identical uploads
    const sourceOfProjectsSource = sourceOfProjects === 'core_intelligent_classification' ? 'CORE' :
                                    sourceOfProjects === 'local_extractor' ? 'LOCAL' : 'TEMPLATE';
    importCache.set(filePath, responseData, sourceOfProjectsSource);
    logger.info(`[Upload] ✅ Import successful and cached (source: ${sourceOfProjectsSource})`);

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.json(responseData);
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    // Clean up uploaded file after processing (success or failure)
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logger.info(`Cleaned up uploaded file: ${filePath}`);
      } catch (cleanupError) {
        logger.warn(`Failed to clean up file ${filePath}:`, cleanupError.message);
      }
    }
  }
});

// GET /api/upload/cache/stats - Get cache statistics
router.get('/cache/stats', (req, res) => {
  const stats = importCache.getStats();
  res.json({
    status: 'success',
    cache: stats,
    message: `Cache contains ${stats.size} entries (max ${stats.maxSize})`
  });
});

// DELETE /api/upload/cache/clear - Clear all cache
router.delete('/cache/clear', (req, res) => {
  const sizeBefore = importCache.getStats().size;
  importCache.clearAll();
  logger.info(`[Cache] Cleared cache - was ${sizeBefore} entries`);

  res.json({
    status: 'success',
    message: `Cache cleared (was ${sizeBefore} entries)`,
    cache: importCache.getStats()
  });
});

// POST /api/upload/cache/clear/:fileHash - Clear specific cache entry
router.delete('/cache/clear/:fileHash', (req, res) => {
  importCache.clear(req.params.fileHash);

  res.json({
    status: 'success',
    message: `Cache entry ${req.params.fileHash} cleared`,
    cache: importCache.getStats()
  });
});

// ============================================================================
// DIAGNOSTIC ENDPOINT - Debug CORE API configuration and connectivity
// ============================================================================
// GET /api/upload/diagnostics - Show CORE configuration and test connectivity
router.get('/diagnostics', async (req, res) => {
  try {
    const CORE_API_URL = process.env.CORE_API_URL || 'https://concrete-agent.onrender.com';
    const CORE_TIMEOUT = parseInt(process.env.CORE_TIMEOUT) || 30000;
    const CORE_ENABLED = process.env.ENABLE_CORE_FALLBACK !== 'false';

    logger.info('[DIAGNOSTICS] Starting CORE configuration diagnostics...');

    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        CORE_API_URL: CORE_API_URL,
        CORE_TIMEOUT: CORE_TIMEOUT,
        CORE_ENABLED: CORE_ENABLED,
        NODE_ENV: process.env.NODE_ENV,
      },
      checks: {
        connectivity: {
          status: 'pending',
          message: 'Testing CORE health endpoint...',
          endpoint: `${CORE_API_URL}/health`,
          response: null,
          error: null
        },
        api_root: {
          status: 'pending',
          message: 'Testing CORE root endpoint...',
          endpoint: `${CORE_API_URL}/`,
          response: null,
          error: null
        }
      }
    };

    // Test health endpoint
    try {
      logger.info(`[DIAGNOSTICS] Testing CORE health endpoint: ${CORE_API_URL}/health`);
      const healthResponse = await axios.get(`${CORE_API_URL}/health`, {
        timeout: 5000
      });
      diagnostics.checks.connectivity = {
        status: 'success',
        message: 'CORE health endpoint is reachable',
        endpoint: `${CORE_API_URL}/health`,
        response: {
          status: healthResponse.status,
          statusText: healthResponse.statusText,
          data: healthResponse.data
        },
        error: null
      };
      logger.info('[DIAGNOSTICS] ✅ Health check passed');
    } catch (healthError) {
      diagnostics.checks.connectivity = {
        status: 'error',
        message: `Health endpoint failed: ${healthError.message}`,
        endpoint: `${CORE_API_URL}/health`,
        response: healthError.response ? {
          status: healthError.response.status,
          statusText: healthError.response.statusText
        } : null,
        error: {
          message: healthError.message,
          code: healthError.code,
          status: healthError.response?.status
        }
      };
      logger.warn(`[DIAGNOSTICS] ⚠️ Health check failed: ${healthError.message}`);
    }

    // Test root endpoint
    try {
      logger.info(`[DIAGNOSTICS] Testing CORE root endpoint: ${CORE_API_URL}/`);
      const rootResponse = await axios.get(`${CORE_API_URL}/`, {
        timeout: 5000
      });
      diagnostics.checks.api_root = {
        status: 'success',
        message: 'CORE root endpoint is reachable',
        endpoint: `${CORE_API_URL}/`,
        response: {
          status: rootResponse.status,
          statusText: rootResponse.statusText,
          data: rootResponse.data
        },
        error: null
      };
      logger.info('[DIAGNOSTICS] ✅ Root endpoint check passed');
    } catch (rootError) {
      diagnostics.checks.api_root = {
        status: 'error',
        message: `Root endpoint failed: ${rootError.message}`,
        endpoint: `${CORE_API_URL}/`,
        response: rootError.response ? {
          status: rootError.response.status,
          statusText: rootError.response.statusText
        } : null,
        error: {
          message: rootError.message,
          code: rootError.code,
          status: rootError.response?.status
        }
      };
      logger.warn(`[DIAGNOSTICS] ⚠️ Root endpoint check failed: ${rootError.message}`);
    }

    // Summary
    const connectivityOk = diagnostics.checks.connectivity.status === 'success';
    const rootOk = diagnostics.checks.api_root.status === 'success';

    diagnostics.summary = {
      core_reachable: connectivityOk || rootOk,
      recommendation: connectivityOk
        ? '✅ CORE service is reachable. If Excel uploads still fail, the issue is likely with the /api/upload endpoint or file format.'
        : rootOk
        ? '⚠️ Root endpoint works but health check failed. Check CORE service status.'
        : `🚨 CORE service at ${CORE_API_URL} is not reachable. Check CORE_API_URL configuration.`
    };

    logger.info('[DIAGNOSTICS] Complete - sending response to client');
    res.json(diagnostics);

  } catch (error) {
    logger.error(`[DIAGNOSTICS] Unexpected error: ${error.message}`);
    res.status(500).json({
      status: 'error',
      message: 'Diagnostics failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
