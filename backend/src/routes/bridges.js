/**
 * Bridges routes
 * GET /api/bridges - List all bridges with summary
 */

import express from 'express';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET all bridges with summary
router.get('/', (req, res) => {
  try {
    // OPTIMIZED: Single JOIN query instead of N+1
    const bridgesWithStats = db.prepare(`
      SELECT
        b.bridge_id,
        b.project_name,
        b.object_name,
        b.status,
        b.span_length_m,
        b.deck_width_m,
        b.pd_weeks,
        b.created_at,
        b.updated_at,
        COUNT(p.id) as element_count,
        COALESCE(SUM(CASE WHEN p.subtype = 'beton' THEN p.concrete_m3 ELSE 0 END), 0) as concrete_m3,
        COALESCE(SUM(p.kros_total_czk), 0) as sum_kros_czk
      FROM bridges b
      LEFT JOIN positions p ON b.bridge_id = p.bridge_id
      GROUP BY b.bridge_id, b.project_name, b.object_name, b.status, b.span_length_m, b.deck_width_m, b.pd_weeks, b.created_at, b.updated_at
      ORDER BY b.status DESC, b.project_name, b.created_at DESC
    `).all();

    res.json(bridgesWithStats);
  } catch (error) {
    logger.error('Error fetching bridges:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single bridge
router.get('/:bridge_id', (req, res) => {
  try {
    const { bridge_id } = req.params;

    const bridge = db.prepare(`
      SELECT * FROM bridges WHERE bridge_id = ?
    `).get(bridge_id);

    if (!bridge) {
      return res.status(404).json({ error: 'Bridge not found' });
    }

    // Get stats
    const stats = db.prepare(`
      SELECT
        COUNT(*) as element_count,
        SUM(CASE WHEN subtype = 'beton' THEN concrete_m3 ELSE 0 END) as concrete_m3,
        SUM(kros_total_czk) as sum_kros_czk
      FROM positions
      WHERE bridge_id = ?
    `).get(bridge_id);

    res.json({
      ...bridge,
      element_count: stats.element_count || 0,
      concrete_m3: stats.concrete_m3 || 0,
      sum_kros_czk: stats.sum_kros_czk || 0
    });
  } catch (error) {
    logger.error('Error fetching bridge:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create new bridge manually
router.post('/', (req, res) => {
  try {
    const { bridge_id, project_name, object_name, span_length_m, deck_width_m, pd_weeks } = req.body;

    if (!bridge_id) {
      return res.status(400).json({ error: 'bridge_id is required' });
    }

    // Check if bridge already exists
    const existing = db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge_id);
    if (existing) {
      return res.status(400).json({ error: `Bridge ${bridge_id} already exists` });
    }

    // Insert new bridge
    db.prepare(`
      INSERT INTO bridges (bridge_id, project_name, object_name, span_length_m, deck_width_m, pd_weeks)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      bridge_id,
      project_name || null,
      object_name || bridge_id,
      span_length_m || null,
      deck_width_m || null,
      pd_weeks || null
    );

    // Create template positions with default values (11 parts from audit)
    const templatePositions = [
      // 1. ZÁKLADY ZE ŽELEZOBETONU DO C30/37
      { part_name: 'ZÁKLADY', item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37', subtype: 'beton', unit: 'M3' },
      { part_name: 'ZÁKLADY', item_name: 'ZÁKLADY ZE ŽELEZOBETONU DO C30/37', subtype: 'bednění', unit: 'm2' },

      // 2. ŘÍMSY ZE ŽELEZOBETONU DO C30/37 (B37)
      { part_name: 'ŘÍMSY', item_name: 'ŘÍMSY ZE ŽELEZOBETONU DO C30/37 (B37)', subtype: 'beton', unit: 'M3' },
      { part_name: 'ŘÍMSY', item_name: 'ŘÍMSY ZE ŽELEZOBETONU DO C30/37 (B37)', subtype: 'bednění', unit: 'm2' },

      // 3. MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'beton', unit: 'M3' },
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (opěry)', unit: 'm2' },
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (křídla)', unit: 'm2' },
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C30/37', subtype: 'oboustranné (závěrné zídky)', unit: 'm2' },

      // 4. MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA C40/50', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50', subtype: 'beton', unit: 'M3' },
      { part_name: 'MOSTNÍ OPĚRY A KŘÍDLA C40/50', item_name: 'MOSTNÍ OPĚRY A KŘÍDLA ZE ŽELEZOVÉHO BETONU DO C40/50', subtype: 'bednění', unit: 'm2' },

      // 5. MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)
      { part_name: 'MOSTNÍ PILÍŘE A STATIVA', item_name: 'MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)', subtype: 'beton', unit: 'M3' },
      { part_name: 'MOSTNÍ PILÍŘE A STATIVA', item_name: 'MOSTNÍ PILÍŘE A STATIVA ZE ŽELEZOVÉHO BETONU DO C30/37 (B37)', subtype: 'bednění', unit: 'm2' },

      // 6. PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30
      { part_name: 'PŘECHODOVÉ DESKY', item_name: 'PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30', subtype: 'beton', unit: 'M3' },
      { part_name: 'PŘECHODOVÉ DESKY', item_name: 'PŘECHODOVÉ DESKY MOSTNÍCH OPĚR ZE ŽELEZOBETONU C25/30', subtype: 'bednění', unit: 'm2' },

      // 7. MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37
      { part_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE', item_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37', subtype: 'beton', unit: 'M3' },
      { part_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE', item_name: 'MOSTNÍ NOSNÉ DESKOVÉ KONSTRUKCE Z PŘEDPJATÉHO BETONU C30/37', subtype: 'bednění', unit: 'm2' },

      // 8. SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25
      { part_name: 'SCHODIŠŤ KONSTRUKCE', item_name: 'SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25', subtype: 'beton', unit: 'M3' },
      { part_name: 'SCHODIŠŤ KONSTRUKCE', item_name: 'SCHODIŠŤ KONSTR Z PROST BETONU DO C20/25', subtype: 'bednění', unit: 'm2' },

      // 9. PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15
      { part_name: 'PODKLADNÍ VRSTVY C12/15', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15', subtype: 'beton', unit: 'M3' },
      { part_name: 'PODKLADNÍ VRSTVY C12/15', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C12/15', subtype: 'bednění', unit: 'm2' },

      // 10. PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25
      { part_name: 'PODKLADNÍ VRSTVY C20/25', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25', subtype: 'beton', unit: 'M3' },
      { part_name: 'PODKLADNÍ VRSTVY C20/25', item_name: 'PODKLADNÍ A VÝPLŇOVÉ VRSTVY Z PROSTÉHO BETONU C20/25', subtype: 'bednění', unit: 'm2' },

      // 11. PATKY Z PROSTÉHO BETONU C25/30
      { part_name: 'PATKY', item_name: 'PATKY Z PROSTÉHO BETONU C25/30', subtype: 'beton', unit: 'M3' },
      { part_name: 'PATKY', item_name: 'PATKY Z PROSTÉHO BETONU C25/30', subtype: 'bednění', unit: 'm2' }
    ];

    const insertPosition = db.prepare(`
      INSERT INTO positions (
        id, bridge_id, part_name, item_name, subtype, unit,
        qty, crew_size, wage_czk_ph, shift_hours, days, otskp_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Use transaction for atomic insert of all template positions
    const insertMany = db.transaction(() => {
      templatePositions.forEach((template, index) => {
        // Use UUID-like format with timestamp and index for uniqueness
        const id = `${bridge_id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${index}`;
        insertPosition.run(
          id,
          bridge_id,
          template.part_name,
          template.item_name,
          template.subtype,
          template.unit,
          0, // qty - to be filled by user
          4, // crew_size - default
          398, // wage_czk_ph - default
          10, // shift_hours - default
          0,  // days - to be filled by user
          null // otskp_code - to be filled by user
        );
      });
    });

    insertMany();

    logger.info(`Created new bridge: ${bridge_id} (${object_name}) with ${templatePositions.length} template positions`);
    res.json({ success: true, bridge_id, object_name });
  } catch (error) {
    logger.error('Error creating bridge:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update bridge metadata
router.put('/:bridge_id', (req, res) => {
  try {
    const { bridge_id } = req.params;
    const { project_name, object_name, span_length_m, deck_width_m, pd_weeks, concrete_m3 } = req.body;

    const existing = db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge_id);
    if (!existing) {
      return res.status(404).json({ error: 'Bridge not found' });
    }

    // Update
    db.prepare(`
      UPDATE bridges
      SET project_name = COALESCE(?, project_name),
          object_name = COALESCE(?, object_name),
          span_length_m = COALESCE(?, span_length_m),
          deck_width_m = COALESCE(?, deck_width_m),
          pd_weeks = COALESCE(?, pd_weeks),
          concrete_m3 = COALESCE(?, concrete_m3),
          updated_at = CURRENT_TIMESTAMP
      WHERE bridge_id = ?
    `).run(project_name, object_name, span_length_m, deck_width_m, pd_weeks, concrete_m3, bridge_id);

    res.json({ success: true, bridge_id });
  } catch (error) {
    logger.error('Error updating bridge:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH update bridge status
router.patch('/:bridge_id/status', (req, res) => {
  try {
    const { bridge_id } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'completed', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: active, completed, or archived' });
    }

    const existing = db.prepare('SELECT bridge_id FROM bridges WHERE bridge_id = ?').get(bridge_id);
    if (!existing) {
      return res.status(404).json({ error: 'Bridge not found' });
    }

    db.prepare(`
      UPDATE bridges
      SET status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE bridge_id = ?
    `).run(status, bridge_id);

    logger.info(`Updated bridge ${bridge_id} status to: ${status}`);
    res.json({ success: true, bridge_id, status });
  } catch (error) {
    logger.error('Error updating bridge status:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE bridge
router.delete('/:bridge_id', (req, res) => {
  try {
    const { bridge_id } = req.params;

    // Delete snapshots first (cascade)
    db.prepare('DELETE FROM snapshots WHERE bridge_id = ?').run(bridge_id);

    // Delete positions
    db.prepare('DELETE FROM positions WHERE bridge_id = ?').run(bridge_id);

    // Delete bridge
    const result = db.prepare('DELETE FROM bridges WHERE bridge_id = ?').run(bridge_id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Bridge not found' });
    }

    logger.info(`Deleted bridge: ${bridge_id}`);
    res.json({ success: true, bridge_id });
  } catch (error) {
    logger.error('Error deleting bridge:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
