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
import { getPool } from '../db/postgres.js';

function safeGetPool() {
  try {
    return getPool();
  } catch {
    return null;
  }
}

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

/**
 * POST /api/parse-preview/import
 * Parse Excel file AND create PositionInstances in Portal DB.
 * Combines Universal Parser + bulk import in one step.
 *
 * Body: multipart/form-data { file: Excel, project_name?: string }
 * Returns: { success, project_id, objects, instance_count }
 */
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  const filePath = req.file.path;
  let client;

  try {
    // 1. Parse the file
    const parsed = await parseFile(filePath, { fileName: req.file.originalname });

    // 2. Create a portal project
    client = await pool.connect();
    await client.query('BEGIN');

    const projectName = req.body.project_name
      || parsed.metadata.stavba
      || parsed.metadata.objekt
      || req.file.originalname.replace(/\.\w+$/, '');
    const projectId = `proj_${uuidv4()}`;

    await client.query(
      `INSERT INTO portal_projects (portal_project_id, project_name, project_type, owner_id, created_at, updated_at)
       VALUES ($1, $2, 'parsed_import', 1, NOW(), NOW())`,
      [projectId, projectName]
    );

    // 3. Create objects + positions from parsed sheets
    let totalInstances = 0;
    const createdObjects = [];

    for (const sheet of parsed.sheets) {
      const objectId = `obj_${uuidv4()}`;
      await client.query(
        `INSERT INTO portal_objects (object_id, portal_project_id, object_code, object_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [objectId, projectId, sheet.name || 'Sheet', sheet.bridgeName || sheet.name || 'Sheet']
      );

      const instances = [];
      for (let i = 0; i < sheet.items.length; i++) {
        const item = sheet.items[i];
        const positionId = `pos_${uuidv4()}`;

        const result = await client.query(
          `INSERT INTO portal_positions (
            position_id, object_id, kod, popis, mnozstvi, mj,
            cena_jednotkova, cena_celkem,
            sheet_name, row_index, skupina,
            created_by, updated_by,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'parsed_import', 'parsed_import', NOW(), NOW())
          RETURNING position_instance_id`,
          [
            positionId, objectId,
            item.kod || '',
            item.popis || '',
            item.mnozstvi || 0,
            item.mj || '',
            item.cenaJednotkova || null,
            item.cenaCelkem || null,
            sheet.name || '',
            i,
            null
          ]
        );

        instances.push({
          position_instance_id: result.rows[0].position_instance_id,
          catalog_code: item.kod || '',
          description: item.popis || '',
          row_index: i,
        });
        totalInstances++;
      }

      createdObjects.push({
        object_id: objectId,
        object_code: sheet.name,
        object_name: sheet.bridgeName || sheet.name,
        instance_count: instances.length,
        instances,
      });
    }

    // 4. Audit log
    await client.query(
      `INSERT INTO position_audit_log (event, actor, project_id, details)
       VALUES ('parsed_import', 'universal_parser', $1, $2)`,
      [projectId, JSON.stringify({
        file_name: req.file.originalname,
        sheets: parsed.sheets.length,
        instances: totalInstances,
      })]
    );

    await client.query('COMMIT');

    console.log(`[ParsePreview] Import complete: ${projectId} → ${parsed.sheets.length} sheets, ${totalInstances} instances`);

    res.json({
      success: true,
      project_id: projectId,
      project_name: projectName,
      objects_created: createdObjects.length,
      instances_created: totalInstances,
      objects: createdObjects,
    });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[ParsePreview] Import error:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to import' });
  } finally {
    if (client) client.release();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

export default router;
