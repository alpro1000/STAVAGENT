/**
 * Import from Registry via Portal
 *
 * GET  /api/import-from-registry/projects — list available Portal projects with Registry data
 * POST /api/import-from-registry           — fetch positions from Portal and save as Monolit positions
 *
 * Flow: User uploads XLSX → Registry → portalAutoSync → Portal (portal_positions)
 *       Monolit calls Portal GET /api/integration/for-registry/:id → gets sheets+items → saves
 */

import express from 'express';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const PORTAL_API = process.env.PORTAL_API_URL || 'https://stavagent-portal-backend-1086027517695.europe-west3.run.app';

// Default values for new positions
const DEFAULTS = { crew_size: 4, wage_czk_ph: 398, shift_hours: 10, days: 0 };

/**
 * Determine Monolit subtype from item fields
 */
function determineSubtype(item) {
  const desc = (item.popis || '').toLowerCase();
  const unit = (item.mj || '').toLowerCase();

  if (unit === 'm3' || unit === 'm³') return 'beton';
  if (unit === 'm2' || unit === 'm²') return 'bednění';
  if (unit === 't' || unit === 'kg') return 'výztuž';

  if (desc.includes('výztuž') || desc.includes('ocel') || desc.includes('b500')) return 'výztuž';
  if (desc.includes('bedn') || desc.includes('odbedň')) return 'bednění';
  if (desc.includes('beton') || desc.includes('železobet')) return 'beton';

  return 'jiné';
}

/**
 * GET /api/import-from-registry/projects
 * Returns list of Portal projects that have Registry data (for dropdown selector)
 */
router.get('/projects', async (req, res) => {
  try {
    logger.info('[ImportRegistry] Fetching available projects from Portal...');

    const response = await fetch(`${PORTAL_API}/api/portal-projects/registry`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      logger.warn(`[ImportRegistry] Portal returned ${response.status}`);
      return res.json({ success: true, projects: [] });
    }

    const data = await response.json();
    const portalProjects = data.projects || [];

    // Filter to projects that have Registry data
    const withRegistry = portalProjects
      .filter(p => p.has_registry || (p.position_stats?.has_registry_id > 0))
      .map(p => ({
        portal_project_id: p.portal_project_id,
        project_name: p.project_name,
        positions_total: p.position_stats?.total_positions || 0,
        registry_linked: p.position_stats?.registry_linked || 0,
        monolit_linked: p.position_stats?.monolit_linked || 0,
      }));

    // Fallback: if Portal returned nothing, try Registry backend directly
    if (withRegistry.length === 0) {
      logger.info('[ImportRegistry] No Portal projects found, trying Registry backend directly...');
      const REGISTRY_API = process.env.REGISTRY_API_URL || 'https://rozpocet-registry-backend-1086027517695.europe-west3.run.app';
      try {
        const regRes = await fetch(`${REGISTRY_API}/api/registry/projects`);
        if (regRes.ok) {
          const regData = await regRes.json();
          const regProjects = (regData.projects || []).map(p => ({
            portal_project_id: p.portal_project_id || p.project_id,
            project_name: p.project_name,
            positions_total: p.item_count || 0,
          }));
          if (regProjects.length > 0) {
            logger.info(`[ImportRegistry] Fallback: found ${regProjects.length} projects from Registry`);
            return res.json({ success: true, projects: regProjects });
          }
        }
      } catch (regErr) {
        logger.warn('[ImportRegistry] Registry fallback failed:', regErr.message);
      }
    }

    logger.info(`[ImportRegistry] Found ${withRegistry.length} projects with Registry data`);

    res.json({ success: true, projects: withRegistry });
  } catch (error) {
    logger.error('[ImportRegistry] Error fetching projects:', error);
    res.json({ success: true, projects: [] });
  }
});

/**
 * POST /api/import-from-registry
 * Body: { portal_project_id: string, project_name?: string }
 *
 * Fetches positions from Portal integration API and saves as Monolit positions.
 */
router.post('/', async (req, res) => {
  try {
    const { portal_project_id, project_name } = req.body;
    const portalUserId = req.user?.userId || null;

    if (!portal_project_id) {
      return res.status(400).json({ error: 'portal_project_id is required' });
    }

    logger.info(`[ImportRegistry] Fetching project ${portal_project_id} from Portal...`);

    // 1. Fetch project data from Portal integration API
    const response = await fetch(`${PORTAL_API}/api/integration/for-registry/${portal_project_id}`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Portal project not found or unavailable: ${response.status}`,
      });
    }

    const data = await response.json();
    const projectData = data.project;

    if (!projectData || !projectData.sheets || projectData.sheets.length === 0) {
      return res.status(404).json({ error: 'Project has no sheets/positions in Portal' });
    }

    const projectName = project_name || projectData.name || 'Import z Rozpočtu';
    const importedBridges = [];

    // 2. Process each sheet as a separate bridge/object
    for (const sheet of projectData.sheets) {
      const items = sheet.items || [];
      if (items.length === 0) continue;

      // Generate bridge_id
      const bridgeId = `PRT_${portal_project_id.replace(/[^a-zA-Z0-9_-]/g, '')}_${importedBridges.length + 1}`;
      const objectName = sheet.name || 'Objekt';

      // Convert Portal items → Monolit positions
      const positions = [];
      for (const item of items) {
        const subtype = determineSubtype(item);
        const qty = parseFloat(item.mnozstvi) || 0;
        if (qty <= 0) continue;

        // Extract concrete grade
        let concreteGrade = null;
        const gradeMatch = (item.popis || '').match(/C\s*(\d{1,3})\s*\/\s*(\d{1,3})/i);
        if (gradeMatch) concreteGrade = `C${gradeMatch[1]}/${gradeMatch[2]}`;

        positions.push({
          part_name: item.popis ? item.popis.substring(0, 60) : 'Položka',
          item_name: item.popis || 'Položka',
          subtype,
          unit: item.mj || (subtype === 'beton' ? 'M3' : subtype === 'výztuž' ? 'T' : 'M2'),
          qty,
          otskp_code: item.kod || null,
          concrete_m3: subtype === 'beton' ? qty : 0,
          unit_price: parseFloat(item.cenaJednotkova) || 0,
          total_price: parseFloat(item.cenaCelkem) || 0,
          concrete_grade: concreteGrade,
          position_instance_id: item.position_instance_id || null,
          source: 'REGISTRY_VIA_PORTAL',
        });
      }

      if (positions.length === 0) continue;

      const totalConcreteM3 = positions
        .filter(p => p.subtype === 'beton')
        .reduce((sum, p) => sum + (p.qty || 0), 0);

      // 3. Save to DB
      await db.prepare(`
        INSERT INTO bridges (bridge_id, object_name, concrete_m3, status, project_name)
        VALUES (?, ?, ?, 'active', ?)
        ON CONFLICT (bridge_id) DO UPDATE SET
          concrete_m3 = excluded.concrete_m3,
          object_name = excluded.object_name,
          project_name = COALESCE(excluded.project_name, bridges.project_name)
      `).run(bridgeId, objectName, totalConcreteM3, projectName);

      await db.prepare(`
        INSERT INTO monolith_projects
        (project_id, project_name, object_name, description, concrete_m3, element_count, owner_id, portal_user_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'active')
        ON CONFLICT (project_id) DO UPDATE SET
          concrete_m3 = excluded.concrete_m3,
          element_count = excluded.element_count,
          project_name = COALESCE(excluded.project_name, monolith_projects.project_name),
          portal_user_id = COALESCE(excluded.portal_user_id, monolith_projects.portal_user_id)
      `).run(bridgeId, projectName, objectName, `Import from Registry via Portal`, totalConcreteM3, positions.length, portalUserId);

      // Batch insert positions
      if (db.isPostgres) {
        const pool = db.getPool();
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('DELETE FROM positions WHERE bridge_id = $1', [bridgeId]);

          for (const pos of positions) {
            const id = `${bridgeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await client.query(`
              INSERT INTO positions (
                id, bridge_id, part_name, item_name, subtype, unit,
                qty, crew_size, wage_czk_ph, shift_hours, days, otskp_code,
                concrete_m3, cost_czk, unit_cost_native, position_instance_id
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
            `, [
              id, bridgeId,
              pos.part_name, pos.item_name, pos.subtype, pos.unit, pos.qty,
              DEFAULTS.crew_size, DEFAULTS.wage_czk_ph, DEFAULTS.shift_hours, DEFAULTS.days,
              pos.otskp_code, pos.concrete_m3,
              pos.total_price || null, pos.unit_price || null,
              pos.position_instance_id,
            ]);
          }

          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } else {
        // SQLite
        const insertStmt = db.prepare(`
          INSERT INTO positions (
            id, bridge_id, part_name, item_name, subtype, unit,
            qty, crew_size, wage_czk_ph, shift_hours, days, otskp_code,
            concrete_m3, cost_czk, unit_cost_native, position_instance_id
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `);
        db.prepare('DELETE FROM positions WHERE bridge_id = ?').run(bridgeId);
        const tx = db.transaction(() => {
          for (const pos of positions) {
            const id = `${bridgeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            insertStmt.run(
              id, bridgeId,
              pos.part_name, pos.item_name, pos.subtype, pos.unit, pos.qty,
              DEFAULTS.crew_size, DEFAULTS.wage_czk_ph, DEFAULTS.shift_hours, DEFAULTS.days,
              pos.otskp_code, pos.concrete_m3,
              pos.total_price || null, pos.unit_price || null,
              pos.position_instance_id,
            );
          }
        });
        tx();
      }

      logger.info(`[ImportRegistry] Saved ${positions.length} positions for bridge ${bridgeId}`);

      importedBridges.push({
        bridge_id: bridgeId,
        object_name: objectName,
        project_name: projectName,
        positions_count: positions.length,
        concrete_m3: totalConcreteM3,
      });
    }

    if (importedBridges.length === 0) {
      return res.status(404).json({ error: 'No concrete-related items found in project' });
    }

    const totalPositions = importedBridges.reduce((s, b) => s + b.positions_count, 0);
    logger.info(`[ImportRegistry] Import complete: ${importedBridges.length} objects, ${totalPositions} positions`);

    res.json({
      success: true,
      message: `Importováno ${totalPositions} pozic z ${importedBridges.length} objektů`,
      bridges: importedBridges,
      total_positions: totalPositions,
    });

  } catch (error) {
    logger.error('[ImportRegistry] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
