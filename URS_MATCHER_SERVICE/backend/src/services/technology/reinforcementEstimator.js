/**
 * Reinforcement Estimator
 * Estimates reinforcement weight (kg) from concrete volume (m3) by structure type
 *
 * Based on:
 * - ČSN EN 1992-1-1 (Eurocode 2) - minimum reinforcement ratios
 * - Czech construction practice (KROS typical values)
 * - Experience from Monolit-Planner projects
 */

import { logger } from '../../utils/logger.js';

// ============================================================================
// REINFORCEMENT COEFFICIENTS
// ============================================================================

/**
 * Reinforcement ratios (kg/m3) by structure type
 * Values based on Czech construction practice
 */
export const REINFORCEMENT_COEFFICIENTS = {
  // Foundations
  zakladova_patka: {
    name: 'Základová patka',
    ratio: { min: 60, typical: 80, max: 110 },
    unit: 'kg/m3',
    steelGrade: 'B500B',
    meshAllowed: true,
    typicalDiameters: [10, 12, 16],
    description: 'Patky: spodní roštová výztuž'
  },
  zakladovy_pas: {
    name: 'Základový pás',
    ratio: { min: 70, typical: 100, max: 130 },
    unit: 'kg/m3',
    steelGrade: 'B500B',
    meshAllowed: true,
    typicalDiameters: [10, 12, 14],
    description: 'Pásy: podélná + třmínky'
  },
  zakladova_deska: {
    name: 'Základová deska',
    ratio: { min: 80, typical: 110, max: 150 },
    unit: 'kg/m3',
    steelGrade: 'B500B',
    meshAllowed: true,
    typicalDiameters: [10, 12, 14, 16],
    description: 'Desky: horní + dolní výztuž, kari sítě'
  },

  // Vertical structures
  stena: {
    name: 'Stěna',
    ratio: { min: 80, typical: 120, max: 160 },
    unit: 'kg/m3',
    steelGrade: 'B500B',
    meshAllowed: true,
    typicalDiameters: [8, 10, 12],
    description: 'Stěny: svislá + vodorovná výztuž oboustranně'
  },
  sloup: {
    name: 'Sloup',
    ratio: { min: 150, typical: 220, max: 300 },
    unit: 'kg/m3',
    steelGrade: 'B500B',
    meshAllowed: false,
    typicalDiameters: [16, 20, 25],
    description: 'Sloupy: podélná výztuž + třmínky (hustě)'
  },

  // Horizontal structures
  stropni_deska: {
    name: 'Stropní deska',
    ratio: { min: 80, typical: 120, max: 160 },
    unit: 'kg/m3',
    steelGrade: 'B500B',
    meshAllowed: true,
    typicalDiameters: [8, 10, 12, 14],
    description: 'Stropní desky: spodní + horní výztuž, průběžná + příložky'
  },
  prusek: {
    name: 'Průvlak/nosník',
    ratio: { min: 120, typical: 180, max: 250 },
    unit: 'kg/m3',
    steelGrade: 'B500B',
    meshAllowed: false,
    typicalDiameters: [16, 20, 25],
    description: 'Průvlaky: podélná tahová + tlaková + třmínky'
  },

  // Special structures
  schodiste: {
    name: 'Schodiště',
    ratio: { min: 90, typical: 130, max: 170 },
    unit: 'kg/m3',
    steelGrade: 'B500B',
    meshAllowed: true,
    typicalDiameters: [10, 12, 14],
    description: 'Schodiště: tahová výztuž v desce ramene + rozdělovací'
  },
  pilir: {
    name: 'Pilíř/opěra',
    ratio: { min: 100, typical: 150, max: 200 },
    unit: 'kg/m3',
    steelGrade: 'B500B',
    meshAllowed: false,
    typicalDiameters: [16, 20, 25, 28],
    description: 'Mostní pilíře: masivní podélná výztuž + třmínky + smykové lišty'
  },
  tunel: {
    name: 'Tunel/štola',
    ratio: { min: 90, typical: 130, max: 180 },
    unit: 'kg/m3',
    steelGrade: 'B500B',
    meshAllowed: true,
    typicalDiameters: [12, 14, 16, 20],
    description: 'Tunelové ostění: vnější + vnitřní vrstva'
  }
};

/**
 * Steel grades and their properties
 */
export const STEEL_GRADES = {
  'B500B': {
    name: 'B500B',
    fy: 500,   // MPa - characteristic yield strength
    density: 7850,  // kg/m3
    description: 'Betonářská ocel žebírková',
    pricePerKg: { min: 22, typical: 28, max: 35 }  // CZK/kg
  },
  'B500A': {
    name: 'B500A',
    fy: 500,
    density: 7850,
    description: 'Betonářská ocel hladká (sítě)',
    pricePerKg: { min: 20, typical: 26, max: 32 }
  }
};

/**
 * Kari mesh (welded wire mesh) standard sizes
 */
export const KARI_MESHES = [
  { name: 'KH20', diameter: 4, spacing: 150, weight: 1.1, unit: 'kg/m2' },
  { name: 'KH30', diameter: 5, spacing: 150, weight: 1.72, unit: 'kg/m2' },
  { name: 'KH49', diameter: 6, spacing: 150, weight: 2.47, unit: 'kg/m2' },
  { name: 'KQ50', diameter: 6, spacing: 100, weight: 4.44, unit: 'kg/m2' },
  { name: 'KQ85', diameter: 8, spacing: 100, weight: 7.90, unit: 'kg/m2' },
  { name: 'KQ131', diameter: 10, spacing: 100, weight: 12.34, unit: 'kg/m2' }
];

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Estimate reinforcement from concrete volume
 *
 * @param {number} concreteVolume - Concrete volume in m3
 * @param {string} structureType - Structure type key
 * @param {Object} options - Options
 * @param {string} options.estimate - 'min', 'typical', 'max' (default: 'typical')
 * @param {string} options.concreteClass - e.g., 'C25/30' (affects minimum ratios)
 * @param {boolean} options.includeWaste - Add 5% waste (default: true)
 * @returns {Object} Estimation result
 */
export function estimateReinforcement(concreteVolume, structureType, options = {}) {
  const estimate = options.estimate || 'typical';
  const includeWaste = options.includeWaste !== false;

  if (!concreteVolume || concreteVolume <= 0) {
    return { success: false, error: 'Concrete volume must be positive' };
  }

  const coeff = REINFORCEMENT_COEFFICIENTS[structureType];
  if (!coeff) {
    return {
      success: false,
      error: `Unknown structure type: ${structureType}`,
      availableTypes: Object.keys(REINFORCEMENT_COEFFICIENTS)
    };
  }

  const ratio = coeff.ratio[estimate];
  let weight = concreteVolume * ratio;
  const wastePercent = includeWaste ? 5 : 0;
  const weightWithWaste = weight * (1 + wastePercent / 100);

  // Calculate all estimates
  const estimates = {
    min: Math.round(concreteVolume * coeff.ratio.min),
    typical: Math.round(concreteVolume * coeff.ratio.typical),
    max: Math.round(concreteVolume * coeff.ratio.max)
  };

  // Cost estimation
  const steelInfo = STEEL_GRADES[coeff.steelGrade];
  const costEstimate = steelInfo ? {
    min: Math.round(weightWithWaste * steelInfo.pricePerKg.min),
    typical: Math.round(weightWithWaste * steelInfo.pricePerKg.typical),
    max: Math.round(weightWithWaste * steelInfo.pricePerKg.max),
    currency: 'CZK'
  } : null;

  const result = {
    success: true,
    input: {
      concreteVolume,
      structureType,
      structureName: coeff.name,
      estimate
    },
    result: {
      weight: Math.round(weightWithWaste),
      weightNet: Math.round(weight),
      wastePercent,
      ratio,
      unit: 'kg',
      tons: Math.round(weightWithWaste / 100) / 10  // round to 0.1t
    },
    estimates,
    steelInfo: {
      grade: coeff.steelGrade,
      typicalDiameters: coeff.typicalDiameters,
      meshAllowed: coeff.meshAllowed
    },
    costEstimate,
    notes: coeff.description
  };

  logger.info(`[ReinforcementEst] ${coeff.name}: ${concreteVolume} m3 -> ${weightWithWaste.toFixed(0)} kg (ratio: ${ratio} kg/m3)`);

  return result;
}

/**
 * Calculate reinforcement percentage (for Eurocode checks)
 *
 * @param {number} reinfWeight - Reinforcement weight in kg
 * @param {number} concreteVolume - Concrete volume in m3
 * @returns {Object} Reinforcement percentage info
 */
export function calculateReinforcementPercentage(reinfWeight, concreteVolume) {
  const steelDensity = 7850; // kg/m3
  const steelVolume = reinfWeight / steelDensity;
  const percentage = (steelVolume / concreteVolume) * 100;

  // Eurocode limits
  const minPercentage = 0.13; // ČSN EN 1992-1-1, minimum
  const maxPercentage = 4.0;  // practical maximum

  return {
    percentage: Math.round(percentage * 1000) / 1000,
    steelVolume: Math.round(steelVolume * 1000) / 1000,
    isAboveMinimum: percentage >= minPercentage,
    isBelowMaximum: percentage <= maxPercentage,
    limits: { min: minPercentage, max: maxPercentage },
    note: percentage < minPercentage
      ? 'Pod minimem dle ČSN EN 1992-1-1!'
      : percentage > maxPercentage
        ? 'Nad praktickým maximem - překontrolovat návrh!'
        : 'V přijatelném rozmezí'
  };
}

/**
 * Suggest kari mesh for a slab
 *
 * @param {number} slabArea - Slab area in m2
 * @param {number} slabThickness - Slab thickness in m
 * @param {string} loadType - 'light', 'medium', 'heavy'
 * @returns {Object} Mesh recommendation
 */
export function suggestKariMesh(slabArea, slabThickness, loadType = 'medium') {
  const meshIndex = loadType === 'light' ? 0 : loadType === 'heavy' ? 4 : 2;
  const mesh = KARI_MESHES[Math.min(meshIndex, KARI_MESHES.length - 1)];

  // For thicker slabs, recommend two layers
  const layers = slabThickness > 0.2 ? 2 : 1;
  const totalWeight = Math.round(slabArea * mesh.weight * layers);

  return {
    success: true,
    recommendation: {
      meshType: mesh.name,
      diameter: mesh.diameter,
      spacing: mesh.spacing,
      layers,
      totalWeight,
      weightPerM2: mesh.weight * layers,
      unit: 'kg'
    },
    slabInfo: {
      area: slabArea,
      thickness: slabThickness,
      volume: Math.round(slabArea * slabThickness * 100) / 100,
      loadType
    },
    note: layers > 1
      ? `Doporučeny 2 vrstvy ${mesh.name} (tloušťka > 200mm)`
      : `Doporučena 1 vrstva ${mesh.name}`
  };
}

/**
 * Detect structure type from text (shared logic with formworkCalculator)
 */
export function detectStructureType(text) {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const patterns = [
    { type: 'zakladova_patka', pattern: /patk|patky|zakladov.*patk/ },
    { type: 'zakladovy_pas', pattern: /zakladov.*pas|pas.*zaklad|zaklad.*beton(?!.*desk)/ },
    { type: 'zakladova_deska', pattern: /zakladov.*desk|desk.*zaklad|podklad.*desk/ },
    { type: 'stena', pattern: /sten[ay]|zd[iy]|stena|obvodov|nosn.*sten|sten.*nosn/ },
    { type: 'sloup', pattern: /sloup|pilir(?!.*most)|column/ },
    { type: 'stropni_deska', pattern: /stropn|strop|desk.*vodorovn|vodorovn.*desk|preklad/ },
    { type: 'prusek', pattern: /pruvlak|nosnik|tram|traversa|beam/ },
    { type: 'schodiste', pattern: /schodist|rameno|podest|schod/ },
    { type: 'pilir', pattern: /most.*pilir|pilir.*most|opera.*most|most.*oper/ },
    { type: 'tunel', pattern: /tunel|stol[ay]|osteni/ }
  ];

  for (const { type, pattern } of patterns) {
    if (pattern.test(lower)) return type;
  }

  return null;
}
