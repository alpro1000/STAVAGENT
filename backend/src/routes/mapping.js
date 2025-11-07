/**
 * Mapping routes
 * POST /api/mapping/apply - Apply column mapping to import
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/init.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// GET all mapping profiles
router.get('/', (req, res) => {
  try {
    const profiles = db.prepare(`
      SELECT id, name, description, column_mapping, created_at
      FROM mapping_profiles
      ORDER BY created_at DESC
    `).all();

    const parsedProfiles = profiles.map(p => ({
      ...p,
      column_mapping: JSON.parse(p.column_mapping)
    }));

    res.json(parsedProfiles);
  } catch (error) {
    logger.error('Error fetching mapping profiles:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST save mapping profile
router.post('/', (req, res) => {
  try {
    const { name, description, column_mapping } = req.body;

    if (!name || !column_mapping) {
      return res.status(400).json({ error: 'name and column_mapping are required' });
    }

    const id = uuidv4();

    db.prepare(`
      INSERT INTO mapping_profiles (id, name, description, column_mapping)
      VALUES (?, ?, ?, ?)
    `).run(id, name, description || '', JSON.stringify(column_mapping));

    res.json({
      success: true,
      profile: {
        id,
        name,
        description,
        column_mapping
      }
    });
  } catch (error) {
    logger.error('Error saving mapping profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST apply mapping (this would be called from upload service)
router.post('/apply', (req, res) => {
  try {
    const { raw_rows, column_mapping } = req.body;

    if (!raw_rows || !column_mapping) {
      return res.status(400).json({ error: 'raw_rows and column_mapping are required' });
    }

    // Apply mapping
    const normalizedRows = raw_rows.map(row => {
      const normalized = {};

      Object.entries(column_mapping).forEach(([sourceCol, targetField]) => {
        if (row[sourceCol] !== undefined) {
          normalized[targetField] = row[sourceCol];
        }
      });

      return normalized;
    });

    res.json({
      success: true,
      normalized_positions: normalizedRows
    });
  } catch (error) {
    logger.error('Error applying mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
