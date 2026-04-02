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
const BATCH_SIZE = 200;

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

    // Check if Migration 005 columns exist (tov_labor, monolit_position_id, etc.)
    // Use information_schema to avoid aborting the transaction on missing columns.
    let hasExtendedColumns = true;
    try {
      const colCheck = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'portal_positions' AND column_name = 'monolit_position_id'`
      );
      hasExtendedColumns = colCheck.rows.length > 0;
      if (!hasExtendedColumns) {
        console.warn('[Integration] Migration 005 columns not yet applied — using basic INSERT for Monolit import');
      }
    } catch (colErr) {
      hasExtendedColumns = false;
      console.warn('[Integration] Could not check Migration 005 columns:', colErr.message);
    }

    // Import objects — collect positions for batch processing
    console.log('[Integration] Importing', objects.length, 'objects');
    const allPositions = [];
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
      for (let posIdx = 0; posIdx < (obj.positions || []).length; posIdx++) {
        allPositions.push({ pos: obj.positions[posIdx], dbObjectId, objCode: obj.code || '', posIdx });
      }
    }

    // Batch INSERT/UPDATE positions (N positions → ~N/BATCH_SIZE queries instead of N)
    if (!hasExtendedColumns) {
      // === BATCH INSERT: basic fallback (no extended columns) ===
      for (let i = 0; i < allPositions.length; i += BATCH_SIZE) {
        const batch = allPositions.slice(i, i + BATCH_SIZE);
        const params = [];
        const valuesClauses = [];
        for (let j = 0; j < batch.length; j++) {
          const { pos, dbObjectId } = batch[j];
          const b = j * 9;
          valuesClauses.push(`($${b+1}, $${b+2}, $${b+3}, $${b+4}, $${b+5}, $${b+6}, $${b+7}, $${b+8}, $${b+9}, NOW(), NOW())`);
          params.push(
            `pos_${uuidv4()}`, dbObjectId,
            pos.kod || '', pos.popis || '', pos.mnozstvi || 0, pos.mj || '',
            pos.cena_jednotkova || 0, pos.cena_celkem || 0,
            pos.monolith_payload ? JSON.stringify(pos.monolith_payload) : null
          );
        }
        await client.query(
          `INSERT INTO portal_positions (
            position_id, object_id, kod, popis, mnozstvi, mj,
            cena_jednotkova, cena_celkem, monolith_payload,
            created_at, updated_at
          ) VALUES ${valuesClauses.join(', ')}`,
          params
        );
      }
    } else {
      // === BATCH UPSERT: extended columns available ===

      // Step 1: Batch-check existing positions by monolit_position_id (1 query instead of N)
      const monolitIds = allPositions.filter(p => p.pos.monolit_id).map(p => p.pos.monolit_id);
      const existingMap = new Map();
      if (monolitIds.length > 0) {
        const existing = await client.query(
          `SELECT pp.position_instance_id, pp.monolit_position_id
           FROM portal_positions pp
           JOIN portal_objects po ON pp.object_id = po.object_id
           WHERE po.portal_project_id = $1 AND pp.monolit_position_id = ANY($2::text[])`,
          [projectId, monolitIds]
        );
        for (const row of existing.rows) {
          existingMap.set(row.monolit_position_id, row);
        }
      }

      // Step 2: Separate into UPDATE (existing) and INSERT (new)
      const toUpdate = [];
      const toInsert = [];
      for (const entry of allPositions) {
        if (entry.pos.monolit_id && existingMap.has(entry.pos.monolit_id)) {
          toUpdate.push({ ...entry, existingRow: existingMap.get(entry.pos.monolit_id) });
        } else {
          toInsert.push(entry);
        }
      }

      // Step 3: UPDATE existing positions (individual — preserves position_instance_id)
      for (const { pos, dbObjectId, objCode, posIdx, existingRow } of toUpdate) {
        const result = await client.query(
          `UPDATE portal_positions
           SET object_id = $1, kod = $2, popis = $3, mnozstvi = $4, mj = $5,
               cena_jednotkova = $6, cena_celkem = $7,
               tov_labor = $8, tov_machinery = $9, tov_materials = $10,
               monolith_payload = COALESCE($11, monolith_payload),
               sheet_name = $12, row_index = $13,
               last_sync_from = 'monolit', last_sync_at = NOW(),
               updated_by = 'monolit_import', updated_at = NOW()
           WHERE position_instance_id = $14
           RETURNING position_instance_id`,
          [
            dbObjectId,
            pos.kod || '', pos.popis || '', pos.mnozstvi || 0, pos.mj || '',
            pos.cena_jednotkova || 0, pos.cena_celkem || 0,
            JSON.stringify(pos.tov?.labor || []),
            JSON.stringify(pos.tov?.machinery || []),
            JSON.stringify(pos.tov?.materials || []),
            pos.monolith_payload ? JSON.stringify(pos.monolith_payload) : null,
            objCode, posIdx,
            existingRow.position_instance_id
          ]
        );
        if (result.rows[0]?.position_instance_id) {
          instanceMapping.push({
            monolit_id: pos.monolit_id,
            position_instance_id: result.rows[0].position_instance_id
          });
        }
      }

      // Step 4: Batch INSERT new positions
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const params = [];
        const valuesClauses = [];
        const colCount = 15;
        for (let j = 0; j < batch.length; j++) {
          const { pos, dbObjectId, objCode, posIdx } = batch[j];
          const b = j * colCount;
          valuesClauses.push(`(${Array.from({length: colCount}, (_, k) => `$${b+k+1}`).join(', ')}, 'monolit', NOW(), 'monolit_import', 'monolit_import', NOW(), NOW())`);
          params.push(
            `pos_${uuidv4()}`, dbObjectId,
            pos.kod || '', pos.popis || '', pos.mnozstvi || 0, pos.mj || '',
            pos.cena_jednotkova || 0, pos.cena_celkem || 0,
            JSON.stringify(pos.tov?.labor || []),
            JSON.stringify(pos.tov?.machinery || []),
            JSON.stringify(pos.tov?.materials || []),
            pos.monolith_payload ? JSON.stringify(pos.monolith_payload) : null,
            pos.monolit_id || null,
            objCode, posIdx
          );
        }
        const result = await client.query(
          `INSERT INTO portal_positions (
            position_id, object_id, kod, popis, mnozstvi, mj,
            cena_jednotkova, cena_celkem,
            tov_labor, tov_machinery, tov_materials,
            monolith_payload,
            monolit_position_id, last_sync_from, last_sync_at,
            sheet_name, row_index, created_by, updated_by,
            created_at, updated_at
          ) VALUES ${valuesClauses.join(', ')}
          RETURNING position_instance_id`,
          params
        );
        // RETURNING order matches VALUES order for INSERT
        for (let j = 0; j < batch.length; j++) {
          const { pos } = batch[j];
          if (pos.monolit_id && result.rows[j]?.position_instance_id) {
            instanceMapping.push({
              monolit_id: pos.monolit_id,
              position_instance_id: result.rows[j].position_instance_id
            });
          }
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
    if (client) await client.query('ROLLBACK').catch(() => {});
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
          labor: pos.tov_labor ? (typeof pos.tov_labor === 'object' ? pos.tov_labor : JSON.parse(pos.tov_labor)) : [],
          machinery: pos.tov_machinery ? (typeof pos.tov_machinery === 'object' ? pos.tov_machinery : JSON.parse(pos.tov_machinery)) : [],
          materials: pos.tov_materials ? (typeof pos.tov_materials === 'object' ? pos.tov_materials : JSON.parse(pos.tov_materials)) : []
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
      client.release();
      return res.status(400).json({ success: false, error: 'Invalid request body' });
    }

    // Check project exists (no auth check)
    const projectCheck = await client.query(
      'SELECT portal_project_id FROM portal_projects WHERE portal_project_id = $1',
      [portal_project_id]
    );

    if (projectCheck.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Check if Migration 005 columns exist
    let hasTovColumns = true;
    try {
      await client.query('SELECT tov_labor FROM portal_positions LIMIT 0');
    } catch (colErr) {
      if (colErr.message && colErr.message.includes('column')) {
        hasTovColumns = false;
      } else {
        throw colErr;
      }
    }

    if (!hasTovColumns) {
      client.release();
      return res.status(503).json({
        success: false,
        error: 'TOV columns not yet migrated. Run Migration 005 (schema-postgres.sql).'
      });
    }

    await client.query('BEGIN');

    // Batch UPDATE TOV data (N updates → ~N/BATCH_SIZE queries instead of N)
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      const params = [];
      const valuesClauses = [];
      for (let j = 0; j < batch.length; j++) {
        const update = batch[j];
        const b = j * 4;
        const casts = j === 0 ? ['::text', '::jsonb', '::jsonb', '::jsonb'] : ['', '', '', ''];
        valuesClauses.push(`($${b+1}${casts[0]}, $${b+2}${casts[1]}, $${b+3}${casts[2]}, $${b+4}${casts[3]})`);
        params.push(
          update.position_id,
          JSON.stringify(update.tovData.labor || []),
          JSON.stringify(update.tovData.machinery || []),
          JSON.stringify(update.tovData.materials || [])
        );
      }
      await client.query(
        `UPDATE portal_positions pp
         SET tov_labor = v.tov_labor,
             tov_machinery = v.tov_machinery,
             tov_materials = v.tov_materials,
             last_sync_from = 'registry',
             last_sync_at = NOW(),
             updated_at = NOW()
         FROM (VALUES ${valuesClauses.join(', ')}) AS v(position_id, tov_labor, tov_machinery, tov_materials)
         WHERE pp.position_id = v.position_id`,
        params
      );
    }

    await client.query('COMMIT');

    console.log(`[Integration] Synced TOV data: ${updates.length} positions`);

    res.json({
      success: true,
      positions_updated: updates.length
    });

  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
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

    // If no portal_project_id provided, check if registry project already has a portal link
    if (!projectId && registry_project_id) {
      const existingLink = await client.query(
        `SELECT portal_project_id FROM kiosk_links WHERE kiosk_project_id = $1 AND kiosk_type = 'registry' LIMIT 1`,
        [registry_project_id]
      );
      if (existingLink.rows.length > 0) {
        projectId = existingLink.rows[0].portal_project_id;
        console.log('[Integration] Reusing existing portal link for registry project:', projectId);
      }
    }

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
      // UPSERT — the portal_project_id may be stale (from localStorage after a DB reset).
      // Using INSERT ... ON CONFLICT ensures the project row exists before kiosk_links FK insert.
      await client.query(
        `INSERT INTO portal_projects (portal_project_id, project_name, project_type, owner_id, created_at, updated_at)
         VALUES ($1, $2, 'registry', 1, NOW(), NOW())
         ON CONFLICT (portal_project_id) DO UPDATE SET project_name = $2, updated_at = NOW()`,
        [projectId, project_name]
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

    // UPSERT strategy: preserve position_instance_id for cross-kiosk linking
    // Instead of DELETE+INSERT (which regenerates all UUIDs), we:
    // 1. Get/create objects for each sheet
    // 2. UPSERT positions by registry_item_id (preserves position_instance_id)
    // 3. Clean up positions that no longer exist in incoming data

    // Helper: re-ensure portal_project and kiosk_link rows exist after a ROLLBACK+BEGIN.
    // ROLLBACK discards ALL prior statements in the transaction — including the portal_projects
    // UPSERT done above — causing FK constraint failures when portal_objects is inserted later.
    const reEnsureProjectRows = async () => {
      await client.query(
        `INSERT INTO portal_projects (portal_project_id, project_name, project_type, owner_id, created_at, updated_at)
         VALUES ($1, $2, 'registry', 1, NOW(), NOW())
         ON CONFLICT (portal_project_id) DO UPDATE SET project_name = $2, updated_at = NOW()`,
        [projectId, project_name]
      );
      if (registry_project_id) {
        await client.query(
          `INSERT INTO kiosk_links (link_id, portal_project_id, kiosk_type, kiosk_project_id, status, created_at, last_sync)
           VALUES ($1, $2, 'registry', $3, 'active', NOW(), NOW())
           ON CONFLICT (portal_project_id, kiosk_type) DO UPDATE SET kiosk_project_id = $3, last_sync = NOW(), status = 'active'`,
          [`link_${uuidv4()}`, projectId, registry_project_id]
        );
      }
    };

    // Check if Migration 005 columns exist (registry_item_id, tov_labor, etc.)
    // Use information_schema to avoid aborting the transaction on missing columns.
    let hasRegistrySyncColumns = true;
    try {
      const colCheck = await client.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'portal_positions' AND column_name = 'registry_item_id'`
      );
      hasRegistrySyncColumns = colCheck.rows.length > 0;
      if (!hasRegistrySyncColumns) {
        console.warn('[Integration] Migration 005 columns not yet applied — using basic INSERT (no TOV/registry_item_id)');
      }
    } catch (colErr) {
      hasRegistrySyncColumns = false;
      console.warn('[Integration] Could not check Migration 005 columns:', colErr.message);
    }

    // Check if Phase 8 columns exist (sheet_name, row_index, skupina, dov_payload, created_by)
    let hasPhase8Columns = hasRegistrySyncColumns;
    if (hasRegistrySyncColumns) {
      try {
        const colCheck8 = await client.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_name = 'portal_positions' AND column_name = 'sheet_name'`
        );
        hasPhase8Columns = colCheck8.rows.length > 0;
        if (!hasPhase8Columns) {
          console.warn('[Integration] Phase 8 columns (sheet_name) not yet applied — using fallback INSERT');
        }
      } catch (colErr) {
        hasPhase8Columns = false;
        console.warn('[Integration] Could not check Phase 8 columns:', colErr.message);
      }
    }

    let totalItems = 0;
    let updatedItems = 0;
    const instanceMapping = [];
    const allIncomingRegistryItemIds = [];

    // Phase 1: Create objects and collect all items for batch processing
    const allItems = [];
    for (const sheet of sheets) {
      const objectId = `obj_${uuidv4()}`;
      const objResult = await client.query(
        `INSERT INTO portal_objects (object_id, portal_project_id, object_code, object_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (portal_project_id, object_code) DO UPDATE SET object_name = $4, updated_at = NOW()
         RETURNING object_id`,
        [objectId, projectId, sheet.name || 'Sheet', sheet.name || 'Sheet']
      );
      const dbObjectId = objResult.rows[0].object_id;

      for (let itemIdx = 0; itemIdx < (sheet.items || []).length; itemIdx++) {
        const item = sheet.items[itemIdx];
        const registryItemId = item.id || null;
        if (registryItemId) allIncomingRegistryItemIds.push(registryItemId);

        const itemTov = (tovData && tovData[item.id]) || {};
        const hasTovData = itemTov.labor || itemTov.machinery || itemTov.materials || itemTov.formworkRental || itemTov.pumpRental;
        const dovPayload = hasTovData ? JSON.stringify({
          labor: itemTov.labor || [],
          machinery: itemTov.machinery || [],
          materials: itemTov.materials || [],
          formwork_rental: itemTov.formworkRental || null,
          pump_rental: itemTov.pumpRental || null,
          labor_summary: itemTov.laborSummary || null,
          machinery_summary: itemTov.machinerySummary || null,
          materials_summary: itemTov.materialsSummary || null,
        }) : null;

        allItems.push({ item, registryItemId, itemTov, dovPayload, dbObjectId, sheetName: sheet.name || '', itemIdx });
      }
    }

    // Phase 2: Batch process positions
    if (!hasRegistrySyncColumns) {
      // === BATCH INSERT: basic fallback (no extended columns) ===
      for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
        const batch = allItems.slice(i, i + BATCH_SIZE);
        const params = [];
        const valuesClauses = [];
        for (let j = 0; j < batch.length; j++) {
          const { item, dbObjectId } = batch[j];
          const b = j * 8;
          valuesClauses.push(`($${b+1}, $${b+2}, $${b+3}, $${b+4}, $${b+5}, $${b+6}, $${b+7}, $${b+8}, NOW(), NOW())`);
          params.push(
            `pos_${uuidv4()}`, dbObjectId,
            item.kod || '', item.popis || '',
            item.mnozstvi || 0, item.mj || '',
            item.cenaJednotkova || 0, item.cenaCelkem || 0
          );
        }
        await client.query(
          `INSERT INTO portal_positions (
            position_id, object_id, kod, popis, mnozstvi, mj,
            cena_jednotkova, cena_celkem,
            created_at, updated_at
          ) VALUES ${valuesClauses.join(', ')}`,
          params
        );
        totalItems += batch.length;
      }
    } else {
      // === BATCH UPSERT: extended columns available ===

      // Step 1: Batch-check existing positions by registry_item_id (1 query instead of N)
      const registryIds = allItems.filter(e => e.registryItemId).map(e => e.registryItemId);
      const existingMap = new Map();
      if (registryIds.length > 0) {
        const existing = await client.query(
          `SELECT pp.position_instance_id, pp.position_id, pp.registry_item_id, pp.monolith_payload
           FROM portal_positions pp
           JOIN portal_objects po ON pp.object_id = po.object_id
           WHERE po.portal_project_id = $1 AND pp.registry_item_id = ANY($2::text[])`,
          [projectId, registryIds]
        );
        for (const row of existing.rows) {
          existingMap.set(row.registry_item_id, row);
        }
      }

      // Step 2: Classify items into UPDATE vs INSERT
      const toUpdate = [];
      const toInsert = [];
      for (const entry of allItems) {
        if (entry.registryItemId && existingMap.has(entry.registryItemId)) {
          toUpdate.push({ ...entry, existingRow: existingMap.get(entry.registryItemId) });
        } else {
          toInsert.push(entry);
        }
      }

      // Step 3: UPDATE existing positions (individual — preserves position_instance_id)
      for (const { item, itemTov, dovPayload, dbObjectId, sheetName, itemIdx, existingRow, registryItemId } of toUpdate) {
        let result;
        if (hasPhase8Columns) {
          result = await client.query(
            `UPDATE portal_positions
             SET object_id = $1, kod = $2, popis = $3, mnozstvi = $4, mj = $5,
                 cena_jednotkova = $6, cena_celkem = $7,
                 tov_labor = $8, tov_machinery = $9, tov_materials = $10,
                 dov_payload = COALESCE($11, dov_payload),
                 sheet_name = $12, row_index = $13, skupina = $14,
                 last_sync_from = 'registry', last_sync_at = NOW(),
                 updated_by = 'registry_sync', updated_at = NOW()
             WHERE position_instance_id = $15
             RETURNING position_instance_id, monolith_payload`,
            [
              dbObjectId,
              item.kod || '', item.popis || '',
              item.mnozstvi || 0, item.mj || '',
              item.cenaJednotkova || 0, item.cenaCelkem || 0,
              JSON.stringify(itemTov.labor || []),
              JSON.stringify(itemTov.machinery || []),
              JSON.stringify(itemTov.materials || []),
              dovPayload,
              sheetName, itemIdx, item.skupina || null,
              existingRow.position_instance_id
            ]
          );
        } else {
          result = await client.query(
            `UPDATE portal_positions
             SET object_id = $1, kod = $2, popis = $3, mnozstvi = $4, mj = $5,
                 cena_jednotkova = $6, cena_celkem = $7,
                 tov_labor = $8, tov_machinery = $9, tov_materials = $10,
                 last_sync_from = 'registry', last_sync_at = NOW(), updated_at = NOW()
             WHERE position_id = $11
             RETURNING position_id AS position_instance_id`,
            [
              dbObjectId,
              item.kod || '', item.popis || '',
              item.mnozstvi || 0, item.mj || '',
              item.cenaJednotkova || 0, item.cenaCelkem || 0,
              JSON.stringify(itemTov.labor || []),
              JSON.stringify(itemTov.machinery || []),
              JSON.stringify(itemTov.materials || []),
              existingRow.position_id
            ]
          );
        }
        updatedItems++;
        totalItems++;

        if (registryItemId && result.rows[0]?.position_instance_id) {
          const row = result.rows[0];
          const mapping = { registry_item_id: registryItemId, position_instance_id: row.position_instance_id };
          if (row.monolith_payload) {
            mapping.monolith_payload = typeof row.monolith_payload === 'string'
              ? JSON.parse(row.monolith_payload) : row.monolith_payload;
          }
          instanceMapping.push(mapping);
        }
      }

      // Step 4: Batch INSERT new positions
      if (hasPhase8Columns) {
        for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
          const batch = toInsert.slice(i, i + BATCH_SIZE);
          const params = [];
          const valuesClauses = [];
          const colCount = 16;
          for (let j = 0; j < batch.length; j++) {
            const { item, itemTov, dovPayload, dbObjectId, sheetName, itemIdx, registryItemId } = batch[j];
            const b = j * colCount;
            valuesClauses.push(`(${Array.from({length: colCount}, (_, k) => `$${b+k+1}`).join(', ')}, 'registry', NOW(), 'registry_import', 'registry_import', NOW(), NOW())`);
            params.push(
              `pos_${uuidv4()}`, dbObjectId,
              item.kod || '', item.popis || '',
              item.mnozstvi || 0, item.mj || '',
              item.cenaJednotkova || 0, item.cenaCelkem || 0,
              JSON.stringify(itemTov.labor || []),
              JSON.stringify(itemTov.machinery || []),
              JSON.stringify(itemTov.materials || []),
              dovPayload,
              registryItemId,
              sheetName, itemIdx, item.skupina || null
            );
          }
          const result = await client.query(
            `INSERT INTO portal_positions (
              position_id, object_id, kod, popis, mnozstvi, mj,
              cena_jednotkova, cena_celkem,
              tov_labor, tov_machinery, tov_materials,
              dov_payload,
              registry_item_id,
              sheet_name, row_index, skupina,
              last_sync_from, last_sync_at,
              created_by, updated_by,
              created_at, updated_at
            ) VALUES ${valuesClauses.join(', ')}
            RETURNING position_instance_id`,
            params
          );
          for (let j = 0; j < batch.length; j++) {
            const { registryItemId } = batch[j];
            totalItems++;
            if (registryItemId && result.rows[j]?.position_instance_id) {
              instanceMapping.push({
                registry_item_id: registryItemId,
                position_instance_id: result.rows[j].position_instance_id,
              });
            }
          }
        }
      } else {
        for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
          const batch = toInsert.slice(i, i + BATCH_SIZE);
          const params = [];
          const valuesClauses = [];
          const colCount = 12;
          for (let j = 0; j < batch.length; j++) {
            const { item, itemTov, dbObjectId, registryItemId } = batch[j];
            const b = j * colCount;
            valuesClauses.push(`(${Array.from({length: colCount}, (_, k) => `$${b+k+1}`).join(', ')}, 'registry', NOW(), NOW(), NOW())`);
            params.push(
              `pos_${uuidv4()}`, dbObjectId,
              item.kod || '', item.popis || '',
              item.mnozstvi || 0, item.mj || '',
              item.cenaJednotkova || 0, item.cenaCelkem || 0,
              JSON.stringify(itemTov.labor || []),
              JSON.stringify(itemTov.machinery || []),
              JSON.stringify(itemTov.materials || []),
              registryItemId
            );
          }
          const result = await client.query(
            `INSERT INTO portal_positions (
              position_id, object_id, kod, popis, mnozstvi, mj,
              cena_jednotkova, cena_celkem,
              tov_labor, tov_machinery, tov_materials,
              registry_item_id, last_sync_from, last_sync_at,
              created_at, updated_at
            ) VALUES ${valuesClauses.join(', ')}
            RETURNING position_id AS position_instance_id`,
            params
          );
          for (let j = 0; j < batch.length; j++) {
            const { registryItemId } = batch[j];
            totalItems++;
            if (registryItemId && result.rows[j]?.position_instance_id) {
              instanceMapping.push({
                registry_item_id: registryItemId,
                position_instance_id: result.rows[j].position_instance_id,
              });
            }
          }
        }
      }
    }

    // Clean up positions that no longer exist in incoming data
    // Only delete positions that were created by registry (have registry_item_id)
    // and are NOT in the incoming set. Preserve monolit-created positions.
    if (hasRegistrySyncColumns && allIncomingRegistryItemIds.length > 0) {
      await client.query(
        `DELETE FROM portal_positions pp
         USING portal_objects po
         WHERE pp.object_id = po.object_id
           AND po.portal_project_id = $1
           AND pp.registry_item_id IS NOT NULL
           AND pp.registry_item_id != ALL($2::text[])`,
        [projectId, allIncomingRegistryItemIds]
      );
    }

    await client.query('COMMIT');
    const newItems = totalItems - updatedItems;
    console.log(`[Integration] Registry sync complete: ${projectId}, ${sheets.length} sheets, ${newItems} new + ${updatedItems} updated = ${totalItems} total, ${instanceMapping.length} instance mappings`);

    res.json({
      success: true,
      portal_project_id: projectId,
      sheets_imported: sheets.length,
      items_imported: newItems,
      items_updated: updatedItems,
      items_total: totalItems,
      instance_mapping: instanceMapping,
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
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
