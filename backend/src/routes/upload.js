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
          createdBridges.push({
            bridge_id: bridge.bridge_id,
            object_name: bridge.object_name,
            concrete_m3: bridge.concrete_m3 || 0
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

    res.json({
      import_id,
      filename: req.file.originalname,
      bridges: createdBridges,
      mapping_suggestions: parseResult.mapping_suggestions,
      raw_rows: parseResult.raw_rows,
      row_count: parseResult.raw_rows.length,
      status: 'bridges_created',
      message: `Created ${createdBridges.length} bridges from Excel file`
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
