/**
 * Export to Registry routes
 * POST /api/export-to-registry/:bridge_id
 * Export Monolit project positions to Rozpočet Registry with TOV data and prices
 */

import express from 'express';
import db from '../db/init.js';

const router = express.Router();

// Environment URLs
const PORTAL_API = process.env.PORTAL_API_URL || 'https://stavagent-backend.vercel.app';
const REGISTRY_API = process.env.REGISTRY_API_URL || 'https://rozpocet-registry-backend.onrender.com';
const REGISTRY_URL = process.env.REGISTRY_URL || 'https://stavagent-backend-ktwx.vercel.app';

/**
 * POST /api/export-to-registry/:bridge_id
 * Export project to Registry with Portal integration
 */
router.post('/:bridge_id', async (req, res) => {
  const { bridge_id } = req.params;

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

    // 2. Fetch positions (already have calculated fields stored in DB)
    const positions = await db.prepare(`
      SELECT * FROM positions WHERE bridge_id = ? ORDER BY part_name, created_at
    `).all(bridge_id);

    if (!positions || positions.length === 0) {
      return res.status(400).json({ error: 'No positions to export' });
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

    // 5. Map to Portal format with full TOV data and prices + monolit metadata for deep-linking
    const objects = Object.entries(positionsByPart).map(([partName, partPositions]) => ({
      code: partName,
      name: `Objekt ${partName}`,
      positions: partPositions.map((pos) => ({
        monolit_id: pos.id,
        kod: pos.otskp_code || '',
        popis: pos.item_name || partName,
        mnozstvi: pos.qty || 0,
        mj: pos.unit || '',
        cena_jednotkova: pos.unit_cost_native || pos.kros_unit_czk || 0,
        cena_celkem: pos.cost_czk || pos.kros_total_czk || 0,
        // Monolit metadata for deep-linking (Registry → Monolit)
        monolit_metadata: {
          project_id: bridge_id,
          part_name: partName,
          position_id: pos.id,
          subtype: pos.subtype,
          crew_size: pos.crew_size,
          shift_hours: pos.shift_hours,
          days: pos.days,
          labor_hours: pos.labor_hours,
        },
        tov: {
          labor: mapPositionToLabor(pos),
          machinery: mapPositionToMachinery(pos),
          materials: mapPositionToMaterials(partName, pos)
        }
      }))
    }));

    // 6. Import to Portal (non-blocking, best effort)
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
        console.log('[Export] Portal sync success');
      }
    } catch (portalErr) {
      console.warn('[Export] Portal sync failed (non-critical):', portalErr.message);
    }

    // 7. Direct export to Registry backend - create project + sheet + items + TOV
    let registryProjectId = null;
    try {
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
    'bednění': 'Tesař / Bednář',
    'oboustranné (opěry)': 'Tesař / Bednář',
    'oboustranné (křídla)': 'Tesař / Bednář',
    'oboustranné (závěrné zídky)': 'Tesař / Bednář',
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

export default router;
