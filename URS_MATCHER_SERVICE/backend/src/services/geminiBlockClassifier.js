/**
 * Gemini Block Classifier
 * Классификация BOQ по třídníку (структурам) с использованием Gemini
 *
 * Задача:
 * 1. Разбить строки BOQ на логические блоки (základy, ŽB stěny, zdivo, bednění и т.д.)
 * 2. Нормализовать текст на чешском
 * 3. Определить třídník-префикс (27x, 32x, 41x и т.д.)
 *
 * Важно:
 * - Timeout: 20 секунд (не 90!)
 * - Graceful degradation: если Gemini падает → fallback на локальный parserТитл
 * - JSON parsing с regex (может быть markdown code block)
 * - Подробное логирование времени
 */

import { logger } from '../utils/logger.js';
import { getRuntimeModel, getAvailableProviders } from '../config/llmConfig.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const GEMINI_CLASSIFICATION_TIMEOUT = 20000; // 20s timeout (strict!)
const GEMINI_MAX_ROWS_PER_CHUNK = 50; // Не отправлять > 50 строк за раз

// Mappings для автоматической классификации (fallback) - aligned with TSKP categories
const TRIDNIK_KEYWORDS = {
  // 1 - Zemní práce
  '1x': ['výkop', 'rýh', 'jáma', 'hlouben', 'odkop', 'zásyp', 'násyp', 'hutn', 'zemina', 'terén', 'skrývk', 'svahová', 'odvoz', 'pažení', 'přemísť'],

  // 2 - Zakládání
  '2x': ['základ', 'patk', 'pas', 'pilot', 'podklad', 'štěrkop', 'beton základ', 'základová', 'mikropil', 'vrtan'],

  // 27x - Betonové konstrukce (ŽB)
  '27x': ['beton', 'betonu', 'žb', 'železobeton', 'železobetonový', 'deska', 'sloup', 'stěna', 'monolitický', 'betonová'],

  // 31x, 32x - Zdivo
  '31x': ['zdivo', 'cihl', 'tvárnic', 'blok', 'tvárnice', 'keramick', 'porotherm', 'pevný', 'kern', 'kvádr'],
  '32x': ['porotherm', 'airbeton', 'vápenopísek', 'lehčený', 'střešní', 'keramický'],

  // 34x - Stropy, příčky
  '34x': ['strop', 'průvlak', 'překlad', 'věnec', 'příčk', 'příčka'],

  // 4 - Vodorovné konstrukce
  '4x': ['schodiště', 'schod', 'rampa', 'podest', 'balkon', 'konzol'],

  // 41x, 42x - Bednění, lešení
  '41x': ['bednění', 'bedně', 'bednaž', 'bednáž', 'formwork', 'desky', 'trámky', 'lepenkový'],
  '42x': ['lešení', 'skele', 'kotvení', 'příchytné'],

  // 43x - Výztuž
  '43x': ['výztuž', 'výztužn', 'armatur', 'ocel prut', 'pruty', 'drát', 'sítě', 'kari', 'sí'],

  // 5 - Komunikace
  '5x': ['komunikac', 'vozovka', 'chodník', 'dlažba', 'obrubn', 'asfalt', 'cest', 'parkoviště', 'silnic'],

  // 6 - Úpravy povrchů
  '6x': ['omítk', 'štukov', 'stěrk', 'obklad', 'malb', 'nátěr', 'povrch', 'fasád', 'zateplení', 'polystyren'],

  // 63x - Podlahy
  '63x': ['podlaha', 'podlahy', 'anhydrit', 'mazanina', 'betonáž', 'vyrovnávací', 'ochranná', 'plovouc', 'vinyl', 'laminát'],

  // 71x, 72x - Izolace
  '7x': ['izolac', 'hydroizolac', 'separace', 'fólie', 'asfaltov', 'geotextil', 'PE fólie', 'tepelná'],

  // 8 - Trubní vedení
  '8x': ['potrub', 'kanalizac', 'vodovod', 'plynovod', 'trubk', 'šacht', 'vpust', 'žlab', 'drenáž'],

  // 9 - Ostatní
  '9x': ['lešen', 'ochran', 'demolic', 'bourac', 'přesun', 'doprav', 'příprav', 'úklid', 'zajišt'],

  // 21x, 22x - Instalace (additional)
  '21x': ['odvětrání', 'radon', 'voda', 'elektro', 'vent'],
  '22x': ['topení', 'kotel', 'radiátor', 'rozvod', 'topná']
};

// ============================================================================
// MAIN FUNCTION: Classify BOQ rows with Gemini
// ============================================================================

export async function classifyBoqWithGemini(rows, projectContext = {}) {
  const startTime = Date.now();

  logger.info(`[GEMINI-CLASSIFIER] Starting classification of ${rows.length} rows`);

  try {
    // Validace
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new Error('Rows must be non-empty array');
    }

    // Rozdělit na chunky po max 50 řádků
    const chunks = [];
    for (let i = 0; i < rows.length; i += GEMINI_MAX_ROWS_PER_CHUNK) {
      chunks.push(rows.slice(i, i + GEMINI_MAX_ROWS_PER_CHUNK));
    }

    logger.info(`[GEMINI-CLASSIFIER] Split into ${chunks.length} chunks (max 50 rows each)`);

    // Zpracovat všechny chunky
    const allBlocks = [];
    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx];
      const chunkStartTime = Date.now();

      logger.debug(`[GEMINI-CLASSIFIER] Processing chunk ${chunkIdx + 1}/${chunks.length} (${chunk.length} rows)...`);

      const chunkBlocks = await classifyChunkWithGemini(chunk, projectContext);
      allBlocks.push(...chunkBlocks);

      const chunkDuration = Date.now() - chunkStartTime;
      logger.debug(`[GEMINI-CLASSIFIER] Chunk ${chunkIdx + 1} completed in ${chunkDuration}ms`);
    }

    // Merge adjacent blocks with same classification
    const mergedBlocks = mergeAdjacentBlocks(allBlocks);

    const totalDuration = Date.now() - startTime;
    logger.info(`[GEMINI-CLASSIFIER] Classification complete: ${mergedBlocks.length} blocks in ${totalDuration}ms`);

    return {
      blocks: mergedBlocks,
      stats: {
        total_rows: rows.length,
        total_blocks: mergedBlocks.length,
        execution_time_ms: totalDuration,
        source: 'gemini'
      }
    };

  } catch (error) {
    logger.warn(`[GEMINI-CLASSIFIER] Gemini classification failed: ${error.message}`);
    logger.info('[GEMINI-CLASSIFIER] Falling back to local keyword-based classification');

    // Graceful degradation: use local fallback
    const fallbackBlocks = classifyLocally(rows, projectContext);

    const totalDuration = Date.now() - startTime;
    logger.warn(`[GEMINI-CLASSIFIER] Using local fallback: ${fallbackBlocks.length} blocks in ${totalDuration}ms`);

    return {
      blocks: fallbackBlocks,
      stats: {
        total_rows: rows.length,
        total_blocks: fallbackBlocks.length,
        execution_time_ms: totalDuration,
        source: 'local_fallback',
        error: error.message
      }
    };
  }
}

// ============================================================================
// HELPER: Classify single chunk with Gemini
// ============================================================================

async function classifyChunkWithGemini(chunk, projectContext) {
  try {
    // Build prompt
    const prompt = buildClassificationPrompt(chunk, projectContext);

    logger.debug(`[GEMINI-CLASSIFIER] Gemini prompt: ${prompt.length} chars`);

    // Call Gemini with strict timeout
    const response = await callGeminiWithTimeout(prompt, GEMINI_CLASSIFICATION_TIMEOUT);

    // Parse JSON response
    const parsed = parseGeminiJsonResponse(response);

    if (!parsed.blocks || !Array.isArray(parsed.blocks)) {
      throw new Error('Invalid response structure: missing blocks array');
    }

    logger.debug(`[GEMINI-CLASSIFIER] Gemini returned ${parsed.blocks.length} blocks`);

    return parsed.blocks;

  } catch (error) {
    logger.warn(`[GEMINI-CLASSIFIER] Gemini chunk processing failed: ${error.message}`);
    throw error;
  }
}

// ============================================================================
// HELPER: Build Gemini prompt
// ============================================================================

function buildClassificationPrompt(rows, projectContext) {
  const rowsText = rows
    .map((r, idx) => `${idx + 1}. "${r.description || r.raw_text}" (${r.quantity} ${r.unit || 'ks'})`)
    .join('\n');

  return `
Jsi odborný stavbyvedoucí a expert na českou ÚRS katalogizaci.

ÚKOL: Vyber relevantní třídník (section) pro následující položky BOQ.

KONTEXT:
- Typ budovy: ${projectContext.building_type || 'neurčeno'}
- Počet NP: ${projectContext.storeys || 0}
- Konstrukční systém: ${projectContext.main_system?.join(', ') || 'neurčeno'}

POLOŽKY:
${rowsText}

POKYNY:
1. SESKUPI položky do logických BLOKŮ (základ, ŽB stěny, zdivo, bednění, atd.)
2. Pro KAŽDÝ BLOK urči správný třídník (27x, 32x, 41x, atd.)
3. NORMALIZUJ text každé položky na technickou češtinu (bez zbytečných slov)
4. VRAŤ POUZE validní JSON (bez markdown, bez textu kolem)

TŘÍDNÍK (TSKP - Třídník stavebních konstrukcí a prací):
- 1 = Zemní práce (výkopy, zásypy, pažení)
- 2 = Zakládání (základy, piloty, podklady)
- 3 = Svislé konstrukce (zdivo, příčky, sloupy)
  - 27x = Betonové konstrukce (ŽB)
  - 31x = Zdivo nosné
  - 32x = Zdivo nenosné
- 4 = Vodorovné konstrukce (stropy, překlady, schodiště)
  - 41x = Bednění
  - 42x = Lešení
  - 43x = Výztuž
- 5 = Komunikace (vozovky, chodníky, dlažby)
- 6 = Úpravy povrchů (omítky, obklady, podlahy)
  - 61x = Povrchové úpravy
  - 63x = Podlahy
- 7 = Izolace (hydroizolace, tepelné izolace)
- 8 = Trubní vedení (kanalizace, vodovod)
- 9 = Ostatní konstrukce (demolice, přesuny)

RESPONSE FORMAT (POUZE JSON):
{
  "blocks": [
    {
      "block_name": "ŽB stěny",
      "tridnik_prefix": "27",
      "rows": [
        {
          "original_index": 1,
          "normalized_text_cs": "Železobetonová stěna tl. 250 mm",
          "quantity": 32.76,
          "unit": "m3"
        }
      ]
    }
  ]
}
`;
}

// ============================================================================
// HELPER: Call Gemini with strict timeout
// ============================================================================

async function callGeminiWithTimeout(prompt, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Get runtime-selected model configuration
    const runtimeModel = getRuntimeModel();
    const availableProviders = getAvailableProviders();

    // Determine which model and API key to use
    let apiKey;
    let modelName;

    // Check if runtime model is Gemini - use it
    if (runtimeModel.isRuntimeSelected && runtimeModel.provider === 'gemini') {
      apiKey = availableProviders.gemini?.apiKey;
      modelName = runtimeModel.model;
      logger.info(`[GEMINI-CLASSIFIER] Using runtime-selected model: ${modelName}`);
    } else if (availableProviders.gemini?.enabled) {
      // Fall back to Gemini from available providers
      apiKey = availableProviders.gemini.apiKey;
      modelName = availableProviders.gemini.model;
      logger.debug(`[GEMINI-CLASSIFIER] Using default Gemini model: ${modelName}`);
    } else {
      // Last resort: environment variables
      apiKey = process.env.GOOGLE_AI_KEY || process.env.GOOGLE_API_KEY;
      modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
    }

    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY not set');
    }

    // Import Gemini client dynamically
    const { default: genai } = await import('google-generativeai');

    genai.configure({ apiKey });
    const model = genai.getGenerativeModel({ model: modelName });

    // Call Gemini
    const response = await model.generateContent(prompt);
    const text = response.text;

    if (!text) {
      throw new Error('Gemini returned empty response');
    }

    logger.debug(`[GEMINI-CLASSIFIER] Gemini (${modelName}) responded: ${text.length} chars`);

    return text;

  } catch (error) {
    if (error.name === 'AbortError') {
      logger.warn(`[GEMINI-CLASSIFIER] Gemini timeout after ${timeoutMs}ms`);
      throw new Error(`Gemini timeout (${timeoutMs}ms)`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// HELPER: Parse Gemini JSON response (handle markdown wrapping)
// ============================================================================

function parseGeminiJsonResponse(text) {
  try {
    // Try to parse as-is (clean JSON)
    return JSON.parse(text);
  } catch (e) {
    // If fails, try to extract JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e2) {
        logger.warn('[GEMINI-CLASSIFIER] Failed to parse JSON from markdown block');
      }
    }

    // Last resort: find JSON object in response
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch (e3) {
        logger.warn('[GEMINI-CLASSIFIER] Failed to extract JSON object');
      }
    }

    throw new Error('Could not parse Gemini response as JSON');
  }
}

// ============================================================================
// HELPER: Local fallback classification (keyword-based)
// ============================================================================

function classifyLocally(rows, projectContext) {
  logger.info('[GEMINI-CLASSIFIER] Using local keyword-based classification');

  const blocks = [];
  let currentBlock = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const text = (row.description || row.raw_text || '').toLowerCase();

    // Determine třídník prefix
    const tridnikPrefix = determineTridnikPrefix(text);

    // Normalize text
    const normalizedText = normalizeTextLocally(text);

    // Check if we need a new block
    if (!currentBlock || currentBlock.tridnik_prefix !== tridnikPrefix) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }

      currentBlock = {
        block_name: getBlockNameFromTridnik(tridnikPrefix),
        tridnik_prefix: tridnikPrefix,
        rows: []
      };
    }

    // Add row to current block
    currentBlock.rows.push({
      original_index: i + 1,
      normalized_text_cs: normalizedText,
      quantity: row.quantity || 0,
      unit: row.unit || 'ks'
    });
  }

  // Add last block
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}

// ============================================================================
// HELPER: Determine třídník prefix from text
// ============================================================================

function determineTridnikPrefix(text) {
  for (const [prefix, keywords] of Object.entries(TRIDNIK_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return prefix.replace('x', '');
      }
    }
  }

  // Default fallback
  return 'XX';
}

// ============================================================================
// HELPER: Normalize text locally
// ============================================================================

function normalizeTextLocally(text) {
  return text
    .trim()
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove common prefixes/suffixes
    .replace(/^(položka|položka č|kód|\d+\.\s*)/, '')
    .trim();
}

// ============================================================================
// HELPER: Get block name from třídník prefix
// ============================================================================

function getBlockNameFromTridnik(prefix) {
  const tridnikMap = {
    // TSKP Level 1 categories
    '1': 'Zemní práce',
    '2': 'Zakládání',
    '3': 'Svislé konstrukce',
    '4': 'Vodorovné konstrukce',
    '5': 'Komunikace',
    '6': 'Úpravy povrchů',
    '7': 'Izolace',
    '8': 'Trubní vedení',
    '9': 'Ostatní konstrukce',

    // URS-specific subcategories
    '27': 'Betonové konstrukce',
    '31': 'Zdivo nosné',
    '32': 'Zdivo nenosné',
    '34': 'Stropy a překlady',
    '41': 'Bednění',
    '42': 'Lešení',
    '43': 'Výztuž',
    '61': 'Povrchové úpravy',
    '63': 'Podlahy',
    '71': 'Hydroizolace',
    '72': 'Tepelné izolace',
    '21': 'Instalace voda',
    '22': 'Topení',
    'XX': 'Ostatní'
  };

  // Try exact match first
  if (tridnikMap[prefix]) {
    return tridnikMap[prefix];
  }

  // Try first digit for TSKP level 1
  const firstDigit = prefix.charAt(0);
  if (tridnikMap[firstDigit]) {
    return tridnikMap[firstDigit];
  }

  return `Třídník ${prefix}`;
}

// ============================================================================
// HELPER: Merge adjacent blocks with same classification
// ============================================================================

function mergeAdjacentBlocks(blocks) {
  if (blocks.length === 0) return blocks;

  const merged = [];
  let current = { ...blocks[0] };

  for (let i = 1; i < blocks.length; i++) {
    const next = blocks[i];

    if (next.tridnik_prefix === current.tridnik_prefix) {
      // Merge rows
      current.rows.push(...next.rows);
    } else {
      // Save current, start new
      merged.push(current);
      current = { ...next };
    }
  }

  merged.push(current);
  return merged;
}

export default {
  classifyBoqWithGemini
};
