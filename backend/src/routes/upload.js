/**
 * Upload routes
 * POST /api/upload - Upload XLSX file
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { parseXLSX, parseNumber, extractProjectsFromCOREResponse, extractFileMetadata, detectObjectTypeFromDescription, normalizeString } from '../services/parser.js';
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
          // Create stavba (project container) record
          await db.prepare(`
            INSERT INTO monolith_projects
            (project_id, object_type, stavba, description, owner_id)
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

    // VALIDATION: Ensure CORE identified concrete projects
    if (projectsForImport.length === 0) {
      logger.warn('[Upload] ⚠️ Import warning: CORE did not identify any concrete projects');
      logger.info('[Upload] Possible reasons:');
      logger.info('  1. No concrete items in the file (material_type != "concrete")');
      logger.info('  2. CORE parser is unavailable');
      logger.info('  3. File format not recognized by CORE');

      // Allow user to see the warning but don't create projects from unreliable sources
      res.set('Content-Type', 'application/json; charset=utf-8');
      res.json({
        success: false,
        error: 'No concrete projects identified',
        import_id: import_id,
        message: 'CORE parser did not identify any concrete items in this file. Please verify:' +
                 '\n- File contains concrete items with concrete specifications (C20/25, C30/37, etc.)' +
                 '\n- CORE parser service is available' +
                 '\n- File format is supported',
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
          // Create object record linked to stavba project (if it exists)
          await db.prepare(`
            INSERT INTO monolith_projects
            (project_id, object_type, object_name, stavba, parent_project_id, concrete_m3, span_length_m, deck_width_m, pd_weeks, owner_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            objectId,
            project.object_type || 'custom',  // Type detected from description
            project.object_name,
            fileMetadata.stavba || null,      // Store stavba context
            stavbaProjectId || null,          // Link to parent project
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
          // Create bridge record
          await db.prepare(`
            INSERT INTO bridges (bridge_id, object_name, span_length_m, deck_width_m, pd_weeks, concrete_m3, owner_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            bridgeId,
            project.object_name,
            project.span_length_m || 0,
            project.deck_width_m || 0,
            project.pd_weeks || 0,
            project.concrete_m3 || 0,
            req.user?.userId || null
          );

          logger.info(`[Upload] Created bridge record: ${bridgeId}`);
        }

        // Extract positions with intelligent fallback chain
        let positionsToInsert = [];
        let positionsSource = 'unknown';

        // PRIORITY 1: If CORE was used for project identification, use CORE positions
        if (sourceOfProjects === 'core_intelligent_classification' && parsedPositionsFromCORE.length > 0) {
          logger.info(`[Upload] Using CORE positions (${parsedPositionsFromCORE.length} total)`);

          // Filter positions matching this project
          const projectPositions = parsedPositionsFromCORE.filter(pos => {
            // Match by project_id from CORE metadata or by description similarity
            return pos.bridge_id === bridgeId ||
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

        // Insert all positions using batch insert (MUCH FASTER)
        if (positionsToInsert.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO positions (
              id, bridge_id, part_name, item_name, subtype, unit,
              qty, crew_size, wage_czk_ph, shift_hours, days, otskp_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          // Use transaction for batch insert
          const insertMany = db.transaction((positions) => {
            for (const pos of positions) {
              const id = `${bridgeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              stmt.run(
                id,
                bridgeId,
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

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.json({
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
               (stavbaProjectId ? ` in project "${fileMetadata.stavba}"` : '')
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
