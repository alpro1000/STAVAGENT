'use client';

import React from 'react';
import { KBStatistics, KB_CATEGORY_INFO } from '@/lib/kb-types';

interface KBStatisticsProps {
  statistics: KBStatistics;
  onItemClick?: (itemId: string) => void;
}

export function KBStatisticsView({ statistics, onItemClick }: KBStatisticsProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('cs-CZ').format(num);
  };

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Celková statistika</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
            <div className="text-sm text-blue-700 mb-1">Celkem položek</div>
            <div className="text-3xl font-bold text-blue-900">
              {formatNumber(statistics.totalItems)}
            </div>
          </div>
          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
            <div className="text-sm text-green-700 mb-1">Kategorií</div>
            <div className="text-3xl font-bold text-green-900">
              {Object.keys(statistics.itemsByCategory).length}
            </div>
          </div>
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
            <div className="text-sm text-purple-700 mb-1">Jazyků</div>
            <div className="text-3xl font-bold text-purple-900">
              {Object.keys(statistics.itemsByLanguage).length}
            </div>
          </div>
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-4">
            <div className="text-sm text-orange-700 mb-1">Nedávno aktualizováno</div>
            <div className="text-3xl font-bold text-orange-900">
              {statistics.recentlyUpdated.length}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Viewed */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🔥 Nejčtenější</h3>
          <div className="space-y-3">
            {statistics.mostViewed.map((item, index) => {
              const categoryInfo = KB_CATEGORY_INFO[item.category];
              return (
                <button
                  key={item.id}
                  onClick={() => onItemClick?.(item.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left"
                >
                  {/* Rank */}
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0
                        ? 'bg-yellow-400 text-yellow-900'
                        : index === 1
                        ? 'bg-gray-300 text-gray-800'
                        : index === 2
                        ? 'bg-orange-300 text-orange-900'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {index + 1}
                  </div>

                  {/* Icon */}
                  <span className="text-2xl flex-shrink-0">{categoryInfo.icon}</span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 line-clamp-1">{item.title}</h4>
                    <p className="text-xs text-gray-500">{categoryInfo.label}</p>
                  </div>

                  {/* Views */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatNumber(item.views)}
                    </div>
                    <div className="text-xs text-gray-500">zobrazení</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recently Updated */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🆕 Nedávno aktualizováno</h3>
          <div className="space-y-3">
            {statistics.recentlyUpdated.map((item) => {
              const categoryInfo = KB_CATEGORY_INFO[item.category];
              return (
                <button
                  key={item.id}
                  onClick={() => onItemClick?.(item.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left"
                >
                  {/* Icon */}
                  <span className="text-2xl flex-shrink-0">{categoryInfo.icon}</span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 line-clamp-1">{item.title}</h4>
                    <p className="text-xs text-gray-500">{categoryInfo.label}</p>
                  </div>

                  {/* Date */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-medium text-gray-700">
                      {formatDate(item.updatedAt)}
                    </div>
                    <div className="text-xs text-gray-500">aktualizováno</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Items by Category */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📂 Položky podle kategorií</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(statistics.itemsByCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([category, count]) => {
              const categoryInfo = KB_CATEGORY_INFO[category as keyof typeof KB_CATEGORY_INFO];
              const percentage = (count / statistics.totalItems) * 100;
              return (
                <div
                  key={category}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg"
                >
                  <span className="text-2xl">{categoryInfo.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 line-clamp-1">
                      {categoryInfo.label}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700">
                        {formatNumber(count)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Items by Language */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🌍 Položky podle jazyků</h3>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(statistics.itemsByLanguage).map(([language, count]) => {
            const labels: Record<string, string> = {
              cs: '🇨🇿 Čeština',
              sk: '🇸🇰 Slovenčina',
              en: '🇬🇧 English',
            };
            const percentage = (count / statistics.totalItems) * 100;
            return (
              <div key={language} className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-700 mb-2">{labels[language]}</div>
                <div className="text-2xl font-bold text-gray-900 mb-2">
                  {formatNumber(count)}
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
