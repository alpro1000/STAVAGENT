/**
 * Formwork Calculator routes
 * CRUD for formwork calculator rows (saved per project)
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/init.js';

const router = express.Router();

/**
 * GET /api/formwork-calculator/:bridge_id
 * Get all formwork calculator rows for a project
 */
router.get('/:bridge_id', (req, res) => {
  try {
    const { bridge_id } = req.params;

    // Input validation: bridge_id must be a non-empty string without SQL-dangerous characters
    if (!bridge_id || typeof bridge_id !== 'string' || bridge_id.length > 255) {
      return res.status(400).json({ error: 'Invalid bridge_id' });
    }

    const rows = db.prepare(
      'SELECT * FROM formwork_calculator WHERE bridge_id = ? ORDER BY created_at ASC'
    ).all(bridge_id);

    res.json({ rows });
  } catch (error) {
    console.error('[Formwork Calculator] GET error:', error);
    res.status(500).json({ error: 'Failed to fetch formwork calculator data' });
  }
});

/**
 * POST /api/formwork-calculator
 * Create or update formwork calculator rows (bulk upsert)
 */
router.post('/', (req, res) => {
  try {
    const { bridge_id, rows } = req.body;

    if (!bridge_id || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'bridge_id and rows[] required' });
    }

    const upsert = db.prepare(`
      INSERT INTO formwork_calculator (
        id, bridge_id, construction_name, total_area_m2, set_area_m2,
        num_tacts, num_sets, assembly_days_per_tact, disassembly_days_per_tact,
        days_per_tact, formwork_term_days, system_name, system_height,
        rental_czk_per_m2_month, monthly_rental_per_set, final_rental_czk,
        kros_code, kros_description, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        construction_name = excluded.construction_name,
        total_area_m2 = excluded.total_area_m2,
        set_area_m2 = excluded.set_area_m2,
        num_tacts = excluded.num_tacts,
        num_sets = excluded.num_sets,
        assembly_days_per_tact = excluded.assembly_days_per_tact,
        disassembly_days_per_tact = excluded.disassembly_days_per_tact,
        days_per_tact = excluded.days_per_tact,
        formwork_term_days = excluded.formwork_term_days,
        system_name = excluded.system_name,
        system_height = excluded.system_height,
        rental_czk_per_m2_month = excluded.rental_czk_per_m2_month,
        monthly_rental_per_set = excluded.monthly_rental_per_set,
        final_rental_czk = excluded.final_rental_czk,
        kros_code = excluded.kros_code,
        kros_description = excluded.kros_description,
        updated_at = CURRENT_TIMESTAMP
    `);

    const transaction = db.transaction((items) => {
      for (const row of items) {
        upsert.run(
          row.id || uuidv4(),
          bridge_id,
          row.construction_name || '',
          row.total_area_m2 || 0,
          row.set_area_m2 || 0,
          row.num_tacts || 1,
          row.num_sets || 1,
          row.assembly_days_per_tact || 0,
          row.disassembly_days_per_tact || 0,
          row.days_per_tact || 0,
          row.formwork_term_days || 0,
          row.system_name || 'Frami Xlife',
          row.system_height || '',
          row.rental_czk_per_m2_month || 0,
          row.monthly_rental_per_set || 0,
          row.final_rental_czk || 0,
          row.kros_code || null,
          row.kros_description || null
        );
      }
    });

    transaction(rows);

    // Return saved rows
    const savedRows = db.prepare(
      'SELECT * FROM formwork_calculator WHERE bridge_id = ? ORDER BY created_at ASC'
    ).all(bridge_id);

    res.json({ success: true, rows: savedRows });
  } catch (error) {
    console.error('[Formwork Calculator] POST error:', error);
    res.status(500).json({ error: 'Failed to save formwork calculator data' });
  }
});

/**
 * DELETE /api/formwork-calculator/:id
 * Delete a single formwork calculator row
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Input validation: id must be a non-empty string (UUID format)
    if (!id || typeof id !== 'string' || id.length > 255) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    db.prepare('DELETE FROM formwork_calculator WHERE id = ?').run(id);
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('[Formwork Calculator] DELETE error:', error);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
