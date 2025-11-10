/**
 * Upload routes
 * POST /api/upload - Upload XLSX file
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { parseXLSX } from '../services/parser.js';
import { logger } from '../utils/logger.js';
import db from '../db/init.js';

const router = express.Router();

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
    const allowedExt = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedExt.includes(ext)) {
      return cb(new Error('Only .xlsx and .xls files are allowed'));
    }

    cb(null, true);
  }
});

// POST upload XLSX
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const import_id = uuidv4();

    logger.info(`Processing upload: ${req.file.originalname} (${import_id})`);

    // Parse XLSX
    const parseResult = await parseXLSX(filePath);

    // Auto-create bridges in database
    const createdBridges = [];

    // Template positions (11 default parts)
    const templatePositions = [
      // 1. ZÁKLADY ZE ŽELEZOBETONU DO C30/37
      { part_name: 'ZÁKLADY', item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37', subtype: 'beton', unit: 'M3' },
      { part_name: 'ZÁKLADY', item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37', subtype: 'bednění', unit: 'm2' },

      // 2. ŘÍMSY ZE ŽELEZOBETONU DO C30/37 (B37)
      { part_name: 'ŘÍMSY', item_name: 'ŘÍMSY ZE ŽELEZOBETONU DO C30/37 (B37)', subtype: 'beton', unit: 'M3' },
      { part_name: 'ŘÍMSY', item_name: 'ŘÍMSY ZE ŽELEZOBETONU DO C30/37 (B37)', subtype: 'bednění', unit: 'm2' },

      // 3. MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'beton', unit: 'M3' },
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (opěry)', unit: 'm2' },
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (křídla)', unit: 'm2' },
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (závěrné zídky)', unit: 'm2' },

      // 4. MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA C40/50', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50', subtype: 'beton', unit: 'M3' },
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA C40/50', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50', subtype: 'bednění', unit: 'm2' },

      // 5. MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)
      { part_name: 'MOSTNÍ PILÍŘE A STATIVA', item_name: 'MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)', subtype: 'beton', unit: 'M3' },
      { part_name: 'MOSTNÍ PILÍŘE A STATIVA', item_name: 'MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)', subtype: 'bednění', unit: 'm2' },

      // 6. PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30
      { part_name: 'PŘECHODOVÉ DESKY', item_name: 'PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30', subtype: 'beton', unit: 'M3' },
      { part_name: 'PŘECHODOVÉ DESKY', item_name: 'PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30', subtype: 'bednění', unit: 'm2' },

      // 7. MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37
      { part_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE', item_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37', subtype: 'beton', unit: 'M3' },
      { part_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE', item_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37', subtype: 'bednění', unit: 'm2' },

      // 8. SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25
      { part_name: 'SCHODIŠŤ KONSTRUKCE', item_name: 'SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25', subtype: 'beton', unit: 'M3' },
      { part_name: 'SCHODIŠŤ KONSTRUKCE', item_name: 'SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25', subtype: 'bednění', unit: 'm2' },

      // 9. PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15
      { part_name: 'PODKLADNÍ VRSTVY C12/15', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15', subtype: 'beton', unit: 'M3' },
      { part_name: 'PODKLADNÍ VRSTVY C12/15', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15', subtype: 'bednění', unit: 'm2' },

      // 10. PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25
      { part_name: 'PODKLADNÍ VRSTVY C20/25', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25', subtype: 'beton', unit: 'M3' },
      { part_name: 'PODKLADNÍ VRSTVY C20/25', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25', subtype: 'bednění', unit: 'm2' },

      // 11. PATKY Z PROSTÉHO BETONU C25/30
      { part_name: 'PATKY', item_name: 'PATKY Z PROSTÉHO BETONU C25/30', subtype: 'beton', unit: 'M3' },
      { part_name: 'PATKY', item_name: 'PATKY Z PROSTÉHO BETONU C25/30', subtype: 'bednění', unit: 'm2' }
    ];

    const insertPosition = db.prepare(`
      INSERT INTO positions (
        id, bridge_id, part_name, item_name, subtype, unit,
        qty, crew_size, wage_czk_ph, shift_hours, days
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const bridge of parseResult.bridges) {
      try {
        // Check if bridge already exists
        const existing = db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge.bridge_id);

        if (!existing) {
          db.prepare(`
            INSERT INTO bridges (bridge_id, object_name, span_length_m, deck_width_m, pd_weeks, concrete_m3)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            bridge.bridge_id,
            bridge.object_name,
            bridge.span_length_m || 0,
            bridge.deck_width_m || 0,
            bridge.pd_weeks || 0,
            bridge.concrete_m3 || 0
          );

          logger.info(`Created bridge: ${bridge.bridge_id}`);

          // Create template positions for new bridge
          templatePositions.forEach((template, index) => {
            const id = `${bridge.bridge_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`;
            insertPosition.run(
              id,
              bridge.bridge_id,
              template.part_name,
              template.item_name,
              template.subtype,
              template.unit,
              0, // qty - to be filled by user
              4, // crew_size - default
              398, // wage_czk_ph - default
              10, // shift_hours - default
              0  // days - to be filled by user
            );
          });

          logger.info(`Created ${templatePositions.length} template positions for bridge ${bridge.bridge_id}`);

          createdBridges.push({
            bridge_id: bridge.bridge_id,
            object_name: bridge.object_name,
            concrete_m3: bridge.concrete_m3 || 0,
            positions_created: templatePositions.length
          });
        } else {
          logger.info(`Bridge already exists: ${bridge.bridge_id}`);
          createdBridges.push({
            bridge_id: bridge.bridge_id,
            object_name: bridge.object_name,
            concrete_m3: bridge.concrete_m3 || 0,
            note: 'Existing bridge - check if concrete quantity needs update'
          });
        }
      } catch (error) {
        logger.error(`Error creating bridge ${bridge.bridge_id}:`, error);
      }
    }

    // Count total positions created
    const totalPositions = createdBridges.reduce((sum, b) => sum + (b.positions_created || 0), 0);

    res.json({
      import_id,
      filename: req.file.originalname,
      bridges: createdBridges,
      mapping_suggestions: parseResult.mapping_suggestions,
      raw_rows: parseResult.raw_rows,
      row_count: parseResult.raw_rows.length,
      status: 'success',
      message: `Created ${createdBridges.length} bridges with ${totalPositions} template positions from Excel file`
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
