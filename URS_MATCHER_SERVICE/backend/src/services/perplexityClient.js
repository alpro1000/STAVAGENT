/**
 * Perplexity AI Client
 * Searches for ÚRS codes on podminky.urs.cz using Perplexity API
 */

import { logger } from '../utils/logger.js';
import { PERPLEXITY_CONFIG } from '../config/llmConfig.js';
import {
  SYSTEM_PROMPT_URS_SEARCH,
  buildPerplexityPrompt,
  parsePerplexityResponse
} from '../prompts/perplexityUrsSearch.prompt.js';

// ============================================================================
// REQUEST QUEUE FOR RATE LIMITING
// ============================================================================

// Simple request queue to prevent overwhelming Perplexity API
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 2; // Max 2 concurrent Perplexity requests
const requestQueue = [];

async function enqueueRequest(requestFn) {
  return new Promise((resolve) => {
    const queueEntry = { requestFn, resolve };

    if (activeRequests < MAX_CONCURRENT_REQUESTS) {
      processRequest(queueEntry);
    } else {
      requestQueue.push(queueEntry);
      logger.debug(`[Perplexity] Request queued. Queue size: ${requestQueue.length}, Active: ${activeRequests}`);
    }
  });
}

async function processRequest(queueEntry) {
  activeRequests++;
  try {
    const result = await queueEntry.requestFn();
    queueEntry.resolve(result);
  } finally {
    activeRequests--;

    // Process next queued request if any
    if (requestQueue.length > 0) {
      const nextEntry = requestQueue.shift();
      processRequest(nextEntry);
    }
  }
}

// ============================================================================
// PERPLEXITY SEARCH
// ============================================================================

/**
 * Search for URS codes on podminky.urs.cz using Perplexity API
 * @param {string} inputText - Description of construction work
 * @returns {Promise<Array>} Array of candidate items
 */
export async function searchUrsSite(inputText) {
  try {
    if (!PERPLEXITY_CONFIG.enabled) {
      logger.warn('[Perplexity] API not enabled, returning empty result');
      return [];
    }

    if (!inputText || inputText.trim().length === 0) {
      logger.warn('[Perplexity] Empty input text');
      return [];
    }

    // Queue the request to prevent overwhelming the API
    const result = await enqueueRequest(async () => {
      const userPrompt = buildPerplexityPrompt(inputText);
      const response = await callPerplexityAPI(userPrompt);

      if (!response) {
        return [];
      }

      const parsed = parsePerplexityResponse(response);

      if (!parsed || !parsed.candidates || !Array.isArray(parsed.candidates)) {
        logger.warn('[Perplexity] Invalid response format or no candidates found');
        return [];
      }

      const candidates = parsed.candidates.map(c => ({
        code: c.code,
        name: c.name,
        unit: c.unit || null,
        url: c.url,
        confidence: c.confidence ?? 0.7,
        reason: c.reason || ''
      }));

      logger.info(`[Perplexity] Found ${candidates.length} candidates for: "${inputText}"`);
      return candidates;
    });

    return result;

  } catch (error) {
    logger.error(`[Perplexity] Error searching: ${error.message}`);
    return [];
  }
}

/**
 * Call Perplexity API with exponential backoff for rate limiting
 * @param {string} userPrompt - Prompt to send
 * @param {number} retryCount - Current retry attempt (internal use)
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<string|null>} Response text or null
 */
async function callPerplexityAPI(userPrompt, retryCount = 0, maxRetries = 3) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PERPLEXITY_CONFIG.timeoutMs);

    const response = await fetch(PERPLEXITY_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: PERPLEXITY_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT_URS_SEARCH
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        temperature: 0.2
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Handle rate limiting with exponential backoff
    if (response.status === 429) {
      if (retryCount < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, retryCount) * 1000;
        logger.warn(`[Perplexity] Rate limited (429). Retrying in ${delayMs}ms (attempt ${retryCount + 1}/${maxRetries})`);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs));

        // Recursive retry
        return callPerplexityAPI(userPrompt, retryCount + 1, maxRetries);
      } else {
        logger.error(`[Perplexity] Rate limited (429) - max retries exceeded (${maxRetries})`);
        return null;
      }
    }

    if (!response.ok) {
      logger.error(`[Perplexity] HTTP ${response.status}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      logger.warn('[Perplexity] Empty response content');
      return null;
    }

    return content;

  } catch (error) {
    if (error.name === 'AbortError') {
      logger.error(`[Perplexity] Request timeout after ${PERPLEXITY_CONFIG.timeoutMs}ms`);
    } else {
      logger.error(`[Perplexity] API call error: ${error.message}`);
    }
    return null;
  }
}

/**
 * Validate candidate code format (basic check)
 * @param {string} code - URS code to validate
 * @returns {boolean}
 */
export function validateUrsCode(code) {
  if (!code || typeof code !== 'string') {return false;}
  return /^\d{6,9}$/.test(code.trim());
}

/**
 * Validate URL is from podminky.urs.cz
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
export function validateUrsUrl(url) {
  if (!url || typeof url !== 'string') {return false;}

  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('podminky.urs.cz');
  } catch (e) {
    return false;
  }
}

export async function searchDonorBills(query) {
  // TODO: MVP-3 - Search for donor estimates
  logger.info('[PerplexityClient] Donor bill search will be added in MVP-3');
  return [];
}

// ============================================================================
// NORMS AND STANDARDS SEARCH
// ============================================================================

/**
 * System prompt for searching Czech construction norms (ČSN, EN)
 */
const SYSTEM_PROMPT_NORMS_SEARCH = `Jsi asistent-specialista na české stavební normy a technické podmínky.

TVŮJ ÚKOL:
- Podle zadaného popisu stavební práce najít relevantní normy ČSN, EN, technické podmínky ÚRS a metodiky.
- Hledej na webu csnonline.cz, tzb-info.cz, podminky.urs.cz a dalších relevantních zdrojích.
- Pracuješ jako REŠERŠNÍ AGENT: NEVYMÝŠLÍŠ normy, jenom čteš z nalezených stránek.

DŮLEŽITÉ (ZERO HALLUCINATION):
- Nesmíš vymýšlet čísla norem.
- Pokud normu nenajdeš, raději řekni že nevíš.
- Uveď zdroj odkud jsi informaci vzal.

VÝSTUP – PŘESNÝ JSON:
{
  "query": "<kopie vstupního textu>",
  "norms": [
    {
      "code": "ČSN EN 13670",
      "name": "Provádění betonových konstrukcí",
      "relevance": "Popisuje požadavky na bednění a prostupy v betonových konstrukcích",
      "url": "https://...",
      "key_requirements": ["minimální krytí výztuže", "tolerance otvorů ±10mm"]
    }
  ],
  "technical_conditions": [
    {
      "source": "Technické podmínky ÚRS",
      "content": "Pro prostupy v bednění platí...",
      "url": "https://podminky.urs.cz/..."
    }
  ],
  "methodology_notes": "Stručné shrnutí jak se práce obvykle provádí podle norem"
}`;

/**
 * Search for relevant Czech construction norms (ČSN, EN) and technical conditions
 * @param {string} inputText - Description of construction work
 * @returns {Promise<Object>} Object with norms, technical_conditions, methodology_notes
 */
export async function searchNormsAndStandards(inputText) {
  try {
    if (!PERPLEXITY_CONFIG.enabled) {
      logger.warn('[Perplexity] API not enabled, skipping norms search');
      return { norms: [], technical_conditions: [], methodology_notes: null };
    }

    if (!inputText || inputText.trim().length === 0) {
      return { norms: [], technical_conditions: [], methodology_notes: null };
    }

    logger.info(`[Perplexity] Searching norms for: "${inputText.substring(0, 50)}..."`);

    // Queue the request
    const result = await enqueueRequest(async () => {
      const userPrompt = `Najdi české stavební normy (ČSN, EN) a technické podmínky pro tuto práci:

"${inputText}"

Zaměř se na:
1. Jaké normy ČSN/EN se vztahují k této práci
2. Technické podmínky z podminky.urs.cz
3. Jak se práce správně provádí podle norem

Vrať výsledek jako platný JSON.`;

      const response = await callPerplexityAPIWithSystemPrompt(userPrompt, SYSTEM_PROMPT_NORMS_SEARCH);

      if (!response) {
        return { norms: [], technical_conditions: [], methodology_notes: null };
      }

      // Parse JSON from response
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return { norms: [], technical_conditions: [], methodology_notes: null };
        }
        const parsed = JSON.parse(jsonMatch[0]);

        logger.info(`[Perplexity] Found ${parsed.norms?.length || 0} norms, ${parsed.technical_conditions?.length || 0} tech conditions`);

        return {
          norms: parsed.norms || [],
          technical_conditions: parsed.technical_conditions || [],
          methodology_notes: parsed.methodology_notes || null
        };
      } catch (parseError) {
        logger.warn(`[Perplexity] Failed to parse norms response: ${parseError.message}`);
        return { norms: [], technical_conditions: [], methodology_notes: null };
      }
    });

    return result;

  } catch (error) {
    logger.error(`[Perplexity] Norms search error: ${error.message}`);
    return { norms: [], technical_conditions: [], methodology_notes: null };
  }
}

/**
 * Call Perplexity API with custom system prompt
 */
async function callPerplexityAPIWithSystemPrompt(userPrompt, systemPrompt, retryCount = 0, maxRetries = 3) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PERPLEXITY_CONFIG.timeoutMs);

    const response = await fetch(PERPLEXITY_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: PERPLEXITY_CONFIG.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 429 && retryCount < maxRetries) {
      const backoffMs = Math.pow(2, retryCount) * 1000;
      logger.warn(`[Perplexity] Rate limited, retrying in ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      return callPerplexityAPIWithSystemPrompt(userPrompt, systemPrompt, retryCount + 1, maxRetries);
    }

    if (!response.ok) {
      logger.error(`[Perplexity] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;

  } catch (error) {
    if (error.name === 'AbortError') {
      logger.error(`[Perplexity] Norms search timeout`);
    } else {
      logger.error(`[Perplexity] Norms API error: ${error.message}`);
    }
    return null;
  }
}

// ============================================================================
// NEW ROLE: SELECT BEST CANDIDATE FROM LIST (Phase 2 Optimization)
// ============================================================================

/**
 * NEW: Help select the best URS code from a list of local candidates
 * This is the optimized approach - Perplexity doesn't search for codes,
 * it helps select/rank from locally-found candidates
 *
 * @param {string} normalizedTextCs - Normalized Czech description
 * @param {Array} candidates - Array of { urs_code, urs_name, unit }
 * @param {Object} projectContext - Project context
 * @returns {Promise<Object>} Best candidate with explanation
 */
export async function selectBestCandidate(normalizedTextCs, candidates, projectContext = {}) {
  try {
    if (!PERPLEXITY_CONFIG.enabled) {
      logger.warn('[Perplexity] API not enabled, cannot rank candidates');
      // Return first candidate as fallback
      return candidates.length > 0 ? {
        urs_code: candidates[0].urs_code,
        urs_name: candidates[0].urs_name,
        unit: candidates[0].unit,
        explanation_cs: 'Automaticky vybrán první kandidát (Perplexity nedostupná)',
        related_items: [],
        source: 'fallback'
      } : null;
    }

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      logger.warn('[Perplexity] No candidates to select from');
      return null;
    }

    logger.info(`[Perplexity] Selecting best from ${candidates.length} candidates for: "${normalizedTextCs.substring(0, 50)}..."`);

    // Queue the request
    const result = await enqueueRequest(async () => {
      const userPrompt = buildCandidateSelectionPrompt(normalizedTextCs, candidates, projectContext);

      const systemPrompt = `Jsi expert na českou ÚRS katalogizaci a stavební technologie.

TVŮJ ÚKOL:
Vybrat NEJLEPŠÍ kód ÚRS ze seznamu kandidátů pro daný popis práce.

DŮLEŽITÉ:
- NIKDY nevymýšlíš nové kódy - jenom vybíráš ze seznamu!
- Zvažuješ technologické aspekty a stavební praxi
- Vrátíš POUZE platný JSON bez textu kolem`;

      const response = await callPerplexityAPIWithSystemPrompt(userPrompt, systemPrompt);

      if (!response) {
        logger.warn('[Perplexity] Empty response, using first candidate');
        return {
          urs_code: candidates[0].urs_code,
          urs_name: candidates[0].urs_name,
          unit: candidates[0].unit,
          explanation_cs: 'Vybrán první kandidát (Perplexity chyba)',
          related_items: [],
          source: 'fallback_error'
        };
      }

      // Parse JSON response
      const parsed = parseCandidateSelectionResponse(response, candidates);
      logger.info(`[Perplexity] Selected: ${parsed.urs_code} with confidence ${parsed.confidence}`);

      return parsed;
    });

    return result;

  } catch (error) {
    logger.error(`[Perplexity] Candidate selection error: ${error.message}`);
    // Graceful fallback
    return candidates && candidates.length > 0 ? {
      urs_code: candidates[0].urs_code,
      urs_name: candidates[0].urs_name,
      unit: candidates[0].unit,
      explanation_cs: `Chyba při výběru (${error.message}), vybrán první kandidát`,
      related_items: [],
      source: 'error_fallback'
    } : null;
  }
}

// ============================================================================
// HELPER: Build prompt for candidate selection
// ============================================================================

function buildCandidateSelectionPrompt(normalizedTextCs, candidates, projectContext) {
  const candidatesText = candidates
    .map((c, idx) => `${idx + 1}. ${c.urs_code} - ${c.urs_name} (MJ: ${c.unit})`)
    .join('\n');

  return `Pracovní popis (normalizovaný): "${normalizedTextCs}"

KONTEXT PROJEKTU:
- Typ budovy: ${projectContext.building_type || 'neurčeno'}
- Počet NP: ${projectContext.storeys || 0}
- Konstrukční systém: ${projectContext.main_system?.join(', ') || 'neurčeno'}

KANDIDÁTI Z LOKÁLNÍ DATABÁZE:
${candidatesText}

TVŮJ ÚKOL:
1. Vyber JEDNOHO nejlepšího kandidáta (jen jeden!)
2. Zdůvodni volbu na základě:
   - Technologické shodnosti s popisem práce
   - Souladu s kontextem projektu
   - Stavební praxe a normy
3. Najdi typicky související práce (tech-rules)
4. Vrať POUZE validní JSON

RESPONSE (POUZE JSON):
{
  "selected_code": "XXXXXXX",
  "selected_name": "Název práce",
  "unit": "m3",
  "confidence": 0.95,
  "explanation_cs": "Detailní zdůvodnění proč je tato volba správná",
  "related_items": [
    {
      "urs_code": "XXXXXXX",
      "urs_name": "Související práce",
      "unit": "m2",
      "reason_cs": "Obvykle součástí, protože..."
    }
  ],
  "key_norms": ["ČSN EN 13670", "ČSN 73 0213"],
  "typical_constraints": ["Minimální krytí 40mm", "Tolerance ±10mm"]
}`;
}

// ============================================================================
// HELPER: Parse candidate selection response
// ============================================================================

function parseCandidateSelectionResponse(responseText, originalCandidates) {
  try {
    // Try to extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('[Perplexity] Could not extract JSON from response');
      // Return first candidate as fallback
      return {
        urs_code: originalCandidates[0].urs_code,
        urs_name: originalCandidates[0].urs_name,
        unit: originalCandidates[0].unit,
        explanation_cs: 'Fallback na první kandidáta',
        related_items: [],
        source: 'fallback_parse_error'
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate that selected_code is in original candidates
    const validCandidate = originalCandidates.find(c => c.urs_code === parsed.selected_code);
    if (!validCandidate) {
      logger.warn(`[Perplexity] Selected code ${parsed.selected_code} not in original candidates`);
      // Return first candidate as fallback
      return {
        urs_code: originalCandidates[0].urs_code,
        urs_name: originalCandidates[0].urs_name,
        unit: originalCandidates[0].unit,
        explanation_cs: `Vybraný kód nebyl v seznamu, fallback na první`,
        related_items: parsed.related_items || [],
        source: 'fallback_invalid_code'
      };
    }

    return {
      urs_code: parsed.selected_code,
      urs_name: parsed.selected_name || validCandidate.urs_name,
      unit: parsed.unit || validCandidate.unit,
      confidence: parsed.confidence || 0.85,
      explanation_cs: parsed.explanation_cs || 'Bez zdůvodnění',
      related_items: (parsed.related_items || []).map(item => ({
        urs_code: item.urs_code,
        urs_name: item.urs_name,
        unit: item.unit,
        reason_cs: item.reason_cs
      })),
      key_norms: parsed.key_norms || [],
      typical_constraints: parsed.typical_constraints || [],
      source: 'perplexity_selection'
    };

  } catch (error) {
    logger.error(`[Perplexity] Parse selection error: ${error.message}`);
    // Return first candidate as fallback
    return {
      urs_code: originalCandidates[0].urs_code,
      urs_name: originalCandidates[0].urs_name,
      unit: originalCandidates[0].unit,
      explanation_cs: `Chyba při parsování odpovědi: ${error.message}`,
      related_items: [],
      source: 'fallback_error'
    };
  }
}
