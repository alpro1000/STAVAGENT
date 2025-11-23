/**
 * TŘÍDNÍK API Routes
 * Endpoints for classification data
 */

import express from 'express';
import { loadTridnik, groupByTridnik } from '../../services/tridnikParser.js';
import { logger } from '../../utils/logger.js';

const router = express.Router();

// GET /api/tridnik/categories
// Returns all TŘÍDNÍK categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await loadTridnik();
    res.json({
      count: Object.keys(categories).length,
      categories
    });
  } catch (error) {
    logger.error(`[TŘÍDNÍK API] Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
