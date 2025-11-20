/**
 * Upload routes
 * POST /api/upload - Upload XLSX file
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { parseXLSX, parseNumber, extractBridgesFromCOREResponse } from '../services/parser.js';
import { extractConcretePositions } from '../services/concreteExtractor.js';
import { parseExcelByCORE, convertCOREToMonolitPosition, filterPositionsForBridge } from '../services/coreAPI.js';
import { logger } from '../utils/logger.js';
import { BRIDGE_TEMPLATE_POSITIONS } from '../constants/bridgeTemplates.js';
import db from '../db/init.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all upload routes
router.use(requireAuth);

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

    // Parse XLSX - only need raw_rows for local extractor fallback
    const parseResult = await parseXLSX(filePath);

    // Auto-create bridges in database
    const createdBridges = [];

    // Use shared template positions for default parts
    const templatePositions = BRIDGE_TEMPLATE_POSITIONS;

    // ⭐ CORE-FIRST APPROACH (User requirement: Don't use M3 detection, rely on CORE)
    // Start with EMPTY bridges - only CORE's intelligent classification populates this
    let bridgesForImport = [];
    let parsedPositionsFromCORE = [];
    let sourceOfBridges = 'none';

    try {
      logger.info(`[Upload] ✨ Attempting CORE parser (PRIMARY) - uses intelligent material_type classification...`);
      const corePositions = await parseExcelByCORE(filePath);

      if (corePositions && corePositions.length > 0) {
        logger.info(`[Upload] CORE parser returned ${corePositions.length} positions`);

        // Extract bridges using CORE's intelligent material classification
        const coreBridges = extractBridgesFromCOREResponse(corePositions);

        if (coreBridges && coreBridges.length > 0) {
          logger.info(`[Upload] ✅ CORE identified ${coreBridges.length} concrete bridges using material_type classification`);
          bridgesForImport = coreBridges;
          parsedPositionsFromCORE = corePositions;
          sourceOfBridges = 'core_intelligent_classification';
        } else {
          logger.warn('[Upload] ⚠️ CORE returned positions but identified NO concrete bridges (material_type != "concrete")');
          // Don't fall back to unreliable M3 detection!
        }
      } else {
        logger.warn('[Upload] ⚠️ CORE returned empty response (no positions parsed)');
        // Don't fall back to unreliable M3 detection!
      }
    } catch (coreError) {
      logger.error(`[Upload] ❌ CORE parser failed: ${coreError.message}`);
      logger.error('[Upload] Cannot identify concrete bridges without CORE intelligence');
      // Don't fall back to unreliable M3 detection!
    }

    // VALIDATION: Ensure CORE identified concrete bridges
    if (bridgesForImport.length === 0) {
      logger.warn('[Upload] ⚠️ Import warning: CORE did not identify any concrete bridges');
      logger.info('[Upload] Possible reasons:');
      logger.info('  1. No concrete items in the file (material_type != "concrete")');
      logger.info('  2. CORE parser is unavailable');
      logger.info('  3. File format not recognized by CORE');

      // Allow user to see the warning but don't create bridges from unreliable sources
      res.set('Content-Type', 'application/json; charset=utf-8');
      res.json({
        success: false,
        error: 'No concrete bridges identified',
        import_id: import_id,
        message: 'CORE parser did not identify any concrete items in this file. Please verify:' +
                 '\n- File contains concrete items with concrete specifications (C20/25, C30/37, etc.)' +
                 '\n- CORE parser service is available' +
                 '\n- File format is supported',
        createdBridges: [],
        positionsCreated: 0
      });
      return;
    }

    for (const bridge of bridgesForImport) {
      try {
        // Check if bridge already exists (async/await for PostgreSQL)
        const existing = await db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge.bridge_id);

        if (!existing) {
          // Create bridge (async/await)
          await db.prepare(`
            INSERT INTO bridges (bridge_id, object_name, span_length_m, deck_width_m, pd_weeks, concrete_m3, owner_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            bridge.bridge_id,
            bridge.object_name,
            bridge.span_length_m || 0,
            bridge.deck_width_m || 0,
            bridge.pd_weeks || 0,
            bridge.concrete_m3 || 0,
            req.user?.userId || null  // Add owner_id if user is authenticated
          );

          logger.info(`Created bridge: ${bridge.bridge_id}`);
        } else {
          logger.info(`Bridge already exists: ${bridge.bridge_id}`);
        }

        // Extract positions with intelligent fallback chain
        let positionsToInsert = [];
        let positionsSource = 'unknown';

        // PRIORITY 1: If CORE was used for bridge identification, use CORE positions
        if (sourceOfBridges === 'core_intelligent_classification' && parsedPositionsFromCORE.length > 0) {
          logger.info(`[Upload] Using CORE positions (${parsedPositionsFromCORE.length} total)`);

          // Filter positions matching this bridge
          const bridgePositions = parsedPositionsFromCORE.filter(pos => {
            // Match by bridge_id from CORE metadata or by description similarity
            return pos.bridge_id === bridge.bridge_id ||
                   (bridge.object_name && pos.description && pos.description.includes(bridge.object_name));
          });

          if (bridgePositions.length > 0) {
            // Convert CORE format to Monolit format
            positionsToInsert = bridgePositions.map(pos =>
              convertCOREToMonolitPosition(pos, bridge.bridge_id)
            );
            positionsSource = 'core_intelligent';
            logger.info(`[Upload] Using ${positionsToInsert.length} positions from CORE for ${bridge.bridge_id}`);
          }
        }

        // PRIORITY 2: Try local extractor if CORE positions not available
        if (positionsToInsert.length === 0) {
          const extractedPositions = extractConcretePositions(parseResult.raw_rows, bridge.bridge_id);

          if (extractedPositions.length > 0) {
            positionsToInsert = extractedPositions;
            positionsSource = 'local_extractor';
            logger.info(`[Upload] Using ${extractedPositions.length} positions from local extractor for ${bridge.bridge_id}`);
          }
        }

        // PRIORITY 3: Fallback to templates if nothing else worked
        if (positionsToInsert.length === 0) {
          logger.warn(`[Upload] No positions found for ${bridge.bridge_id}, using templates`);
          positionsToInsert = templatePositions;
          positionsSource = 'templates';
        }

        // Insert all positions (async/await)
        for (const pos of positionsToInsert) {
          const id = `${bridge.bridge_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          await db.prepare(`
            INSERT INTO positions (
              id, bridge_id, part_name, item_name, subtype, unit,
              qty, crew_size, wage_czk_ph, shift_hours, days, otskp_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            id,
            bridge.bridge_id,
            pos.part_name,
            pos.item_name,
            pos.subtype,
            pos.unit,
            pos.qty || 0,
            pos.crew_size || 4,
            pos.wage_czk_ph || 398,
            pos.shift_hours || 10,
            pos.days || 0,
            pos.otskp_code || null
          );
        }

        logger.info(
          `Created ${positionsToInsert.length} positions for bridge ${bridge.bridge_id} ` +
          `(source: ${positionsSource}, local_extracted: ${extractedPositions.length})`
        );

        createdBridges.push({
          bridge_id: bridge.bridge_id,
          object_name: bridge.object_name,
          concrete_m3: bridge.concrete_m3 || 0,
          positions_created: positionsToInsert.length,
          positions_from_excel: extractedPositions.length,
          positions_source: positionsSource  // Added: track source
        });
      } catch (error) {
        logger.error(`Error creating bridge ${bridge.bridge_id}:`, error);
      }
    }

    // Count total positions created
    const totalPositions = createdBridges.reduce((sum, b) => sum + (b.positions_created || 0), 0);
    const totalFromExcel = createdBridges.reduce((sum, b) => sum + (b.positions_from_excel || 0), 0);

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.json({
      import_id,
      filename: req.file.originalname,
      bridges: createdBridges,
      mapping_suggestions: parseResult.mapping_suggestions,
      raw_rows: parseResult.raw_rows,
      row_count: parseResult.raw_rows.length,
      status: 'success',
      message: `Created ${createdBridges.length} bridges with ${totalPositions} positions (${totalFromExcel} from Excel, ${totalPositions - totalFromExcel} from templates)`
    });
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

export default router;
