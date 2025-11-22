/**
 * Catalog Routes
 * Access to URS items catalog
 */

import express from 'express';
import { getDatabase } from '../../db/init.js';
import { logger } from '../../utils/logger.js';

const router = express.Router();

// GET /api/urs-catalog - Get all URS items or search
router.get('/', async (req, res) => {
  try {
    const { search, limit = 100 } = req.query;
    const db = await getDatabase();

    let query = 'SELECT * FROM urs_items';
    let params = [];

    if (search && search.trim().length > 0) {
      query += ` WHERE urs_name LIKE ? OR urs_code LIKE ?`;
      const searchPattern = `%${search}%`;
      params = [searchPattern, searchPattern];
    }

    query += ` LIMIT ?`;
    params.push(parseInt(limit) || 100);

    const items = await db.all(query, params);

    res.json({
      total: items.length,
      items: items.map(item => ({
        urs_code: item.urs_code,
        urs_name: item.urs_name,
        unit: item.unit,
        description: item.description
      }))
    });

  } catch (error) {
    logger.error(`[CATALOG] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/urs-catalog/:code - Get specific URS item
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const db = await getDatabase();

    const item = await db.get(
      'SELECT * FROM urs_items WHERE urs_code = ?',
      [code]
    );

    if (!item) {
      return res.status(404).json({ error: 'URS item not found' });
    }

    res.json({
      urs_code: item.urs_code,
      urs_name: item.urs_name,
      unit: item.unit,
      description: item.description
    });

  } catch (error) {
    logger.error(`[CATALOG] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
