/**
 * Work Sections Breakdown Service
 * Breaks construction project into standardized work sections (HSV/PSV)
 *
 * Based on Czech TSKP classification system:
 * - HSV: Hlavní stavební výroba (Main construction)
 * - PSV: Přidružená stavební výroba (Associated construction)
 * - MON: Montáže (Installations)
 */

import { logger } from '../../utils/logger.js';

// ============================================================================
// WORK SECTIONS DEFINITION (TSKP-based)
// ============================================================================

/**
 * HSV - Hlavní stavební výroba (Main Construction Work)
 * Sections 1-9 per Czech TSKP classification
 */
export const HSV_SECTIONS = {
  1: {
    code: '1',
    name: 'Zemní práce',
    nameRu: 'Земляные работы',
    description: 'Výkopy, odkopy, přesun zeminy, zásypy, hutnění',
    typicalCostShare: { min: 5, typical: 10, max: 20 },
    keywords: ['výkop', 'odkop', 'rýha', 'jáma', 'zemina', 'hloubení', 'sejmutí', 'ornice',
               'násyp', 'zásyp', 'hutnění', 'odvoz', 'přesun hmot', 'pažení', 'svahování'],
    units: ['m3', 'm2'],
    tskpRange: { from: '111', to: '199' }
  },
  2: {
    code: '2',
    name: 'Zakládání',
    nameRu: 'Фундаменты',
    description: 'Základy, piloty, štětovnice, podkladní betony',
    typicalCostShare: { min: 8, typical: 15, max: 25 },
    keywords: ['základ', 'patka', 'pás', 'pilota', 'mikropilota', 'štětovnice',
               'podkladní beton', 'základová deska', 'podbetonávka'],
    units: ['m3', 'm', 'ks'],
    tskpRange: { from: '211', to: '299' }
  },
  3: {
    code: '3',
    name: 'Svislé a kompletní konstrukce',
    nameRu: 'Вертикальные конструкции',
    description: 'Zdivo, sloupy, stěny, příčky, komíny',
    typicalCostShare: { min: 10, typical: 18, max: 30 },
    keywords: ['zdivo', 'sloup', 'stěna', 'příčka', 'komín', 'pilíř',
               'obezdívka', 'přizdívka', 'nosná stěna', 'výplňové zdivo'],
    units: ['m3', 'm2', 'ks'],
    tskpRange: { from: '311', to: '399' }
  },
  4: {
    code: '4',
    name: 'Vodorovné konstrukce',
    nameRu: 'Горизонтальные конструкции',
    description: 'Stropy, podlahy, věnce, překlady, schodiště',
    typicalCostShare: { min: 10, typical: 20, max: 30 },
    keywords: ['strop', 'deska', 'věnec', 'překlad', 'schodiště', 'podesta',
               'průvlak', 'nosník', 'konzola', 'rampa', 'balkón'],
    units: ['m3', 'm2', 'm'],
    tskpRange: { from: '411', to: '499' }
  },
  5: {
    code: '5',
    name: 'Komunikace',
    nameRu: 'Дороги и коммуникации',
    description: 'Vozovky, chodníky, dlažby, obrubníky',
    typicalCostShare: { min: 3, typical: 8, max: 15 },
    keywords: ['vozovka', 'chodník', 'dlažba', 'obrubník', 'asfalt', 'silnice',
               'zpevněná plocha', 'parkoviště', 'komunikace'],
    units: ['m2', 'm', 't'],
    tskpRange: { from: '511', to: '599' }
  },
  6: {
    code: '6',
    name: 'Úpravy povrchů, podlahy',
    nameRu: 'Отделка поверхностей',
    description: 'Omítky, obklady, nátěry, stěrky, lité podlahy',
    typicalCostShare: { min: 5, typical: 10, max: 18 },
    keywords: ['omítka', 'obklad', 'nátěr', 'stěrka', 'potěr', 'mazanina',
               'litá podlaha', 'povrchová úprava', 'spárování'],
    units: ['m2', 'm3'],
    tskpRange: { from: '611', to: '699' }
  },
  8: {
    code: '8',
    name: 'Trubní vedení',
    nameRu: 'Трубопроводы',
    description: 'Kanalizace, vodovod, drenáže, chráničky',
    typicalCostShare: { min: 2, typical: 5, max: 10 },
    keywords: ['kanalizace', 'vodovod', 'potrubí', 'drenáž', 'chránička',
               'šachta', 'vpusť', 'přípojka', 'stoka'],
    units: ['m', 'ks'],
    tskpRange: { from: '811', to: '899' }
  },
  9: {
    code: '9',
    name: 'Ostatní konstrukce a práce',
    nameRu: 'Прочие конструкции',
    description: 'Bednění, výztuž, přesun hmot, bourání, lešení',
    typicalCostShare: { min: 10, typical: 20, max: 35 },
    keywords: ['bednění', 'výztuž', 'přesun', 'bourání', 'lešení', 'betonáž',
               'železování', 'armování', 'osazení', 'montáž dílců'],
    units: ['m2', 't', 'm3', 'hod'],
    tskpRange: { from: '911', to: '999' }
  }
};

/**
 * PSV - Přidružená stavební výroba (Associated Construction)
 */
export const PSV_SECTIONS = {
  711: {
    code: '711',
    name: 'Izolace proti vodě',
    nameRu: 'Гидроизоляция',
    keywords: ['hydroizolace', 'vodotěsná', 'asfaltový pás', 'fólie', 'PVC izolace'],
    typicalCostShare: { min: 2, typical: 4, max: 8 }
  },
  712: {
    code: '712',
    name: 'Izolace střech',
    nameRu: 'Изоляция кровли',
    keywords: ['střešní izolace', 'povlaková krytina', 'parozábrana'],
    typicalCostShare: { min: 2, typical: 5, max: 10 }
  },
  713: {
    code: '713',
    name: 'Izolace tepelné',
    nameRu: 'Теплоизоляция',
    keywords: ['tepelná izolace', 'EPS', 'XPS', 'minerální vata', 'zateplení', 'ETICS'],
    typicalCostShare: { min: 3, typical: 6, max: 12 }
  },
  762: {
    code: '762',
    name: 'Konstrukce tesařské',
    nameRu: 'Деревянные конструкции',
    keywords: ['krov', 'vazník', 'střešní konstrukce', 'tesařské'],
    typicalCostShare: { min: 2, typical: 5, max: 10 }
  },
  764: {
    code: '764',
    name: 'Konstrukce klempířské',
    nameRu: 'Жестяные работы',
    keywords: ['klempířské', 'oplechování', 'svod', 'žlab', 'plech'],
    typicalCostShare: { min: 1, typical: 3, max: 5 }
  },
  767: {
    code: '767',
    name: 'Konstrukce zámečnické',
    nameRu: 'Слесарные конструкции',
    keywords: ['zámečnické', 'zábradlí', 'ocelová konstrukce', 'žebřík', 'poklop'],
    typicalCostShare: { min: 2, typical: 5, max: 10 }
  },
  771: {
    code: '771',
    name: 'Podlahy z dlaždic',
    nameRu: 'Полы из плитки',
    keywords: ['dlažba', 'keramická dlažba', 'obkládání podlah'],
    typicalCostShare: { min: 1, typical: 3, max: 6 }
  },
  781: {
    code: '781',
    name: 'Dokončovací práce - obklady',
    nameRu: 'Облицовка',
    keywords: ['obklady', 'keramický obklad', 'mozaika'],
    typicalCostShare: { min: 1, typical: 2, max: 4 }
  },
  784: {
    code: '784',
    name: 'Dokončovací práce - malby',
    nameRu: 'Малярные работы',
    keywords: ['malba', 'nátěr', 'penetrace', 'barva'],
    typicalCostShare: { min: 1, typical: 2, max: 4 }
  }
};

// ============================================================================
// CLASSIFICATION FUNCTIONS
// ============================================================================

/**
 * Classify a work item into a section
 *
 * @param {Object} item - Work item { kod, popis, description, unit }
 * @param {Object} options - Classification options
 * @returns {Object} Classification result
 */
export function classifyWorkItem(item, options = {}) {
  const text = `${item.popis || item.description || ''} ${item.kod || item.code || ''}`.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const code = item.kod || item.code || '';

  // Try TSKP code-based classification first
  if (code && /^\d{3,}/.test(code)) {
    const codePrefix = code.substring(0, 1);
    const codeFull = code.substring(0, 3);

    // Check PSV by 3-digit prefix
    if (PSV_SECTIONS[codeFull]) {
      return {
        section: PSV_SECTIONS[codeFull],
        category: 'PSV',
        confidence: 95,
        method: 'tskp_code'
      };
    }

    // Check HSV by first digit
    if (HSV_SECTIONS[parseInt(codePrefix)]) {
      return {
        section: HSV_SECTIONS[parseInt(codePrefix)],
        category: 'HSV',
        confidence: 90,
        method: 'tskp_code'
      };
    }
  }

  // Keyword-based classification
  let bestMatch = null;
  let bestScore = 0;

  // Check HSV sections
  for (const [sectionId, section] of Object.entries(HSV_SECTIONS)) {
    let score = 0;
    for (const kw of section.keywords) {
      const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (text.includes(kwNorm)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { section, category: 'HSV' };
    }
  }

  // Check PSV sections
  for (const [sectionId, section] of Object.entries(PSV_SECTIONS)) {
    let score = 0;
    for (const kw of section.keywords) {
      const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (text.includes(kwNorm)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { section, category: 'PSV' };
    }
  }

  if (bestMatch && bestScore > 0) {
    return {
      ...bestMatch,
      confidence: Math.min(90, bestScore * 30),
      method: 'keyword'
    };
  }

  // Default: Section 9 (Other)
  return {
    section: HSV_SECTIONS[9],
    category: 'HSV',
    confidence: 10,
    method: 'default'
  };
}

/**
 * Break down a list of work items into sections
 *
 * @param {Array} items - Array of work items
 * @returns {Object} Breakdown by sections
 */
export function breakdownIntoSections(items) {
  if (!items || items.length === 0) {
    return { success: false, error: 'No items provided' };
  }

  const breakdown = {
    HSV: {},
    PSV: {}
  };
  const unclassified = [];
  let totalCost = 0;

  for (const item of items) {
    const classification = classifyWorkItem(item);
    const sectionCode = classification.section.code;
    const category = classification.category;

    const cost = parseFloat(item.cenaCelkem || item.totalPrice || 0);
    totalCost += cost;

    if (!breakdown[category][sectionCode]) {
      breakdown[category][sectionCode] = {
        section: classification.section,
        items: [],
        totalCost: 0,
        itemCount: 0
      };
    }

    breakdown[category][sectionCode].items.push({
      ...item,
      classification: {
        confidence: classification.confidence,
        method: classification.method
      }
    });
    breakdown[category][sectionCode].totalCost += cost;
    breakdown[category][sectionCode].itemCount++;

    if (classification.confidence < 30) {
      unclassified.push(item);
    }
  }

  // Calculate percentages
  for (const category of ['HSV', 'PSV']) {
    for (const section of Object.values(breakdown[category])) {
      section.costPercentage = totalCost > 0
        ? Math.round((section.totalCost / totalCost) * 1000) / 10
        : 0;
    }
  }

  // Summary
  const hsvTotal = Object.values(breakdown.HSV).reduce((sum, s) => sum + s.totalCost, 0);
  const psvTotal = Object.values(breakdown.PSV).reduce((sum, s) => sum + s.totalCost, 0);

  return {
    success: true,
    breakdown,
    summary: {
      totalItems: items.length,
      totalCost: Math.round(totalCost),
      hsvCost: Math.round(hsvTotal),
      psvCost: Math.round(psvTotal),
      hsvPercentage: totalCost > 0 ? Math.round((hsvTotal / totalCost) * 100) : 0,
      psvPercentage: totalCost > 0 ? Math.round((psvTotal / totalCost) * 100) : 0,
      hsvSections: Object.keys(breakdown.HSV).length,
      psvSections: Object.keys(breakdown.PSV).length,
      unclassifiedCount: unclassified.length
    },
    unclassified: unclassified.length > 0 ? unclassified : undefined
  };
}

/**
 * Generate work sequence (recommended execution order)
 *
 * @param {Object} breakdown - Result from breakdownIntoSections
 * @returns {Array} Ordered work phases
 */
export function generateWorkSequence(breakdown) {
  if (!breakdown.success) return [];

  const phases = [];
  const sectionOrder = [1, 2, 3, 4, 5, 6, 8, 9]; // HSV execution order

  // HSV phases
  for (const sectionCode of sectionOrder) {
    const section = breakdown.breakdown.HSV[sectionCode];
    if (section) {
      phases.push({
        phase: phases.length + 1,
        category: 'HSV',
        sectionCode: section.section.code,
        sectionName: section.section.name,
        itemCount: section.itemCount,
        estimatedCost: Math.round(section.totalCost),
        costPercentage: section.costPercentage,
        dependencies: getDependencies(sectionCode)
      });
    }
  }

  // PSV phases (after HSV)
  const psvOrder = [711, 712, 713, 762, 764, 767, 771, 781, 784];
  for (const sectionCode of psvOrder) {
    const section = breakdown.breakdown.PSV[sectionCode];
    if (section) {
      phases.push({
        phase: phases.length + 1,
        category: 'PSV',
        sectionCode: section.section.code,
        sectionName: section.section.name,
        itemCount: section.itemCount,
        estimatedCost: Math.round(section.totalCost),
        costPercentage: section.costPercentage,
        dependencies: getPSVDependencies(sectionCode)
      });
    }
  }

  return phases;
}

/**
 * Get HSV section dependencies
 */
function getDependencies(sectionCode) {
  const deps = {
    1: [],
    2: ['1'],
    3: ['2'],
    4: ['3'],
    5: ['1'],
    6: ['3', '4'],
    8: ['1', '2'],
    9: ['2', '3', '4']
  };
  return deps[sectionCode] || [];
}

/**
 * Get PSV section dependencies
 */
function getPSVDependencies(sectionCode) {
  const deps = {
    711: ['2'],      // Hydroizolace after foundations
    712: ['4'],      // Roof insulation after horizontal structures
    713: ['3', '4'], // Thermal insulation after structures
    762: ['3', '4'], // Carpentry after structures
    764: ['762'],    // Tinsmith after carpentry
    767: ['3', '4'], // Locksmith after structures
    771: ['6'],      // Floor tiles after surface prep
    781: ['6'],      // Wall tiles after surface prep
    784: ['6']       // Painting after surface prep
  };
  return deps[sectionCode] || [];
}
