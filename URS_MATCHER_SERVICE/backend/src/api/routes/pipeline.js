/**
 * Unified Matching Pipeline API Routes
 *
 * Endpoints:
 * - POST   /api/pipeline/match          - Match single item (ÚRS or OTSKP)
 * - POST   /api/pipeline/match-batch    - Match batch of items
 * - POST   /api/pipeline/classify       - Classify item to TSKP section only
 * - POST   /api/pipeline/classify-batch - Classify batch to TSKP sections
 * - GET    /api/pipeline/catalogs       - Get available catalogs and stats
 * - GET    /api/pipeline/tskp/tree/:code - Get TSKP section tree
 * - GET    /api/pipeline/otskp/:code     - Get OTSKP item by code
 *
 * @module api/routes/pipeline
 */

import express from 'express';
import { logger } from '../../utils/logger.js';
import { matchSingle, matchBatch, classifyOnly, classifyBatch, getCatalogInfo } from '../../services/unifiedMatchingPipeline.js';
import tskpParserService from '../../services/tskpParserService.js';
import otskpCatalogService from '../../services/otskpCatalogService.js';

const router = express.Router();

// ============================================================================
// POST /api/pipeline/match - Match single item
// ============================================================================

router.post('/match', async (req, res) => {
  const startTime = Date.now();

  try {
    const { text, quantity, unit, catalog, sectionHint, topN, minConfidence } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Missing or empty "text" field',
        usage: 'POST /api/pipeline/match { "text": "Podkladní beton C25/30", "catalog": "urs"|"otskp"|"both" }'
      });
    }

    const validCatalogs = ['urs', 'otskp', 'both'];
    if (catalog && !validCatalogs.includes(catalog)) {
      return res.status(400).json({
        error: `Invalid catalog: "${catalog}". Must be one of: ${validCatalogs.join(', ')}`
      });
    }

    const result = await matchSingle({
      text: text.trim(),
      quantity,
      unit,
      catalog: catalog || 'urs',
      sectionHint,
      classifyFirst: true,
      topN: topN || 5,
      minConfidence: minConfidence || 0.3
    });

    return res.status(200).json({
      success: true,
      data: result,
      timing: { totalMs: Date.now() - startTime }
    });

  } catch (error) {
    logger.error(`[PipelineAPI] Match error: ${error.message}`);
    return res.status(500).json({
      error: error.message,
      timing: { totalMs: Date.now() - startTime }
    });
  }
});

// ============================================================================
// POST /api/pipeline/match-batch - Match batch of items
// ============================================================================

router.post('/match-batch', async (req, res) => {
  const startTime = Date.now();

  try {
    const { items, catalog, concurrency } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Missing or empty "items" array',
        usage: 'POST /api/pipeline/match-batch { "items": [{ "text": "..." }, ...], "catalog": "urs"|"otskp"|"both" }'
      });
    }

    if (items.length > 100) {
      return res.status(400).json({
        error: `Too many items: ${items.length}. Maximum is 100 per request. Use /api/batch for larger jobs.`
      });
    }

    const requests = items.map(item => ({
      text: typeof item === 'string' ? item : item.text,
      quantity: item.quantity,
      unit: item.unit,
      catalog: catalog || 'urs',
      classifyFirst: true,
      topN: 5,
      minConfidence: 0.3
    }));

    const results = await matchBatch(requests, { concurrency: concurrency || 3 });

    return res.status(200).json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          matched: results.filter(r => r.candidates.length > 0).length,
          unmatched: results.filter(r => r.candidates.length === 0).length
        }
      },
      timing: { totalMs: Date.now() - startTime }
    });

  } catch (error) {
    logger.error(`[PipelineAPI] Match-batch error: ${error.message}`);
    return res.status(500).json({
      error: error.message,
      timing: { totalMs: Date.now() - startTime }
    });
  }
});

// ============================================================================
// POST /api/pipeline/classify - Classify to TSKP section
// ============================================================================

router.post('/classify', async (req, res) => {
  const startTime = Date.now();

  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Missing or empty "text" field'
      });
    }

    const classification = classifyOnly(text.trim());

    return res.status(200).json({
      success: true,
      data: {
        text: text.trim(),
        classification
      },
      timing: { totalMs: Date.now() - startTime }
    });

  } catch (error) {
    logger.error(`[PipelineAPI] Classify error: ${error.message}`);
    return res.status(500).json({
      error: error.message,
      timing: { totalMs: Date.now() - startTime }
    });
  }
});

// ============================================================================
// POST /api/pipeline/classify-batch - Classify batch to TSKP sections
// ============================================================================

router.post('/classify-batch', async (req, res) => {
  const startTime = Date.now();

  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Missing or empty "items" array'
      });
    }

    const texts = items.map(item => typeof item === 'string' ? item : item.text);
    const results = classifyBatch(texts);

    // Group by section for summary
    const sectionCounts = {};
    for (const r of results) {
      const sec = r.classification.sectionCode || 'unclassified';
      sectionCounts[sec] = (sectionCounts[sec] || 0) + 1;
    }

    return res.status(200).json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          classified: results.filter(r => r.classification.sectionCode).length,
          unclassified: results.filter(r => !r.classification.sectionCode).length,
          bySections: sectionCounts
        }
      },
      timing: { totalMs: Date.now() - startTime }
    });

  } catch (error) {
    logger.error(`[PipelineAPI] Classify-batch error: ${error.message}`);
    return res.status(500).json({
      error: error.message,
      timing: { totalMs: Date.now() - startTime }
    });
  }
});

// ============================================================================
// GET /api/pipeline/catalogs - Get available catalogs
// ============================================================================

router.get('/catalogs', (req, res) => {
  try {
    const info = getCatalogInfo();
    return res.status(200).json({ success: true, data: info });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/pipeline/tskp/tree/:code - Get TSKP section tree
// ============================================================================

router.get('/tskp/tree/:code', (req, res) => {
  try {
    const { code } = req.params;
    const maxDepth = parseInt(req.query.depth) || 3;

    const tree = tskpParserService.getSectionTree(code, maxDepth);

    return res.status(200).json({
      success: true,
      data: {
        sectionCode: code,
        sectionInfo: tskpParserService.getByCode(code),
        tree,
        totalItems: tree.length
      }
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/pipeline/tskp/categories - Get TSKP main categories
// ============================================================================

router.get('/tskp/categories', (req, res) => {
  try {
    const categories = tskpParserService.getMainCategories();
    return res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/pipeline/otskp/:code - Get OTSKP item by code
// ============================================================================

router.get('/otskp/:code', async (req, res) => {
  try {
    const { code } = req.params;
    await otskpCatalogService.load();

    const item = otskpCatalogService.getByCode(code);

    if (!item) {
      return res.status(404).json({ error: `OTSKP item not found: ${code}` });
    }

    return res.status(200).json({ success: true, data: item });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// GET /api/pipeline/otskp/search/:prefix - Search OTSKP by prefix
// ============================================================================

router.get('/otskp/prefix/:prefix', async (req, res) => {
  try {
    const { prefix } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    await otskpCatalogService.load();

    const items = otskpCatalogService.getByPrefix(prefix, limit);

    return res.status(200).json({
      success: true,
      data: { prefix, items, count: items.length }
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
