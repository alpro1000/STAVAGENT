/**
 * Norm Parser
 * Парсинг и нормализация чешских строительных норм в машиночитаемый формат
 *
 * Типы норм:
 * - ČSN (Česká technická norma) - чешские национальные стандарты
 * - ČSN EN (evropská norma přejatá v ČR) - европейские стандарты
 * - ČSN ISO (mezinárodní norma) - международные стандарты
 * - Vyhlášky (подзаконные акты)
 * - Zákony (законы)
 * - Technické podmínky (TP) - технические условия
 */

import { logger } from '../../utils/logger.js';
import { searchNorms, searchCSNNorm, searchBuildingLaw } from './webSearchClient.js';
import { callLLMForTask, TASKS } from '../llmClient.js';

// ============================================================================
// NORM TYPES AND CATEGORIES
// ============================================================================

export const NORM_TYPES = {
  CSN: {
    id: 'csn',
    name: 'ČSN',
    fullName: 'Česká technická norma',
    pattern: /^ČSN\s+(\d{2})\s*(\d{4})(?:\s*[-:]\s*(\d+))?/i,
    description: 'Národní technická norma ČR'
  },
  CSN_EN: {
    id: 'csn_en',
    name: 'ČSN EN',
    fullName: 'Česká technická norma přejatá z EN',
    pattern: /^ČSN\s+EN\s+(\d+)(?:[-:](\d+))?(?:[-:](\d+))?/i,
    description: 'Evropská norma přejatá do ČSN'
  },
  CSN_ISO: {
    id: 'csn_iso',
    name: 'ČSN ISO',
    fullName: 'Česká technická norma přejatá z ISO',
    pattern: /^ČSN\s+ISO\s+(\d+)(?:[-:](\d+))?/i,
    description: 'Mezinárodní norma přejatá do ČSN'
  },
  VYHLASKA: {
    id: 'vyhlaska',
    name: 'Vyhláška',
    fullName: 'Vyhláška ministerstva',
    pattern: /^Vyhláška\s+(?:č\.\s*)?(\d+)\/(\d{4})\s*Sb\./i,
    description: 'Prováděcí právní předpis'
  },
  ZAKON: {
    id: 'zakon',
    name: 'Zákon',
    fullName: 'Zákon ČR',
    pattern: /^Zákon\s+(?:č\.\s*)?(\d+)\/(\d{4})\s*Sb\./i,
    description: 'Zákon České republiky'
  },
  TP: {
    id: 'tp',
    name: 'TP',
    fullName: 'Technické podmínky',
    pattern: /^TP\s+(\d+)/i,
    description: 'Technické podmínky ministerstva dopravy'
  },
  TKP: {
    id: 'tkp',
    name: 'TKP',
    fullName: 'Technické kvalitativní podmínky',
    pattern: /^TKP\s+(\d+)/i,
    description: 'Technické kvalitativní podmínky staveb'
  }
};

// ČSN category groups (based on třídník)
export const CSN_CATEGORIES = {
  '01': { name: 'Obecná třída', topics: ['obecné pojmy', 'výpočty', 'výkresy'] },
  '27': { name: 'Betonové konstrukce', topics: ['beton', 'železobeton', 'prefabrikáty'] },
  '30': { name: 'Zednické práce', topics: ['zdivo', 'omítky', 'obklady'] },
  '31': { name: 'Stavební fyzika', topics: ['tepelná technika', 'akustika', 'osvětlení'] },
  '33': { name: 'Elektrotechnika', topics: ['elektroinstalace', 'osvětlení', 'hromosvody'] },
  '36': { name: 'Výtahy', topics: ['výtahy', 'eskalátory', 'zdvihací zařízení'] },
  '38': { name: 'Požární ochrana', topics: ['požární bezpečnost', 'únikové cesty'] },
  '49': { name: 'Dřevěné konstrukce', topics: ['dřevostavby', 'krovy', 'tesařské práce'] },
  '72': { name: 'Bytová výstavba', topics: ['byty', 'obytné budovy'] },
  '73': { name: 'Navrhování a provádění staveb', topics: ['základy', 'nosné konstrukce', 'střechy'] },
  '74': { name: 'Vodní hospodářství', topics: ['vodovody', 'kanalizace', 'čistírny'] },
  '75': { name: 'Vodní stavby', topics: ['přehrady', 'vodní nádrže', 'jezy'] },
  '83': { name: 'Ochrana životního prostředí', topics: ['emise', 'odpady', 'hluk'] }
};

// ============================================================================
// NORM PARSING
// ============================================================================

/**
 * Parse norm reference and extract structured data
 *
 * @param {string} normReference - Norm reference (e.g., "ČSN EN 13670", "73 2400")
 * @returns {Object} Parsed norm data
 */
export function parseNormReference(normReference) {
  const normalized = normReference.trim().toUpperCase();

  // Try each norm type pattern
  for (const [typeKey, typeInfo] of Object.entries(NORM_TYPES)) {
    const match = normalized.match(typeInfo.pattern);
    if (match) {
      return {
        type: typeInfo.id,
        typeName: typeInfo.name,
        code: normalized,
        parts: match.slice(1).filter(Boolean),
        category: getCategory(typeInfo.id, match),
        isValid: true
      };
    }
  }

  // Try to match short ČSN format (e.g., "73 2400")
  const shortMatch = normalized.match(/^(\d{2})\s*(\d{4})(?:\s*[-:]\s*(\d+))?$/);
  if (shortMatch) {
    return {
      type: 'csn',
      typeName: 'ČSN',
      code: `ČSN ${shortMatch[1]} ${shortMatch[2]}${shortMatch[3] ? '-' + shortMatch[3] : ''}`,
      parts: shortMatch.slice(1).filter(Boolean),
      category: CSN_CATEGORIES[shortMatch[1]] || null,
      isValid: true
    };
  }

  return {
    type: 'unknown',
    typeName: 'Neznámý typ',
    code: normalized,
    parts: [],
    category: null,
    isValid: false
  };
}

/**
 * Get category info for a norm
 */
function getCategory(type, match) {
  if (type === 'csn' && match[1]) {
    return CSN_CATEGORIES[match[1]] || null;
  }
  return null;
}

// ============================================================================
// NORM NORMALIZATION (to machine-readable format)
// ============================================================================

/**
 * Normalize norm content to structured JSON format
 *
 * @param {Object} rawNorm - Raw norm data from search/parsing
 * @returns {Object} Normalized norm in machine-readable format
 */
export function normalizeNorm(rawNorm) {
  const parsed = parseNormReference(rawNorm.code || rawNorm.title);

  return {
    // Identifikace
    id: generateNormId(parsed.code),
    code: parsed.code,
    type: parsed.type,
    typeName: parsed.typeName,

    // Základní údaje
    title: rawNorm.title || null,
    titleCz: rawNorm.titleCz || rawNorm.title || null,
    titleEn: rawNorm.titleEn || null,

    // Kategorizace
    category: parsed.category,
    topics: extractTopics(rawNorm),
    keywords: extractKeywords(rawNorm),

    // Obsah
    abstract: rawNorm.abstract || rawNorm.description || null,
    scope: rawNorm.scope || null,
    requirements: rawNorm.requirements || [],
    sections: rawNorm.sections || [],

    // Odkazy
    references: {
      replaces: rawNorm.replaces || [],       // Nahrazuje normy
      replacedBy: rawNorm.replacedBy || [],   // Nahrazena normou
      related: rawNorm.related || [],         // Související normy
      harmonized: rawNorm.harmonized || null  // Harmonizace s EU
    },

    // Metadata
    metadata: {
      status: rawNorm.status || 'active',      // active, withdrawn, draft
      effectiveDate: rawNorm.effectiveDate || null,
      withdrawalDate: rawNorm.withdrawalDate || null,
      lastUpdate: rawNorm.lastUpdate || new Date().toISOString(),
      source: rawNorm.source || 'web_search',
      sourceUrl: rawNorm.url || null,
      language: 'cs',
      pages: rawNorm.pages || null
    },

    // Strojová čitelnost
    machineReadable: {
      version: '1.0',
      format: 'json',
      createdAt: new Date().toISOString(),
      checksum: null // Can be added for integrity verification
    }
  };
}

/**
 * Normalize search results into structured norms
 *
 * @param {Array} searchResults - Results from web search
 * @returns {Array} Normalized norms
 */
export function normalizeSearchResults(searchResults) {
  return searchResults.map(result => {
    // Extract norm code from title if present
    const normCode = extractNormCode(result.title) || result.title;

    return normalizeNorm({
      code: normCode,
      title: result.title,
      description: result.description || result.content,
      url: result.url,
      source: result.source,
      isTrusted: result.isTrusted
    });
  });
}

// ============================================================================
// LLM-ENHANCED PARSING
// ============================================================================

/**
 * Extract detailed norm information using LLM
 *
 * @param {string} normCode - Norm code
 * @param {string} content - Raw content from search
 * @returns {Promise<Object>} Extracted norm details
 */
export async function extractNormDetailsWithLLM(normCode, content) {
  const systemPrompt = `Jsi expert na české technické normy a stavební legislativu.
Tvým úkolem je extrahovat strukturované informace z textu o normě.
Odpověz POUZE validním JSON bez dalšího textu.`;

  const userPrompt = `Extrahuj informace o normě "${normCode}" z následujícího textu:

${content.substring(0, 3000)}

Vrať JSON v tomto formátu:
{
  "title": "Název normy",
  "scope": "Oblast působnosti",
  "keyRequirements": ["Požadavek 1", "Požadavek 2"],
  "relatedNorms": ["ČSN EN xxx", "ČSN yy zzzz"],
  "topics": ["téma1", "téma2"],
  "summary": "Stručný souhrn (1-2 věty)"
}`;

  try {
    const response = await callLLMForTask(
      TASKS.SIMPLE_MATCHING,
      systemPrompt,
      userPrompt,
      30000
    );

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    logger.warn(`[NormParser] Could not parse LLM response for ${normCode}`);
    return null;

  } catch (error) {
    logger.error(`[NormParser] LLM extraction error for ${normCode}: ${error.message}`);
    return null;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate unique ID for norm
 */
function generateNormId(code) {
  return code
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');
}

/**
 * Extract norm code from title
 */
function extractNormCode(title) {
  if (!title) return null;

  // Try common patterns
  const patterns = [
    /ČSN\s+EN\s+\d+(?:[-:]\d+)*/i,
    /ČSN\s+ISO\s+\d+(?:[-:]\d+)*/i,
    /ČSN\s+\d{2}\s*\d{4}(?:[-:]\d+)*/i,
    /Vyhláška\s+č\.\s*\d+\/\d+\s*Sb\./i,
    /Zákon\s+č\.\s*\d+\/\d+\s*Sb\./i
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return match[0];
  }

  return null;
}

/**
 * Extract topics from norm data
 */
function extractTopics(norm) {
  const topics = [];
  const text = `${norm.title || ''} ${norm.description || ''}`.toLowerCase();

  const topicKeywords = {
    'beton': 'betonové konstrukce',
    'železobeton': 'železobetonové konstrukce',
    'zdivo': 'zděné konstrukce',
    'základy': 'zakládání staveb',
    'střecha': 'střešní konstrukce',
    'izolace': 'izolace',
    'požár': 'požární bezpečnost',
    'statik': 'statika',
    'geotechnik': 'geotechnika',
    'akustik': 'akustika',
    'tepeln': 'tepelná technika'
  };

  for (const [keyword, topic] of Object.entries(topicKeywords)) {
    if (text.includes(keyword)) {
      topics.push(topic);
    }
  }

  return [...new Set(topics)];
}

/**
 * Extract keywords from norm data
 */
function extractKeywords(norm) {
  const text = `${norm.title || ''} ${norm.description || ''}`;

  // Simple keyword extraction (can be enhanced with NLP)
  const words = text
    .toLowerCase()
    .replace(/[^\wáčďéěíňóřšťúůýž\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);

  // Count word frequency
  const wordCount = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  // Return top keywords
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

export default {
  NORM_TYPES,
  CSN_CATEGORIES,
  parseNormReference,
  normalizeNorm,
  normalizeSearchResults,
  extractNormDetailsWithLLM
};
