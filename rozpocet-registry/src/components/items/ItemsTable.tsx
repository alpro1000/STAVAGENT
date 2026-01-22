/**
 * ItemsTable Component
 * Tabulka položek s podporou třídění a výběru
 */

import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { ParsedItem } from '../../types';
import { useRegistryStore } from '../../stores/registryStore';

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
  const { setItemSkupina, getAllGroups } = useRegistryStore();
  const allGroups = getAllGroups();

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

          return (
            <select
              value={currentSkupina || ''}
              onChange={(e) => setItemSkupina(projectId, item.id, e.target.value || null!)}
              className="text-sm bg-bg-tertiary border border-border-color rounded px-2 py-1
                         focus:border-accent-primary focus:outline-none w-full"
            >
              <option value="">-- Vyberte skupinu --</option>
              {allGroups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          );
        },
        size: 180,
        enableSorting: true,
      }),
    ],
    [projectId, setItemSkupina, allGroups]
  );

  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting,
      rowSelection: Object.fromEntries(
        Array.from(selectedIds).map((id) => [
          items.findIndex((item) => item.id === id),
          true,
        ])
      ),
    },
    onSortingChange: setSorting as any,
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
              <tr key={row.id}>
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
