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
    const userId = req.body.user_id || 1; // Default owner_id=1 for integration imports
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

// ============ MONOLIT INTEGRATION ============

app.post('/api/registry/import/monolit', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { project_name, positions, user_id } = req.body;
    const userId = user_id || 1; // Default owner_id=1
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
      const labor = laborResources.find(l => l && positions.indexOf(pos) === laborResources.indexOf(l));
      if (labor) {
        await client.query(
          `INSERT INTO registry_tov (tov_id, item_id, tov_type, tov_data, created_at, updated_at)
           VALUES ($1, $2, 'labor', $3, NOW(), NOW())`,
          [`tov_${uuidv4()}`, itemId, JSON.stringify([labor])]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, project_id: projectId, mapped_count: laborResources.length });
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

app.post('/api/formwork-rental/calculate', async (req, res) => {
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'rozpocet-registry-backend' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`[Registry Backend] Running on port ${PORT}`);
  await initDatabase();
});
