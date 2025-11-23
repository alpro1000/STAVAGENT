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

    function extractCategories(items) {
      items.forEach(item => {
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
    }

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

  if (!ursCode) return 'Ostatní';

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
 * Group items by TŘÍDNÍK categories
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
