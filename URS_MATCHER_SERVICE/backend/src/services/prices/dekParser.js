/**
 * DEK.cz Parser
 * Парсер для получения цен строительных материалов с DEK.cz
 *
 * DEK (vlastník ÚRS/KROS) - hlavní zdroj cen stavebních materiálů:
 * - Zdivo (cihly, tvárnice)
 * - Izolace (tepelné, hydroizolace)
 * - Střešní krytiny
 * - Sádrokartony
 * - Omítky a malty
 * - Obklady a dlažby
 */

import { logger } from '../../utils/logger.js';
import { searchWithTavily, searchWithBrave } from '../norms/webSearchClient.js';
import { callLLMForTask, TASKS } from '../llmClient.js';

// ============================================================================
// DEK PRODUCT CATEGORIES
// ============================================================================

export const DEK_CATEGORIES = {
  ZDIVO: {
    id: 'zdivo',
    name: 'Zdivo',
    subcategories: ['cihly', 'tvárnice', 'příčkovky', 'překlady'],
    searchTerms: ['cihelné zdivo', 'Porotherm', 'Ytong', 'tvárnice', 'příčkovka'],
    dekUrl: 'https://www.dek.cz/zdivo'
  },
  IZOLACE: {
    id: 'izolace',
    name: 'Izolace',
    subcategories: ['tepelná izolace', 'hydroizolace', 'parozábrana', 'zvuková izolace'],
    searchTerms: ['EPS', 'XPS', 'minerální vata', 'hydroizolační pásy', 'asfaltové pásy'],
    dekUrl: 'https://www.dek.cz/izolace'
  },
  SUCHE_VYSTAVBA: {
    id: 'suche_vystavba',
    name: 'Suchá výstavba',
    subcategories: ['sádrokarton', 'profily', 'tmely', 'příslušenství'],
    searchTerms: ['sádrokartonové desky', 'Knauf', 'Rigips', 'SDK profil'],
    dekUrl: 'https://www.dek.cz/sucha-vystavba'
  },
  STRECHY: {
    id: 'strechy',
    name: 'Střechy',
    subcategories: ['střešní krytiny', 'střešní okna', 'klempířské prvky'],
    searchTerms: ['střešní taška', 'plechová krytina', 'střešní fólie', 'okapový systém'],
    dekUrl: 'https://www.dek.cz/strechy'
  },
  FASADY: {
    id: 'fasady',
    name: 'Fasády',
    subcategories: ['fasádní systémy', 'omítky', 'barvy', 'lišty'],
    searchTerms: ['fasádní omítka', 'zateplovací systém', 'ETICS', 'silikátová omítka'],
    dekUrl: 'https://www.dek.cz/fasady'
  },
  PODLAHY: {
    id: 'podlahy',
    name: 'Podlahy',
    subcategories: ['dlažby', 'potěry', 'podlahové topení', 'hydroizolace'],
    searchTerms: ['anhydritový potěr', 'dlažba', 'samonivelační stěrka'],
    dekUrl: 'https://www.dek.cz/podlahy'
  }
};

// ============================================================================
// SEARCH AND EXTRACTION
// ============================================================================

/**
 * Search for product price on DEK.cz
 *
 * @param {string} productName - Product name or code
 * @param {Object} options - Search options
 * @returns {Promise<Object|null>} Price data or null
 */
export async function searchDekPrice(productName, options = {}) {
  const { category, includeAlternatives = true } = options;

  logger.info(`[DEKParser] Searching price for: ${productName}`);

  try {
    // Build search query
    const query = buildDekSearchQuery(productName, category);

    // Search with Tavily (includes content extraction)
    const tavilyResult = await searchWithTavily(query, {
      includeDomains: ['dek.cz', 'stavebniny-dek.cz'],
      maxResults: 5
    });

    if (!tavilyResult.results || tavilyResult.results.length === 0) {
      logger.warn(`[DEKParser] No results from Tavily for: ${productName}`);
      return null;
    }

    // Extract price from results
    const priceData = await extractPriceFromDekResults(tavilyResult.results, productName);

    if (priceData) {
      priceData.source = 'dek.cz';
      priceData.fetchedAt = new Date().toISOString();
      priceData.searchQuery = query;
    }

    return priceData;

  } catch (error) {
    logger.error(`[DEKParser] Search error: ${error.message}`);
    return null;
  }
}

/**
 * Build optimized search query for DEK
 */
function buildDekSearchQuery(productName, category) {
  let query = `${productName} cena DEK`;

  // Add category-specific terms
  if (category && DEK_CATEGORIES[category.toUpperCase()]) {
    const cat = DEK_CATEGORIES[category.toUpperCase()];
    query += ` ${cat.name}`;
  }

  // Add "Kč" to help find prices
  query += ' Kč';

  return query;
}

/**
 * Extract price from DEK search results
 */
async function extractPriceFromDekResults(results, productName) {
  // First try pattern matching on content
  for (const result of results) {
    const content = result.content || result.rawContent || '';

    // Try to extract price using patterns
    const priceInfo = extractPriceFromContent(content, productName);
    if (priceInfo) {
      return {
        ...priceInfo,
        sourceUrl: result.url,
        title: result.title
      };
    }
  }

  // If pattern matching fails, use LLM for extraction
  const combinedContent = results.map(r => r.content || r.rawContent || '').join('\n\n');

  if (combinedContent.length > 100) {
    const llmExtracted = await extractPriceWithLLM(productName, combinedContent);
    if (llmExtracted) {
      return {
        ...llmExtracted,
        sourceUrl: results[0].url,
        extractedBy: 'llm'
      };
    }
  }

  return null;
}

/**
 * Extract price using regex patterns
 */
function extractPriceFromContent(content, productName) {
  if (!content) return null;

  // Normalize product name for matching
  const normalizedProduct = productName.toLowerCase().replace(/\s+/g, '\\s*');

  // Price patterns specific to DEK
  const patterns = [
    // Pattern: "1 234,56 Kč"
    /(\d[\d\s]*[,.]?\d*)\s*Kč(?:\s*(?:\/|bez|s)\s*DPH)?/gi,
    // Pattern: "cena: 1234 Kč/ks"
    /cena[:\s]*(\d[\d\s]*[,.]?\d*)\s*Kč\s*(?:\/\s*)?(ks|m[²³2]|bm|pal|bal)?/gi,
    // Pattern: "od 1234 Kč"
    /od\s+(\d[\d\s]*[,.]?\d*)\s*Kč/gi
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const matches = [...content.matchAll(pattern)];

    for (const match of matches) {
      const priceStr = match[1].replace(/\s/g, '').replace(',', '.');
      const price = parseFloat(priceStr);

      // Sanity check
      if (price > 0 && price < 10000000) {
        // Try to find unit near the price
        const unitMatch = match[0].match(/(ks|m[²³2]|bm|pal|bal|kg|t)/i);

        return {
          price,
          unit: unitMatch ? normalizeUnit(unitMatch[1]) : 'ks',
          priceType: match[0].includes('bez DPH') ? 'bez_dph' : 's_dph',
          confidence: match[0].toLowerCase().includes(productName.toLowerCase().substring(0, 5)) ? 0.9 : 0.6
        };
      }
    }
  }

  return null;
}

/**
 * Extract price using LLM
 */
async function extractPriceWithLLM(productName, content) {
  const systemPrompt = `Jsi expert na extrakci cen z webových stránek DEK.cz.
Tvým úkolem je najít cenu produktu a vrátit ji ve strukturovaném formátu.
Odpověz POUZE validním JSON bez dalšího textu.`;

  const userPrompt = `Najdi cenu produktu "${productName}" v následujícím textu:

${content.substring(0, 3000)}

Vrať JSON v tomto formátu:
{
  "found": true/false,
  "price": číslo (bez DPH, pokud je uvedeno),
  "priceWithDph": číslo (s DPH),
  "unit": "ks" nebo "m²" nebo "m³" nebo "kg" nebo "bm" nebo "pal",
  "productName": "přesný název produktu",
  "confidence": 0.0-1.0
}`;

  try {
    const response = await callLLMForTask(
      TASKS.SIMPLE_MATCHING,
      systemPrompt,
      userPrompt,
      30000
    );

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.found && parsed.price > 0) {
        return {
          price: parsed.price,
          priceWithDph: parsed.priceWithDph,
          unit: normalizeUnit(parsed.unit || 'ks'),
          productMatch: parsed.productName,
          confidence: parsed.confidence || 0.7
        };
      }
    }

    return null;

  } catch (error) {
    logger.warn(`[DEKParser] LLM extraction error: ${error.message}`);
    return null;
  }
}

// ============================================================================
// CATALOG SEARCH
// ============================================================================

/**
 * Search DEK catalog by category
 *
 * @param {string} categoryId - Category ID from DEK_CATEGORIES
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Products with prices
 */
export async function searchDekCatalog(categoryId, options = {}) {
  const { subcategory, limit = 20 } = options;

  const category = DEK_CATEGORIES[categoryId.toUpperCase()];
  if (!category) {
    logger.warn(`[DEKParser] Unknown category: ${categoryId}`);
    return [];
  }

  logger.info(`[DEKParser] Searching catalog: ${category.name}`);

  try {
    // Build search query
    let query = `${category.name} cena DEK`;
    if (subcategory) {
      query = `${subcategory} cena DEK`;
    }

    // Add common product terms
    const searchTerms = category.searchTerms.slice(0, 3).join(' OR ');
    query += ` (${searchTerms})`;

    // Search with Brave (more results)
    const braveResults = await searchWithBrave(query, {
      count: Math.min(limit, 20)
    });

    const products = [];

    for (const result of braveResults.results || []) {
      // Check if it's from DEK
      if (!result.url?.includes('dek.cz')) continue;

      const priceInfo = extractPriceFromContent(
        result.description || result.content || '',
        result.title
      );

      if (priceInfo) {
        products.push({
          name: result.title,
          url: result.url,
          category: category.id,
          ...priceInfo,
          source: 'dek.cz'
        });
      }
    }

    return products.slice(0, limit);

  } catch (error) {
    logger.error(`[DEKParser] Catalog search error: ${error.message}`);
    return [];
  }
}

// ============================================================================
// PRODUCT LOOKUP
// ============================================================================

/**
 * Lookup specific product by DEK article number
 *
 * @param {string} articleNumber - DEK article number
 * @returns {Promise<Object|null>} Product data
 */
export async function lookupDekProduct(articleNumber) {
  logger.info(`[DEKParser] Looking up product: ${articleNumber}`);

  try {
    const query = `"${articleNumber}" DEK cena`;

    const result = await searchWithTavily(query, {
      includeDomains: ['dek.cz'],
      maxResults: 3
    });

    if (!result.results || result.results.length === 0) {
      return null;
    }

    const product = result.results[0];
    const priceInfo = extractPriceFromContent(
      product.content || product.rawContent || '',
      articleNumber
    );

    return {
      articleNumber,
      name: product.title,
      url: product.url,
      description: product.description,
      ...priceInfo,
      source: 'dek.cz',
      fetchedAt: new Date().toISOString()
    };

  } catch (error) {
    logger.error(`[DEKParser] Product lookup error: ${error.message}`);
    return null;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Normalize unit to standard format
 */
function normalizeUnit(unit) {
  if (!unit) return 'ks';

  const unitMap = {
    'ks': 'ks',
    'm2': 'm²',
    'm²': 'm²',
    'm3': 'm³',
    'm³': 'm³',
    'kg': 'kg',
    't': 't',
    'bm': 'bm',
    'pal': 'pal',
    'bal': 'bal'
  };

  return unitMap[unit.toLowerCase()] || unit;
}

/**
 * Validate price is reasonable
 */
function isReasonablePrice(price, unit) {
  const maxPrices = {
    'ks': 100000,    // Max 100k per piece
    'm²': 50000,     // Max 50k per m²
    'm³': 500000,    // Max 500k per m³
    'kg': 1000,      // Max 1k per kg
    't': 1000000,    // Max 1M per ton
    'bm': 10000,     // Max 10k per running meter
    'pal': 500000    // Max 500k per pallet
  };

  const maxPrice = maxPrices[unit] || 100000;
  return price > 0 && price < maxPrice;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  DEK_CATEGORIES,
  searchDekPrice,
  searchDekCatalog,
  lookupDekProduct
};
