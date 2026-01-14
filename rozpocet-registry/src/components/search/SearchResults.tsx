/**
 * Search Results Component
 *
 * Phase 6: Display search results with highlighting
 */

import type { SearchResultItem } from '../../services/search/searchService';
import { highlightMatches } from '../../services/search/searchService';

interface SearchResultsProps {
  results: SearchResultItem[];
  onSelectItem: (result: SearchResultItem) => void;
  isLoading?: boolean;
}

export function SearchResults({
  results,
  onSelectItem,
  isLoading = false,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[var(--text-secondary)]">Hledání...</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-4xl mb-4">🔍</div>
        <div className="text-[var(--text-primary)] font-medium mb-1">
          Žádné výsledky
        </div>
        <div className="text-sm text-[var(--text-secondary)]">
          Zkuste změnit hledaný výraz nebo filtry
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Results count */}
      <div className="text-sm text-[var(--text-secondary)]">
        Nalezeno <span className="font-semibold text-[var(--text-primary)]">{results.length}</span> výsledků
      </div>

      {/* Results list */}
      <div className="space-y-2">
        {results.map((result, idx) => (
          <SearchResultCard
            key={`${result.project.id}-${result.item.id}-${idx}`}
            result={result}
            onClick={() => onSelectItem(result)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Single search result card
 */
interface SearchResultCardProps {
  result: SearchResultItem;
  onClick: () => void;
}

function SearchResultCard({ result, onClick }: SearchResultCardProps) {
  const { item, project, matches } = result;

  // Get highlighted text for main fields
  const kodMatch = matches.find(m => m.key === 'kod');
  const popisMatch = matches.find(m => m.key === 'popis');

  return (
    <button
      onClick={onClick}
      className="w-full p-4 bg-[var(--data-surface)] hover:bg-[var(--panel-clean)]
               border border-[var(--divider)] rounded-lg
               transition-all text-left group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Code */}
          <span className="font-mono font-semibold text-[var(--text-primary)]">
            {kodMatch ? (
              <HighlightedText text={item.kod} indices={kodMatch.indices} />
            ) : (
              item.kod
            )}
          </span>

          {/* Group badge */}
          {item.skupina && (
            <span
              className="text-xs px-2 py-1 bg-[var(--accent-orange)]/10
                       text-[var(--accent-orange)] rounded"
            >
              {item.skupina}
            </span>
          )}
        </div>

        {/* Project name */}
        <span className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">
          📁 {project.fileName}
        </span>
      </div>

      {/* Description */}
      <div className="text-sm text-[var(--text-primary)] mb-2">
        {popisMatch ? (
          <HighlightedText text={item.popis} indices={popisMatch.indices} />
        ) : (
          item.popis
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
        <span>
          <span className="font-semibold">{item.mnozstvi}</span> {item.mj}
        </span>
        {item.cenaCelkem && (
          <span>
            <span className="font-semibold">{item.cenaCelkem.toFixed(2)}</span> Kč
          </span>
        )}
        {item.cenaJednotkova && (
          <span className="text-[var(--text-muted)]">
            ({item.cenaJednotkova.toFixed(2)} Kč/{item.mj})
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Highlighted text component
 */
interface HighlightedTextProps {
  text: string;
  indices: readonly [number, number][];
}

function HighlightedText({ text, indices }: HighlightedTextProps) {
  const segments = highlightMatches(text, indices);

  return (
    <>
      {segments.map((segment, idx) =>
        segment.highlight ? (
          <mark
            key={idx}
            className="bg-[var(--accent-orange)]/30 text-[var(--text-primary)] font-semibold"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={idx}>{segment.text}</span>
        )
      )}
    </>
  );
}
