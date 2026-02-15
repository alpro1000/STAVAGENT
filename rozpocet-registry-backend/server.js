import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Database
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
async function initDatabase() {
  try {
    const schema = fs.readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('[DB] Schema initialized');
  } catch (error) {
    console.error('[DB] Init error:', error);
  }
}

// ============ PROJECTS ============

app.get('/api/registry/projects', async (req, res) => {
  try {
    const userId = req.query.user_id || 1;
    const result = await pool.query(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM registry_sheets WHERE project_id = p.project_id) as sheets_count,
        (SELECT COUNT(*) FROM registry_items i 
         JOIN registry_sheets s ON i.sheet_id = s.sheet_id 
         WHERE s.project_id = p.project_id) as items_count
       FROM registry_projects p
       WHERE p.owner_id = $1
       ORDER BY p.updated_at DESC`,
      [userId]
    );
    res.json({ success: true, projects: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/registry/projects', async (req, res) => {
  try {
    const { project_name, portal_project_id } = req.body;
    const userId = req.body.user_id || 1;
    const projectId = `reg_${uuidv4()}`;

    const result = await pool.query(
      `INSERT INTO registry_projects (project_id, project_name, owner_id, portal_project_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [projectId, project_name, userId, portal_project_id]
    );

    res.json({ success: true, project: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/registry/projects/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM registry_projects WHERE project_id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, project: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/registry/projects/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM registry_projects WHERE project_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ SHEETS ============

app.get('/api/registry/projects/:id/sheets', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*,
        (SELECT COUNT(*) FROM registry_items WHERE sheet_id = s.sheet_id) as items_count
       FROM registry_sheets s
       WHERE s.project_id = $1
       ORDER BY s.sheet_order, s.created_at`,
      [req.params.id]
    );
    res.json({ success: true, sheets: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/registry/projects/:id/sheets', async (req, res) => {
  try {
    const { sheet_name, sheet_order } = req.body;
    const sheetId = `sheet_${uuidv4()}`;

    const result = await pool.query(
      `INSERT INTO registry_sheets (sheet_id, project_id, sheet_name, sheet_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [sheetId, req.params.id, sheet_name, sheet_order || 0]
    );

    await pool.query('UPDATE registry_projects SET updated_at = NOW() WHERE project_id = $1', [req.params.id]);

    res.json({ success: true, sheet: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/registry/sheets/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM registry_sheets WHERE sheet_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ ITEMS ============

app.get('/api/registry/sheets/:id/items', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*,
        (SELECT json_agg(json_build_object('tov_type', tov_type, 'tov_data', tov_data))
         FROM registry_tov WHERE item_id = i.item_id) as tov_data
       FROM registry_items i
       WHERE i.sheet_id = $1
       ORDER BY i.item_order, i.created_at`,
      [req.params.id]
    );
    res.json({ success: true, items: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/registry/sheets/:id/items', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { kod, popis, mnozstvi, mj, cena_jednotkova, cena_celkem, item_order, tov_data } = req.body;
    const itemId = `item_${uuidv4()}`;

    const result = await client.query(
      `INSERT INTO registry_items (item_id, sheet_id, kod, popis, mnozstvi, mj, cena_jednotkova, cena_celkem, item_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [itemId, req.params.id, kod, popis, mnozstvi || 0, mj, cena_jednotkova, cena_celkem, item_order || 0]
    );

    if (tov_data) {
      for (const [type, data] of Object.entries(tov_data)) {
        if (Array.isArray(data) && data.length > 0) {
          await client.query(
            `INSERT INTO registry_tov (tov_id, item_id, tov_type, tov_data, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [`tov_${uuidv4()}`, itemId, type, JSON.stringify(data)]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

app.put('/api/registry/items/:id', async (req, res) => {
  try {
    const { kod, popis, mnozstvi, mj, cena_jednotkova, cena_celkem } = req.body;
    const result = await pool.query(
      `UPDATE registry_items
       SET kod = $1, popis = $2, mnozstvi = $3, mj = $4, cena_jednotkova = $5, cena_celkem = $6, updated_at = NOW()
       WHERE item_id = $7
       RETURNING *`,
      [kod, popis, mnozstvi, mj, cena_jednotkova, cena_celkem, req.params.id]
    );
    res.json({ success: true, item: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/registry/items/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM registry_items WHERE item_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/registry/items/:id/tov', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM registry_tov WHERE item_id = $1', [req.params.id]);

    const { tov_data } = req.body;
    if (tov_data) {
      for (const [type, data] of Object.entries(tov_data)) {
        if (Array.isArray(data) && data.length > 0) {
          await client.query(
            `INSERT INTO registry_tov (tov_id, item_id, tov_type, tov_data, created_at, updated_at)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [`tov_${uuidv4()}`, req.params.id, type, JSON.stringify(data)]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'rozpocet-registry-backend' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`[Registry Backend] Running on port ${PORT}`);
  await initDatabase();
});
