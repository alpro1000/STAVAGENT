/**
 * Technology Service - Main Orchestrator
 * Coordinates formwork, reinforcement, work sections, and Monolit formulas
 *
 * Phase 6: Technology Calculations for URS Matcher Service
 *
 * Main capabilities:
 * 1. Full technology calculation from concrete volume
 * 2. Work item enrichment (add formwork + reinforcement estimates)
 * 3. Project-level breakdown and cost estimation
 */

import { logger } from '../../utils/logger.js';
import {
  calculateFormworkArea,
  calculateFormworkFromDimensions,
  detectStructureType as detectFormworkType,
  FORMWORK_COEFFICIENTS,
  FORMWORK_SYSTEMS
} from './formworkCalculator.js';
import {
  estimateReinforcement,
  calculateReinforcementPercentage,
  suggestKariMesh,
  REINFORCEMENT_COEFFICIENTS,
  STEEL_GRADES,
  KARI_MESHES
} from './reinforcementEstimator.js';
import {
  classifyWorkItem,
  breakdownIntoSections,
  generateWorkSequence,
  HSV_SECTIONS,
  PSV_SECTIONS
} from './workSectionsBreakdown.js';
import {
  calculatePosition,
  estimateDays,
  estimateDuration,
  calculateProjectSummary,
  calcKrosUnitCzk,
  calcUnitCostOnM3,
  MONOLIT_DEFAULTS,
  PRODUCTION_RATES
} from './monolitIntegration.js';

// ============================================================================
// FULL TECHNOLOGY CALCULATION
// ============================================================================

/**
 * Calculate complete technology package for a concrete element
 *
 * @param {Object} params - Input parameters
 * @param {number} params.concreteVolume - Volume in m3
 * @param {string} params.structureType - Structure type key
 * @param {string} params.description - Optional text description (auto-detect type)
 * @param {string} params.concreteClass - e.g., 'C25/30'
 * @param {Object} params.dimensions - Optional precise dimensions
 * @param {string} params.estimate - 'min', 'typical', 'max'
 * @returns {Object} Complete technology calculation
 */
export function calculateTechnology(params) {
  const startTime = Date.now();

  const {
    concreteVolume,
    structureType: inputType,
    description,
    concreteClass,
    dimensions,
    estimate = 'typical'
  } = params;

  // Auto-detect structure type from description if not provided
  const structureType = inputType || (description ? detectFormworkType(description) : null);

  if (!structureType) {
    return {
      success: false,
      error: 'Structure type is required. Provide structureType or description for auto-detection.',
      availableTypes: Object.keys(FORMWORK_COEFFICIENTS)
    };
  }

  if (!concreteVolume || concreteVolume <= 0) {
    return {
      success: false,
      error: 'Concrete volume (m3) must be positive'
    };
  }

  logger.info(`[TechnologyService] Calculating for ${structureType}: ${concreteVolume} m3`);

  // 1. Formwork calculation
  let formwork;
  if (dimensions) {
    formwork = calculateFormworkFromDimensions(dimensions, structureType);
  } else {
    formwork = calculateFormworkArea(concreteVolume, structureType, { estimate });
  }

  // 2. Reinforcement estimation
  const reinforcement = estimateReinforcement(concreteVolume, structureType, {
    estimate,
    concreteClass,
    includeWaste: true
  });

  // 3. Day estimation for each work type
  const daysEstimate = {
    beton: estimateDays('beton', structureType, concreteVolume),
    bedneni: formwork.success ? estimateDays('bedneni', structureType, formwork.result.formworkArea) : null,
    vyztuz: reinforcement.success ? estimateDays('vyztuz', structureType, reinforcement.result.weight) : null
  };

  // 4. Total days (sequential work: bednění → výztuž → beton)
  const totalDays =
    (daysEstimate.bedneni?.days || 0) +
    (daysEstimate.vyztuz?.days || 0) +
    (daysEstimate.beton?.days || 0);

  const duration = Date.now() - startTime;

  const result = {
    success: true,
    input: {
      concreteVolume,
      structureType,
      structureName: FORMWORK_COEFFICIENTS[structureType]?.name || structureType,
      concreteClass: concreteClass || 'C25/30 (default)',
      estimate
    },
    formwork: formwork.success ? {
      area: formwork.result.formworkArea,
      ratio: formwork.result.ratio,
      unit: 'm2',
      system: formwork.formworkSystem,
      estimates: formwork.estimates
    } : { error: formwork.error },
    reinforcement: reinforcement.success ? {
      weight: reinforcement.result.weight,
      weightNet: reinforcement.result.weightNet,
      tons: reinforcement.result.tons,
      ratio: reinforcement.result.ratio,
      unit: 'kg',
      steelGrade: reinforcement.steelInfo.grade,
      typicalDiameters: reinforcement.steelInfo.typicalDiameters,
      estimates: reinforcement.estimates,
      costEstimate: reinforcement.costEstimate
    } : { error: reinforcement.error },
    schedule: {
      beton: daysEstimate.beton.success ? {
        days: daysEstimate.beton.days,
        crew: daysEstimate.beton.crew,
        rate: daysEstimate.beton.rate
      } : null,
      bedneni: daysEstimate.bedneni?.success ? {
        days: daysEstimate.bedneni.days,
        crew: daysEstimate.bedneni.crew,
        rate: daysEstimate.bedneni.rate
      } : null,
      vyztuz: daysEstimate.vyztuz?.success ? {
        days: daysEstimate.vyztuz.days,
        crew: daysEstimate.vyztuz.crew,
        rate: daysEstimate.vyztuz.rate
      } : null,
      totalDays,
      totalWeeks: Math.round(totalDays / 5 * 10) / 10,
      sequence: 'Bednění → Výztuž → Betonáž'
    },
    duration
  };

  logger.info(`[TechnologyService] Result: formwork=${formwork.result?.formworkArea}m2, reinforcement=${reinforcement.result?.weight}kg, days=${totalDays}`);

  return result;
}

// ============================================================================
// WORK ITEM ENRICHMENT
// ============================================================================

/**
 * Enrich work items with technology estimates
 * Takes URS-matched items and adds formwork/reinforcement/schedule data
 *
 * @param {Array} items - Work items (from URS matching or import)
 * @returns {Object} Enriched items with technology data
 */
export function enrichWorkItems(items) {
  if (!items || items.length === 0) {
    return { success: false, error: 'No items to enrich' };
  }

  const enriched = [];
  let itemsWithTech = 0;

  for (const item of items) {
    const text = `${item.name || item.popis || ''} ${item.description || ''}`;
    const structureType = detectFormworkType(text);
    const volume = parseFloat(item.quantity || item.mnozstvi || 0);
    const unit = (item.unit || item.jednotka || '').toLowerCase();

    let technology = null;

    // Only calculate if we can detect structure type and have m3 volume
    if (structureType && volume > 0 && (unit === 'm3' || unit === 'm³')) {
      technology = calculateTechnology({
        concreteVolume: volume,
        structureType,
        estimate: 'typical'
      });
      if (technology.success) itemsWithTech++;
    }

    enriched.push({
      ...item,
      technology: technology?.success ? {
        structureType,
        structureName: technology.input.structureName,
        formworkArea: technology.formwork.area,
        reinforcementKg: technology.reinforcement.weight,
        reinforcementTons: technology.reinforcement.tons,
        scheduleDays: technology.schedule.totalDays
      } : null
    });
  }

  return {
    success: true,
    items: enriched,
    stats: {
      totalItems: items.length,
      enrichedItems: itemsWithTech,
      enrichmentRate: Math.round((itemsWithTech / items.length) * 100)
    }
  };
}

// ============================================================================
// PROJECT-LEVEL ANALYSIS
// ============================================================================

/**
 * Full project technology analysis
 * Combines work sections breakdown + technology calculations + cost estimation
 *
 * @param {Object} project - Project data
 * @param {string} project.name - Project name
 * @param {Array} project.items - Work items
 * @param {number} project.concreteVolume - Total concrete volume (optional)
 * @returns {Object} Complete project analysis
 */
export function analyzeProject(project) {
  const startTime = Date.now();

  if (!project.items || project.items.length === 0) {
    return { success: false, error: 'No work items in project' };
  }

  logger.info(`[TechnologyService] Analyzing project: ${project.name || 'Unnamed'} (${project.items.length} items)`);

  // 1. Work sections breakdown
  const sections = breakdownIntoSections(project.items);

  // 2. Work sequence
  const sequence = sections.success ? generateWorkSequence(sections) : [];

  // 3. Enrich items with technology
  const enriched = enrichWorkItems(project.items);

  // 4. If concrete volume is known, calculate technology package
  let technologyPackage = null;
  if (project.concreteVolume && project.concreteVolume > 0) {
    // Determine dominant structure type
    const typeFrequency = {};
    for (const item of enriched.items) {
      if (item.technology?.structureType) {
        typeFrequency[item.technology.structureType] = (typeFrequency[item.technology.structureType] || 0) + 1;
      }
    }
    const dominantType = Object.entries(typeFrequency)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'stena';

    technologyPackage = calculateTechnology({
      concreteVolume: project.concreteVolume,
      structureType: dominantType
    });
  }

  // 5. Aggregate formwork and reinforcement from enriched items
  let totalFormwork = 0;
  let totalReinforcement = 0;
  let totalDays = 0;
  for (const item of enriched.items) {
    if (item.technology) {
      totalFormwork += item.technology.formworkArea || 0;
      totalReinforcement += item.technology.reinforcementKg || 0;
      totalDays = Math.max(totalDays, item.technology.scheduleDays || 0);
    }
  }

  const duration = Date.now() - startTime;

  return {
    success: true,
    project: {
      name: project.name,
      itemCount: project.items.length
    },
    sections: sections.success ? {
      breakdown: sections.summary,
      hsvSections: Object.keys(sections.breakdown.HSV).length,
      psvSections: Object.keys(sections.breakdown.PSV).length,
      details: sections.breakdown
    } : null,
    sequence,
    technology: {
      totalFormworkArea: Math.round(totalFormwork * 100) / 100,
      totalReinforcementKg: Math.round(totalReinforcement),
      totalReinforcementTons: Math.round(totalReinforcement / 100) / 10,
      estimatedDays: totalDays,
      enrichedItems: enriched.stats.enrichedItems,
      enrichmentRate: enriched.stats.enrichmentRate
    },
    technologyPackage: technologyPackage?.success ? technologyPackage : null,
    enrichedItems: enriched.items,
    duration
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  // Sub-module exports for direct access
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

  // Constants
  FORMWORK_COEFFICIENTS,
  FORMWORK_SYSTEMS,
  REINFORCEMENT_COEFFICIENTS,
  STEEL_GRADES,
  KARI_MESHES,
  HSV_SECTIONS,
  PSV_SECTIONS,
  MONOLIT_DEFAULTS,
  PRODUCTION_RATES
};

export default {
  calculateTechnology,
  enrichWorkItems,
  analyzeProject
};
