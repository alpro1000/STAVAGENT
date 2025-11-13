/**
 * Config routes
 * GET/POST /api/config - Project configuration
 */

import express from 'express';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET config
router.get('/', async (req, res) => {
  try {
    const config = await db.prepare(`
      SELECT feature_flags, defaults, days_per_month_mode
      FROM project_config
      WHERE id = 1
    `).get();

    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    // Ensure feature_flags and defaults are strings before parsing
    const featureFlags = config.feature_flags;
    const defaults = config.defaults;

    res.json({
      feature_flags: typeof featureFlags === 'string' ? JSON.parse(featureFlags) : featureFlags || {},
      defaults: typeof defaults === 'string' ? JSON.parse(defaults) : defaults || {},
      days_per_month_mode: config.days_per_month_mode
    });
  } catch (error) {
    logger.error('Error fetching config:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST config (update)
router.post('/', async (req, res) => {
  try {
    const { feature_flags, defaults, days_per_month_mode } = req.body;

    const updates = [];
    const params = [];

    if (feature_flags) {
      updates.push('feature_flags = ?');
      params.push(JSON.stringify(feature_flags));
    }

    if (defaults) {
      updates.push('defaults = ?');
      params.push(JSON.stringify(defaults));
    }

    if (days_per_month_mode !== undefined) {
      if (days_per_month_mode !== 30 && days_per_month_mode !== 22) {
        return res.status(400).json({ error: 'days_per_month_mode must be 30 or 22' });
      }
      updates.push('days_per_month_mode = ?');
      params.push(days_per_month_mode);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    await db.prepare(`
      UPDATE project_config
      SET ${updates.join(', ')}
      WHERE id = 1
    `).run(...params);

    // Return updated config
    const updatedConfig = await db.prepare(`
      SELECT feature_flags, defaults, days_per_month_mode
      FROM project_config
      WHERE id = 1
    `).get();

    res.json({
      success: true,
      config: {
        feature_flags: JSON.parse(updatedConfig.feature_flags),
        defaults: JSON.parse(updatedConfig.defaults),
        days_per_month_mode: updatedConfig.days_per_month_mode
      }
    });
  } catch (error) {
    logger.error('Error updating config:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
