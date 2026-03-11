/**
 * Skupina Autocomplete Component
 * Autocomplete s vyhledáváním pro výběr/vytvoření skupiny
 * + Optional learning: "Zapamнить для похожих позиций"
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Brain } from 'lucide-react';

interface SkupinaAutocompleteProps {
  value: string | null;
  onChange: (value: string | null, shouldLearn?: boolean) => void;
  allGroups: string[];
  onAddGroup: (group: string) => void;
  // Optional: for learning
  itemId?: string;
  enableLearning?: boolean;
  // Optional: browser-side memory hint (kod → skupina from localStorage)
  memoryHint?: string | null;
}

export function SkupinaAutocomplete({
  value,
  onChange,
  allGroups,
  onAddGroup,
  itemId,
  enableLearning = false,
  memoryHint = null,
}: SkupinaAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [shouldLearn, setShouldLearn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  // Recalculate dropdown position when open
  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 300; // Increased for checkbox
    setDropdownPos({ top: openUp ? rect.top : rect.bottom, left: rect.left, width: rect.width, openUp });
  }, []);

  useEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, updatePosition]);

  // Фильтрованные группы (исключаем пустые строки)
  const validGroups = allGroups.filter((group) => group && group.trim().length > 0);
  const filteredGroups = validGroups.filter((group) =>
    group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if entered value is a new (not yet existing) group
  const trimmedSearch = searchTerm.trim();
  const exactMatch = trimmedSearch ? validGroups.includes(trimmedSearch) : false;
  const caseInsensitiveMatch = trimmedSearch
    ? validGroups.find(g => g.toUpperCase() === trimmedSearch.toUpperCase())
    : undefined;
  const isNewGroup = trimmedSearch && !exactMatch;
  const isDuplicate = isNewGroup && caseInsensitiveMatch != null;

  // Закрытие при клике вне
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (group: string) => {
    onChange(group, shouldLearn);
    setSearchTerm('');
    setIsOpen(false);
    setShouldLearn(false); // Reset after use
  };

  const handleAddNewGroup = () => {
    const trimmed = searchTerm.trim();
    if (trimmed) {
      onAddGroup(trimmed);
      onChange(trimmed, shouldLearn);
      setSearchTerm('');
      setIsOpen(false);
      setShouldLearn(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  const handleFocus = () => {
    setIsOpen(true);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter: create new group or select first match
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = searchTerm.trim();

      if (!trimmed) return;

      // If there's an exact match, select it
      if (exactMatch) {
        handleSelect(trimmed);
        return;
      }

      // If it's a case-insensitive duplicate, select the existing one
      if (caseInsensitiveMatch) {
        handleSelect(caseInsensitiveMatch);
        return;
      }

      // If there's a single filtered result, select it
      if (filteredGroups.length === 1) {
        handleSelect(filteredGroups[0]);
        return;
      }

      // Otherwise, create new group
      if (isNewGroup && !isDuplicate) {
        handleAddNewGroup();
      }
    }

    // Escape: close dropdown
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const handleClear = () => {
    onChange(null, false);
    setSearchTerm('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : value || ''}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Hledat nebo vytvořit (Enter pro uložení)..."
          className="text-sm bg-bg-tertiary border border-border-color rounded px-2 py-1 pl-8 pr-6
                     focus:border-accent-primary focus:outline-none w-full"
        />
        <Search
          size={14}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-text-secondary"
        />
        {value && !isOpen && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-error transition-colors"
            title="Vymazat"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown - rendered via portal to escape overflow:hidden */}
      {isOpen && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          className="bg-panel-clean border border-edge-light rounded-lg shadow-lg max-h-72 overflow-y-auto"
          style={{
            position: 'fixed',
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
            ...(dropdownPos.openUp
              ? { bottom: window.innerHeight - dropdownPos.top + 4 }
              : { top: dropdownPos.top + 4 }),
          }}
        >
          {/* Memory Hint — show if browser memory has a suggestion for this item */}
          {memoryHint && memoryHint !== value && (
            <div className="px-3 py-2 border-b border-border-color">
              <button
                onClick={() => handleSelect(memoryHint)}
                className="w-full text-left flex items-center gap-2 text-xs hover:bg-accent-primary/10 rounded px-1 py-1 transition-colors"
                title="Naposledy použitá skupina pro tento kód"
              >
                <Brain size={12} className="text-accent-primary flex-shrink-0" />
                <span className="text-text-muted">Paměť:</span>
                <span className="font-semibold text-accent-primary">{memoryHint}</span>
              </button>
            </div>
          )}

          {/* Learning Checkbox (if enabled) */}
          {enableLearning && itemId && (
            <div
              className="px-3 py-2 border-b border-border-color bg-bg-secondary/50"
              onClick={(e) => e.stopPropagation()}
            >
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={shouldLearn}
                  onChange={(e) => setShouldLearn(e.target.checked)}
                  className="rounded border-border-color text-accent-primary focus:ring-accent-primary"
                />
                <Brain size={14} className="text-accent-primary" />
                <span className="text-text-primary">
                  💡 Zapamatovat pro podobné pozice
                </span>
              </label>
              <div className="text-[10px] text-text-muted mt-0.5 ml-6">
                AI si zapamatuje toto rozhodnutí a použije ho příště
              </div>
            </div>
          )}

          {/* Отфильтрованные группы */}
          {filteredGroups.length > 0 ? (
            <div className="py-1">
              {filteredGroups.map((group) => (
                <button
                  key={group}
                  onClick={() => handleSelect(group)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-bg-secondary transition-colors flex items-center justify-between group"
                >
                  <span className="text-text-primary">{group}</span>
                  {value === group && (
                    <span className="text-xs text-accent-primary">✓</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-xs text-text-muted">
              Žádné shody. {isNewGroup && !isDuplicate && 'Stiskněte Enter pro vytvoření nové skupiny.'}
            </div>
          )}

          {/* Create new group button */}
          {isNewGroup && (
            <div className="border-t border-border-color p-2">
              {isDuplicate ? (
                <div className="text-xs text-yellow-600 px-2 py-1">
                  ⚠️ Skupina &quot;{caseInsensitiveMatch}&quot; už existuje (jiná velikost písmen)
                </div>
              ) : (
                <button
                  onClick={handleAddNewGroup}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-green-50 transition-colors
                             flex items-center gap-2 text-green-700 font-medium rounded"
                >
                  <Plus size={14} />
                  <span>Vytvořit &quot;{trimmedSearch}&quot;</span>
                </button>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
