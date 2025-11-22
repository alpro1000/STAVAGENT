/**
 * LLM Client Service (Claude / OpenAI)
 * Provides re-ranking and explanations for URS item matching
 * MVP-2: Full implementation with error handling and fallback
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';
import { getSystemPrompt, createMatchUrsItemPrompt } from '../prompts/ursMatcher.prompt.js';
import { getLLMConfig, createLLMClient } from '../config/llmConfig.js';

// Global LLM client instance (lazy-loaded)
let llmClient = null;
let llmConfig = null;

/**
 * Initialize LLM client on first use
 */
function initializeLLMClient() {
  if (!llmConfig) {
    llmConfig = getLLMConfig();
    if (llmConfig.enabled) {
      llmClient = createLLMClient(llmConfig);
      logger.info(`[LLMClient] Initialized with provider: ${llmConfig.provider}, model: ${llmConfig.model}`);
    } else {
      logger.info('[LLMClient] LLM disabled - using fallback mode for all operations');
    }
  }
}

/**
 * Match URS items using LLM re-ranking
 * ZERO HALLUCINATION: LLM can ONLY choose from provided candidates
 *
 * @param {string} inputText - Work description (e.g., "Podkladní beton C25/30 tl. 100 mm")
 * @param {number} quantity - Quantity
 * @param {string} unit - Unit (m3, m2, ks, t, etc.)
 * @param {Array<Object>} candidates - URS candidates to rank
 *   Each: { urs_code, urs_name, unit, description }
 * @returns {Promise<Array>} Re-ranked candidates with confidence scores
 */
export async function matchUrsItemWithAI(inputText, quantity, unit, candidates) {
  try {
    initializeLLMClient();

    // If no LLM available or no candidates, return candidates as-is
    if (!llmClient || !candidates || candidates.length === 0) {
      logger.debug('[LLMClient] LLM unavailable or no candidates - returning unchanged');
      return candidates;
    }

    logger.info(`[LLMClient] Re-ranking ${candidates.length} candidates for: "${inputText.substring(0, 50)}..."`);

    // Create prompt for MATCH_URS_ITEM mode
    const userPrompt = createMatchUrsItemPrompt(inputText, quantity, unit, candidates);
    const systemPrompt = getSystemPrompt();

    // Call LLM API with timeout
    const response = await callLLMWithTimeout(systemPrompt, userPrompt, llmConfig.timeoutMs);

    // Parse and validate response
    const parsed = parseMatchResponse(response);

    if (!parsed || !parsed.matches || parsed.matches.length === 0) {
      logger.warn('[LLMClient] LLM returned empty matches - falling back to candidates');
      return candidates;
    }

    // Ensure ZERO HALLUCINATION: validate all returned codes exist in candidates
    const validMatches = validateMatchesAgainstCandidates(parsed.matches, candidates);

    if (validMatches.length === 0) {
      logger.warn('[LLMClient] LLM proposed invalid codes - falling back to candidates');
      return candidates;
    }

    logger.info(`[LLMClient] Successfully re-ranked ${validMatches.length} matches`);
    return validMatches;

  } catch (error) {
    logger.error(`[LLMClient] Error in matchUrsItemWithAI: ${error.message}`);
    // Fallback: return original candidates unchanged
    logger.info('[LLMClient] Falling back to original candidates');
    return candidates;
  }
}

/**
 * Explain why a specific URS item was chosen
 * Used to generate user-friendly explanations in responses
 *
 * @param {string} inputText - Original work description
 * @param {Object} chosenItem - Selected URS item { urs_code, urs_name, unit, description }
 * @returns {Promise<Object>} Explanation object { reason, confidence }
 */
export async function explainMapping(inputText, chosenItem) {
  try {
    initializeLLMClient();

    // If no LLM or invalid input, return basic explanation
    if (!llmClient || !chosenItem || !chosenItem.urs_code) {
      logger.debug('[LLMClient] LLM unavailable or invalid input - returning generic explanation');
      return {
        reason: `Vybrán kód ÚRS ${chosenItem?.urs_code || 'N/A'}: ${chosenItem?.urs_name || 'Neznámá práce'}`,
        confidence: 0.5,
        source: 'fallback'
      };
    }

    logger.debug(`[LLMClient] Generating explanation for: ${chosenItem.urs_code}`);

    // Create a simple prompt for explanation
    const explanationPrompt = `Vytvořit krátké (1-2 věty) odůvodnění, proč je následující ÚRS kód nejlepší volbou pro vstupní text.

Vstupní text: "${inputText}"

Vybraný kód ÚRS:
- Kód: ${chosenItem.urs_code}
- Název: ${chosenItem.urs_name}
- Jednotka: ${chosenItem.unit}
- Popis: ${chosenItem.description || 'N/A'}

Vrať POUZE odůvodnění, bez jakéhokoli JSON či dalšího textu.`;

    const systemPrompt = getSystemPrompt();

    // Call LLM with timeout
    const response = await callLLMWithTimeout(systemPrompt, explanationPrompt, llmConfig.timeoutMs);
    const reason = response.trim();

    logger.debug('[LLMClient] Generated explanation successfully');

    return {
      reason: reason,
      confidence: 0.85,
      source: 'llm'
    };

  } catch (error) {
    logger.error(`[LLMClient] Error in explainMapping: ${error.message}`);
    // Fallback explanation
    return {
      reason: `Vybrán kód ÚRS ${chosenItem?.urs_code || 'N/A'}: ${chosenItem?.urs_name || 'Neznámá práce'}. Vysvětlení vygenerované LLM není dostupné.`,
      confidence: 0.3,
      source: 'fallback'
    };
  }
}

/**
 * Call LLM API with timeout protection
 * Supports both Claude and OpenAI APIs
 *
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User message
 * @param {number} timeoutMs - Request timeout in milliseconds
 * @returns {Promise<string>} LLM response content
 * @throws {Error} on timeout or API error
 */
async function callLLMWithTimeout(systemPrompt, userPrompt, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (llmClient.provider === 'claude') {
      return await callClaudeAPI(systemPrompt, userPrompt, controller);
    } else {
      // OpenAI
      return await callOpenAIAPI(systemPrompt, userPrompt, controller);
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call Claude API (Anthropic)
 */
async function callClaudeAPI(systemPrompt, userPrompt, controller) {
  const response = await axios.post(
    llmClient.apiUrl,
    {
      model: llmClient.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ]
    },
    {
      headers: llmClient.headers,
      timeout: llmConfig.timeoutMs,
      signal: controller.signal
    }
  );

  if (!response.data || !response.data.content || response.data.content.length === 0) {
    throw new Error('Invalid Claude API response');
  }

  return response.data.content[0].text;
}

/**
 * Call OpenAI API
 */
async function callOpenAIAPI(systemPrompt, userPrompt, controller) {
  const response = await axios.post(
    llmClient.apiUrl,
    {
      model: llmClient.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.3,  // Lower temperature for more deterministic responses
      max_tokens: 1024
    },
    {
      headers: llmClient.headers,
      timeout: llmConfig.timeoutMs,
      signal: controller.signal
    }
  );

  if (!response.data || !response.data.choices || response.data.choices.length === 0) {
    throw new Error('Invalid OpenAI API response');
  }

  return response.data.choices[0].message.content;
}

/**
 * Parse LLM response for MATCH_URS_ITEM mode
 * Extracts JSON from response (may contain extra text)
 *
 * @param {string} response - Raw LLM response
 * @returns {Object|null} Parsed response with 'matches' array
 */
function parseMatchResponse(response) {
  try {
    // Try to find JSON block in response (in case of extra text)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('[LLMClient] No JSON found in LLM response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!Array.isArray(parsed.matches)) {
      logger.warn('[LLMClient] Invalid response structure - missing "matches" array');
      return null;
    }

    return parsed;

  } catch (error) {
    logger.error(`[LLMClient] Error parsing LLM response: ${error.message}`);
    return null;
  }
}

/**
 * Validate that LLM-returned matches exist in candidates
 * ZERO HALLUCINATION: Ensures LLM didn't invent codes
 *
 * @param {Array} llmMatches - Matches returned by LLM
 * @param {Array} candidates - Original candidates
 * @returns {Array} Validated matches
 */
function validateMatchesAgainstCandidates(llmMatches, candidates) {
  const candidateCodes = new Set(candidates.map(c => c.urs_code));
  const validated = [];

  for (const match of llmMatches) {
    if (candidateCodes.has(match.code)) {
      // Find original candidate to preserve all fields
      const original = candidates.find(c => c.urs_code === match.code);
      validated.push({
        urs_code: match.code,
        urs_name: match.name || original.urs_name,
        unit: match.unit || original.unit,
        description: original.description,
        confidence: match.confidence,
        match_type: match.match_type,
        reason: match.reason
      });
    } else {
      logger.warn(`[LLMClient] LLM proposed invalid code: ${match.code} - skipping`);
    }
  }

  return validated;
}

/**
 * Check if LLM is currently enabled
 * @returns {boolean}
 */
export function isLLMEnabled() {
  initializeLLMClient();
  return llmClient !== null && llmConfig.enabled;
}

/**
 * Get current LLM configuration (for testing/debugging)
 * @returns {Object}
 */
export function getLLMInfo() {
  initializeLLMClient();
  return {
    enabled: llmConfig.enabled,
    provider: llmConfig.provider,
    model: llmConfig.model,
    timeoutMs: llmConfig.timeoutMs
  };
}
