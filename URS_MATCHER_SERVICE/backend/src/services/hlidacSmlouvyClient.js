/**
 * Hlídač státu — Smlouvy API Client
 *
 * Fetches public procurement contracts from hlidacstatu.cz
 * Primary data source for Work Packages DB (co-occurrence analysis).
 *
 * API docs: https://www.hlidacstatu.cz/api/v2/swagger
 * License: CC BY 3.0 CZ — must attribute "Zdroj: Hlídač státu (hlidacstatu.cz)"
 *
 * Rate limit: 1 request per 10 seconds (enforced client-side)
 */

import { logger } from '../utils/logger.js';

const API_BASE = 'https://api.hlidacstatu.cz/api/v2';
const RATE_LIMIT_MS = 10_500; // 10.5s between requests (safe margin)
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [2000, 5000, 15000];

class HlidacSmlouvyClient {
  constructor(apiToken) {
    this.apiToken = apiToken || process.env.HLIDAC_API_TOKEN;
    this.lastRequestTime = 0;
    this.requestCount = 0;
    this.errorCount = 0;
  }

  // ========================================================================
  // Rate limiting
  // ========================================================================

  async _waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < RATE_LIMIT_MS) {
      const wait = RATE_LIMIT_MS - elapsed;
      logger.debug(`[HLIDAC] Rate limit: waiting ${wait}ms`);
      await new Promise(r => setTimeout(r, wait));
    }
    this.lastRequestTime = Date.now();
  }

  // ========================================================================
  // HTTP
  // ========================================================================

  async _fetch(path, retries = 0) {
    await this._waitForRateLimit();

    const url = `${API_BASE}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      logger.info(`[HLIDAC] GET ${url.substring(0, 150)}`);
      this.requestCount++;

      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Authorization': `Token ${this.apiToken}`,
          'Accept': 'application/json',
          'User-Agent': 'StavAgent/1.0 (construction cost analysis)',
        },
      });
      clearTimeout(timeout);

      if (resp.status === 429) {
        // Rate limited — back off heavily
        logger.warn(`[HLIDAC] 429 Rate Limited. Backing off 30s...`);
        await new Promise(r => setTimeout(r, 30_000));
        if (retries < MAX_RETRIES) return this._fetch(path, retries + 1);
        throw new Error('Rate limited after retries');
      }

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${text.substring(0, 300)}`);
      }

      return resp.json();
    } catch (err) {
      clearTimeout(timeout);
      this.errorCount++;

      if (err.name === 'AbortError') {
        err.message = `Request timeout (${REQUEST_TIMEOUT_MS}ms): ${url}`;
      }

      if (retries < MAX_RETRIES && (err.name === 'AbortError' || err.message.includes('fetch failed'))) {
        const backoff = RETRY_BACKOFF_MS[retries] || 15000;
        logger.warn(`[HLIDAC] Retry ${retries + 1}/${MAX_RETRIES} after ${backoff}ms: ${err.message}`);
        await new Promise(r => setTimeout(r, backoff));
        return this._fetch(path, retries + 1);
      }

      throw err;
    }
  }

  // ========================================================================
  // Search smlouvy
  // ========================================================================

  /**
   * Search smlouvy by query string.
   * @param {string} query - Search query (e.g. "KRYCÍ LIST SOUPISU")
   * @param {number} page - Page number (1-based)
   * @param {number} sort - Sort order (0=relevance, 1=date desc, 2=date asc, 3=price desc, 4=price asc)
   * @returns {Promise<{Total: number, Page: number, Results: Array}>}
   */
  async search(query, page = 1, sort = 0) {
    const encoded = encodeURIComponent(query);
    return this._fetch(`/smlouvy/hledat?dotaz=${encoded}&strana=${page}&razeni=${sort}`);
  }

  /**
   * Get smlouva detail by ID (includes přílohy with PlainTextContent).
   * @param {string} id - Smlouva ID
   * @returns {Promise<Object>}
   */
  async getDetail(id) {
    return this._fetch(`/smlouvy/${encodeURIComponent(id)}`);
  }

  /**
   * Search with automatic pagination. Yields results page by page.
   * @param {string} query
   * @param {object} opts
   * @param {number} opts.maxPages - Max pages to fetch (default: 10)
   * @param {function} opts.onPage - Callback(page, results) after each page
   * @returns {Promise<Array>} All results
   */
  async searchAll(query, { maxPages = 10, onPage = null } = {}) {
    const allResults = [];
    let page = 1;
    let total = Infinity;

    while (page <= maxPages && allResults.length < total) {
      const data = await this.search(query, page);
      total = data.Total || 0;

      if (!data.Results?.length) break;

      allResults.push(...data.Results);
      if (onPage) onPage(page, data.Results, total);

      logger.info(`[HLIDAC] Page ${page}: ${data.Results.length} results (${allResults.length}/${total} total)`);
      page++;
    }

    return allResults;
  }

  // ========================================================================
  // Stats
  // ========================================================================

  getStats() {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      lastRequestTime: this.lastRequestTime
        ? new Date(this.lastRequestTime).toISOString()
        : null,
    };
  }
}

export default HlidacSmlouvyClient;
