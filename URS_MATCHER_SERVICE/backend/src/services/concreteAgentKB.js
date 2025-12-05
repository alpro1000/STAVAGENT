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
    },
    learned_mappings: getLearnedMappingsCount()
  };
}

// ============================================================================
// KNOWLEDGE ACCUMULATION (LEARNING)
// ============================================================================

// Path for learned mappings (local storage)
const LEARNED_MAPPINGS_PATH = path.join(__dirname, '../data/learned_mappings.json');

// In-memory cache for learned mappings
let learnedMappings = null;
let learnedMappingsLoadedAt = null;

/**
 * Load learned URS mappings from file
 */
function loadLearnedMappings() {
  if (learnedMappings && learnedMappingsLoadedAt && Date.now() - learnedMappingsLoadedAt < 60000) {
    return learnedMappings;
  }

  try {
    if (fs.existsSync(LEARNED_MAPPINGS_PATH)) {
      const content = fs.readFileSync(LEARNED_MAPPINGS_PATH, 'utf-8');
      learnedMappings = JSON.parse(content);
      learnedMappingsLoadedAt = Date.now();
      logger.info(`[LearnedKB] Loaded ${Object.keys(learnedMappings).length} learned mappings`);
    } else {
      learnedMappings = {};
      learnedMappingsLoadedAt = Date.now();
    }
  } catch (error) {
    logger.warn(`[LearnedKB] Failed to load learned mappings: ${error.message}`);
    learnedMappings = {};
  }

  return learnedMappings;
}

/**
 * Save learned mappings to file
 */
function saveLearnedMappings() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(LEARNED_MAPPINGS_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(LEARNED_MAPPINGS_PATH, JSON.stringify(learnedMappings, null, 2), 'utf-8');
    logger.info(`[LearnedKB] Saved ${Object.keys(learnedMappings).length} learned mappings`);
  } catch (error) {
    logger.error(`[LearnedKB] Failed to save learned mappings: ${error.message}`);
  }
}

/**
 * Get count of learned mappings
 */
function getLearnedMappingsCount() {
  loadLearnedMappings();
  return Object.keys(learnedMappings || {}).length;
}

/**
 * Create a normalized key from work description
 * @param {string} description - Work description
 * @returns {string} Normalized key
 */
function normalizeForKey(description) {
  return description
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove special chars but keep letters
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

/**
 * Learn a confirmed URS mapping
 * Called when user confirms or validates a mapping
 *
 * @param {string} inputDescription - Original work description
 * @param {Object} ursMapping - Selected URS mapping { urs_code, urs_name, unit, confidence }
 * @param {string} source - Source of confirmation ('user', 'auto', 'feedback')
 */
export function learnMapping(inputDescription, ursMapping, source = 'auto') {
  loadLearnedMappings();

  const key = normalizeForKey(inputDescription);

  // Check if we already have this mapping
  const existing = learnedMappings[key];

  if (existing) {
    // Update usage count and confidence
    existing.usage_count = (existing.usage_count || 0) + 1;
    existing.last_used = new Date().toISOString();

    // If same code, increase confidence
    if (existing.urs_code === ursMapping.urs_code) {
      existing.confidence = Math.min(0.99, (existing.confidence || 0.7) + 0.05);
    }
  } else {
    // Add new mapping
    learnedMappings[key] = {
      input_description: inputDescription,
      urs_code: ursMapping.urs_code,
      urs_name: ursMapping.urs_name,
      unit: ursMapping.unit,
      confidence: ursMapping.confidence || 0.7,
      source: source,
      created_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
      usage_count: 1
    };
  }

  // Save immediately
  saveLearnedMappings();

  logger.info(`[LearnedKB] Learned mapping: "${inputDescription.substring(0, 30)}..." → ${ursMapping.urs_code}`);
}

/**
 * Look up a work description in learned mappings
 * Returns cached URS mapping if found with high confidence
 *
 * @param {string} description - Work description
 * @returns {Object|null} Learned mapping or null
 */
export function lookupLearnedMapping(description) {
  loadLearnedMappings();

  const key = normalizeForKey(description);
  const mapping = learnedMappings[key];

  if (mapping && mapping.confidence >= 0.7) {
    logger.info(`[LearnedKB] Cache hit: "${description.substring(0, 30)}..." → ${mapping.urs_code} (confidence: ${mapping.confidence})`);
    return {
      urs_code: mapping.urs_code,
      urs_name: mapping.urs_name,
      unit: mapping.unit,
      confidence: mapping.confidence,
      source: 'learned_kb',
      usage_count: mapping.usage_count
    };
  }

  return null;
}

/**
 * Get all learned mappings for export/review
 */
export function getLearnedMappings() {
  loadLearnedMappings();
  return { ...learnedMappings };
}

/**
 * Clear learned mappings (for testing/reset)
 */
export function clearLearnedMappings() {
  learnedMappings = {};
  saveLearnedMappings();
  logger.info('[LearnedKB] Cleared all learned mappings');
}
