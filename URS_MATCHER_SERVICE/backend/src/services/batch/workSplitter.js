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
import { callLLM } from '../llmClient.js';
import { getModelForTask, getTaskTypes } from '../../config/llmConfig.js';

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

    // Get Gemini model config (cheapest option)
    const modelConfig = getModelForTask(getTaskTypes().KEYWORD_GENERATION);
    logger.info(`[WorkSplitter] Using model: ${modelConfig.provider}/${modelConfig.model}`);

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
      temperature: 0.2  // Low temperature for consistency
    }, modelConfig);
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

  return `You are a construction BOQ (Bill of Quantities) expert analyzing Czech technical descriptions.

**TASK:** Determine if this position contains SINGLE work or COMPOSITE works (multiple works in one description).

**INPUT:**
Text: "${normalizedText}"

Features:
${JSON.stringify(features, null, 2)}

Detected markers:
${JSON.stringify(markers, null, 2)}

**RULES:**
1. SINGLE = one distinct work operation (e.g., "Výkop jámy kat. 3")
2. COMPOSITE = 2-${maxSubWorks} separate works (e.g., "Výkop + odvoz + zásyp")
3. Common composite markers:
   - "včetně" / "vč." (including)
   - "+" (plus)
   - "komplet" (complete/all)
   - "dodávka a montáž" (supply and installation)
   - "demontáž a montáž" (demolition and installation)
   - "se vším" (with everything)
   - Multiple operations: "výkop + odvoz + zásyp + hutnění"

4. If COMPOSITE, split into distinct subworks with:
   - index (1, 2, 3...)
   - text (short description)
   - operation (excavation, transport, backfill, etc.)
   - keywords (3-5 Czech/English keywords for search)

5. Max ${maxSubWorks} subworks - if more, return confidence=low

**OUTPUT FORMAT (JSON only, no markdown):**
{
  "detectedType": "SINGLE" | "COMPOSITE",
  "subWorks": [
    {
      "index": 1,
      "text": "Short Czech description",
      "operation": "excavation|transport|concreting|formwork|reinforcement|etc.",
      "keywords": ["keyword1", "keyword2", "keyword3"]
    }
  ],
  "reasoning": "Short explanation (1-2 sentences in English)",
  "confidence": "high" | "medium" | "low"
}

**EXAMPLES:**

Input: "Výkop stavební jámy kat. 3"
Output:
{
  "detectedType": "SINGLE",
  "subWorks": [{
    "index": 1,
    "text": "Výkop stavební jámy kat. 3",
    "operation": "excavation",
    "keywords": ["výkop", "jáma", "kategorie 3", "excavation", "pit"]
  }],
  "reasoning": "Single excavation work, no composite markers",
  "confidence": "high"
}

Input: "Výkop jámy + odvoz na skládku 10km + zásyp + hutnění"
Output:
{
  "detectedType": "COMPOSITE",
  "subWorks": [
    {
      "index": 1,
      "text": "Výkop jámy",
      "operation": "excavation",
      "keywords": ["výkop", "jáma", "excavation", "pit"]
    },
    {
      "index": 2,
      "text": "Odvoz na skládku",
      "operation": "transport",
      "keywords": ["odvoz", "transport", "doprava", "skládka", "removal"]
    },
    {
      "index": 3,
      "text": "Zásyp jámy",
      "operation": "backfill",
      "keywords": ["zásyp", "backfill", "zasypání"]
    },
    {
      "index": 4,
      "text": "Hutnění zásypu",
      "operation": "compaction",
      "keywords": ["hutnění", "compaction", "zhutňování"]
    }
  ],
  "reasoning": "Four distinct operations connected by '+' marker",
  "confidence": "high"
}

Input: "Beton C 25/30 vč. doprava do 10km"
Output:
{
  "detectedType": "COMPOSITE",
  "subWorks": [
    {
      "index": 1,
      "text": "Betonáž C 25/30",
      "operation": "concreting",
      "keywords": ["beton", "C 25/30", "betonáž", "concrete"]
    },
    {
      "index": 2,
      "text": "Doprava betonu do 10km",
      "operation": "transport",
      "keywords": ["doprava", "transport", "delivery", "beton"]
    }
  ],
  "reasoning": "Concrete work + transport indicated by 'vč. doprava'",
  "confidence": "high"
}

Now analyze the input above and respond with JSON only.`;
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
