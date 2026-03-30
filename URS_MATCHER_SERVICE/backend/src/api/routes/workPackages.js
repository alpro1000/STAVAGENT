/**
 * Work Packages API Routes
 *
 * Endpoints for querying and building work packages
 * from co-occurrence analysis of public procurement data.
 */

import express from 'express';
import { logger } from '../../utils/logger.js';
import { buildCooccurrence, getCooccurring, getCooccurrenceStats } from '../../services/cooccurrenceBuilder.js';
import { buildWorkPackages, searchWorkPackages, getAllWorkPackages, getWorkPackage } from '../../services/workPackageBuilder.js';

const router = express.Router();

// ============================================================================
// Work Packages — query
// ============================================================================

/**
 * GET /api/v1/work-packages
 * Search work packages by keyword.
 * Query: keyword (required), limit (default: 10)
 */
router.get('/', async (req, res) => {
  try {
    const { keyword, limit = 10 } = req.query;

    if (keyword) {
      const packages = await searchWorkPackages(keyword, parseInt(limit));
      return res.json({ packages, total: packages.length });
    }

    // No keyword — return all
    const packages = await getAllWorkPackages();
    res.json({ packages, total: packages.length });
  } catch (err) {
    logger.error(`[WP] GET / error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/work-packages/:id
 * Get a specific work package by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const wp = await getWorkPackage(req.params.id);
    if (!wp) {
      return res.status(404).json({ error: 'Work package not found' });
    }
    res.json(wp);
  } catch (err) {
    logger.error(`[WP] GET /:id error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Work Packages — build
// ============================================================================

/**
 * POST /api/v1/work-packages/build
 * Rebuild work packages from co-occurrence data.
 * Body: { minClusterSize?: number, minFrequency?: number }
 */
router.post('/build', async (req, res) => {
  try {
    const { minClusterSize, minFrequency, expansionThreshold } = req.body || {};

    // Step 1: Build co-occurrence matrix
    logger.info('[WP] Step 1: Building co-occurrence matrix...');
    const coResult = await buildCooccurrence({ level: 'all', minCount: 2 });

    // Step 2: Cluster into work packages
    logger.info('[WP] Step 2: Clustering into work packages...');
    const packages = await buildWorkPackages({
      minClusterSize,
      minFrequency,
      expansionThreshold,
    });

    res.json({
      cooccurrence: coResult,
      work_packages: packages.length,
      packages: packages.map(wp => ({
        package_id: wp.package_id,
        name: wp.name,
        work_type: wp.work_type,
        items_count: wp.items?.length || 0,
        confidence: wp.confidence,
        companions: wp.companion_packages?.length || 0,
      })),
    });
  } catch (err) {
    logger.error(`[WP] POST /build error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// Co-occurrence — query
// ============================================================================

/**
 * GET /api/v1/work-packages/cooccurrence/stats
 * Co-occurrence matrix statistics.
 */
router.get('/cooccurrence/stats', async (req, res) => {
  try {
    const stats = await getCooccurrenceStats();
    res.json(stats);
  } catch (err) {
    logger.error(`[WP] GET /cooccurrence/stats error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/work-packages/cooccurrence/:code
 * Get co-occurring items for a given code.
 * Query: level (dil_3|dil_6|full|work_type), limit (default: 20)
 */
router.get('/cooccurrence/:code', async (req, res) => {
  try {
    const { level = 'dil_3', limit = 20 } = req.query;
    const results = await getCooccurring(req.params.code, level, parseInt(limit));
    res.json({ code: req.params.code, level, results });
  } catch (err) {
    logger.error(`[WP] GET /cooccurrence/:code error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
