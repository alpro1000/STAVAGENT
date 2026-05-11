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
import { isMonolithicElement } from '@stavagent/monolit-shared';

const router = express.Router();

const PORTAL_API = process.env.PORTAL_API_URL || 'https://stavagent-portal-backend-1086027517695.europe-west3.run.app';

// Default values for new positions
const DEFAULTS = { crew_size: 4, wage_czk_ph: 398, shift_hours: 10, days: 0 };

/**
 * Determine Monolit subtype from item fields.
 *
 * Pure unit-based heuristics misclassify aggregate fills ("VÝPLŇ Z KAMENIVA
 * DRCENÉHO", m³) and gravel sub-base ("PODKLADNÍ VRSTVY Z KAMENIVA TĚŽENÉHO",
 * m³) as `beton`. We delegate the monolith decision to the shared classifier
 * so non-monolithic m³ rows fall through to subtype `jiné`.
 */
function determineSubtype(item) {
  const desc = (item.popis || '').toLowerCase();
  const unit = (item.mj || '').toLowerCase();

  // Strong textual signals beat the unit heuristic.
  if (desc.includes('výztuž') || desc.includes('ocel') || desc.includes('b500')) return 'výztuž';
  if (desc.includes('bedn') || desc.includes('odbedň')) return 'bednění';

  if (unit === 'm3' || unit === 'm³') {
    // Aggregate fills / sub-base layers come in as m³ but are NOT concrete.
    const isMonolith = isMonolithicElement({
      item_name: item.popis || '',
      otskp_code: item.kod || null,
    });
    return isMonolith ? 'beton' : 'jiné';
  }
  if (unit === 'm2' || unit === 'm²') return 'bednění';
  if (unit === 't' || unit === 'kg') return 'výztuž';

  if (desc.includes('beton') || desc.includes('železobet')) return 'beton';

  return 'jiné';
}

/**
 * GET /api/import-from-registry/projects
 * Returns list of projects available for import.
 * Strategy: fetch Portal + Registry in parallel, merge results.
 * Each source has its own timeout; failures are non-fatal.
 */
router.get('/projects', async (req, res) => {
  const userId = req.user?.userId || req.query.user_id || 1;
  const PORTAL_TIMEOUT = parseInt(process.env.PORTAL_TIMEOUT_MS || '5000', 10);
  const REGISTRY_TIMEOUT = parseInt(process.env.REGISTRY_TIMEOUT_MS || '8000', 10);
  const REGISTRY_API = process.env.REGISTRY_API_URL || 'https://rozpocet-registry-backend-1086027517695.europe-west3.run.app';

  logger.info(`[ImportRegistry] Fetching projects (userId=${userId})...`);

  const debug = {
    portal: { tried: false, ok: false, count: 0, error: null },
    registry: { tried: false, ok: false, count: 0, error: null },
  };

  // Helper: fetch Portal projects via public integration endpoint (no auth)
  // Uses /api/integration/list-registry-projects which filters by kiosk_type='registry'
  // intrinsically — no user-scoping, no auth required (cross-kiosk pattern).
  const fetchPortalProjects = async () => {
    debug.portal.tried = true;
    try {
      const response = await fetch(`${PORTAL_API}/api/integration/list-registry-projects`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(PORTAL_TIMEOUT),
      });
      if (!response.ok) {
        debug.portal.error = `HTTP ${response.status}`;
        logger.warn(`[ImportRegistry] Portal returned ${response.status}`);
        return [];
      }
      const data = await response.json();
      const portalProjects = data.projects || [];
      // Endpoint already filters by kiosk_type='registry', no extra filter needed
      const mapped = portalProjects.map(p => ({
        portal_project_id: p.portal_project_id,
        project_name: p.project_name,
        positions_total: p.positions_total || 0,
        registry_linked: p.registry_linked || 0,
        updated_at: p.updated_at || null,
        source: 'portal',
      }));
      debug.portal.ok = true;
      debug.portal.count = mapped.length;
      return mapped;
    } catch (err) {
      debug.portal.error = err.message;
      logger.warn(`[ImportRegistry] Portal fetch failed: ${err.message}`);
      return [];
    }
  };

  // Helper: fetch Registry projects directly (fallback)
  const fetchRegistryProjects = async () => {
    debug.registry.tried = true;
    try {
      const url = `${REGISTRY_API}/api/registry/projects?user_id=${encodeURIComponent(userId)}`;
      const regRes = await fetch(url, { signal: AbortSignal.timeout(REGISTRY_TIMEOUT) });
      if (!regRes.ok) {
        debug.registry.error = `HTTP ${regRes.status}`;
        return [];
      }
      const regData = await regRes.json();
      const regProjects = (regData.projects || []).map(p => ({
        portal_project_id: p.portal_project_id || p.project_id,
        project_name: p.project_name || p.name || 'Bez názvu',
        positions_total: p.items_count || p.item_count || 0,
        sheet_count: p.sheets_count || p.sheet_count || 0,
        updated_at: p.updated_at || null,
        source: 'registry',
      }));
      debug.registry.ok = true;
      debug.registry.count = regProjects.length;
      return regProjects;
    } catch (err) {
      debug.registry.error = err.message;
      logger.warn(`[ImportRegistry] Registry fallback failed: ${err.message}`);
      return [];
    }
  };

  // Parallel fetch — take whichever returns first (with results)
  const [portalProjects, registryProjects] = await Promise.all([
    fetchPortalProjects(),
    fetchRegistryProjects(),
  ]);

  // Merge: prefer Portal projects (they have full cross-kiosk stats);
  // add Registry projects that don't overlap by portal_project_id
  const portalIds = new Set(portalProjects.map(p => p.portal_project_id));
  const merged = [
    ...portalProjects,
    ...registryProjects.filter(p => !portalIds.has(p.portal_project_id)),
  ];

  logger.info(`[ImportRegistry] Result: ${merged.length} projects (Portal: ${debug.portal.count}, Registry: ${debug.registry.count})`);

  res.json({ success: true, projects: merged, debug });
});

/**
 * POST /api/import-from-registry
 * Body: { portal_project_id: string, project_name?: string }
 *
 * Fetches positions from Portal integration API and saves as Monolit positions.
 */
router.post('/', async (req, res) => {
  try {
    const { portal_project_id, project_name, source } = req.body;
    const portalUserId = req.user?.userId || null;

    if (!portal_project_id) {
      return res.status(400).json({ error: 'portal_project_id is required' });
    }

    // Input validation: prevent path traversal in URL interpolation
    if (!/^[a-zA-Z0-9_\-]+$/.test(portal_project_id)) {
      logger.warn(`[ImportRegistry] Invalid portal_project_id format: ${portal_project_id}`);
      return res.status(400).json({ error: 'Invalid portal_project_id format' });
    }

    logger.info(`[ImportRegistry] Importing project ${portal_project_id} (source=${source || 'portal'})...`);

    // Configurable timeouts via env
    const PORTAL_TIMEOUT = parseInt(process.env.PORTAL_TIMEOUT_MS || '5000', 10);
    const REGISTRY_TIMEOUT = parseInt(process.env.REGISTRY_TIMEOUT_MS || '8000', 10);

    let projectData = null;

    // Try Portal first (primary path)
    try {
      const response = await fetch(`${PORTAL_API}/api/integration/for-registry/${portal_project_id}`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(PORTAL_TIMEOUT),
      });
      if (response.ok) {
        const data = await response.json();
        projectData = data.project;
      } else {
        logger.warn(`[ImportRegistry] Portal returned ${response.status} for project ${portal_project_id}`);
      }
    } catch (portalErr) {
      logger.warn(`[ImportRegistry] Portal fetch failed: ${portalErr.message}`);
    }

    // Fallback: fetch directly from Registry backend if Portal failed or returned no data
    if (!projectData || !projectData.sheets || projectData.sheets.length === 0) {
      logger.info('[ImportRegistry] Trying direct Registry backend fetch...');
      const REGISTRY_API = process.env.REGISTRY_API_URL || 'https://rozpocet-registry-backend-1086027517695.europe-west3.run.app';
      try {
        const regRes = await fetch(`${REGISTRY_API}/api/registry/projects/${portal_project_id}`, {
          signal: AbortSignal.timeout(REGISTRY_TIMEOUT),
        });
        if (regRes.ok) {
          const regData = await regRes.json();
          const regProject = regData.project;
          if (regProject) {
            const sheetsRes = await fetch(`${REGISTRY_API}/api/registry/projects/${portal_project_id}/sheets`, {
              signal: AbortSignal.timeout(REGISTRY_TIMEOUT),
            });
            if (sheetsRes.ok) {
              const sheetsData = await sheetsRes.json();

              // Parallel fetch: all sheet items at once (avoids N+1 sequential problem)
              const sheetResults = await Promise.all(
                (sheetsData.sheets || []).map(async (sheet) => {
                  try {
                    const itemsRes = await fetch(`${REGISTRY_API}/api/registry/sheets/${sheet.sheet_id}/items`, {
                      signal: AbortSignal.timeout(REGISTRY_TIMEOUT),
                    });
                    if (itemsRes.ok) {
                      const itemsData = await itemsRes.json();
                      return {
                        name: sheet.sheet_name || 'Sheet',
                        items: (itemsData.items || []).map(i => ({
                          id: i.item_id,
                          kod: i.kod || '',
                          popis: i.popis || '',
                          mnozstvi: i.mnozstvi || 0,
                          mj: i.mj || '',
                          cenaJednotkova: i.cena_jednotkova || 0,
                          cenaCelkem: i.cena_celkem || 0,
                          position_instance_id: i.position_instance_id || null,
                        })),
                      };
                    }
                    logger.warn(`[ImportRegistry] Failed to fetch items for sheet ${sheet.sheet_id}: HTTP ${itemsRes.status}`);
                    return null;
                  } catch (sheetErr) {
                    logger.warn(`[ImportRegistry] Failed to fetch sheet ${sheet.sheet_id}: ${sheetErr.message}`);
                    return null;
                  }
                })
              );

              const sheets = sheetResults.filter(Boolean);
              if (sheets.length > 0) {
                projectData = {
                  id: portal_project_id,
                  name: regProject.project_name || project_name || 'Import z Registry',
                  sheets,
                };
                const skipped = sheetResults.length - sheets.length;
                logger.info(`[ImportRegistry] Loaded ${sheets.length} sheets from Registry${skipped > 0 ? ` (${skipped} failed)` : ''}`);
              }
            }
          }
        }
      } catch (regErr) {
        logger.warn(`[ImportRegistry] Registry direct fetch failed: ${regErr.message}`);
      }
    }

    if (!projectData || !projectData.sheets || projectData.sheets.length === 0) {
      return res.status(404).json({ error: 'Project has no sheets/positions in Portal or Registry' });
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
