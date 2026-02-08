/**
 * Price Service
 * Оркестратор цен - поиск, загрузка, анализ
 *
 * Приоритет источников:
 * 1. Коммерческое предложение (привязано к проекту)
 * 2. Свежие данные из базы (< 7 дней)
 * 3. Web-поиск (DEK.cz, бетонарни)
 * 4. Исторические данные из опыта (fallback)
 */

import { logger } from '../../utils/logger.js';
import { searchWithBrave, searchWithTavily } from '../norms/webSearchClient.js';
import {
  initPriceDatabase,
  savePrice,
  getPrice,
  saveCommercialOffer,
  getProjectOffers,
  getPriceHistory,
  analyzePriceChange,
  importPrices,
  getCategoryPrices
} from './priceDatabase.js';
import {
  PRICE_SOURCES,
  MATERIAL_CATEGORIES,
  DEFAULT_PRICES,
  getSource,
  getSourcesForCategory
} from './priceSources.js';
import {
  searchDekPrice,
  searchDekCatalog,
  lookupDekProduct,
  DEK_CATEGORIES
} from './dekParser.js';
import {
  searchConcretePrice,
  getSupplierPriceList,
  compareConcreteSuppliers,
  estimateDeliveryCost,
  CONCRETE_SUPPLIERS,
  CONCRETE_CLASSES
} from './concreteSupplierParser.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

let isInitialized = false;

export async function initPriceService() {
  if (isInitialized) return true;

  try {
    await initPriceDatabase();
    isInitialized = true;
    logger.info('[PriceService] Initialized');
    return true;
  } catch (error) {
    logger.error(`[PriceService] Init error: ${error.message}`);
    return false;
  }
}

// ============================================================================
// PRICE LOOKUP
// ============================================================================

/**
 * Find price for material (main method)
 *
 * @param {string} category - Material category
 * @param {string} materialCode - Material code
 * @param {Object} options - Options
 * @returns {Promise<Object>}
 */
export async function findPrice(category, materialCode, options = {}) {
  await initPriceService();

  const {
    projectId,
    region = 'Praha',
    searchWeb = true,
    includeHistory = false
  } = options;

  logger.info(`[PriceService] Finding price: ${category}/${materialCode}`);

  // 1. Get price from database (with priority logic)
  let priceData = await getPrice(category, materialCode, {
    projectId,
    region,
    useDefault: true
  });

  // 2. If no recent price and web search enabled, try web
  if (searchWeb && (!priceData || priceData.source === 'default_experience')) {
    const webPrice = await searchPriceOnWeb(category, materialCode, region);
    if (webPrice) {
      // Save to database for future
      await savePrice({
        category,
        materialCode,
        ...webPrice,
        source: 'web_search'
      });

      priceData = {
        ...webPrice,
        source: 'web_search',
        priority: 2.5
      };
    }
  }

  // 3. Include history if requested
  let history = null;
  let analysis = null;
  if (includeHistory && priceData) {
    history = await getPriceHistory(category, materialCode, 12);
    analysis = await analyzePriceChange(category, materialCode, 12);
  }

  return {
    found: !!priceData,
    price: priceData,
    history: history,
    analysis: analysis,
    sources: getSourcesForCategory(category).map(s => s.name),
    timestamp: new Date().toISOString()
  };
}

/**
 * Search price on web (DEK.cz, suppliers)
 */
async function searchPriceOnWeb(category, materialCode, region) {
  try {
    // Build search query based on category
    let query = '';
    let domains = [];

    switch (category) {
    case 'beton':
      query = `${materialCode} beton cena m3 ${region}`;
      domains = ['holcim.cz', 'cemex.cz', 'tbg-metrostav.cz'];
      break;

    case 'armatura':
      query = `výztuž ${materialCode} cena kg`;
      domains = ['ferona.cz', 'kondor.cz', 'arcelormittal.com'];
      break;

    case 'zdivo':
    case 'izolace':
      query = `${materialCode} cena ks m2 dek`;
      domains = ['dek.cz', 'stavmat.cz', 'baumax.cz'];
      break;

    default:
      query = `${materialCode} stavební materiál cena`;
      domains = ['dek.cz'];
    }

    // Try Tavily first (better for extraction)
    const tavilyResult = await searchWithTavily(query, {
      includeDomains: domains,
      maxResults: 3
    });

    if (tavilyResult.results.length > 0) {
      // Try to extract price from content
      const price = extractPriceFromContent(tavilyResult.results[0].content, materialCode);
      if (price) {
        return {
          price: price.value,
          unit: price.unit,
          sourceUrl: tavilyResult.results[0].url,
          sourceName: new URL(tavilyResult.results[0].url).hostname,
          fetchedAt: new Date().toISOString()
        };
      }
    }

    // Fallback to Brave
    const braveResults = await searchWithBrave(query, { count: 5 });
    // Would need to fetch and parse pages, complex for now

    return null;

  } catch (error) {
    logger.warn(`[PriceService] Web search error: ${error.message}`);
    return null;
  }
}

/**
 * Extract price from text content
 */
function extractPriceFromContent(content, materialCode) {
  if (!content) return null;

  // Patterns for Czech prices
  const patterns = [
    /(\d[\d\s]*[,.]?\d*)\s*(?:Kč|CZK)\s*(?:\/|za)\s*(m[³3²2]|ks|kg|t|bm)/gi,
    /cena[:\s]+(\d[\d\s]*[,.]?\d*)\s*(?:Kč|CZK)/gi,
    /(\d[\d\s]*[,.]?\d*)\s*(?:Kč|CZK)\/?(m[³3²2]|ks|kg)?/gi
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      // Parse the number
      const numStr = match[0].replace(/\s/g, '').replace(',', '.');
      const numMatch = numStr.match(/(\d+\.?\d*)/);
      if (numMatch) {
        const value = parseFloat(numMatch[1]);
        if (value > 0 && value < 1000000) { // sanity check
          const unitMatch = match[0].match(/(m[³3²2]|ks|kg|t|bm)/i);
          return {
            value,
            unit: unitMatch ? normalizeUnit(unitMatch[1]) : 'ks'
          };
        }
      }
    }
  }

  return null;
}

function normalizeUnit(unit) {
  const map = {
    'm3': 'm³', 'm³': 'm³',
    'm2': 'm²', 'm²': 'm²',
    'ks': 'ks',
    'kg': 'kg',
    't': 't',
    'bm': 'bm'
  };
  return map[unit.toLowerCase()] || unit;
}

// ============================================================================
// COMMERCIAL OFFERS
// ============================================================================

/**
 * Upload commercial offer (PDF/Excel parsed or manual)
 */
export async function uploadCommercialOffer(offerData) {
  await initPriceService();

  const offerId = await saveCommercialOffer(offerData);
  if (!offerId) {
    throw new Error('Failed to save commercial offer');
  }

  return {
    offerId,
    projectId: offerData.projectId,
    itemCount: offerData.items?.length || 0,
    status: 'active'
  };
}

/**
 * Get all offers for project
 */
export async function getOffersForProject(projectId) {
  await initPriceService();
  return getProjectOffers(projectId);
}

// ============================================================================
// PRICE ANALYSIS
// ============================================================================

/**
 * Analyze price trend for material
 */
export async function analyzePriceTrend(category, materialCode, months = 12) {
  await initPriceService();
  return analyzePriceChange(category, materialCode, months);
}

/**
 * Compare prices across suppliers
 */
export async function comparePrices(category, materialCode, options = {}) {
  await initPriceService();

  const results = {
    materialCode,
    category,
    comparisons: [],
    recommendation: null
  };

  // Get from different sources
  const sources = ['database', 'web', 'default'];

  for (const source of sources) {
    const price = await getPrice(category, materialCode, {
      ...options,
      useDefault: source === 'default'
    });

    if (price) {
      results.comparisons.push({
        source: price.source,
        price: price.price,
        unit: price.unit,
        supplier: price.supplier || 'unknown',
        validUntil: price.offerValidUntil
      });
    }
  }

  // Sort by price
  results.comparisons.sort((a, b) => a.price - b.price);

  if (results.comparisons.length > 0) {
    results.recommendation = {
      lowestPrice: results.comparisons[0],
      savings: results.comparisons.length > 1
        ? results.comparisons[results.comparisons.length - 1].price - results.comparisons[0].price
        : 0
    };
  }

  return results;
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Get prices for project (all materials)
 */
export async function getPricesForProject(projectId, materials) {
  await initPriceService();

  const results = [];

  for (const material of materials) {
    const priceData = await findPrice(material.category, material.code, {
      projectId,
      region: material.region,
      includeHistory: false
    });

    results.push({
      material,
      ...priceData
    });
  }

  return {
    projectId,
    materials: results,
    summary: {
      total: results.length,
      found: results.filter(r => r.found).length,
      fromOffers: results.filter(r => r.price?.source === 'commercial_offer').length,
      fromDefault: results.filter(r => r.price?.source === 'default_experience').length
    }
  };
}

/**
 * Import prices from parsed file
 */
export async function importPricesFromFile(prices) {
  await initPriceService();
  return importPrices(prices);
}

// ============================================================================
// DEK.CZ MATERIALS
// ============================================================================

/**
 * Find material price on DEK.cz
 *
 * @param {string} productName - Product name
 * @param {Object} options - Search options
 */
export async function findDekPrice(productName, options = {}) {
  await initPriceService();

  logger.info(`[PriceService] Searching DEK price: ${productName}`);

  const result = await searchDekPrice(productName, options);

  if (result) {
    // Save to database for caching
    await savePrice({
      category: options.category || 'zdivo',
      materialCode: productName,
      price: result.price,
      unit: result.unit,
      source: 'dek.cz',
      sourceUrl: result.sourceUrl,
      supplier: 'DEK a.s.'
    });
  }

  return result;
}

/**
 * Search DEK catalog by category
 */
export async function searchDekMaterials(categoryId, options = {}) {
  await initPriceService();
  return searchDekCatalog(categoryId, options);
}

/**
 * Lookup specific DEK product
 */
export async function getDekProduct(articleNumber) {
  await initPriceService();
  return lookupDekProduct(articleNumber);
}

// ============================================================================
// CONCRETE (BETONÁRNY)
// ============================================================================

/**
 * Find concrete price
 *
 * @param {string} concreteClass - Concrete class (e.g., "C25/30")
 * @param {Object} options - Search options
 */
export async function findConcretePrice(concreteClass, options = {}) {
  await initPriceService();

  const { region = 'Praha', supplier = null, projectId = null } = options;

  logger.info(`[PriceService] Finding concrete price: ${concreteClass} in ${region}`);

  // 1. Check for commercial offer first
  if (projectId) {
    const offers = await getProjectOffers(projectId);
    for (const offer of offers) {
      const item = offer.items?.find(i =>
        i.category === 'beton' &&
        (i.materialCode === concreteClass || i.description?.includes(concreteClass))
      );

      if (item) {
        return {
          found: true,
          concreteClass,
          price: item.price,
          unit: 'm³',
          source: 'commercial_offer',
          supplier: offer.supplier,
          validUntil: offer.validUntil,
          priority: 1
        };
      }
    }
  }

  // 2. Check database cache
  const cachedPrice = await getPrice('beton', concreteClass, {
    region,
    useDefault: false
  });

  if (cachedPrice && cachedPrice.source !== 'default_experience') {
    const age = Date.now() - new Date(cachedPrice.fetchedAt || 0).getTime();
    if (age < 7 * 24 * 60 * 60 * 1000) { // Less than 7 days old
      return {
        found: true,
        ...cachedPrice,
        priority: 2
      };
    }
  }

  // 3. Search on web
  const webPrice = await searchConcretePrice(concreteClass, {
    region,
    supplier
  });

  if (webPrice && webPrice.price > 0) {
    // Save to database
    await savePrice({
      category: 'beton',
      materialCode: concreteClass,
      price: webPrice.price,
      unit: 'm³',
      source: 'web_search',
      sourceUrl: webPrice.sourceUrl,
      supplier: webPrice.supplier,
      region
    });

    return {
      found: true,
      ...webPrice,
      priority: 2.5
    };
  }

  // 4. Fallback to typical prices
  const classInfo = CONCRETE_CLASSES[concreteClass];
  if (classInfo) {
    return {
      found: true,
      concreteClass,
      price: classInfo.typical_price,
      unit: 'm³',
      description: classInfo.description,
      use: classInfo.use,
      source: 'typical_price',
      note: 'Orientační cena, doporučujeme ověřit u dodavatele',
      priority: 4
    };
  }

  return { found: false, concreteClass };
}

/**
 * Compare concrete suppliers
 */
export async function compareConcreteSupplierPrices(concreteClass, region = 'Praha') {
  await initPriceService();
  return compareConcreteSuppliers(concreteClass, region);
}

/**
 * Get concrete supplier price list
 */
export async function getConcretePriceList(supplierId, region = 'Praha') {
  await initPriceService();
  return getSupplierPriceList(supplierId, region);
}

/**
 * Calculate concrete delivery cost
 */
export function calculateDeliveryCost(distance, volume) {
  return estimateDeliveryCost(distance, volume);
}

/**
 * Get all concrete classes with typical prices
 */
export function getConcreteClasses() {
  return CONCRETE_CLASSES;
}

/**
 * Get all concrete suppliers
 */
export function getConcreteSuppliers() {
  return CONCRETE_SUPPLIERS;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  PRICE_SOURCES,
  MATERIAL_CATEGORIES,
  DEFAULT_PRICES,
  DEK_CATEGORIES,
  CONCRETE_SUPPLIERS,
  CONCRETE_CLASSES
};

export default {
  initPriceService,
  findPrice,
  uploadCommercialOffer,
  getOffersForProject,
  analyzePriceTrend,
  comparePrices,
  getPricesForProject,
  importPricesFromFile,
  // DEK
  findDekPrice,
  searchDekMaterials,
  getDekProduct,
  // Concrete
  findConcretePrice,
  compareConcreteSupplierPrices,
  getConcretePriceList,
  calculateDeliveryCost,
  getConcreteClasses,
  getConcreteSuppliers,
  // Constants
  PRICE_SOURCES,
  MATERIAL_CATEGORIES,
  DEK_CATEGORIES,
  CONCRETE_SUPPLIERS,
  CONCRETE_CLASSES
};
