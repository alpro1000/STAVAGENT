/**
 * Positions routes
 * GET/POST /api/positions - CRUD for positions with KPI calculations
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/init.js';
import { calculatePositions, calculateKPI } from '../services/calculator.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET positions for a bridge with KPI
router.get('/', (req, res) => {
  try {
    const { bridge_id, include_rfi } = req.query;

    if (!bridge_id) {
      return res.status(400).json({ error: 'bridge_id query parameter is required' });
    }

    // Get all positions for this bridge
    const positions = db.prepare(`
      SELECT * FROM positions
      WHERE bridge_id = ?
      ORDER BY part_name, subtype
    `).all(bridge_id);

    // Get bridge metadata
    const bridge = db.prepare(`
      SELECT span_length_m, deck_width_m, pd_weeks
      FROM bridges
      WHERE bridge_id = ?
    `).get(bridge_id);

    // Get config
    const configRow = db.prepare(`
      SELECT defaults, days_per_month_mode
      FROM project_config
      WHERE id = 1
    `).get();

    const config = {
      defaults: JSON.parse(configRow.defaults),
      days_per_month_mode: configRow.days_per_month_mode
    };

    // Calculate all derived fields
    const calculatedPositions = calculatePositions(positions, config);

    // Calculate header KPI
    const header_kpi = calculateKPI(calculatedPositions, {
      span_length_m: bridge?.span_length_m,
      deck_width_m: bridge?.deck_width_m,
      pd_weeks: bridge?.pd_weeks,
      days_per_month_mode: config.days_per_month_mode
    }, config);

    // Filter RFI if requested
    let responsePositions = calculatedPositions;
    if (include_rfi === 'false') {
      responsePositions = calculatedPositions.filter(p => !p.has_rfi);
    }

    // RFI summary
    const rfiIssues = calculatedPositions
      .filter(p => p.has_rfi)
      .map(p => ({
        position_id: p.id,
        part_name: p.part_name,
        subtype: p.subtype,
        message: p.rfi_message
      }));

    res.json({
      positions: responsePositions,
      header_kpi,
      rfi_summary: {
        count: rfiIssues.length,
        issues: rfiIssues
      }
    });
  } catch (error) {
    logger.error('Error fetching positions:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST - Create or update positions
router.post('/', (req, res) => {
  try {
    const { bridge_id, positions: inputPositions } = req.body;

    if (!bridge_id || !inputPositions || !Array.isArray(inputPositions)) {
      return res.status(400).json({
        error: 'bridge_id and positions array are required'
      });
    }

    // Ensure bridge exists
    const bridgeExists = db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge_id);
    if (!bridgeExists) {
      db.prepare('INSERT INTO bridges (bridge_id) VALUES (?)').run(bridge_id);
    }

    const insertStmt = db.prepare(`
      INSERT INTO positions (
        id, bridge_id, part_name, item_name, subtype, unit, qty, qty_m3_helper,
        crew_size, wage_czk_ph, shift_hours, days
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((positions) => {
      for (const pos of positions) {
        const id = pos.id || uuidv4();
        insertStmt.run(
          id,
          bridge_id,
          pos.part_name,
          pos.item_name || null,
          pos.subtype,
          pos.unit,
          pos.qty,
          pos.qty_m3_helper || null,
          pos.crew_size || 4,
          pos.wage_czk_ph || 398,
          pos.shift_hours || 10,
          pos.days || 0
        );
      }
    });

    insertMany(inputPositions);

    // Return calculated positions
    const positions = db.prepare(`
      SELECT * FROM positions WHERE bridge_id = ?
    `).all(bridge_id);

    const configRow = db.prepare(`
      SELECT defaults, days_per_month_mode FROM project_config WHERE id = 1
    `).get();
    const config = {
      defaults: JSON.parse(configRow.defaults),
      days_per_month_mode: configRow.days_per_month_mode
    };

    const calculatedPositions = calculatePositions(positions, config);

    res.json({
      success: true,
      count: inputPositions.length,
      positions: calculatedPositions
    });
  } catch (error) {
    logger.error('Error creating positions:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT - Update specific positions
router.put('/', (req, res) => {
  try {
    const { bridge_id, updates } = req.body;

    if (!bridge_id || !updates || !Array.isArray(updates)) {
      return res.status(400).json({
        error: 'bridge_id and updates array are required'
      });
    }

    logger.info(`📝 PUT /api/positions: bridge_id=${bridge_id}, ${updates.length} updates`);
    logger.info(`Updates: ${JSON.stringify(updates.slice(0, 1))}`);

    const updateMany = db.transaction((updates, bridgeId) => {
      for (const update of updates) {
        const { id, ...fields } = update;

        if (!id) {
          throw new Error('Each update must have an id field');
        }

        // Build SQL dynamically for each update
        const fieldNames = Object.keys(fields);
        const fieldPlaceholders = fieldNames.map(f => `${f} = ?`).join(', ');

        const sql = `
          UPDATE positions
          SET ${fieldPlaceholders},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND bridge_id = ?
        `;

        const values = [...Object.values(fields), id, bridgeId];

        logger.info(`  Updating position id=${id}: ${fieldNames.join(', ')}`);

        const stmt = db.prepare(sql);
        const result = stmt.run(...values);

        if (result.changes === 0) {
          logger.warn(`  ⚠️ No rows updated for id=${id}`);
        }
      }
    });

    updateMany(updates, bridge_id);

    // Return updated positions
    const positions = db.prepare(`
      SELECT * FROM positions WHERE bridge_id = ?
    `).all(bridge_id);

    const configRow = db.prepare(`
      SELECT defaults, days_per_month_mode FROM project_config WHERE id = 1
    `).get();
    const config = {
      defaults: JSON.parse(configRow.defaults),
      days_per_month_mode: configRow.days_per_month_mode
    };

    const calculatedPositions = calculatePositions(positions, config);
    const bridge = db.prepare('SELECT * FROM bridges WHERE bridge_id = ?').get(bridge_id);

    const header_kpi = calculateKPI(calculatedPositions, {
      span_length_m: bridge?.span_length_m,
      deck_width_m: bridge?.deck_width_m,
      pd_weeks: bridge?.pd_weeks,
      days_per_month_mode: config.days_per_month_mode
    }, config);

    res.json({
      success: true,
      positions: calculatedPositions,
      header_kpi
    });
  } catch (error) {
    logger.error('Error updating positions:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE position
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM positions WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    res.json({ success: true, deleted: id });
  } catch (error) {
    logger.error('Error deleting position:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
