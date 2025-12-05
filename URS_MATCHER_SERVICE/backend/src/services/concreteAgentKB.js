/**
 * Concrete-Agent Knowledge Base Integration
 * Loads and searches knowledge from concrete-agent/knowledge_base
 *
 * Knowledge Base Structure:
 * - B1_urs_codes: URS/KROS code mappings
 * - B2_csn_standards: Czech technical standards (ČSN EN 206, etc.)
 * - B3_current_prices: Market prices
 * - B4_production_benchmarks: Production norms
 * - B7_regulations: Building regulations
 * - B9_Equipment_Specs: Equipment specifications
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paths to knowledge base (supports local and Docker)
const DOCKER_KB_PATH = '/app/concrete-agent/packages/core-backend/app/knowledge_base';
const LOCAL_KB_PATH = path.join(__dirname, '../../../../concrete-agent/packages/core-backend/app/knowledge_base');

// Determine which path to use
const KB_PATH = fs.existsSync(DOCKER_KB_PATH) ? DOCKER_KB_PATH : LOCAL_KB_PATH;

// Cached knowledge data
let kbCache = {
  ursCodeMappings: null,
  csnStandards: null,
  concreteClasses: null,
  exposureClasses: null,
  loadedAt: null
};

/**
 * Load all knowledge base data
 * @returns {Object} Loaded knowledge base
 */
export function loadKnowledgeBase() {
  if (kbCache.loadedAt && Date.now() - kbCache.loadedAt < 3600000) {
    // Cache valid for 1 hour
    return kbCache;
  }

  logger.info(`[ConcreteAgentKB] Loading knowledge base from: ${KB_PATH}`);

  try {
    // Load CSN standards (ČSN EN 206 - concrete)
    kbCache.csnStandards = loadJsonFile('B2_csn_standards/csn_en_206.json');
    if (kbCache.csnStandards) {
      logger.info(`[ConcreteAgentKB] Loaded CSN standards: ${kbCache.csnStandards.sections?.length || 0} sections`);

      // Extract concrete classes and exposure classes for quick lookup
      kbCache.concreteClasses = extractConcreteClasses(kbCache.csnStandards);
      kbCache.exposureClasses = extractExposureClasses(kbCache.csnStandards);
    }

    // Load URS code mappings
    kbCache.ursCodeMappings = loadJsonFile('B1_urs_codes/kros_sample.json');

    // Load metadata
    const metadata = loadJsonFile('B1_urs_codes/metadata.json');
    if (metadata) {
      kbCache.ursMetadata = metadata;
    }

    kbCache.loadedAt = Date.now();
    logger.info('[ConcreteAgentKB] Knowledge base loaded successfully');

    return kbCache;

  } catch (error) {
    logger.error(`[ConcreteAgentKB] Failed to load knowledge base: ${error.message}`);
    return kbCache;
  }
}

/**
 * Load a JSON file from knowledge base
 */
function loadJsonFile(relativePath) {
  const fullPath = path.join(KB_PATH, relativePath);
  try {
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    logger.warn(`[ConcreteAgentKB] Could not load ${relativePath}: ${error.message}`);
  }
  return null;
}

/**
 * Extract concrete classes from CSN standards
 */
function extractConcreteClasses(csnData) {
  if (!csnData?.sections) return {};

  const classes = {};

  for (const section of csnData.sections) {
    if (section.id === 'concrete_classes' && section.data?.strength_classes) {
      for (const cls of section.data.strength_classes) {
        classes[cls.class] = {
          fck_cylinder: cls.fck_cylinder,
          fck_cube: cls.fck_cube,
          typical_use: cls.typical_use
        };
      }
    }
  }

  return classes;
}

/**
 * Extract exposure classes from CSN standards
 */
function extractExposureClasses(csnData) {
  if (!csnData?.sections) return {};

  const classes = {};

  for (const section of csnData.sections) {
    if (section.id === 'exposure_classes' && section.data?.classes) {
      for (const cls of section.data.classes) {
        classes[cls.class] = {
          description: cls.description,
          environment: cls.environment,
          examples: cls.examples
        };
      }
    }
  }

  return classes;
}

/**
 * Search knowledge base for work description
 * Returns relevant standards, classes, and recommendations
 *
 * @param {string} workDescription - Work description to search
 * @returns {Object} KB search results
 */
export function searchKnowledgeBase(workDescription) {
  loadKnowledgeBase(); // Ensure loaded

  const results = {
    concreteClass: null,
    exposureClasses: [],
    relevantNorms: [],
    recommendations: []
  };

  const text = workDescription.toLowerCase();

  // Detect concrete class (C20/25, C25/30, etc.)
  const concreteMatch = text.match(/c\s*(\d+)\/(\d+)/i);
  if (concreteMatch) {
    const classKey = `C${concreteMatch[1]}/${concreteMatch[2]}`;
    if (kbCache.concreteClasses?.[classKey]) {
      results.concreteClass = {
        class: classKey,
        ...kbCache.concreteClasses[classKey]
      };
    }
  }

  // Detect exposure classes (XC1, XD2, XF1, etc.)
  const exposureMatches = text.matchAll(/(x[cdfas]\d)/gi);
  for (const match of exposureMatches) {
    const classKey = match[1].toUpperCase();
    if (kbCache.exposureClasses?.[classKey]) {
      results.exposureClasses.push({
        class: classKey,
        ...kbCache.exposureClasses[classKey]
      });
    }
  }

  // Find relevant norms based on keywords
  const keywords = {
    'beton': ['ČSN EN 206', 'ČSN EN 13670'],
    'výztuž': ['ČSN EN 10080', 'ČSN EN 1992-1-1'],
    'zdivo': ['ČSN EN 1996-1-1', 'ČSN EN 771'],
    'izolace': ['ČSN 73 0600', 'ČSN EN 13967'],
    'základy': ['ČSN EN 1997-1', 'ČSN 73 1001'],
    'hydroizolace': ['ČSN 73 0600', 'ČSN P 73 0606']
  };

  for (const [keyword, norms] of Object.entries(keywords)) {
    if (text.includes(keyword)) {
      results.relevantNorms.push(...norms.filter(n => !results.relevantNorms.includes(n)));
    }
  }

  // Add recommendations based on context
  if (results.concreteClass && results.exposureClasses.length === 0) {
    results.recommendations.push('Chybí třída prostředí (XC, XD, XF) - ověřte dle ČSN EN 206');
  }

  if (text.includes('venkovní') || text.includes('outdoor') || text.includes('fasáda')) {
    if (!results.exposureClasses.some(e => ['XC3', 'XC4', 'XF1'].includes(e.class))) {
      results.recommendations.push('Pro venkovní konstrukce zvažte XC3/XC4 a případně XF1');
    }
  }

  return results;
}

/**
 * Get concrete requirements for exposure class
 * @param {string} exposureClass - Exposure class (XC1, XD2, etc.)
 * @returns {Object} Requirements
 */
export function getExposureRequirements(exposureClass) {
  loadKnowledgeBase();

  if (!kbCache.csnStandards?.sections) return null;

  for (const section of kbCache.csnStandards.sections) {
    if (section.id === 'exposure_class_requirements' && section.data?.requirements) {
      const req = section.data.requirements.find(r => r.exposure_class === exposureClass);
      if (req) {
        return {
          exposureClass,
          minStrengthClass: req.min_strength_class,
          maxWCRatio: req.max_w_c_ratio,
          minCementContent: req.min_cement_content,
          minCover: req.min_cover_mm
        };
      }
    }
  }

  return null;
}

/**
 * Check if knowledge base is available
 */
export function isKBAvailable() {
  return fs.existsSync(KB_PATH);
}

/**
 * Get KB status for health check
 */
export function getKBStatus() {
  const available = isKBAvailable();
  loadKnowledgeBase();

  return {
    available,
    path: KB_PATH,
    cached: kbCache.loadedAt !== null,
    sections: {
      csnStandards: kbCache.csnStandards !== null,
      concreteClasses: Object.keys(kbCache.concreteClasses || {}).length,
      exposureClasses: Object.keys(kbCache.exposureClasses || {}).length
    }
  };
}
