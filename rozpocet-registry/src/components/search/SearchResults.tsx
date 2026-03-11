/**
 * Search Results Component
 *
 * Table-based search results with:
 * - Full item info (kod, full popis, MJ, množství, cena, skupina)
 * - Inline skupina editing via autocomplete
 * - Bulk apply skupina to all/selected results
 * - Highlighted matched text
 * - Expandable detail rows showing ALL rozpočet data (description, metadata, source)
 */

import { useState, useMemo, useCallback, Fragment } from 'react';
import { CheckSquare, Square, AlertTriangle, ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { SearchResultItem } from '../../services/search/searchService';
import { highlightMatches } from '../../services/search/searchService';
import { useRegistryStore } from '../../stores/registryStore';
import { SkupinaAutocomplete } from '../items/SkupinaAutocomplete';

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
  const { setItemSkupina, getAllGroups, addCustomGroup } = useRegistryStore();
  const allGroups = getAllGroups();

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkSkupina, setBulkSkupina] = useState<string | null>(null);
  const [bulkApplied, setBulkApplied] = useState<string | null>(null);

  // Count by skupina status
  const stats = useMemo(() => {
    const withGroup = results.filter(r => r.item.skupina).length;
    const withoutGroup = results.length - withGroup;
    const groups = new Map<string, number>();
    results.forEach(r => {
      const g = r.item.skupina || '(Bez skupiny)';
      groups.set(g, (groups.get(g) || 0) + 1);
    });
    return { withGroup, withoutGroup, groups };
  }, [results]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-text-secondary">Hledání...</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-4xl mb-4">🔍</div>
        <div className="text-text-primary font-medium mb-1">Žádné výsledky</div>
        <div className="text-sm text-text-secondary">Zkuste změnit hledaný výraz nebo filtry</div>
      </div>
    );
  }

  // Selection helpers
  const allSelected = selectedIds.size === results.length && results.length > 0;
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map(r => r.item.id)));
    }
  };

  const toggleItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Bulk apply skupina
  const handleBulkApply = () => {
    if (!bulkSkupina) return;
    const targets = someSelected
      ? results.filter(r => selectedIds.has(r.item.id))
      : results;

    for (const r of targets) {
      const sheetId = r.item.source?.sheetName || '';
      // Find the correct sheet ID by matching sheet name within the project
      const project = r.project;
      const sheet = project.sheets.find(s => s.name === sheetId) || project.sheets[0];
      if (sheet) {
        setItemSkupina(project.id, sheet.id, r.item.id, bulkSkupina);
      }
    }

    setBulkApplied(`Přiřazeno "${bulkSkupina}" → ${targets.length} položek`);
    setTimeout(() => setBulkApplied(null), 4000);
  };

  // Inline skupina change for single item
  const handleSkupinaChange = (result: SearchResultItem, skupina: string | null) => {
    if (!skupina) return;
    const project = result.project;
    const sheet = project.sheets.find(s =>
      s.items.some(i => i.id === result.item.id)
    ) || project.sheets[0];
    if (sheet) {
      setItemSkupina(project.id, sheet.id, result.item.id, skupina);
    }
  };

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-text-secondary">
            Nalezeno <span className="font-semibold text-text-primary">{results.length}</span> položek
          </span>
          <span className="text-text-muted">|</span>
          <span className="text-green-600 font-medium">{stats.withGroup} klasifikováno</span>
          {stats.withoutGroup > 0 && (
            <span className="text-orange-500 font-medium">{stats.withoutGroup} bez skupiny</span>
          )}
        </div>

        {/* Group distribution chips */}
        <div className="flex items-center gap-1 flex-wrap">
          {Array.from(stats.groups.entries()).map(([g, count]) => (
            <span
              key={g}
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                g === '(Bez skupiny)'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {g}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      <div className="flex items-center gap-3 p-3 bg-[var(--data-surface)] rounded-lg border border-[var(--divider)]">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          {allSelected ? <CheckSquare size={18} className="text-accent-primary" /> : <Square size={18} />}
          {someSelected ? `${selectedIds.size} vybráno` : 'Vybrat vše'}
        </button>

        <span className="text-text-muted">|</span>

        <span className="text-sm text-text-secondary whitespace-nowrap">Přiřadit skupinu:</span>
        <div className="w-56">
          <SkupinaAutocomplete
            value={bulkSkupina}
            onChange={setBulkSkupina}
            allGroups={allGroups}
            onAddGroup={addCustomGroup}
          />
        </div>

        <button
          onClick={handleBulkApply}
          disabled={!bulkSkupina}
          className="btn btn-primary text-sm px-4 py-1.5 disabled:opacity-40"
        >
          {someSelected ? `Přiřadit (${selectedIds.size})` : `Přiřadit všem (${results.length})`}
        </button>

        {bulkApplied && (
          <span className="text-sm text-green-600 font-medium">{bulkApplied}</span>
        )}
      </div>

      {/* Warning */}
      <div className="flex items-center gap-2 text-xs text-text-muted px-1">
        <AlertTriangle size={14} className="text-orange-400 flex-shrink-0" />
        <span>Zkontrolujte výsledky - hledání může zahrnout i nepřesné shody. Skupinu lze změnit u každé položky jednotlivě.</span>
      </div>

      {/* Results table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--divider)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--panel-clean)] border-b border-[var(--divider)]">
              <th className="w-10 px-2 py-2.5 text-center">
                <button onClick={toggleAll} className="text-text-muted hover:text-text-primary">
                  {allSelected
                    ? <CheckSquare size={16} className="text-accent-primary" />
                    : <Square size={16} />
                  }
                </button>
              </th>
              <th className="px-3 py-2.5 text-left font-semibold text-text-primary whitespace-nowrap">Kód</th>
              <th className="px-3 py-2.5 text-left font-semibold text-text-primary">Popis</th>
              <th className="px-3 py-2.5 text-center font-semibold text-text-primary whitespace-nowrap">MJ</th>
              <th className="px-3 py-2.5 text-right font-semibold text-text-primary whitespace-nowrap">Množství</th>
              <th className="px-3 py-2.5 text-right font-semibold text-text-primary whitespace-nowrap">Cena celkem</th>
              <th className="px-3 py-2.5 text-left font-semibold text-text-primary whitespace-nowrap min-w-[200px]">Skupina</th>
              <th className="px-3 py-2.5 text-left font-semibold text-text-primary whitespace-nowrap">Zdroj</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, idx) => (
              <SearchResultRow
                key={`${result.project.id}-${result.item.id}-${idx}`}
                result={result}
                isSelected={selectedIds.has(result.item.id)}
                onToggle={() => toggleItem(result.item.id)}
                onNavigate={() => onSelectItem(result)}
                onSkupinaChange={(s) => handleSkupinaChange(result, s)}
                allGroups={allGroups}
                onAddGroup={addCustomGroup}
                isAlt={idx % 2 === 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Single search result row
 */
interface SearchResultRowProps {
  result: SearchResultItem;
  isSelected: boolean;
  onToggle: () => void;
  onNavigate: () => void;
  onSkupinaChange: (skupina: string | null) => void;
  allGroups: string[];
  onAddGroup: (g: string) => void;
  isAlt: boolean;
}

function SearchResultRow({
  result,
  isSelected,
  onToggle,
  onNavigate,
  onSkupinaChange,
  allGroups,
  onAddGroup,
  isAlt,
}: SearchResultRowProps) {
  const { item, project, matches } = result;
  const [expanded, setExpanded] = useState(false);

  const kodMatch = matches.find(m => m.key === 'kod');
  const popisMatch = matches.find(m => m.key === 'popis');
  const popisFullMatch = matches.find(m => m.key === 'popisFull');

  const hasDetail = item.popisDetail && item.popisDetail.length > 0;

  // Check if the match was found only in popisFull (i.e. in detail lines, not in main popis)
  const matchInDetailOnly = !popisMatch && !!popisFullMatch;

  // Find parent sheet for metadata
  const sheet = project.sheets.find(s =>
    s.items.some(i => i.id === item.id)
  );
  const sheetName = sheet?.name || item.source?.sheetName || '';
  const metadata = sheet?.metadata;

  // Check if there is any extra data to show in expanded view
  const hasMetadata = !!(
    item.cenaJednotkova ||
    metadata?.oddil ||
    metadata?.stavba ||
    metadata?.projectNumber ||
    item.skupinaSuggested ||
    item.source?.rowStart ||
    item.source?.cellRef
  );
  // Always expandable: detail lines OR metadata available
  const isExpandable = hasDetail || hasMetadata;

  const toggleExpand = useCallback(() => {
    if (isExpandable) setExpanded(prev => !prev);
  }, [isExpandable]);

  const handleExpandKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && isExpandable) {
      e.preventDefault();
      setExpanded(prev => !prev);
    }
  }, [isExpandable]);

  const rowBg = isAlt ? 'bg-[var(--data-surface-alt)]' : 'bg-[var(--data-surface)]';

  // Total columns count for the detail row colspan
  const totalCols = 8;

  return (
    <Fragment>
      {/* Main position row */}
      <tr className={`border-b border-[var(--divider)] hover:bg-[var(--panel-clean)] transition-colors ${rowBg}`}>
        {/* Checkbox */}
        <td className="px-2 py-2 text-center">
          <button onClick={onToggle} className="text-text-muted hover:text-text-primary">
            {isSelected
              ? <CheckSquare size={16} className="text-accent-primary" />
              : <Square size={16} />
            }
          </button>
        </td>

        {/* Kód */}
        <td className="px-3 py-2">
          <button
            onClick={onNavigate}
            className="font-mono font-semibold text-text-primary hover:text-accent-primary transition-colors"
            title="Přejít na položku"
          >
            {kodMatch ? (
              <HighlightedText text={item.kod} indices={kodMatch.indices} />
            ) : (
              item.kod
            )}
          </button>
        </td>

        {/* Popis (main line only) + expand toggle */}
        <td className="px-3 py-2 text-text-primary max-w-[400px]">
          <div className="flex items-start gap-1.5">
            {/* Expand/collapse button — always shown if expandable */}
            {isExpandable && (
              <button
                onClick={toggleExpand}
                onKeyDown={handleExpandKeyDown}
                className="flex-shrink-0 mt-0.5 p-0.5 rounded hover:bg-[var(--panel-inset)] text-text-muted hover:text-text-primary transition-colors"
                title={expanded ? 'Sbalit detail' : 'Rozbalit detail'}
                aria-expanded={expanded}
                aria-label={expanded ? 'Sbalit detail položky' : 'Rozbalit detail položky'}
              >
                {expanded
                  ? <ChevronDown size={14} />
                  : <ChevronRight size={14} />
                }
              </button>
            )}
            <div className="min-w-0">
              {/* Main popis line - always shown */}
              <div className="text-sm font-medium" title={item.popis}>
                {popisMatch ? (
                  <HighlightedText text={item.popis} indices={popisMatch.indices} />
                ) : (
                  item.popis
                )}
              </div>
              {/* Hint that match is in detail */}
              {matchInDetailOnly && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-xs text-orange-500 mt-0.5 hover:underline"
                >
                  shoda v popisu — klikněte pro zobrazení
                </button>
              )}
              {/* Detail count when collapsed */}
              {hasDetail && !expanded && !matchInDetailOnly && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-xs text-text-muted mt-0.5 hover:text-text-secondary"
                >
                  +{item.popisDetail.length} řádků popisu
                </button>
              )}
              {/* Metadata hint when collapsed (no detail lines but has metadata) */}
              {!hasDetail && hasMetadata && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-xs text-text-muted mt-0.5 hover:text-text-secondary flex items-center gap-1"
                >
                  <Info size={10} />
                  zobrazit detail
                </button>
              )}
            </div>
          </div>
        </td>

        {/* MJ */}
        <td className="px-3 py-2 text-center text-text-secondary whitespace-nowrap">
          {item.mj}
        </td>

        {/* Množství */}
        <td className="px-3 py-2 text-right font-mono text-text-primary whitespace-nowrap">
          {item.mnozstvi ?? '-'}
        </td>

        {/* Cena celkem */}
        <td className="px-3 py-2 text-right font-mono text-text-primary whitespace-nowrap">
          {item.cenaCelkem != null ? `${item.cenaCelkem.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč` : '-'}
        </td>

        {/* Skupina (editable) */}
        <td className="px-3 py-2">
          <div className="w-full min-w-[180px]">
            <SkupinaAutocomplete
              value={item.skupina}
              onChange={onSkupinaChange}
              allGroups={allGroups}
              onAddGroup={onAddGroup}
            />
          </div>
        </td>

        {/* Zdroj (project / sheet) */}
        <td className="px-3 py-2 text-xs text-text-muted whitespace-nowrap">
          <div className="flex flex-col">
            <span className="font-medium text-text-secondary truncate max-w-[180px]" title={project.fileName}>
              {project.fileName}
            </span>
            {sheetName && (
              <span className="text-text-muted truncate max-w-[180px]" title={sheetName}>
                {sheetName}
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded detail panel — full description + metadata */}
      {expanded && isExpandable && (
        <tr className={`${rowBg} border-b border-[var(--divider)]`}>
          <td colSpan={totalCols} className="px-3 py-0 pb-3">
            <div className="ml-10 pl-3 border-l-2 border-orange-300 py-2 space-y-3">
              {/* Full description lines */}
              {hasDetail && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">
                    Plný popis
                  </div>
                  {item.popisDetail.map((line, i) => {
                    const isMatchLine = popisFullMatch && line.length > 0 &&
                      item.popisFull.includes(line);
                    return (
                      <div key={i} className={`text-xs ${isMatchLine ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {popisFullMatch && isMatchLine ? (
                          <HighlightedTextInLine text={line} fullText={item.popisFull} indices={popisFullMatch.indices} />
                        ) : (
                          line
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Metadata grid */}
              {hasMetadata && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
                  {item.cenaJednotkova != null && (
                    <MetadataField
                      label="Cena/MJ"
                      value={`${item.cenaJednotkova.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč/${item.mj || 'j.'}`}
                    />
                  )}
                  {metadata?.oddil && (
                    <MetadataField label="Oddíl" value={metadata.oddil} />
                  )}
                  {metadata?.stavba && (
                    <MetadataField label="Stavba" value={metadata.stavba} />
                  )}
                  {metadata?.projectNumber && (
                    <MetadataField label="Číslo projektu" value={metadata.projectNumber} />
                  )}
                  {item.source?.rowStart != null && (
                    <MetadataField
                      label="Řádky"
                      value={item.source.rowEnd > item.source.rowStart
                        ? `${item.source.rowStart}–${item.source.rowEnd}`
                        : `${item.source.rowStart}`}
                    />
                  )}
                  {item.source?.cellRef && (
                    <MetadataField label="Buňka" value={item.source.cellRef} />
                  )}
                  {item.skupinaSuggested && item.skupinaSuggested !== item.skupina && (
                    <MetadataField
                      label="AI návrh skupiny"
                      value={item.skupinaSuggested}
                      highlight
                    />
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

/**
 * Metadata field for expanded detail row
 */
function MetadataField({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-text-muted text-[10px] uppercase tracking-wider">{label}</span>
      <span className={`font-medium ${highlight ? 'text-orange-600' : 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  );
}

/**
 * Highlight matching text within a detail line by mapping indices from popisFull to the line
 */
function HighlightedTextInLine({
  text,
  fullText,
  indices,
}: {
  text: string;
  fullText: string;
  indices: readonly [number, number][];
}) {
  // Find where this line starts in the full text
  const lineStart = fullText.indexOf(text);
  if (lineStart === -1) {
    return <>{text}</>;
  }
  const lineEnd = lineStart + text.length;

  // Map full-text indices to line-local indices
  const localIndices: [number, number][] = [];
  for (const [start, end] of indices) {
    // Check for overlap with this line
    if (end >= lineStart && start < lineEnd) {
      const localStart = Math.max(0, start - lineStart);
      const localEnd = Math.min(text.length - 1, end - lineStart);
      if (localStart <= localEnd) {
        localIndices.push([localStart, localEnd]);
      }
    }
  }

  if (localIndices.length === 0) {
    return <>{text}</>;
  }

  const segments = highlightMatches(text, localIndices);
  return (
    <>
      {segments.map((segment, idx) =>
        segment.highlight ? (
          <mark key={idx} className="bg-orange-200 text-text-primary font-semibold rounded-sm px-0.5">
            {segment.text}
          </mark>
        ) : (
          <span key={idx}>{segment.text}</span>
        )
      )}
    </>
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
            className="bg-orange-200 text-text-primary font-semibold rounded-sm px-0.5"
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
