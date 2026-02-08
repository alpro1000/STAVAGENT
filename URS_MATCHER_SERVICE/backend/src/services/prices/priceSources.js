/**
 * Price Sources Configuration
 * Источники цен на строительные материалы
 *
 * Структура:
 * - DEK.cz (владелец ÚRS/KROS) - стройматериалы, прайсы
 * - Бетонарни - бетон напрямую от производителей
 * - Hutní prodej - арматура
 * - Коммерческие предложения - загружаемые PDF/Excel
 * - Исторические данные - для fallback
 */

import { logger } from '../../utils/logger.js';

// ============================================================================
// PRICE SOURCES
// ============================================================================

export const PRICE_SOURCES = {
  // DEK.cz - главный источник стройматериалов (владелец ÚRS/KROS)
  DEK: {
    id: 'dek',
    name: 'DEK',
    fullName: 'DEK stavebniny s.r.o.',
    url: 'https://www.dek.cz',
    apiUrl: null, // Нет публичного API, парсинг через web/Tavily
    categories: [
      'izolace',           // Теплоизоляция, гидроизоляция
      'stresni_systemy',   // Кровельные системы
      'fasady',            // Фасадные материалы
      'suche_stavby',      // Сухая стройка (гипсокартон)
      'zdivo',             // Кладочные материалы
      'omitky',            // Штукатурки, шпаклёвки
      'podlahy',           // Напольные покрытия
      'natery',            // Краски, грунтовки
      'okna_dvere',        // Окна, двери
      'hrube_stavby'       // Грубая стройка
    ],
    trustLevel: 'high',
    updateFrequency: 'daily',
    priceType: 'retail', // розничные цены, для крупных заказов -10-30%
    notes: 'Владелец ÚRS и KROS, цены по их прайсу'
  },

  // Бетонарни - производители бетона
  BETONARNY: {
    id: 'betonarny',
    name: 'Betonárny',
    fullName: 'Производители товарного бетона',
    suppliers: [
      {
        name: 'Holcim Česká republika',
        url: 'https://www.holcim.cz',
        regions: ['Praha', 'Středočeský', 'Jihočeský'],
        delivery: true
      },
      {
        name: 'CEMEX Czech Republic',
        url: 'https://www.cemex.cz',
        regions: ['Praha', 'Brno', 'Ostrava'],
        delivery: true
      },
      {
        name: 'TBG Metrostav',
        url: 'https://www.tbg-metrostav.cz',
        regions: ['Praha', 'Středočeský'],
        delivery: true
      },
      {
        name: 'Českomoravský beton',
        url: 'https://www.cmbeton.cz',
        regions: ['Morava', 'Slezsko'],
        delivery: true
      }
    ],
    categories: ['beton_tovarni', 'pumpy', 'doprava'],
    trustLevel: 'high',
    updateFrequency: 'weekly',
    priceType: 'wholesale',
    notes: 'Цены на бетон зависят от расстояния от бетонарни'
  },

  // Hutní prodej - арматура
  HUTNI_MATERIAL: {
    id: 'hutni',
    name: 'Hutní materiál',
    fullName: 'Hutnické výrobky - арматура',
    suppliers: [
      {
        name: 'ArcelorMittal Ostrava',
        url: 'https://www.arcelormittal.com/czechia/',
        products: ['armatura', 'valcovane_profily']
      },
      {
        name: 'Ferona',
        url: 'https://www.ferona.cz',
        products: ['armatura', 'trubky', 'plechy']
      },
      {
        name: 'Královo Pole Cranes',
        url: 'https://www.kp-cranes.cz',
        products: ['ocelove_konstrukce']
      }
    ],
    categories: ['armatura', 'ocel', 'kari_site'],
    trustLevel: 'high',
    updateFrequency: 'weekly',
    priceType: 'wholesale'
  },

  // Kamenivo - щебень, песок
  KAMENIVO: {
    id: 'kamenivo',
    name: 'Kamenivo',
    fullName: 'Písek, štěrk, kamenivo',
    categories: ['pisek', 'sterk', 'drt', 'kamen'],
    trustLevel: 'medium',
    updateFrequency: 'monthly',
    priceType: 'wholesale',
    notes: 'Цена сильно зависит от расстояния (doprava)'
  },

  // Коммерческие предложения (загружаемые)
  COMMERCIAL_OFFERS: {
    id: 'commercial',
    name: 'Komerční nabídky',
    fullName: 'Загруженные коммерческие предложения',
    categories: ['*'], // все категории
    trustLevel: 'highest', // конкретное предложение для проекта
    updateFrequency: 'per_project',
    priceType: 'offer',
    notes: 'Загружаются вручную, привязываются к проекту'
  },

  // Исторические данные / опыт
  HISTORICAL: {
    id: 'historical',
    name: 'Historická data',
    fullName: 'Исторические данные и опыт',
    categories: ['*'],
    trustLevel: 'low', // fallback
    updateFrequency: 'quarterly',
    priceType: 'estimated',
    notes: 'Используется когда нет актуальных данных'
  }
};

// ============================================================================
// MATERIAL CATEGORIES
// ============================================================================

export const MATERIAL_CATEGORIES = {
  // Бетон
  BETON: {
    id: 'beton',
    name: 'Beton',
    unit: 'm³',
    sources: ['betonarny', 'commercial'],
    priceFactors: ['trida', 'konzistence', 'doprava_km', 'cerpadlo']
  },

  // Арматура
  ARMATURA: {
    id: 'armatura',
    name: 'Výztuž',
    unit: 'kg',
    sources: ['hutni', 'commercial', 'dek'],
    priceFactors: ['prumer', 'trida_oceli', 'ohyby', 'rezani']
  },

  // Кладочные материалы
  ZDIVO: {
    id: 'zdivo',
    name: 'Zdivo',
    unit: 'ks',
    sources: ['dek', 'commercial'],
    priceFactors: ['typ', 'tloustka', 'pevnost']
  },

  // Изоляции
  IZOLACE: {
    id: 'izolace',
    name: 'Izolace',
    unit: 'm²',
    sources: ['dek', 'commercial'],
    priceFactors: ['typ', 'tloustka', 'r_hodnota']
  },

  // Опалубка (pronájem)
  BEDNENI: {
    id: 'bedneni',
    name: 'Bednění',
    unit: 'm²/den',
    sources: ['commercial', 'peri', 'doka'],
    priceFactors: ['typ_systemu', 'pocet_pouziti', 'doba_pronajmu']
  },

  // Техника (pronájem)
  TECHNIKA: {
    id: 'technika',
    name: 'Technika',
    unit: 'den',
    sources: ['commercial', 'historical'],
    priceFactors: ['typ', 'nosnost', 'dosah']
  }
};

// ============================================================================
// DEFAULT PRICES (fallback from experience)
// ============================================================================

export const DEFAULT_PRICES = {
  lastUpdate: '2026-02-01',
  region: 'Česká republika',
  currency: 'CZK',
  note: 'Orientační ceny z praxe, použít pouze pokud není aktuální nabídka',

  beton: {
    'C16/20': { price: 2350, unit: 'm³', trend: 'stable' },
    'C20/25': { price: 2520, unit: 'm³', trend: 'rising' },
    'C25/30': { price: 2750, unit: 'm³', trend: 'rising' },
    'C30/37': { price: 3100, unit: 'm³', trend: 'stable' },
    'C35/45': { price: 3450, unit: 'm³', trend: 'stable' },
    'C40/50': { price: 3800, unit: 'm³', trend: 'stable' },
    cerpadlo_den: { price: 9000, unit: 'den', trend: 'rising' },
    doprava_km: { price: 45, unit: 'km', trend: 'stable' }
  },

  armatura: {
    'B500B_d8': { price: 26.5, unit: 'kg', trend: 'declining' },
    'B500B_d10': { price: 27.0, unit: 'kg', trend: 'stable' },
    'B500B_d12': { price: 29.0, unit: 'kg', trend: 'stable' },
    'B500B_d14': { price: 28.5, unit: 'kg', trend: 'stable' },
    'B500B_d16': { price: 28.0, unit: 'kg', trend: 'stable' },
    'B500B_d20': { price: 27.5, unit: 'kg', trend: 'stable' },
    'B500B_d25': { price: 27.0, unit: 'kg', trend: 'stable' },
    'KARI_6x150x150': { price: 85, unit: 'm²', trend: 'stable' },
    'KARI_8x150x150': { price: 120, unit: 'm²', trend: 'stable' }
  },

  zdivo: {
    'Porotherm_30_Profi': { price: 58, unit: 'ks', trend: 'rising' },
    'Porotherm_44_Profi': { price: 95, unit: 'ks', trend: 'rising' },
    'Ytong_P2-400_250': { price: 125, unit: 'ks', trend: 'stable' },
    'Betonova_tvarnice_400': { price: 32, unit: 'ks', trend: 'stable' }
  },

  izolace: {
    'EPS_100_100mm': { price: 285, unit: 'm²', trend: 'stable' },
    'XPS_300_100mm': { price: 520, unit: 'm²', trend: 'stable' },
    'Mineralni_vata_100mm': { price: 320, unit: 'm²', trend: 'stable' },
    'Hydroizolace_asfalt': { price: 180, unit: 'm²', trend: 'stable' }
  },

  technika: {
    'Jerab_25t': { price: 4500, unit: 'den', trend: 'stable' },
    'Jerab_50t': { price: 7500, unit: 'den', trend: 'rising' },
    'Jerab_80t': { price: 12000, unit: 'den', trend: 'rising' },
    'Rypadlo_20t': { price: 6500, unit: 'den', trend: 'stable' },
    'Nakladac': { price: 2500, unit: 'den', trend: 'stable' }
  }
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get source configuration by ID
 */
export function getSource(sourceId) {
  const sources = Object.values(PRICE_SOURCES);
  return sources.find(s => s.id === sourceId) || null;
}

/**
 * Get sources for material category
 */
export function getSourcesForCategory(categoryId) {
  const category = MATERIAL_CATEGORIES[categoryId.toUpperCase()];
  if (!category) return [];

  return category.sources.map(sid => getSource(sid)).filter(Boolean);
}

/**
 * Get default price for material
 */
export function getDefaultPrice(category, materialCode) {
  const categoryPrices = DEFAULT_PRICES[category];
  if (!categoryPrices) return null;

  return categoryPrices[materialCode] || null;
}

export default {
  PRICE_SOURCES,
  MATERIAL_CATEGORIES,
  DEFAULT_PRICES,
  getSource,
  getSourcesForCategory,
  getDefaultPrice
};
