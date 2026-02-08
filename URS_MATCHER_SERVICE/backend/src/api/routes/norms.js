/**
 * Norms API Routes
 * API для поиска и управления строительными нормами
 *
 * Endpoints:
 * - GET  /api/norms/search          - Поиск норм
 * - GET  /api/norms/code/:code      - Получить норму по коду
 * - GET  /api/norms/laws            - Поиск законов
 * - POST /api/norms/for-work        - Нормы для вида работ
 * - POST /api/norms/for-project     - Нормы для проекта
 * - GET  /api/norms/categories      - Категории ČSN
 * - GET  /api/norms/stats           - Статистика базы знаний
 * - POST /api/norms/import          - Импорт норм
 * - POST /api/norms/rebuild-index   - Перестроить индекс
 */

import express from 'express';
import { logger } from '../../utils/logger.js';
import {
  findNorms,
  fetchNorm,
  findBuildingLaws,
  getRelevantNormsForProject,
  getNormsForWork,
  importNorms,
  getKBStatistics,
  rebuildKBIndex,
  CSN_CATEGORIES,
  NORM_TYPES,
  TRUSTED_SOURCES
} from '../../services/norms/normsService.js';

const router = express.Router();

// ============================================================================
// GET /api/norms/search - Поиск норм
// ============================================================================

router.get('/search', async (req, res) => {
  const startTime = Date.now();

  try {
    const { q, query, type, category, limit, forceWeb } = req.query;
    const searchQuery = q || query;

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter (q or query) is required'
      });
    }

    logger.info(`[Norms API] Search: "${searchQuery}"`);

    const results = await findNorms(searchQuery, {
      type: type || null,
      category: category || null,
      limit: parseInt(limit) || 20,
      forceWebSearch: forceWeb === 'true'
    });

    res.json({
      success: true,
      query: searchQuery,
      ...results
    });

  } catch (error) {
    logger.error(`[Norms API] Search error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    });
  }
});

// ============================================================================
// GET /api/norms/code/:code - Получить норму по коду
// ============================================================================

router.get('/code/:code', async (req, res) => {
  const startTime = Date.now();

  try {
    const { code } = req.params;
    const decodedCode = decodeURIComponent(code);

    logger.info(`[Norms API] Fetch norm: ${decodedCode}`);

    const norm = await fetchNorm(decodedCode);

    if (!norm) {
      return res.status(404).json({
        success: false,
        error: `Norm not found: ${decodedCode}`
      });
    }

    res.json({
      success: true,
      norm,
      duration: Date.now() - startTime
    });

  } catch (error) {
    logger.error(`[Norms API] Fetch error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    });
  }
});

// ============================================================================
// GET /api/norms/laws - Поиск законов
// ============================================================================

router.get('/laws', async (req, res) => {
  const startTime = Date.now();

  try {
    const { topic } = req.query;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: 'Topic parameter is required'
      });
    }

    logger.info(`[Norms API] Search laws: ${topic}`);

    const results = await findBuildingLaws(topic);

    res.json({
      success: true,
      ...results,
      duration: Date.now() - startTime
    });

  } catch (error) {
    logger.error(`[Norms API] Laws search error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    });
  }
});

// ============================================================================
// POST /api/norms/for-work - Нормы для вида работ
// ============================================================================

router.post('/for-work', async (req, res) => {
  const startTime = Date.now();

  try {
    const { workDescription, description } = req.body;
    const desc = workDescription || description;

    if (!desc) {
      return res.status(400).json({
        success: false,
        error: 'workDescription is required'
      });
    }

    logger.info(`[Norms API] Norms for work: "${desc.substring(0, 50)}..."`);

    const norms = await getNormsForWork(desc);

    res.json({
      success: true,
      workDescription: desc,
      norms,
      count: norms.length,
      duration: Date.now() - startTime
    });

  } catch (error) {
    logger.error(`[Norms API] For-work error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    });
  }
});

// ============================================================================
// POST /api/norms/for-project - Нормы для проекта
// ============================================================================

router.post('/for-project', async (req, res) => {
  const startTime = Date.now();

  try {
    const { projectName, buildingType, mainSystems, positions } = req.body;

    logger.info(`[Norms API] Norms for project: ${projectName || 'Unknown'}`);

    const norms = await getRelevantNormsForProject({
      projectName,
      buildingType,
      mainSystems,
      positions
    });

    res.json({
      success: true,
      projectName,
      norms,
      count: norms.length,
      duration: Date.now() - startTime
    });

  } catch (error) {
    logger.error(`[Norms API] For-project error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    });
  }
});

// ============================================================================
// GET /api/norms/categories - Категории ČSN
// ============================================================================

router.get('/categories', (req, res) => {
  try {
    const categories = Object.entries(CSN_CATEGORIES).map(([code, info]) => ({
      code,
      name: info.name,
      topics: info.topics
    }));

    res.json({
      success: true,
      categories,
      count: categories.length
    });
  } catch (error) {
    logger.error(`[Norms API] Categories error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/norms/types - Типы норм
// ============================================================================

router.get('/types', (req, res) => {
  try {
    const types = Object.entries(NORM_TYPES).map(([key, info]) => ({
      id: info.id,
      name: info.name,
      fullName: info.fullName,
      description: info.description
    }));

    res.json({
      success: true,
      types,
      count: types.length
    });
  } catch (error) {
    logger.error(`[Norms API] Types error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/norms/sources - Доверенные источники
// ============================================================================

router.get('/sources', (req, res) => {
  res.json({
    success: true,
    sources: TRUSTED_SOURCES,
    count: TRUSTED_SOURCES.length
  });
});

// ============================================================================
// GET /api/norms/stats - Статистика базы знаний
// ============================================================================

router.get('/stats', async (req, res) => {
  try {
    const stats = await getKBStatistics();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error(`[Norms API] Stats error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/norms/import - Импорт норм
// ============================================================================

router.post('/import', async (req, res) => {
  const startTime = Date.now();

  try {
    const { norms } = req.body;

    if (!norms || !Array.isArray(norms) || norms.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'norms array is required'
      });
    }

    logger.info(`[Norms API] Importing ${norms.length} norms`);

    const results = await importNorms(norms);

    res.json({
      success: true,
      ...results,
      duration: Date.now() - startTime
    });

  } catch (error) {
    logger.error(`[Norms API] Import error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    });
  }
});

// ============================================================================
// POST /api/norms/rebuild-index - Перестроить индекс
// ============================================================================

router.post('/rebuild-index', async (req, res) => {
  const startTime = Date.now();

  try {
    logger.info('[Norms API] Rebuilding index...');

    const index = await rebuildKBIndex();

    res.json({
      success: true,
      entriesCount: index.entries.length,
      lastUpdate: index.lastUpdate,
      duration: Date.now() - startTime
    });

  } catch (error) {
    logger.error(`[Norms API] Rebuild error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    });
  }
});

// ============================================================================
// GET /api/norms/health - Health check
// ============================================================================

router.get('/health', async (req, res) => {
  try {
    const stats = await getKBStatistics();

    res.json({
      success: true,
      service: 'norms',
      status: 'healthy',
      knowledgeBase: {
        totalNorms: stats.totalNorms,
        lastUpdate: stats.lastUpdate
      },
      webSearch: {
        braveEnabled: !!process.env.BRAVE_API_KEY,
        tavilyEnabled: !!process.env.TAVILY_API_KEY
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      service: 'norms',
      status: 'unhealthy',
      error: error.message
    });
  }
});

export default router;
