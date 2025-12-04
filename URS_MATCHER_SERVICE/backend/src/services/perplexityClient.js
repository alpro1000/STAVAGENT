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
