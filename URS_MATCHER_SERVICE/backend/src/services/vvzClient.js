/**
 * VVZ (Věstník veřejných zakázek) API Client
 *
 * Fetches public procurement metadata from vvz.nipez.cz.
 * Primary use: CPV classification for work packages.
 *
 * API: https://api.vvz.nipez.cz/api/submissions/search
 * No authentication required. Rate limit: ~5 req/sec (be polite).
 */

import { logger } from '../utils/logger.js';

const API_BASE = 'https://api.vvz.nipez.cz/api/submissions';
const REQUEST_TIMEOUT_MS = 20_000;
const RATE_LIMIT_MS = 250; // 4 req/sec — conservative
const MAX_RETRIES = 3;

// CPV subcategories for construction work (45*)
export const CPV_CONSTRUCTION = {
  '45':    'Stavební práce (vše)',
  '4521':  'Pozemní stavby',
  '4522':  'Inženýrské stavby (mosty, silnice)',
  '4523':  'Stavby pro průmysl (kanalizace, vodní stavby)',
  '4524':  'Vodní stavby',
  '4525':  'Průmyslové stavby (energetika, těžba)',
  '4531':  'Elektroinstalace',
  '4532':  'Izolační práce (ETICS)',
  '4533':  'Instalatérské práce (ZTI, VZT, ÚT)',
  '4541':  'Omítkářské práce',
  '4542':  'Truhlářské práce (okna, dveře)',
  '4543':  'Obkládání podlah a stěn',
  '4544':  'Malířské a natěračské práce',
  '4545':  'Ostatní stavební dokončovací práce',
};

// Form types (druhFormulare)
export const FORM_TYPES = {
  ANNOUNCEMENT: '16',   // Oznámení o zakázce
  RESULT: '29',         // Oznámení o výsledku (has dodavatel + final price)
  CORRECTION: '14',     // Opravný formulář
};

class VvzClient {
  constructor() {
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
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  // ========================================================================
  // HTTP
  // ========================================================================

  async _fetch(url, retries = 0) {
    await this._waitForRateLimit();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      logger.debug(`[VVZ] GET ${url.substring(0, 150)}`);
      this.requestCount++;

      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'StavAgent/1.0 (construction cost analysis)',
        },
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${text.substring(0, 200)}`);
      }

      return resp.json();
    } catch (err) {
      clearTimeout(timeout);
      this.errorCount++;

      if (retries < MAX_RETRIES && (err.name === 'AbortError' || err.message.includes('fetch failed'))) {
        const backoff = (retries + 1) * 2000;
        logger.warn(`[VVZ] Retry ${retries + 1}/${MAX_RETRIES} after ${backoff}ms: ${err.message}`);
        await new Promise(r => setTimeout(r, backoff));
        return this._fetch(url, retries + 1);
      }

      throw err;
    }
  }

  // ========================================================================
  // Search VZ
  // ========================================================================

  /**
   * Search construction VZ by CPV code.
   *
   * @param {Object} opts
   * @param {string} opts.cpv - CPV prefix (default: '45' = all construction)
   * @param {string} opts.formType - Form type: 'announcement' | 'result' (default: 'result')
   * @param {number} opts.page - Page number (1-based)
   * @param {number} opts.limit - Results per page (default: 100, max 500)
   * @returns {Promise<{items: Array, total: number, page: number}>}
   */
  async search({ cpv = '45', formType = 'result', page = 1, limit = 100 } = {}) {
    const druhFormulare = formType === 'result' ? FORM_TYPES.RESULT
      : formType === 'announcement' ? FORM_TYPES.ANNOUNCEMENT
      : FORM_TYPES.RESULT;

    const params = new URLSearchParams({
      'formGroup': 'vz',
      'form': 'vz',
      'workflowPlace': 'UVEREJNENO_VVZ',
      'data.cpvVzACasti': cpv,
      'data.druhFormulare': druhFormulare,
      'page': String(page),
      'limit': String(Math.min(limit, 500)),
      'order[data.datumUverejneniVvz]': 'DESC',
    });

    const url = `${API_BASE}/search?${params}`;
    const data = await this._fetch(url);

    // Parse response — may be array or object with items
    const items = Array.isArray(data) ? data : (data.items || data.results || []);
    const total = data.total || data.totalCount || items.length;

    return {
      items: items.map(item => this._normalizeVzItem(item)),
      total,
      page,
    };
  }

  /**
   * Search with automatic pagination.
   *
   * @param {Object} opts - Same as search()
   * @param {number} opts.maxPages - Max pages to fetch (default: 10)
   * @param {function} opts.onPage - Callback(page, items, total)
   * @returns {Promise<Array>}
   */
  async searchAll({ cpv = '45', formType = 'result', maxPages = 10, limit = 100, onPage = null } = {}) {
    const allItems = [];
    let page = 1;
    let total = Infinity;

    while (page <= maxPages && allItems.length < total) {
      const result = await this.search({ cpv, formType, page, limit });
      total = result.total || 0;

      if (!result.items.length) break;

      allItems.push(...result.items);
      if (onPage) onPage(page, result.items, total);

      logger.info(`[VVZ] Page ${page}: ${result.items.length} items (${allItems.length}/${total})`);
      page++;
    }

    return allItems;
  }

  /**
   * Get detail of a specific VZ by ID.
   */
  async getDetail(id) {
    return this._fetch(`${API_BASE}/${encodeURIComponent(id)}`);
  }

  // ========================================================================
  // Normalize VZ item
  // ========================================================================

  _normalizeVzItem(item) {
    const data = item.data || item;
    const zadavatele = data.zadavatele || [];
    const dodavatele = data.dodavatele || [];

    return {
      id: item.id || null,
      variableId: item.variableId || null,
      evCislo: data.evCisloZakazkyVvz || null,
      nazev: data.nazevZakazky || null,
      druhFormulare: data.druhFormulare || null,
      cpv: this._extractCpv(data),
      zadavatel: zadavatele[0] ? {
        ico: zadavatele[0].ico || null,
        nazev: zadavatele[0].nazev || null,
      } : null,
      dodavatel: dodavatele[0] ? {
        ico: dodavatele[0].ico || null,
        nazev: dodavatele[0].nazev || null,
      } : null,
      datumUverejneni: data.datumUverejneniVvz || null,
      lhutaNabidky: data.lhutaNabidkyZadosti || null,
      predpokladanaCena: data.predpokladanaHodnota || null,
      konecnaCena: data.konecnaCena || data.celkovaCena || null,
    };
  }

  _extractCpv(data) {
    // Try various locations where CPV might be
    if (data.cpvKod) return data.cpvKod;
    if (data.cpvVzACasti) return String(data.cpvVzACasti);
    if (data.hlavniCpv) return data.hlavniCpv;
    // Check in parts/lots
    if (data.casti && Array.isArray(data.casti)) {
      for (const cast of data.casti) {
        if (cast.cpvKod) return cast.cpvKod;
      }
    }
    return null;
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

export default VvzClient;
