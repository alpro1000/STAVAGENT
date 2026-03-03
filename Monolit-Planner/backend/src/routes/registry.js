import express from 'express';
import multer from 'multer';
import db from '../db/index.js';
import { FileVersioningService } from '../services/fileVersioningService.js';
import { MonolitRegistryAdapter } from '../services/monolitRegistryAdapter.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// POST /api/v1/registry/projects - Create project
router.post('/projects', async (req, res) => {
  try {
    const { project_name, display_name, metadata } = req.body;
    
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
    
    const result = await db.query(
      `INSERT INTO registry_position_instances 
       (object_id, source_file_id, file_version_id, position_code, position_name, 
        unit, quantity, kiosk_type, kiosk_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [object_id, source_file_id, file_version_id, position_code, position_name,
       unit, quantity, kiosk_type, kiosk_data || {}]
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
         pos.position_name, pos.unit, pos.quantity, pos.kiosk_type, pos.kiosk_data || {}]
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

export default router;
