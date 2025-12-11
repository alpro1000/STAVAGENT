/**
 * Sheathing Routes - NO AUTH (Kiosk Mode)
 * API endpoints for formwork/sheathing captures (захватки) with checkerboard method calculations
 *
 * GET    /api/sheathing/:project_id              - Get all captures for project
 * POST   /api/sheathing                          - Create new capture
 * PUT    /api/sheathing/:capture_id              - Update capture
 * DELETE /api/sheathing/:capture_id              - Delete capture
 * GET    /api/sheathing/:project_id/config      - Get project config
 * POST   /api/sheathing/:project_id/config      - Update project config
 */

import express from 'express';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// NO AUTH REQUIRED - This is a public kiosk application
// Authentication is handled at the portal level (stavagent-portal)

/**
 * GET /api/sheathing/:project_id
 * Get all captures for a project (no auth - kiosk mode)
 */
router.get('/:project_id', async (req, res) => {
  try {
    const { project_id } = req.params;

    // Verify project exists (no ownership check - kiosk mode)
    const project = await db.prepare(
      'SELECT project_id FROM monolith_projects WHERE project_id = ?'
    ).get(project_id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get all captures
    const captures = await db.prepare(`
      SELECT * FROM sheathing_captures
      WHERE project_id = ?
      ORDER BY created_at DESC
    `).all(project_id);

    res.json(captures || []);
  } catch (error) {
    logger.error('Error fetching sheathing captures:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sheathing
 * Create new capture (no auth - kiosk mode)
 */
router.post('/', async (req, res) => {
  try {
    const {
      project_id,
      part_name,
      length_m,
      width_m,
      height_m,
      assembly_norm_ph_m2,
      concrete_curing_days,
      num_kits,
      kit_type,
      daily_rental_cost_czk,
      work_method,
      concrete_class
    } = req.body;

    // Validation
    if (!project_id || !part_name) {
      return res.status(400).json({ error: 'project_id and part_name are required' });
    }

    if (typeof length_m !== 'number' || typeof width_m !== 'number') {
      return res.status(400).json({ error: 'length_m and width_m must be numbers' });
    }

    // Verify project exists (no ownership check - kiosk mode)
    const project = await db.prepare(
      'SELECT project_id FROM monolith_projects WHERE project_id = ?'
    ).get(project_id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Calculate area
    const area_m2 = length_m * width_m;

    // Create capture ID
    const captureId = `CAP-${project_id}-${Date.now()}`;

    // Insert capture
    const now = new Date().toISOString();
    const result = await db.prepare(`
      INSERT INTO sheathing_captures (
        capture_id,
        project_id,
        part_name,
        length_m,
        width_m,
        height_m,
        area_m2,
        assembly_norm_ph_m2,
        concrete_curing_days,
        num_kits,
        kit_type,
        daily_rental_cost_czk,
        work_method,
        concrete_class,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      captureId,
      project_id,
      part_name,
      length_m,
      width_m,
      height_m || null,
      area_m2,
      assembly_norm_ph_m2,
      concrete_curing_days,
      num_kits,
      kit_type || null,
      daily_rental_cost_czk || null,
      work_method,
      concrete_class || null,
      now,
      now
    );

    // Fetch and return the created capture
    const capture = await db.prepare(
      'SELECT * FROM sheathing_captures WHERE capture_id = ?'
    ).get(captureId);

    logger.info(`[SHEATHING] Created capture: ${captureId}`);
    res.status(201).json(capture);
  } catch (error) {
    logger.error('Error creating sheathing capture:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/sheathing/:capture_id
 * Update capture (no auth - kiosk mode)
 */
router.put('/:capture_id', async (req, res) => {
  try {
    const { capture_id } = req.params;
    const {
      part_name,
      length_m,
      width_m,
      height_m,
      assembly_norm_ph_m2,
      concrete_curing_days,
      num_kits,
      kit_type,
      daily_rental_cost_czk,
      work_method,
      concrete_class
    } = req.body;

    // Get capture (no ownership check - kiosk mode)
    const capture = await db.prepare(
      'SELECT * FROM sheathing_captures WHERE capture_id = ?'
    ).get(capture_id);

    if (!capture) {
      return res.status(404).json({ error: 'Capture not found' });
    }

    // Calculate new area if dimensions changed
    const newLength = length_m ?? capture.length_m;
    const newWidth = width_m ?? capture.width_m;
    const newArea = newLength * newWidth;

    // Build update query
    const updates = [];
    const values = [];

    if (part_name !== undefined) {
      updates.push('part_name = ?');
      values.push(part_name);
    }
    if (length_m !== undefined) {
      updates.push('length_m = ?');
      values.push(length_m);
    }
    if (width_m !== undefined) {
      updates.push('width_m = ?');
      values.push(width_m);
    }
    if (height_m !== undefined) {
      updates.push('height_m = ?');
      values.push(height_m);
    }
    if (assembly_norm_ph_m2 !== undefined) {
      updates.push('assembly_norm_ph_m2 = ?');
      values.push(assembly_norm_ph_m2);
    }
    if (concrete_curing_days !== undefined) {
      updates.push('concrete_curing_days = ?');
      values.push(concrete_curing_days);
    }
    if (num_kits !== undefined) {
      updates.push('num_kits = ?');
      values.push(num_kits);
    }
    if (kit_type !== undefined) {
      updates.push('kit_type = ?');
      values.push(kit_type);
    }
    if (daily_rental_cost_czk !== undefined) {
      updates.push('daily_rental_cost_czk = ?');
      values.push(daily_rental_cost_czk);
    }
    if (work_method !== undefined) {
      updates.push('work_method = ?');
      values.push(work_method);
    }
    if (concrete_class !== undefined) {
      updates.push('concrete_class = ?');
      values.push(concrete_class);
    }

    // Always update area if dimensions changed
    if (length_m !== undefined || width_m !== undefined) {
      updates.push('area_m2 = ?');
      values.push(newArea);
    }

    // Always update timestamp
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());

    if (updates.length === 1) {
      // Only timestamp changed
      return res.json(capture);
    }

    // Add capture_id for WHERE clause
    values.push(capture_id);

    // Execute update
    await db.prepare(`
      UPDATE sheathing_captures
      SET ${updates.join(', ')}
      WHERE capture_id = ?
    `).run(...values);

    // Fetch and return updated capture
    const updated = await db.prepare(
      'SELECT * FROM sheathing_captures WHERE capture_id = ?'
    ).get(capture_id);

    logger.info(`[SHEATHING] Updated capture: ${capture_id}`);
    res.json(updated);
  } catch (error) {
    logger.error('Error updating sheathing capture:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/sheathing/:capture_id
 * Delete capture (no auth - kiosk mode)
 */
router.delete('/:capture_id', async (req, res) => {
  try {
    const { capture_id } = req.params;

    // Get capture (no ownership check - kiosk mode)
    const capture = await db.prepare(
      'SELECT * FROM sheathing_captures WHERE capture_id = ?'
    ).get(capture_id);

    if (!capture) {
      return res.status(404).json({ error: 'Capture not found' });
    }

    // Delete
    await db.prepare('DELETE FROM sheathing_captures WHERE capture_id = ?').run(capture_id);

    logger.info(`[SHEATHING] Deleted capture: ${capture_id}`);
    res.json({ message: 'Capture deleted successfully' });
  } catch (error) {
    logger.error('Error deleting sheathing capture:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sheathing/:project_id/config
 * Get project config for sheathing calculations (no auth - kiosk mode)
 */
router.get('/:project_id/config', async (req, res) => {
  try {
    const { project_id } = req.params;

    // Verify project exists (no ownership check - kiosk mode)
    const project = await db.prepare(
      'SELECT project_id FROM monolith_projects WHERE project_id = ?'
    ).get(project_id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get or create config
    let config = await db.prepare(
      'SELECT * FROM sheathing_project_configs WHERE project_id = ?'
    ).get(project_id);

    if (!config) {
      // Return defaults
      config = {
        project_id,
        default_assembly_norm_ph_m2: 1.0,
        default_concrete_curing_days: 5,
        default_num_kits: 2,
        default_work_method: 'staggered',
        crew_size: 4,
        shift_hours: 10,
        days_per_month: 22
      };
    }

    res.json(config);
  } catch (error) {
    logger.error('Error fetching sheathing project config:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sheathing/:project_id/config
 * Update project config (no auth - kiosk mode)
 */
router.post('/:project_id/config', async (req, res) => {
  try {
    const { project_id } = req.params;
    const {
      default_assembly_norm_ph_m2,
      default_concrete_curing_days,
      default_num_kits,
      default_work_method,
      crew_size,
      shift_hours,
      days_per_month
    } = req.body;

    // Verify project exists (no ownership check - kiosk mode)
    const project = await db.prepare(
      'SELECT project_id FROM monolith_projects WHERE project_id = ?'
    ).get(project_id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get existing config
    let config = await db.prepare(
      'SELECT * FROM sheathing_project_configs WHERE project_id = ?'
    ).get(project_id);

    if (!config) {
      // Create new
      const now = new Date().toISOString();
      await db.prepare(`
        INSERT INTO sheathing_project_configs (
          project_id,
          default_assembly_norm_ph_m2,
          default_concrete_curing_days,
          default_num_kits,
          default_work_method,
          crew_size,
          shift_hours,
          days_per_month,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        project_id,
        default_assembly_norm_ph_m2 || 1.0,
        default_concrete_curing_days || 5,
        default_num_kits || 2,
        default_work_method || 'staggered',
        crew_size || 4,
        shift_hours || 10,
        days_per_month || 22,
        now,
        now
      );
    } else {
      // Update existing
      await db.prepare(`
        UPDATE sheathing_project_configs SET
          default_assembly_norm_ph_m2 = COALESCE(?, default_assembly_norm_ph_m2),
          default_concrete_curing_days = COALESCE(?, default_concrete_curing_days),
          default_num_kits = COALESCE(?, default_num_kits),
          default_work_method = COALESCE(?, default_work_method),
          crew_size = COALESCE(?, crew_size),
          shift_hours = COALESCE(?, shift_hours),
          days_per_month = COALESCE(?, days_per_month),
          updated_at = ?
        WHERE project_id = ?
      `).run(
        default_assembly_norm_ph_m2,
        default_concrete_curing_days,
        default_num_kits,
        default_work_method,
        crew_size,
        shift_hours,
        days_per_month,
        new Date().toISOString(),
        project_id
      );
    }

    // Fetch and return updated config
    const updated = await db.prepare(
      'SELECT * FROM sheathing_project_configs WHERE project_id = ?'
    ).get(project_id);

    logger.info(`[SHEATHING] Updated config for project: ${project_id}`);
    res.json(updated);
  } catch (error) {
    logger.error('Error updating sheathing project config:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
