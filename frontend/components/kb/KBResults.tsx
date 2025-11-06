'use client';

import React from 'react';
import { KBItem, KBViewMode, KB_CATEGORY_INFO } from '@/lib/kb-types';

interface KBResultsProps {
  items: KBItem[];
  viewMode: KBViewMode;
  onViewModeChange: (mode: KBViewMode) => void;
  onItemClick: (item: KBItem) => void;
  total: number;
  page: number;
  pageSize: number;
}

export function KBResults({
  items,
  viewMode,
  onViewModeChange,
  onItemClick,
  total,
  page,
  pageSize,
}: KBResultsProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatViews = (views: number) => {
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}k`;
    }
    return views.toString();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Nalezeno <span className="font-semibold">{total}</span> položek
          {total > 0 && (
            <>
              {' '}
              (zobrazeno {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)})
            </>
          )}
        </div>

        {/* View Mode Selector */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => onViewModeChange('list')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Zobrazení seznamu"
          >
            ☰ Seznam
          </button>
          <button
            onClick={() => onViewModeChange('grid')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === 'grid'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Zobrazení mřížky"
          >
            ⊞ Mřížka
          </button>
          <button
            onClick={() => onViewModeChange('table')}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            title="Zobrazení tabulky"
          >
            ≡ Tabulka
          </button>
        </div>
      </div>

      {/* Results */}
      {items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <div className="text-gray-400 text-5xl mb-4">🔍</div>
          <p className="text-gray-600 font-medium mb-2">Žádné výsledky</p>
          <p className="text-sm text-gray-500">Zkuste změnit vyhledávací kritéria nebo filtry</p>
        </div>
      ) : (
        <>
          {viewMode === 'list' && <ListView items={items} onItemClick={onItemClick} formatDate={formatDate} formatViews={formatViews} />}
          {viewMode === 'grid' && <GridView items={items} onItemClick={onItemClick} formatDate={formatDate} formatViews={formatViews} />}
          {viewMode === 'table' && <TableView items={items} onItemClick={onItemClick} formatDate={formatDate} formatViews={formatViews} />}
        </>
      )}
    </div>
  );
}

// List View
function ListView({
  items,
  onItemClick,
  formatDate,
  formatViews,
}: {
  items: KBItem[];
  onItemClick: (item: KBItem) => void;
  formatDate: (date: Date) => string;
  formatViews: (views: number) => string;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const categoryInfo = KB_CATEGORY_INFO[item.category];
        return (
          <button
            key={item.id}
            onClick={() => onItemClick(item)}
            className="w-full bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="text-3xl flex-shrink-0">{categoryInfo.icon}</div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 line-clamp-1">{item.title}</h3>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    👁 {formatViews(item.views)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">{item.description}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                    {categoryInfo.label}
                  </span>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-500">{formatDate(item.updatedAt)}</span>
                  {item.standardCode && (
                    <>
                      <span className="text-gray-500">•</span>
                      <span className="font-mono text-gray-700">{item.standardCode}</span>
                    </>
                  )}
                  {item.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-blue-600">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Grid View
function GridView({
  items,
  onItemClick,
  formatDate,
  formatViews,
}: {
  items: KBItem[];
  onItemClick: (item: KBItem) => void;
  formatDate: (date: Date) => string;
  formatViews: (views: number) => string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => {
        const categoryInfo = KB_CATEGORY_INFO[item.category];
        return (
          <button
            key={item.id}
            onClick={() => onItemClick(item)}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all text-left h-full flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-3xl">{categoryInfo.icon}</span>
              <span className="text-xs text-gray-500">👁 {formatViews(item.views)}</span>
            </div>

            {/* Content */}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{item.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-3 mb-3">{item.description}</p>
            </div>

            {/* Footer */}
            <div className="space-y-2 pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500">{formatDate(item.updatedAt)}</div>
              <div className="flex flex-wrap gap-1.5">
                {item.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-xs text-blue-600">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Table View
function TableView({
  items,
  onItemClick,
  formatDate,
  formatViews,
}: {
  items: KBItem[];
  onItemClick: (item: KBItem) => void;
  formatDate: (date: Date) => string;
  formatViews: (views: number) => string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Název
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kategorie
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kód
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Aktualizace
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Zobrazení
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => {
              const categoryInfo = KB_CATEGORY_INFO[item.category];
              return (
                <tr
                  key={item.id}
                  onClick={() => onItemClick(item)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{categoryInfo.icon}</span>
                      <div className="max-w-md">
                        <div className="font-medium text-gray-900 line-clamp-1">{item.title}</div>
                        <div className="text-sm text-gray-500 line-clamp-1">{item.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                      {categoryInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-sm text-gray-700">
                      {item.standardCode || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(item.updatedAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatViews(item.views)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
