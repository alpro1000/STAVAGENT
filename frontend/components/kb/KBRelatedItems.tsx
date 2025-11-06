'use client';

import React from 'react';
import { KBItem, KB_CATEGORY_INFO } from '@/lib/kb-types';

interface KBRelatedItemsProps {
  items: KBItem[];
  onItemClick: (item: KBItem) => void;
}

export function KBRelatedItems({ items, onItemClick }: KBRelatedItemsProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (items.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
        <div className="text-gray-400 text-3xl mb-2">🔗</div>
        <p className="text-gray-600 text-sm">Žádné související položky</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        🔗 Související položky ({items.length})
      </h3>
      <div className="space-y-3">
        {items.map((item) => {
          const categoryInfo = KB_CATEGORY_INFO[item.category];
          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item)}
              className="w-full flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-left"
            >
              {/* Icon */}
              <span className="text-2xl flex-shrink-0">{categoryInfo.icon}</span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 line-clamp-1 mb-1">{item.title}</h4>
                <p className="text-sm text-gray-600 line-clamp-2 mb-2">{item.description}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="px-2 py-0.5 bg-gray-100 rounded">{categoryInfo.label}</span>
                  <span>•</span>
                  <span>{formatDate(item.updatedAt)}</span>
                  {item.standardCode && (
                    <>
                      <span>•</span>
                      <span className="font-mono">{item.standardCode}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <span className="text-gray-400 text-xl flex-shrink-0">→</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
