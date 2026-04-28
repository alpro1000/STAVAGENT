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
          valuesClauses.push(`(gen_random_uuid(), $${b+1}, $${b+2}, $${b+3}, $${b+4}, $${b+5}, $${b+6}, $${b+7}, $${b+8}, $${b+9}, NOW(), NOW())`);
          params.push(
            `pos_${uuidv4()}`, dbObjectId,
            pos.kod || '', pos.popis || '', pos.mnozstvi || 0, pos.mj || '',
            pos.cena_jednotkova || 0, pos.cena_celkem || 0,
            pos.monolith_payload ? JSON.stringify(pos.monolith_payload) : null
          );
        }
        await client.query(
          `INSERT INTO portal_positions (
            position_instance_id, position_id, object_id, kod, popis, mnozstvi, mj,
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
          valuesClauses.push(`(gen_random_uuid(), ${Array.from({length: colCount}, (_, k) => `$${b+k+1}`).join(', ')}, 'monolit', NOW(), 'monolit_import', 'monolit_import', NOW(), NOW())`);
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
            position_instance_id,
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
router.post('/import-from-registry', requireAuth, async (req, res) => {
  // requireAuth populates req.user from a Bearer JWT. Without a valid
  // JWT this returns 401 before we ever touch the database — Registry
  // anonymous syncs are no longer accepted (used to silently insert
  // with owner_id=1, leaving projects orphaned + invisible to the
  // logged-in user in /portal Projekty).
  console.log('[Integration] POST /import-from-registry - Request received from user', req.user?.userId);

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
        // owner_id pulled from the authenticated user's JWT (req.user.userId).
        // Was hardcoded to 1 — that left every Registry-imported project
        // owned by user_id=1, which is invisible to any logged-in user
        // whose own user_id ≠ 1. ON CONFLICT only updates project_name +
        // updated_at; owner_id of an existing project is preserved (so a
        // re-import doesn't change ownership of someone else's project).
        `INSERT INTO portal_projects (portal_project_id, project_name, project_type, owner_id, created_at, updated_at)
         VALUES ($1, $2, 'registry', $3, NOW(), NOW())
         ON CONFLICT (portal_project_id) DO UPDATE SET project_name = $2, updated_at = NOW()`,
        [projectId, project_name, req.user.userId]
      );
    } else {
      // UPSERT — the portal_project_id may be stale (from localStorage after a DB reset).
      // Using INSERT ... ON CONFLICT ensures the project row exists before kiosk_links FK insert.
      await client.query(
        // owner_id pulled from the authenticated user's JWT (req.user.userId).
        // Was hardcoded to 1 — that left every Registry-imported project
        // owned by user_id=1, which is invisible to any logged-in user
        // whose own user_id ≠ 1. ON CONFLICT only updates project_name +
        // updated_at; owner_id of an existing project is preserved (so a
        // re-import doesn't change ownership of someone else's project).
        `INSERT INTO portal_projects (portal_project_id, project_name, project_type, owner_id, created_at, updated_at)
         VALUES ($1, $2, 'registry', $3, NOW(), NOW())
         ON CONFLICT (portal_project_id) DO UPDATE SET project_name = $2, updated_at = NOW()`,
        [projectId, project_name, req.user.userId]
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
        // owner_id pulled from the authenticated user's JWT (req.user.userId).
        // Was hardcoded to 1 — that left every Registry-imported project
        // owned by user_id=1, which is invisible to any logged-in user
        // whose own user_id ≠ 1. ON CONFLICT only updates project_name +
        // updated_at; owner_id of an existing project is preserved (so a
        // re-import doesn't change ownership of someone else's project).
        `INSERT INTO portal_projects (portal_project_id, project_name, project_type, owner_id, created_at, updated_at)
         VALUES ($1, $2, 'registry', $3, NOW(), NOW())
         ON CONFLICT (portal_project_id) DO UPDATE SET project_name = $2, updated_at = NOW()`,
        [projectId, project_name, req.user.userId]
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
    const insertErrors = []; // Accumulate per-item insert failures for partial success response

    // Phase 1: Create objects and collect all items for batch processing
    const allItems = [];
    for (const sheet of sheets) {
      const objectId = `obj_${uuidv4()}`;
      const sheetCode = (sheet.name || 'Sheet').toString().slice(0, 100); // VARCHAR(100) limit
      const objResult = await client.query(
        `INSERT INTO portal_objects (object_id, portal_project_id, object_code, object_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (portal_project_id, object_code) DO UPDATE SET object_name = $4, updated_at = NOW()
         RETURNING object_id`,
        [objectId, projectId, sheetCode, sheetCode]
      );
      if (!objResult.rows[0]?.object_id) {
        const errMsg = `Failed to create/get object for sheet "${sheet.name}" — no object_id returned`;
        console.error(`[Integration] ${errMsg}`);
        insertErrors.push({ sheet: sheet.name, error: errMsg });
        continue; // Skip this sheet, don't fail entire sync (partial success)
      }
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
      // === BASIC INSERT path (no extended columns) ===
      // Per-item try/catch for partial success — one bad row doesn't kill the batch
      for (const entry of allItems) {
        const { item, dbObjectId } = entry;
        if (!dbObjectId) {
          insertErrors.push({ kod: item.kod, error: 'Missing object_id (sheet create failed)' });
          continue;
        }
        await client.query('SAVEPOINT insert_row_basic');
        try {
          await client.query(
            `INSERT INTO portal_positions (
              position_instance_id, position_id, object_id, kod, popis, mnozstvi, mj,
              cena_jednotkova, cena_celkem,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
            [
              uuidv4(),                                   // position_instance_id — explicit UUID
              `pos_${uuidv4()}`,                          // position_id — explicit UUID
              dbObjectId,
              (item.kod || '').toString().slice(0, 50),   // kod VARCHAR(50) NOT NULL
              (item.popis || '').toString(),              // popis TEXT NOT NULL
              Number(item.mnozstvi) || 0,
              (item.mj || '').toString().slice(0, 20),
              item.cenaJednotkova != null ? Number(item.cenaJednotkova) : null,
              item.cenaCelkem != null ? Number(item.cenaCelkem) : null,
            ]
          );
          await client.query('RELEASE SAVEPOINT insert_row_basic');
          totalItems++;
        } catch (insertErr) {
          await client.query('ROLLBACK TO SAVEPOINT insert_row_basic').catch(() => {});
          console.warn(`[Integration] Basic INSERT failed for ${item.kod}: ${insertErr.message}`);
          insertErrors.push({
            kod: item.kod,
            stage: 'insert_basic',
            error: insertErr.message,
            code: insertErr.code,
            column: insertErr.column,
          });
        }
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
      // Each UPDATE runs inside its own SAVEPOINT so one bad row (e.g. skupina
      // exceeding VARCHAR(50), row_index out of range, FK drift) does not
      // abort the outer transaction and cascade "current transaction is
      // aborted" errors across every subsequent INSERT. The row is logged
      // as a partial-success failure and sync continues.
      for (const { item, itemTov, dovPayload, dbObjectId, sheetName, itemIdx, existingRow, registryItemId } of toUpdate) {
        await client.query('SAVEPOINT update_row');
        try {
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
                (item.kod || '').toString().slice(0, 100),
                item.popis || '',
                item.mnozstvi || 0,
                (item.mj || '').toString().slice(0, 50),
                item.cenaJednotkova || 0, item.cenaCelkem || 0,
                JSON.stringify(itemTov.labor || []),
                JSON.stringify(itemTov.machinery || []),
                JSON.stringify(itemTov.materials || []),
                dovPayload,
                (sheetName || '').toString().slice(0, 255),
                Number.isFinite(itemIdx) ? itemIdx : 0,
                item.skupina ? item.skupina.toString().slice(0, 50) : null,
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
                (item.kod || '').toString().slice(0, 100),
                item.popis || '',
                item.mnozstvi || 0,
                (item.mj || '').toString().slice(0, 50),
                item.cenaJednotkova || 0, item.cenaCelkem || 0,
                JSON.stringify(itemTov.labor || []),
                JSON.stringify(itemTov.machinery || []),
                JSON.stringify(itemTov.materials || []),
                existingRow.position_id
              ]
            );
          }
          await client.query('RELEASE SAVEPOINT update_row');
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
        } catch (updateErr) {
          await client.query('ROLLBACK TO SAVEPOINT update_row').catch(() => {});
          console.warn(`[Integration] UPDATE failed for ${registryItemId || item.kod}: ${updateErr.message}`);
          insertErrors.push({
            registry_item_id: registryItemId,
            kod: item.kod,
            stage: 'update',
            error: updateErr.message,
            code: updateErr.code,
            column: updateErr.column,
          });
        }
      }

      // Step 4: Batch INSERT new positions (with per-item error handling)
      if (hasPhase8Columns) {
        for (const entry of toInsert) {
          const { item, itemTov, dovPayload, dbObjectId, sheetName, itemIdx, registryItemId } = entry;
          if (!dbObjectId) {
            insertErrors.push({ registry_item_id: registryItemId, kod: item.kod, error: 'Missing object_id' });
            continue;
          }
          await client.query('SAVEPOINT insert_row');
          try {
            const result = await client.query(
              `INSERT INTO portal_positions (
                position_instance_id,
                position_id, object_id, kod, popis, mnozstvi, mj,
                cena_jednotkova, cena_celkem,
                tov_labor, tov_machinery, tov_materials,
                dov_payload,
                registry_item_id,
                sheet_name, row_index, skupina,
                last_sync_from, last_sync_at,
                created_by, updated_by,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'registry', NOW(), 'registry_import', 'registry_import', NOW(), NOW())
              RETURNING position_instance_id`,
              [
                uuidv4(),                                    // position_instance_id — explicit UUID
                `pos_${uuidv4()}`,                           // position_id
                dbObjectId,
                (item.kod || '').toString().slice(0, 100),   // VARCHAR(100)
                (item.popis || '').toString(),               // TEXT
                Number(item.mnozstvi) || 0,
                (item.mj || '').toString().slice(0, 50),     // VARCHAR(50)
                item.cenaJednotkova != null ? Number(item.cenaJednotkova) : null,
                item.cenaCelkem != null ? Number(item.cenaCelkem) : null,
                JSON.stringify(itemTov.labor || []),
                JSON.stringify(itemTov.machinery || []),
                JSON.stringify(itemTov.materials || []),
                dovPayload,
                registryItemId,
                (sheetName || '').toString().slice(0, 255),
                Number.isFinite(itemIdx) ? itemIdx : 0,
                item.skupina ? item.skupina.toString().slice(0, 50) : null,
              ]
            );
            await client.query('RELEASE SAVEPOINT insert_row');
            totalItems++;
            if (registryItemId && result.rows[0]?.position_instance_id) {
              instanceMapping.push({
                registry_item_id: registryItemId,
                position_instance_id: result.rows[0].position_instance_id,
              });
            }
          } catch (insertErr) {
            await client.query('ROLLBACK TO SAVEPOINT insert_row').catch(() => {});
            console.warn(`[Integration] Failed to insert position ${registryItemId || item.kod}: ${insertErr.message}`);
            insertErrors.push({
              registry_item_id: registryItemId,
              kod: item.kod,
              stage: 'insert',
              error: insertErr.message,
              code: insertErr.code,
              column: insertErr.column,
            });
          }
        }
      } else {
        // Fallback: per-item INSERT for partial success (no phase8 columns)
        for (const entry of toInsert) {
          const { item, itemTov, dbObjectId, registryItemId } = entry;
          if (!dbObjectId) {
            insertErrors.push({ registry_item_id: registryItemId, kod: item.kod, error: 'Missing object_id' });
            continue;
          }
          await client.query('SAVEPOINT insert_row_fallback');
          try {
            const result = await client.query(
              `INSERT INTO portal_positions (
                position_instance_id,
                position_id, object_id, kod, popis, mnozstvi, mj,
                cena_jednotkova, cena_celkem,
                tov_labor, tov_machinery, tov_materials,
                registry_item_id, last_sync_from, last_sync_at,
                created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'registry', NOW(), NOW(), NOW())
              RETURNING position_instance_id`,
              [
                uuidv4(),                                    // position_instance_id — explicit UUID
                `pos_${uuidv4()}`,                           // position_id
                dbObjectId,
                (item.kod || '').toString().slice(0, 100),
                (item.popis || '').toString(),
                Number(item.mnozstvi) || 0,
                (item.mj || '').toString().slice(0, 50),
                item.cenaJednotkova != null ? Number(item.cenaJednotkova) : null,
                item.cenaCelkem != null ? Number(item.cenaCelkem) : null,
                JSON.stringify(itemTov.labor || []),
                JSON.stringify(itemTov.machinery || []),
                JSON.stringify(itemTov.materials || []),
                registryItemId,
              ]
            );
            await client.query('RELEASE SAVEPOINT insert_row_fallback');
            totalItems++;
            if (registryItemId && result.rows[0]?.position_instance_id) {
              instanceMapping.push({
                registry_item_id: registryItemId,
                position_instance_id: result.rows[0].position_instance_id,
              });
            }
          } catch (insertErr) {
            await client.query('ROLLBACK TO SAVEPOINT insert_row_fallback').catch(() => {});
            console.warn(`[Integration] Fallback INSERT failed for ${registryItemId || item.kod}: ${insertErr.message}`);
            insertErrors.push({
              registry_item_id: registryItemId,
              kod: item.kod,
              stage: 'insert_fallback',
              error: insertErr.message,
              code: insertErr.code,
              column: insertErr.column,
            });
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
    const failedCount = insertErrors.length;
    console.log(`[Integration] Registry sync complete: ${projectId}, ${sheets.length} sheets, ${newItems} new + ${updatedItems} updated = ${totalItems} total, ${failedCount} failed, ${instanceMapping.length} instance mappings`);

    res.json({
      success: true,
      portal_project_id: projectId,
      sheets_imported: sheets.length,
      items_imported: newItems,
      items_updated: updatedItems,
      items_total: totalItems,
      // Partial success report
      synced: totalItems,
      failed: failedCount,
      errors: insertErrors.slice(0, 50), // cap to avoid huge responses
      instance_mapping: instanceMapping,
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    // Phase 4 (2026-04-15): unwrap the generic catch. PostgreSQL error
    // codes (https://www.postgresql.org/docs/current/errcodes-appendix.html)
    // let us return a meaningful HTTP status + actionable message
    // instead of the opaque 500 that Registry frontend surfaced as
    // "Portal backend 500 — import selhal" with no context.
    //
    // Mapping:
    //   23505 unique_violation       → 409 Conflict (duplicate key)
    //   23503 foreign_key_violation  → 400 Bad Request (stale parent)
    //   23502 not_null_violation     → 400 Bad Request (missing required field)
    //   22P02 invalid_text_rep.      → 400 Bad Request (bad UUID / int)
    //   42P01 undefined_table        → 500 (schema drift — our bug)
    //   anything else                → 500 with original message logged
    const pgCode = error.code || null;
    const pgDetail = error.detail || null;
    const pgConstraint = error.constraint || null;
    const pgTable = error.table || null;
    const pgColumn = error.column || null;

    // Always log the full error server-side so debugging is possible.
    // Previously we only logged error.message which hid the pg code.
    console.error('[Integration] Error importing from Registry:', {
      message: error.message,
      code: pgCode,
      detail: pgDetail,
      constraint: pgConstraint,
      table: pgTable,
      column: pgColumn,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'),
    });

    let httpStatus = 500;
    let publicMessage = error.message || 'Unknown error';
    let errorType = 'internal_error';

    if (pgCode === '23505') {
      httpStatus = 409;
      errorType = 'conflict';
      publicMessage = pgConstraint
        ? `Duplicate entry — constraint "${pgConstraint}" already has this value. ` +
          `This usually means the Registry project was imported twice in quick succession. ` +
          `Retry should succeed now.`
        : 'Duplicate entry (unique constraint violation).';
    } else if (pgCode === '23503') {
      httpStatus = 400;
      errorType = 'foreign_key';
      publicMessage = pgConstraint
        ? `Parent row missing for constraint "${pgConstraint}". ` +
          `Check that the referenced project/user exists.`
        : 'Parent row missing (foreign key violation).';
    } else if (pgCode === '23502') {
      httpStatus = 400;
      errorType = 'missing_field';
      publicMessage = pgColumn
        ? `Required field "${pgColumn}" is missing${pgTable ? ` on table ${pgTable}` : ''}.`
        : 'Required field missing.';
    } else if (pgCode === '22P02') {
      httpStatus = 400;
      errorType = 'invalid_format';
      publicMessage = 'Invalid data format (e.g. malformed UUID or integer).';
    } else if (pgCode === '42P01') {
      httpStatus = 500;
      errorType = 'schema_drift';
      publicMessage = pgDetail || 'Database schema mismatch — table not found.';
    }

    res.status(httpStatus).json({
      success: false,
      error: publicMessage,
      error_type: errorType,
      error_code: pgCode,
      constraint: pgConstraint,
      table: pgTable,
      column: pgColumn,
      synced: 0,
      failed: 0,
      errors: [],
    });
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

/**
 * GET /api/integration/list-registry-projects
 * List all Portal projects linked to Registry (for Monolit "Načíst z Rozpočtu" modal).
 * PUBLIC endpoint — no auth required (cross-kiosk communication pattern).
 * Scoped by kiosk_type='registry' in kiosk_links (intrinsic filter, not user-based).
 */
router.get('/list-registry-projects', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.json({ success: true, projects: [] });
  }

  try {
    // Get all projects that have a Registry kiosk link (regardless of owner).
    // This is cross-kiosk data, not user-scoped.
    const result = await pool.query(
      `SELECT
         pp.portal_project_id,
         pp.project_name,
         pp.project_type,
         pp.updated_at,
         kl.kiosk_project_id AS registry_project_id,
         kl.last_sync,
         (SELECT COUNT(*)::int FROM portal_positions pop
          JOIN portal_objects po ON pop.object_id = po.object_id
          WHERE po.portal_project_id = pp.portal_project_id) AS positions_total,
         (SELECT COUNT(*)::int FROM portal_positions pop
          JOIN portal_objects po ON pop.object_id = po.object_id
          WHERE po.portal_project_id = pp.portal_project_id
            AND pop.registry_item_id IS NOT NULL) AS registry_linked
       FROM portal_projects pp
       INNER JOIN kiosk_links kl
         ON pp.portal_project_id = kl.portal_project_id
         AND kl.kiosk_type = 'registry'
         AND kl.status != 'deleted'
       ORDER BY pp.updated_at DESC`
    );

    const projects = result.rows.map(r => ({
      portal_project_id: r.portal_project_id,
      project_name: r.project_name,
      project_type: r.project_type,
      registry_project_id: r.registry_project_id,
      positions_total: r.positions_total || 0,
      registry_linked: r.registry_linked || 0,
      updated_at: r.updated_at,
      last_sync: r.last_sync,
      source: 'portal',
    }));

    res.json({ success: true, projects });
  } catch (error) {
    console.error('[Integration] Error listing registry projects:', error.message);
    res.json({ success: true, projects: [], error: error.message });
  }
});

export default router;
