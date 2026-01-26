/**
 * Multi-Project Search Service
 *
 * Phase 6: Fuzzy search across all projects with Fuse.js
 */

import Fuse, { type IFuseOptions } from 'fuse.js';
import type { ParsedItem } from '../../types/item';
import type { Project } from '../../types/project';

/**
 * Search result item
 */
export interface SearchResultItem {
  item: ParsedItem;
  project: Project;
  score: number;          // 0-1 (lower is better)
  matches: Array<{
    key: string;
    value: string;
    indices: readonly [number, number][];
  }>;
}

/**
 * Search filters
 */
export interface SearchFilters {
  projectIds?: string[];       // Filter by specific projects
  skupiny?: string[];          // Filter by work groups
  minCena?: number;            // Minimum price
  maxCena?: number;            // Maximum price
  hasSkupina?: boolean;        // Only classified/unclassified
}

/**
 * Fuse.js configuration for optimal search
 */
const FUSE_OPTIONS: IFuseOptions<ParsedItem> = {
  keys: [
    { name: 'kod', weight: 0.4 },           // Code - highest weight
    { name: 'popis', weight: 0.3 },         // Description
    { name: 'popisFull', weight: 0.2 },     // Full description
    { name: 'mj', weight: 0.05 },           // Unit
    { name: 'skupina', weight: 0.05 },      // Group
  ],
  threshold: 0.4,              // 0-1, lower = more strict
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
  ignoreLocation: true,        // Don't care where in string match occurs
  useExtendedSearch: true,     // Enable advanced search queries
};

/**
 * Search across all projects
 */
export function searchProjects(
  projects: Project[],
  query: string,
  filters?: SearchFilters
): SearchResultItem[] {
  if (!query.trim()) return [];

  // Collect all items from all projects
  const allItems: Array<{ item: ParsedItem; project: Project }> = [];

  for (const project of projects) {
    // Apply project filter
    if (filters?.projectIds && !filters.projectIds.includes(project.id)) {
      continue;
    }

    // Loop through all sheets in project
    for (const sheet of project.sheets) {
      for (const item of sheet.items) {
        // Apply skupina filter
        if (filters?.skupiny && filters.skupiny.length > 0) {
          if (!item.skupina || !filters.skupiny.includes(item.skupina)) {
            continue;
          }
        }

        // Apply hasSkupina filter
        if (filters?.hasSkupina !== undefined) {
          const itemHasSkupina = item.skupina !== null;
          if (filters.hasSkupina !== itemHasSkupina) {
            continue;
          }
        }

        // Apply price filters
        if (filters?.minCena !== undefined && (item.cenaCelkem || 0) < filters.minCena) {
          continue;
        }
        if (filters?.maxCena !== undefined && (item.cenaCelkem || 0) > filters.maxCena) {
          continue;
        }

        allItems.push({ item, project });
      }
    }
  }

  // Create Fuse instance
  const fuse = new Fuse(
    allItems.map(x => x.item),
    FUSE_OPTIONS
  );

  // Search
  const results = fuse.search(query);

  // Map results back to include project info
  return results.map(result => {
    const itemWithProject = allItems.find(x => x.item.id === result.item.id)!;

    return {
      item: result.item,
      project: itemWithProject.project,
      score: result.score || 0,
      matches: result.matches?.map(match => ({
        key: match.key || '',
        value: match.value || '',
        indices: match.indices || [],
      })) || [],
    };
  });
}

/**
 * Search within single project
 */
export function searchInProject(
  project: Project,
  query: string,
  filters?: Omit<SearchFilters, 'projectIds'>
): SearchResultItem[] {
  return searchProjects([project], query, filters);
}

/**
 * Get search suggestions (common queries)
 */
export function getSearchSuggestions(projects: Project[]): string[] {
  const suggestions = new Set<string>();

  // Collect all groups
  for (const project of projects) {
    for (const sheet of project.sheets) {
      for (const item of sheet.items) {
        if (item.skupina) {
          suggestions.add(item.skupina);
        }
      }
    }
  }

  // Add common search terms
  suggestions.add('beton');
  suggestions.add('výztuž');
  suggestions.add('bednění');
  suggestions.add('základy');
  suggestions.add('piloty');

  return Array.from(suggestions).sort();
}

/**
 * Highlight matched text
 */
export function highlightMatches(
  text: string,
  indices: readonly [number, number][]
): Array<{ text: string; highlight: boolean }> {
  if (!indices || indices.length === 0) {
    return [{ text, highlight: false }];
  }

  const result: Array<{ text: string; highlight: boolean }> = [];
  let lastIndex = 0;

  // Sort indices by start position
  const sortedIndices = [...indices].sort((a, b) => a[0] - b[0]);

  for (const [start, end] of sortedIndices) {
    // Add non-highlighted text before match
    if (start > lastIndex) {
      result.push({
        text: text.slice(lastIndex, start),
        highlight: false,
      });
    }

    // Add highlighted match
    result.push({
      text: text.slice(start, end + 1),
      highlight: true,
    });

    lastIndex = end + 1;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result.push({
      text: text.slice(lastIndex),
      highlight: false,
    });
  }

  return result;
}
