/**
 * Rozpočet Registry - Types
 * Search-related type definitions
 */

import { ParsedItem } from './item';

export interface SearchQuery {
  text?: string;              // полнотекстовый поиск
  kod?: string;               // поиск по коду (поддержка wildcard *)
  skupina?: string[];         // фильтр по группам
  projectIds?: string[];      // фильтр по проектам
  oddil?: string[];           // фильтр по разделам
  cenaMin?: number;           // мин. цена
  cenaMax?: number;           // макс. цена
}

export interface SearchResult {
  items: ParsedItem[];        // найденные позиции
  totalCount: number;         // всего найдено
  byProject: Record<string, number>;  // распределение по проектам
  bySkupina: Record<string, number>;  // распределение по группам
}

export interface SavedFilter {
  id: string;
  name: string;               // "Všechny piloty pro subdodavatele"
  query: SearchQuery;
  createdAt: Date;
}
