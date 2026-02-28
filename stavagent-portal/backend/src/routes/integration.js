/**
 * Portal Integration API Routes
 * 
 * Handles cross-kiosk data synchronization between Monolit-Planner and Rozpočet Registry.
 * Enables unified project structure with TOV (Rozpis zdrojů) data.
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { getPool } from '../db/postgres.js';
import { USE_POSTGRES } from '../db/index.js';

const router = express.Router();

function safeGetPool() {
  if (!USE_POSTGRES) return null;
  try {
    return getPool();
  } catch (error) {
    console.error('[Integration] Failed to get database pool:', error.message);
    return null;
  }
}

// Integration API is PUBLIC - no auth required for cross-kiosk communication
// Kiosks (Monolit, Registry) sync data without user authentication

/**
 * POST /api/integration/import-from-monolit
 * Import project data from Monolit-Planner to Portal
 * 
 * Body:
 * - portal_project_id: string (optional, creates new if not provided)
 * - project_name: string
 * - monolit_project_id: string
 * - objects: Array<{ code, name, positions[] }>
 */
router.post('/import-from-monolit', async (req, res) => {
  console.log('[Integration] POST /import-from-monolit - Request received');
  console.log('[Integration] Body:', JSON.stringify(req.body).substring(0, 200));
  
  const pool = safeGetPool();
  if (!pool) {
    console.error('[Integration] Database pool not available');
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  let client;
  try {
    client = await pool.connect();
    console.log('[Integration] Database client connected');
    
    const { portal_project_id, project_name, monolit_project_id, objects } = req.body;

    if (!project_name || !objects || !Array.isArray(objects)) {
      console.error('[Integration] Invalid request body:', { project_name, objects: Array.isArray(objects) });
      return res.status(400).json({ success: false, error: 'Invalid request body' });
    }

    await client.query('BEGIN');
    console.log('[Integration] Transaction started');

    // Track monolit_id → position_instance_id mapping (returned to Monolit for write-back)
    const instanceMapping = [];

    // Create or get portal project
    let projectId = portal_project_id;
    if (!projectId) {
      projectId = `proj_${uuidv4()}`;
      console.log('[Integration] Creating new project:', projectId);
      await client.query(
        `INSERT INTO portal_projects (portal_project_id, project_name, project_type, owner_id, created_at, updated_at)
         VALUES ($1, $2, 'monolit', 1, NOW(), NOW())`,
        [projectId, project_name]
      );
    }

    // Link to Monolit kiosk
    console.log('[Integration] Creating kiosk link');
    await client.query(
      `INSERT INTO kiosk_links (link_id, portal_project_id, kiosk_type, kiosk_project_id, status, created_at, last_sync)
       VALUES ($1, $2, 'monolit', $3, 'active', NOW(), NOW())
       ON CONFLICT (portal_project_id, kiosk_type) DO UPDATE SET kiosk_project_id = $3, last_sync = NOW()`,
      [`link_${uuidv4()}`, projectId, monolit_project_id]
    );

    // Import objects and positions
    console.log('[Integration] Importing', objects.length, 'objects');
    for (const obj of objects) {
      const objectId = `obj_${uuidv4()}`;
      const objResult = await client.query(
        `INSERT INTO portal_objects (object_id, portal_project_id, object_code, object_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (portal_project_id, object_code) DO UPDATE SET object_name = $4, updated_at = NOW()
         RETURNING object_id`,
        [objectId, projectId, obj.code, obj.name]
      );

      const dbObjectId = objResult.rows[0].object_id;

      // Import positions with TOV data + monolith_payload + position_instance_id
      for (let posIdx = 0; posIdx < (obj.positions || []).length; posIdx++) {
        const pos = obj.positions[posIdx];
        const positionId = `pos_${uuidv4()}`;
        const result = await client.query(
          `INSERT INTO portal_positions (
            position_id, object_id, kod, popis, mnozstvi, mj,
            cena_jednotkova, cena_celkem,
            tov_labor, tov_machinery, tov_materials,
            monolith_payload,
            monolit_position_id, last_sync_from, last_sync_at,
            sheet_name, row_index, created_by, updated_by,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'monolit', NOW(), $14, $15, 'monolit_import', 'monolit_import', NOW(), NOW())
          RETURNING position_instance_id`,
          [
            positionId, dbObjectId,
            pos.kod || '', pos.popis, pos.mnozstvi || 0, pos.mj || '',
            pos.cena_jednotkova || 0, pos.cena_celkem || 0,
            JSON.stringify(pos.tov?.labor || []),
            JSON.stringify(pos.tov?.machinery || []),
            JSON.stringify(pos.tov?.materials || []),
            pos.monolith_payload ? JSON.stringify(pos.monolith_payload) : null,
            pos.monolit_id,
            obj.code || '',
            posIdx
          ]
        );

        // Track mapping: monolit_id → position_instance_id (for Monolit write-back)
        if (pos.monolit_id && result.rows[0]?.position_instance_id) {
          instanceMapping.push({
            monolit_id: pos.monolit_id,
            position_instance_id: result.rows[0].position_instance_id
          });
        }
      }
    }

    await client.query('COMMIT');
    console.log('[Integration] Transaction committed successfully');

    res.json({
      success: true,
      portal_project_id: projectId,
      objects_imported: objects.length,
      instance_mapping: instanceMapping
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('[Integration] Error importing from Monolit:', error.message);
    console.error('[Integration] Stack:', error.stack);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) client.release();
  }
});

/**
 * GET /api/integration/for-registry/:portal_project_id
 * Get project data formatted for Rozpočet Registry
 * 
 * Returns:
 * - project: { name, sheets[] }
 * - items: ParsedItem[] (Registry format)
 */
router.get('/for-registry/:portal_project_id', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  try {
    const { portal_project_id } = req.params;

    // Get project (no auth check)
    const projectResult = await pool.query(
      'SELECT * FROM portal_projects WHERE portal_project_id = $1',
      [portal_project_id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // Get objects (sheets)
    const objectsResult = await pool.query(
      'SELECT * FROM portal_objects WHERE portal_project_id = $1 ORDER BY object_code',
      [portal_project_id]
    );

    // Get positions for each object
    const sheets = [];
    for (const obj of objectsResult.rows) {
      const positionsResult = await pool.query(
        'SELECT * FROM portal_positions WHERE object_id = $1',
        [obj.object_id]
      );

      const items = positionsResult.rows.map(pos => ({
        id: pos.position_id,
        position_instance_id: pos.position_instance_id,
        kod: pos.kod,
        popis: pos.popis,
        mnozstvi: pos.mnozstvi,
        mj: pos.mj,
        cenaJednotkova: pos.cena_jednotkova || 0,
        cenaCelkem: pos.cena_celkem || 0,
        skupina: pos.skupina || null,
        row_role: pos.row_role || 'unknown',
        monolith_payload: pos.monolith_payload || null,
        dov_payload: pos.dov_payload || null,
        tovData: {
          labor: pos.tov_labor ? JSON.parse(pos.tov_labor) : [],
          machinery: pos.tov_machinery ? JSON.parse(pos.tov_machinery) : [],
          materials: pos.tov_materials ? JSON.parse(pos.tov_materials) : []
        },
        source: {
          project: project.project_name,
          sheet: obj.object_code,
          row: pos.row_index || 0
        }
      }));

      sheets.push({
        name: obj.object_code,
        items
      });
    }

    res.json({
      success: true,
      project: {
        id: portal_project_id,
        name: project.project_name,
        sheets
      }
    });

  } catch (error) {
    console.error('[Integration] Error fetching for Registry:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch project data' });
  }
});

/**
 * POST /api/integration/sync-tov
 * Sync TOV data from Registry back to Portal
 * 
 * Body:
 * - portal_project_id: string
 * - updates: Array<{ position_id, tovData }>
 */
router.post('/sync-tov', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  const client = await pool.connect();
  try {
    const { portal_project_id, updates } = req.body;

    if (!portal_project_id || !updates || !Array.isArray(updates)) {
      return res.status(400).json({ success: false, error: 'Invalid request body' });
    }

    // Check project exists (no auth check)
    const projectCheck = await client.query(
      'SELECT portal_project_id FROM portal_projects WHERE portal_project_id = $1',
      [portal_project_id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    await client.query('BEGIN');

    // Update TOV data for each position
    for (const update of updates) {
      await client.query(
        `UPDATE portal_positions
         SET tov_labor = $1,
             tov_machinery = $2,
             tov_materials = $3,
             last_sync_from = 'registry',
             last_sync_at = NOW(),
             updated_at = NOW()
         WHERE position_id = $4`,
        [
          JSON.stringify(update.tovData.labor || []),
          JSON.stringify(update.tovData.machinery || []),
          JSON.stringify(update.tovData.materials || []),
          update.position_id
        ]
      );
    }

    await client.query('COMMIT');

    console.log(`[Integration] Synced TOV data: ${updates.length} positions`);

    res.json({
      success: true,
      positions_updated: updates.length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Integration] Error syncing TOV:', error);
    res.status(500).json({ success: false, error: 'Failed to sync TOV data' });
  } finally {
    client.release();
  }
});

/**
 * POST /api/integration/import-from-registry
 * Import/sync project data from Rozpočet Registry to Portal DB
 *
 * Body:
 * - registry_project_id: string (local ID in Registry)
 * - project_name: string
 * - portal_project_id: string (optional, creates new if not provided)
 * - sheets: Array<{ name, items[] }>
 * - tovData: Record<itemId, TOVData> (optional)
 *
 * Returns:
 * - portal_project_id: string
 * - items_imported: number
 */
router.post('/import-from-registry', async (req, res) => {
  console.log('[Integration] POST /import-from-registry - Request received');

  const pool = safeGetPool();
  if (!pool) {
    console.error('[Integration] Database pool not available');
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  let client;
  try {
    client = await pool.connect();
    const { registry_project_id, project_name, portal_project_id, sheets, tovData } = req.body;

    if (!project_name || !sheets || !Array.isArray(sheets)) {
      return res.status(400).json({ success: false, error: 'project_name and sheets[] required' });
    }

    await client.query('BEGIN');

    // Create or reuse portal project
    let projectId = portal_project_id;
    if (!projectId) {
      projectId = `proj_${uuidv4()}`;
      console.log('[Integration] Creating new portal project for Registry:', projectId);
      await client.query(
        `INSERT INTO portal_projects (portal_project_id, project_name, project_type, owner_id, created_at, updated_at)
         VALUES ($1, $2, 'registry', 1, NOW(), NOW())
         ON CONFLICT (portal_project_id) DO UPDATE SET project_name = $2, updated_at = NOW()`,
        [projectId, project_name]
      );
    } else {
      // Update existing project name
      await client.query(
        `UPDATE portal_projects SET project_name = $1, updated_at = NOW() WHERE portal_project_id = $2`,
        [project_name, projectId]
      );
    }

    // Link as registry kiosk
    if (registry_project_id) {
      await client.query(
        `INSERT INTO kiosk_links (link_id, portal_project_id, kiosk_type, kiosk_project_id, status, created_at, last_sync)
         VALUES ($1, $2, 'registry', $3, 'active', NOW(), NOW())
         ON CONFLICT (portal_project_id, kiosk_type) DO UPDATE SET kiosk_project_id = $3, last_sync = NOW(), status = 'active'`,
        [`link_${uuidv4()}`, projectId, registry_project_id]
      );
    }

    // Delete existing objects/positions for this project (full replace on sync)
    await client.query(
      `DELETE FROM portal_objects WHERE portal_project_id = $1`,
      [projectId]
    );

    // Import sheets as objects, items as positions
    let totalItems = 0;
    for (const sheet of sheets) {
      const objectId = `obj_${uuidv4()}`;
      await client.query(
        `INSERT INTO portal_objects (object_id, portal_project_id, object_code, object_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [objectId, projectId, sheet.name || 'Sheet', sheet.name || 'Sheet']
      );

      for (let itemIdx = 0; itemIdx < (sheet.items || []).length; itemIdx++) {
        const item = sheet.items[itemIdx];
        const positionId = `pos_${uuidv4()}`;
        // Get TOV data if available
        const itemTov = (tovData && tovData[item.id]) || {};

        await client.query(
          `INSERT INTO portal_positions (
            position_id, object_id, kod, popis, mnozstvi, mj,
            cena_jednotkova, cena_celkem,
            tov_labor, tov_machinery, tov_materials,
            registry_item_id, last_sync_from, last_sync_at,
            sheet_name, row_index, skupina,
            created_by, updated_by,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'registry', NOW(), $13, $14, $15, 'registry_import', 'registry_import', NOW(), NOW())`,
          [
            positionId, objectId,
            item.kod || '', item.popis || '',
            item.mnozstvi || 0, item.mj || '',
            item.cenaJednotkova || 0, item.cenaCelkem || 0,
            JSON.stringify(itemTov.labor || []),
            JSON.stringify(itemTov.machinery || []),
            JSON.stringify(itemTov.materials || []),
            item.id || null,
            sheet.name || '',
            itemIdx,
            item.skupina || null
          ]
        );
        totalItems++;
      }
    }

    await client.query('COMMIT');
    console.log(`[Integration] Registry import complete: ${projectId}, ${sheets.length} sheets, ${totalItems} items`);

    res.json({
      success: true,
      portal_project_id: projectId,
      sheets_imported: sheets.length,
      items_imported: totalItems
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('[Integration] Error importing from Registry:', error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (client) client.release();
  }
});

/**
 * GET /api/integration/registry-status/:registry_project_id
 * Check if a Registry project already has a portal link
 *
 * Returns:
 * - linked: boolean
 * - portal_project_id: string | null
 */
router.get('/registry-status/:registry_project_id', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.json({ linked: false, portal_project_id: null });
  }

  try {
    const { registry_project_id } = req.params;
    const result = await pool.query(
      `SELECT portal_project_id FROM kiosk_links
       WHERE kiosk_type = 'registry' AND kiosk_project_id = $1 AND status = 'active'
       LIMIT 1`,
      [registry_project_id]
    );

    if (result.rows.length > 0) {
      res.json({ linked: true, portal_project_id: result.rows[0].portal_project_id });
    } else {
      res.json({ linked: false, portal_project_id: null });
    }
  } catch (error) {
    console.error('[Integration] Error checking registry status:', error.message);
    res.json({ linked: false, portal_project_id: null });
  }
});

export default router;
