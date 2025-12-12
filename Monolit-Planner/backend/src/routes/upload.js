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
import { parseXLSX, parseAllSheets, parseNumber, extractProjectsFromCOREResponse, extractFileMetadata, detectObjectTypeFromDescription, normalizeString } from '../services/parser.js';
import { extractConcretePositions, convertRawRowsToPositions, extractConcreteOnlyM3 } from '../services/concreteExtractor.js';
import { parseExcelByCORE, convertCOREToMonolitPosition, filterPositionsForBridge, validatePositions, enrichPosition } from '../services/coreAPI.js';
import { importCache, cacheStatsMiddleware } from '../services/importCache.js';
import DataPreprocessor from '../services/dataPreprocessor.js';
import { logger } from '../utils/logger.js';
import { BRIDGE_TEMPLATE_POSITIONS } from '../constants/bridgeTemplates.js';
import { POSITION_DEFAULTS } from '../utils/positionDefaults.js';
import db from '../db/init.js';

const router = express.Router();

// NO AUTH REQUIRED - This is a public kiosk application
// Authentication is handled at the portal level (stavagent-portal)
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

// POST upload XLSX - Multi-Sheet Bridge Import
// Each Excel sheet = one bridge (MOST)
// Extracts only concrete items (m3) from each sheet
router.post('/', upload.single('file'), async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    filePath = req.file.path;
    const import_id = uuidv4();

    logger.info(`[Upload] Processing upload: ${req.file.originalname} (${import_id})`);

    // 🔍 CHECK CACHE
    const cachedResult = importCache.get(filePath);
    if (cachedResult) {
      logger.info(`[Upload] 💾 Using cached result`);
      res.set('X-Cache-Hit', 'true');
      res.json(cachedResult);
      return;
    }

    // ============================================================================
    // NEW: Multi-Sheet Bridge Import
    // Each sheet = one bridge, extract only concrete (m3) items
    // ============================================================================

    logger.info(`[Upload] 🏗️ Starting MULTI-SHEET bridge import...`);

    // Parse ALL sheets from Excel file
    let sheets = await parseAllSheets(filePath);

    if (!sheets || sheets.length === 0) {
      // Fallback to single-sheet parsing if no bridge sheets found
      logger.warn(`[Upload] No bridge sheets found, falling back to single-sheet parsing`);
      const parseResult = await parseXLSX(filePath);
      sheets = [{
        sheetName: 'Default',
        bridgeId: 'SO_' + Date.now(),
        bridgeName: req.file.originalname.replace(/\.(xlsx|xls)$/i, ''),
        rawRows: parseResult.raw_rows,
        rowCount: parseResult.raw_rows.length
      }];
    }

    logger.info(`[Upload] Found ${sheets.length} bridge sheets to process`);

    // Extract file metadata from first sheet
    const fileMetadata = extractFileMetadata(sheets[0]?.rawRows || []);
    logger.info(`[Upload] File metadata: Stavba="${fileMetadata.stavba}"`);

    // Create stavba (project container) if metadata exists
    let stavbaProjectId = null;
    if (fileMetadata.stavba) {
      stavbaProjectId = normalizeString(fileMetadata.stavba);

      try {
        const existing = await db.prepare(
          'SELECT project_id FROM monolith_projects WHERE project_id = ?'
        ).get(stavbaProjectId);

        if (!existing) {
          await db.prepare(`
            INSERT INTO monolith_projects
            (project_id, project_name, description, owner_id)
            VALUES (?, ?, ?, ?)
          `).run(stavbaProjectId, fileMetadata.stavba, fileMetadata.stavba, 1);

          // Create bridge entry for FK compatibility
          await db.prepare(`
            INSERT INTO bridges (bridge_id, object_name)
            VALUES (?, ?)
            ON CONFLICT (bridge_id) DO NOTHING
          `).run(stavbaProjectId, fileMetadata.stavba);

          logger.info(`[Upload] Created stavba project: ${stavbaProjectId}`);
        }
      } catch (err) {
        logger.warn(`[Upload] Could not create stavba: ${err.message}`);
      }
    }

    // Process each sheet (each sheet = one bridge)
    const createdBridges = [];

    for (const sheet of sheets) {
      try {
        const bridgeId = sheet.bridgeId;
        const bridgeName = sheet.bridgeName;

        logger.info(`[Upload] Processing sheet: ${sheet.sheetName} → Bridge: ${bridgeId}`);

        // Extract ONLY concrete items (m3) from this sheet
        const concretePositions = extractConcreteOnlyM3(sheet.rawRows);

        // Calculate total concrete volume
        const totalConcreteM3 = concretePositions.reduce((sum, p) => sum + (p.qty || 0), 0);

        logger.info(`[Upload] Sheet "${sheet.sheetName}": ${concretePositions.length} concrete items, ${totalConcreteM3.toFixed(2)} m³`);

        // Skip sheets with no concrete
        if (concretePositions.length === 0) {
          logger.info(`[Upload] Skipping sheet "${sheet.sheetName}" - no concrete items found`);
          continue;
        }

        // Check if bridge already exists (await for PostgreSQL compatibility)
        const existingBridge = await db.prepare(
          'SELECT bridge_id FROM bridges WHERE bridge_id = ?'
        ).get(bridgeId);

        if (!existingBridge) {
          // Create bridge record
          await db.prepare(`
            INSERT INTO bridges (bridge_id, object_name, concrete_m3)
            VALUES (?, ?, ?)
          `).run(bridgeId, bridgeName, totalConcreteM3);

          // Create monolith_projects record
          await db.prepare(`
            INSERT INTO monolith_projects
            (project_id, object_name, description, concrete_m3, owner_id)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (project_id) DO UPDATE SET concrete_m3 = excluded.concrete_m3
          `).run(bridgeId, bridgeName, `Imported from: ${sheet.sheetName}`, totalConcreteM3, 1);

          logger.info(`[Upload] ✅ Created bridge: ${bridgeId} "${bridgeName}" (${totalConcreteM3.toFixed(2)} m³)`);
        } else {
          // Update existing bridge concrete volume
          await db.prepare(`
            UPDATE bridges SET concrete_m3 = ? WHERE bridge_id = ?
          `).run(totalConcreteM3, bridgeId);

          logger.info(`[Upload] Updated existing bridge: ${bridgeId} (${totalConcreteM3.toFixed(2)} m³)`);
        }

        // Insert concrete positions using batch insert
        // Handle both SQLite (sync) and PostgreSQL (async) transaction modes
        if (concretePositions.length > 0) {
          if (db.isPostgres) {
            // PostgreSQL: Use pool directly for explicit transaction control
            // (db.transaction wrapper passes client as first arg which breaks SQLite-style callbacks)
            const pool = db.getPool();
            const client = await pool.connect();
            try {
              await client.query('BEGIN');

              // Delete existing positions
              await client.query('DELETE FROM positions WHERE bridge_id = $1', [bridgeId]);

              // Insert new positions
              for (const pos of concretePositions) {
                const id = `${bridgeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                await client.query(`
                  INSERT INTO positions (
                    id, bridge_id, part_name, item_name, subtype, unit,
                    qty, crew_size, wage_czk_ph, shift_hours, days
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                  id, bridgeId,
                  pos.part_name || 'Beton',
                  pos.item_name || 'Betonová směs',
                  pos.subtype || 'beton',
                  pos.unit || 'M3',
                  pos.qty || 0,
                  pos.crew_size || POSITION_DEFAULTS.crew_size,
                  pos.wage_czk_ph || POSITION_DEFAULTS.wage_czk_ph,
                  pos.shift_hours || POSITION_DEFAULTS.shift_hours,
                  pos.days || POSITION_DEFAULTS.days
                ]);
              }

              await client.query('COMMIT');
            } catch (err) {
              await client.query('ROLLBACK');
              throw err;
            } finally {
              client.release();
            }
          } else {
            // SQLite: Use synchronous transaction
            const insertMany = db.transaction((positions) => {
              db.prepare('DELETE FROM positions WHERE bridge_id = ?').run(bridgeId);

              const stmt = db.prepare(`
                INSERT INTO positions (
                  id, bridge_id, part_name, item_name, subtype, unit,
                  qty, crew_size, wage_czk_ph, shift_hours, days
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);

              for (const pos of positions) {
                const id = `${bridgeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                stmt.run(
                  id, bridgeId,
                  pos.part_name || 'Beton',
                  pos.item_name || 'Betonová směs',
                  pos.subtype || 'beton',
                  pos.unit || 'M3',
                  pos.qty || 0,
                  pos.crew_size || POSITION_DEFAULTS.crew_size,
                  pos.wage_czk_ph || POSITION_DEFAULTS.wage_czk_ph,
                  pos.shift_hours || POSITION_DEFAULTS.shift_hours,
                  pos.days || POSITION_DEFAULTS.days
                );
              }
            });

            insertMany(concretePositions);
          }

          logger.info(`[Upload] 🚀 Inserted ${concretePositions.length} concrete positions for ${bridgeId}`);
        }

        createdBridges.push({
          bridge_id: bridgeId,
          object_name: bridgeName,
          sheet_name: sheet.sheetName,
          concrete_m3: totalConcreteM3,
          positions_count: concretePositions.length,
          positions_source: 'sheet_concrete_extractor'
        });

      } catch (sheetError) {
        logger.error(`[Upload] Error processing sheet ${sheet.sheetName}: ${sheetError.message}`);
      }
    }

    // Count totals
    const totalPositions = createdBridges.reduce((sum, b) => sum + (b.positions_count || 0), 0);
    const totalConcrete = createdBridges.reduce((sum, b) => sum + (b.concrete_m3 || 0), 0);

    // Prepare response
    const responseData = {
      import_id,
      filename: req.file.originalname,
      stavba: fileMetadata.stavba || null,
      bridges: createdBridges,
      createdProjects: createdBridges.length,
      stavbaProject: stavbaProjectId || null,
      status: 'success',
      message: `Created ${createdBridges.length} bridges with ${totalPositions} concrete positions (${totalConcrete.toFixed(2)} m³ total)`,
      total_concrete_m3: totalConcrete
    };

    // Cache result
    importCache.set(filePath, responseData, 'MULTI_SHEET');
    logger.info(`[Upload] ✅ Multi-sheet import complete: ${createdBridges.length} bridges, ${totalPositions} positions`);

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.json(responseData);

  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logger.info(`Cleaned up uploaded file: ${filePath}`);
      } catch (cleanupError) {
        logger.warn(`Failed to clean up file: ${cleanupError.message}`);
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
