/**
 * Planner Variants API
 *
 * Stores saved variants of the Part B calculator per position.
 * A variant = input params snapshot + full calc result.
 * One variant can be marked as is_plan (the "chosen plan" for that position).
 *
 * Endpoints:
 *   GET    /api/planner-variants?position_id=X  — list variants for position
 *   POST   /api/planner-variants                 — create new variant
 *   PUT    /api/planner-variants/:id             — update variant (e.g. set is_plan)
 *   DELETE /api/planner-variants/:id             — delete variant
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const MAX_VARIANTS_PER_POSITION = 10;

/**
 * GET /api/planner-variants?position_id=X
 * List all variants for a given position, ordered by variant_number.
 */
router.get('/', async (req, res) => {
  try {
    const { position_id } = req.query;
    if (!position_id) {
      return res.status(400).json({ error: 'position_id query param required' });
    }

    const rows = await db.prepare(
      `SELECT * FROM planner_variants WHERE position_id = ? ORDER BY variant_number ASC`
    ).all(position_id);

    // Parse JSON fields for client
    const variants = rows.map(r => ({
      ...r,
      input_params: safeParse(r.input_params),
      calc_result: safeParse(r.calc_result),
      is_plan: Number(r.is_plan) === 1,
    }));

    res.json({ success: true, variants });
  } catch (error) {
    logger.error('[PlannerVariants] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/planner-variants
 * Body: { position_id, description?, input_params, calc_result, total_days?, total_cost_czk?, system_name? }
 * Creates a new variant. variant_number is auto-assigned.
 * If position already has MAX_VARIANTS_PER_POSITION, oldest non-plan variant is deleted.
 */
router.post('/', async (req, res) => {
  try {
    const { position_id, description, input_params, calc_result,
            total_days, total_cost_czk, system_name } = req.body;

    if (!position_id) {
      return res.status(400).json({ error: 'position_id required' });
    }
    if (!input_params || !calc_result) {
      return res.status(400).json({ error: 'input_params and calc_result required' });
    }

    // Check if position exists
    const position = await db.prepare('SELECT id FROM positions WHERE id = ?').get(position_id);
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    // Get current variants for this position
    const existing = await db.prepare(
      `SELECT id, variant_number, is_plan FROM planner_variants WHERE position_id = ? ORDER BY variant_number ASC`
    ).all(position_id);

    // Enforce max — drop oldest non-plan variant
    if (existing.length >= MAX_VARIANTS_PER_POSITION) {
      const dropCandidate = existing.find(v => Number(v.is_plan) !== 1) || existing[0];
      await db.prepare('DELETE FROM planner_variants WHERE id = ?').run(dropCandidate.id);
      logger.info(`[PlannerVariants] Dropped oldest variant ${dropCandidate.id} (max ${MAX_VARIANTS_PER_POSITION} per position)`);
    }

    // Next variant_number = max + 1
    const maxNumber = existing.reduce((m, v) => Math.max(m, Number(v.variant_number) || 0), 0);
    const nextNumber = maxNumber + 1;

    const id = `var_${uuidv4()}`;
    const desc = (description && String(description).trim())
      || (system_name ? `V${nextNumber}: ${system_name}` : `V${nextNumber}`);

    await db.prepare(`
      INSERT INTO planner_variants (
        id, position_id, variant_number, description,
        input_params, calc_result,
        total_days, total_cost_czk, system_name,
        is_plan, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      id, position_id, nextNumber, desc,
      JSON.stringify(input_params),
      JSON.stringify(calc_result),
      total_days != null ? Number(total_days) : null,
      total_cost_czk != null ? Number(total_cost_czk) : null,
      system_name || null,
    );

    logger.info(`[PlannerVariants] Created variant ${id} (V${nextNumber}) for position ${position_id}`);

    res.json({
      success: true,
      variant: {
        id,
        position_id,
        variant_number: nextNumber,
        description: desc,
        total_days,
        total_cost_czk,
        system_name,
        is_plan: false,
        input_params,
        calc_result,
      },
    });
  } catch (error) {
    logger.error('[PlannerVariants] POST error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/planner-variants/:id
 * Body: { description?, is_plan? }
 * Update variant fields. Setting is_plan=true clears is_plan on other variants
 * of the same position (only one plan per position).
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { description, is_plan } = req.body;

    const existing = await db.prepare('SELECT * FROM planner_variants WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    // If setting as plan, clear is_plan on all other variants of the same position
    if (is_plan === true) {
      await db.prepare(
        'UPDATE planner_variants SET is_plan = 0 WHERE position_id = ? AND id != ?'
      ).run(existing.position_id, id);
    }

    const updates = [];
    const values = [];
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (is_plan !== undefined) {
      updates.push('is_plan = ?');
      values.push(is_plan ? 1 : 0);
    }
    if (updates.length === 0) {
      return res.json({ success: true, variant: existing });
    }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await db.prepare(
      `UPDATE planner_variants SET ${updates.join(', ')} WHERE id = ?`
    ).run(...values);

    const updated = await db.prepare('SELECT * FROM planner_variants WHERE id = ?').get(id);
    res.json({
      success: true,
      variant: {
        ...updated,
        input_params: safeParse(updated.input_params),
        calc_result: safeParse(updated.calc_result),
        is_plan: Number(updated.is_plan) === 1,
      },
    });
  } catch (error) {
    logger.error('[PlannerVariants] PUT error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/planner-variants/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.prepare('DELETE FROM planner_variants WHERE id = ?').run(id);
    res.json({ success: true, deleted: result.changes || 0 });
  } catch (error) {
    logger.error('[PlannerVariants] DELETE error:', error);
    res.status(500).json({ error: error.message });
  }
});

/** Safe JSON parse — returns null on failure instead of throwing */
function safeParse(jsonStr) {
  if (!jsonStr) return null;
  if (typeof jsonStr === 'object') return jsonStr;
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export default router;
