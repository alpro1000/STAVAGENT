/**
 * Concrete Supplier Parser
 * Парсер для получения цен бетона от чешских поставщиков
 *
 * Hlavní dodavatelé betonu v ČR:
 * - Holcim (dříve Lafarge)
 * - CEMEX
 * - TBG METROSTAV
 * - Českomoravský beton
 * - ZAPA beton
 * - Frischbeton
 *
 * Struktura cen:
 * - Závisí na třídě betonu (C20/25, C25/30, C30/37, atd.)
 * - Závisí na regionu a vzdálenosti od betonárny
 * - Příplatky za: čerpadlo, pozdní odběr, malé množství, noční práce
 */

import { logger } from '../../utils/logger.js';
import { searchWithTavily, searchWithBrave } from '../norms/webSearchClient.js';
import { callLLMForTask, TASKS } from '../llmClient.js';

// ============================================================================
// CONCRETE SUPPLIERS
// ============================================================================

export const CONCRETE_SUPPLIERS = {
  HOLCIM: {
    id: 'holcim',
    name: 'Holcim Česko',
    website: 'holcim.cz',
    plants: ['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Hradec Králové'],
    products: ['transportbeton', 'speciální betony', 'samozhutnitelný beton'],
    notes: 'Dříve Lafarge, největší výrobce v ČR'
  },
  CEMEX: {
    id: 'cemex',
    name: 'CEMEX Czech Republic',
    website: 'cemex.cz',
    plants: ['Praha', 'Brno', 'Ostrava', 'České Budějovice', 'Ústí nad Labem'],
    products: ['transportbeton', 'betonové výrobky', 'kamenivo'],
    notes: 'Mezinárodní společnost, silná síť betonáren'
  },
  TBG_METROSTAV: {
    id: 'tbg_metrostav',
    name: 'TBG METROSTAV',
    website: 'tbg-metrostav.cz',
    plants: ['Praha', 'Střední Čechy'],
    products: ['transportbeton', 'speciální betony', 'betonové směsi'],
    notes: 'Součást skupiny Metrostav, zaměření na Prahu'
  },
  CESKOMORAVSKY_BETON: {
    id: 'ceskomoravsky_beton',
    name: 'Českomoravský beton',
    website: 'cmbeton.cz',
    plants: ['Praha', 'Brno', 'Moravskoslezský kraj'],
    products: ['transportbeton', 'betonové směsi'],
    notes: 'Součást HeidelbergCement'
  },
  ZAPA: {
    id: 'zapa',
    name: 'ZAPA beton',
    website: 'zapa.cz',
    plants: ['Praha', 'Střední Čechy', 'Západní Čechy'],
    products: ['transportbeton', 'speciální betony'],
    notes: 'Lokální výrobce s důrazem na kvalitu'
  },
  FRISCHBETON: {
    id: 'frischbeton',
    name: 'Frischbeton',
    website: 'frischbeton.cz',
    plants: ['Praha', 'Brno'],
    products: ['transportbeton', 'samonivelační potěry'],
    notes: 'Rakouská společnost'
  }
};

// ============================================================================
// CONCRETE CLASSES
// ============================================================================

export const CONCRETE_CLASSES = {
  // Konstrukční betony
  'C8/10': { description: 'Podkladní beton', use: 'Podklady, výplně', typical_price: 2200 },
  'C12/15': { description: 'Konstrukční beton slabý', use: 'Nenáročné konstrukce', typical_price: 2400 },
  'C16/20': { description: 'Konstrukční beton', use: 'Základy, podlahy', typical_price: 2600 },
  'C20/25': { description: 'Konstrukční beton standardní', use: 'Běžné konstrukce', typical_price: 2800 },
  'C25/30': { description: 'Konstrukční beton vyšší', use: 'Nosné konstrukce', typical_price: 3000 },
  'C30/37': { description: 'Konstrukční beton vysoký', use: 'Náročnější konstrukce', typical_price: 3300 },
  'C35/45': { description: 'Vysokopevnostní beton', use: 'Mosty, haly', typical_price: 3600 },
  'C40/50': { description: 'Vysokopevnostní beton', use: 'Prefabrikáty, mostovky', typical_price: 4000 },
  'C45/55': { description: 'Vysokopevnostní beton', use: 'Speciální konstrukce', typical_price: 4500 },
  'C50/60': { description: 'Ultra vysokopevnostní', use: 'Náročné projekty', typical_price: 5000 },

  // Speciální betony
  'SCC': { description: 'Samozhutnitelný beton', use: 'Složité tvary, hustá výztuž', typical_price: 3800 },
  'XC4': { description: 'Voděodolný beton', use: 'Bílé vany, nádrže', typical_price: 3400 },
  'XF4': { description: 'Mrazuvzdorný beton', use: 'Venkovní konstrukce', typical_price: 3500 },
  'C25/30 XC2': { description: 'Beton do vlhkého prostředí', use: 'Základy', typical_price: 3100 }
};

// ============================================================================
// PRICE SEARCH
// ============================================================================

/**
 * Search for concrete price
 *
 * @param {string} concreteClass - Concrete class (e.g., "C25/30")
 * @param {Object} options - Search options
 * @returns {Promise<Object|null>} Price data
 */
export async function searchConcretePrice(concreteClass, options = {}) {
  const { region = 'Praha', supplier = null, includeDelivery = true } = options;

  logger.info(`[ConcreteParser] Searching price for ${concreteClass} in ${region}`);

  try {
    // Build search query
    const query = buildConcreteSearchQuery(concreteClass, region, supplier);

    // Try Tavily first (better for content extraction)
    const supplierDomains = supplier
      ? [CONCRETE_SUPPLIERS[supplier.toUpperCase()]?.website].filter(Boolean)
      : Object.values(CONCRETE_SUPPLIERS).map(s => s.website);

    const tavilyResult = await searchWithTavily(query, {
      includeDomains: supplierDomains,
      maxResults: 5
    });

    // Extract prices from results
    const prices = await extractConcretePrices(tavilyResult.results, concreteClass, region);

    if (prices.length === 0) {
      // Fallback to typical price
      const classInfo = CONCRETE_CLASSES[concreteClass];
      if (classInfo) {
        return {
          concreteClass,
          price: classInfo.typical_price,
          unit: 'm³',
          source: 'typical_price',
          region,
          confidence: 0.5,
          note: 'Orientační cena z databáze, doporučujeme ověřit u dodavatele'
        };
      }
      return null;
    }

    // Return best price
    const bestPrice = prices.sort((a, b) => b.confidence - a.confidence)[0];
    bestPrice.alternatives = prices.slice(1);

    return bestPrice;

  } catch (error) {
    logger.error(`[ConcreteParser] Search error: ${error.message}`);
    return null;
  }
}

/**
 * Build search query for concrete
 */
function buildConcreteSearchQuery(concreteClass, region, supplier) {
  let query = `transportbeton ${concreteClass} cena ${region}`;

  if (supplier) {
    const supplierInfo = CONCRETE_SUPPLIERS[supplier.toUpperCase()];
    if (supplierInfo) {
      query = `${supplierInfo.name} ${concreteClass} cena m3 ${region}`;
    }
  }

  return query;
}

/**
 * Extract concrete prices from search results
 */
async function extractConcretePrices(results, concreteClass, region) {
  const prices = [];

  for (const result of results || []) {
    const content = result.content || result.rawContent || result.description || '';

    // Try pattern matching
    const priceInfo = extractConcretePriceFromContent(content, concreteClass);

    if (priceInfo) {
      // Identify supplier from URL
      const supplier = identifySupplier(result.url);

      prices.push({
        concreteClass,
        price: priceInfo.price,
        priceType: priceInfo.priceType || 's_dph',
        unit: 'm³',
        supplier: supplier?.name || 'Neznámý',
        supplierId: supplier?.id || null,
        region,
        sourceUrl: result.url,
        confidence: priceInfo.confidence || 0.7,
        fetchedAt: new Date().toISOString()
      });
    }
  }

  // If no prices found, try LLM extraction
  if (prices.length === 0 && results?.length > 0) {
    const combinedContent = results.map(r => r.content || r.rawContent || '').join('\n\n');

    if (combinedContent.length > 100) {
      const llmPrice = await extractConcretePriceWithLLM(concreteClass, region, combinedContent);
      if (llmPrice) {
        prices.push(llmPrice);
      }
    }
  }

  return prices;
}

/**
 * Extract concrete price using patterns
 */
function extractConcretePriceFromContent(content, concreteClass) {
  if (!content) return null;

  // Patterns for concrete prices (usually per m³)
  const patterns = [
    // Pattern: "C25/30: 2 800 Kč/m³"
    new RegExp(`${concreteClass.replace('/', '\\/')}[^\\d]*?(\\d[\\d\\s]*[,.]?\\d*)\\s*Kč(?:\\/m[³3])?`, 'gi'),
    // Pattern: "2 800 Kč/m³" near the class mention
    /(\d[\d\s]*[,.]?\d*)\s*Kč\s*(?:\/\s*)?m[³3]/gi,
    // Pattern: "od 2800 Kč"
    /(?:od|cena)\s*(\d[\d\s]*[,.]?\d*)\s*Kč/gi
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const matches = [...content.matchAll(pattern)];

    for (const match of matches) {
      const priceStr = match[1].replace(/\s/g, '').replace(',', '.');
      const price = parseFloat(priceStr);

      // Reasonable price range for concrete (1500 - 8000 Kč/m³)
      if (price >= 1500 && price <= 8000) {
        return {
          price,
          priceType: match[0].includes('bez DPH') ? 'bez_dph' : 's_dph',
          confidence: pattern.source.includes(concreteClass.replace('/', '\\/')) ? 0.9 : 0.7
        };
      }
    }
  }

  return null;
}

/**
 * Extract concrete price using LLM
 */
async function extractConcretePriceWithLLM(concreteClass, region, content) {
  const systemPrompt = `Jsi expert na české stavební materiály a ceny betonu.
Tvým úkolem je najít cenu transportbetonu a vrátit ji ve strukturovaném formátu.
Odpověz POUZE validním JSON bez dalšího textu.`;

  const userPrompt = `Najdi cenu transportbetonu třídy "${concreteClass}" v regionu "${region}" v následujícím textu:

${content.substring(0, 3000)}

Vrať JSON v tomto formátu:
{
  "found": true/false,
  "price": číslo v Kč za m³,
  "priceType": "s_dph" nebo "bez_dph",
  "supplier": "název dodavatele",
  "includesDelivery": true/false,
  "confidence": 0.0-1.0,
  "notes": "poznámky k ceně"
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
      if (parsed.found && parsed.price >= 1500 && parsed.price <= 8000) {
        return {
          concreteClass,
          price: parsed.price,
          priceType: parsed.priceType || 's_dph',
          unit: 'm³',
          supplier: parsed.supplier || 'Neznámý',
          region,
          includesDelivery: parsed.includesDelivery,
          confidence: parsed.confidence || 0.7,
          notes: parsed.notes,
          extractedBy: 'llm',
          fetchedAt: new Date().toISOString()
        };
      }
    }

    return null;

  } catch (error) {
    logger.warn(`[ConcreteParser] LLM extraction error: ${error.message}`);
    return null;
  }
}

/**
 * Identify supplier from URL
 */
function identifySupplier(url) {
  if (!url) return null;

  for (const [key, supplier] of Object.entries(CONCRETE_SUPPLIERS)) {
    if (url.includes(supplier.website)) {
      return supplier;
    }
  }

  return null;
}

// ============================================================================
// SUPPLIER CATALOG
// ============================================================================

/**
 * Get concrete price list from supplier
 *
 * @param {string} supplierId - Supplier ID from CONCRETE_SUPPLIERS
 * @param {string} region - Region for price
 * @returns {Promise<Array>} List of concrete prices
 */
export async function getSupplierPriceList(supplierId, region = 'Praha') {
  const supplier = CONCRETE_SUPPLIERS[supplierId.toUpperCase()];
  if (!supplier) {
    logger.warn(`[ConcreteParser] Unknown supplier: ${supplierId}`);
    return [];
  }

  logger.info(`[ConcreteParser] Getting price list from ${supplier.name} for ${region}`);

  try {
    const query = `${supplier.name} ceník transportbeton ${region} 2024 2025`;

    const result = await searchWithTavily(query, {
      includeDomains: [supplier.website],
      maxResults: 5
    });

    const priceList = [];

    // Try to extract prices for common classes
    const commonClasses = ['C16/20', 'C20/25', 'C25/30', 'C30/37', 'C35/45'];

    for (const result of result.results || []) {
      const content = result.content || result.rawContent || '';

      for (const concreteClass of commonClasses) {
        const priceInfo = extractConcretePriceFromContent(content, concreteClass);

        if (priceInfo && !priceList.find(p => p.concreteClass === concreteClass)) {
          priceList.push({
            concreteClass,
            price: priceInfo.price,
            priceType: priceInfo.priceType,
            unit: 'm³',
            supplier: supplier.name,
            supplierId: supplier.id,
            region,
            sourceUrl: result.url,
            fetchedAt: new Date().toISOString()
          });
        }
      }
    }

    // Fill in with typical prices if not found
    for (const concreteClass of commonClasses) {
      if (!priceList.find(p => p.concreteClass === concreteClass)) {
        const classInfo = CONCRETE_CLASSES[concreteClass];
        if (classInfo) {
          priceList.push({
            concreteClass,
            price: classInfo.typical_price,
            priceType: 's_dph',
            unit: 'm³',
            supplier: supplier.name,
            supplierId: supplier.id,
            region,
            source: 'typical_price',
            note: 'Orientační cena'
          });
        }
      }
    }

    return priceList;

  } catch (error) {
    logger.error(`[ConcreteParser] Price list error: ${error.message}`);
    return [];
  }
}

// ============================================================================
// PRICE COMPARISON
// ============================================================================

/**
 * Compare concrete prices across suppliers
 *
 * @param {string} concreteClass - Concrete class
 * @param {string} region - Region
 * @returns {Promise<Object>} Comparison data
 */
export async function compareConcreteSuppliers(concreteClass, region = 'Praha') {
  logger.info(`[ConcreteParser] Comparing suppliers for ${concreteClass} in ${region}`);

  const results = {
    concreteClass,
    region,
    suppliers: [],
    lowestPrice: null,
    averagePrice: null,
    fetchedAt: new Date().toISOString()
  };

  // Get prices from all suppliers
  for (const [supplierId, supplier] of Object.entries(CONCRETE_SUPPLIERS)) {
    // Skip if supplier doesn't have plants in region
    const hasPlantInRegion = supplier.plants.some(plant =>
      plant.toLowerCase().includes(region.toLowerCase()) ||
      region.toLowerCase().includes(plant.toLowerCase())
    );

    if (!hasPlantInRegion && region !== 'Praha') {
      continue;
    }

    const price = await searchConcretePrice(concreteClass, {
      region,
      supplier: supplierId
    });

    if (price && price.price > 0) {
      results.suppliers.push({
        supplierId,
        supplierName: supplier.name,
        price: price.price,
        priceType: price.priceType,
        confidence: price.confidence,
        sourceUrl: price.sourceUrl
      });
    }
  }

  // Calculate statistics
  if (results.suppliers.length > 0) {
    results.suppliers.sort((a, b) => a.price - b.price);
    results.lowestPrice = results.suppliers[0];

    const total = results.suppliers.reduce((sum, s) => sum + s.price, 0);
    results.averagePrice = Math.round(total / results.suppliers.length);
  }

  return results;
}

// ============================================================================
// DELIVERY COST ESTIMATION
// ============================================================================

/**
 * Estimate delivery cost based on distance
 *
 * @param {number} distance - Distance in km
 * @param {number} volume - Volume in m³
 * @returns {Object} Delivery cost estimate
 */
export function estimateDeliveryCost(distance, volume) {
  // Typical Czech concrete delivery rates
  const baseDeliveryCost = 0; // Usually included in price within certain radius
  const freeDeliveryRadius = 15; // km
  const costPerKm = 45; // Kč/km after free radius

  let deliveryCost = 0;

  if (distance > freeDeliveryRadius) {
    const chargeableDistance = distance - freeDeliveryRadius;
    deliveryCost = chargeableDistance * costPerKm;
  }

  // Minimum order surcharge
  let minOrderSurcharge = 0;
  if (volume < 3) {
    minOrderSurcharge = (3 - volume) * 500; // ~500 Kč/m³ surcharge for small orders
  }

  return {
    deliveryCost,
    minOrderSurcharge,
    totalExtra: deliveryCost + minOrderSurcharge,
    notes: [
      distance > freeDeliveryRadius ? `Příplatek za vzdálenost: ${deliveryCost} Kč` : 'Doprava v ceně',
      volume < 3 ? `Příplatek za malé množství: ${minOrderSurcharge} Kč` : null
    ].filter(Boolean)
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  CONCRETE_SUPPLIERS,
  CONCRETE_CLASSES,
  searchConcretePrice,
  getSupplierPriceList,
  compareConcreteSuppliers,
  estimateDeliveryCost
};
