'use client';

import React, { useState } from 'react';
import { TableArtifact, TableRow } from '@/lib/artifact-types';

interface TableArtifactViewProps {
  artifact: TableArtifact;
  editMode: boolean;
  onUpdate: (artifact: any) => void;
}

export function TableArtifactView({ artifact, editMode, onUpdate }: TableArtifactViewProps) {
  // Mock data if not provided
  const mockHeaders = artifact.headers || [
    { id: 'item', label: 'Item', key: 'item', type: 'text' as const, sortable: true },
    { id: 'quantity', label: 'Quantity', key: 'quantity', type: 'number' as const, sortable: true },
    { id: 'unit', label: 'Unit', key: 'unit', type: 'text' as const },
    { id: 'price', label: 'Unit Price', key: 'price', type: 'currency' as const, sortable: true },
    { id: 'total', label: 'Total', key: 'total', type: 'currency' as const, sortable: true },
  ];

  const mockRows: TableRow[] = artifact.rows || [
    {
      id: '1',
      cells: { item: 'Concrete C30/37', quantity: 42, unit: 'm³', price: 2500, total: 105000 },
      status: 'green',
    },
    {
      id: '2',
      cells: { item: 'Reinforcement Steel', quantity: 3200, unit: 'kg', price: 18, total: 57600 },
      status: 'green',
    },
    {
      id: '3',
      cells: { item: 'Formwork', quantity: 150, unit: 'm²', price: 450, total: 67500 },
      status: 'amber',
    },
  ];

  const [rows, setRows] = useState<TableRow[]>(mockRows);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }

    const sorted = [...rows].sort((a, b) => {
      const aVal = a.cells[key];
      const bVal = b.cells[key];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

    setRows(sorted);
  };

  const formatValue = (value: any, type: string) => {
    if (type === 'currency') {
      return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK' }).format(value);
    }
    if (type === 'number') {
      return new Intl.NumberFormat('cs-CZ').format(value);
    }
    return value;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'green':
        return 'bg-green-50 border-l-4 border-green-500';
      case 'amber':
        return 'bg-yellow-50 border-l-4 border-yellow-500';
      case 'red':
        return 'bg-red-50 border-l-4 border-red-500';
      default:
        return '';
    }
  };

  // Calculate totals
  const totals = mockHeaders.reduce((acc, header) => {
    if (header.type === 'currency' || header.type === 'number') {
      acc[header.key] = rows.reduce((sum, row) => sum + (row.cells[header.key] || 0), 0);
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {mockHeaders.map((header) => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => header.sortable && handleSort(header.key)}
                  >
                    <div className="flex items-center gap-2">
                      {header.label}
                      {header.sortable && sortKey === header.key && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((row) => (
                <tr key={row.id} className={getStatusColor(row.status)}>
                  {mockHeaders.map((header) => (
                    <td
                      key={header.id}
                      className={`px-6 py-4 whitespace-nowrap text-sm ${
                        header.type === 'number' || header.type === 'currency'
                          ? 'text-right font-medium'
                          : 'text-gray-900'
                      }`}
                    >
                      {formatValue(row.cells[header.key], header.type)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                {mockHeaders.map((header) => (
                  <td
                    key={header.id}
                    className={`px-6 py-4 whitespace-nowrap text-sm ${
                      header.type === 'number' || header.type === 'currency'
                        ? 'text-right'
                        : 'text-gray-900'
                    }`}
                  >
                    {header.key === 'item'
                      ? 'Total'
                      : totals[header.key]
                      ? formatValue(totals[header.key], header.type)
                      : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">📊 Summary</h3>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-sm text-gray-600">Total Items</p>
            <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Cost</p>
            <p className="text-2xl font-bold text-primary">
              {formatValue(totals.total || 0, 'currency')}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <div className="flex gap-2 mt-1">
              <span className="text-sm">🟢 {rows.filter((r) => r.status === 'green').length}</span>
              <span className="text-sm">🟡 {rows.filter((r) => r.status === 'amber').length}</span>
              <span className="text-sm">🔴 {rows.filter((r) => r.status === 'red').length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
