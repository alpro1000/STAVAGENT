/**
 * ItemsTable Component
 * Tabulka položek s podporou třídění, výběru a filtrování podle skupiny
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, ChevronRight, Sparkles, Globe, Filter, Check } from 'lucide-react';
import type { ParsedItem } from '../../types';
import { useRegistryStore } from '../../stores/registryStore';
import { autoAssignSimilarItems } from '../../services/similarity/similarityService';
import { AlertModal } from '../common/Modal';
import { SkupinaAutocomplete } from './SkupinaAutocomplete';
import { RowActionsCell } from './RowActionsCell';
import { BulkActionsBar } from './BulkActionsBar';
import './ItemsTable.css';

interface ItemsTableProps {
  items: ParsedItem[];
  projectId: string;
  sheetId: string;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  showOnlyWorkItems?: boolean;
}

const columnHelper = createColumnHelper<ParsedItem>();

/** Label for items with no skupina assigned */
const NO_GROUP_LABEL = '(Bez skupiny)';

export function ItemsTable({
  items,
  projectId,
  sheetId,
  selectedIds = new Set(),
  onSelectionChange,
  sorting: externalSorting,
  onSortingChange: externalOnSortingChange,
  showOnlyWorkItems = false,
}: ItemsTableProps) {
  const { setItemSkupina, setItemSkupinaGlobal, getAllGroups, addCustomGroup, bulkSetSkupina, getProject } = useRegistryStore();
  const allGroups = getAllGroups();
  const [applyingToSimilar, setApplyingToSimilar] = useState<string | null>(null);
  const [applyingGlobal, setApplyingGlobal] = useState<string | null>(null);

  // Excel-style filter state
  const [filterGroups, setFilterGroups] = useState<Set<string>>(new Set()); // empty = show all
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showFilterDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterDropdown]);

  // Модальное окно для уведомлений
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'info' | 'success' | 'warning' | 'error';
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info',
  });

  // Get groups present in current items with counts
  const groupStats = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach(item => {
      const key = item.skupina || '';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    // Sort: named groups first (alphabetically), then empty group last
    const entries = Array.from(counts.entries()).sort((a, b) => {
      if (a[0] === '' && b[0] !== '') return 1;
      if (a[0] !== '' && b[0] === '') return -1;
      return a[0].localeCompare(b[0]);
    });
    return entries;
  }, [items]);

  const isFilterActive = filterGroups.size > 0;

  // Filter items based on selected groups
  const filteredItems = useMemo(() => {
    if (filterGroups.size === 0) return items;
    return items.filter(item => {
      const skupina = item.skupina || '';
      return filterGroups.has(skupina);
    });
  }, [items, filterGroups]);

  // Collapse/expand state for subordinate rows (collapsed by default)
  const [expandedMainIds, setExpandedMainIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (mainId: string) => {
    setExpandedMainIds(prev => {
      const next = new Set(prev);
      if (next.has(mainId)) {
        next.delete(mainId);
      } else {
        next.add(mainId);
      }
      return next;
    });
  };

  // Count subordinate rows per main item (always from ALL items, not group-filtered)
  const subordinateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach(item => {
      if (item.rowRole === 'subordinate' && item.parentItemId) {
        counts.set(item.parentItemId, (counts.get(item.parentItemId) || 0) + 1);
      }
    });
    return counts;
  }, [items]);

  // Compute visible items: combines skupina filter, showOnlyWorkItems, and collapse/expand
  const visibleItems = useMemo(() => {
    return filteredItems.filter(item => {
      // showOnlyWorkItems filter FIRST (highest priority)
      // When enabled, show ONLY main/section items, hide ALL subordinates
      if (showOnlyWorkItems) {
        // Use rowRole if available
        const isMainRow = item.rowRole
          ? (item.rowRole === 'main' || item.rowRole === 'section')
          : null;

        // If rowRole is defined, use it
        if (isMainRow !== null) {
          return isMainRow;
        }

        // Fallback for items without rowRole: old logic (kod + quantity check)
        const hasKod = item.kod && item.kod.trim().length > 0;
        const hasQuantityOrPrice =
          (item.mnozstvi !== null && item.mnozstvi !== 0) ||
          (item.cenaJednotkova !== null && item.cenaJednotkova !== 0);
        return hasKod && hasQuantityOrPrice;
      }

      // Subordinate rows: show only when their parent is expanded (only when showOnlyWorkItems is OFF)
      if (item.rowRole === 'subordinate' && item.parentItemId) {
        return expandedMainIds.has(item.parentItemId);
      }

      return true;
    });
  }, [filteredItems, expandedMainIds, showOnlyWorkItems]);

  const hiddenSubordinateCount = items.filter(
    item => item.rowRole === 'subordinate' && item.parentItemId && !expandedMainIds.has(item.parentItemId)
  ).length;

  const toggleGroupFilter = (group: string) => {
    setFilterGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const selectAllGroups = () => {
    // Select all = clear filter (show everything)
    setFilterGroups(new Set());
  };

  const selectOnlyGroup = (group: string) => {
    setFilterGroups(new Set([group]));
  };

  // Применить группу к похожим позициям во ВСЕХ листах проекта
  const applyToSimilar = (sourceItem: ParsedItem) => {
    if (!sourceItem.skupina) return;

    setApplyingToSimilar(sourceItem.id);

    // Получаем весь проект
    const project = getProject(projectId);
    if (!project) {
      setApplyingToSimilar(null);
      return;
    }

    // Проходим по всем листам проекта и ищем похожие элементы
    let totalSuggestions = 0;
    let totalConfidence = 0;
    const sheetStats: Array<{ sheetName: string; count: number }> = [];

    project.sheets.forEach((sheet) => {
      // Находим похожие позиции в этом листе
      const suggestions = autoAssignSimilarItems(sourceItem, sheet.items, 40);

      if (suggestions.length > 0) {
        // Применяем группу ко всем похожим в этом листе
        const updates = suggestions.map((s) => ({
          itemId: s.itemId,
          skupina: s.suggestedSkupina,
        }));

        bulkSetSkupina(projectId, sheet.id, updates);

        // Собираем статистику
        totalSuggestions += suggestions.length;
        totalConfidence += suggestions.reduce((acc, s) => acc + s.confidence, 0);
        sheetStats.push({ sheetName: sheet.name, count: suggestions.length });
      }
    });

    if (totalSuggestions > 0) {
      const avgConfidence = Math.round(totalConfidence / totalSuggestions);
      const sheetList = sheetStats.map(s => `${s.sheetName} (${s.count})`).join(', ');

      setAlertModal({
        isOpen: true,
        title: 'Skupina aplikována v celém projektu',
        message: `Skupina "${sourceItem.skupina}" byla úspěšně aplikována na ${totalSuggestions} podobných položek (průměrná shoda ${avgConfidence}%).\n\nListy: ${sheetList}`,
        variant: 'success',
      });
    } else {
      setAlertModal({
        isOpen: true,
        title: 'Nenalezeny podobné položky',
        message: 'Pro tuto položku nebyly nalezeny žádné podobné položky s dostatečnou shodou (min. 40%) v žádném listu projektu.',
        variant: 'info',
      });
    }

    setApplyingToSimilar(null);
  };

  // Применить группу ко ВСЕМ листам (all projects) с таким же кодом
  const applyToAllSheets = (sourceItem: ParsedItem) => {
    if (!sourceItem.skupina || !sourceItem.kod) return;

    setApplyingGlobal(sourceItem.id);

    const itemKod = sourceItem.kod.trim();
    const skupina = sourceItem.skupina;

    // Apply to all projects with same kod
    setItemSkupinaGlobal(itemKod, skupina);

    // Show success notification
    setAlertModal({
      isOpen: true,
      title: 'Skupina aplikována globálně',
      message: `Skupina "${skupina}" byla aplikována na všechny položky s kódem "${itemKod}" napříč všemi importovanými listy.`,
      variant: 'success',
    });

    setTimeout(() => {
      setApplyingGlobal(null);
    }, 1000);
  };

  // Внутренний стейт для сортировки (если внешний не передан)
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);

  // Используем внешний или внутренний стейт
  const sorting = externalSorting || internalSorting;

  // Wrapper для правильной обработки Updater<SortingState>
  const handleSortingChange = (updater: any) => {
    if (externalOnSortingChange) {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      externalOnSortingChange(newSorting);
    } else {
      setInternalSorting(updater);
    }
  };

  const columns = useMemo(
    () => [
      // Checkbox (для массовых операций)
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="cursor-pointer"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="cursor-pointer"
          />
        ),
        size: 40,
      }),

      // Actions (delete, change role, reorder, attach)
      columnHelper.display({
        id: 'actions',
        header: '⚙️',
        cell: ({ row }) => (
          <RowActionsCell
            item={row.original}
            projectId={projectId}
            sheetId={sheetId}
            allItems={items}
          />
        ),
        size: 160,
      }),

      // Poř. (BOQ line number + expand/collapse toggle)
      columnHelper.accessor('boqLineNumber', {
        header: 'Poř.',
        cell: (info) => {
          const item = info.row.original;
          const value = info.getValue();
          const subCount = subordinateCounts.get(item.id) || 0;
          const isExpanded = expandedMainIds.has(item.id);

          // Main row with subordinates — show toggle
          if (item.rowRole === 'main' && subCount > 0) {
            return (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpanded(item.id); }}
                className="flex items-center gap-0.5 font-mono text-xs tabular-nums hover:text-accent-primary transition-colors"
                title={isExpanded ? 'Sbalit podřízené řádky' : `Rozbalit ${subCount} podřízených řádků`}
              >
                {isExpanded
                  ? <ChevronDown size={14} className="text-text-muted flex-shrink-0" />
                  : <ChevronRight size={14} className="text-text-muted flex-shrink-0" />}
                <span className="text-text-muted">{value}</span>
                <span className="text-text-muted opacity-60 text-[10px] ml-0.5">+{subCount}</span>
              </button>
            );
          }

          // Subordinate row — indent marker
          if (item.rowRole === 'subordinate') {
            return <span className="pl-4 text-xs text-text-muted select-none">↳</span>;
          }

          // Main row without subordinates, section, or unknown
          return value ? (
            <span className="font-mono text-xs text-text-muted tabular-nums pl-4">
              {value}
            </span>
          ) : null;
        },
        size: 70,
        enableSorting: true,
        sortingFn: 'basic',
      }),

      // Kód
      columnHelper.accessor('kod', {
        header: 'Kód',
        cell: (info) => (
          <div className="cell-scrollable-kod font-mono text-sm font-semibold">
            {info.getValue()}
          </div>
        ),
        size: 100,
        enableSorting: true,
      }),

      // Popis
      columnHelper.accessor('popis', {
        header: 'Popis',
        cell: (info) => (
          <div className="cell-scrollable text-sm">
            {info.getValue()}
          </div>
        ),
        size: 300,
        enableSorting: true,
      }),

      // MJ
      columnHelper.accessor('mj', {
        header: 'MJ',
        cell: (info) => (
          <span className="text-sm text-text-secondary">{info.getValue()}</span>
        ),
        size: 60,
        enableSorting: true,
      }),

      // Množství
      columnHelper.accessor('mnozstvi', {
        header: 'Množství',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className="text-sm font-medium tabular-nums">
              {value !== null ? value.toLocaleString('cs-CZ') : '-'}
            </span>
          );
        },
        size: 100,
        enableSorting: true,
        sortingFn: 'basic', // Числовая сортировка
      }),

      // Cena celkem
      columnHelper.accessor('cenaCelkem', {
        header: 'Cena celkem',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className="text-sm font-semibold tabular-nums">
              {value !== null
                ? `${value.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč`
                : '-'}
            </span>
          );
        },
        size: 120,
        enableSorting: true,
        sortingFn: 'basic', // Числовая сортировка
      }),

      // Skupina
      columnHelper.accessor('skupina', {
        header: () => (
          <div className="flex items-center gap-2">
            <span>Skupina</span>
            {groupStats.length > 0 && (
              <div className="relative" ref={filterDropdownRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFilterDropdown(!showFilterDropdown);
                  }}
                  className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
                    isFilterActive
                      ? 'bg-accent-primary text-white'
                      : 'bg-bg-secondary hover:bg-bg-tertiary'
                  }`}
                  title="Filtr podle skupiny"
                >
                  <Filter size={14} />
                  {isFilterActive && (
                    <span>{filterGroups.size}/{groupStats.length}</span>
                  )}
                </button>

                {/* Excel-style filter dropdown */}
                {showFilterDropdown && (
                  <div
                    className="absolute right-0 top-full mt-1 bg-bg-primary border-2 border-border-color rounded-lg z-50 min-w-[240px] max-h-[340px] overflow-y-auto"
                    style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Select all / Clear */}
                    <div className="border-b border-border-color px-3 py-2 flex items-center gap-2">
                      <button
                        onClick={selectAllGroups}
                        className="text-xs text-accent-primary hover:underline"
                      >
                        Zobrazit vše
                      </button>
                      <span className="text-text-muted text-xs">
                        ({items.length} položek)
                      </span>
                    </div>

                    {/* Group checkboxes */}
                    <div className="py-1">
                      {groupStats.map(([group, count]) => {
                        const label = group || NO_GROUP_LABEL;
                        const isChecked = filterGroups.size === 0 || filterGroups.has(group);
                        return (
                          <div
                            key={group}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-secondary cursor-pointer text-sm"
                            onClick={() => toggleGroupFilter(group)}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                              isChecked
                                ? 'bg-accent-primary border-accent-primary'
                                : 'border-border-color'
                            }`}>
                              {isChecked && <Check size={12} className="text-white" />}
                            </div>
                            <span className={`flex-1 truncate ${group ? 'font-medium text-accent-primary' : 'text-text-muted italic'}`}>
                              {label}
                            </span>
                            <span className="text-text-muted text-xs flex-shrink-0">
                              {count}
                            </span>
                            {group && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectOnlyGroup(group);
                                }}
                                className="text-[10px] text-text-muted hover:text-accent-primary px-1"
                                title={`Zobrazit pouze ${label}`}
                              >
                                pouze
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer with count */}
                    {isFilterActive && (
                      <div className="border-t border-border-color px-3 py-2 text-xs text-text-muted">
                        Zobrazeno {filteredItems.length} z {items.length} položek
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ),
        cell: (info) => {
          const item = info.row.original;
          const currentSkupina = info.getValue();
          const isApplying = applyingToSimilar === item.id;

          return (
            <div className="flex items-center gap-1">
              <div className="flex-1">
                <SkupinaAutocomplete
                  value={currentSkupina}
                  onChange={async (value, shouldLearn = false) => {
                    if (value === null) {
                      setItemSkupina(projectId, sheetId, item.id, null!);
                    } else {
                      setItemSkupina(projectId, sheetId, item.id, value);

                      // If user wants to remember this classification
                      if (shouldLearn) {
                        try {
                          console.log('[ItemsTable] Recording correction for learning:', item.id, value);

                          await fetch('/api/ai-agent', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              operation: 'record-correction',
                              projectId,
                              sheetId,
                              itemId: item.id,
                              newSkupina: value,
                              allItems: items,
                            }),
                          });

                          console.log('[ItemsTable] ✓ Correction recorded successfully');
                        } catch (error) {
                          console.error('[ItemsTable] Failed to record correction:', error);
                          // Don't block the UI - correction was already applied
                        }
                      }
                    }
                  }}
                  allGroups={allGroups}
                  onAddGroup={addCustomGroup}
                  itemId={item.id}
                  enableLearning={true}
                />
              </div>
              {currentSkupina && item.kod && (
                <>
                  <button
                    onClick={() => applyToSimilar(item)}
                    disabled={isApplying}
                    title="Aplikovat na podobné položky v celém projektu (všechny listy)"
                    className="p-1 rounded hover:bg-bg-secondary transition-colors disabled:opacity-50"
                  >
                    <Sparkles size={16} className="text-accent-primary" />
                  </button>
                  <button
                    onClick={() => applyToAllSheets(item)}
                    disabled={applyingGlobal === item.id}
                    title="Aplikovat na VŠECHNY listy se stejným kódem"
                    className="p-1 rounded hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                  >
                    <Globe size={16} className="text-blue-500" />
                  </button>
                </>
              )}
            </div>
          );
        },
        size: 240,
        enableSorting: true,
      }),
    ],
    [projectId, sheetId, setItemSkupina, allGroups, addCustomGroup, applyToSimilar, applyingToSimilar, applyToAllSheets, applyingGlobal, groupStats, isFilterActive, filterGroups, showFilterDropdown, filteredItems.length, items.length, subordinateCounts, expandedMainIds, toggleExpanded]
  );

  const table = useReactTable({
    data: visibleItems,
    columns,
    state: {
      sorting,
      rowSelection: Object.fromEntries(
        Array.from(selectedIds).map((id) => [
          visibleItems.findIndex((item) => item.id === id),
          true,
        ])
      ),
    },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: (updater) => {
      if (!onSelectionChange) return;

      const newSelection =
        typeof updater === 'function'
          ? updater(
              Object.fromEntries(
                Array.from(selectedIds).map((id) => [
                  visibleItems.findIndex((item) => item.id === id),
                  true,
                ])
              )
            )
          : updater;

      const newSelectedIds = new Set(
        Object.keys(newSelection)
          .filter((key) => newSelection[key])
          .map((key) => visibleItems[parseInt(key)]?.id)
          .filter(Boolean)
      );

      onSelectionChange(newSelectedIds);
    },
  });

  if (items.length === 0) {
    return (
      <div className="card text-center py-12">
        <p className="text-text-secondary">Nebyly nalezeny žádné položky</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden">
      <div className="card">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={`
                      ${header.column.getCanSort()
                        ? 'cursor-pointer select-none hover:bg-bg-secondary transition-colors'
                        : ''}
                    `}
                    style={{ width: header.getSize() }}
                    title={header.column.getCanSort() ? 'Klikněte pro seřazení' : undefined}
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getIsSorted() && (
                        <span className="text-accent-primary">
                          {header.column.getIsSorted() === 'asc' ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={row.original.rowRole === 'subordinate' ? 'opacity-70' : ''}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-border-color px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {isFilterActive
            ? `Zobrazeno ${visibleItems.length} z ${items.length} položek (filtr aktivní)`
            : `Zobrazeno ${visibleItems.length} z ${items.length} položek`
          }
          {hiddenSubordinateCount > 0 && (
            <span className="text-text-muted ml-1">
              ({hiddenSubordinateCount} podřízených skryto)
            </span>
          )}
        </p>
        {selectedIds.size > 0 && (
          <p className="text-sm font-medium text-accent-primary">
            Vybráno: {selectedIds.size}
          </p>
        )}
      </div>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        variant={alertModal.variant}
      />

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={selectedIds}
        items={items}
        projectId={projectId}
        sheetId={sheetId}
        onClearSelection={() => onSelectionChange?.(new Set())}
      />
      </div>
    </div>
  );
}
