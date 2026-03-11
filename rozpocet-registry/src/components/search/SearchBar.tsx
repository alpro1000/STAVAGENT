/**
 * Search Bar Component
 *
 * Phase 6: Multi-project search with filters
 */

import { useState } from 'react';
import { Search, X, Filter } from 'lucide-react';
import type { SearchFilters } from '../../services/search/searchService';
import { DEFAULT_GROUPS } from '../../utils/constants';

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  onClear: () => void;
  placeholder?: string;
  showFilters?: boolean;
}

export function SearchBar({
  onSearch,
  onClear,
  placeholder = 'Hledat v projektech...',
  showFilters = true,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({});

  const handleSearch = (newQuery?: string) => {
    const searchQuery = newQuery !== undefined ? newQuery : query;
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim(), filters);
    }
  };

  const handleClear = () => {
    setQuery('');
    setFilters({});
    setShowFilterPanel(false);
    onClear();
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    // Auto-search if query exists
    if (query.trim()) {
      onSearch(query.trim(), newFilters);
    }
  };

  const activeFiltersCount = Object.values(filters).filter(v =>
    v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : true)
  ).length;

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch();
            }
          }}
          placeholder={placeholder}
          className="w-full pl-12 pr-24 py-3 bg-[var(--data-surface)] border border-[var(--divider)]
                   rounded-lg text-[var(--text-primary)]
                   focus:outline-none focus:ring-2 focus:ring-[var(--accent-orange)]"
        />

        {/* Search icon */}
        <Search
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />

        {/* Actions */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* Clear button */}
          {query && (
            <button
              onClick={handleClear}
              className="p-1.5 hover:bg-[var(--panel-clean)] rounded transition-colors"
              title="Vymazat"
            >
              <X size={18} className="text-[var(--text-muted)]" />
            </button>
          )}

          {/* Filter button */}
          {showFilters && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`p-1.5 rounded transition-colors relative ${
                showFilterPanel
                  ? 'bg-[var(--accent-orange)] text-white'
                  : 'hover:bg-[var(--panel-clean)] text-[var(--text-muted)]'
              }`}
              title="Filtry"
            >
              <Filter size={18} />
              {activeFiltersCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--accent-orange)]
                           text-white text-xs rounded-full flex items-center justify-center"
                >
                  {activeFiltersCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && showFilterPanel && (
        <div className="p-4 bg-[var(--data-surface)] rounded-lg border border-[var(--divider)] space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
              Filtry vyhledávání
            </h4>
            <button
              onClick={() => {
                setFilters({});
                if (query.trim()) {
                  onSearch(query.trim(), {});
                }
              }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Vymazat filtry
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Skupina filter */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Skupina
              </label>
              <select
                multiple
                value={filters.skupiny || []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  handleFilterChange('skupiny', selected.length > 0 ? selected : undefined);
                }}
                className="w-full px-3 py-2 bg-[var(--panel-clean)] border border-[var(--divider)]
                         rounded text-[var(--text-primary)] text-sm max-h-32"
                size={5}
              >
                {DEFAULT_GROUPS.map(group => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Držte Ctrl pro výběr více skupin
              </p>
            </div>

            {/* Price range */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Minimální cena (Kč)
                </label>
                <input
                  type="number"
                  value={filters.minCena || ''}
                  onChange={(e) =>
                    handleFilterChange('minCena', e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 bg-[var(--panel-clean)] border border-[var(--divider)]
                           rounded text-[var(--text-primary)] text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Maximální cena (Kč)
                </label>
                <input
                  type="number"
                  value={filters.maxCena || ''}
                  onChange={(e) =>
                    handleFilterChange('maxCena', e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="999999"
                  className="w-full px-3 py-2 bg-[var(--panel-clean)] border border-[var(--divider)]
                           rounded text-[var(--text-primary)] text-sm"
                />
              </div>
            </div>

            {/* Classification status */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Stav klasifikace
              </label>
              <select
                value={
                  filters.hasSkupina === true
                    ? 'classified'
                    : filters.hasSkupina === false
                    ? 'unclassified'
                    : 'all'
                }
                onChange={(e) => {
                  const value =
                    e.target.value === 'classified'
                      ? true
                      : e.target.value === 'unclassified'
                      ? false
                      : undefined;
                  handleFilterChange('hasSkupina', value);
                }}
                className="w-full px-3 py-2 bg-[var(--panel-clean)] border border-[var(--divider)]
                         rounded text-[var(--text-primary)] text-sm"
              >
                <option value="all">Všechny položky</option>
                <option value="classified">Pouze klasifikované</option>
                <option value="unclassified">Pouze neklasifikované</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
