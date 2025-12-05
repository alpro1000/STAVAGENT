/**
 * LLM Client Service (Claude / OpenAI / Gemini)
 * Provides re-ranking and explanations for URS item matching
 * MVP-2: Full implementation with error handling and fallback
 */

import axios from 'axios';
import { logger } from '../utils/logger.js';
import { getSystemPrompt, createMatchUrsItemPrompt } from '../prompts/ursMatcher.prompt.js';
import { getLLMConfig, createLLMClient, getAvailableProviders, getFallbackChain } from '../config/llmConfig.js';

// Global LLM client instance (lazy-loaded)
let llmClient = null;
let llmConfig = null;
let availableProviders = null;
let fallbackChain = null;
let currentProviderIndex = 0;

/**
 * Initialize LLM client on first use
 * Sets up primary provider and fallback chain
 */
function initializeLLMClient() {
  if (!llmConfig) {
    llmConfig = getLLMConfig();
    availableProviders = getAvailableProviders();
    fallbackChain = getFallbackChain(llmConfig.provider);

    if (llmConfig.enabled) {
      llmClient = createLLMClient(llmConfig);
      logger.info(`[LLMClient] Initialized with provider: ${llmConfig.provider}, model: ${llmConfig.model}`);
      logger.info(`[LLMClient] Available providers: ${Object.keys(availableProviders).join(', ')}`);
      logger.info(`[LLMClient] Fallback chain: ${fallbackChain.join(' → ')}`);
    } else {
      logger.info('[LLMClient] Primary provider disabled - using fallback mechanism');
    }
  }
}

/**
 * Get next available provider from fallback chain
 * @returns {Object|null} Next provider config or null if none available
 */
function getNextProvider() {
  if (!fallbackChain || currentProviderIndex >= fallbackChain.length) {
    return null;
  }

  const providerName = fallbackChain[currentProviderIndex];
  currentProviderIndex++;

  const provider = availableProviders[providerName];
  if (provider && provider.enabled) {
    return createLLMClient(provider);
  }

  return getNextProvider(); // Try next in chain
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
 * Call LLM API with timeout protection and fallback support
 * Tries primary provider, then falls back to alternatives if needed
 *
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User message
 * @param {number} timeoutMs - Request timeout in milliseconds
 * @returns {Promise<string>} LLM response content
 * @throws {Error} if all providers fail
 */
async function callLLMWithTimeout(systemPrompt, userPrompt, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Try current (primary) client
    if (llmClient) {
      try {
        return await callLLMProvider(llmClient, systemPrompt, userPrompt, controller);
      } catch (error) {
        logger.warn(`[LLMClient] Primary provider ${llmClient.provider} failed: ${error.message}. Trying fallback...`);
      }
    }

    // Try fallback providers
    let nextProvider = getNextProvider();
    while (nextProvider) {
      try {
        logger.info(`[LLMClient] Trying fallback provider: ${nextProvider.provider}`);
        const result = await callLLMProvider(nextProvider, systemPrompt, userPrompt, controller);
        llmClient = nextProvider; // Update to use this provider going forward
        logger.info(`[LLMClient] Switched to ${nextProvider.provider} as primary provider`);
        return result;
      } catch (error) {
        logger.warn(`[LLMClient] Fallback provider ${nextProvider.provider} failed: ${error.message}`);
        nextProvider = getNextProvider();
      }
    }

    throw new Error('All LLM providers failed or unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call specific LLM provider
 * @param {Object} provider - Provider client configuration
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User message
 * @param {AbortController} controller - Abort controller for timeout
 * @returns {Promise<string>} Response from provider
 */
async function callLLMProvider(provider, systemPrompt, userPrompt, controller) {
  if (provider.provider === 'claude') {
    return await callClaudeAPI(systemPrompt, userPrompt, controller);
  } else if (provider.provider === 'gemini') {
    return await callGeminiAPI(systemPrompt, userPrompt, controller);
  } else {
    // OpenAI (default)
    return await callOpenAIAPI(systemPrompt, userPrompt, controller);
  }
}

/**
 * Call Claude API (Anthropic)
 */
async function callClaudeAPI(systemPrompt, userPrompt, controller) {
  try {
    const response = await axios.post(
      llmClient.apiUrl,
      {
        model: llmClient.model,
        max_tokens: 4096,
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
      logger.error('[LLMClient] Invalid Claude API response - no content', {
        status: response.status,
        provider: 'claude',
        model: llmClient.model
      });
      throw new Error('Invalid Claude API response: no content returned');
    }

    return response.data.content[0].text;
  } catch (error) {
    logger.error('[LLMClient] Claude API call failed', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      provider: 'claude',
      model: llmClient.model,
      message: error.message
    });
    throw error;
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAIAPI(systemPrompt, userPrompt, controller) {
  try {
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
        max_tokens: 4096
      },
      {
        headers: llmClient.headers,
        timeout: llmConfig.timeoutMs,
        signal: controller.signal
      }
    );

    if (!response.data || !response.data.choices || response.data.choices.length === 0) {
      logger.error('[LLMClient] Invalid OpenAI API response - no choices', {
        status: response.status,
        provider: 'openai',
        model: llmClient.model
      });
      throw new Error('Invalid OpenAI API response: no choices in response');
    }

    return response.data.choices[0].message.content;
  } catch (error) {
    logger.error('[LLMClient] OpenAI API call failed', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      provider: 'openai',
      model: llmClient.model,
      message: error.message
    });
    throw error;
  }
}

/**
 * Call Google Gemini API
 * Note: API key is sent in x-goog-api-key header for security (not in URL)
 */
async function callGeminiAPI(systemPrompt, userPrompt, controller) {
  // Gemini API endpoint - no key in URL for security
  const apiUrl = `${llmClient.apiUrl}/${llmClient.model}:generateContent`;

  // Create headers with API key in secure header (not URL)
  const headers = {
    ...llmClient.headers,
    'x-goog-api-key': llmClient.apiKey  // Gemini API secure header
  };

  try {
    const response = await axios.post(
      apiUrl,
      {
        system_instruction: {
          parts: {
            text: systemPrompt
          }
        },
        contents: {
          parts: [
            {
              text: userPrompt
            }
          ]
        },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096
        }
      },
      {
        headers: headers,
        timeout: llmConfig.timeoutMs,
        signal: controller.signal
      }
    );

    if (!response.data || !response.data.candidates || response.data.candidates.length === 0) {
      logger.error('[LLMClient] Invalid Gemini API response - no candidates', {
        status: response.status,
        provider: 'gemini',
        model: llmClient.model
      });
      throw new Error('Invalid Gemini API response: no candidates in response');
    }

    const content = response.data.candidates[0].content;
    if (!content || !content.parts || content.parts.length === 0) {
      logger.error('[LLMClient] Invalid Gemini API response - no content', {
        status: response.status,
        provider: 'gemini',
        model: llmClient.model
      });
      throw new Error('No content in Gemini response');
    }

    return content.parts[0].text;
  } catch (error) {
    logger.error('[LLMClient] Gemini API call failed', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      provider: 'gemini',
      model: llmClient.model,
      message: error.message
    });
    throw error;
  }
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

/**
 * Analyze a block of work items with project context
 * MODE: BOQ_BLOCK_ANALYSIS
 *
 * @param {Object} projectContext - Project context (building_type, storeys, main_system, etc.)
 * @param {Object} boqBlock - Block of work items { block_id, title, rows[] }
 * @param {Object} ursCandidates - URS candidates for each row { row_id: [candidates...] }
 * @returns {Promise<Object>} Block analysis result { block_summary, items[], global_related_items[] }
 */
export async function analyzeBlock(projectContext, boqBlock, ursCandidates) {
  try {
    initializeLLMClient();

    // If no LLM available, return empty analysis
    if (!llmClient) {
      logger.warn('[LLMClient] LLM unavailable - cannot perform block analysis');
      return {
        mode: 'boq_block_analysis',
        block_summary: {
          block_id: boqBlock.block_id,
          main_systems: [],
          potential_missing_work_groups: [],
          notes: ['LLM není dostupný - blok nebyl analyzován']
        },
        items: [],
        global_related_items: [],
        error: 'LLM not available'
      };
    }

    logger.info(`[LLMClient] Analyzing block: "${boqBlock.title || boqBlock.block_id}" (${boqBlock.rows?.length || 0} rows)`);

    // Import prompt creator
    const { createBlockAnalysisPrompt } = await import('../prompts/ursMatcher.prompt.js');

    // Create prompts
    const userPrompt = createBlockAnalysisPrompt(projectContext, boqBlock, ursCandidates);
    const systemPrompt = getSystemPrompt();

    // Call LLM API with extended timeout (block analysis takes longer)
    const timeoutMs = llmConfig.timeoutMs * 2; // Double timeout for block analysis
    logger.debug(`[LLMClient] Using extended timeout: ${timeoutMs}ms for block analysis`);

    const response = await callLLMWithTimeout(systemPrompt, userPrompt, timeoutMs);

    // Parse and validate response
    const parsed = parseBlockAnalysisResponse(response);

    if (!parsed || !parsed.items) {
      logger.warn('[LLMClient] LLM returned invalid block analysis - returning empty result');
      return {
        mode: 'boq_block_analysis',
        block_summary: {
          block_id: boqBlock.block_id,
          main_systems: [],
          potential_missing_work_groups: [],
          notes: ['Chyba při analýze bloku - neplatná odpověď z LLM']
        },
        items: [],
        global_related_items: [],
        error: 'Invalid LLM response'
      };
    }

    // Validate that all returned codes exist in candidates (ZERO HALLUCINATION)
    const validatedItems = validateBlockItemsAgainstCandidates(parsed.items, ursCandidates);

    logger.info(`[LLMClient] Block analysis completed: ${validatedItems.length} items validated`);

    return {
      mode: 'boq_block_analysis',
      block_summary: parsed.block_summary || {
        block_id: boqBlock.block_id,
        main_systems: [],
        potential_missing_work_groups: [],
        notes: []
      },
      items: validatedItems,
      global_related_items: parsed.global_related_items || []
    };

  } catch (error) {
    logger.error(`[LLMClient] Error in analyzeBlock: ${error.message}`);

    // Return fallback response
    return {
      mode: 'boq_block_analysis',
      block_summary: {
        block_id: boqBlock?.block_id || 'unknown',
        main_systems: [],
        potential_missing_work_groups: [],
        notes: [`Chyba při analýze: ${error.message}`]
      },
      items: [],
      global_related_items: [],
      error: error.message
    };
  }
}

/**
 * Parse LLM response for BOQ_BLOCK_ANALYSIS mode
 * Extracts JSON from response (may contain extra text)
 * Handles common JSON issues: trailing commas, extra whitespace, etc.
 *
 * @param {string} response - Raw LLM response
 * @returns {Object|null} Parsed response with block_summary, items, global_related_items
 * @private
 */
function parseBlockAnalysisResponse(response) {
  try {
    let jsonString = null;

    // Try to extract JSON using a more robust method
    // Look for opening { and try to find matching closing }
    const openBrace = response.indexOf('{');
    if (openBrace === -1) {
      logger.warn('[LLMClient] No JSON found in block analysis response');
      return null;
    }

    // Start from the first { and try to parse incrementally
    let depth = 0;
    let endBrace = -1;
    for (let i = openBrace; i < response.length; i++) {
      if (response[i] === '{') {
        depth++;
      } else if (response[i] === '}') {
        depth--;
        if (depth === 0) {
          endBrace = i;
          break;
        }
      }
    }

    if (endBrace === -1) {
      logger.warn('[LLMClient] Unclosed JSON object in block analysis response');
      return null;
    }

    jsonString = response.substring(openBrace, endBrace + 1);

    // Clean up common JSON issues
    // Remove trailing commas before ] and }
    jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');
    // Handle single quotes (convert to double quotes if needed)
    // But be careful with apostrophes in text

    let parsed = JSON.parse(jsonString);

    // Validate structure
    if (!parsed.items || !Array.isArray(parsed.items)) {
      logger.warn('[LLMClient] Invalid block analysis response - missing "items" array');
      return null;
    }

    return parsed;

  } catch (error) {
    logger.error(`[LLMClient] Error parsing block analysis response: ${error.message}`);
    logger.debug(`[LLMClient] Response substring (first 500 chars): ${response.substring(0, 500)}`);
    return null;
  }
}

/**
 * Validate that LLM-returned URS codes in block analysis exist in candidates
 * ZERO HALLUCINATION: Ensures LLM didn't invent codes
 *
 * @param {Array} items - Items returned by LLM (with row_id, selected_urs, related_items)
 * @param {Object} ursCandidates - Original candidates per row { row_id: [candidates...] }
 * @returns {Array} Validated items
 * @private
 */
function validateBlockItemsAgainstCandidates(items, ursCandidates) {
  const validated = [];

  for (const item of items) {
    const rowId = item.row_id;
    const selectedUrs = item.selected_urs;
    const relatedItems = item.related_items || [];

    // Get candidates for this row
    const rowCandidates = ursCandidates[rowId] || [];
    const rowCandidateCodes = new Set(rowCandidates.map(c => c.urs_code));

    // Validate selected_urs
    let validatedSelectedUrs = null;
    if (selectedUrs && selectedUrs.urs_code) {
      if (selectedUrs.urs_code === null || rowCandidateCodes.has(selectedUrs.urs_code)) {
        // Valid: either null (LLM couldn't find match) or exists in candidates
        validatedSelectedUrs = selectedUrs;
      } else {
        logger.warn(`[LLMClient] Row ${rowId}: LLM proposed invalid code ${selectedUrs.urs_code} - setting to null`);
        validatedSelectedUrs = {
          urs_code: null,
          urs_name: `Neplatný kód navržený LLM: ${selectedUrs.urs_code}`,
          unit: selectedUrs.unit || 'ks',
          confidence: 0,
          reason: 'LLM navrhl neexistující kód z katalogu'
        };
      }
    }

    // Validate related_items (allow null codes for suggestions)
    const validatedRelatedItems = relatedItems.filter(related => {
      if (related.urs_code === null) {
        // Suggestion without specific code - OK
        return true;
      }
      // Check if code exists in some row's candidates (relaxed validation)
      const exists = Object.values(ursCandidates).some(candidates =>
        candidates.some(c => c.urs_code === related.urs_code)
      );
      if (!exists) {
        logger.warn(`[LLMClient] Row ${rowId}: Invalid related_item code ${related.urs_code} - skipping`);
      }
      return exists;
    });

    validated.push({
      row_id: rowId,
      selected_urs: validatedSelectedUrs,
      related_items: validatedRelatedItems,
      notes: item.notes || []
    });
  }

  return validated;
}
