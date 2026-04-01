/**
 * Import from Registry routes
 * POST /api/import-from-registry
 *
 * Fetches positions from Rozpočet Registry backend and saves them
 * as Monolit positions (same result as XLSX upload).
 *
 * Flow: Registry Backend → fetch sheets+items → convert to positions → save to DB
 */

import express from 'express';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';
import { findPairedRows } from '../services/concreteExtractor.js';

const router = express.Router();

const REGISTRY_API = process.env.REGISTRY_API_URL || 'https://rozpocet-registry-backend-1086027517695.europe-west3.run.app';

// Default values for new positions
const DEFAULTS = { crew_size: 4, wage_czk_ph: 398, shift_hours: 10, days: 0 };

/**
 * Determine Monolit subtype from Registry item
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
 * POST /api/import-from-registry
 * Body: { registry_project_id: string, project_name?: string }
 */
router.post('/', async (req, res) => {
  try {
    const { registry_project_id, project_name } = req.body;
    const portalUserId = req.user?.userId || null;

    if (!registry_project_id) {
      return res.status(400).json({ error: 'registry_project_id is required' });
    }

    logger.info(`[ImportRegistry] Fetching project ${registry_project_id} from Registry backend...`);

    // 1. Fetch project metadata
    const projectRes = await fetch(`${REGISTRY_API}/api/registry/projects/${registry_project_id}`);
    if (!projectRes.ok) {
      return res.status(404).json({ error: `Registry project not found: ${projectRes.status}` });
    }
    const { project } = await projectRes.json();
    const projectName = project_name || project.project_name || 'Import z Rozpočtu';

    // 2. Fetch sheets
    const sheetsRes = await fetch(`${REGISTRY_API}/api/registry/projects/${registry_project_id}/sheets`);
    if (!sheetsRes.ok) {
      return res.status(500).json({ error: `Failed to fetch sheets: ${sheetsRes.status}` });
    }
    const { sheets } = await sheetsRes.json();

    if (!sheets || sheets.length === 0) {
      return res.status(404).json({ error: 'Registry project has no sheets' });
    }

    const importedBridges = [];

    // 3. Process each sheet as a separate bridge/object
    for (const sheet of sheets) {
      // Fetch items for this sheet
      const itemsRes = await fetch(`${REGISTRY_API}/api/registry/sheets/${sheet.sheet_id || sheet.id}/items`);
      if (!itemsRes.ok) {
        logger.warn(`[ImportRegistry] Failed to fetch items for sheet ${sheet.sheet_name}: ${itemsRes.status}`);
        continue;
      }
      const { items } = await itemsRes.json();

      if (!items || items.length === 0) {
        logger.info(`[ImportRegistry] Sheet "${sheet.sheet_name}" has no items, skipping`);
        continue;
      }

      // Generate bridge_id from sheet name
      const bridgeId = `REG_${registry_project_id}_${sheet.sheet_id || sheet.id}`;
      const objectName = sheet.sheet_name || 'Objekt';

      // Convert Registry items → Monolit positions
      const positions = [];
      for (const item of items) {
        const subtype = determineSubtype(item);
        const qty = parseFloat(item.mnozstvi) || 0;
        if (qty <= 0) continue;

        // Extract concrete grade from description
        let concreteGrade = null;
        const gradeMatch = (item.popis || '').match(/C\s*(\d{1,3})\s*\/\s*(\d{1,3})/i);
        if (gradeMatch) concreteGrade = `C${gradeMatch[1]}/${gradeMatch[2]}`;

        positions.push({
          part_name: item.popis ? item.popis.substring(0, 60) : 'Položka',
          item_name: item.popisFull || item.popis || 'Položka',
          subtype,
          unit: item.mj || (subtype === 'beton' ? 'M3' : subtype === 'výztuž' ? 'T' : 'M2'),
          qty,
          otskp_code: item.kod || null,
          concrete_m3: subtype === 'beton' ? qty : 0,
          unit_price: parseFloat(item.cenaJednotkova) || 0,
          total_price: parseFloat(item.cenaCelkem) || 0,
          concrete_grade: concreteGrade,
          position_instance_id: item.position_instance_id || null,
          source: 'REGISTRY_IMPORT',
        });
      }

      if (positions.length === 0) continue;

      // Calculate totals
      const totalConcreteM3 = positions
        .filter(p => p.subtype === 'beton')
        .reduce((sum, p) => sum + (p.qty || 0), 0);

      // 4. Save to DB — create bridge + monolith_project + positions
      // Create/update bridge
      await db.prepare(`
        INSERT INTO bridges (bridge_id, object_name, concrete_m3, status, project_name)
        VALUES (?, ?, ?, 'active', ?)
        ON CONFLICT (bridge_id) DO UPDATE SET
          concrete_m3 = excluded.concrete_m3,
          object_name = excluded.object_name,
          project_name = COALESCE(excluded.project_name, bridges.project_name)
      `).run(bridgeId, objectName, totalConcreteM3, projectName);

      // Create/update monolith_project
      await db.prepare(`
        INSERT INTO monolith_projects
        (project_id, project_name, object_name, description, concrete_m3, element_count, owner_id, portal_user_id, status)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'active')
        ON CONFLICT (project_id) DO UPDATE SET
          concrete_m3 = excluded.concrete_m3,
          element_count = excluded.element_count,
          project_name = COALESCE(excluded.project_name, monolith_projects.project_name),
          portal_user_id = COALESCE(excluded.portal_user_id, monolith_projects.portal_user_id)
      `).run(bridgeId, projectName, objectName, `Imported from Registry: ${sheet.sheet_name}`, totalConcreteM3, positions.length, portalUserId);

      // Delete old positions and insert new
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

      logger.info(`[ImportRegistry] Saved ${positions.length} positions for bridge ${bridgeId} (${totalConcreteM3.toFixed(2)} m³)`);

      importedBridges.push({
        bridge_id: bridgeId,
        object_name: objectName,
        project_name: projectName,
        positions_count: positions.length,
        concrete_m3: totalConcreteM3,
      });
    }

    if (importedBridges.length === 0) {
      return res.status(404).json({ error: 'No items found in Registry project' });
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
