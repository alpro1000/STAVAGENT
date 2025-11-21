/**
 * Knowledge Base Types
 *
 * Types for the Knowledge Base system used in Concrete Agent.
 * Based on backend KB structure in app/knowledge_base/
 */

export type KBCategory =
  | 'B1_otkskp_codes'
  | 'B1_rts_codes'
  | 'B1_urs_codes'
  | 'B2_csn_standards'
  | 'B3_current_prices'
  | 'B4_production_benchmarks'
  | 'B5_tech_cards'
  | 'B6_research_papers'
  | 'B7_regulations'
  | 'B8_company_specific'
  | 'B9_Equipment_Specs';

export type KBLanguage = 'cs' | 'sk' | 'en';

export type KBStandardType = 'CSN' | 'EN' | 'ISO' | 'ASTM' | 'DIN' | 'OTHER';

export interface KBItem {
  id: string;
  category: KBCategory;
  title: string;
  description: string;
  content: string;
  language: KBLanguage;
  standardType?: KBStandardType;
  standardCode?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  views: number;
  relatedItems?: string[]; // IDs of related KB items
  metadata?: {
    author?: string;
    version?: string;
    source?: string;
    validity?: {
      from?: Date;
      to?: Date;
    };
  };
}

export interface KBSearchFilters {
  query?: string;
  categories?: KBCategory[];
  languages?: KBLanguage[];
  standardTypes?: KBStandardType[];
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface KBSearchResult {
  items: KBItem[];
  total: number;
  page: number;
  pageSize: number;
  facets?: {
    categories: Record<KBCategory, number>;
    languages: Record<KBLanguage, number>;
    standardTypes: Record<KBStandardType, number>;
    tags: Record<string, number>;
  };
}

export interface KBStatistics {
  totalItems: number;
  itemsByCategory: Record<KBCategory, number>;
  itemsByLanguage: Record<KBLanguage, number>;
  mostViewed: Array<{
    id: string;
    title: string;
    views: number;
    category: KBCategory;
  }>;
  recentlyUpdated: Array<{
    id: string;
    title: string;
    updatedAt: Date;
    category: KBCategory;
  }>;
}

// Display view modes
export type KBViewMode = 'list' | 'grid' | 'table';

// Category metadata for UI display
export const KB_CATEGORY_INFO: Record<
  KBCategory,
  { label: string; icon: string; color: string }
> = {
  B1_otkskp_codes: {
    label: 'OTSKP Kódy',
    icon: '🔢',
    color: 'blue',
  },
  B1_rts_codes: {
    label: 'RTS Kódy',
    icon: '📊',
    color: 'green',
  },
  B1_urs_codes: {
    label: 'URS Kódy',
    icon: '📋',
    color: 'purple',
  },
  B2_csn_standards: {
    label: 'ČSN Normy',
    icon: '📜',
    color: 'red',
  },
  B3_current_prices: {
    label: 'Aktuální Ceny',
    icon: '💰',
    color: 'yellow',
  },
  B4_production_benchmarks: {
    label: 'Výkonové Normy',
    icon: '⚡',
    color: 'orange',
  },
  B5_tech_cards: {
    label: 'Technické Listy',
    icon: '📄',
    color: 'teal',
  },
  B6_research_papers: {
    label: 'Odborné Články',
    icon: '🔬',
    color: 'indigo',
  },
  B7_regulations: {
    label: 'Vyhlášky',
    icon: '⚖️',
    color: 'gray',
  },
  B8_company_specific: {
    label: 'Firemní Dokumenty',
    icon: '🏢',
    color: 'cyan',
  },
  B9_Equipment_Specs: {
    label: 'Technologie',
    icon: '🔧',
    color: 'pink',
  },
};
