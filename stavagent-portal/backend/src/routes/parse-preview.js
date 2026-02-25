/**
 * Parse Preview Route
 *
 * Accepts an Excel file upload, parses it with the Universal Parser,
 * and returns the summary WITHOUT storing anything in the database.
 *
 * Useful for the "Parse Preview" modal in Portal:
 *   - User drags Excel → sees metadata, sheets, types, kiosk suggestions
 *   - No project required, no auth required
 *
 * POST /api/parse-preview
 *   Body: multipart/form-data { file: Excel file }
 *   Returns: { success, metadata, summary, sheets[] }
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { parseFile } from '../services/universalParser.js';

const router = express.Router();

// Temp storage — files deleted after parse
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tmpDir = path.join(process.cwd(), 'uploads', 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    cb(null, tmpDir);
  },
  filename: (req, file, cb) => {
    cb(null, `tmp_${uuidv4()}_${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const ok = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ].includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Only Excel files are supported (.xls, .xlsx)'));
  },
});

/**
 * POST /api/parse-preview
 */
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  const filePath = req.file.path;

  try {
    const parsed = await parseFile(filePath, { fileName: req.file.originalname });

    // Return lightweight preview: no individual item arrays (could be 10k+ rows)
    const preview = {
      success: true,
      metadata: parsed.metadata,
      summary: parsed.summary,
      sheets: parsed.sheets.map(s => ({
        name: s.name,
        bridgeId: s.bridgeId,
        bridgeName: s.bridgeName,
        itemCount: s.items.length,
        stats: s.stats,
        columnMapping: s.columnMapping,
        dataStartRow: s.dataStartRow,
      })),
      // Top 5 items from each sheet as preview sample
      sampleItems: parsed.sheets.flatMap(s =>
        s.items.slice(0, 5).map(i => ({ ...i, _sheet: s.name }))
      ).slice(0, 20),
    };

    res.json(preview);
  } catch (err) {
    console.error('[ParsePreview] Error:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to parse file' });
  } finally {
    // Always delete temp file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

export default router;
