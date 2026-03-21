/**
 * Unified Pump Calculator API Routes
 *
 * Consolidates 3 separate pump calculators into a single Portal-managed system.
 * Supports builtin suppliers (Berger, Frischbeton, Beton Union) + user-created custom suppliers.
 *
 * Endpoints:
 *   GET    /api/pump/suppliers                   — List all suppliers (builtin + custom)
 *   GET    /api/pump/suppliers/:id               — Get single supplier with models
 *   POST   /api/pump/suppliers                   — Create custom supplier
 *   PUT    /api/pump/suppliers/:id               — Update supplier (custom only)
 *   DELETE /api/pump/suppliers/:id               — Delete supplier (custom only)
 *
 *   GET    /api/pump/suppliers/:id/models        — List models for supplier
 *   POST   /api/pump/suppliers/:id/models        — Add model to supplier
 *   PUT    /api/pump/models/:modelId             — Update model
 *   DELETE /api/pump/models/:modelId             — Delete model
 *
 *   GET    /api/pump/accessories                 — List accessories catalog
 *   POST   /api/pump/accessories                 — Add accessory
 *
 *   POST   /api/pump/calculate                   — Calculate pump cost
 *   POST   /api/pump/compare                     — Compare all suppliers
 *   POST   /api/pump/calculations                — Save calculation result
 *   GET    /api/pump/calculations/:positionId    — Get saved calculations for position
 */

import express from 'express';
import { getPool } from '../db/postgres.js';
import { USE_POSTGRES } from '../db/index.js';

const router = express.Router();

function safeGetPool() {
  if (!USE_POSTGRES) return null;
  try {
    return getPool();
  } catch (error) {
    console.error('[Pump] Failed to get database pool:', error.message);
    return null;
  }
}

// =============================================================================
// CZECH HOLIDAYS — for surcharge calculation
// =============================================================================

function getEasterMonday(year) {
  // Gauss/Butcher algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  // Easter Sunday
  const easterSunday = new Date(year, month - 1, day);
  // Easter Monday = +1 day
  const easterMonday = new Date(easterSunday);
  easterMonday.setDate(easterMonday.getDate() + 1);
  // Good Friday = -2 days
  const goodFriday = new Date(easterSunday);
  goodFriday.setDate(goodFriday.getDate() - 2);
  return { goodFriday, easterMonday };
}

function getCzechHolidays(year) {
  const { goodFriday, easterMonday } = getEasterMonday(year);
  const fixed = [
    [0, 1], [4, 1], [4, 8], [6, 5], [6, 6],
    [8, 28], [9, 28], [10, 17], [11, 24], [11, 25], [11, 26]
  ];
  const holidays = fixed.map(([m, d]) => new Date(year, m, d));
  holidays.push(goodFriday, easterMonday);
  return holidays;
}

function getDayType(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'workday';
  const holidays = getCzechHolidays(d.getFullYear());
  const isHoliday = holidays.some(h =>
    h.getDate() === d.getDate() && h.getMonth() === d.getMonth()
  );
  if (isHoliday) return 'holiday';
  const dow = d.getDay();
  if (dow === 0) return 'sunday';
  if (dow === 6) return 'saturday';
  return 'workday';
}

// =============================================================================
// CALCULATION ENGINE
// =============================================================================

function calculatePumpCost(supplier, model, input) {
  const {
    vzdalenost_km = 0,
    celkem_m3 = 0,
    hodiny_cerpani = 0,
    pocet_pristaveni = 1,
    stavba_h = 0.5,
    myti_h = 0.5,
    accessories = [],
    surcharges: customSurcharges = [],
    date = null,
    is_night = false
  } = input;

  // 1. Transport (arrival)
  const arrivalFixed = parseFloat(model.arrival_fixed_czk) || 0;
  const arrivalPerKm = parseFloat(model.arrival_per_km_czk) || 0;
  const doprava = pocet_pristaveni * (arrivalFixed + vzdalenost_km * arrivalPerKm * 2);

  // 2. Pumping hours
  const vykonM3h = parseFloat(model.practical_m3_h) || 30;
  const hodinyCerpani = hodiny_cerpani > 0 ? hodiny_cerpani : (celkem_m3 / vykonM3h);
  const hodinyOverhead = pocet_pristaveni * (stavba_h + myti_h);
  const hodinyCelkem = hodinyCerpani + hodinyOverhead;

  // 3. Operation cost (depends on billing model)
  let manipulace = 0;
  const billingModel = supplier.billing_model;
  const operationPerH = parseFloat(model.operation_per_h_czk) || 0;
  const operationPer15 = parseFloat(model.operation_per_15min_czk) || 0;
  const volumePerM3 = parseFloat(model.volume_per_m3_czk) || 0;

  if (billingModel === 'hourly') {
    manipulace = operationPerH * hodinyCelkem;
  } else if (billingModel === 'hourly_plus_m3') {
    manipulace = operationPerH * hodinyCelkem + volumePerM3 * celkem_m3;
  } else if (billingModel === 'per_15min') {
    const blocks = Math.ceil(hodinyCelkem * 4);
    manipulace = blocks * operationPer15;
  } else {
    // custom — use operation_per_h if available
    manipulace = operationPerH * hodinyCelkem;
  }

  // 4. Per-m³ surcharge (from model)
  const priplatekM3 = (parseFloat(model.priplatek_czk_m3) || 0) * celkem_m3;

  // 5. Accessories
  const celkemPrislusenstvi = accessories.reduce((sum, a) =>
    sum + (parseFloat(a.czk_per_unit) || 0) * (parseFloat(a.mnozstvi) || 0), 0);

  // 6. Custom surcharges
  const celkemPriplatky = customSurcharges.reduce((sum, s) =>
    sum + (parseFloat(s.czk_per_pristaveni) || 0) * pocet_pristaveni, 0);

  // 7. Day-type surcharges (from supplier.surcharges)
  let dayTypeSurcharge = 0;
  if (date && supplier.surcharges) {
    const dayType = getDayType(date);
    const sc = supplier.surcharges;
    if (dayType === 'saturday' || dayType === 'holiday') {
      if (sc.saturday_pct) dayTypeSurcharge = manipulace * sc.saturday_pct / 100;
      else if (sc.saturday) dayTypeSurcharge = parseFloat(sc.saturday) * pocet_pristaveni;
    }
    if (dayType === 'sunday' || dayType === 'holiday') {
      if (sc.sunday_pct) dayTypeSurcharge = manipulace * sc.sunday_pct / 100;
      else if (sc.sunday) dayTypeSurcharge = parseFloat(sc.sunday) * pocet_pristaveni;
      else if (sc.sunday_per_h) dayTypeSurcharge = parseFloat(sc.sunday_per_h) * hodinyCelkem;
    }
    if (is_night) {
      if (sc.night_pct) dayTypeSurcharge += manipulace * sc.night_pct / 100;
      else if (sc.night) dayTypeSurcharge += parseFloat(sc.night) * pocet_pristaveni;
      else if (sc.night_per_h) dayTypeSurcharge += parseFloat(sc.night_per_h) * hodinyCelkem;
    }
  }

  const konecnaCena = doprava + manipulace + priplatekM3 + celkemPrislusenstvi + celkemPriplatky + dayTypeSurcharge;
  const cenaPerM3 = celkem_m3 > 0 ? konecnaCena / celkem_m3 : 0;

  return {
    supplier_slug: supplier.slug,
    supplier_name: supplier.name,
    model_name: model.name,
    billing_model: billingModel,
    // Inputs echoed back
    vzdalenost_km,
    celkem_m3,
    pocet_pristaveni,
    vykon_m3h: vykonM3h,
    stavba_h,
    myti_h,
    // Calculated hours
    hodiny_cerpani: Math.round(hodinyCerpani * 100) / 100,
    hodiny_overhead: Math.round(hodinyOverhead * 100) / 100,
    hodiny_celkem: Math.round(hodinyCelkem * 100) / 100,
    // Cost breakdown
    doprava: Math.round(doprava),
    manipulace: Math.round(manipulace),
    priplatek_m3: Math.round(priplatekM3),
    prislusenstvi: Math.round(celkemPrislusenstvi),
    priplatky: Math.round(celkemPriplatky),
    day_type_surcharge: Math.round(dayTypeSurcharge),
    konecna_cena: Math.round(konecnaCena),
    cena_per_m3: Math.round(cenaPerM3)
  };
}

// =============================================================================
// SUPPLIERS CRUD
// =============================================================================

/**
 * GET /api/pump/suppliers — List all suppliers
 */
router.get('/suppliers', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const { rows } = await pool.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM pump_models m WHERE m.supplier_id = s.id) AS model_count
      FROM pump_suppliers s
      ORDER BY s.is_builtin DESC, s.name ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('[Pump] Error listing suppliers:', error.message);
    res.status(500).json({ error: 'Failed to list suppliers' });
  }
});

/**
 * GET /api/pump/suppliers/:id — Single supplier with models
 */
router.get('/suppliers/:id', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const { rows: [supplier] } = await pool.query(
      'SELECT * FROM pump_suppliers WHERE id = $1 OR slug = $1',
      [req.params.id]
    );
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    const { rows: models } = await pool.query(
      'SELECT * FROM pump_models WHERE supplier_id = $1 ORDER BY sort_order, reach_m',
      [supplier.id]
    );

    res.json({ ...supplier, models });
  } catch (error) {
    console.error('[Pump] Error getting supplier:', error.message);
    res.status(500).json({ error: 'Failed to get supplier' });
  }
});

/**
 * POST /api/pump/suppliers — Create custom supplier
 */
router.post('/suppliers', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const { slug, name, billing_model, contact, surcharges, hose_per_m_per_day, metadata } = req.body;

  if (!slug || !name || !billing_model) {
    return res.status(400).json({ error: 'slug, name, and billing_model are required' });
  }

  const validModels = ['hourly', 'hourly_plus_m3', 'per_15min', 'custom'];
  if (!validModels.includes(billing_model)) {
    return res.status(400).json({ error: `billing_model must be one of: ${validModels.join(', ')}` });
  }

  try {
    const { rows: [supplier] } = await pool.query(`
      INSERT INTO pump_suppliers (slug, name, billing_model, is_builtin, contact, surcharges, hose_per_m_per_day, metadata, created_by)
      VALUES ($1, $2, $3, false, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      slug, name, billing_model,
      JSON.stringify(contact || {}),
      JSON.stringify(surcharges || {}),
      hose_per_m_per_day || null,
      JSON.stringify(metadata || {}),
      req.user?.id || null
    ]);

    res.status(201).json(supplier);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: `Supplier with slug "${slug}" already exists` });
    }
    console.error('[Pump] Error creating supplier:', error.message);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

/**
 * PUT /api/pump/suppliers/:id — Update supplier (custom only)
 */
router.put('/suppliers/:id', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    // Check if builtin
    const { rows: [existing] } = await pool.query(
      'SELECT is_builtin FROM pump_suppliers WHERE id = $1 OR slug = $1',
      [req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'Supplier not found' });
    if (existing.is_builtin) return res.status(403).json({ error: 'Cannot modify builtin suppliers' });

    const { name, billing_model, contact, surcharges, hose_per_m_per_day, metadata } = req.body;

    const { rows: [supplier] } = await pool.query(`
      UPDATE pump_suppliers SET
        name = COALESCE($1, name),
        billing_model = COALESCE($2, billing_model),
        contact = COALESCE($3, contact),
        surcharges = COALESCE($4, surcharges),
        hose_per_m_per_day = COALESCE($5, hose_per_m_per_day),
        metadata = COALESCE($6, metadata),
        updated_at = NOW()
      WHERE id = $7 OR slug = $7
      RETURNING *
    `, [
      name, billing_model,
      contact ? JSON.stringify(contact) : null,
      surcharges ? JSON.stringify(surcharges) : null,
      hose_per_m_per_day,
      metadata ? JSON.stringify(metadata) : null,
      req.params.id
    ]);

    res.json(supplier);
  } catch (error) {
    console.error('[Pump] Error updating supplier:', error.message);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

/**
 * DELETE /api/pump/suppliers/:id — Delete supplier (custom only)
 */
router.delete('/suppliers/:id', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const { rows: [existing] } = await pool.query(
      'SELECT is_builtin FROM pump_suppliers WHERE id = $1 OR slug = $1',
      [req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'Supplier not found' });
    if (existing.is_builtin) return res.status(403).json({ error: 'Cannot delete builtin suppliers' });

    await pool.query('DELETE FROM pump_suppliers WHERE id = $1 OR slug = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (error) {
    console.error('[Pump] Error deleting supplier:', error.message);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

// =============================================================================
// MODELS CRUD
// =============================================================================

/**
 * GET /api/pump/suppliers/:id/models — List models for supplier
 */
router.get('/suppliers/:id/models', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const { rows: [supplier] } = await pool.query(
      'SELECT id FROM pump_suppliers WHERE id = $1 OR slug = $1',
      [req.params.id]
    );
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    const { rows } = await pool.query(
      'SELECT * FROM pump_models WHERE supplier_id = $1 ORDER BY sort_order, reach_m',
      [supplier.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('[Pump] Error listing models:', error.message);
    res.status(500).json({ error: 'Failed to list models' });
  }
});

/**
 * POST /api/pump/suppliers/:id/models — Add model to supplier
 */
router.post('/suppliers/:id/models', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const { rows: [supplier] } = await pool.query(
      'SELECT id, is_builtin FROM pump_suppliers WHERE id = $1 OR slug = $1',
      [req.params.id]
    );
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    const {
      name, reach_m, boom_m, arrival_fixed_czk, arrival_per_km_czk,
      operation_per_h_czk, operation_per_15min_czk, volume_per_m3_czk,
      practical_m3_h, theoretical_m3_h, priplatek_czk_m3, notes, metadata, sort_order
    } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows: [model] } = await pool.query(`
      INSERT INTO pump_models (
        supplier_id, name, reach_m, boom_m, arrival_fixed_czk, arrival_per_km_czk,
        operation_per_h_czk, operation_per_15min_czk, volume_per_m3_czk,
        practical_m3_h, theoretical_m3_h, priplatek_czk_m3, notes, metadata, sort_order
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `, [
      supplier.id, name, reach_m || null, boom_m || null,
      arrival_fixed_czk || null, arrival_per_km_czk || null,
      operation_per_h_czk || null, operation_per_15min_czk || null,
      volume_per_m3_czk || null, practical_m3_h || null,
      theoretical_m3_h || null, priplatek_czk_m3 || 0,
      notes || null, JSON.stringify(metadata || {}), sort_order || 0
    ]);

    res.status(201).json(model);
  } catch (error) {
    console.error('[Pump] Error creating model:', error.message);
    res.status(500).json({ error: 'Failed to create model' });
  }
});

/**
 * PUT /api/pump/models/:modelId — Update model
 */
router.put('/models/:modelId', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const {
      name, reach_m, boom_m, arrival_fixed_czk, arrival_per_km_czk,
      operation_per_h_czk, operation_per_15min_czk, volume_per_m3_czk,
      practical_m3_h, theoretical_m3_h, priplatek_czk_m3, notes, metadata, sort_order
    } = req.body;

    const { rows: [model] } = await pool.query(`
      UPDATE pump_models SET
        name = COALESCE($1, name),
        reach_m = COALESCE($2, reach_m),
        boom_m = COALESCE($3, boom_m),
        arrival_fixed_czk = COALESCE($4, arrival_fixed_czk),
        arrival_per_km_czk = COALESCE($5, arrival_per_km_czk),
        operation_per_h_czk = COALESCE($6, operation_per_h_czk),
        operation_per_15min_czk = COALESCE($7, operation_per_15min_czk),
        volume_per_m3_czk = COALESCE($8, volume_per_m3_czk),
        practical_m3_h = COALESCE($9, practical_m3_h),
        theoretical_m3_h = COALESCE($10, theoretical_m3_h),
        priplatek_czk_m3 = COALESCE($11, priplatek_czk_m3),
        notes = COALESCE($12, notes),
        metadata = COALESCE($13, metadata),
        sort_order = COALESCE($14, sort_order)
      WHERE id = $15
      RETURNING *
    `, [
      name, reach_m, boom_m, arrival_fixed_czk, arrival_per_km_czk,
      operation_per_h_czk, operation_per_15min_czk, volume_per_m3_czk,
      practical_m3_h, theoretical_m3_h, priplatek_czk_m3,
      notes, metadata ? JSON.stringify(metadata) : null, sort_order,
      req.params.modelId
    ]);

    if (!model) return res.status(404).json({ error: 'Model not found' });
    res.json(model);
  } catch (error) {
    console.error('[Pump] Error updating model:', error.message);
    res.status(500).json({ error: 'Failed to update model' });
  }
});

/**
 * DELETE /api/pump/models/:modelId — Delete model
 */
router.delete('/models/:modelId', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const result = await pool.query('DELETE FROM pump_models WHERE id = $1', [req.params.modelId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Model not found' });
    res.json({ deleted: true });
  } catch (error) {
    console.error('[Pump] Error deleting model:', error.message);
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

// =============================================================================
// ACCESSORIES
// =============================================================================

/**
 * GET /api/pump/accessories — List accessories catalog
 */
router.get('/accessories', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const supplierId = req.query.supplier_id;
    let query, params;

    if (supplierId) {
      // Universal + supplier-specific
      query = 'SELECT * FROM pump_accessories_catalog WHERE supplier_id IS NULL OR supplier_id = $1 ORDER BY is_common DESC, name';
      params = [supplierId];
    } else {
      query = 'SELECT * FROM pump_accessories_catalog ORDER BY is_common DESC, name';
      params = [];
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('[Pump] Error listing accessories:', error.message);
    res.status(500).json({ error: 'Failed to list accessories' });
  }
});

/**
 * POST /api/pump/accessories — Add accessory to catalog
 */
router.post('/accessories', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const { supplier_id, name, unit, czk_per_unit, is_common, notes } = req.body;
  if (!name || !unit || czk_per_unit == null) {
    return res.status(400).json({ error: 'name, unit, and czk_per_unit are required' });
  }

  try {
    const { rows: [accessory] } = await pool.query(`
      INSERT INTO pump_accessories_catalog (supplier_id, name, unit, czk_per_unit, is_common, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [supplier_id || null, name, unit, czk_per_unit, is_common || false, notes || null]);

    res.status(201).json(accessory);
  } catch (error) {
    console.error('[Pump] Error creating accessory:', error.message);
    res.status(500).json({ error: 'Failed to create accessory' });
  }
});

// =============================================================================
// CALCULATE & COMPARE
// =============================================================================

/**
 * POST /api/pump/calculate — Calculate pump cost for one supplier+model
 *
 * Body: { supplier_id, model_id, input: { vzdalenost_km, celkem_m3, ... } }
 */
router.post('/calculate', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const { supplier_id, model_id, input } = req.body;
  if (!supplier_id || !model_id || !input) {
    return res.status(400).json({ error: 'supplier_id, model_id, and input are required' });
  }

  try {
    const { rows: [supplier] } = await pool.query(
      'SELECT * FROM pump_suppliers WHERE id = $1 OR slug = $1', [supplier_id]
    );
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    // Parse JSONB surcharges if string
    if (typeof supplier.surcharges === 'string') supplier.surcharges = JSON.parse(supplier.surcharges);

    const { rows: [model] } = await pool.query(
      'SELECT * FROM pump_models WHERE id = $1', [model_id]
    );
    if (!model) return res.status(404).json({ error: 'Model not found' });

    const result = calculatePumpCost(supplier, model, input);
    res.json(result);
  } catch (error) {
    console.error('[Pump] Error calculating:', error.message);
    res.status(500).json({ error: 'Failed to calculate pump cost' });
  }
});

/**
 * POST /api/pump/compare — Compare all suppliers for given input
 *
 * Body: { input: { vzdalenost_km, celkem_m3, min_reach_m?, ... } }
 */
router.post('/compare', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'input is required' });

  const minReach = parseFloat(input.min_reach_m) || 0;

  try {
    const { rows: suppliers } = await pool.query('SELECT * FROM pump_suppliers ORDER BY name');
    const results = [];

    for (const supplier of suppliers) {
      if (typeof supplier.surcharges === 'string') supplier.surcharges = JSON.parse(supplier.surcharges);

      const { rows: models } = await pool.query(
        'SELECT * FROM pump_models WHERE supplier_id = $1 AND (reach_m >= $2 OR reach_m IS NULL) ORDER BY sort_order',
        [supplier.id, minReach]
      );

      for (const model of models) {
        const result = calculatePumpCost(supplier, model, input);
        results.push(result);
      }
    }

    // Sort by final price ascending (cheapest first)
    results.sort((a, b) => a.konecna_cena - b.konecna_cena);
    res.json(results);
  } catch (error) {
    console.error('[Pump] Error comparing:', error.message);
    res.status(500).json({ error: 'Failed to compare suppliers' });
  }
});

// =============================================================================
// SAVED CALCULATIONS
// =============================================================================

/**
 * POST /api/pump/calculations — Save a calculation result
 */
router.post('/calculations', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  const { position_instance_id, project_id, supplier_id, model_id, input_params, result } = req.body;

  try {
    const { rows: [calc] } = await pool.query(`
      INSERT INTO pump_calculations (position_instance_id, project_id, supplier_id, model_id, input_params, result, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      position_instance_id || null,
      project_id || null,
      supplier_id || null,
      model_id || null,
      JSON.stringify(input_params || {}),
      JSON.stringify(result || {}),
      req.user?.id || null
    ]);

    res.status(201).json(calc);
  } catch (error) {
    console.error('[Pump] Error saving calculation:', error.message);
    res.status(500).json({ error: 'Failed to save calculation' });
  }
});

/**
 * GET /api/pump/calculations/:positionId — Get saved calculations for position
 */
router.get('/calculations/:positionId', async (req, res) => {
  const pool = safeGetPool();
  if (!pool) return res.status(503).json({ error: 'Database not available' });

  try {
    const { rows } = await pool.query(
      'SELECT * FROM pump_calculations WHERE position_instance_id = $1 ORDER BY created_at DESC',
      [req.params.positionId]
    );
    res.json(rows);
  } catch (error) {
    console.error('[Pump] Error listing calculations:', error.message);
    res.status(500).json({ error: 'Failed to list calculations' });
  }
});

// =============================================================================
// HOLIDAYS HELPER
// =============================================================================

/**
 * GET /api/pump/holidays/:year — Get Czech holidays for calendar display
 */
router.get('/holidays/:year', (req, res) => {
  const year = parseInt(req.params.year);
  if (isNaN(year) || year < 2020 || year > 2100) {
    return res.status(400).json({ error: 'Invalid year' });
  }

  const holidays = getCzechHolidays(year);
  res.json(holidays.map(d => ({
    date: d.toISOString().split('T')[0],
    dayType: getDayType(d.toISOString())
  })));
});

export default router;
