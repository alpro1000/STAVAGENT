/**
 * Positions routes
 * GET/POST /api/positions - CRUD for positions with KPI calculations
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/init.js';
import { calculatePositions, calculateKPI } from '../services/calculator.js';
import { logger } from '../utils/logger.js';
import { extractPartName } from '../utils/text.js';
import { suggestDays } from '../services/timeNormsService.js';

const router = express.Router();

/**
 * Whitelist of allowed field names for SQL updates
 * Prevents SQL injection through field name manipulation
 */
const ALLOWED_UPDATE_FIELDS = new Set([
  'part_name', 'item_name', 'subtype', 'unit', 'qty', 'qty_m3_helper',
  'crew_size', 'wage_czk_ph', 'shift_hours', 'days', 'otskp_code',
  'concrete_m3', 'cost_czk', 'metadata', 'position_number'
]);

/**
 * Template positions with correct part_name -> item_name mappings
 * Used to find the correct part_name when item_name is updated
 */
const TEMPLATE_POSITIONS = [
  { part_name: 'ZÁKLADY', item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37' },
  { part_name: 'ŘÍMSY', item_name: 'ŘÍMSY ZE ŽELEZOBETONU DO C30/37 (B37)' },
  { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37' },
  { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA C40/50', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50' },
  { part_name: 'MOSTNÍ PILÍŘE A STATIVA', item_name: 'MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)' },
  { part_name: 'PŘECHODOVÉ DESKY', item_name: 'PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30' },
  { part_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE', item_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37' },
  { part_name: 'SCHODIŠŤ KONSTRUKCE', item_name: 'SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25' },
  { part_name: 'PODKLADNÍ VRSTVY C12/15', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15' },
  { part_name: 'PODKLADNÍ VRSTVY C20/25', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25' },
  { part_name: 'PATKY', item_name: 'PATKY Z PROSTÉHO BETONU C25/30' }
];

/**
 * Find the correct part_name for a given item_name
 * First checks template, then extracts from item_name if not found
 */
function findPartNameForItemName(itemName) {
  if (!itemName) {
    return '';
  }

  // First check if it's in template (case-insensitive match)
  const itemNameUpper = itemName.toUpperCase();
  const templateMatch = TEMPLATE_POSITIONS.find(
    t => t.item_name.toUpperCase() === itemNameUpper
  );

  if (templateMatch) {
    logger.info(`  Template match found: "${itemName}" → part_name="${templateMatch.part_name}"`);
    return templateMatch.part_name;
  }

  // If not in template, extract from item_name
  const extracted = extractPartName(itemName);
  logger.info(`  No template match, extracted from item_name: "${itemName}" → part_name="${extracted}"`);
  return extracted;
}

// GET positions for a bridge with KPI
router.get('/', async (req, res) => {
  try {
    const { bridge_id, include_rfi } = req.query;

    // If no bridge_id provided, return empty array (not an error)
    // This allows frontend to call endpoint before user selects a project
    if (!bridge_id) {
      return res.json([]);
    }

    // Get all positions for this bridge
    const positions = await db.prepare(`
      SELECT * FROM positions
      WHERE bridge_id = ?
      ORDER BY part_name, subtype
    `).all(bridge_id);

    // Get bridge metadata
    const bridge = await db.prepare(`
      SELECT span_length_m, deck_width_m, pd_weeks
      FROM bridges
      WHERE bridge_id = ?
    `).get(bridge_id);

    // Get config
    const configRow = await db.prepare(`
      SELECT defaults, days_per_month_mode
      FROM project_config
      WHERE id = 1
    `).get();

    let defaults = {};
    try {
      defaults = configRow?.defaults ? JSON.parse(configRow.defaults) : {};
    } catch (e) {
      logger.warn('Failed to parse config defaults, using empty object:', e.message);
    }
    const config = {
      defaults,
      days_per_month_mode: configRow?.days_per_month_mode || 30
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
      responsePositions = calculatedPositions.filter(p => p.has_rfi);
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
router.post('/', async (req, res) => {
  try {
    const { bridge_id, positions: inputPositions } = req.body;

    if (!bridge_id || !inputPositions || !Array.isArray(inputPositions)) {
      return res.status(400).json({
        error: 'bridge_id and positions array are required'
      });
    }

    // VALIDATION: Check all input fields
    for (const pos of inputPositions) {
      if (!pos.part_name) {
        return res.status(400).json({ error: 'part_name is required' });
      }
      if (!pos.subtype) {
        return res.status(400).json({ error: 'subtype is required' });
      }
      if (typeof pos.qty !== 'number' || pos.qty < 0) {
        return res.status(400).json({ error: `qty must be >= 0, got ${pos.qty}` });
      }
      if (pos.crew_size && (typeof pos.crew_size !== 'number' || pos.crew_size <= 0)) {
        return res.status(400).json({ error: `crew_size must be > 0, got ${pos.crew_size}` });
      }
      if (pos.wage_czk_ph && (typeof pos.wage_czk_ph !== 'number' || pos.wage_czk_ph < 0)) {
        return res.status(400).json({ error: `wage_czk_ph must be >= 0, got ${pos.wage_czk_ph}` });
      }
      if (pos.shift_hours && (typeof pos.shift_hours !== 'number' || pos.shift_hours <= 0)) {
        return res.status(400).json({ error: `shift_hours must be > 0, got ${pos.shift_hours}` });
      }
      if (typeof pos.days !== 'number' || pos.days < 0) {
        return res.status(400).json({ error: `days must be >= 0, got ${pos.days}` });
      }
    }

    // Ensure bridge exists
    const bridgeExists = await db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge_id);
    if (!bridgeExists) {
      await db.prepare('INSERT INTO bridges (bridge_id) VALUES (?)').run(bridge_id);
    }

    const insertMany = db.transaction(async (client, positions) => {
      const insertStmt = client.prepare(`
        INSERT INTO positions (
          id, bridge_id, part_name, item_name, subtype, unit, qty, qty_m3_helper,
          crew_size, wage_czk_ph, shift_hours, days, otskp_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const pos of positions) {
        const id = pos.id || uuidv4();
        await insertStmt.run(
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
          pos.days || 0,
          pos.otskp_code || null
        );
      }
    });

    await insertMany(inputPositions);

    // Return calculated positions
    const positions = await db.prepare(`
      SELECT * FROM positions WHERE bridge_id = ?
    `).all(bridge_id);

    const configRow = await db.prepare(`
      SELECT defaults, days_per_month_mode FROM project_config WHERE id = 1
    `).get();
    let defaults = {};
    try {
      defaults = configRow?.defaults ? JSON.parse(configRow.defaults) : {};
    } catch (e) {
      logger.warn('Failed to parse config defaults:', e.message);
    }
    const config = {
      defaults,
      days_per_month_mode: configRow?.days_per_month_mode || 30
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
router.put('/', async (req, res) => {
  try {
    const { bridge_id, updates } = req.body;

    if (!bridge_id || !updates || !Array.isArray(updates)) {
      return res.status(400).json({
        error: 'bridge_id and updates array are required'
      });
    }

    // VALIDATION: Check all update fields
    for (const update of updates) {
      const { qty, crew_size, wage_czk_ph, shift_hours, days } = update;

      if (typeof qty !== 'undefined' && (typeof qty !== 'number' || qty < 0)) {
        return res.status(400).json({ error: `qty must be >= 0, got ${qty}` });
      }
      if (typeof crew_size !== 'undefined' && (typeof crew_size !== 'number' || crew_size <= 0)) {
        return res.status(400).json({ error: `crew_size must be > 0, got ${crew_size}` });
      }
      if (typeof wage_czk_ph !== 'undefined' && (typeof wage_czk_ph !== 'number' || wage_czk_ph < 0)) {
        return res.status(400).json({ error: `wage_czk_ph must be >= 0, got ${wage_czk_ph}` });
      }
      if (typeof shift_hours !== 'undefined' && (typeof shift_hours !== 'number' || shift_hours <= 0)) {
        return res.status(400).json({ error: `shift_hours must be > 0, got ${shift_hours}` });
      }
      if (typeof days !== 'undefined' && (typeof days !== 'number' || days < 0)) {
        return res.status(400).json({ error: `days must be >= 0, got ${days}` });
      }
    }

    logger.info(`📝 PUT /api/positions: bridge_id=${bridge_id}, ${updates.length} updates`);
    // Log all updates (up to 5 for readability)
    const previewUpdates = updates.slice(0, 5).map(u => ({
      id: u.id?.substring(0, 20) + '...' || 'unknown',
      fields: Object.keys(u).filter(k => k !== 'id').join(', ')
    }));
    logger.info(`Updates preview: ${JSON.stringify(previewUpdates)}`);

    const updateMany = db.transaction(async (client, updates, bridgeId) => {
      for (const update of updates) {
        const { id, ...fields } = update;

        if (!id) {
          throw new Error('Each update must have an id field');
        }

        // 🚫 DO NOT auto-update part_name when item_name changes
        // Only update fields that were explicitly sent (item_name, otskp_code, etc.)
        // Changing part_name requires explicit API call
        if (fields.item_name && !fields.part_name) {
          logger.debug(`  Item name being updated to "${fields.item_name}", but part_name NOT auto-updated (explicit update required)`);
        }

        // Build SQL dynamically for each update
        // Filter to only allowed fields (SQL injection prevention)
        const fieldNames = Object.keys(fields).filter(f => ALLOWED_UPDATE_FIELDS.has(f));

        // Log if any fields were rejected
        const rejectedFields = Object.keys(fields).filter(f => !ALLOWED_UPDATE_FIELDS.has(f));
        if (rejectedFields.length > 0) {
          logger.warn(`  ⚠️ Rejected non-whitelisted fields: ${rejectedFields.join(', ')}`);
        }

        // If there are no fields to update, skip this update
        // (only updated_at will be set by the DEFAULT in the UPDATE statement)
        if (fieldNames.length === 0) {
          logger.warn(`  ⚠️ No valid fields to update for position id=${id}, skipping`);
          continue;
        }

        const fieldPlaceholders = fieldNames.map(f => `${f} = ?`).join(', ');

        const sql = `
          UPDATE positions
          SET ${fieldPlaceholders},
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND bridge_id = ?
        `;

        // Only include values for whitelisted fields (in same order as fieldNames)
        const values = [...fieldNames.map(f => fields[f]), id, bridgeId];

        logger.info(`  Updating position id=${id}: ${fieldNames.join(', ')}`);

        const stmt = client.prepare(sql);
        const result = await stmt.run(...values);

        if (result.changes === 0) {
          logger.warn(`  ⚠️ No rows updated for id=${id}`);
        }
      }
    });

    await updateMany(updates, bridge_id);

    // Return updated positions (with proper sorting to match GET route)
    const positions = await db.prepare(`
      SELECT * FROM positions WHERE bridge_id = ?
      ORDER BY part_name, subtype
    `).all(bridge_id);

    const configRow = await db.prepare(`
      SELECT defaults, days_per_month_mode FROM project_config WHERE id = 1
    `).get();
    let defaults = {};
    try {
      defaults = configRow?.defaults ? JSON.parse(configRow.defaults) : {};
    } catch (e) {
      logger.warn('Failed to parse config defaults:', e.message);
    }
    const config = {
      defaults,
      days_per_month_mode: configRow?.days_per_month_mode || 30
    };

    const calculatedPositions = calculatePositions(positions, config);
    const bridge = await db.prepare('SELECT * FROM bridges WHERE bridge_id = ?').get(bridge_id);

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
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.prepare('DELETE FROM positions WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    res.json({ success: true, deleted: id });
  } catch (error) {
    logger.error('Error deleting position:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/positions/:id/suggest-days
 * AI-powered days suggestion using concrete-agent Multi-Role API
 *
 * Returns suggested duration based on:
 * - Work type (beton, bednění, výztuž, jiné)
 * - Quantity and unit
 * - Crew size and shift hours
 * - Official construction norms (KROS, RTS, ČSN)
 */
router.post('/:id/suggest-days', async (req, res) => {
  const { id } = req.params;

  try {
    logger.info(`[API] Requesting time norms suggestion for position ${id}`);

    // Get position from database
    const position = await db.prepare(
      'SELECT * FROM positions WHERE id = ?'
    ).get(id);

    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    // Validate required fields
    if (!position.qty || position.qty <= 0) {
      return res.status(400).json({
        error: 'Invalid quantity',
        message: 'Position must have a valid quantity > 0'
      });
    }

    // Call AI service
    const suggestion = await suggestDays(position);

    logger.info(`[API] Time norms suggestion completed for position ${id}: ${suggestion.suggested_days} days`);

    res.json(suggestion);

  } catch (error) {
    logger.error('[API] Error suggesting days:', error);
    res.status(500).json({
      error: 'Failed to suggest days',
      message: error.message
    });
  }
});

export default router;
