'use client';

import React from 'react';
import { KBItem, KB_CATEGORY_INFO } from '@/lib/kb-types';

interface KBDetailProps {
  item: KBItem;
  onClose: () => void;
  onRelatedClick?: (itemId: string) => void;
}

export function KBDetail({ item, onClose, onRelatedClick }: KBDetailProps) {
  const categoryInfo = KB_CATEGORY_INFO[item.category];

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('cs-CZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const languageLabels: Record<string, string> = {
    cs: '🇨🇿 Čeština',
    sk: '🇸🇰 Slovenčina',
    en: '🇬🇧 English',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div className="flex items-start gap-4 flex-1">
            <span className="text-4xl">{categoryInfo.icon}</span>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{item.title}</h2>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                <span className="px-2 py-1 bg-gray-100 rounded">{categoryInfo.label}</span>
                <span>{languageLabels[item.language]}</span>
                {item.standardCode && (
                  <>
                    <span>•</span>
                    <span className="font-mono font-medium">{item.standardCode}</span>
                  </>
                )}
                {item.standardType && (
                  <>
                    <span>•</span>
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {item.standardType}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-2 -mt-2 -mr-2"
            title="Zavřít"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Popis</h3>
            <p className="text-gray-700">{item.description}</p>
          </div>

          {/* Content */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Obsah</h3>
            <div className="prose prose-sm max-w-none">
              <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-gray-700">
                {item.content}
              </div>
            </div>
          </div>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Štítky</h3>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {item.metadata && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Metadata</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                {item.metadata.author && (
                  <div className="flex">
                    <span className="font-medium text-gray-700 w-32">Autor:</span>
                    <span className="text-gray-600">{item.metadata.author}</span>
                  </div>
                )}
                {item.metadata.version && (
                  <div className="flex">
                    <span className="font-medium text-gray-700 w-32">Verze:</span>
                    <span className="text-gray-600">{item.metadata.version}</span>
                  </div>
                )}
                {item.metadata.source && (
                  <div className="flex">
                    <span className="font-medium text-gray-700 w-32">Zdroj:</span>
                    <span className="text-gray-600">{item.metadata.source}</span>
                  </div>
                )}
                {item.metadata.validity && (
                  <div className="flex">
                    <span className="font-medium text-gray-700 w-32">Platnost:</span>
                    <span className="text-gray-600">
                      {item.metadata.validity.from &&
                        `Od ${formatDate(item.metadata.validity.from)}`}
                      {item.metadata.validity.to &&
                        ` do ${formatDate(item.metadata.validity.to)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Statistics */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Statistiky</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4">
                <div className="text-sm text-blue-700 mb-1">Zobrazení</div>
                <div className="text-2xl font-bold text-blue-900">{item.views}</div>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
                <div className="text-sm text-green-700 mb-1">Vytvořeno</div>
                <div className="text-sm font-medium text-green-900">
                  {formatDate(item.createdAt)}
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4">
                <div className="text-sm text-purple-700 mb-1">Aktualizováno</div>
                <div className="text-sm font-medium text-purple-900">
                  {formatDate(item.updatedAt)}
                </div>
              </div>
            </div>
          </div>

          {/* Related Items */}
          {item.relatedItems && item.relatedItems.length > 0 && onRelatedClick && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Související položky</h3>
              <div className="text-sm text-gray-600">
                Nalezeno {item.relatedItems.length} souvisejících položek.{' '}
                <button
                  onClick={() => onRelatedClick(item.id)}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Zobrazit všechny →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            ID: <span className="font-mono">{item.id}</span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
