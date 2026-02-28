/**
 * Position Instances API Routes
 *
 * CRUD for PositionInstance — the single source of truth for work items.
 * Kiosks read from here, calculate, and write payloads back.
 *
 * Spec: docs/POSITION_INSTANCE_ARCHITECTURE.ts
 *
 * Endpoints:
 *   GET    /api/positions/project/:projectId           — List all instances grouped by object
 *   GET    /api/positions/:instanceId                  — Get single instance
 *   POST   /api/positions/project/:projectId/bulk      — Create instances in bulk (Excel import)
 *   PUT    /api/positions/:instanceId                  — Update instance fields
 *   DELETE /api/positions/:instanceId                  — Delete instance
 *
 *   GET    /api/positions/:instanceId/monolith         — Read monolith_payload
 *   POST   /api/positions/:instanceId/monolith         — Write monolith_payload (Monolit kiosk)
 *   GET    /api/positions/:instanceId/dov              — Read dov_payload
 *   POST   /api/positions/:instanceId/dov              — Write dov_payload (Registry kiosk)
 *
 *   POST   /api/positions/templates                    — Save instance as template
 *   GET    /api/positions/templates/:projectId         — List templates for project
 *   POST   /api/positions/templates/:templateId/apply  — Apply template to matching instances
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../db/postgres.js';
import { USE_POSTGRES } from '../db/index.js';

const router = express.Router();

function safeGetPool() {
  if (!USE_POSTGRES) return null;
  try {
    return getPool();
  } catch (error) {
    console.error('[PositionInstances] Failed to get database pool:', error.message);
    return null;
  }
}

// =============================================================================
// LIST INSTANCES BY PROJECT
// =============================================================================

/**
 * GET /api/positions/project/:projectId
 * Returns all position instances grouped by object (sheet).
 *
 * Query params:
 *   ?skupina=BETON_MONOLIT   — Filter by work group
 *   ?row_role=main            — Filter by row role
 */
router.get('/project/:projectId', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  try {
    const { projectId } = req.params;
    const { skupina, row_role } = req.query;

    // Verify project exists
    const projectResult = await pool.query(
      'SELECT portal_project_id, project_name FROM portal_projects WHERE portal_project_id = $1',
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Get objects
    const objectsResult = await pool.query(
      'SELECT * FROM portal_objects WHERE portal_project_id = $1 ORDER BY object_code',
      [projectId]
    );

    // Build filter clause
    let filterClause = '';
    const filterParams = [];
    let paramIndex = 1;

    if (skupina) {
      filterClause += ` AND pp.skupina = $${paramIndex++}`;
      filterParams.push(skupina);
    }
    if (row_role) {
      filterClause += ` AND pp.row_role = $${paramIndex++}`;
      filterParams.push(row_role);
    }

    // Get positions for each object
    const objects = [];
    let total = 0;

    for (const obj of objectsResult.rows) {
      const positionsResult = await pool.query(
        `SELECT pp.position_id, pp.position_instance_id, pp.object_id,
                pp.kod, pp.popis, pp.mnozstvi, pp.mj,
                pp.cena_jednotkova, pp.cena_celkem,
                pp.sheet_name, pp.row_index, pp.skupina, pp.row_role,
                pp.template_id, pp.template_confidence,
                pp.monolith_payload, pp.dov_payload, pp.overrides,
                pp.monolit_position_id, pp.registry_item_id,
                pp.created_by, pp.updated_by,
                pp.created_at, pp.updated_at
         FROM portal_positions pp
         WHERE pp.object_id = $${paramIndex}${filterClause}
         ORDER BY pp.row_index, pp.created_at`,
        [obj.object_id, ...filterParams]
      );

      const positions = positionsResult.rows.map(formatPositionInstance);
      total += positions.length;

      objects.push({
        object_id: obj.object_id,
        object_code: obj.object_code,
        object_name: obj.object_name,
        sheet_name: obj.object_code,
        positions
      });
    }

    res.json({
      success: true,
      project_id: projectId,
      project_name: projectResult.rows[0].project_name,
      total,
      objects
    });

  } catch (error) {
    console.error('[PositionInstances] Error listing positions:', error);
    res.status(500).json({ success: false, error: 'Failed to list positions' });
  }
});

// =============================================================================
// LINKED POSITIONS — CROSS-KIOSK REGISTRY
// =============================================================================

/**
 * GET /api/positions/project/:projectId/linked
 * Returns positions that have data from multiple kiosks (Monolit + Registry).
 * Shows linkage status for each position.
 *
 * Response: { positions[]: { position_instance_id, kod, popis, has_monolith, has_dov, monolith_summary, dov_summary } }
 */
router.get('/project/:projectId/linked', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  try {
    const { projectId } = req.params;

    const result = await pool.query(
      `SELECT pp.position_instance_id, pp.position_id,
              pp.kod, pp.popis, pp.mnozstvi, pp.mj,
              pp.cena_jednotkova, pp.cena_celkem,
              pp.skupina, pp.sheet_name, pp.row_index,
              pp.monolit_position_id, pp.registry_item_id,
              pp.monolith_payload IS NOT NULL AS has_monolith,
              pp.dov_payload IS NOT NULL AS has_dov,
              pp.monolith_payload,
              pp.dov_payload,
              pp.last_sync_from, pp.last_sync_at,
              po.object_code, po.object_name
       FROM portal_positions pp
       JOIN portal_objects po ON pp.object_id = po.object_id
       WHERE po.portal_project_id = $1
       ORDER BY po.object_code, pp.row_index`,
      [projectId]
    );

    const positions = result.rows.map(row => {
      const mp = row.monolith_payload;
      const dp = row.dov_payload;

      return {
        position_instance_id: row.position_instance_id,
        position_id: row.position_id,
        kod: row.kod,
        popis: row.popis,
        mnozstvi: row.mnozstvi,
        mj: row.mj,
        skupina: row.skupina,
        object_code: row.object_code,
        object_name: row.object_name,
        sheet_name: row.sheet_name,

        // Cross-kiosk linkage status
        monolit_linked: row.has_monolith,
        registry_linked: row.has_dov,
        monolit_position_id: row.monolit_position_id,
        registry_item_id: row.registry_item_id,

        // Summaries (without full payload)
        monolith_summary: mp ? {
          cost_czk: mp.cost_czk,
          kros_unit_czk: mp.kros_unit_czk,
          kros_total_czk: mp.kros_total_czk,
          unit_cost_on_m3: mp.unit_cost_on_m3,
          crew_size: mp.crew_size,
          days: mp.days,
          source_tag: mp.source_tag,
          calculated_at: mp.calculated_at,
        } : null,

        dov_summary: dp ? {
          total_czk: dp.grand_total?.total_czk,
          labor_czk: dp.grand_total?.labor_czk,
          machinery_czk: dp.grand_total?.machinery_czk,
          materials_czk: dp.grand_total?.materials_czk,
          rental_czk: dp.grand_total?.rental_czk,
          calculated_at: dp.calculated_at,
        } : null,

        last_sync_from: row.last_sync_from,
        last_sync_at: row.last_sync_at,
      };
    });

    const stats = {
      total: positions.length,
      monolit_linked: positions.filter(p => p.monolit_linked).length,
      registry_linked: positions.filter(p => p.registry_linked).length,
      both_linked: positions.filter(p => p.monolit_linked && p.registry_linked).length,
    };

    res.json({
      success: true,
      project_id: projectId,
      stats,
      positions,
    });

  } catch (error) {
    console.error('[PositionInstances] Error fetching linked positions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch linked positions' });
  }
});

// =============================================================================
// GET SINGLE INSTANCE
// =============================================================================

/**
 * GET /api/positions/:instanceId
 * Returns a single position instance by position_instance_id.
 */
router.get('/:instanceId', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  try {
    const { instanceId } = req.params;

    const result = await pool.query(
      `SELECT pp.*, po.object_code, po.object_name, po.portal_project_id
       FROM portal_positions pp
       JOIN portal_objects po ON pp.object_id = po.object_id
       WHERE pp.position_instance_id = $1`,
      [instanceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Position instance not found' });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      position: formatPositionInstance(row),
      context: {
        project_id: row.portal_project_id,
        object_code: row.object_code,
        object_name: row.object_name
      }
    });

  } catch (error) {
    console.error('[PositionInstances] Error getting instance:', error);
    res.status(500).json({ success: false, error: 'Failed to get position instance' });
  }
});

// =============================================================================
// BULK CREATE (Excel import → position instances)
// =============================================================================

/**
 * POST /api/positions/project/:projectId/bulk
 * Creates position instances in bulk from parsed Excel data.
 *
 * Body:
 *   objects: Array<{
 *     object_code: string,
 *     object_name: string,
 *     positions: Array<{
 *       catalog_code, description, unit, qty, unit_price?, total_price?,
 *       skupina?, row_role?, row_index?, sheet_name?
 *     }>
 *   }>
 *   created_by?: string  (default: 'excel_import')
 */
router.post('/project/:projectId/bulk', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  const client = await pool.connect();
  try {
    const { projectId } = req.params;
    const { objects, created_by = 'excel_import' } = req.body;

    if (!objects || !Array.isArray(objects)) {
      return res.status(400).json({ success: false, error: 'objects[] required' });
    }

    // Verify project exists
    const projectCheck = await client.query(
      'SELECT portal_project_id FROM portal_projects WHERE portal_project_id = $1',
      [projectId]
    );
    if (projectCheck.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    await client.query('BEGIN');

    let objectsCreated = 0;
    let instancesCreated = 0;
    const createdObjects = [];

    for (const obj of objects) {
      // Create or get object
      const objectId = `obj_${uuidv4()}`;
      const objResult = await client.query(
        `INSERT INTO portal_objects (object_id, portal_project_id, object_code, object_name, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (portal_project_id, object_code) DO UPDATE SET object_name = $4, updated_at = NOW()
         RETURNING object_id`,
        [objectId, projectId, obj.object_code || 'Sheet1', obj.object_name || obj.object_code || 'Sheet1']
      );

      const dbObjectId = objResult.rows[0].object_id;
      objectsCreated++;
      const createdPositions = [];

      for (let i = 0; i < (obj.positions || []).length; i++) {
        const pos = obj.positions[i];
        const positionId = `pos_${uuidv4()}`;

        const result = await client.query(
          `INSERT INTO portal_positions (
            position_id, object_id, kod, popis, mnozstvi, mj,
            cena_jednotkova, cena_celkem,
            sheet_name, row_index, skupina, row_role,
            created_by, updated_by,
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, NOW(), NOW())
          RETURNING position_instance_id`,
          [
            positionId,
            dbObjectId,
            pos.catalog_code || pos.kod || '',
            pos.description || pos.popis || '',
            pos.qty || pos.mnozstvi || 0,
            pos.unit || pos.mj || '',
            pos.unit_price || pos.cena_jednotkova || null,
            pos.total_price || pos.cena_celkem || null,
            pos.sheet_name || obj.object_code || '',
            pos.row_index != null ? pos.row_index : i,
            pos.skupina || null,
            pos.row_role || 'unknown',
            created_by
          ]
        );

        createdPositions.push({
          position_instance_id: result.rows[0].position_instance_id,
          catalog_code: pos.catalog_code || pos.kod,
          description: pos.description || pos.popis
        });
        instancesCreated++;
      }

      createdObjects.push({
        object_id: dbObjectId,
        object_code: obj.object_code,
        instance_count: createdPositions.length,
        instances: createdPositions
      });
    }

    // Write audit log
    await client.query(
      `INSERT INTO position_audit_log (event, actor, project_id, details)
       VALUES ('bulk_import', $1, $2, $3)`,
      [created_by, projectId, JSON.stringify({
        objects_created: objectsCreated,
        instances_created: instancesCreated
      })]
    );

    await client.query('COMMIT');

    console.log(`[PositionInstances] Bulk import: ${projectId} → ${objectsCreated} objects, ${instancesCreated} instances`);

    res.json({
      success: true,
      project_id: projectId,
      objects_created: objectsCreated,
      instances_created: instancesCreated,
      objects: createdObjects
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PositionInstances] Error in bulk create:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// =============================================================================
// UPDATE INSTANCE
// =============================================================================

/**
 * PUT /api/positions/:instanceId
 * Update core fields of a position instance.
 *
 * Body: { catalog_code?, description?, unit?, qty?, unit_price?, total_price?,
 *         skupina?, row_role?, updated_by? }
 */
router.put('/:instanceId', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  try {
    const { instanceId } = req.params;
    const { updated_by = 'manual', ...fields } = req.body;

    // Whitelist updatable fields
    const ALLOWED_FIELDS = {
      catalog_code: 'kod',
      description: 'popis',
      unit: 'mj',
      qty: 'mnozstvi',
      unit_price: 'cena_jednotkova',
      total_price: 'cena_celkem',
      skupina: 'skupina',
      row_role: 'row_role',
      sheet_name: 'sheet_name',
      row_index: 'row_index'
    };

    const setClauses = [];
    const values = [];
    let paramIdx = 1;

    for (const [apiField, dbField] of Object.entries(ALLOWED_FIELDS)) {
      if (fields[apiField] !== undefined) {
        setClauses.push(`${dbField} = $${paramIdx++}`);
        values.push(fields[apiField]);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push(`updated_by = $${paramIdx++}`);
    values.push(updated_by);
    setClauses.push(`updated_at = NOW()`);

    values.push(instanceId);

    const result = await pool.query(
      `UPDATE portal_positions
       SET ${setClauses.join(', ')}
       WHERE position_instance_id = $${paramIdx}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Position instance not found' });
    }

    res.json({
      success: true,
      position: formatPositionInstance(result.rows[0])
    });

  } catch (error) {
    console.error('[PositionInstances] Error updating instance:', error);
    res.status(500).json({ success: false, error: 'Failed to update position instance' });
  }
});

// =============================================================================
// DELETE INSTANCE
// =============================================================================

/**
 * DELETE /api/positions/:instanceId
 */
router.delete('/:instanceId', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  try {
    const { instanceId } = req.params;

    const result = await pool.query(
      'DELETE FROM portal_positions WHERE position_instance_id = $1 RETURNING position_id',
      [instanceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Position instance not found' });
    }

    res.json({ success: true, deleted: true });

  } catch (error) {
    console.error('[PositionInstances] Error deleting instance:', error);
    res.status(500).json({ success: false, error: 'Failed to delete position instance' });
  }
});

// =============================================================================
// MONOLITH PAYLOAD (read/write by Monolit kiosk)
// =============================================================================

/**
 * GET /api/positions/:instanceId/monolith
 * Read monolith_payload for a position instance.
 */
router.get('/:instanceId/monolith', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  try {
    const { instanceId } = req.params;

    const result = await pool.query(
      'SELECT monolith_payload FROM portal_positions WHERE position_instance_id = $1',
      [instanceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Position instance not found' });
    }

    res.json({
      success: true,
      position_instance_id: instanceId,
      monolith_payload: result.rows[0].monolith_payload || null
    });

  } catch (error) {
    console.error('[PositionInstances] Error reading monolith payload:', error);
    res.status(500).json({ success: false, error: 'Failed to read monolith payload' });
  }
});

/**
 * POST /api/positions/:instanceId/monolith
 * Write monolith_payload from Monolit kiosk.
 *
 * Body: { payload: MonolithPayload }
 */
router.post('/:instanceId/monolith', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  const client = await pool.connect();
  try {
    const { instanceId } = req.params;
    const { payload } = req.body;

    if (!payload) {
      client.release();
      return res.status(400).json({ success: false, error: 'payload required' });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE portal_positions
       SET monolith_payload = $1,
           monolit_position_id = $2,
           updated_by = 'monolit',
           updated_at = NOW()
       WHERE position_instance_id = $3
       RETURNING position_id, position_instance_id`,
      [JSON.stringify(payload), payload.monolit_position_id || null, instanceId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, error: 'Position instance not found' });
    }

    // Audit log
    const posRow = result.rows[0];
    await client.query(
      `INSERT INTO position_audit_log (event, actor, project_id, position_instance_id, details)
       SELECT 'monolith_written', 'kiosk:monolit', po.portal_project_id, $1, $2
       FROM portal_positions pp
       JOIN portal_objects po ON pp.object_id = po.object_id
       WHERE pp.position_instance_id = $1`,
      [instanceId, JSON.stringify({
        monolit_position_id: payload.monolit_position_id,
        subtype: payload.subtype,
        cost_czk: payload.cost_czk,
        kros_total_czk: payload.kros_total_czk
      })]
    );

    await client.query('COMMIT');

    console.log(`[PositionInstances] Monolith payload written: ${instanceId}`);

    res.json({
      success: true,
      position_instance_id: instanceId,
      written: true
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PositionInstances] Error writing monolith payload:', error);
    res.status(500).json({ success: false, error: 'Failed to write monolith payload' });
  } finally {
    client.release();
  }
});

// =============================================================================
// DOV PAYLOAD (read/write by Registry/DOV kiosk)
// =============================================================================

/**
 * GET /api/positions/:instanceId/dov
 * Read dov_payload for a position instance.
 * Falls back to legacy tov_labor/tov_machinery/tov_materials if dov_payload is null.
 */
router.get('/:instanceId/dov', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  try {
    const { instanceId } = req.params;

    const result = await pool.query(
      `SELECT dov_payload, tov_labor, tov_machinery, tov_materials
       FROM portal_positions WHERE position_instance_id = $1`,
      [instanceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Position instance not found' });
    }

    const row = result.rows[0];

    // Prefer new dov_payload, fall back to legacy columns
    let dovPayload = row.dov_payload;
    if (!dovPayload && (row.tov_labor || row.tov_machinery || row.tov_materials)) {
      dovPayload = {
        labor: safeJsonParse(row.tov_labor, []),
        labor_summary: { total_norm_hours: 0, total_workers: 0, total_cost_czk: 0 },
        machinery: safeJsonParse(row.tov_machinery, []),
        machinery_summary: { total_machine_hours: 0, total_units: 0, total_cost_czk: 0 },
        materials: safeJsonParse(row.tov_materials, []),
        materials_summary: { total_cost_czk: 0, item_count: 0 },
        formwork_rental: null,
        formwork_rental_summary: null,
        pump_rental: null,
        pump_rental_summary: null,
        grand_total: { labor_czk: 0, machinery_czk: 0, materials_czk: 0, rental_czk: 0, total_czk: 0, currency: 'CZK' },
        calculated_at: null,
        calculated_by: 'legacy_migration',
        version: 0
      };
    }

    res.json({
      success: true,
      position_instance_id: instanceId,
      dov_payload: dovPayload || null
    });

  } catch (error) {
    console.error('[PositionInstances] Error reading DOV payload:', error);
    res.status(500).json({ success: false, error: 'Failed to read DOV payload' });
  }
});

/**
 * POST /api/positions/:instanceId/dov
 * Write dov_payload from Registry/DOV kiosk.
 *
 * Body: { payload: DOVPayload }
 */
router.post('/:instanceId/dov', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  const client = await pool.connect();
  try {
    const { instanceId } = req.params;
    const { payload } = req.body;

    if (!payload) {
      client.release();
      return res.status(400).json({ success: false, error: 'payload required' });
    }

    await client.query('BEGIN');

    // Also sync to legacy columns for backward compatibility
    const result = await client.query(
      `UPDATE portal_positions
       SET dov_payload = $1,
           tov_labor = $2,
           tov_machinery = $3,
           tov_materials = $4,
           updated_by = 'dov',
           last_sync_from = 'registry',
           last_sync_at = NOW(),
           updated_at = NOW()
       WHERE position_instance_id = $5
       RETURNING position_id, position_instance_id`,
      [
        JSON.stringify(payload),
        JSON.stringify(payload.labor || []),
        JSON.stringify(payload.machinery || []),
        JSON.stringify(payload.materials || []),
        instanceId
      ]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ success: false, error: 'Position instance not found' });
    }

    // Audit log
    await client.query(
      `INSERT INTO position_audit_log (event, actor, project_id, position_instance_id, details)
       SELECT 'dov_written', 'kiosk:dov', po.portal_project_id, $1, $2
       FROM portal_positions pp
       JOIN portal_objects po ON pp.object_id = po.object_id
       WHERE pp.position_instance_id = $1`,
      [instanceId, JSON.stringify({
        grand_total: payload.grand_total,
        version: payload.version
      })]
    );

    await client.query('COMMIT');

    console.log(`[PositionInstances] DOV payload written: ${instanceId}`);

    res.json({
      success: true,
      position_instance_id: instanceId,
      written: true
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PositionInstances] Error writing DOV payload:', error);
    res.status(500).json({ success: false, error: 'Failed to write DOV payload' });
  } finally {
    client.release();
  }
});

// =============================================================================
// TEMPLATES
// =============================================================================

/**
 * POST /api/positions/templates
 * Save a position instance as a reusable template.
 *
 * Body: { source_instance_id, scaling_rule?: 'linear'|'fixed'|'manual', created_by? }
 */
router.post('/templates', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  const client = await pool.connect();
  try {
    const { source_instance_id, scaling_rule = 'linear', created_by = 'manual' } = req.body;

    if (!source_instance_id) {
      client.release();
      return res.status(400).json({ success: false, error: 'source_instance_id required' });
    }

    // Get source instance
    const sourceResult = await client.query(
      `SELECT pp.*, po.portal_project_id
       FROM portal_positions pp
       JOIN portal_objects po ON pp.object_id = po.object_id
       WHERE pp.position_instance_id = $1`,
      [source_instance_id]
    );

    if (sourceResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Source position instance not found' });
    }

    const source = sourceResult.rows[0];

    // Normalize description for matching
    const normalizedDesc = normalizeDescription(source.popis || '');

    await client.query('BEGIN');

    // Upsert template
    const templateResult = await client.query(
      `INSERT INTO position_templates (
        project_id, catalog_code, unit, normalized_description, display_description,
        monolith_template, dov_template,
        scaling_rule, source_qty, source_instance_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (project_id, catalog_code, unit, normalized_description)
      DO UPDATE SET
        monolith_template = EXCLUDED.monolith_template,
        dov_template = EXCLUDED.dov_template,
        scaling_rule = EXCLUDED.scaling_rule,
        source_qty = EXCLUDED.source_qty,
        source_instance_id = EXCLUDED.source_instance_id,
        updated_at = NOW()
      RETURNING template_id`,
      [
        source.portal_project_id,
        source.kod || '',
        source.mj || '',
        normalizedDesc,
        source.popis || '',
        source.monolith_payload ? JSON.stringify(source.monolith_payload) : null,
        source.dov_payload ? JSON.stringify(source.dov_payload) : null,
        scaling_rule,
        source.mnozstvi || 1,
        source_instance_id,
        created_by
      ]
    );

    const templateId = templateResult.rows[0].template_id;

    // Mark source instance as template source
    await client.query(
      `UPDATE portal_positions
       SET template_id = $1, template_confidence = 'GREEN', updated_by = 'template_save'
       WHERE position_instance_id = $2`,
      [templateId, source_instance_id]
    );

    // Audit log
    await client.query(
      `INSERT INTO position_audit_log (event, actor, project_id, position_instance_id, template_id, details)
       VALUES ('template_saved', $1, $2, $3, $4, $5)`,
      [created_by, source.portal_project_id, source_instance_id, templateId, JSON.stringify({
        catalog_code: source.kod,
        unit: source.mj,
        scaling_rule
      })]
    );

    await client.query('COMMIT');

    console.log(`[PositionInstances] Template saved: ${templateId} from ${source_instance_id}`);

    res.json({
      success: true,
      template_id: templateId,
      source_instance_id,
      catalog_code: source.kod,
      unit: source.mj
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PositionInstances] Error saving template:', error);
    res.status(500).json({ success: false, error: 'Failed to save template' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/positions/templates/:projectId
 * List all templates for a project.
 *
 * Query params:
 *   ?catalog_code=231112   — Filter by catalog code
 */
router.get('/templates/:projectId', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  try {
    const { projectId } = req.params;
    const { catalog_code } = req.query;

    let query = `SELECT * FROM position_templates WHERE project_id = $1`;
    const params = [projectId];

    if (catalog_code) {
      query += ` AND catalog_code = $2`;
      params.push(catalog_code);
    }

    query += ` ORDER BY catalog_code, unit`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      templates: result.rows.map(t => ({
        template_id: t.template_id,
        project_id: t.project_id,
        catalog_code: t.catalog_code,
        unit: t.unit,
        normalized_description: t.normalized_description,
        display_description: t.display_description,
        monolith_template: t.monolith_template,
        dov_template: t.dov_template,
        scaling_rule: t.scaling_rule,
        source_qty: t.source_qty,
        source_instance_id: t.source_instance_id,
        created_by: t.created_by,
        apply_count: t.apply_count,
        created_at: t.created_at,
        updated_at: t.updated_at
      }))
    });

  } catch (error) {
    console.error('[PositionInstances] Error listing templates:', error);
    res.status(500).json({ success: false, error: 'Failed to list templates' });
  }
});

/**
 * POST /api/positions/templates/:templateId/apply
 * Apply a template to matching position instances.
 *
 * Body: {
 *   target_instance_ids?: string[],  — Specific instances (auto-find if empty)
 *   min_confidence?: 'GREEN'|'AMBER'|'RED',
 *   require_approval?: boolean
 * }
 */
router.post('/templates/:templateId/apply', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) {
    return res.status(503).json({ success: false, error: 'Database not available' });
  }

  const client = await pool.connect();
  try {
    const { templateId } = req.params;
    const {
      target_instance_ids,
      min_confidence = 'RED',
      require_approval = false
    } = req.body;

    // Get template
    const templateResult = await client.query(
      'SELECT * FROM position_templates WHERE template_id = $1',
      [templateId]
    );

    if (templateResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

    const template = templateResult.rows[0];

    // Find matching instances
    let matchQuery;
    let matchParams;

    if (target_instance_ids && target_instance_ids.length > 0) {
      matchQuery = `
        SELECT pp.*, po.portal_project_id
        FROM portal_positions pp
        JOIN portal_objects po ON pp.object_id = po.object_id
        WHERE pp.position_instance_id = ANY($1)
          AND pp.position_instance_id != $2`;
      matchParams = [target_instance_ids, template.source_instance_id];
    } else {
      // Auto-find: same project, same catalog_code
      matchQuery = `
        SELECT pp.*, po.portal_project_id
        FROM portal_positions pp
        JOIN portal_objects po ON pp.object_id = po.object_id
        WHERE po.portal_project_id = $1
          AND pp.kod = $2
          AND pp.position_instance_id != $3`;
      matchParams = [template.project_id, template.catalog_code, template.source_instance_id];
    }

    const matchResult = await client.query(matchQuery, matchParams);

    // Calculate matches with confidence
    const confidenceOrder = { GREEN: 3, AMBER: 2, RED: 1 };
    const minConfidenceLevel = confidenceOrder[min_confidence] || 1;

    const matches = matchResult.rows.map(row => {
      const unitMatch = (row.mj || '').toLowerCase() === (template.unit || '').toLowerCase();
      const normalizedRowDesc = normalizeDescription(row.popis || '');
      const descSimilarity = levenshteinSimilarity(normalizedRowDesc, template.normalized_description);
      const codeMatch = (row.kod || '') === template.catalog_code;

      let confidence;
      if (codeMatch && unitMatch && descSimilarity >= 0.7) {
        confidence = 'GREEN';
      } else if (codeMatch && unitMatch) {
        confidence = 'AMBER';
      } else {
        confidence = 'RED';
      }

      return {
        position_instance_id: row.position_instance_id,
        confidence,
        match_details: { code_match: codeMatch, unit_match: unitMatch, description_similarity: descSimilarity },
        scaling: {
          rule: template.scaling_rule,
          source_qty: template.source_qty,
          target_qty: row.mnozstvi || 0,
          ratio: template.source_qty > 0 ? (row.mnozstvi || 0) / template.source_qty : 1
        },
        approved: !require_approval
      };
    }).filter(m => confidenceOrder[m.confidence] >= minConfidenceLevel);

    // Apply template to approved matches
    await client.query('BEGIN');

    let applied = 0;
    let skipped = 0;
    let pendingApproval = 0;

    for (const match of matches) {
      if (!match.approved) {
        pendingApproval++;
        continue;
      }

      // Scale payloads
      const scaledMonolith = template.monolith_template
        ? scalePayload(template.monolith_template, match.scaling.ratio)
        : null;
      const scaledDov = template.dov_template
        ? scalePayload(template.dov_template, match.scaling.ratio)
        : null;

      await client.query(
        `UPDATE portal_positions
         SET monolith_payload = COALESCE($1, monolith_payload),
             dov_payload = COALESCE($2, dov_payload),
             template_id = $3,
             template_confidence = $4,
             updated_by = 'template_apply',
             updated_at = NOW()
         WHERE position_instance_id = $5`,
        [
          scaledMonolith ? JSON.stringify(scaledMonolith) : null,
          scaledDov ? JSON.stringify(scaledDov) : null,
          templateId,
          match.confidence,
          match.position_instance_id
        ]
      );
      applied++;
    }

    // Update template apply count
    await client.query(
      'UPDATE position_templates SET apply_count = apply_count + $1, updated_at = NOW() WHERE template_id = $2',
      [applied, templateId]
    );

    // Audit log
    await client.query(
      `INSERT INTO position_audit_log (event, actor, project_id, template_id, details)
       VALUES ('template_applied', 'system:template', $1, $2, $3)`,
      [template.project_id, templateId, JSON.stringify({
        applied, skipped, pending_approval: pendingApproval,
        total_matches: matches.length
      })]
    );

    await client.query('COMMIT');

    console.log(`[PositionInstances] Template ${templateId} applied: ${applied} of ${matches.length}`);

    res.json({
      success: true,
      template_id: templateId,
      matches,
      applied,
      skipped,
      pending_approval: pendingApproval
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[PositionInstances] Error applying template:', error);
    res.status(500).json({ success: false, error: 'Failed to apply template' });
  } finally {
    client.release();
  }
});

// =============================================================================
// HELPERS
// =============================================================================

/** Format DB row → API PositionInstance */
function formatPositionInstance(row) {
  return {
    position_instance_id: row.position_instance_id,
    position_id: row.position_id,
    object_id: row.object_id,
    sheet_name: row.sheet_name || '',
    row_index: row.row_index || 0,
    catalog_code: row.kod || '',
    description: row.popis || '',
    unit: row.mj || '',
    qty: row.mnozstvi || 0,
    unit_price: row.cena_jednotkova || null,
    total_price: row.cena_celkem || null,
    skupina: row.skupina || null,
    row_role: row.row_role || 'unknown',
    template_id: row.template_id || null,
    template_confidence: row.template_confidence || null,
    monolith_payload: row.monolith_payload || null,
    dov_payload: row.dov_payload || null,
    overrides: row.overrides || null,
    monolit_position_id: row.monolit_position_id || null,
    registry_item_id: row.registry_item_id || null,
    created_by: row.created_by || 'legacy',
    updated_by: row.updated_by || 'legacy',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/** Parse JSON safely */
function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try {
    return typeof str === 'object' ? str : JSON.parse(str);
  } catch {
    return fallback;
  }
}

/** Normalize description for template matching */
function normalizeDescription(desc) {
  return desc
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein similarity (0.0-1.0) */
function levenshteinSimilarity(a, b) {
  if (!a && !b) return 1.0;
  if (!a || !b) return 0.0;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/** Levenshtein distance (optimized) */
function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Use single array optimization
  const prev = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    let prevDiag = prev[0];
    prev[0] = i;

    for (let j = 1; j <= n; j++) {
      const temp = prev[j];
      if (a[i - 1] === b[j - 1]) {
        prev[j] = prevDiag;
      } else {
        prev[j] = 1 + Math.min(prevDiag, prev[j], prev[j - 1]);
      }
      prevDiag = temp;
    }
  }

  return prev[n];
}

/** Scale payload values by ratio (for template application) */
function scalePayload(payload, ratio) {
  if (!payload || ratio === 1) return payload;

  // Deep clone
  const scaled = JSON.parse(JSON.stringify(payload));

  // Scale numeric fields that are qty-dependent
  const scaleFields = [
    'labor_hours', 'cost_czk', 'kros_total_czk',
    'total_norm_hours', 'total_cost_czk', 'total_machine_hours'
  ];

  function scaleObj(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'number' && scaleFields.includes(key)) {
        obj[key] = val * ratio;
      } else if (typeof val === 'object' && val !== null) {
        scaleObj(val);
      }
    }
  }

  scaleObj(scaled);
  return scaled;
}

export default router;
