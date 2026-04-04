/**
 * Export to Registry routes
 * POST /api/export-to-registry/:bridge_id
 * Export Monolit project positions to Rozpočet Registry with TOV data and prices
 */

import express from 'express';
import db from '../db/init.js';

const router = express.Router();

// Environment URLs — Cloud Run (europe-west3)
const PORTAL_API = process.env.PORTAL_API_URL || 'https://stavagent-portal-backend-1086027517695.europe-west3.run.app';
const REGISTRY_API = process.env.REGISTRY_API_URL || 'https://rozpocet-registry-backend-1086027517695.europe-west3.run.app';
const REGISTRY_URL = process.env.REGISTRY_URL || 'https://registry.stavagent.cz';

/**
 * Authentication middleware for export endpoints.
 *
 * Requires EXPORT_API_KEY environment variable to be set.
 * Callers must send:  Authorization: Bearer <key>
 *                  or X-Export-Token: <key>
 *
 * Fails closed: if EXPORT_API_KEY is not configured the request is rejected
 * in all environments (no silent dev bypass).
 */
function requireExportAuth(req, res, next) {
  const expectedKey = process.env.EXPORT_API_KEY;

  // If EXPORT_API_KEY is not configured, allow requests without auth
  // (internal frontend-to-backend calls don't need external API key)
  if (!expectedKey) {
    console.warn('[Export] EXPORT_API_KEY not set — allowing request without auth');
    return next();
  }

  const authHeader = req.headers['authorization'];
  const tokenHeader = req.headers['x-export-token'];

  // Accept either "Authorization: Bearer <key>" or "X-Export-Token: <key>"
  const provided =
    (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
    tokenHeader ||
    null;

  if (!provided || provided !== expectedKey) {
    console.warn('[Export] Unauthorized export attempt — invalid or missing token');
    return res.status(401).json({ error: 'Unauthorized — invalid or missing export token' });
  }

  next();
}

/**
 * POST /api/export-to-registry/:bridge_id
 * Export project to Registry with Portal integration
 */
router.post('/:bridge_id', requireExportAuth, async (req, res) => {
  const { bridge_id } = req.params;
  // Optional: filter export to a single construction part
  const { monolit_url, part_name: filterPartName } = req.body || {};

  if (!bridge_id || typeof bridge_id !== 'string' || bridge_id.length > 255) {
    return res.status(400).json({ error: 'Invalid bridge_id' });
  }

  try {
    // 1. Fetch project data
    const project = await db.prepare(`
      SELECT project_id, project_name, object_name, concrete_m3
      FROM monolith_projects
      WHERE project_id = ?
    `).get(bridge_id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 2. Fetch positions — optionally filtered by part_name
    let positions;
    if (filterPartName) {
      positions = await db.prepare(`
        SELECT * FROM positions WHERE bridge_id = ? AND part_name = ? ORDER BY created_at
      `).all(bridge_id, filterPartName);
    } else {
      positions = await db.prepare(`
        SELECT * FROM positions WHERE bridge_id = ? ORDER BY part_name, created_at
      `).all(bridge_id);
    }

    if (!positions || positions.length === 0) {
      return res.status(400).json({ error: filterPartName ? `Část "${filterPartName}" nemá žádné pozice` : 'No positions to export' });
    }

    // 3. Check/create Portal project (non-blocking – Portal may be sleeping on free tier)
    let portalProjectId = null;
    try {
      const checkRes = await fetch(`${PORTAL_API}/api/portal-projects/by-kiosk/monolit/${bridge_id}`);

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        portalProjectId = checkData.project?.portal_project_id || null;
      } else {
        const createRes = await fetch(`${PORTAL_API}/api/portal-projects/create-from-kiosk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_name: project.project_name || bridge_id,
            project_type: 'monolit',
            kiosk_type: 'monolit',
            kiosk_project_id: bridge_id
          })
        });

        if (createRes.ok) {
          const createData = await createRes.json();
          portalProjectId = createData.portal_project_id || null;
        }
      }
    } catch (portalErr) {
      console.warn('[Export] Portal project lookup failed (non-critical):', portalErr.message);
    }

    // 4. Group positions by part_name for Portal objects
    const positionsByPart = positions.reduce((acc, pos) => {
      const partName = pos.part_name || 'Bez části';
      if (!acc[partName]) acc[partName] = [];
      acc[partName].push(pos);
      return acc;
    }, {});

    // 5. Map to Portal format with full TOV data, prices, monolith_payload for deep-linking
    const MONOLIT_FRONTEND_URL = process.env.MONOLIT_FRONTEND_URL || 'https://kalkulator.stavagent.cz';

    const objects = Object.entries(positionsByPart).map(([partName, partPositions]) => ({
      code: partName,
      name: `Objekt ${partName}`,
      positions: partPositions.map((pos) => ({
        monolit_id: pos.id,
        position_instance_id: pos.position_instance_id || null,
        kod: pos.otskp_code || '',
        popis: pos.item_name || partName,
        mnozstvi: pos.qty || 0,
        mj: pos.unit || '',
        cena_jednotkova: pos.unit_cost_native || pos.kros_unit_czk || 0,
        cena_celkem: pos.cost_czk || pos.kros_total_czk || 0,
        // MonolithPayload (PositionInstance Architecture v1.0)
        monolith_payload: {
          monolit_position_id: pos.id,
          monolit_project_id: bridge_id,
          part_name: partName,
          monolit_url: `${MONOLIT_FRONTEND_URL}/?project=${bridge_id}`,
          subtype: pos.subtype,
          otskp_code: pos.otskp_code || null,
          item_name: pos.item_name || null,
          crew_size: pos.crew_size || 0,
          wage_czk_ph: pos.wage_czk_ph || 0,
          shift_hours: pos.shift_hours || 0,
          days: pos.days || 0,
          curing_days: null,
          labor_hours: pos.labor_hours || 0,
          cost_czk: pos.cost_czk || 0,
          unit_cost_native: pos.unit_cost_native || null,
          concrete_m3: pos.concrete_m3 || null,
          unit_cost_on_m3: pos.unit_cost_on_m3 || null,
          kros_unit_czk: pos.kros_unit_czk || null,
          kros_total_czk: pos.kros_total_czk || null,
          source_tag: 'MONOLIT_EXPORT',
          assumptions_log: '',
          confidence: 1.0,
          calculated_at: pos.updated_at || new Date().toISOString()
        },
        tov: {
          labor: mapPositionToLabor(pos),
          machinery: mapPositionToMachinery(pos),
          materials: mapPositionToMaterials(partName, pos)
        }
      }))
    }));

    // 6. Import to Portal (non-blocking, best effort)
    // Portal returns instance_mapping: [{monolit_id, position_instance_id}]
    // We store these IDs back in Monolit for future write-back
    try {
      const importRes = await fetch(`${PORTAL_API}/api/integration/import-from-monolit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portal_project_id: portalProjectId,
          project_name: project.project_name || bridge_id,
          monolit_project_id: bridge_id,
          objects
        })
      });
      if (importRes.ok) {
        const importData = await importRes.json();
        console.log('[Export] Portal sync success');

        // Store position_instance_id mapping back in Monolit DB
        // Also record registered_kros_total in metadata for drift detection
        if (importData.instance_mapping && importData.instance_mapping.length > 0) {
          for (const mapping of importData.instance_mapping) {
            try {
              const pos = positions.find(p => p.id === mapping.monolit_id);
              const krosTotal = pos?.kros_total_czk ?? null;
              // Merge registered_kros_total into existing metadata JSON
              const existingMeta = (() => {
                try { return pos?.metadata ? JSON.parse(pos.metadata) : {}; } catch { return {}; }
              })();
              const newMeta = JSON.stringify({
                ...existingMeta,
                registered_kros_total: krosTotal,
                registered_at: new Date().toISOString()
              });

              if (db.isPostgres) {
                const pool = db.getPool();
                await pool.query(
                  `UPDATE positions SET position_instance_id = COALESCE(position_instance_id, $1), metadata = $2 WHERE id = $3`,
                  [mapping.position_instance_id, newMeta, mapping.monolit_id]
                );
              } else {
                await db.prepare(
                  'UPDATE positions SET position_instance_id = COALESCE(position_instance_id, ?), metadata = ? WHERE id = ?'
                ).run(mapping.position_instance_id, newMeta, mapping.monolit_id);
              }
            } catch (mapErr) {
              console.warn(`[Export] Failed to store instance mapping for ${mapping.monolit_id}: ${mapErr.message}`);
            }
          }
          console.log(`[Export] ✅ Stored ${importData.instance_mapping.length} position_instance_id mappings with drift snapshot`);
        }

        // Also update drift snapshot for positions that already had position_instance_id (re-export)
        const alreadyLinked = positions.filter(p => p.position_instance_id && !importData.instance_mapping?.some((m) => m.monolit_id === p.id));
        for (const pos of alreadyLinked) {
          try {
            const existingMeta = (() => {
              try { return pos.metadata ? JSON.parse(pos.metadata) : {}; } catch { return {}; }
            })();
            const newMeta = JSON.stringify({
              ...existingMeta,
              registered_kros_total: pos.kros_total_czk ?? null,
              registered_at: new Date().toISOString()
            });
            if (db.isPostgres) {
              const pool = db.getPool();
              await pool.query('UPDATE positions SET metadata = $1 WHERE id = $2', [newMeta, pos.id]);
            } else {
              await db.prepare('UPDATE positions SET metadata = ? WHERE id = ?').run(newMeta, pos.id);
            }
          } catch { /* non-critical */ }
        }
      }
    } catch (portalErr) {
      console.warn('[Export] Portal sync failed (non-critical):', portalErr.message);
    }

    // 7. Direct export to Registry backend — reuse existing project if linked
    let registryProjectId = null;
    try {
      // First: check if this project was originally imported from Registry
      // by looking up portal_project_id → registry project
      if (portalProjectId) {
        try {
          const lookupRes = await fetch(`${REGISTRY_API}/api/registry/projects/by-portal/${portalProjectId}`);
          if (lookupRes.ok) {
            const lookupData = await lookupRes.json();
            registryProjectId = lookupData.project?.project_id || null;
            if (registryProjectId) {
              console.log(`[Export] Found existing Registry project ${registryProjectId} for portal ${portalProjectId}`);
            }
          }
        } catch (lookupErr) {
          console.warn('[Export] Registry lookup failed:', lookupErr.message);
        }
      }

      // If not found, create new project
      if (!registryProjectId) {
        const regProjectRes = await fetch(`${REGISTRY_API}/api/registry/projects`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_name: project.project_name || bridge_id,
            portal_project_id: portalProjectId
          })
        });

        if (regProjectRes.ok) {
          const regProject = await regProjectRes.json();
          registryProjectId = regProject.project?.project_id;
        }
      } // end if (!registryProjectId)

      if (registryProjectId) {
          // Create sheet
          const sheetRes = await fetch(`${REGISTRY_API}/api/registry/projects/${registryProjectId}/sheets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sheet_name: project.object_name || bridge_id,
              sheet_order: 0
            })
          });

          if (sheetRes.ok) {
            const sheetData = await sheetRes.json();
            const sheetId = sheetData.sheet?.sheet_id;

            if (sheetId) {
              // Create items with TOV data + monolit metadata for deep-linking
              let itemOrder = 0;
              for (const pos of positions) {
                await fetch(`${REGISTRY_API}/api/registry/sheets/${sheetId}/items`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    kod: pos.otskp_code || '',
                    popis: pos.item_name || pos.part_name || '',
                    mnozstvi: pos.qty || 0,
                    mj: pos.unit || '',
                    cena_jednotkova: pos.unit_cost_native || pos.kros_unit_czk || 0,
                    cena_celkem: pos.cost_czk || pos.kros_total_czk || 0,
                    item_order: itemOrder++,
                    monolit_metadata: {
                      project_id: bridge_id,
                      part_name: pos.part_name,
                      position_id: pos.id,
                      position_instance_id: pos.position_instance_id || null,
                      subtype: pos.subtype,
                    },
                    tov_data: {
                      labor: mapPositionToLabor(pos),
                      machinery: mapPositionToMachinery(pos),
                      materials: mapPositionToMaterials(pos.part_name || '', pos)
                    }
                  })
                });
              }
              console.log(`[Export] Created ${positions.length} items in Registry`);
            }
          }
      }
    } catch (regErr) {
      console.warn('[Export] Registry direct sync failed (non-critical):', regErr.message);
    }

    // 8. Return success with Registry URL
    res.json({
      success: true,
      portal_project_id: portalProjectId,
      registry_project_id: registryProjectId,
      registry_url: portalProjectId ? `${REGISTRY_URL}?portal_project=${portalProjectId}` : REGISTRY_URL,
      positions_count: positions.length
    });

  } catch (error) {
    console.error('[Export to Registry] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Map Monolit subtype to profession name for Labor TOV
function mapPositionToLabor(pos) {
  const crewSize = pos.crew_size || 0;
  const shiftHours = pos.shift_hours || 0;
  const totalDays = pos.days || 0;
  const hourlyRate = pos.wage_czk_ph || 0;
  const normHours = pos.labor_hours || (crewSize * shiftHours * totalDays);
  const totalCost = pos.cost_czk || 0;

  const professionMap = {
    'beton': 'Betonář',
    'bednění': 'Tesař',
    'odbednění': 'Tesař',
    'výztuž': 'Železář / Armovač',
    'jiné': 'Stavební dělník'
  };

  return [{
    id: `labor_${pos.id}`,
    name: professionMap[pos.subtype] || 'Stavební dělník',
    count: crewSize,
    hours: shiftHours,
    days: totalDays,
    normHours: normHours,
    hourlyRate: hourlyRate,
    totalCost: totalCost
  }];
}

// Helper: Map Monolit position to Machinery TOV
function mapPositionToMachinery(pos) {
  const machinery = [];
  if (pos.subtype === 'beton' && pos.qty > 0) {
    machinery.push({
      id: `mach_${pos.id}_pump`,
      name: 'Čerpadlo betonové směsi',
      hours: Math.ceil(pos.qty / 20),
      hourlyRate: 2500,
      totalCost: Math.ceil(pos.qty / 20) * 2500
    });
  }
  if (pos.subtype === 'výztuž' && pos.qty > 0) {
    machinery.push({
      id: `mach_${pos.id}_crane`,
      name: 'Autojeřáb',
      hours: Math.ceil((pos.unit === 'T' ? pos.qty : pos.qty / 1000) / 5),
      hourlyRate: 3500,
      totalCost: Math.ceil((pos.unit === 'T' ? pos.qty : pos.qty / 1000) / 5) * 3500
    });
  }
  return machinery;
}

// Helper: Map Monolit position to Materials TOV
function mapPositionToMaterials(partName, pos) {
  const materials = [];

  if (pos.subtype === 'beton' && pos.qty > 0) {
    const gradeMatch = (pos.item_name || partName || '').match(/C\d+\/\d+/i);
    materials.push({
      id: `mat_${pos.id}_beton`,
      name: `Beton ${gradeMatch ? gradeMatch[0] : 'C30/37'}`,
      quantity: pos.concrete_m3 || pos.qty,
      unit: 'm³',
      unitPrice: pos.unit_cost_native || 0,
      totalCost: pos.cost_czk || 0
    });
  }

  if (pos.subtype === 'výztuž' && pos.qty > 0) {
    materials.push({
      id: `mat_${pos.id}_ocel`,
      name: 'Ocel betonářská 10505 (R)',
      quantity: pos.qty,
      unit: pos.unit === 'T' ? 't' : 'kg',
      unitPrice: pos.unit_cost_native || 0,
      totalCost: pos.cost_czk || 0
    });
  }

  if (pos.subtype === 'bednění' && pos.qty > 0) {
    materials.push({
      id: `mat_${pos.id}_bednicka`,
      name: 'Systémové bednění (pronájem)',
      quantity: pos.qty,
      unit: 'm²',
      unitPrice: pos.unit_cost_native || 0,
      totalCost: pos.cost_czk || 0
    });
  }

  return materials;
}

/**
 * GET /api/export-to-registry/:bridge_id
 * Return project data in Portal-compatible format (for KioskLinksPanel pull).
 * Does NOT sync to Portal or Registry — read-only data export.
 */
router.get('/:bridge_id', requireExportAuth, async (req, res) => {
  const { bridge_id } = req.params;

  if (!bridge_id || typeof bridge_id !== 'string' || bridge_id.length > 255) {
    return res.status(400).json({ error: 'Invalid bridge_id' });
  }

  try {
    const project = await db.prepare(`
      SELECT project_id, project_name, object_name, concrete_m3
      FROM monolith_projects WHERE project_id = ?
    `).get(bridge_id);

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const positions = await db.prepare(`
      SELECT * FROM positions WHERE bridge_id = ? ORDER BY part_name, created_at
    `).all(bridge_id);

    const positionsByPart = positions.reduce((acc, pos) => {
      const partName = pos.part_name || 'Bez části';
      if (!acc[partName]) acc[partName] = [];
      acc[partName].push(pos);
      return acc;
    }, {});

    const MONOLIT_FRONTEND_URL = process.env.MONOLIT_FRONTEND_URL || 'https://kalkulator.stavagent.cz';

    const objects = Object.entries(positionsByPart).map(([partName, partPositions]) => ({
      code: partName,
      name: `Objekt ${partName}`,
      positions: partPositions.map(pos => ({
        monolit_id: pos.id,
        position_instance_id: pos.position_instance_id || null,
        kod: pos.otskp_code || '',
        popis: pos.item_name || partName,
        mnozstvi: pos.qty || 0,
        mj: pos.unit || '',
        cena_jednotkova: pos.unit_cost_native || pos.kros_unit_czk || 0,
        cena_celkem: pos.cost_czk || pos.kros_total_czk || 0,
        monolith_payload: {
          monolit_position_id: pos.id,
          monolit_project_id: bridge_id,
          part_name: partName,
          monolit_url: `${MONOLIT_FRONTEND_URL}/?project=${bridge_id}`,
          subtype: pos.subtype,
          otskp_code: pos.otskp_code || null,
          item_name: pos.item_name || null,
          crew_size: pos.crew_size || 0,
          wage_czk_ph: pos.wage_czk_ph || 0,
          shift_hours: pos.shift_hours || 0,
          days: pos.days || 0,
          labor_hours: pos.labor_hours || 0,
          cost_czk: pos.cost_czk || 0,
          concrete_m3: pos.concrete_m3 || null,
          unit_cost_on_m3: pos.unit_cost_on_m3 || null,
          kros_unit_czk: pos.kros_unit_czk || null,
          kros_total_czk: pos.kros_total_czk || null,
          source_tag: 'MONOLIT_EXPORT',
          confidence: 1.0,
          calculated_at: pos.updated_at || new Date().toISOString()
        },
        tov: {
          labor: mapPositionToLabor(pos),
          machinery: mapPositionToMachinery(pos),
          materials: mapPositionToMaterials(partName, pos)
        }
      }))
    }));

    res.json({
      project_name: project.project_name || bridge_id,
      project_id: bridge_id,
      objects
    });

  } catch (error) {
    console.error('[Export GET] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/export-to-registry/position/:position_id/tov
 * Sync a single position's TOV data to Portal DOV endpoint.
 *
 * Monolit sends ONLY:
 *   - Labor (práce) — the core output of Monolit Planner
 *   - Formwork rental info (for bednění positions)
 *
 * Monolit does NOT send:
 *   - Materials (beton price, ocel price → chosen in Registry TOV)
 *   - Machinery (čerpadlo, jeřáb → filled in Registry TOV)
 *
 * Three composition variants (auto-detected from sibling positions):
 *   A. All-in-one: beton only (vč. bednění, výztuže) → labor = Betonář + Tesař + Železář
 *   B. Beton+bednění together, výztuž separate → beton labor = Betonář + Tesař
 *   C. All separate: beton + bednění + odbednění + výztuž → each gets own profession
 */
router.post('/position/:position_id/tov', async (req, res) => {
  const { position_id } = req.params;

  try {
    // Fetch the target position
    const position = await db.prepare(
      'SELECT * FROM positions WHERE id = ?'
    ).get(position_id);

    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    if (!position.position_instance_id) {
      return res.status(400).json({
        error: 'Position not linked to Portal (no position_instance_id). Export to Registry first.',
      });
    }

    // Fetch all sibling positions (same part_name in same bridge) to detect composition
    const siblings = await db.prepare(
      'SELECT * FROM positions WHERE bridge_id = ? AND part_name = ?'
    ).all(position.bridge_id, position.part_name);

    const hasVyzuzSibling = siblings.some(s => s.subtype === 'výztuž' && s.id !== position.id);
    const hasBedneniSibling = siblings.some(s => (s.subtype === 'bednění' || s.subtype === 'odbednění') && s.id !== position.id);

    // Build labor array for THIS position
    const labor = [];
    const crewSize = position.crew_size || 0;
    const shiftHours = position.shift_hours || 0;
    const totalDays = position.days || 0;
    const hourlyRate = position.wage_czk_ph || 0;
    const normHours = position.labor_hours || (crewSize * shiftHours * totalDays);
    const totalCost = position.cost_czk || 0;

    const professionMap = {
      'beton': 'Betonář',
      'bednění': 'Tesař',
      'odbednění': 'Tesař',
      'výztuž': 'Železář / Armovač',
      'jiné': 'Stavební dělník',
    };

    // Own labor — always present
    labor.push({
      id: `labor_${position.id}`,
      name: professionMap[position.subtype] || 'Stavební dělník',
      count: crewSize,
      hours: shiftHours,
      days: totalDays,
      normHours,
      hourlyRate,
      totalCost,
    });

    // For beton positions: add missing professions if no separate sibling exists
    if (position.subtype === 'beton') {
      // Check description for "vč. bednění" hints
      const desc = (position.item_name || '').toLowerCase();
      const formworkIncluded = desc.includes('bednění') || desc.includes('bedná') || desc.includes('lešení');
      const rebarExcluded = desc.includes('nezahrnuje') && (desc.includes('výztuž') || desc.includes('osazení'));

      // If no separate výztuž sibling and rebar is NOT excluded → add Železář labor
      if (!hasVyzuzSibling && !rebarExcluded) {
        labor.push({
          id: `labor_${position.id}_rebar`,
          name: 'Železář / Armovač',
          count: crewSize,
          hours: shiftHours,
          days: Math.max(1, Math.round(totalDays * 0.3)), // estimate: ~30% of beton days
          normHours: Math.round(normHours * 0.3),
          hourlyRate,
          totalCost: Math.round(totalCost * 0.3),
          note: 'Included in beton position (no separate výztuž)',
        });
      }

      // If no separate bednění sibling and formwork is included → add Tesař labor
      if (!hasBedneniSibling && formworkIncluded) {
        labor.push({
          id: `labor_${position.id}_formwork`,
          name: 'Tesař',
          count: crewSize,
          hours: shiftHours,
          days: Math.max(1, Math.round(totalDays * 0.4)), // estimate: ~40% of beton days
          normHours: Math.round(normHours * 0.4),
          hourlyRate,
          totalCost: Math.round(totalCost * 0.4),
          note: 'Included in beton position (vč. bednění)',
        });
      }
    }

    // Formwork rental — only for bednění/odbednění positions
    let formworkRental = null;
    if (position.subtype === 'bednění' || position.subtype === 'odbednění') {
      // Try to get formwork info from metadata
      let meta = {};
      try { meta = position.metadata ? JSON.parse(position.metadata) : {}; } catch { /* */ }

      const betonSibling = siblings.find(s => s.subtype === 'beton');
      const curingDays = betonSibling?.curing_days || 7;
      const rentalDays = totalDays + curingDays + (siblings.find(s => s.subtype === 'odbednění')?.days || 0);

      formworkRental = {
        system_name: meta.formwork_system || null,
        rental_days: rentalDays,
        rental_czk_m2_month: meta.formwork_rental_czk_m2_month || null,
        area_m2: position.qty || 0,
        note: 'Rental period = montáž + curing + demontáž',
      };
    }

    // Also attach formwork rental to beton if bednění is included (no separate sibling)
    if (position.subtype === 'beton' && !hasBedneniSibling) {
      const desc = (position.item_name || '').toLowerCase();
      if (desc.includes('bednění') || desc.includes('bedná')) {
        let meta = {};
        try { meta = position.metadata ? JSON.parse(position.metadata) : {}; } catch { /* */ }
        formworkRental = {
          system_name: meta.formwork_system || null,
          rental_days: totalDays + (position.curing_days || 7),
          rental_czk_m2_month: meta.formwork_rental_czk_m2_month || null,
          area_m2: null, // unknown — bednění area not in beton position
          note: 'Formwork included in beton position (vč. bednění)',
        };
      }
    }

    const totalLaborCost = labor.reduce((s, l) => s + (l.totalCost || 0), 0);
    const totalLaborHours = labor.reduce((s, l) => s + (l.normHours || 0), 0);

    const dovPayload = {
      labor,
      labor_summary: {
        total_norm_hours: totalLaborHours,
        total_workers: labor.reduce((s, l) => s + (l.count || 0), 0),
        total_cost_czk: totalLaborCost,
      },
      // Machinery and materials are filled in Registry TOV, not by Monolit
      machinery: [],
      machinery_summary: { total_machine_hours: 0, total_units: 0, total_cost_czk: 0 },
      materials: [],
      materials_summary: { total_cost_czk: 0, item_count: 0 },
      formwork_rental: formworkRental,
      pump_rental: null,
      // Composition variant info (for Registry UI)
      composition: {
        variant: !hasVyzuzSibling && !hasBedneniSibling ? 'A_all_in_one'
               : hasVyzuzSibling && !hasBedneniSibling ? 'B_beton_bedneni_together'
               : 'C_all_separate',
        has_vyzuz_sibling: hasVyzuzSibling,
        has_bedneni_sibling: hasBedneniSibling,
        siblings_count: siblings.length,
      },
      monolith_payload: {
        monolit_position_id: position.id,
        monolit_project_id: position.bridge_id,
        part_name: position.part_name,
        subtype: position.subtype,
        otskp_code: position.otskp_code || null,
        item_name: position.item_name || null,
        crew_size: crewSize,
        wage_czk_ph: hourlyRate,
        shift_hours: shiftHours,
        days: totalDays,
        labor_hours: normHours,
        cost_czk: totalCost,
        concrete_m3: position.concrete_m3 || null,
        unit_cost_on_m3: position.unit_cost_on_m3 || null,
        kros_unit_czk: position.kros_unit_czk || null,
        kros_total_czk: position.kros_total_czk || null,
      },
      source_tag: 'MONOLIT_TOV_SYNC',
      synced_at: new Date().toISOString(),
    };

    // Send to Portal DOV endpoint
    const portalRes = await fetch(
      `${PORTAL_API}/api/positions/${position.position_instance_id}/dov`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: dovPayload }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!portalRes.ok) {
      const errText = await portalRes.text().catch(() => '');
      console.error(`[TOV Sync] Portal returned ${portalRes.status}: ${errText}`);
      return res.status(portalRes.status).json({
        error: `Portal DOV sync failed: ${portalRes.status}`,
      });
    }

    const variant = dovPayload.composition.variant;
    console.log(`[TOV Sync] ✅ ${position.subtype} "${position.part_name}" → Portal DOV (${variant}, ${labor.length} labor entries${formworkRental ? ', +rental' : ''})`);

    res.json({
      success: true,
      position_id,
      position_instance_id: position.position_instance_id,
      composition: dovPayload.composition,
      tov: {
        labor_count: labor.length,
        labor_professions: labor.map(l => l.name),
        formwork_rental: !!formworkRental,
        total_labor_cost_czk: totalLaborCost,
      },
    });

  } catch (error) {
    console.error('[TOV Sync] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
