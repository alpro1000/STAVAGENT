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

  } catch (error) {
    logger.error(`[Perplexity] Error searching: ${error.message}`);
    return [];
  }
}

/**
 * Call Perplexity API with timeout protection
 * @param {string} userPrompt - Prompt to send
 * @returns {Promise<string|null>} Response text or null
 */
async function callPerplexityAPI(userPrompt) {
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
