/**
 * Soupis prací (Bill of Quantities) API routes
 *
 * Endpoints:
 * - GET    /api/soupis/:projectId         - Get saved soupis for project
 * - POST   /api/soupis/:projectId/generate - Generate soupis from positions
 * - POST   /api/soupis/match-urs          - Proxy to URS Matcher for OTSKP→URS
 * - PUT    /api/soupis/:projectId/item/:itemId - Update URS code for item
 * - DELETE /api/soupis/:projectId          - Delete all soupis items for project
 *
 * @module routes/soupis
 */

import express from 'express';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const URS_MATCHER_URL = process.env.URS_MATCHER_URL || 'http://localhost:3000';


// ============================================================================
// GET /api/soupis/:projectId - Get saved soupis
// ============================================================================

router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Ensure table exists
    await ensureSoupisTable();

    const items = db.prepare(
      'SELECT * FROM soupis_items WHERE project_id = ? ORDER BY item_id'
    ).all(projectId);

    const totalCzk = items.reduce((sum, i) => sum + (i.total_price || 0), 0);

    return res.json({
      success: true,
      data: {
        project_id: projectId,
        items,
        items_count: items.length,
        total_czk: Math.round(totalCzk),
      }
    });
  } catch (error) {
    logger.error(`GET soupis error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});


// ============================================================================
// POST /api/soupis/:projectId/generate - Generate soupis from positions
// ============================================================================

router.post('/:projectId/generate', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Missing "items" array',
        usage: 'POST /api/soupis/:projectId/generate { "items": [...PricedPolozka] }'
      });
    }

    await ensureSoupisTable();

    // Clear existing items for this project
    db.prepare('DELETE FROM soupis_items WHERE project_id = ?').run(projectId);

    // Insert new items
    const insert = db.prepare(`
      INSERT INTO soupis_items (
        project_id, item_id, chapter, code_otskp, description,
        specification, unit, quantity, unit_price, total_price,
        quantity_status, confidence, source_param, is_composite
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows) => {
      for (const row of rows) {
        insert.run(
          projectId,
          row.item_id || '',
          row.chapter || null,
          row.code_otskp || null,
          row.description_custom || row.description || '',
          row.specification || null,
          row.mj || row.unit || 'M',
          row.quantity || null,
          row.unit_price != null ? parseFloat(row.unit_price) : null,
          row.total_price != null ? parseFloat(row.total_price) : null,
          row.quantity_status || 'OK',
          row.confidence || 1.0,
          row.source_param || null,
          row.is_composite ? 1 : 0,
        );
      }
    });

    insertMany(items);

    const totalCzk = items.reduce((sum, i) =>
      sum + (parseFloat(i.total_price) || 0), 0
    );

    return res.json({
      success: true,
      data: {
        project_id: projectId,
        items_inserted: items.length,
        total_czk: Math.round(totalCzk),
      }
    });
  } catch (error) {
    logger.error(`POST generate soupis error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});


// ============================================================================
// POST /api/soupis/match-urs - Proxy to URS Matcher Service
// ============================================================================

router.post('/match-urs', async (req, res) => {
  try {
    const { otskp_code, otskp_name, otskp_mj, quantity } = req.body;

    if (!otskp_code) {
      return res.status(400).json({ error: 'Missing "otskp_code"' });
    }

    const response = await fetch(`${URS_MATCHER_URL}/api/pipeline/match-by-otskp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otskp_code, otskp_name, otskp_mj, quantity }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: `URS Matcher error: ${errText}`,
      });
    }

    const result = await response.json();
    return res.json(result);

  } catch (error) {
    logger.error(`URS match proxy error: ${error.message}`);
    return res.status(502).json({
      error: `URS Matcher unavailable: ${error.message}`,
    });
  }
});


// ============================================================================
// PUT /api/soupis/:projectId/item/:itemId - Update URS code for item
// ============================================================================

router.put('/:projectId/item/:itemId', async (req, res) => {
  try {
    const { projectId, itemId } = req.params;
    const { code_urs, urs_name, urs_confidence } = req.body;

    await ensureSoupisTable();

    const result = db.prepare(`
      UPDATE soupis_items
      SET code_urs = ?, urs_name = ?, urs_confidence = ?, updated_at = datetime('now')
      WHERE project_id = ? AND item_id = ?
    `).run(code_urs || null, urs_name || null, urs_confidence || null, projectId, itemId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    return res.json({ success: true, updated: result.changes });
  } catch (error) {
    logger.error(`PUT soupis item error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});


// ============================================================================
// DELETE /api/soupis/:projectId - Delete all soupis items
// ============================================================================

router.delete('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    await ensureSoupisTable();

    const result = db.prepare(
      'DELETE FROM soupis_items WHERE project_id = ?'
    ).run(projectId);

    return res.json({ success: true, deleted: result.changes });
  } catch (error) {
    logger.error(`DELETE soupis error: ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});


// ============================================================================
// HELPERS
// ============================================================================

let tableEnsured = false;

async function ensureSoupisTable() {
  if (tableEnsured) return;

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS soupis_items (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        project_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        chapter TEXT,
        code_otskp TEXT,
        code_urs TEXT,
        urs_name TEXT,
        urs_confidence REAL,
        description TEXT NOT NULL,
        specification TEXT,
        unit TEXT NOT NULL,
        quantity REAL,
        unit_price REAL,
        total_price REAL,
        quantity_status TEXT DEFAULT 'OK',
        confidence REAL DEFAULT 1.00,
        source_param TEXT,
        is_composite INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec('CREATE INDEX IF NOT EXISTS idx_soupis_project ON soupis_items(project_id)');
    tableEnsured = true;
  } catch (e) {
    // Table might already exist
    tableEnsured = true;
  }
}

export default router;
