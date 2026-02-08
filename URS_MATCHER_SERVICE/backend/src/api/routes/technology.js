/**
 * Technology API Routes
 * Phase 6: Technology Calculations
 *
 * Endpoints:
 * - POST /api/technology/calculate        - Full technology calculation
 * - POST /api/technology/formwork         - Formwork area calculation
 * - POST /api/technology/reinforcement    - Reinforcement estimation
 * - POST /api/technology/enrich           - Enrich work items with tech data
 * - POST /api/technology/sections         - Work sections breakdown
 * - POST /api/technology/sequence         - Work execution sequence
 * - POST /api/technology/analyze          - Full project analysis
 * - POST /api/technology/kros            - KROS formula calculations
 * - POST /api/technology/estimate-days    - Estimate working days
 * - GET  /api/technology/coefficients     - All coefficients and constants
 * - GET  /api/technology/structure-types  - Available structure types
 * - GET  /api/technology/health           - Service health check
 */

import express from 'express';
import { logger } from '../../utils/logger.js';
import {
  calculateTechnology,
  enrichWorkItems,
  analyzeProject,
  calculateFormworkArea,
  calculateFormworkFromDimensions,
  estimateReinforcement,
  calculateReinforcementPercentage,
  suggestKariMesh,
  classifyWorkItem,
  breakdownIntoSections,
  generateWorkSequence,
  calculatePosition,
  estimateDays,
  estimateDuration,
  calculateProjectSummary,
  calcKrosUnitCzk,
  calcUnitCostOnM3,
  FORMWORK_COEFFICIENTS,
  FORMWORK_SYSTEMS,
  REINFORCEMENT_COEFFICIENTS,
  STEEL_GRADES,
  KARI_MESHES,
  HSV_SECTIONS,
  PSV_SECTIONS,
  MONOLIT_DEFAULTS,
  PRODUCTION_RATES
} from '../../services/technology/technologyService.js';

const router = express.Router();

// ============================================================================
// POST /api/technology/calculate - Full technology calculation
// ============================================================================

router.post('/calculate', (req, res) => {
  const startTime = Date.now();

  try {
    const { concreteVolume, structureType, description, concreteClass, dimensions, estimate } = req.body;

    if (!concreteVolume && !dimensions) {
      return res.status(400).json({
        success: false,
        error: 'concreteVolume (m3) or dimensions object is required'
      });
    }

    logger.info(`[Technology API] Calculate: ${structureType || 'auto-detect'}, ${concreteVolume} m3`);

    const result = calculateTechnology({
      concreteVolume,
      structureType,
      description,
      concreteClass,
      dimensions,
      estimate
    });

    res.json(result);

  } catch (error) {
    logger.error(`[Technology API] Calculate error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    });
  }
});

// ============================================================================
// POST /api/technology/formwork - Formwork area calculation
// ============================================================================

router.post('/formwork', (req, res) => {
  try {
    const { concreteVolume, structureType, estimate, formworkSystem, dimensions } = req.body;

    if (dimensions) {
      const result = calculateFormworkFromDimensions(dimensions, structureType || 'stena');
      return res.json(result);
    }

    if (!concreteVolume || !structureType) {
      return res.status(400).json({
        success: false,
        error: 'concreteVolume and structureType are required (or provide dimensions)'
      });
    }

    const result = calculateFormworkArea(concreteVolume, structureType, { estimate, formworkSystem });
    res.json(result);

  } catch (error) {
    logger.error(`[Technology API] Formwork error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// POST /api/technology/reinforcement - Reinforcement estimation
// ============================================================================

router.post('/reinforcement', (req, res) => {
  try {
    const { concreteVolume, structureType, estimate, concreteClass, includeWaste } = req.body;

    if (!concreteVolume || !structureType) {
      return res.status(400).json({
        success: false,
        error: 'concreteVolume and structureType are required'
      });
    }

    const result = estimateReinforcement(concreteVolume, structureType, {
      estimate,
      concreteClass,
      includeWaste
    });

    // Add percentage check if reinforcement was calculated
    if (result.success) {
      result.percentageCheck = calculateReinforcementPercentage(
        result.result.weightNet,
        concreteVolume
      );
    }

    res.json(result);

  } catch (error) {
    logger.error(`[Technology API] Reinforcement error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// POST /api/technology/enrich - Enrich work items with technology
// ============================================================================

router.post('/enrich', (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'items array is required'
      });
    }

    logger.info(`[Technology API] Enriching ${items.length} items`);

    const result = enrichWorkItems(items);
    res.json(result);

  } catch (error) {
    logger.error(`[Technology API] Enrich error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// POST /api/technology/sections - Work sections breakdown
// ============================================================================

router.post('/sections', (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'items array is required'
      });
    }

    logger.info(`[Technology API] Sections breakdown for ${items.length} items`);

    const breakdown = breakdownIntoSections(items);
    res.json(breakdown);

  } catch (error) {
    logger.error(`[Technology API] Sections error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// POST /api/technology/sequence - Work execution sequence
// ============================================================================

router.post('/sequence', (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'items array is required'
      });
    }

    const breakdown = breakdownIntoSections(items);
    if (!breakdown.success) {
      return res.json(breakdown);
    }

    const sequence = generateWorkSequence(breakdown);

    res.json({
      success: true,
      sequence,
      phaseCount: sequence.length,
      summary: breakdown.summary
    });

  } catch (error) {
    logger.error(`[Technology API] Sequence error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// POST /api/technology/analyze - Full project analysis
// ============================================================================

router.post('/analyze', (req, res) => {
  try {
    const { name, items, concreteVolume } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'items array is required'
      });
    }

    logger.info(`[Technology API] Full analysis: ${name || 'Unnamed'} (${items.length} items)`);

    const result = analyzeProject({ name, items, concreteVolume });
    res.json(result);

  } catch (error) {
    logger.error(`[Technology API] Analyze error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// POST /api/technology/kros - KROS formula calculations
// ============================================================================

router.post('/kros', (req, res) => {
  try {
    const { positions, position } = req.body;

    // Single position calculation
    if (position) {
      const result = calculatePosition(position);
      return res.json({ success: true, ...result });
    }

    // Multiple positions + project summary
    if (positions && Array.isArray(positions)) {
      const calculated = positions.map(p => calculatePosition(p));
      const summary = calculateProjectSummary(calculated);

      return res.json({
        success: true,
        positions: calculated,
        ...summary
      });
    }

    res.status(400).json({
      success: false,
      error: 'Provide "position" object or "positions" array'
    });

  } catch (error) {
    logger.error(`[Technology API] KROS error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// POST /api/technology/estimate-days - Estimate working days
// ============================================================================

router.post('/estimate-days', (req, res) => {
  try {
    const { workType, structureType, quantity } = req.body;

    if (!workType || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'workType and quantity are required'
      });
    }

    const result = estimateDays(workType, structureType, quantity);
    res.json(result);

  } catch (error) {
    logger.error(`[Technology API] Estimate-days error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// POST /api/technology/kari-mesh - Suggest kari mesh for slab
// ============================================================================

router.post('/kari-mesh', (req, res) => {
  try {
    const { slabArea, slabThickness, loadType } = req.body;

    if (!slabArea || !slabThickness) {
      return res.status(400).json({
        success: false,
        error: 'slabArea (m2) and slabThickness (m) are required'
      });
    }

    const result = suggestKariMesh(slabArea, slabThickness, loadType);
    res.json(result);

  } catch (error) {
    logger.error(`[Technology API] Kari-mesh error: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// GET /api/technology/coefficients - All coefficients and constants
// ============================================================================

router.get('/coefficients', (req, res) => {
  res.json({
    success: true,
    formwork: {
      coefficients: FORMWORK_COEFFICIENTS,
      systems: FORMWORK_SYSTEMS
    },
    reinforcement: {
      coefficients: REINFORCEMENT_COEFFICIENTS,
      steelGrades: STEEL_GRADES,
      kariMeshes: KARI_MESHES
    },
    production: PRODUCTION_RATES,
    monolit: MONOLIT_DEFAULTS
  });
});

// ============================================================================
// GET /api/technology/structure-types - Available structure types
// ============================================================================

router.get('/structure-types', (req, res) => {
  const types = Object.entries(FORMWORK_COEFFICIENTS).map(([key, value]) => ({
    id: key,
    name: value.name,
    formworkRatio: value.ratio,
    reinforcementRatio: REINFORCEMENT_COEFFICIENTS[key]?.ratio || null,
    formworkUnit: 'm2/m3',
    reinforcementUnit: 'kg/m3'
  }));

  res.json({
    success: true,
    types,
    count: types.length
  });
});

// ============================================================================
// GET /api/technology/sections-list - All HSV/PSV sections
// ============================================================================

router.get('/sections-list', (req, res) => {
  const hsv = Object.entries(HSV_SECTIONS).map(([code, section]) => ({
    code: section.code,
    name: section.name,
    category: 'HSV',
    typicalCostShare: section.typicalCostShare,
    units: section.units
  }));

  const psv = Object.entries(PSV_SECTIONS).map(([code, section]) => ({
    code: section.code,
    name: section.name,
    category: 'PSV',
    typicalCostShare: section.typicalCostShare
  }));

  res.json({
    success: true,
    hsv,
    psv,
    totalSections: hsv.length + psv.length
  });
});

// ============================================================================
// GET /api/technology/health - Health check
// ============================================================================

router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'technology',
    status: 'healthy',
    version: '1.0.0',
    phase: 6,
    modules: {
      formworkCalculator: true,
      reinforcementEstimator: true,
      workSectionsBreakdown: true,
      monolitIntegration: true
    },
    structureTypes: Object.keys(FORMWORK_COEFFICIENTS).length,
    hsvSections: Object.keys(HSV_SECTIONS).length,
    psvSections: Object.keys(PSV_SECTIONS).length,
    timestamp: new Date().toISOString()
  });
});

export default router;
