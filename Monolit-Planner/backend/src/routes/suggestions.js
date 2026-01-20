/**
 * Suggestions API
 * AI-powered suggestions for position parameters using deterministic calculators
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { db } from '../db/index.js';

// Import calculators from shared package
import {
  calculateRebar,
  calculateFormwork,
  calculateConcreting
} from '@stavagent/monolit-shared/calculators';

const router = express.Router();

/**
 * POST /api/suggestions/suggest-days
 * Calculate suggested days for a position using deterministic calculators
 *
 * Request body:
 * {
 *   position_id: "pos_123",
 *   normset_id: "norm_urs_2024" (optional, uses default if not specified)
 * }
 *
 * Response:
 * {
 *   suggestion_id: "sugg_456",
 *   suggested_days: 2.05,
 *   suggested_by: "CALCULATOR_FORMWORK",
 *   norm_source: "URS_2024_OFFICIAL",
 *   assumptions_log: "area=82m², norm_in=0.8h/m², crew=4, k=0.8, ...",
 *   confidence: 0.95,
 *   calculation_details: {
 *     labor_hours: 65.6,
 *     assembly_days: 2.05,
 *     disassembly_days: 0.77,
 *     ...
 *   }
 * }
 */
router.post('/suggest-days', async (req, res) => {
  try {
    const { position_id, normset_id } = req.body;

    if (!position_id) {
      return res.status(400).json({ error: 'position_id is required' });
    }

    logger.info(`[SUGGEST DAYS] position_id=${position_id}, normset=${normset_id || 'default'}`);

    // 1. Get position
    const position = await db.prepare(`
      SELECT * FROM positions WHERE id = ?
    `).get(position_id);

    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    // 2. Get normset (use default if not specified)
    let normset;
    if (normset_id) {
      normset = await db.prepare(`
        SELECT * FROM normsets WHERE id = ? AND is_active = 1
      `).get(normset_id);
    } else {
      normset = await db.prepare(`
        SELECT * FROM normsets WHERE is_default = 1 AND is_active = 1
      `).get();
    }

    if (!normset) {
      return res.status(404).json({
        error: normset_id ? 'Normset not found' : 'No default normset configured'
      });
    }

    logger.info(`[SUGGEST DAYS] Using normset: ${normset.name} (${normset.source_tag})`);

    // 3. Call appropriate calculator based on subtype
    let suggestion;
    let suggested_by;
    let calculation_details;

    switch (position.subtype) {
      case 'beton': {
        // Concreting calculator
        suggested_by = 'CALCULATOR_CONCRETING';

        const result = calculateConcreting({
          volume_m3: position.qty || 0,
          q_eff_m3_h: 15.0,  // Default pump capacity (could be project-specific)
          setup_hours: normset.pour_setup_hours,
          washout_hours: normset.washout_hours,
          crew_size: normset.pour_team_required,
          shift_h: position.shift_hours || 10,
          wage_czk_h: position.wage_czk_ph || 398,
          pump_rate_czk_h: 1500,  // Default pump rate
          max_continuous_hours: 12.0,  // Default continuous pour window
          source_tag: normset.source_tag,
          confidence: 0.90
        });

        suggestion = {
          suggested_days: result.pour_days,
          norm_source: result.source_tag,
          assumptions_log: result.assumptions_log,
          confidence: result.confidence
        };

        calculation_details = {
          pour_hours: result.pour_hours,
          cost_labor: result.cost_labor,
          cost_pump: result.cost_pump,
          exceeds_continuous_window: result.exceeds_continuous_window,
          warning: result.warning
        };

        break;
      }

      case 'bednění':
      case 'oboustranné (opěry)':
      case 'oboustranné (křídla)':
      case 'oboustranné (závěrné zídky)': {
        // Formwork calculator
        suggested_by = 'CALCULATOR_FORMWORK';

        const result = calculateFormwork({
          area_m2: position.qty || 0,
          norm_assembly_h_m2: normset.formwork_assembly_h_per_m2,
          norm_disassembly_h_m2: normset.formwork_disassembly_h_per_m2,
          crew_size: position.crew_size || 4,
          shift_h: position.shift_hours || 10,
          k: 0.80,  // Default time utilization (could be project-specific)
          wage_czk_h: position.wage_czk_ph || 398,
          strip_wait_hours: normset.strip_wait_hours,
          move_clean_hours: normset.move_clean_hours,
          source_tag: normset.source_tag,
          confidence: 0.92
        });

        // For formwork, suggested_days = assembly_days (not total kit occupancy)
        suggestion = {
          suggested_days: result.assembly_days,
          norm_source: result.source_tag,
          assumptions_log: result.assumptions_log,
          confidence: result.confidence
        };

        calculation_details = {
          assembly_hours: result.assembly_hours,
          assembly_days: result.assembly_days,
          disassembly_hours: result.disassembly_hours,
          disassembly_days: result.disassembly_days,
          wait_days: result.wait_days,
          kit_occupancy_days: result.kit_occupancy_days,
          cost_labor: result.cost_labor
        };

        break;
      }

      case 'výztuž': {
        // Rebar calculator
        suggested_by = 'CALCULATOR_REBAR';

        // Convert kg to tons (qty in kg → mass_t)
        const mass_t = (position.qty || 0) / 1000.0;

        const result = calculateRebar({
          mass_t,
          norm_h_per_t: normset.rebar_h_per_t,
          crew_size: position.crew_size || 4,
          shift_h: position.shift_hours || 10,
          k: 0.80,  // Default time utilization
          wage_czk_h: position.wage_czk_ph || 398,
          source_tag: normset.source_tag,
          confidence: 0.94
        });

        suggestion = {
          suggested_days: result.duration_days,
          norm_source: result.source_tag,
          assumptions_log: result.assumptions_log,
          confidence: result.confidence
        };

        calculation_details = {
          mass_t,
          labor_hours: result.labor_hours,
          duration_days: result.duration_days,
          cost_labor: result.cost_labor
        };

        break;
      }

      default: {
        // Unknown subtype - cannot suggest
        return res.status(400).json({
          error: `Cannot suggest days for subtype: ${position.subtype}`,
          message: 'Suggestions are available only for: beton, bednění, výztuž'
        });
      }
    }

    // 4. Save suggestion to database
    const suggestion_id = uuidv4();

    await db.prepare(`
      INSERT INTO position_suggestions (
        id,
        position_id,
        suggested_days,
        suggested_by,
        normset_id,
        norm_source,
        assumptions_log,
        confidence,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      suggestion_id,
      position_id,
      suggestion.suggested_days,
      suggested_by,
      normset.id,
      suggestion.norm_source,
      suggestion.assumptions_log,
      suggestion.confidence
    );

    logger.info(`[SUGGEST DAYS] Created suggestion: ${suggestion_id}, suggested_days=${suggestion.suggested_days.toFixed(2)}`);

    // 5. Return suggestion
    res.json({
      suggestion_id,
      suggested_days: suggestion.suggested_days,
      suggested_by,
      normset_name: normset.name,
      norm_source: suggestion.norm_source,
      assumptions_log: suggestion.assumptions_log,
      confidence: suggestion.confidence,
      calculation_details
    });

  } catch (error) {
    logger.error('[SUGGEST DAYS] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/suggestions/:id/accept
 * Accept a suggestion and apply it to the position
 */
router.post('/:id/accept', async (req, res) => {
  try {
    const { id: suggestion_id } = req.params;
    const { user_note } = req.body;

    logger.info(`[ACCEPT SUGGESTION] suggestion_id=${suggestion_id}`);

    // 1. Get suggestion
    const suggestion = await db.prepare(`
      SELECT * FROM position_suggestions WHERE id = ?
    `).get(suggestion_id);

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    if (suggestion.status !== 'pending') {
      return res.status(400).json({ error: 'Suggestion already processed' });
    }

    // 2. Update position with suggested days
    await db.prepare(`
      UPDATE positions
      SET days = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(suggestion.suggested_days, suggestion.position_id);

    // 3. Mark suggestion as accepted
    await db.prepare(`
      UPDATE position_suggestions
      SET status = 'accepted',
          user_decision_days = ?,
          user_note = ?
      WHERE id = ?
    `).run(suggestion.suggested_days, user_note || null, suggestion_id);

    logger.info(`[ACCEPT SUGGESTION] Applied days=${suggestion.suggested_days} to position=${suggestion.position_id}`);

    res.json({
      success: true,
      message: 'Suggestion accepted and applied',
      position_id: suggestion.position_id,
      applied_days: suggestion.suggested_days
    });

  } catch (error) {
    logger.error('[ACCEPT SUGGESTION] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/suggestions/:id/reject
 * Reject a suggestion (user prefers manual value)
 */
router.post('/:id/reject', async (req, res) => {
  try {
    const { id: suggestion_id } = req.params;
    const { user_decision_days, user_note } = req.body;

    logger.info(`[REJECT SUGGESTION] suggestion_id=${suggestion_id}, user_days=${user_decision_days}`);

    // 1. Get suggestion
    const suggestion = await db.prepare(`
      SELECT * FROM position_suggestions WHERE id = ?
    `).get(suggestion_id);

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // 2. Mark suggestion as rejected
    await db.prepare(`
      UPDATE position_suggestions
      SET status = 'rejected',
          user_decision_days = ?,
          user_note = ?
      WHERE id = ?
    `).run(user_decision_days || null, user_note || null, suggestion_id);

    logger.info(`[REJECT SUGGESTION] User chose manual value: ${user_decision_days || 'kept existing'}`);

    res.json({
      success: true,
      message: 'Suggestion rejected',
      user_decision_days
    });

  } catch (error) {
    logger.error('[REJECT SUGGESTION] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/suggestions/position/:position_id
 * Get all suggestions for a position
 */
router.get('/position/:position_id', async (req, res) => {
  try {
    const { position_id } = req.params;

    const suggestions = await db.prepare(`
      SELECT
        s.*,
        n.name as normset_name
      FROM position_suggestions s
      LEFT JOIN normsets n ON s.normset_id = n.id
      WHERE s.position_id = ?
      ORDER BY s.created_at DESC
    `).all(position_id);

    res.json({ suggestions });

  } catch (error) {
    logger.error('[GET SUGGESTIONS] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
