/**
 * TSKP Parser Service
 * Парсит xmk_tskp_tridnik.xml (Třídník stavebních konstrukcí a prací)
 * и предоставляет методы для поиска кодов работ
 */

import { parseStringPromise } from 'xml2js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';
import { calculateSimilarity } from '../utils/similarity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Путь к TSKP классификатору в concrete-agent
const TSKP_XML_PATH = path.join(
  __dirname,
  '../../../..',
  'concrete-agent/packages/core-backend/app/knowledge_base/B1_otkskp_codes/xmk_tskp_tridnik.xml'
);

class TSKPParserService {
  constructor() {
    this.tskpData = null;
    this.flatIndex = new Map(); // Плоский индекс для быстрого поиска
    this.loaded = false;
  }

  /**
   * Загрузить и распарсить TSKP XML
   */
  async load() {
    if (this.loaded) {
      return;
    }

    try {
      logger.info('[TSKP] Loading TSKP classifier...');

      // Проверить существование файла
      try {
        await fs.access(TSKP_XML_PATH);
      } catch (error) {
        logger.warn(`[TSKP] File not found at: ${TSKP_XML_PATH}`);
        logger.warn('[TSKP] TSKP classifier will not be available');
        this.loaded = true;
        return;
      }

      // Прочитать XML
      const xmlContent = await fs.readFile(TSKP_XML_PATH, 'utf-8');

      // Парсить XML
      const parsed = await parseStringPromise(xmlContent, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true
      });

      this.tskpData = parsed;

      // Построить плоский индекс
      this._buildFlatIndex(parsed.BuildingInformation.Classification.System.Items);

      logger.info(`[TSKP] ✓ Loaded ${this.flatIndex.size} TSKP work items`);
      this.loaded = true;

    } catch (error) {
      logger.error(`[TSKP] Failed to load TSKP classifier: ${error.message}`);
      this.loaded = true; // Mark as loaded to prevent retry loop
    }
  }

  /**
   * Построить плоский индекс для быстрого поиска
   * @private
   */
  _buildFlatIndex(items) {
    const traverse = (item, parent = null) => {
      if (!item) return;

      const itemArray = Array.isArray(item) ? item : [item];

      for (const work of itemArray) {
        if (!work.ID) continue;

        const code = work.ID;
        const name = work.Name || '';
        const description = work.Description || '';

        // Сохранить в индекс
        this.flatIndex.set(code, {
          code,
          name,
          description,
          parent: parent?.code || null,
          searchText: `${code} ${name} ${description}`.toLowerCase()
        });

        // Рекурсивно обработать детей
        if (work.Children && work.Children.Item) {
          traverse(work.Children.Item, { code, name });
        }
      }
    };

    if (items && items.Item) {
      traverse(items.Item);
    }
  }

  /**
   * Найти работы по текстовому описанию
   * @param {string} searchText - Текст для поиска
   * @param {number} limit - Максимум результатов
   * @returns {Array} Массив найденных работ с confidence
   */
  search(searchText, limit = 5) {
    if (!this.loaded || this.flatIndex.size === 0) {
      return [];
    }

    const normalized = searchText.toLowerCase().trim();
    const results = [];

    // Поиск по всем элементам
    for (const [code, work] of this.flatIndex.entries()) {
      const confidence = this._calculateConfidence(normalized, work);

      if (confidence > 0.3) { // Threshold 30%
        results.push({
          tskp_code: code,
          name: work.name,
          description: work.description,
          confidence: confidence,
          parent_code: work.parent
        });
      }
    }

    // Сортировать по confidence
    results.sort((a, b) => b.confidence - a.confidence);

    return results.slice(0, limit);
  }

  /**
   * Рассчитать confidence (схожесть) между запросом и работой
   * @private
   */
  _calculateConfidence(searchText, work) {
    let score = 0;

    // 1. Точное совпадение кода
    if (searchText === work.code.toLowerCase()) {
      return 1.0;
    }

    // 2. Точное совпадение названия
    if (work.searchText.includes(searchText)) {
      score += 0.8;
    }

    // 3. Совпадение по словам
    const searchWords = searchText.split(/\s+/).filter(w => w.length > 2);
    const workWords = work.searchText.split(/\s+/).filter(w => w.length > 2);

    let matchedWords = 0;
    for (const searchWord of searchWords) {
      for (const workWord of workWords) {
        if (workWord.includes(searchWord) || searchWord.includes(workWord)) {
          matchedWords++;
          break;
        }
      }
    }

    if (searchWords.length > 0) {
      score += (matchedWords / searchWords.length) * 0.5;
    }

    // 4. Fuzzy matching (shared Levenshtein from utils/similarity.js)
    const similarity = calculateSimilarity(searchText, work.name.toLowerCase());
    score += similarity * 0.3;

    return Math.min(score, 1.0);
  }

  // NOTE: _simpleSimilarity and _levenshteinDistance replaced by shared utils/similarity.js

  /**
   * Classify a work description to a TSKP section (tree routing).
   * 2-level decision:
   *   Level 1: Match to main category (1-digit code: "1"="Zemní práce", etc.)
   *   Level 2: Match to subcategory within the selected main category (2-3 digit codes)
   *
   * @param {string} text - Work description
   * @returns {Object} Classification result with section path
   */
  classifyToSection(text) {
    if (!this.loaded || this.flatIndex.size === 0) {
      return { sectionCode: null, sectionName: null, sectionPath: [], confidence: 0, bestItem: null };
    }

    const normalized = text.toLowerCase().trim();

    // LEVEL 1: Match to main category (1-digit codes)
    const mainCategories = [];
    for (const [code, work] of this.flatIndex.entries()) {
      if (code.length === 1) {
        const score = this._calculateConfidence(normalized, work);
        mainCategories.push({ code, name: work.name, score });
      }
    }
    mainCategories.sort((a, b) => b.score - a.score);

    if (mainCategories.length === 0 || mainCategories[0].score < 0.1) {
      return { sectionCode: null, sectionName: null, sectionPath: [], confidence: 0, bestItem: null };
    }

    const bestMain = mainCategories[0];

    // LEVEL 2: Search within the selected main category subtree
    const subcategories = [];
    for (const [code, work] of this.flatIndex.entries()) {
      if (code.startsWith(bestMain.code) && code.length >= 2 && code.length <= 4) {
        const score = this._calculateConfidence(normalized, work);
        if (score > 0.2) {
          subcategories.push({ code, name: work.name, score, depth: code.length });
        }
      }
    }
    subcategories.sort((a, b) => b.score - a.score);

    // Build section path from best subcategory
    const bestSub = subcategories[0] || null;
    const sectionPath = [{ code: bestMain.code, name: bestMain.name }];

    if (bestSub) {
      // Add intermediate path elements
      for (let len = 2; len <= bestSub.code.length; len++) {
        const pathCode = bestSub.code.substring(0, len);
        const pathItem = this.flatIndex.get(pathCode);
        if (pathItem) {
          sectionPath.push({ code: pathCode, name: pathItem.name });
        }
      }
    }

    // Find best specific match (deepest level) for the work within this section
    let bestItem = null;
    let bestItemScore = 0;
    for (const [code, work] of this.flatIndex.entries()) {
      if (code.startsWith(bestMain.code) && code.length >= 3) {
        const score = this._calculateConfidence(normalized, work);
        if (score > bestItemScore) {
          bestItemScore = score;
          bestItem = { code, name: work.name, description: work.description, confidence: score };
        }
      }
    }

    const sectionCode = bestSub ? bestSub.code : bestMain.code;
    const sectionName = bestSub ? bestSub.name : bestMain.name;

    return {
      sectionCode,
      sectionName,
      sectionPath,
      confidence: bestSub ? bestSub.score : bestMain.score,
      bestItem,
      mainCategory: { code: bestMain.code, name: bestMain.name, score: bestMain.score },
      alternativeCategories: mainCategories.slice(1, 3).map(c => ({ code: c.code, name: c.name, score: c.score }))
    };
  }

  /**
   * Get the hierarchical tree for a section (all children)
   * @param {string} sectionCode - Section code prefix
   * @param {number} [maxDepth=3] - Max depth from section root
   * @returns {Array} Tree items
   */
  getSectionTree(sectionCode, maxDepth = 3) {
    if (!this.loaded) return [];

    const results = [];
    const baseLen = sectionCode.length;

    for (const [code, work] of this.flatIndex.entries()) {
      if (code.startsWith(sectionCode) && code.length <= baseLen + maxDepth) {
        results.push({
          code,
          name: work.name,
          description: work.description,
          depth: code.length - baseLen,
          parent: work.parent
        });
      }
    }

    return results.sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Получить работу по коду
   * @param {string} code - TSKP код
   * @returns {Object|null} Информация о работе
   */
  getByCode(code) {
    if (!this.loaded) {
      return null;
    }

    return this.flatIndex.get(code) || null;
  }

  /**
   * Получить все работы категории (по префиксу)
   * @param {string} prefix - Префикс кода (например, "1" для земляных работ)
   * @returns {Array} Массив работ
   */
  getByCategory(prefix) {
    if (!this.loaded) {
      return [];
    }

    const results = [];
    for (const [code, work] of this.flatIndex.entries()) {
      if (code.startsWith(prefix)) {
        results.push({
          tskp_code: code,
          name: work.name,
          description: work.description
        });
      }
    }

    return results;
  }

  /**
   * Получить главные категории (уровень 1)
   * @returns {Array} Массив категорий
   */
  getMainCategories() {
    if (!this.loaded) {
      return [];
    }

    const categories = [];
    for (const [code, work] of this.flatIndex.entries()) {
      if (code.length === 1 && !code.startsWith('0')) {
        categories.push({
          tskp_code: code,
          name: work.name,
          description: work.description
        });
      }
    }

    return categories.sort((a, b) => a.tskp_code.localeCompare(b.tskp_code));
  }
}

// Singleton instance
const tskpParserService = new TSKPParserService();

// Auto-load при старте
tskpParserService.load().catch(error => {
  logger.error(`[TSKP] Auto-load failed: ${error.message}`);
});

export default tskpParserService;
