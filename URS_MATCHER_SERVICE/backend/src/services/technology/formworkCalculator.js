/**
 * Formwork Calculator
 * Calculates formwork area (m2) from concrete volume (m3) based on structure type
 *
 * Uses Czech construction industry coefficients:
 * - ČSN EN 13670 - Provádění betonových konstrukcí
 * - Typical ratios from KROS database
 */

import { logger } from '../../utils/logger.js';

// ============================================================================
// STRUCTURE TYPES AND COEFFICIENTS
// ============================================================================

/**
 * Formwork-to-concrete ratios (m2/m3) by structure type
 * Based on Czech construction practice and KROS data
 */
export const FORMWORK_COEFFICIENTS = {
  // Foundations
  zakladova_patka: {
    name: 'Základová patka',
    nameRu: 'Фундаментная подушка',
    ratio: { min: 2.5, typical: 3.2, max: 4.0 },
    unit: 'm2/m3',
    description: 'Bednění základových patek (stupňovité, šikmé)',
    systemType: 'tradicni',  // or 'systemove'
    reusability: 3  // typical number of reuses
  },
  zakladovy_pas: {
    name: 'Základový pás',
    nameRu: 'Ленточный фундамент',
    ratio: { min: 3.0, typical: 4.0, max: 5.0 },
    unit: 'm2/m3',
    description: 'Bednění základových pásů',
    systemType: 'tradicni',
    reusability: 4
  },
  zakladova_deska: {
    name: 'Základová deska',
    nameRu: 'Фундаментная плита',
    ratio: { min: 0.8, typical: 1.2, max: 1.8 },
    unit: 'm2/m3',
    description: 'Bednění okrajů základové desky (minimální)',
    systemType: 'tradicni',
    reusability: 1
  },

  // Vertical structures
  stena: {
    name: 'Stěna',
    nameRu: 'Стена',
    ratio: { min: 4.0, typical: 6.0, max: 8.0 },
    unit: 'm2/m3',
    description: 'Oboustranné bednění stěn',
    systemType: 'systemove',
    reusability: 30
  },
  sloup: {
    name: 'Sloup',
    nameRu: 'Колонна',
    ratio: { min: 6.0, typical: 9.0, max: 12.0 },
    unit: 'm2/m3',
    description: 'Bednění sloupů (čtvercové, kruhové)',
    systemType: 'systemove',
    reusability: 50
  },

  // Horizontal structures
  stropni_deska: {
    name: 'Stropní deska',
    nameRu: 'Перекрытие',
    ratio: { min: 1.5, typical: 2.0, max: 2.5 },
    unit: 'm2/m3',
    description: 'Bednění stropních desek (vodorovné)',
    systemType: 'systemove',
    reusability: 20
  },
  prusek: {
    name: 'Průvlak/nosník',
    nameRu: 'Балка/ригель',
    ratio: { min: 5.0, typical: 7.5, max: 10.0 },
    unit: 'm2/m3',
    description: 'Bednění průvlaků a nosníků',
    systemType: 'systemove',
    reusability: 15
  },

  // Special structures
  schodiste: {
    name: 'Schodiště',
    nameRu: 'Лестница',
    ratio: { min: 4.0, typical: 6.0, max: 8.0 },
    unit: 'm2/m3',
    description: 'Bednění schodišťových ramen a podest',
    systemType: 'tradicni',
    reusability: 2
  },
  pilir: {
    name: 'Pilíř/opěra',
    nameRu: 'Опора моста',
    ratio: { min: 4.5, typical: 6.5, max: 9.0 },
    unit: 'm2/m3',
    description: 'Bednění mostních pilířů a opěr',
    systemType: 'systemove',
    reusability: 5
  },
  tunel: {
    name: 'Tunel/štola',
    nameRu: 'Тоннель',
    ratio: { min: 3.0, typical: 4.5, max: 6.0 },
    unit: 'm2/m3',
    description: 'Bednění tunelového ostění',
    systemType: 'systemove',
    reusability: 10
  }
};

/**
 * Formwork system types and their cost multipliers
 */
export const FORMWORK_SYSTEMS = {
  tradicni: {
    name: 'Tradiční (dřevěné)',
    costMultiplier: 1.0,
    laborMultiplier: 1.3,
    description: 'Tesařské bednění z prken a hranolů'
  },
  systemove: {
    name: 'Systémové (DOKA, PERI)',
    costMultiplier: 1.4,
    laborMultiplier: 0.7,
    description: 'Rámové systémy s ocelovou kostrou'
  },
  ztracene: {
    name: 'Ztracené bednění',
    costMultiplier: 1.2,
    laborMultiplier: 0.5,
    description: 'Jednorázové tvarovky (např. Livetherm, Velox)'
  }
};

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate formwork area from concrete volume
 *
 * @param {number} concreteVolume - Concrete volume in m3
 * @param {string} structureType - Type key from FORMWORK_COEFFICIENTS
 * @param {Object} options - Additional options
 * @param {string} options.estimate - 'min', 'typical', 'max' (default: 'typical')
 * @param {Object} options.dimensions - Custom dimensions for precise calc
 * @param {string} options.formworkSystem - 'tradicni', 'systemove', 'ztracene'
 * @returns {Object} Calculation result
 */
export function calculateFormworkArea(concreteVolume, structureType, options = {}) {
  const estimate = options.estimate || 'typical';

  if (!concreteVolume || concreteVolume <= 0) {
    return {
      success: false,
      error: 'Concrete volume must be positive'
    };
  }

  const coeff = FORMWORK_COEFFICIENTS[structureType];
  if (!coeff) {
    return {
      success: false,
      error: `Unknown structure type: ${structureType}`,
      availableTypes: Object.keys(FORMWORK_COEFFICIENTS)
    };
  }

  const ratio = coeff.ratio[estimate];
  const formworkArea = concreteVolume * ratio;

  // Calculate all three estimates
  const estimates = {
    min: Math.round(concreteVolume * coeff.ratio.min * 100) / 100,
    typical: Math.round(concreteVolume * coeff.ratio.typical * 100) / 100,
    max: Math.round(concreteVolume * coeff.ratio.max * 100) / 100
  };

  // Formwork system info
  const system = FORMWORK_SYSTEMS[options.formworkSystem || coeff.systemType];

  const result = {
    success: true,
    input: {
      concreteVolume,
      structureType,
      structureName: coeff.name,
      estimate
    },
    result: {
      formworkArea: Math.round(formworkArea * 100) / 100,
      ratio,
      unit: 'm2'
    },
    estimates,
    formworkSystem: system ? {
      name: system.name,
      costMultiplier: system.costMultiplier,
      laborMultiplier: system.laborMultiplier,
      reusability: coeff.reusability
    } : null,
    notes: coeff.description
  };

  logger.info(`[FormworkCalc] ${coeff.name}: ${concreteVolume} m3 -> ${formworkArea.toFixed(1)} m2 (ratio: ${ratio})`);

  return result;
}

/**
 * Calculate formwork for precise dimensions (wall example)
 *
 * @param {Object} dimensions - { length, height, thickness } in meters
 * @param {string} structureType - 'stena', 'sloup', etc.
 * @returns {Object} Precise calculation
 */
export function calculateFormworkFromDimensions(dimensions, structureType) {
  const { length, height, thickness, width, diameter, count } = dimensions;

  let formworkArea = 0;
  let concreteVolume = 0;
  let details = {};

  switch (structureType) {
    case 'stena': {
      if (!length || !height || !thickness) {
        return { success: false, error: 'Wall requires length, height, thickness' };
      }
      concreteVolume = length * height * thickness;
      // Both sides of wall
      formworkArea = 2 * length * height;
      details = {
        sides: 2,
        sideArea: length * height,
        note: 'Oboustranné bednění stěny'
      };
      break;
    }
    case 'sloup': {
      if (diameter) {
        // Circular column
        const r = diameter / 2;
        concreteVolume = Math.PI * r * r * (height || 3);
        formworkArea = Math.PI * diameter * (height || 3);
        details = { shape: 'circular', circumference: Math.PI * diameter };
      } else if (width && thickness) {
        // Rectangular column
        concreteVolume = width * thickness * (height || 3);
        formworkArea = 2 * (width + thickness) * (height || 3);
        details = { shape: 'rectangular', perimeter: 2 * (width + thickness) };
      } else {
        return { success: false, error: 'Column requires (diameter) or (width + thickness) + height' };
      }
      if (count && count > 1) {
        formworkArea *= count;
        concreteVolume *= count;
        details.count = count;
      }
      break;
    }
    case 'stropni_deska': {
      if (!length || !width || !thickness) {
        return { success: false, error: 'Slab requires length, width, thickness' };
      }
      concreteVolume = length * width * thickness;
      // Bottom surface only (soffit formwork)
      formworkArea = length * width;
      // Edge formwork
      const edgeFormwork = 2 * (length + width) * thickness;
      formworkArea += edgeFormwork;
      details = {
        soffitArea: length * width,
        edgeArea: edgeFormwork,
        note: 'Spodní plocha + obvod desky'
      };
      break;
    }
    default:
      return calculateFormworkArea(
        dimensions.volume || (length * (width || thickness || 1) * (height || 1)),
        structureType
      );
  }

  const ratio = concreteVolume > 0 ? formworkArea / concreteVolume : 0;

  return {
    success: true,
    input: { dimensions, structureType },
    result: {
      formworkArea: Math.round(formworkArea * 100) / 100,
      concreteVolume: Math.round(concreteVolume * 100) / 100,
      ratio: Math.round(ratio * 100) / 100,
      unit: 'm2'
    },
    details,
    method: 'dimensions'
  };
}

/**
 * Detect structure type from text description (Czech)
 *
 * @param {string} text - Work description in Czech
 * @returns {string|null} Structure type key or null
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
    if (pattern.test(lower)) {
      return type;
    }
  }

  return null;
}
