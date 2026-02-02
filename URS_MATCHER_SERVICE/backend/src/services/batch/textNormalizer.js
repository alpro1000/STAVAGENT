/**
 * Text Normalizer Service
 * Cleans and extracts features from BOQ position text
 *
 * Purpose:
 * - Remove noise (drawing numbers, section codes, duplicates)
 * - Extract features (material, operation, dimensions)
 * - Detect composite markers (včetně, komplet, +)
 *
 * @module services/batch/textNormalizer
 */

import { logger } from '../../utils/logger.js';

// ============================================================================
// PATTERNS & MARKERS
// ============================================================================

/** Composite markers - indicate multiple works in one position */
const COMPOSITE_MARKERS = {
  // Primary markers (strong indicators)
  INCLUDING: /\b(včetně|vč\.|vč|incl\.|včet|zakl\.|zahrnuje)\b/i,
  PLUS: /\s*\+\s*/,
  AND_INSTALL: /\b(dodávka\s+a\s+montáž|dodávka\s+i\s+montáž|dodávka\s*\+\s*montáž)\b/i,
  DEMOLITION_INSTALL: /\b(demontáž\s+a\s+montáž|demontáž\s+i\s+montáž|demontáž\s*\+\s*montáž)\b/i,
  COMPLETE: /\b(komplet|kompletní|se\s+vším|s\s+příslušenstvím)\b/i,

  // Transport markers (very common)
  WITH_TRANSPORT: /\b(vč\.|včetně)\s+(doprav[a|y|ou]|odvoz[u]?|přesun[u]?)\b/i,
  WITH_DISPOSAL: /\b(vč\.|včetně)\s+(likvidac[e|í]|skládka|skládku|odstranění)\b/i,

  // Multiple operations
  MULTIPLE_OPS: /\b(výkop|hloubení)\s*\+\s*(odvoz|přesun)\s*\+\s*(zásyp|hutnění)/i
};

/** Patterns to remove (noise) */
const REMOVAL_PATTERNS = {
  // Drawing references
  DRAWING_REF: /\b(výkres|č\.|číslo)\s*[:\-.]?\s*[\dA-Z\-\/]+/gi,

  // Section codes (HSV, PSV prefixes)
  SECTION_CODE: /\b(HSV|PSV|DSP|KO|DIL|ODDÍL)\s*[:\-.]?\s*\d+/gi,

  // Invalid codes at start/end (brackets, dashes)
  INVALID_CODES: /^[\(\[\-\s]+|[\)\]\-\s]+$/g,

  // Duplicate spaces/symbols
  DUPLICATE_SPACES: /\s{2,}/g,
  DUPLICATE_SYMBOLS: /[,;]{2,}/g,

  // Trailing/leading commas
  TRAILING_COMMA: /^[,;\s]+|[,;\s]+$/g
};

/** Feature extraction patterns */
const FEATURE_PATTERNS = {
  // Concrete class
  CONCRETE_CLASS: /\b[BC]\s*(\d{2}\/\d{2})\b/i,

  // Depth/height/thickness
  DIMENSION: /\b([hbtdl])\s*=?\s*(\d+(?:[.,]\d+)?)\s*(m{1,3}|cm)\b/i,

  // Category/class
  CATEGORY: /\b(kat\.|kategorie|tř\.|třída)\s*(\d+)/i,

  // Fraction size
  FRACTION: /\b(frakce|fr\.|zrno)\s*(\d+[\-\/]\d+)\s*(mm)?/i,

  // Reinforcement class
  REINFORCEMENT: /\b([BRA])\s*(\d{3})\b/i,

  // Distance
  DISTANCE: /\b(vzdálenost|do|na)\s*(\d+)\s*(m|km)\b/i,

  // Area/volume quantities
  QUANTITY: /\b(\d+(?:[.,]\d+)?)\s*(m[23]|kg|t|ks|kus)\b/i
};

// ============================================================================
// MAIN NORMALIZATION
// ============================================================================

/**
 * Normalize position text
 * @param {Object} input - Input data
 * @param {string} input.originalText - Raw position text
 * @param {Object} [input.context] - Optional context (parent, subordinates)
 * @returns {Object} Normalized result
 */
export async function normalize(input) {
  const startTime = Date.now();

  try {
    logger.debug(`[TextNormalizer] Input: "${input.originalText}"`);

    // Step 1: Remove noise
    let cleaned = removeNoise(input.originalText);

    // Step 2: Extract features
    const features = extractFeatures(cleaned);

    // Step 3: Detect composite markers
    const markers = detectCompositeMarkers(cleaned);

    // Step 4: Build context awareness (if parent/subordinates provided)
    const contextInfo = buildContextInfo(input.context);

    const elapsed = Date.now() - startTime;

    const result = {
      normalizedText: cleaned.trim(),
      features: features,
      markers: markers,
      context: contextInfo,
      timing: {
        normalizeMs: elapsed
      }
    };

    logger.debug(`[TextNormalizer] Output: "${result.normalizedText}"`);
    logger.debug(`[TextNormalizer] Features: ${JSON.stringify(result.features)}`);
    logger.debug(`[TextNormalizer] Markers: ${JSON.stringify(result.markers)}`);
    logger.debug(`[TextNormalizer] Timing: ${elapsed}ms`);

    return result;

  } catch (error) {
    logger.error(`[TextNormalizer] Error: ${error.message}`);
    throw new Error(`Text normalization failed: ${error.message}`);
  }
}

// ============================================================================
// NOISE REMOVAL
// ============================================================================

/**
 * Remove noise from text
 * @param {string} text - Raw text
 * @returns {string} Cleaned text
 */
function removeNoise(text) {
  let cleaned = text;

  // Remove drawing references
  cleaned = cleaned.replace(REMOVAL_PATTERNS.DRAWING_REF, '');

  // Remove section codes
  cleaned = cleaned.replace(REMOVAL_PATTERNS.SECTION_CODE, '');

  // Remove invalid codes at boundaries
  cleaned = cleaned.replace(REMOVAL_PATTERNS.INVALID_CODES, '');

  // Remove duplicate spaces
  cleaned = cleaned.replace(REMOVAL_PATTERNS.DUPLICATE_SPACES, ' ');

  // Remove duplicate symbols
  cleaned = cleaned.replace(REMOVAL_PATTERNS.DUPLICATE_SYMBOLS, ',');

  // Remove trailing/leading commas
  cleaned = cleaned.replace(REMOVAL_PATTERNS.TRAILING_COMMA, '');

  return cleaned.trim();
}

// ============================================================================
// FEATURE EXTRACTION
// ============================================================================

/**
 * Extract technical features from text
 * @param {string} text - Cleaned text
 * @returns {Object} Extracted features
 */
function extractFeatures(text) {
  const features = {};

  // Concrete class (C 25/30, B 30/37)
  const concreteMatch = text.match(FEATURE_PATTERNS.CONCRETE_CLASS);
  if (concreteMatch) {
    features.concreteClass = concreteMatch[1];
  }

  // Dimensions (h=2.5m, t=150mm)
  const dimensionMatch = text.match(FEATURE_PATTERNS.DIMENSION);
  if (dimensionMatch) {
    const [, symbol, value, unit] = dimensionMatch;
    features.dimension = {
      symbol: symbol.toLowerCase(),
      value: parseFloat(value.replace(',', '.')),
      unit: unit
    };
  }

  // Category/class (kat. 3, tř. 4)
  const categoryMatch = text.match(FEATURE_PATTERNS.CATEGORY);
  if (categoryMatch) {
    features.category = categoryMatch[2];
  }

  // Fraction (frakce 16-32mm)
  const fractionMatch = text.match(FEATURE_PATTERNS.FRACTION);
  if (fractionMatch) {
    features.fraction = fractionMatch[2];
  }

  // Reinforcement (B 500, R 10)
  const reinforcementMatch = text.match(FEATURE_PATTERNS.REINFORCEMENT);
  if (reinforcementMatch) {
    features.reinforcement = {
      type: reinforcementMatch[1],
      grade: reinforcementMatch[2]
    };
  }

  // Distance (do 10 km, vzdálenost 5m)
  const distanceMatch = text.match(FEATURE_PATTERNS.DISTANCE);
  if (distanceMatch) {
    features.distance = {
      value: parseInt(distanceMatch[2]),
      unit: distanceMatch[3]
    };
  }

  // Extract operation keywords
  features.operation = extractOperation(text);

  // Extract material keywords
  features.material = extractMaterial(text);

  // Extract object/location
  features.object = extractObject(text);

  return features;
}

/**
 * Extract operation type from text
 * @param {string} text - Text to analyze
 * @returns {string|null} Operation type
 */
function extractOperation(text) {
  const operations = {
    excavation: /\b(výkop|hloubení|kopání|těžba)\b/i,
    demolition: /\b(demontáž|odstranění|bourání|demolice)\b/i,
    installation: /\b(montáž|osazení|instalace|položení)\b/i,
    concreting: /\b(betonáž|betonování|zalití|beton)\b/i,
    formwork: /\b(bednění|bedněn|forma)\b/i,
    reinforcement: /\b(výztuž|armatura|armování|ocel)\b/i,
    transport: /\b(doprava|odvoz|přesun|přemístění)\b/i,
    backfill: /\b(zásyp|zasypání|navážka)\b/i,
    compaction: /\b(hutnění|zhutněn|zhutňování)\b/i,
    waterproofing: /\b(hydroizolace|izolace|hydroizolační)\b/i,
    plastering: /\b(omítka|omítání|přehlazení)\b/i,
    painting: /\b(nátěr|malování|barvení)\b/i
  };

  for (const [type, pattern] of Object.entries(operations)) {
    if (pattern.test(text)) {
      return type;
    }
  }

  return null;
}

/**
 * Extract material type from text
 * @param {string} text - Text to analyze
 * @returns {string|null} Material type
 */
function extractMaterial(text) {
  const materials = {
    concrete: /\b(beton|betonov[ýá]|ŽB|železobeton)\b/i,
    reinforcement: /\b(výztuž|armatura|ocel|kari|pruty)\b/i,
    formwork: /\b(bednění|desky|fošny)\b/i,
    earth: /\b(zemina|hlína|hornina|výkop)\b/i,
    gravel: /\b(štěrk|kamenivo|frakce)\b/i,
    sand: /\b(písek|pískový)\b/i,
    geotextile: /\b(geotextilie|textilie)\b/i,
    waterproofing: /\b(hydroizolace|fólie|asfalt|nátěr)\b/i,
    insulation: /\b(izolace|polystyren|pěnový)\b/i
  };

  for (const [type, pattern] of Object.entries(materials)) {
    if (pattern.test(text)) {
      return type;
    }
  }

  return null;
}

/**
 * Extract object/location from text
 * @param {string} text - Text to analyze
 * @returns {string|null} Object type
 */
function extractObject(text) {
  const objects = {
    foundation_strip: /\b(pas|pásy|základov[ýé] pas)\b/i,
    foundation_slab: /\b(deska|základová deska|podkladní deska)\b/i,
    foundation_pad: /\b(patka|patky|základová patka)\b/i,
    pit: /\b(jáma|jam|stavební jáma)\b/i,
    trench: /\b(rýha|příkop)\b/i,
    wall: /\b(stěna|stěn|zeď)\b/i,
    column: /\b(sloup|sloupy)\b/i,
    beam: /\b(trám|nosník|průvlak)\b/i,
    slab: /\b(strop|stropní deska)\b/i,
    floor: /\b(podlaha|mazanina)\b/i,
    road: /\b(vozovka|silnice|cesta)\b/i,
    sidewalk: /\b(chodník|chodníky)\b/i
  };

  for (const [type, pattern] of Object.entries(objects)) {
    if (pattern.test(text)) {
      return type;
    }
  }

  return null;
}

// ============================================================================
// COMPOSITE DETECTION
// ============================================================================

/**
 * Detect composite markers in text
 * @param {string} text - Text to analyze
 * @returns {Object} Marker detection results
 */
function detectCompositeMarkers(text) {
  const markers = {
    hasComposite: false,
    hasTransport: false,
    hasDisposal: false,
    hasDemolition: false,
    hasInstallation: false,
    hasMultipleOps: false,
    detectedMarkers: []
  };

  // Check each marker
  if (COMPOSITE_MARKERS.INCLUDING.test(text)) {
    markers.hasComposite = true;
    markers.detectedMarkers.push('including');
  }

  if (COMPOSITE_MARKERS.PLUS.test(text)) {
    markers.hasComposite = true;
    markers.hasMultipleOps = true;
    markers.detectedMarkers.push('plus');
  }

  if (COMPOSITE_MARKERS.AND_INSTALL.test(text)) {
    markers.hasComposite = true;
    markers.hasInstallation = true;
    markers.detectedMarkers.push('and_install');
  }

  if (COMPOSITE_MARKERS.DEMOLITION_INSTALL.test(text)) {
    markers.hasComposite = true;
    markers.hasDemolition = true;
    markers.hasInstallation = true;
    markers.detectedMarkers.push('demolition_install');
  }

  if (COMPOSITE_MARKERS.COMPLETE.test(text)) {
    markers.hasComposite = true;
    markers.detectedMarkers.push('complete');
  }

  if (COMPOSITE_MARKERS.WITH_TRANSPORT.test(text)) {
    markers.hasComposite = true;
    markers.hasTransport = true;
    markers.detectedMarkers.push('with_transport');
  }

  if (COMPOSITE_MARKERS.WITH_DISPOSAL.test(text)) {
    markers.hasComposite = true;
    markers.hasDisposal = true;
    markers.detectedMarkers.push('with_disposal');
  }

  if (COMPOSITE_MARKERS.MULTIPLE_OPS.test(text)) {
    markers.hasComposite = true;
    markers.hasMultipleOps = true;
    markers.detectedMarkers.push('multiple_ops');
  }

  return markers;
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

/**
 * Build context information from surrounding rows
 * @param {Object} context - Context data
 * @returns {Object} Context information
 */
function buildContextInfo(context) {
  if (!context) {
    return {
      hasParent: false,
      hasSubordinates: false
    };
  }

  return {
    hasParent: !!context.parentText,
    parentText: context.parentText || null,
    hasSubordinates: !!(context.subordinates && context.subordinates.length > 0),
    subordinateCount: context.subordinates?.length || 0,
    subordinateTexts: context.subordinates || [],
    previousRows: context.previousRows || []
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  normalize
};
