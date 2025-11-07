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

    res.json({
      import_id,
      filename: req.file.originalname,
      bridges: parseResult.bridges,
      mapping_suggestions: parseResult.mapping_suggestions,
      raw_rows: parseResult.raw_rows,
      row_count: parseResult.raw_rows.length,
      status: 'pending_mapping'
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
