/**
 * Price Database
 * Хранение цен, коммерческих предложений и истории
 *
 * Структура:
 * - prices/ - текущие цены по категориям
 * - offers/ - коммерческие предложения (привязаны к проектам)
 * - history/ - история изменения цен
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { DEFAULT_PRICES, MATERIAL_CATEGORIES } from './priceSources.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_CONFIG = {
  basePath: process.env.PRICE_DB_PATH || './data/prices',
  maxHistoryMonths: 24,  // Хранить историю за 2 года
  cacheExpireMs: 300000  // 5 минут кэш
};

// In-memory cache
const cache = {
  prices: new Map(),
  offers: new Map(),
  lastUpdate: null
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize price database
 */
export async function initPriceDatabase() {
  const dirs = [
    'prices/beton',
    'prices/armatura',
    'prices/zdivo',
    'prices/izolace',
    'prices/technika',
    'offers',
    'history'
  ];

  try {
    for (const dir of dirs) {
      await fs.mkdir(path.join(DB_CONFIG.basePath, dir), { recursive: true });
    }
    logger.info(`[PriceDB] Initialized at ${DB_CONFIG.basePath}`);
    return true;
  } catch (error) {
    logger.error(`[PriceDB] Init error: ${error.message}`);
    return false;
  }
}

// ============================================================================
// PRICE OPERATIONS
// ============================================================================

/**
 * Save price entry
 *
 * @param {Object} priceEntry - Price data
 * @returns {Promise<boolean>}
 */
export async function savePrice(priceEntry) {
  try {
    const entry = {
      id: generatePriceId(priceEntry),
      ...priceEntry,
      createdAt: priceEntry.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const category = priceEntry.category || 'other';
    const fileName = `${entry.id}.json`;
    const filePath = path.join(DB_CONFIG.basePath, 'prices', category, fileName);

    await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8');

    // Update cache
    cache.prices.set(entry.id, entry);

    // Add to history
    await addToHistory(entry);

    logger.debug(`[PriceDB] Saved price: ${entry.id}`);
    return true;

  } catch (error) {
    logger.error(`[PriceDB] Save price error: ${error.message}`);
    return false;
  }
}

/**
 * Get price by material code
 *
 * @param {string} category - Category (beton, armatura, etc.)
 * @param {string} materialCode - Material code
 * @param {Object} options - Options (region, date, projectId)
 * @returns {Promise<Object|null>}
 */
export async function getPrice(category, materialCode, options = {}) {
  const { region, projectId, useDefault = true } = options;

  // 1. Try project-specific offer first
  if (projectId) {
    const offer = await getOfferPrice(projectId, category, materialCode);
    if (offer) {
      return {
        ...offer,
        source: 'commercial_offer',
        priority: 1
      };
    }
  }

  // 2. Try cached current prices
  const cacheKey = `${category}:${materialCode}:${region || 'default'}`;
  if (cache.prices.has(cacheKey)) {
    const cached = cache.prices.get(cacheKey);
    if (Date.now() - cached.timestamp < DB_CONFIG.cacheExpireMs) {
      return { ...cached.data, source: 'cache', priority: 2 };
    }
  }

  // 3. Try database
  const dbPrice = await loadPriceFromDb(category, materialCode, region);
  if (dbPrice) {
    cache.prices.set(cacheKey, { data: dbPrice, timestamp: Date.now() });
    return { ...dbPrice, source: 'database', priority: 3 };
  }

  // 4. Fallback to default prices (experience)
  if (useDefault) {
    const defaultPrice = getDefaultPrice(category, materialCode);
    if (defaultPrice) {
      return {
        ...defaultPrice,
        materialCode,
        category,
        source: 'default_experience',
        priority: 4,
        warning: 'Orientační cena z praxe, doporučujeme ověřit aktuální nabídku'
      };
    }
  }

  return null;
}

/**
 * Get default price from experience
 */
function getDefaultPrice(category, materialCode) {
  const categoryPrices = DEFAULT_PRICES[category];
  if (!categoryPrices) return null;

  const price = categoryPrices[materialCode];
  if (!price) return null;

  return {
    materialCode,
    category,
    price: price.price,
    unit: price.unit,
    trend: price.trend,
    lastUpdate: DEFAULT_PRICES.lastUpdate
  };
}

/**
 * Load price from database files
 */
async function loadPriceFromDb(category, materialCode, region) {
  try {
    const dirPath = path.join(DB_CONFIG.basePath, 'prices', category);
    const files = await fs.readdir(dirPath).catch(() => []);

    // Find matching price file
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const content = await fs.readFile(path.join(dirPath, file), 'utf8');
      const data = JSON.parse(content);

      if (data.materialCode === materialCode) {
        if (!region || data.region === region || data.region === '*') {
          return data;
        }
      }
    }

    return null;
  } catch (error) {
    logger.warn(`[PriceDB] Load price error: ${error.message}`);
    return null;
  }
}

// ============================================================================
// COMMERCIAL OFFERS
// ============================================================================

/**
 * Save commercial offer (привязано к проекту)
 *
 * @param {Object} offer - Commercial offer data
 * @returns {Promise<string|null>} Offer ID
 */
export async function saveCommercialOffer(offer) {
  try {
    const offerId = `offer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const entry = {
      id: offerId,
      projectId: offer.projectId,
      projectName: offer.projectName,
      supplier: offer.supplier,
      supplierContact: offer.supplierContact,
      validFrom: offer.validFrom || new Date().toISOString(),
      validUntil: offer.validUntil,
      items: offer.items || [],
      totalAmount: offer.totalAmount,
      currency: offer.currency || 'CZK',
      notes: offer.notes,
      attachments: offer.attachments || [],
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    const filePath = path.join(DB_CONFIG.basePath, 'offers', `${offerId}.json`);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8');

    // Cache offer
    cache.offers.set(offerId, entry);

    logger.info(`[PriceDB] Saved commercial offer: ${offerId} for project ${offer.projectId}`);
    return offerId;

  } catch (error) {
    logger.error(`[PriceDB] Save offer error: ${error.message}`);
    return null;
  }
}

/**
 * Get offers for project
 */
export async function getProjectOffers(projectId) {
  try {
    const dirPath = path.join(DB_CONFIG.basePath, 'offers');
    const files = await fs.readdir(dirPath).catch(() => []);
    const offers = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const content = await fs.readFile(path.join(dirPath, file), 'utf8');
      const data = JSON.parse(content);

      if (data.projectId === projectId) {
        offers.push(data);
      }
    }

    return offers.sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );

  } catch (error) {
    logger.error(`[PriceDB] Get offers error: ${error.message}`);
    return [];
  }
}

/**
 * Get price from project offer
 */
async function getOfferPrice(projectId, category, materialCode) {
  const offers = await getProjectOffers(projectId);

  for (const offer of offers) {
    if (offer.status !== 'active') continue;

    // Check if offer is still valid
    if (offer.validUntil && new Date(offer.validUntil) < new Date()) {
      continue;
    }

    // Find matching item
    const item = offer.items.find(i =>
      i.category === category && i.materialCode === materialCode
    );

    if (item) {
      return {
        ...item,
        supplier: offer.supplier,
        offerId: offer.id,
        offerValidUntil: offer.validUntil
      };
    }
  }

  return null;
}

// ============================================================================
// PRICE HISTORY
// ============================================================================

/**
 * Add price to history
 */
async function addToHistory(priceEntry) {
  try {
    const yearMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    const historyFile = path.join(
      DB_CONFIG.basePath,
      'history',
      `${priceEntry.category}_${yearMonth}.jsonl`
    );

    const historyEntry = {
      timestamp: new Date().toISOString(),
      materialCode: priceEntry.materialCode,
      price: priceEntry.price,
      unit: priceEntry.unit,
      region: priceEntry.region,
      source: priceEntry.source
    };

    await fs.appendFile(historyFile, JSON.stringify(historyEntry) + '\n', 'utf8');

  } catch (error) {
    logger.warn(`[PriceDB] History append error: ${error.message}`);
  }
}

/**
 * Get price history for material
 *
 * @param {string} category - Category
 * @param {string} materialCode - Material code
 * @param {number} months - Number of months to look back
 * @returns {Promise<Array>}
 */
export async function getPriceHistory(category, materialCode, months = 12) {
  try {
    const history = [];
    const historyDir = path.join(DB_CONFIG.basePath, 'history');

    // Generate file names for past months
    const now = new Date();
    for (let i = 0; i < months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearMonth = date.toISOString().substring(0, 7);
      const fileName = `${category}_${yearMonth}.jsonl`;
      const filePath = path.join(historyDir, fileName);

      try {
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());

        for (const line of lines) {
          const entry = JSON.parse(line);
          if (entry.materialCode === materialCode) {
            history.push(entry);
          }
        }
      } catch {
        // File doesn't exist for this month
      }
    }

    return history.sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

  } catch (error) {
    logger.error(`[PriceDB] Get history error: ${error.message}`);
    return [];
  }
}

/**
 * Analyze price changes over time
 *
 * @param {string} category - Category
 * @param {string} materialCode - Material code
 * @param {number} months - Months to analyze
 * @returns {Promise<Object>}
 */
export async function analyzePriceChange(category, materialCode, months = 12) {
  const history = await getPriceHistory(category, materialCode, months);

  if (history.length < 2) {
    return {
      materialCode,
      category,
      hasEnoughData: false,
      message: 'Nedostatek historických dat pro analýzu'
    };
  }

  const prices = history.map(h => h.price);
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

  const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;
  const volatility = ((maxPrice - minPrice) / avgPrice) * 100;

  let trend = 'stable';
  if (changePercent > 5) trend = 'rising';
  else if (changePercent < -5) trend = 'declining';

  return {
    materialCode,
    category,
    hasEnoughData: true,
    period: {
      from: history[0].timestamp,
      to: history[history.length - 1].timestamp,
      months: months
    },
    prices: {
      first: firstPrice,
      last: lastPrice,
      min: minPrice,
      max: maxPrice,
      avg: Math.round(avgPrice * 100) / 100
    },
    change: {
      absolute: lastPrice - firstPrice,
      percent: Math.round(changePercent * 100) / 100,
      trend
    },
    volatility: Math.round(volatility * 100) / 100,
    dataPoints: history.length
  };
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Import prices from array
 */
export async function importPrices(prices) {
  const results = { imported: 0, failed: 0, errors: [] };

  for (const price of prices) {
    const success = await savePrice(price);
    if (success) {
      results.imported++;
    } else {
      results.failed++;
      results.errors.push(price.materialCode);
    }
  }

  return results;
}

/**
 * Get all current prices for category
 */
export async function getCategoryPrices(category) {
  try {
    const dirPath = path.join(DB_CONFIG.basePath, 'prices', category);
    const files = await fs.readdir(dirPath).catch(() => []);
    const prices = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const content = await fs.readFile(path.join(dirPath, file), 'utf8');
      prices.push(JSON.parse(content));
    }

    return prices;

  } catch (error) {
    logger.error(`[PriceDB] Get category prices error: ${error.message}`);
    return [];
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function generatePriceId(entry) {
  const code = entry.materialCode || 'unknown';
  const region = entry.region || 'cz';
  return `${entry.category}_${code}_${region}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

export default {
  initPriceDatabase,
  savePrice,
  getPrice,
  saveCommercialOffer,
  getProjectOffers,
  getPriceHistory,
  analyzePriceChange,
  importPrices,
  getCategoryPrices
};
