/**
 * Brave Search Client
 * Searches for ÚRS codes on podminky.urs.cz using Brave Search API
 * Acts as fallback/supplement to Perplexity for URS catalog lookup
 *
 * Architecture:
 *   1. Brave Search → site:podminky.urs.cz query
 *   2. Parse search results → extract URS codes from titles/snippets/URLs
 *   3. Return structured candidates (same format as perplexityClient)
 *
 * @module services/braveSearchClient
 */

import { logger } from '../utils/logger.js';
import { BRAVE_SEARCH_CONFIG } from '../config/llmConfig.js';

// ============================================================================
// BRAVE SEARCH FOR URS CODES
// ============================================================================

/**
 * Search for URS codes on podminky.urs.cz using Brave Search API
 * @param {string} inputText - Description of construction work
 * @returns {Promise<Array>} Array of candidate items (same format as perplexityClient)
 */
export async function searchUrsSiteViaBrave(inputText) {
  try {
    if (!BRAVE_SEARCH_CONFIG.enabled) {
      logger.debug('[BraveSearch] API not enabled (BRAVE_API_KEY missing)');
      return [];
    }

    if (!inputText || inputText.trim().length === 0) {
      logger.warn('[BraveSearch] Empty input text');
      return [];
    }

    logger.info(`[BraveSearch] Searching URS for: "${inputText.substring(0, 60)}..."`);

    // Build search query restricted to podminky.urs.cz
    const query = `site:podminky.urs.cz ${inputText}`;

    const candidates = await callBraveSearchAPI(query);

    logger.info(`[BraveSearch] Found ${candidates.length} candidates for: "${inputText.substring(0, 40)}..."`);

    return candidates;

  } catch (error) {
    logger.error(`[BraveSearch] Error: ${error.message}`);
    return [];
  }
}

// ============================================================================
// BRAVE API CALL
// ============================================================================

/**
 * Call Brave Search API
 * @param {string} query - Search query (already includes site: restriction)
 * @returns {Promise<Array>} Parsed candidate items
 */
async function callBraveSearchAPI(query) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BRAVE_SEARCH_CONFIG.timeoutMs);

    const url = new URL(BRAVE_SEARCH_CONFIG.apiUrl);
    url.searchParams.set('q', query);
    url.searchParams.set('count', '10');
    url.searchParams.set('search_lang', 'cs');
    url.searchParams.set('country', 'cz');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_SEARCH_CONFIG.apiKey
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch (e) {
        errorBody = '(could not read error body)';
      }
      logger.error(`[BraveSearch] HTTP ${response.status}: ${response.statusText}`);
      logger.error(`[BraveSearch] Error body: ${errorBody.substring(0, 500)}`);
      return [];
    }

    const data = await response.json();

    // Parse web results into URS candidates
    const webResults = data.web?.results || [];
    logger.info(`[BraveSearch] Got ${webResults.length} web results`);

    const candidates = [];

    for (const result of webResults) {
      const parsed = parseSearchResult(result);
      if (parsed) {
        candidates.push(parsed);
      }
    }

    return candidates;

  } catch (error) {
    if (error.name === 'AbortError') {
      logger.error(`[BraveSearch] Request timeout after ${BRAVE_SEARCH_CONFIG.timeoutMs}ms`);
    } else {
      logger.error(`[BraveSearch] API call error: ${error.message}`);
    }
    return [];
  }
}

// ============================================================================
// RESULT PARSING
// ============================================================================

/**
 * Parse a Brave search result into a URS candidate
 * Extracts URS code from URL, title, or description
 *
 * URL patterns on podminky.urs.cz:
 *   https://podminky.urs.cz/item/CS_URS_2024_01/801321111
 *   https://podminky.urs.cz/item/CS_URS_2023_01/631311131
 *
 * @param {Object} result - Brave search result { title, url, description }
 * @returns {Object|null} Candidate or null if no URS code found
 */
function parseSearchResult(result) {
  const { title, url, description } = result;

  if (!url || !url.includes('podminky.urs.cz')) {
    return null;
  }

  // Try to extract URS code from URL
  // Pattern: /item/CS_URS_XXXX_XX/XXXXXXXXX
  const urlCodeMatch = url.match(/\/item\/[^/]+\/(\d{6,9})/);

  // Try to extract from title (often "123456789 - Popis práce")
  const titleCodeMatch = title ? title.match(/^(\d{6,9})\s*[-–—:]?\s*(.+)/) : null;

  // Try to extract from description
  const descCodeMatch = description ? description.match(/(\d{6,9})\s*[-–—:]?\s*/) : null;

  // Determine the code (prefer URL > title > description)
  let code = null;
  let name = '';

  if (urlCodeMatch) {
    code = urlCodeMatch[1];
  } else if (titleCodeMatch) {
    code = titleCodeMatch[1];
  } else if (descCodeMatch) {
    code = descCodeMatch[1];
  }

  if (!code) {
    // No URS code found in this result - skip
    logger.debug(`[BraveSearch] No URS code in result: ${url}`);
    return null;
  }

  // Extract name from title
  if (titleCodeMatch && titleCodeMatch[2]) {
    name = titleCodeMatch[2].trim();
  } else if (title) {
    // Remove common suffixes like "| Podmínky ÚRS"
    name = title.replace(/\s*[|]\s*(Podmínky|ÚRS|URS).*/i, '').trim();
    // Remove code if at start
    name = name.replace(new RegExp(`^${code}\\s*[-–—:]?\\s*`), '').trim();
  }

  // Try to extract unit from description
  const unitMatch = description ? description.match(/\b(m[23]?|kg|t|ks|kus|hod|km|bm)\b/i) : null;
  const unit = unitMatch ? unitMatch[1].toLowerCase() : null;

  return {
    code: code,
    name: name || `URS ${code}`,
    unit: unit,
    url: url,
    confidence: 0.6, // Lower confidence than Perplexity (raw search vs AI extraction)
    reason: `Found via Brave Search on podminky.urs.cz`,
    source: 'brave_search'
  };
}

/**
 * Validate URS code format
 * @param {string} code - Code to validate
 * @returns {boolean}
 */
export function isValidUrsCode(code) {
  if (!code || typeof code !== 'string') return false;
  return /^\d{6,9}$/.test(code.trim());
}

export default {
  searchUrsSiteViaBrave,
  isValidUrsCode
};
