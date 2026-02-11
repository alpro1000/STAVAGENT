/**
 * OTSKP Catalog Service
 * Parses 2025_03_otskp.xml (Cenová soustava OTSKP) and provides search/lookup.
 * 17,904 items with codes, names, units, prices, and technical specifications.
 *
 * Structure: XC4 → CenoveSoustavy → Polozky → Polozka[]
 * Each Polozka: { znacka (code), nazev (name), MJ (unit), jedn_cena (price), technicka_specifikace }
 *
 * @module services/otskpCatalogService
 */

import { parseStringPromise } from 'xml2js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { calculateSimilarity } from '../utils/similarity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to OTSKP catalog in concrete-agent knowledge base
const OTSKP_XML_PATH = path.join(
  __dirname,
  '../../../..',
  'concrete-agent/packages/core-backend/app/knowledge_base/B1_otkskp_codes/2025_03_otskp.xml'
);

class OTSKPCatalogService {
  constructor() {
    this.items = new Map();       // code → item
    this.loaded = false;
    this.loading = null;          // Loading promise for concurrent access
    this.codeIndex = new Map();   // prefix → Set<code> for fast prefix lookup
    this.wordIndex = new Map();   // word → Set<code> for fast text search
  }

  /**
   * Load and parse OTSKP XML catalog
   */
  async load() {
    if (this.loaded) return;
    if (this.loading) return this.loading;

    this.loading = this._doLoad();
    await this.loading;
    this.loading = null;
  }

  async _doLoad() {
    try {
      const startTime = Date.now();
      logger.info('[OTSKP] Loading OTSKP catalog...');

      try {
        await fs.access(OTSKP_XML_PATH);
      } catch {
        logger.warn(`[OTSKP] File not found at: ${OTSKP_XML_PATH}`);
        logger.warn('[OTSKP] OTSKP catalog will not be available');
        this.loaded = true;
        return;
      }

      const xmlContent = await fs.readFile(OTSKP_XML_PATH, 'utf-8');

      const parsed = await parseStringPromise(xmlContent, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true
      });

      // Extract items from XC4 → CenoveSoustavy → Polozky → Polozka
      const polozky = parsed?.XC4?.CenoveSoustavy?.Polozky?.Polozka;

      if (!polozky) {
        logger.error('[OTSKP] Invalid XML structure: no Polozka elements found');
        this.loaded = true;
        return;
      }

      const itemArray = Array.isArray(polozky) ? polozky : [polozky];

      for (const p of itemArray) {
        if (!p.znacka) continue;

        const code = String(p.znacka).trim();
        const name = String(p.nazev || '').trim();
        const unit = String(p.MJ || '').trim();
        const price = parseFloat(p.jedn_cena) || 0;
        const spec = String(p.technicka_specifikace || '').trim();

        const item = {
          code,
          name,
          unit,
          price,
          spec,
          searchText: `${code} ${name}`.toLowerCase(),
          // TSKP section derived from OTSKP code prefix
          tskpPrefix: code.substring(0, 1)
        };

        this.items.set(code, item);

        // Build prefix index (first 1-4 chars for fast category filtering)
        for (let len = 1; len <= Math.min(4, code.length); len++) {
          const prefix = code.substring(0, len);
          if (!this.codeIndex.has(prefix)) {
            this.codeIndex.set(prefix, new Set());
          }
          this.codeIndex.get(prefix).add(code);
        }

        // Build inverted word index for fast text search
        const words = name.toLowerCase().split(/[\s,;]+/).filter(w => w.length > 2);
        for (const word of words) {
          // Use first 4 chars as index key (reduces false positives while keeping speed)
          const key = word.substring(0, 4);
          if (!this.wordIndex.has(key)) {
            this.wordIndex.set(key, new Set());
          }
          this.wordIndex.get(key).add(code);
        }
      }

      const elapsed = Date.now() - startTime;
      logger.info(`[OTSKP] ✓ Loaded ${this.items.size} OTSKP items in ${elapsed}ms`);
      logger.info(`[OTSKP] Word index: ${this.wordIndex.size} keys, Code index: ${this.codeIndex.size} prefixes`);
      this.loaded = true;

    } catch (error) {
      logger.error(`[OTSKP] Failed to load catalog: ${error.message}`);
      this.loaded = true;
    }
  }

  /**
   * Search OTSKP catalog by text description
   * Uses inverted word index for speed, then scores by similarity
   *
   * @param {string} searchText - Description to search for
   * @param {Object} [options] - Search options
   * @param {string} [options.sectionPrefix] - Limit to TSKP section prefix (e.g., "1" for Zemní práce)
   * @param {number} [options.limit=10] - Max results
   * @param {number} [options.minConfidence=0.3] - Minimum confidence threshold
   * @returns {Array<Object>} Scored results
   */
  search(searchText, options = {}) {
    if (!this.loaded || this.items.size === 0) return [];

    const { sectionPrefix = null, limit = 10, minConfidence = 0.3 } = options;
    const normalized = searchText.toLowerCase().trim();
    const searchWords = normalized.split(/[\s,;]+/).filter(w => w.length > 2);

    // Collect candidate codes using word index (fast pre-filter)
    const candidateCodes = new Set();

    for (const word of searchWords) {
      const key = word.substring(0, 4);
      const codes = this.wordIndex.get(key);
      if (codes) {
        for (const code of codes) {
          candidateCodes.add(code);
        }
      }
    }

    // If section prefix specified, also add all codes from that section
    if (sectionPrefix && this.codeIndex.has(sectionPrefix)) {
      for (const code of this.codeIndex.get(sectionPrefix)) {
        candidateCodes.add(code);
      }
    }

    // If no candidates from word index, do full scan (slower but ensures results)
    if (candidateCodes.size === 0) {
      for (const code of this.items.keys()) {
        if (!sectionPrefix || code.startsWith(sectionPrefix)) {
          candidateCodes.add(code);
        }
      }
    }

    // Score candidates
    const results = [];
    for (const code of candidateCodes) {
      const item = this.items.get(code);
      if (!item) continue;

      // Filter by section if specified
      if (sectionPrefix && !code.startsWith(sectionPrefix)) continue;

      const confidence = this._scoreItem(normalized, searchWords, item);
      if (confidence >= minConfidence) {
        results.push({
          code: item.code,
          name: item.name,
          unit: item.unit,
          price: item.price,
          confidence,
          source: 'otskp',
          tskpPrefix: item.tskpPrefix
        });
      }
    }

    results.sort((a, b) => b.confidence - a.confidence);
    return results.slice(0, limit);
  }

  /**
   * Score an item against search text
   * @private
   */
  _scoreItem(normalized, searchWords, item) {
    let score = 0;

    // Exact code match
    if (normalized === item.code.toLowerCase()) return 1.0;

    // Phrase match
    if (item.searchText.includes(normalized)) {
      score += 0.8;
    }

    // Word matching
    const itemWords = item.searchText.split(/[\s,;]+/).filter(w => w.length > 2);
    let matchedWords = 0;
    for (const sw of searchWords) {
      for (const iw of itemWords) {
        if (iw.includes(sw) || sw.includes(iw)) {
          matchedWords++;
          break;
        }
      }
    }

    if (searchWords.length > 0) {
      score += (matchedWords / searchWords.length) * 0.5;
    }

    // Fuzzy similarity on name
    const sim = calculateSimilarity(normalized, item.name.toLowerCase());
    score += sim * 0.3;

    return Math.min(score, 1.0);
  }

  /**
   * Get item by code
   * @param {string} code - OTSKP code
   * @returns {Object|null}
   */
  getByCode(code) {
    if (!this.loaded) return null;
    return this.items.get(code) || null;
  }

  /**
   * Get all items by code prefix (section/category)
   * @param {string} prefix - Code prefix (e.g., "11" for section 11)
   * @param {number} [limit=100] - Max items
   * @returns {Array<Object>}
   */
  getByPrefix(prefix, limit = 100) {
    if (!this.loaded) return [];

    const codes = this.codeIndex.get(prefix);
    if (!codes) return [];

    const results = [];
    for (const code of codes) {
      if (results.length >= limit) break;
      const item = this.items.get(code);
      if (item) {
        results.push({
          code: item.code,
          name: item.name,
          unit: item.unit,
          price: item.price
        });
      }
    }

    return results;
  }

  /**
   * Get catalog statistics
   * @returns {Object}
   */
  getStats() {
    return {
      loaded: this.loaded,
      totalItems: this.items.size,
      wordIndexSize: this.wordIndex.size,
      codeIndexSize: this.codeIndex.size
    };
  }
}

// Singleton instance
const otskpCatalogService = new OTSKPCatalogService();

// Auto-load at startup
otskpCatalogService.load().catch(error => {
  logger.error(`[OTSKP] Auto-load failed: ${error.message}`);
});

export default otskpCatalogService;
