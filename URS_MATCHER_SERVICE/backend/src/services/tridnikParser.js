/**
 * TŘÍDNÍK Parser Service
 * Parses TSKP classification XML and provides category mapping
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xml2js from 'xml2js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for parsed categories
let categoriesCache = null;

/**
 * Parse TŘÍDNÍK XML file and build category mapping
 * Uses Description field for fuller context, falls back to Name if not available
 * Returns: { "0": "Vedlejší rozpočtové náklady", "01": "Průzkumné práce", ... }
 */
export async function loadTridnik() {
  if (categoriesCache) {
    return categoriesCache;
  }

  try {
    const xmlPath = path.join(__dirname, '../../data/tridnik.xml');
    logger.info(`[TŘÍDNÍK] Loading classification from: ${xmlPath}`);

    const xmlData = fs.readFileSync(xmlPath, 'utf8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlData);

    const categories = {};

    // Extract categories from XML structure
    const items = result.BuildingInformation?.Classification?.[0]?.System?.[0]?.Items?.[0]?.Item || [];

    const extractCategories = (itemList) => {
      itemList.forEach(item => {
        const id = item.ID?.[0];
        const name = item.Name?.[0];
        const description = item.Description?.[0];

        if (id) {
          // Prefer Description for fuller context, fallback to Name
          const label = description || name;
          if (label) {
            categories[id] = label;
          }
        }

        // Recursively process children
        const children = item.Children?.[0]?.Item;
        if (children && children.length > 0) {
          extractCategories(children);
        }
      });
    };

    extractCategories(items);

    categoriesCache = categories;
    logger.info(`[TŘÍDNÍK] Loaded ${Object.keys(categories).length} categories`);

    return categories;

  } catch (error) {
    logger.error(`[TŘÍDNÍK] Error loading classification: ${error.message}`);
    throw error;
  }
}

/**
 * Get category name for a URS code
 * Examples:
 *   "311113141" → "Zdivo" (based on prefix "31")
 *   "279321347" → "Základy" (based on prefix "27")
 */
export async function getCategoryForCode(ursCode) {
  const categories = await loadTridnik();

  if (!ursCode) {return 'Ostatní';}

  const code = ursCode.toString();

  // Try matching progressively longer prefixes
  // "311113141" → try "3111", "311", "31", "3"
  for (let len = Math.min(code.length, 4); len >= 1; len--) {
    const prefix = code.substring(0, len);
    if (categories[prefix]) {
      return `${prefix} - ${categories[prefix]}`;
    }
  }

  return 'Ostatní';
}

/**
 * Group items by TŘÍDNÍK categories (requires urs_code already assigned)
 */
export async function groupByTridnik(items) {
  const grouped = {};

  for (const item of items) {
    const category = await getCategoryForCode(item.urs_code);

    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  }

  return grouped;
}

/**
 * TSKP Main Categories mapping (from TŘÍDNÍK STAVEBNÍCH KONSTRUKCÍ A PRACÍ)
 * Level 1 categories with expanded keywords for better matching
 */
const TSKP_CATEGORIES = {
  '1': {
    name: 'Zemní práce',
    keywords: ['výkop', 'rýh', 'jáma', 'hlouben', 'odkop', 'zasypá', 'zásyp', 'násyp', 'hutn', 'zemina', 'terén', 'skrývk', 'svahová', 'odvoz']
  },
  '2': {
    name: 'Zakládání',
    keywords: ['základ', 'patk', 'pas', 'pilot', 'podklad', 'štěrkop', 'beton základ', 'základová', 'mikropil', 'vrtan']
  },
  '3': {
    name: 'Svislé konstrukce',
    keywords: ['zdivo', 'zd', 'tvárnic', 'porotherm', 'cihel', 'blok', 'příčk', 'stěn', 'sloup', 'pilíř', 'komín']
  },
  '4': {
    name: 'Vodorovné konstrukce',
    keywords: ['strop', 'deska', 'průvlak', 'překlad', 'věnec', 'schodiště', 'schod', 'rampa', 'podest', 'balkon', 'konzol']
  },
  '5': {
    name: 'Komunikace',
    keywords: ['komunikac', 'vozovka', 'chodník', 'dlažba', 'obrubn', 'asfalt', 'cest', 'parkoviště', 'silnic']
  },
  '6': {
    name: 'Úpravy povrchů',
    keywords: ['omítk', 'štukov', 'stěrk', 'obklad', 'malb', 'nátěr', 'povrch', 'fasád', 'zateplení', 'polystyren', 'izolace tepel']
  },
  '7': {
    name: 'Podlahy a podlahové konstrukce',
    keywords: ['podlah', 'nášlapn', 'mazanin', 'potěr', 'anhydrit', 'laminát', 'vinyl', 'koberec', 'plovouc']
  },
  '8': {
    name: 'Trubní vedení',
    keywords: ['potrub', 'kanalizac', 'vodovod', 'plynovod', 'trubk', 'šacht', 'vpust', 'žlab', 'drenáž']
  },
  '9': {
    name: 'Ostatní konstrukce a práce',
    keywords: ['lešen', 'ochran', 'demolic', 'bourac', 'přesun', 'doprav', 'příprav', 'úklid', 'zajišt']
  },
  // ŽB konstrukce (special - spans across multiple TSKP categories)
  'ZB': {
    name: 'ŽB konstrukce',
    keywords: ['žb', 'železobeton', 'beton', 'betono', 'armokoš', 'bednění', 'výztuž', 'ocel armat', 'kari', 'prut']
  },
  // Izolace (also spans multiple categories)
  'IZ': {
    name: 'Izolace',
    keywords: ['izolac', 'hydroizolac', 'separace', 'fólie', 'asfaltov', 'geotextil', 'PE fólie']
  }
};

/**
 * Group items by work type based on TSKP classifier
 * Uses TŘÍDNÍK STAVEBNÍCH KONSTRUKCÍ A PRACÍ categories
 *
 * @param {Array} items - Array of work items { description, quantity, unit }
 * @returns {Object} Grouped items by TSKP category
 */
export function groupItemsByWorkType(items) {
  const grouped = {};

  for (const item of items) {
    const desc = (item.description || '').toLowerCase();
    let matched = false;
    let bestMatch = null;
    let bestScore = 0;

    // Skip empty descriptions
    if (!desc || desc.length < 3) {
      const otherGroup = '9 - Ostatní';
      if (!grouped[otherGroup]) {
        grouped[otherGroup] = [];
      }
      grouped[otherGroup].push(item);
      continue;
    }

    // Score each category based on keyword matches
    for (const [code, category] of Object.entries(TSKP_CATEGORIES)) {
      let score = 0;

      for (const keyword of category.keywords) {
        if (desc.includes(keyword)) {
          // Weight by keyword specificity (longer keywords = more specific)
          score += 1 + (keyword.length / 10);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { code, name: category.name };
      }
    }

    // Threshold for matching (at least one meaningful keyword)
    if (bestMatch && bestScore >= 1) {
      const groupName = `${bestMatch.code} - ${bestMatch.name}`;
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(item);
      matched = true;
    }

    // If no match, put in "Ostatní"
    if (!matched) {
      const otherGroup = '9 - Ostatní';
      if (!grouped[otherGroup]) {
        grouped[otherGroup] = [];
      }
      grouped[otherGroup].push(item);
    }
  }

  // Sort groups by TSKP code
  const sortedGrouped = {};
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const codeA = a.split(' - ')[0];
    const codeB = b.split(' - ')[0];
    return codeA.localeCompare(codeB);
  });

  for (const key of sortedKeys) {
    sortedGrouped[key] = grouped[key];
  }

  logger.info(`[TŘÍDNÍK] Grouped ${items.length} items into ${Object.keys(sortedGrouped).length} TSKP categories`);

  return sortedGrouped;
}
