/**
 * Work Splitter Service
 * Detects if position is SINGLE or COMPOSITE and splits into subworks
 *
 * Purpose:
 * - Use Gemini LLM to analyze position text
 * - Determine: SINGLE (1 work) vs COMPOSITE (2-5 works)
 * - Split composite positions into discrete subworks
 * - Generate keywords and features for each subwork
 *
 * @module services/batch/workSplitter
 */

import { logger } from '../../utils/logger.js';
import { callLLM } from './batchLLMClient.js';

// ============================================================================
// MAIN SPLIT FUNCTION
// ============================================================================

/**
 * Split position into subworks
 * @param {Object} normalized - Normalized text result
 * @param {number} [maxSubWorks=5] - Max subworks to extract
 * @returns {Object} Split result
 */
export async function split(normalized, maxSubWorks = 5) {
  const startTime = Date.now();

  try {
    logger.info(`[WorkSplitter] Input: "${normalized.normalizedText}"`);
    logger.debug(`[WorkSplitter] Features: ${JSON.stringify(normalized.features)}`);
    logger.debug(`[WorkSplitter] Markers: ${JSON.stringify(normalized.markers)}`);

    // Build LLM prompt
    const prompt = buildSplitPrompt(normalized, maxSubWorks);

    logger.info(`[WorkSplitter] Calling LLM for work splitting`);

    // Call LLM
    const llmStartTime = Date.now();
    const llmResponse = await callLLM({
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      maxTokens: 1500,
      temperature: 0.2,  // Low temperature for consistency
      taskType: 'KEYWORD_GENERATION'  // Use cheapest model (Gemini)
    });
    const llmElapsed = Date.now() - llmStartTime;

    logger.debug(`[WorkSplitter] LLM response: ${llmResponse.content}`);
    logger.info(`[WorkSplitter] LLM timing: ${llmElapsed}ms`);

    // Parse LLM response
    const parsedResult = parseLLMResponse(llmResponse.content);

    // Validate result
    if (!parsedResult.detectedType) {
      throw new Error('LLM did not return detectedType');
    }

    // Enforce maxSubWorks limit
    if (parsedResult.subWorks && parsedResult.subWorks.length > maxSubWorks) {
      logger.warn(`[WorkSplitter] LLM returned ${parsedResult.subWorks.length} subworks, limiting to ${maxSubWorks}`);
      parsedResult.subWorks = parsedResult.subWorks.slice(0, maxSubWorks);
      parsedResult.reasoning += ` (limited to ${maxSubWorks} subworks)`;
      parsedResult.confidence = 'medium';  // Downgrade confidence
    }

    const elapsed = Date.now() - startTime;

    const result = {
      detectedType: parsedResult.detectedType,
      subWorks: parsedResult.subWorks || [],
      reasoning: parsedResult.reasoning || 'No reasoning provided',
      confidence: parsedResult.confidence || 'medium',
      timing: {
        totalMs: elapsed,
        llmMs: llmElapsed
      }
    };

    logger.info(`[WorkSplitter] Result: ${result.detectedType}, ${result.subWorks.length} subwork(s), confidence: ${result.confidence}`);
    logger.info(`[WorkSplitter] Reasoning: ${result.reasoning}`);
    logger.info(`[WorkSplitter] Timing: ${elapsed}ms total (LLM: ${llmElapsed}ms)`);

    return result;

  } catch (error) {
    logger.error(`[WorkSplitter] Error: ${error.message}`);
    logger.error(`[WorkSplitter] Stack: ${error.stack}`);

    // Return fallback: treat as SINGLE if splitting fails
    return {
      detectedType: 'SINGLE',
      subWorks: [{
        index: 1,
        text: normalized.normalizedText,
        operation: normalized.features.operation || 'unknown',
        keywords: extractKeywords(normalized.normalizedText),
        features: normalized.features
      }],
      reasoning: `Error during splitting: ${error.message}. Fallback to SINGLE.`,
      confidence: 'low',
      timing: {
        totalMs: Date.now() - startTime,
        llmMs: 0
      },
      error: error.message
    };
  }
}

// ============================================================================
// PROMPT BUILDING
// ============================================================================

/**
 * Build LLM prompt for work splitting
 * @param {Object} normalized - Normalized text + features
 * @param {number} maxSubWorks - Max subworks allowed
 * @returns {string} Prompt for LLM
 */
function buildSplitPrompt(normalized, maxSubWorks) {
  const { normalizedText, features, markers } = normalized;

  return `You are a Czech construction quantity surveyor (rozpočtář) who works with the ÚRS catalog (podminky.urs.cz).

═══════════════════════════════════════════════════════════════
CORE PRINCIPLE — "ONE URS CODE = ONE ATOMIC OPERATION"
═══════════════════════════════════════════════════════════════

In the ÚRS catalog every code describes exactly ONE atomic operation:
  • ONE action (pour, dig, remove, install, paint, etc.)
  • on ONE material/object (concrete, plaster, pipe, railing, etc.)
  • measured in ONE unit (m³, m², kg, ks, m, etc.)

If a BOQ position describes MULTIPLE such operations → it is COMPOSITE
and must be split so that each subwork can be found separately.

═══════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════

Analyze this BOQ position and determine: SINGLE or COMPOSITE?
If COMPOSITE → split into ${maxSubWorks} or fewer searchable subworks.

**INPUT:**
Text: "${normalizedText}"
Features: ${JSON.stringify(features)}
Markers: ${JSON.stringify(markers)}

═══════════════════════════════════════════════════════════════
DECISION FRAMEWORK (apply in order)
═══════════════════════════════════════════════════════════════

ASK YOURSELF: "How many separate ÚRS codes would a quantity surveyor need?"

Step 1 — CHECK SIGNAL WORDS (if any found → COMPOSITE):
  • "včetně" / "vč." → the included item is ALWAYS a separate code
  • "+" → each part is separate
  • "dodávka a montáž" → supply + installation = at least 2 codes
  • "komplet" / "kompletní" / "se vším" → multiple hidden works
  • "a" connecting different operations → e.g., "bourání a odvoz" = 2 codes

Step 2 — CHECK FOR HIDDEN WORKS:
  • "pod nátěr/obklad/dlažbu" → implies surface preparation = extra code
  • Comma-separated different defects → "praskliny, trhliny, dutiny" = may be same code
  • Comma-separated different operations → "opravy, odstranění" = different codes
  • "z X%" → quantity modifier, NOT a separate work

Step 3 — THINK ABOUT WHAT'S IMPLIED:
  • Removal work? → usually needs disposal/transport too
  • Installation? → usually separate from supply (dodávka)
  • Surface prep? → usually separate from the final coat/layer
  • Anchoring/fixing? → usually separate from the main element

Step 4 — DO NOT OVER-SPLIT:
  • Same action on same material = ONE subwork (not two)
  • Quantity modifiers (z 5%, tl. 30mm, kat. 3) belong to parent
  • Adjectives (vnitřní, vnější, lokální) are descriptors, not separate works
  • If unsure, keep as SINGLE with confidence=medium

═══════════════════════════════════════════════════════════════
SUBWORK FORMAT
═══════════════════════════════════════════════════════════════

Each subwork MUST be independently searchable in the ÚRS catalog:
  • text: Short Czech description as a quantity surveyor would search
    (e.g., "Odstranění omítky vnitřních stěn otlučením")
  • operation: One of these types:
    excavation | demolition | removal | transport | backfill | compaction |
    concreting | formwork | reinforcement | waterproofing | insulation |
    plastering | plaster_repair | painting | tiling | installation |
    cleaning | surface_preparation | masonry | roofing | piping | paving |
    supply | anchoring | other
  • keywords: 3-5 Czech terms a surveyor would use to search ÚRS catalog
    (use professional terms: "otlučení omítky" not "sundání omítky")

═══════════════════════════════════════════════════════════════
OUTPUT — JSON only, no markdown, no explanation outside JSON
═══════════════════════════════════════════════════════════════

{
  "detectedType": "SINGLE" | "COMPOSITE",
  "subWorks": [
    {
      "index": 1,
      "text": "Czech description for ÚRS search",
      "operation": "operation_type",
      "keywords": ["professional", "Czech", "terms", "for", "search"]
    }
  ],
  "reasoning": "Why split this way (1-2 sentences, English)",
  "confidence": "high" | "medium" | "low"
}

═══════════════════════════════════════════════════════════════
EXAMPLES (diverse domains)
═══════════════════════════════════════════════════════════════

Input: "Výkop stavební jámy kat. 3"
→ SINGLE: one atomic operation (excavation of pit, category 3)
{"detectedType":"SINGLE","subWorks":[{"index":1,"text":"Výkop stavební jámy v hornině třídy 3","operation":"excavation","keywords":["výkop","stavební jáma","hornina","třída 3","hloubení"]}],"reasoning":"Single excavation, 'kat. 3' is a qualifier not separate work","confidence":"high"}

Input: "Beton C 25/30 vč. doprava do 10km"
→ COMPOSITE: concreting + transport (signal: "vč.")
{"detectedType":"COMPOSITE","subWorks":[{"index":1,"text":"Betonáž základových konstrukcí z betonu C 25/30","operation":"concreting","keywords":["betonáž","beton","C 25/30","základy","monolitický"]},{"index":2,"text":"Přeprava betonové směsi do 10km","operation":"transport","keywords":["přeprava","doprava betonu","autodomíchávač","betonová směs"]}],"reasoning":"Concrete + transport, 'vč.' signals separate URS code for transport","confidence":"high"}

Input: "Lokální opravy omítek, praskliny - vč. odstranění nesoudržné omítky (pod nátěr) z 5%"
→ COMPOSITE: 4 works hidden (repair + crack fill + removal + surface prep)
{"detectedType":"COMPOSITE","subWorks":[{"index":1,"text":"Oprava vápenné omítky stěn v rozsahu do 10%","operation":"plaster_repair","keywords":["oprava omítky","lokální oprava","omítka stěn","vysprávka"]},{"index":2,"text":"Vyspravení prasklin ve stěnách tmelením","operation":"plaster_repair","keywords":["prasklina","tmelení","vyspravení","trhlina","oprava"]},{"index":3,"text":"Odstranění nesoudržné omítky otlučením","operation":"removal","keywords":["odstranění omítky","otlučení","nesoudržná omítka","bourání omítky"]},{"index":4,"text":"Penetrace podkladu pod nátěr","operation":"surface_preparation","keywords":["penetrace","příprava podkladu","nátěr","základní nátěr","primer"]}],"reasoning":"4 distinct URS codes: plaster repair, crack fill, plaster removal ('vč. odstranění'), surface prep ('pod nátěr'). 'z 5%' is quantity.","confidence":"high"}

Input: "Dodávka a montáž ocelových zábradlí vč. kotvení a nátěru"
→ COMPOSITE: supply + install + anchoring + painting
{"detectedType":"COMPOSITE","subWorks":[{"index":1,"text":"Dodávka ocelového zábradlí","operation":"supply","keywords":["dodávka","zábradlí","ocelové zábradlí","materiál"]},{"index":2,"text":"Montáž ocelového zábradlí","operation":"installation","keywords":["montáž","zábradlí","osazení","ocelová konstrukce"]},{"index":3,"text":"Kotvení ocelového zábradlí chemickými kotvami","operation":"anchoring","keywords":["kotvení","kotvy","chemická kotva","ocelová konstrukce"]},{"index":4,"text":"Antikorozní nátěr ocelového zábradlí","operation":"painting","keywords":["nátěr","antikorozní","barva","ocelová konstrukce","zábradlí"]}],"reasoning":"Supply + installation ('dodávka a montáž'), plus separate anchoring and painting ('vč. kotvení a nátěru')","confidence":"high"}

Input: "Výkop rýhy šíře do 60cm, hl. 0.8m"
→ SINGLE: one operation with dimension qualifiers
{"detectedType":"SINGLE","subWorks":[{"index":1,"text":"Výkop rýhy šířky do 60cm hloubky do 100cm","operation":"excavation","keywords":["výkop","rýha","šířka 60cm","hloubka","hloubení rýhy"]}],"reasoning":"Single excavation with dimension qualifiers (width, depth)","confidence":"high"}

Input: "Zateplení fasády EPS 100mm vč. lepení, hmoždinkování, stěrkování se síťkou a finální omítky"
→ COMPOSITE: 4 operations
{"detectedType":"COMPOSITE","subWorks":[{"index":1,"text":"Zateplení fasády deskami EPS tloušťky 100mm lepením","operation":"insulation","keywords":["zateplení","EPS","fasáda","lepení desek","kontaktní zateplení"]},{"index":2,"text":"Kotvení zateplovacího systému hmoždinkami","operation":"anchoring","keywords":["hmoždinkování","talířové hmoždinky","kotvení zateplení","ETICS"]},{"index":3,"text":"Stěrková hmota se síťovinou na zateplovací systém","operation":"surface_preparation","keywords":["stěrkování","výztužná síťka","armovací vrstva","stěrka ETICS"]},{"index":4,"text":"Finální tenkovrstvá omítka fasády","operation":"plastering","keywords":["omítka fasády","tenkovrstvá omítka","silikátová omítka","fasádní omítka"]}],"reasoning":"ETICS system has 4 distinct URS codes: insulation boards, anchoring, reinforcement mesh layer, and final render. 'vč.' signals each is separate.","confidence":"high"}

Now analyze the input and respond with JSON only.`;
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

/**
 * Parse LLM JSON response
 * @param {string} content - LLM response text
 * @returns {Object} Parsed result
 */
function parseLLMResponse(content) {
  try {
    // Remove markdown code blocks if present
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```\n?/g, '');
    }

    // Parse JSON
    const parsed = JSON.parse(cleaned);

    // Validate structure
    if (!parsed.detectedType) {
      throw new Error('Missing detectedType in LLM response');
    }

    if (!['SINGLE', 'COMPOSITE', 'UNKNOWN'].includes(parsed.detectedType)) {
      logger.warn(`[WorkSplitter] Invalid detectedType: ${parsed.detectedType}, defaulting to UNKNOWN`);
      parsed.detectedType = 'UNKNOWN';
    }

    // Validate subWorks
    if (!parsed.subWorks || !Array.isArray(parsed.subWorks)) {
      logger.warn('[WorkSplitter] Missing or invalid subWorks array');
      parsed.subWorks = [];
    }

    // Ensure each subwork has required fields
    parsed.subWorks = parsed.subWorks.map((sw, i) => ({
      index: sw.index || (i + 1),
      text: sw.text || 'Unknown work',
      operation: sw.operation || 'unknown',
      keywords: Array.isArray(sw.keywords) ? sw.keywords : []
    }));

    // Validate confidence
    if (!parsed.confidence || !['high', 'medium', 'low'].includes(parsed.confidence)) {
      logger.warn(`[WorkSplitter] Invalid confidence: ${parsed.confidence}, defaulting to medium`);
      parsed.confidence = 'medium';
    }

    return parsed;

  } catch (error) {
    logger.error(`[WorkSplitter] JSON parse error: ${error.message}`);
    logger.error(`[WorkSplitter] Raw content: ${content}`);

    // Return UNKNOWN fallback
    return {
      detectedType: 'UNKNOWN',
      subWorks: [],
      reasoning: `Failed to parse LLM response: ${error.message}`,
      confidence: 'low'
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract basic keywords from text (fallback)
 * @param {string} text - Text to extract keywords from
 * @returns {Array<string>} Keywords
 */
function extractKeywords(text) {
  // Remove common words and extract nouns/adjectives
  const stopWords = ['a', 'i', 'v', 'z', 'na', 'do', 'od', 'se', 'k', 'pro', 'o', 'u'];
  const words = text.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.includes(w));

  // Return first 5 unique words
  return [...new Set(words)].slice(0, 5);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  split
};
