import express from 'express';
import multer from 'multer';
import db from '../db/index.js';
import { FileVersioningService } from '../services/fileVersioningService.js';
import { MonolitRegistryAdapter } from '../services/monolitRegistryAdapter.js';
import { RegistryTOVAdapter } from '../services/registryTOVAdapter.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const ALLOWED_FILE_TYPES = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// POST /api/v1/registry/projects - Create project
router.post('/projects', async (req, res) => {
  try {
    const { project_name, display_name, metadata } = req.body;
    
    if (!project_name || typeof project_name !== 'string' || project_name.length === 0 || project_name.length > 255) {
      return res.status(400).json({ error: 'Invalid project_name: must be a non-empty string (max 255 chars)' });
    }
    
    const result = await db.query(
      `INSERT INTO registry_projects (project_name, display_name, metadata)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [project_name, display_name || project_name, metadata || {}]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Project already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/registry/projects - List projects
router.get('/projects', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM registry_projects ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/registry/projects/:id - Get project
router.get('/projects/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM registry_projects WHERE id = $1`,
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/registry/objects - Create object
router.post('/objects', async (req, res) => {
  try {
    const { project_id, object_name, object_type, metadata } = req.body;
    
    const result = await db.query(
      `INSERT INTO registry_objects (project_id, object_name, object_type, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [project_id, object_name, object_type, metadata || {}]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Object already exists in project' });
    }
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/registry/projects/:projectId/objects - List objects
router.get('/projects/:projectId/objects', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM registry_objects WHERE project_id = $1 ORDER BY created_at`,
      [req.params.projectId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validation helpers
const VALID_KIOSK_TYPES = ['monolit', 'registry_tov', 'urs_matcher'];

function validatePositionFields({ object_id, position_code, position_name, unit, quantity, kiosk_type }) {
  const errors = [];
  if (!object_id) errors.push('object_id is required');
  if (!position_code || typeof position_code !== 'string' || position_code.length > 100) {
    errors.push('position_code must be a non-empty string (max 100 chars)');
  }
  if (!position_name || typeof position_name !== 'string' || position_name.length > 500) {
    errors.push('position_name must be a non-empty string (max 500 chars)');
  }
  if (!unit || typeof unit !== 'string' || unit.length > 20) {
    errors.push('unit must be a non-empty string (max 20 chars)');
  }
  if (quantity !== undefined && quantity !== null && (typeof quantity !== 'number' || isNaN(quantity) || quantity < 0)) {
    errors.push('quantity must be a non-negative number');
  }
  if (kiosk_type && !VALID_KIOSK_TYPES.includes(kiosk_type)) {
    errors.push(`kiosk_type must be one of: ${VALID_KIOSK_TYPES.join(', ')}`);
  }
  return errors;
}

// POST /api/v1/registry/positions - Create position instance
router.post('/positions', async (req, res) => {
  try {
    const {
      object_id,
      source_file_id,
      file_version_id,
      position_code,
      position_name,
      unit,
      quantity,
      kiosk_type,
      kiosk_data
    } = req.body;

    const errors = validatePositionFields({ object_id, position_code, position_name, unit, quantity, kiosk_type });
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    const result = await db.query(
      `INSERT INTO registry_position_instances
       (object_id, source_file_id, file_version_id, position_code, position_name,
        unit, quantity, kiosk_type, kiosk_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [object_id, source_file_id, file_version_id, position_code, position_name,
       unit, quantity || 0, kiosk_type, kiosk_data || {}]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/registry/objects/:objectId/positions - List positions
router.get('/objects/:objectId/positions', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM registry_position_instances 
       WHERE object_id = $1 AND is_active = true
       ORDER BY position_code`,
      [req.params.objectId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/registry/files/upload - Upload file with versioning
router.post('/files/upload', upload.single('file'), async (req, res) => {
  try {
    const { object_id, file_type } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only XLSX, PDF, and DOCX files are allowed' });
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB' });
    }

    const result = await FileVersioningService.createOrUpdateFile(db, {
      objectId: object_id,
      fileName: file.originalname,
      fileType: file_type || file.mimetype,
      filePath: file.path,
      metadata: { size: file.size, originalName: file.originalname }
    });

    res.json({
      source_file_id: result.sourceFileId,
      version: result.version,
      is_new: result.isNew,
      message: result.isNew ? 'File uploaded' : 'New version created'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/registry/positions/batch - Batch import positions
router.post('/positions/batch', async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    const { positions } = req.body;

    if (!Array.isArray(positions) || positions.length === 0) {
      return res.status(400).json({ error: 'Positions array required' });
    }

    // Validate all positions before starting transaction
    for (let i = 0; i < positions.length; i++) {
      const errors = validatePositionFields(positions[i]);
      if (errors.length > 0) {
        return res.status(400).json({ error: `Validation failed for position[${i}]`, details: errors });
      }
    }

    await client.query('BEGIN');

    const results = [];
    for (const pos of positions) {
      const result = await client.query(
        `INSERT INTO registry_position_instances
         (object_id, source_file_id, file_version_id, position_code, position_name,
          unit, quantity, kiosk_type, kiosk_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [pos.object_id, pos.source_file_id, pos.file_version_id, pos.position_code,
         pos.position_name, pos.unit, pos.quantity || 0, pos.kiosk_type, pos.kiosk_data || {}]
      );
      results.push(result.rows[0].id);
    }

    await client.query('COMMIT');

    res.json({
      imported: results.length,
      position_ids: results
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// POST /api/v1/registry/monolit/import - Import Monolit project to Registry
router.post('/monolit/import', async (req, res) => {
  try {
    const { project_name } = req.body;

    if (!project_name) {
      return res.status(400).json({ error: 'project_name required' });
    }

    const summary = await MonolitRegistryAdapter.importFullMonolitProject(project_name);

    res.json({
      success: true,
      ...summary,
      message: `Imported ${summary.objects_imported} objects, ${summary.positions_imported} positions`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/registry/registry-tov/import - Import Registry TOV project
router.post('/registry-tov/import', async (req, res) => {
  try {
    const { registry_project_id, registry_api_url } = req.body;

    if (!registry_project_id) {
      return res.status(400).json({ error: 'registry_project_id required' });
    }

    const apiUrl = registry_api_url || process.env.REGISTRY_TOV_API_URL || 'https://stavagent-backend-ktwx.vercel.app';
    const summary = await RegistryTOVAdapter.importRegistryTOVProject(registry_project_id, apiUrl);

    res.json({
      success: true,
      ...summary,
      message: `Imported ${summary.objects_imported} sheets, ${summary.positions_imported} positions`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// REST-style endpoints (documented API contract)
// ============================================================

// POST /api/v1/registry/projects/:id/files - Upload file to project
router.post('/projects/:id/files', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { file_type } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only XLSX, PDF, and DOCX files are allowed' });
    }
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB' });
    }

    // Find or create a default object for this project
    let objectResult = await db.query(
      `SELECT id FROM registry_objects WHERE project_id = $1 ORDER BY created_at LIMIT 1`,
      [id]
    );
    if (objectResult.rows.length === 0) {
      objectResult = await db.query(
        `INSERT INTO registry_objects (project_id, object_name, object_type, metadata)
         VALUES ($1, 'default', 'project', '{}')
         RETURNING id`,
        [id]
      );
    }
    const objectId = objectResult.rows[0].id;

    const result = await FileVersioningService.createOrUpdateFile(db, {
      objectId,
      fileName: file.originalname,
      fileType: file_type || file.mimetype,
      filePath: file.path,
      metadata: { size: file.size, originalName: file.originalname }
    });

    res.json({
      source_file_id: result.sourceFileId,
      version: result.version,
      is_new: result.isNew,
      message: result.isNew ? 'File uploaded' : 'New version created'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/registry/file-versions/:id/parse - Trigger parse for file version
router.post('/file-versions/:id/parse', async (req, res) => {
  try {
    const { id } = req.params;

    const versionResult = await db.query(
      `SELECT fv.*, sf.file_name, sf.file_type, sf.object_id
       FROM registry_file_versions fv
       JOIN registry_source_files sf ON fv.source_file_id = sf.id
       WHERE fv.id = $1`,
      [id]
    );

    if (versionResult.rows.length === 0) {
      return res.status(404).json({ error: 'File version not found' });
    }

    const version = versionResult.rows[0];

    // Mark as parsing in progress
    await db.query(
      `UPDATE registry_file_versions SET changes_summary = 'parsing' WHERE id = $1`,
      [id]
    );

    res.json({
      file_version_id: version.id,
      source_file_id: version.source_file_id,
      file_name: version.file_name,
      status: 'parse_initiated',
      message: 'File version parse initiated'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/registry/projects/:id/positions - List positions for project
router.get('/projects/:id/positions', async (req, res) => {
  try {
    const { id } = req.params;
    const { kiosk_type, work_category, is_active } = req.query;

    let query = `
      SELECT pi.*, ro.object_name, ro.object_type
      FROM registry_position_instances pi
      JOIN registry_objects ro ON pi.object_id = ro.id
      WHERE ro.project_id = $1
    `;
    const params = [id];
    let paramIdx = 2;

    if (kiosk_type) {
      query += ` AND pi.kiosk_type = $${paramIdx++}`;
      params.push(kiosk_type);
    }
    if (work_category) {
      query += ` AND pi.kiosk_data->>'work_category' = $${paramIdx++}`;
      params.push(work_category);
    }
    if (is_active !== undefined) {
      query += ` AND pi.is_active = $${paramIdx++}`;
      params.push(is_active === 'true');
    } else {
      query += ' AND pi.is_active = true';
    }

    query += ' ORDER BY pi.position_code';

    const result = await db.query(query, params);

    // Map to frontend PositionInstance shape
    const positions = result.rows.map(row => ({
      position_instance_id: String(row.id),
      file_version_id: row.file_version_id ? String(row.file_version_id) : null,
      kiosk_type: row.kiosk_type,
      work_category: row.kiosk_data?.work_category || categorizeByKioskData(row),
      catalog_code: row.position_code,
      description: row.position_name,
      qty: Number(row.quantity),
      unit: row.unit,
      monolith_payload: row.kiosk_type === 'monolit' ? row.kiosk_data : undefined,
      tov_payload: row.kiosk_type === 'registry_tov' ? row.kiosk_data : undefined,
      urs_payload: row.kiosk_type === 'urs_matcher' ? row.kiosk_data : undefined,
      object_name: row.object_name
    }));

    res.json({ positions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/registry/positions/:id - Get single position
router.get('/positions/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT pi.*, ro.object_name, ro.object_type, rp.project_name
       FROM registry_position_instances pi
       JOIN registry_objects ro ON pi.object_id = ro.id
       JOIN registry_projects rp ON ro.project_id = rp.id
       WHERE pi.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const row = result.rows[0];
    res.json({
      position: {
        position_instance_id: String(row.id),
        file_version_id: row.file_version_id ? String(row.file_version_id) : null,
        kiosk_type: row.kiosk_type,
        work_category: row.kiosk_data?.work_category || categorizeByKioskData(row),
        catalog_code: row.position_code,
        description: row.position_name,
        qty: Number(row.quantity),
        unit: row.unit,
        monolith_payload: row.kiosk_type === 'monolit' ? row.kiosk_data : undefined,
        tov_payload: row.kiosk_type === 'registry_tov' ? row.kiosk_data : undefined,
        urs_payload: row.kiosk_type === 'urs_matcher' ? row.kiosk_data : undefined,
        object_name: row.object_name,
        project_name: row.project_name
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/registry/positions/:id/monolith-calc - Write Monolit calculation payload
router.post('/positions/:id/monolith-calc', async (req, res) => {
  try {
    const { id } = req.params;
    const { monolith_payload } = req.body;

    if (!monolith_payload || typeof monolith_payload !== 'object') {
      return res.status(400).json({ error: 'monolith_payload object required' });
    }

    const result = await db.query(
      `UPDATE registry_position_instances
       SET kiosk_data = kiosk_data || $1::jsonb, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(monolith_payload), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    res.json({ success: true, position_id: id, updated_at: result.rows[0].updated_at });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/registry/positions/:id/monolith-calc - Read Monolit calculation payload
router.get('/positions/:id/monolith-calc', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT kiosk_data FROM registry_position_instances WHERE id = $1 AND kiosk_type = 'monolit'`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Monolit position not found' });
    }

    res.json({ monolith_payload: result.rows[0].kiosk_data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/registry/positions/:id/dov - Write DOV payload
router.post('/positions/:id/dov', async (req, res) => {
  try {
    const { id } = req.params;
    const { dov_payload } = req.body;

    if (!dov_payload || typeof dov_payload !== 'object') {
      return res.status(400).json({ error: 'dov_payload object required' });
    }

    const result = await db.query(
      `UPDATE registry_position_instances
       SET kiosk_data = kiosk_data || $1::jsonb, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify({ dov_data: dov_payload }), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    res.json({ success: true, position_id: id, updated_at: result.rows[0].updated_at });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/registry/positions/:id/dov - Read DOV payload
router.get('/positions/:id/dov', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT kiosk_data FROM registry_position_instances WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    res.json({ dov_payload: result.rows[0].kiosk_data?.dov_data || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/registry/templates - List position templates
router.get('/templates', async (req, res) => {
  try {
    const { kiosk_type } = req.query;

    let query = 'SELECT * FROM registry_position_templates';
    const params = [];

    if (kiosk_type) {
      query += ' WHERE kiosk_type = $1';
      params.push(kiosk_type);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json({ templates: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Helper: categorize position by kiosk_data content
// ============================================================
function categorizeByKioskData(row) {
  if (row.kiosk_type === 'monolit') {
    const data = row.kiosk_data || {};
    if (data.concrete_volume) return 'beton';
    if (data.formwork_area) return 'bedneni';
    if (data.reinforcement_weight) return 'vystuz';
    return 'ostatni';
  }
  return row.kiosk_type === 'registry_tov' ? 'rozpocet' : 'ostatni';
}

export default router;
