/**
 * AppRibbon — Row 1 of the ribbon layout.
 *
 * 48-px-tall dark-navy strip that fixes the application brand on the
 * left, delegates full-text search to the existing `<SearchBar>` in
 * the middle, and surfaces the three global actions on the right
 * (Poptávka cen / Export / Import).
 *
 * All handlers are passed in from the host — this component owns
 * nothing except its layout.
 */

import { Building2 } from 'lucide-react';
import { SearchBar } from '../components/search/SearchBar';
import type { SearchFilters } from '../services/search/searchService';

export interface AppRibbonProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  onClearSearch: () => void;
  onOpenPriceRequest: () => void;
  onExport: () => void;
  onImport: () => void;
  /** Disable the secondary actions when there are no projects to act on. */
  hasProjects: boolean;
}

export function AppRibbon({
  onSearch,
  onClearSearch,
  onOpenPriceRequest,
  onExport,
  onImport,
  hasProjects,
}: AppRibbonProps) {
  return (
    <header
      className="h-12 flex items-center gap-4 px-4 border-b flex-shrink-0"
      style={{
        // Monolit-Planner / Beton Calculator-style "concrete" surface —
        // light grey gradient (panel-clean → panel-clean-end) so the
        // ribbon reads as part of the unified STAVAGENT visual brand
        // instead of the dark navy from SPEC v1.0 (which felt disjoint
        // from the rest of the ecosystem). Tokens are hardcoded here
        // for visual parity with Monolit's `c-header` rule —
        // tokens.css will get aliases in a follow-up commit.
        background: 'linear-gradient(145deg, #EAEBEC 0%, #DCDEE0 100%)',
        borderColor: 'var(--flat-border)',
        color: 'var(--flat-text)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Building2 className="w-5 h-5" style={{ color: 'var(--flat-accent)' }} />
        <h1
          className="hidden md:block font-semibold text-[14px] tracking-wider uppercase"
          style={{ fontFamily: 'var(--font-body)', color: 'var(--flat-text)' }}
        >
          Registr rozpočtů
        </h1>
      </div>

      {/* Center: search. Existing SearchBar already surfaces onSearch /
          onClear + internal filter toggle. Wrapped in a width-capped
          div so the bar doesn't stretch edge-to-edge on wide screens. */}
      <div className="flex-1 max-w-[640px] mx-auto min-w-0">
        <SearchBar
          onSearch={onSearch}
          onClear={onClearSearch}
          placeholder="Hledat v projektech... (kód, popis, skupina)"
          showFilters={false}
        />
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onOpenPriceRequest}
          disabled={!hasProjects}
          className="h-8 px-3 text-[13px] rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--flat-hover)]"
          style={{
            borderColor: 'var(--flat-border)',
            color: 'var(--flat-text)',
            fontFamily: 'var(--font-body)',
            background: 'rgba(255,255,255,0.6)',
          }}
        >
          Poptávka cen
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={!hasProjects}
          className="h-8 px-3 text-[13px] rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--flat-hover)]"
          style={{
            borderColor: 'var(--flat-border)',
            color: 'var(--flat-text)',
            fontFamily: 'var(--font-body)',
            background: 'rgba(255,255,255,0.6)',
          }}
        >
          Export Excel
        </button>
        <button
          type="button"
          onClick={onImport}
          className="h-8 px-3 text-[13px] rounded-md transition-colors hover:bg-[var(--flat-accent-hover)]"
          style={{
            background: 'var(--flat-accent)',
            color: '#FFFFFF',
            fontFamily: 'var(--font-body)',
          }}
        >
          Importovat
        </button>
      </div>
    </header>
  );
}
