'use client';

import React, { useState } from 'react';
import {
  KBCategory,
  KBLanguage,
  KBStandardType,
  KBSearchFilters,
  KB_CATEGORY_INFO,
} from '@/lib/kb-types';

interface KBSearchProps {
  onSearch: (filters: KBSearchFilters) => void;
  onReset: () => void;
}

export function KBSearch({ onSearch, onReset }: KBSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<KBCategory[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<KBLanguage[]>([]);
  const [selectedStandardTypes, setSelectedStandardTypes] = useState<KBStandardType[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSearch = () => {
    const filters: KBSearchFilters = {
      query: query.trim() || undefined,
      categories: selectedCategories.length > 0 ? selectedCategories : undefined,
      languages: selectedLanguages.length > 0 ? selectedLanguages : undefined,
      standardTypes: selectedStandardTypes.length > 0 ? selectedStandardTypes : undefined,
    };
    onSearch(filters);
  };

  const handleReset = () => {
    setQuery('');
    setSelectedCategories([]);
    setSelectedLanguages([]);
    setSelectedStandardTypes([]);
    onReset();
  };

  const toggleCategory = (category: KBCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const toggleLanguage = (language: KBLanguage) => {
    setSelectedLanguages((prev) =>
      prev.includes(language) ? prev.filter((l) => l !== language) : [...prev, language]
    );
  };

  const toggleStandardType = (standardType: KBStandardType) => {
    setSelectedStandardTypes((prev) =>
      prev.includes(standardType)
        ? prev.filter((s) => s !== standardType)
        : [...prev, standardType]
    );
  };

  const categories = Object.keys(KB_CATEGORY_INFO) as KBCategory[];
  const languages: KBLanguage[] = ['cs', 'sk', 'en'];
  const standardTypes: KBStandardType[] = ['CSN', 'EN', 'ISO', 'ASTM', 'DIN', 'OTHER'];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      {/* Search Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Vyhledat v databázi znalostí
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Zadejte klíčové slovo, kód nebo normu..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            🔍 Hledat
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Advanced Filters Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        {showAdvanced ? '▼' : '▶'} Pokročilé filtry
      </button>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kategorie ({selectedCategories.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => {
                const info = KB_CATEGORY_INFO[category];
                const isSelected = selectedCategories.includes(category);
                return (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {info.icon} {info.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Languages */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jazyk ({selectedLanguages.length})
            </label>
            <div className="flex gap-2">
              {languages.map((language) => {
                const isSelected = selectedLanguages.includes(language);
                const labels: Record<KBLanguage, string> = {
                  cs: '🇨🇿 Čeština',
                  sk: '🇸🇰 Slovenčina',
                  en: '🇬🇧 English',
                };
                return (
                  <button
                    key={language}
                    onClick={() => toggleLanguage(language)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {labels[language]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Standard Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Typ normy ({selectedStandardTypes.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {standardTypes.map((standardType) => {
                const isSelected = selectedStandardTypes.includes(standardType);
                return (
                  <button
                    key={standardType}
                    onClick={() => toggleStandardType(standardType)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {standardType}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {(selectedCategories.length > 0 ||
        selectedLanguages.length > 0 ||
        selectedStandardTypes.length > 0) && (
        <div className="pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Aktivní filtry:</span>
            {selectedCategories.length > 0 && (
              <span className="ml-2">
                {selectedCategories.length} {selectedCategories.length === 1 ? 'kategorie' : 'kategorií'}
              </span>
            )}
            {selectedLanguages.length > 0 && (
              <span className="ml-2">
                {selectedLanguages.length} {selectedLanguages.length === 1 ? 'jazyk' : 'jazyků'}
              </span>
            )}
            {selectedStandardTypes.length > 0 && (
              <span className="ml-2">
                {selectedStandardTypes.length} {selectedStandardTypes.length === 1 ? 'typ normy' : 'typů norem'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
