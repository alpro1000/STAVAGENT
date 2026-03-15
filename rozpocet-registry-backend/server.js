import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { batchMapPositions } from './services/tovProfessionMapper.js';
import ExcelJS from 'exceljs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Database — graceful handling when DATABASE_URL is missing
let pool = null;
let dbReady = false;

if (process.env.DATABASE_URL) {
  // Detect Cloud SQL socket — SSL must be disabled for Unix socket connections
  const dbUrl = process.env.DATABASE_URL || '';
  const isCloudSqlSocket = dbUrl.includes('/cloudsql/') || dbUrl.includes('%2Fcloudsql%2F');
  const needsSsl = process.env.NODE_ENV === 'production' && !isCloudSqlSocket;

  // For Cloud SQL Unix sockets, append sslmode=disable to prevent pg from attempting SSL
  let connString = process.env.DATABASE_URL;
  if (isCloudSqlSocket && !connString.includes('sslmode=')) {
    connString += (connString.includes('?') ? '&' : '?') + 'sslmode=disable';
  }

  pool = new pg.Pool({
    connectionString: connString,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10,
  });

  pool.on('error', (err) => {
    console.error('[DB] Pool error:', err.message);
    dbReady = false;
  });
} else {
  console.warn('[DB] DATABASE_URL not set — running without database (health check only)');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// DB availability middleware — returns 503 if DB not ready
function requireDB(req, res, next) {
  if (!pool || !dbReady) {
    return res.status(503).json({
      success: false,
      error: 'Database not available',
      hint: pool ? 'Database connection failed — check DATABASE_URL' : 'DATABASE_URL environment variable not set',
    });
  }
  next();
}

// Initialize database
async function initDatabase() {
  if (!pool) return;
  try {
    const schema = fs.readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    dbReady = true;
    console.log('[DB] Schema initialized — ready');
  } catch (error) {
    console.error('[DB] Init error:', error.message);
    dbReady = false;
  }
}

// ============ HEALTH CHECK ============

app.get('/health', async (req, res) => {
  const status = {
    status: 'ok',
    service: 'rozpocet-registry-backend',
    version: '1.1.0',
    timestamp: new Date().toISOString(),
    database: dbReady ? 'connected' : (pool ? 'disconnected' : 'not configured'),
  };

  if (pool && dbReady) {
    try {
      const result = await pool.query('SELECT NOW() as time');
      status.db_time = result.rows[0].time;
    } catch {
      status.database = 'error';
      dbReady = false;
    }
  }

  res.json(status);
});

// Root route
app.get('/', (req, res) => {
  res.json({
    service: 'rozpocet-registry-backend',
    version: '1.1.0',
    endpoints: [
      'GET  /health',
      'GET  /api/registry/projects',
      'POST /api/registry/projects',
      'GET  /api/registry/projects/:id',
      'DELETE /api/registry/projects/:id',
      'GET  /api/registry/projects/:id/sheets',
      'POST /api/registry/projects/:id/sheets',
      'DELETE /api/registry/sheets/:id',
      'GET  /api/registry/sheets/:id/items',
      'POST /api/registry/sheets/:id/items',
      'POST /api/registry/sheets/:id/items/bulk',
      'PUT  /api/registry/items/:id',
      'DELETE /api/registry/items/:id',
      'PATCH /api/registry/items/:id/tov',
      'POST /api/registry/import/monolit',
      'POST /api/formwork-rental/calculate',
      'POST /api/registry/export/excel-with-pump',
    ],
    database: dbReady ? 'connected' : (pool ? 'disconnected' : 'not configured'),
  });
});

// ============ CLEANUP ============

// DELETE /api/registry/cleanup-empty — remove empty/duplicate projects (no sheets or no items)
// Protected by a simple secret query param to prevent accidental calls
app.delete('/api/registry/cleanup-empty', requireDB, async (req, res) => {
  try {
    const secret = req.query.secret;
    if (secret !== 'cleanup2026') {
      return res.status(403).json({ success: false, error: 'Invalid secret. Use ?secret=cleanup2026' });
    }

    // Find projects with zero items (empty projects)
    const emptyProjects = await pool.query(`
      SELECT p.project_id, p.project_name,
        (SELECT COUNT(*) FROM registry_sheets WHERE project_id = p.project_id) as sheets_count,
        (SELECT COUNT(*) FROM registry_items i
         JOIN registry_sheets s ON i.sheet_id = s.sheet_id
         WHERE s.project_id = p.project_id) as items_count
      FROM registry_projects p
      HAVING (SELECT COUNT(*) FROM registry_items i
              JOIN registry_sheets s ON i.sheet_id = s.sheet_id
              WHERE s.project_id = p.project_id) = 0
      ORDER BY p.created_at
    `);

    if (req.query.dry_run === 'true') {
      return res.json({
        success: true,
        dry_run: true,
        would_delete: emptyProjects.rows.length,
        projects: emptyProjects.rows.map(p => ({
          project_id: p.project_id,
          project_name: p.project_name,
          sheets_count: Number(p.sheets_count),
          items_count: Number(p.items_count),
        })),
      });
    }

    // Delete empty projects (CASCADE will remove sheets too)
    const ids = emptyProjects.rows.map(p => p.project_id);
    let deleted = 0;
    if (ids.length > 0) {
      const result = await pool.query(
        'DELETE FROM registry_projects WHERE project_id = ANY($1)',
        [ids]
      );
      deleted = result.rowCount;
    }

    res.json({
      success: true,
      deleted,
      message: `Removed ${deleted} empty projects`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ PROJECTS ============

app.get('/api/registry/projects', requireDB, async (req, res) => {
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

app.post('/api/registry/projects', requireDB, async (req, res) => {
  try {
    const { project_name, portal_project_id, project_id } = req.body;
    const userId = req.body.user_id || 1;
    const projectId = project_id || `reg_${uuidv4()}`;

    const result = await pool.query(
      `INSERT INTO registry_projects (project_id, project_name, owner_id, portal_project_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (project_id) DO UPDATE SET
         project_name = EXCLUDED.project_name,
         portal_project_id = COALESCE(EXCLUDED.portal_project_id, registry_projects.portal_project_id),
         updated_at = NOW()
       RETURNING *`,
      [projectId, project_name, userId, portal_project_id]
    );

    res.json({ success: true, project: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/registry/projects/:id', requireDB, async (req, res) => {
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

app.delete('/api/registry/projects/:id', requireDB, async (req, res) => {
  try {
    await pool.query('DELETE FROM registry_projects WHERE project_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ SHEETS ============

app.get('/api/registry/projects/:id/sheets', requireDB, async (req, res) => {
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

app.post('/api/registry/projects/:id/sheets', requireDB, async (req, res) => {
  try {
    const { sheet_name, sheet_order, sheet_id } = req.body;
    const sheetId = sheet_id || `sheet_${uuidv4()}`;

    // Ensure parent project exists (auto-create if needed to prevent FK violation)
    const projectCheck = await pool.query(
      'SELECT project_id FROM registry_projects WHERE project_id = $1',
      [req.params.id]
    );
    if (projectCheck.rows.length === 0) {
      await pool.query(
        `INSERT INTO registry_projects (project_id, project_name, owner_id, created_at, updated_at)
         VALUES ($1, $2, 1, NOW(), NOW())`,
        [req.params.id, 'Auto-created']
      );
    }

    const result = await pool.query(
      `INSERT INTO registry_sheets (sheet_id, project_id, sheet_name, sheet_order, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (sheet_id) DO UPDATE SET
         sheet_name = EXCLUDED.sheet_name,
         sheet_order = EXCLUDED.sheet_order,
         updated_at = NOW()
       RETURNING *`,
      [sheetId, req.params.id, sheet_name, sheet_order || 0]
    );

    await pool.query('UPDATE registry_projects SET updated_at = NOW() WHERE project_id = $1', [req.params.id]);

    res.json({ success: true, sheet: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/registry/sheets/:id', requireDB, async (req, res) => {
  try {
    await pool.query('DELETE FROM registry_sheets WHERE sheet_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ ITEMS ============

// Bulk create items (efficient single-transaction insert)
app.post('/api/registry/sheets/:id/items/bulk', requireDB, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items array required' });
    }

    let created = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemId = item.item_id || `item_${uuidv4()}`;

      await client.query(
        `INSERT INTO registry_items (item_id, sheet_id, kod, popis, mnozstvi, mj, cena_jednotkova, cena_celkem, item_order, sync_metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT (item_id) DO UPDATE SET
           kod = EXCLUDED.kod, popis = EXCLUDED.popis, mnozstvi = EXCLUDED.mnozstvi,
           mj = EXCLUDED.mj, cena_jednotkova = EXCLUDED.cena_jednotkova,
           cena_celkem = EXCLUDED.cena_celkem, updated_at = NOW()`,
        [
          itemId,
          req.params.id,
          item.kod || '',
          item.popis || '',
          item.mnozstvi || 0,
          item.mj || '',
          item.cena_jednotkova ?? null,
          item.cena_celkem ?? null,
          item.item_order ?? i,
          item.sync_metadata ? JSON.stringify(item.sync_metadata) : null,
        ]
      );

      if (item.tov_data) {
        for (const [type, data] of Object.entries(item.tov_data)) {
          if (Array.isArray(data) && data.length > 0) {
            await client.query(
              `INSERT INTO registry_tov (tov_id, item_id, tov_type, tov_data, created_at, updated_at)
               VALUES ($1, $2, $3, $4, NOW(), NOW())
               ON CONFLICT (tov_id) DO UPDATE SET tov_data = EXCLUDED.tov_data, updated_at = NOW()`,
              [`tov_${uuidv4()}`, itemId, type, JSON.stringify(data)]
            );
          }
        }
      }
      created++;
    }

    await client.query('COMMIT');
    res.json({ success: true, created });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/registry/sheets/:id/items', requireDB, async (req, res) => {
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

app.post('/api/registry/sheets/:id/items', requireDB, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { kod, popis, mnozstvi, mj, cena_jednotkova, cena_celkem, item_order, tov_data, sync_metadata } = req.body;
    const itemId = `item_${uuidv4()}`;

    const result = await client.query(
      `INSERT INTO registry_items (item_id, sheet_id, kod, popis, mnozstvi, mj, cena_jednotkova, cena_celkem, item_order, sync_metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING *`,
      [itemId, req.params.id, kod, popis, mnozstvi || 0, mj, cena_jednotkova, cena_celkem, item_order || 0, sync_metadata ? JSON.stringify(sync_metadata) : null]
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

app.put('/api/registry/items/:id', requireDB, async (req, res) => {
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

app.delete('/api/registry/items/:id', requireDB, async (req, res) => {
  try {
    await pool.query('DELETE FROM registry_items WHERE item_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/registry/items/:id/tov', requireDB, async (req, res) => {
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

// ============ MONOLIT INTEGRATION ============

app.post('/api/registry/import/monolit', requireDB, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { project_name, positions, user_id } = req.body;
    const userId = user_id || 1;
    const projectId = `reg_${uuidv4()}`;

    // Create project
    await client.query(
      `INSERT INTO registry_projects (project_id, project_name, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [projectId, project_name, userId]
    );

    // Create sheet
    const sheetId = `sheet_${uuidv4()}`;
    await client.query(
      `INSERT INTO registry_sheets (sheet_id, project_id, sheet_name, sheet_order, created_at, updated_at)
       VALUES ($1, $2, $3, 0, NOW(), NOW())`,
      [sheetId, projectId, 'Imported from Monolit']
    );

    // Map positions to labor resources
    const laborResources = batchMapPositions(positions);

    // Create items with TOV data
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const itemId = `item_${uuidv4()}`;

      await client.query(
        `INSERT INTO registry_items (item_id, sheet_id, kod, popis, mnozstvi, mj, cena_jednotkova, cena_celkem, item_order, sync_metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
        [
          itemId,
          sheetId,
          pos.otskp_code || '',
          pos.item_name || pos.part_name,
          pos.qty || 0,
          pos.unit || 'm³',
          pos.cost_czk || 0,
          (pos.cost_czk || 0) * (pos.qty || 0),
          i,
          JSON.stringify({ monolit_position_id: pos.id, subtype: pos.subtype })
        ]
      );

      // Add labor TOV if mapped
      const labor = laborResources[i];
      if (labor) {
        await client.query(
          `INSERT INTO registry_tov (tov_id, item_id, tov_type, tov_data, created_at, updated_at)
           VALUES ($1, $2, 'labor', $3, NOW(), NOW())`,
          [`tov_${uuidv4()}`, itemId, JSON.stringify([labor])]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, project_id: projectId, mapped_count: laborResources.filter(Boolean).length });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// ============ FORMWORK RENTAL CALCULATOR ============

const FORMWORK_PRICES = {
  'FRAMI XLIFE': { base: 8.5, heights: { 1.2: 0.9, 1.5: 1.0, 2.4: 1.1, 2.7: 1.15, 3.0: 1.2 } },
  'FRAMAX XLIFE': { base: 9.0, heights: { 1.5: 1.0, 2.4: 1.1, 2.7: 1.15, 3.0: 1.2 } },
  'STAXO100': { base: 12.0, heights: { 2.7: 1.0, 3.0: 1.1 } }
};

app.post('/api/formwork-rental/calculate', (req, res) => {
  try {
    const { area_m2, system, height, rental_days } = req.body;

    if (!area_m2 || !system || !height || !rental_days) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const priceConfig = FORMWORK_PRICES[system];
    if (!priceConfig) {
      return res.status(400).json({ success: false, error: 'Unknown formwork system' });
    }

    const heightMultiplier = priceConfig.heights[height] || 1.0;
    const unit_price_czk_m2_day = priceConfig.base * heightMultiplier;
    const total_rental_czk = Math.round(unit_price_czk_m2_day * area_m2 * rental_days);

    res.json({
      success: true,
      calculation: {
        area_m2,
        system,
        height,
        rental_days,
        unit_price_czk_m2_day: Math.round(unit_price_czk_m2_day * 100) / 100,
        total_rental_czk,
        breakdown: {
          base_price: priceConfig.base,
          height_multiplier: heightMultiplier,
          daily_cost: Math.round(unit_price_czk_m2_day * area_m2)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ EXCEL EXPORT WITH PUMP DATA ============

app.post('/api/registry/export/excel-with-pump', async (req, res) => {
  try {
    const { items, pumpRental, projectName } = req.body;

    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Items
    const itemsSheet = workbook.addWorksheet('Položky');
    itemsSheet.columns = [
      { header: 'Kód', key: 'kod', width: 15 },
      { header: 'Popis', key: 'popis', width: 40 },
      { header: 'Množství', key: 'mnozstvi', width: 12 },
      { header: 'MJ', key: 'mj', width: 8 },
      { header: 'Cena/MJ', key: 'cena_jednotkova', width: 12 },
      { header: 'Celkem', key: 'cena_celkem', width: 12 }
    ];

    items.forEach(item => {
      itemsSheet.addRow({
        kod: item.kod,
        popis: item.popis,
        mnozstvi: item.mnozstvi,
        mj: item.mj,
        cena_jednotkova: item.cena_jednotkova,
        cena_celkem: item.cena_celkem
      });
    });

    // Sheet 2: Pump (if provided)
    if (pumpRental && pumpRental.konecna_cena > 0) {
      const pumpSheet = workbook.addWorksheet('Betonočerpadlo');
      pumpSheet.columns = [{ width: 30 }, { width: 15 }, { width: 15 }];

      pumpSheet.addRow(['KALKULACE BETONOČERPADLA']);
      pumpSheet.getRow(1).font = { bold: true, size: 14 };
      pumpSheet.addRow([]);

      pumpSheet.addRow(['Dodavatel:', pumpRental.pump_label || 'N/A']);
      pumpSheet.addRow(['Vzdálenost:', `${pumpRental.vzdalenost_km} km`]);
      pumpSheet.addRow(['Výkon:', `${pumpRental.vykon_m3h} m³/h`]);
      pumpSheet.addRow([]);

      // Construction items
      pumpSheet.addRow(['KONSTRUKCE', 'm³', 'Přistavení', 'Hodiny']);
      pumpSheet.getRow(pumpSheet.rowCount).font = { bold: true };

      pumpRental.items.forEach(item => {
        pumpSheet.addRow([
          item.nazev,
          item.celkem_m3.toFixed(1),
          item.pocet_pristaveni,
          item.hodiny_celkem.toFixed(2)
        ]);
      });

      pumpSheet.addRow([]);

      // Cost breakdown
      pumpSheet.addRow(['NÁKLADY']);
      pumpSheet.getRow(pumpSheet.rowCount).font = { bold: true };

      if (pumpRental.celkem_doprava > 0) {
        pumpSheet.addRow(['Doprava:', `${pumpRental.celkem_doprava.toLocaleString('cs-CZ')} Kč`]);
      }
      if (pumpRental.celkem_manipulace > 0) {
        pumpSheet.addRow(['Manipulace:', `${pumpRental.celkem_manipulace.toLocaleString('cs-CZ')} Kč`]);
      }
      if (pumpRental.celkem_priplatek_m3 > 0) {
        pumpSheet.addRow(['Příplatek za čerpání:', `${pumpRental.celkem_priplatek_m3.toLocaleString('cs-CZ')} Kč`]);
      }
      if (pumpRental.celkem_prislusenstvi > 0) {
        pumpSheet.addRow(['Příslušenství:', `${pumpRental.celkem_prislusenstvi.toLocaleString('cs-CZ')} Kč`]);
      }
      if (pumpRental.celkem_priplatky > 0) {
        pumpSheet.addRow(['Příplatky:', `${pumpRental.celkem_priplatky.toLocaleString('cs-CZ')} Kč`]);
      }

      pumpSheet.addRow([]);
      const totalRow = pumpSheet.addRow(['CELKEM:', `${pumpRental.konecna_cena.toLocaleString('cs-CZ')} Kč`]);
      totalRow.font = { bold: true, size: 12 };

      if (pumpRental.celkem_m3 > 0) {
        pumpSheet.addRow(['Cena/m³:', `${(pumpRental.konecna_cena / pumpRental.celkem_m3).toFixed(0)} Kč/m³`]);
      }
    }

    const filename = `${projectName || 'export'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initialize database BEFORE accepting connections (prevents 503 race condition)
await initDatabase();

// Start server
app.listen(PORT, () => {
  console.log(`[Registry Backend] v1.1.0 running on port ${PORT}`);
  console.log(`[Registry Backend] DATABASE_URL: ${process.env.DATABASE_URL ? 'configured' : 'NOT SET'}`);
  console.log(`[Registry Backend] DB ready: ${dbReady}`);
});
