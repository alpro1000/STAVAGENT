/**
 * Prices API Routes
 * API для работы с ценами материалов и коммерческими предложениями
 *
 * Endpoints:
 * - GET  /api/prices/find          - Найти цену материала
 * - GET  /api/prices/category/:cat - Цены по категории
 * - POST /api/prices/offer         - Загрузить коммерческое предложение
 * - GET  /api/prices/offers/:projectId - Предложения для проекта
 * - GET  /api/prices/history       - История цен
 * - GET  /api/prices/analyze       - Анализ тренда цен
 * - POST /api/prices/compare       - Сравнить цены от разных поставщиков
 * - POST /api/prices/import        - Импорт цен из файла
 * - POST /api/prices/manual        - Ручной ввод цены
 * - GET  /api/prices/sources       - Список источников цен
 */

import express from 'express';
import { logger } from '../../utils/logger.js';
import {
  findPrice,
  uploadCommercialOffer,
  getOffersForProject,
  analyzePriceTrend,
  comparePrices,
  getPricesForProject,
  importPricesFromFile,
  PRICE_SOURCES,
  MATERIAL_CATEGORIES,
  DEFAULT_PRICES
} from '../../services/prices/priceService.js';
import {
  savePrice,
  getCategoryPrices
} from '../../services/prices/priceDatabase.js';

const router = express.Router();

// ============================================================================
// PRICE LOOKUP
// ============================================================================

/**
 * GET /api/prices/find
 * Find price for material
 *
 * Query params:
 * - category: Material category (beton, armatura, zdivo, etc.)
 * - code: Material code
 * - projectId: Optional project ID for commercial offer priority
 * - region: Optional region (default: Praha)
 * - searchWeb: Optional boolean to enable web search
 * - includeHistory: Optional boolean to include price history
 */
router.get('/find', async (req, res) => {
  try {
    const { category, code, projectId, region, searchWeb, includeHistory } = req.query;

    if (!category || !code) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['category', 'code']
      });
    }

    logger.info(`[PricesAPI] Finding price: ${category}/${code}`);

    const result = await findPrice(category, code, {
      projectId,
      region: region || 'Praha',
      searchWeb: searchWeb !== 'false',
      includeHistory: includeHistory === 'true'
    });

    res.json(result);

  } catch (error) {
    logger.error(`[PricesAPI] Find price error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prices/category/:category
 * Get all prices for category
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { limit, offset } = req.query;

    logger.info(`[PricesAPI] Getting prices for category: ${category}`);

    const prices = await getCategoryPrices(category, {
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0
    });

    res.json({
      category,
      prices,
      count: prices.length
    });

  } catch (error) {
    logger.error(`[PricesAPI] Category prices error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// COMMERCIAL OFFERS
// ============================================================================

/**
 * POST /api/prices/offer
 * Upload commercial offer
 *
 * Body:
 * - projectId: Project ID to link offer
 * - supplier: Supplier name
 * - offerNumber: Optional offer number
 * - validUntil: Optional validity date
 * - items: Array of price items [{ materialCode, category, price, unit, quantity }]
 * - notes: Optional notes
 */
router.post('/offer', async (req, res) => {
  try {
    const { projectId, supplier, offerNumber, validUntil, items, notes } = req.body;

    if (!projectId || !supplier || !items || items.length === 0) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['projectId', 'supplier', 'items']
      });
    }

    logger.info(`[PricesAPI] Uploading offer from ${supplier} for project ${projectId}`);

    const result = await uploadCommercialOffer({
      projectId,
      supplier,
      offerNumber,
      validUntil,
      items,
      notes
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    logger.error(`[PricesAPI] Upload offer error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prices/offers/:projectId
 * Get all offers for project
 */
router.get('/offers/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    logger.info(`[PricesAPI] Getting offers for project: ${projectId}`);

    const offers = await getOffersForProject(projectId);

    res.json({
      projectId,
      offers,
      count: offers.length
    });

  } catch (error) {
    logger.error(`[PricesAPI] Get offers error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PRICE ANALYSIS
// ============================================================================

/**
 * GET /api/prices/history
 * Get price history for material
 *
 * Query params:
 * - category: Material category
 * - code: Material code
 * - months: Number of months (default: 12)
 */
router.get('/history', async (req, res) => {
  try {
    const { category, code, months } = req.query;

    if (!category || !code) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['category', 'code']
      });
    }

    logger.info(`[PricesAPI] Getting price history: ${category}/${code}`);

    const result = await findPrice(category, code, {
      includeHistory: true,
      searchWeb: false
    });

    res.json({
      category,
      code,
      history: result.history || [],
      analysis: result.analysis
    });

  } catch (error) {
    logger.error(`[PricesAPI] Price history error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prices/analyze
 * Analyze price trend
 *
 * Query params:
 * - category: Material category
 * - code: Material code
 * - months: Number of months (default: 12)
 */
router.get('/analyze', async (req, res) => {
  try {
    const { category, code, months } = req.query;

    if (!category || !code) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['category', 'code']
      });
    }

    logger.info(`[PricesAPI] Analyzing price trend: ${category}/${code}`);

    const analysis = await analyzePriceTrend(
      category,
      code,
      parseInt(months) || 12
    );

    res.json({
      category,
      code,
      ...analysis
    });

  } catch (error) {
    logger.error(`[PricesAPI] Price analysis error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prices/compare
 * Compare prices from different sources
 *
 * Body:
 * - category: Material category
 * - code: Material code
 * - projectId: Optional project ID
 * - region: Optional region
 */
router.post('/compare', async (req, res) => {
  try {
    const { category, code, projectId, region } = req.body;

    if (!category || !code) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['category', 'code']
      });
    }

    logger.info(`[PricesAPI] Comparing prices: ${category}/${code}`);

    const comparison = await comparePrices(category, code, {
      projectId,
      region: region || 'Praha'
    });

    res.json(comparison);

  } catch (error) {
    logger.error(`[PricesAPI] Price comparison error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * POST /api/prices/project
 * Get prices for all project materials
 *
 * Body:
 * - projectId: Project ID
 * - materials: Array of { category, code, region }
 */
router.post('/project', async (req, res) => {
  try {
    const { projectId, materials } = req.body;

    if (!projectId || !materials || materials.length === 0) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['projectId', 'materials']
      });
    }

    logger.info(`[PricesAPI] Getting prices for project ${projectId}: ${materials.length} materials`);

    const result = await getPricesForProject(projectId, materials);

    res.json(result);

  } catch (error) {
    logger.error(`[PricesAPI] Project prices error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/prices/import
 * Import prices from parsed file
 *
 * Body:
 * - prices: Array of price objects
 * - source: Source name
 */
router.post('/import', async (req, res) => {
  try {
    const { prices, source } = req.body;

    if (!prices || prices.length === 0) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['prices']
      });
    }

    logger.info(`[PricesAPI] Importing ${prices.length} prices from ${source || 'unknown'}`);

    const result = await importPricesFromFile(prices);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    logger.error(`[PricesAPI] Import prices error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// MANUAL ENTRY
// ============================================================================

/**
 * POST /api/prices/manual
 * Manual price entry
 *
 * Body:
 * - category: Material category
 * - materialCode: Material code
 * - price: Price value
 * - unit: Price unit (m³, kg, ks, etc.)
 * - supplier: Optional supplier name
 * - projectId: Optional project ID
 * - notes: Optional notes
 */
router.post('/manual', async (req, res) => {
  try {
    const { category, materialCode, price, unit, supplier, projectId, notes } = req.body;

    if (!category || !materialCode || !price || !unit) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['category', 'materialCode', 'price', 'unit']
      });
    }

    logger.info(`[PricesAPI] Manual price entry: ${category}/${materialCode} = ${price} ${unit}`);

    const saved = await savePrice({
      category,
      materialCode,
      price: parseFloat(price),
      unit,
      supplier: supplier || 'manual_entry',
      source: 'manual',
      projectId,
      notes,
      enteredAt: new Date().toISOString()
    });

    res.json({
      success: saved,
      message: saved ? 'Price saved successfully' : 'Failed to save price'
    });

  } catch (error) {
    logger.error(`[PricesAPI] Manual price error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// METADATA
// ============================================================================

/**
 * GET /api/prices/sources
 * Get available price sources
 */
router.get('/sources', (req, res) => {
  res.json({
    sources: PRICE_SOURCES,
    categories: MATERIAL_CATEGORIES,
    defaultPrices: DEFAULT_PRICES
  });
});

/**
 * GET /api/prices/categories
 * Get material categories
 */
router.get('/categories', (req, res) => {
  res.json({
    categories: MATERIAL_CATEGORIES
  });
});

export default router;
