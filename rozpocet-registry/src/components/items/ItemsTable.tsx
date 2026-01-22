/**
 * ItemsTable Component
 * Tabulka položek s podporou třídění a výběru
 */

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type GroupingState,
  type ExpandedState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown, Sparkles, FolderOpen, Folder } from 'lucide-react';
import type { ParsedItem } from '../../types';
import { useRegistryStore } from '../../stores/registryStore';
import { autoAssignSimilarItems } from '../../services/similarity/similarityService';

interface ItemsTableProps {
  items: ParsedItem[];
  projectId: string;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
}

const columnHelper = createColumnHelper<ParsedItem>();

export function ItemsTable({
  items,
  projectId,
  selectedIds = new Set(),
  onSelectionChange,
  sorting: externalSorting,
  onSortingChange: externalOnSortingChange,
}: ItemsTableProps) {
  const { setItemSkupina, getAllGroups, addCustomGroup, bulkSetSkupina } = useRegistryStore();
  const allGroups = getAllGroups();
  const [applyingToSimilar, setApplyingToSimilar] = useState<string | null>(null);
  const [grouping, setGrouping] = useState<GroupingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [groupBySkupina, setGroupBySkupina] = useState(false);

  // Применить группу к похожим позициям
  const applyToSimilar = (sourceItem: ParsedItem) => {
    if (!sourceItem.skupina) return;

    setApplyingToSimilar(sourceItem.id);

    // Находим похожие позиции
    const suggestions = autoAssignSimilarItems(sourceItem, items, 70);

    if (suggestions.length > 0) {
      // Применяем группу ко всем похожим
      const updates = suggestions.map((s) => ({
        itemId: s.itemId,
        skupina: s.suggestedSkupina,
      }));

      bulkSetSkupina(projectId, updates);

      // Показываем уведомление
      alert(`Группа "${sourceItem.skupina}" применена к ${suggestions.length} похожим позициям`);
    } else {
      alert('Похожие позиции не найдены');
    }

    setApplyingToSimilar(null);
  };

  // Переключение группировки
  const toggleGrouping = () => {
    if (groupBySkupina) {
      setGrouping([]);
      setGroupBySkupina(false);
    } else {
      setGrouping(['skupina']);
      setGroupBySkupina(true);
    }
  };

  const [sorting, setSorting] = useMemo(
    () => [externalSorting || [], externalOnSortingChange || (() => {})],
    [externalSorting, externalOnSortingChange]
  );

  const columns = useMemo(
    () => [
      // Checkbox
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

      // Kód
      columnHelper.accessor('kod', {
        header: 'Kód',
        cell: (info) => (
          <span className="font-mono text-sm font-semibold">
            {info.getValue()}
          </span>
        ),
        size: 100,
        enableSorting: true,
      }),

      // Popis
      columnHelper.accessor('popis', {
        header: 'Popis',
        cell: (info) => (
          <div className="max-w-md">
            <p className="truncate text-sm">{info.getValue()}</p>
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
        header: 'Skupina',
        cell: (info) => {
          const item = info.row.original;
          const currentSkupina = info.getValue();
          const datalistId = `skupina-datalist-${item.id}`;
          const isApplying = applyingToSimilar === item.id;

          const handleSkupinaChange = (value: string) => {
            const trimmedValue = value.trim();
            if (!trimmedValue) {
              setItemSkupina(projectId, item.id, null!);
              return;
            }

            // Добавляем новую группу если её нет в списке
            if (!allGroups.includes(trimmedValue)) {
              addCustomGroup(trimmedValue);
            }

            setItemSkupina(projectId, item.id, trimmedValue);
          };

          return (
            <div className="flex items-center gap-1">
              <div className="relative flex-1">
                <input
                  type="text"
                  list={datalistId}
                  value={currentSkupina || ''}
                  onChange={(e) => handleSkupinaChange(e.target.value)}
                  onBlur={(e) => handleSkupinaChange(e.target.value)}
                  placeholder="Zadejte nebo vyberte"
                  className="text-sm bg-bg-tertiary border border-border-color rounded px-2 py-1
                             focus:border-accent-primary focus:outline-none w-full"
                />
                <datalist id={datalistId}>
                  {allGroups.map((group) => (
                    <option key={group} value={group} />
                  ))}
                </datalist>
              </div>
              {currentSkupina && (
                <button
                  onClick={() => applyToSimilar(item)}
                  disabled={isApplying}
                  title="Применить к похожим позициям"
                  className="p-1 rounded hover:bg-bg-secondary transition-colors disabled:opacity-50"
                >
                  <Sparkles size={16} className="text-accent-primary" />
                </button>
              )}
            </div>
          );
        },
        size: 240,
        enableSorting: true,
      }),
    ],
    [projectId, setItemSkupina, allGroups, addCustomGroup, applyToSimilar, applyingToSimilar]
  );

  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting,
      grouping,
      expanded,
      rowSelection: Object.fromEntries(
        Array.from(selectedIds).map((id) => [
          items.findIndex((item) => item.id === id),
          true,
        ])
      ),
    },
    onSortingChange: setSorting as any,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: (updater) => {
      if (!onSelectionChange) return;

      const newSelection =
        typeof updater === 'function'
          ? updater(
              Object.fromEntries(
                Array.from(selectedIds).map((id) => [
                  items.findIndex((item) => item.id === id),
                  true,
                ])
              )
            )
          : updater;

      const newSelectedIds = new Set(
        Object.keys(newSelection)
          .filter((key) => newSelection[key])
          .map((key) => items[parseInt(key)]?.id)
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
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-border-color px-4 py-2 flex items-center gap-2">
        <button
          onClick={toggleGrouping}
          className={`px-3 py-1 text-sm rounded flex items-center gap-2 transition-colors ${
            groupBySkupina
              ? 'bg-accent-primary text-white'
              : 'bg-bg-secondary hover:bg-bg-tertiary'
          }`}
        >
          {groupBySkupina ? <FolderOpen size={16} /> : <Folder size={16} />}
          {groupBySkupina ? 'Skupiny zapnuty' : 'Seskupit podle skupiny'}
        </button>
      </div>

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
            {table.getRowModel().rows.map((row) => {
              if (row.getIsGrouped()) {
                // Группированная строка
                return (
                  <tr key={row.id} className="bg-bg-secondary font-medium">
                    <td colSpan={row.getVisibleCells().length}>
                      <button
                        onClick={row.getToggleExpandedHandler()}
                        className="flex items-center gap-2 px-2 py-1 hover:bg-bg-tertiary transition-colors w-full text-left"
                      >
                        {row.getIsExpanded() ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronUp size={16} />
                        )}
                        <span className="text-accent-primary">
                          {row.groupingValue || '(Bez skupiny)'}
                        </span>
                        <span className="text-text-secondary text-sm">
                          ({row.subRows.length} položek)
                        </span>
                      </button>
                    </td>
                  </tr>
                );
              }

              // Обычная строка
              return (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-border-color px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Zobrazeno {items.length} položek
        </p>
        {selectedIds.size > 0 && (
          <p className="text-sm font-medium text-accent-primary">
            Vybráno: {selectedIds.size}
          </p>
        )}
      </div>
    </div>
  );
}
