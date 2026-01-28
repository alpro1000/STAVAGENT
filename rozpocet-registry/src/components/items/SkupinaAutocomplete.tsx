/**
 * Skupina Autocomplete Component
 * Autocomplete s vyhledáváním pro výběr/vytvoření skupiny
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus } from 'lucide-react';

interface SkupinaAutocompleteProps {
  value: string | null;
  onChange: (value: string | null) => void;
  allGroups: string[];
  onAddGroup: (group: string) => void;
}

export function SkupinaAutocomplete({
  value,
  onChange,
  allGroups,
  onAddGroup,
}: SkupinaAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  // Recalculate dropdown position when open
  const updatePosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 260;
    setDropdownPos({ top: openUp ? rect.top : rect.bottom, left: rect.left, width: rect.width, openUp });
  }, []);

  useEffect(() => {
    if (isOpen) updatePosition();
  }, [isOpen, updatePosition]);

  // Фильтрованные группы
  const filteredGroups = allGroups.filter((group) =>
    group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if entered value is a new (not yet existing) group
  const trimmedSearch = searchTerm.trim();
  const exactMatch = trimmedSearch ? allGroups.includes(trimmedSearch) : false;
  const caseInsensitiveMatch = trimmedSearch
    ? allGroups.find(g => g.toUpperCase() === trimmedSearch.toUpperCase())
    : null;
  const isNewGroup = trimmedSearch && !exactMatch;
  const isDuplicate = isNewGroup && caseInsensitiveMatch !== null;

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
    onChange(group);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleAddNewGroup = () => {
    const trimmed = searchTerm.trim();
    if (trimmed) {
      onAddGroup(trimmed);
      onChange(trimmed);
      setSearchTerm('');
      setIsOpen(false);
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
    onChange(null);
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
          className="bg-panel-clean border border-edge-light rounded-lg shadow-lg max-h-60 overflow-y-auto"
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
                    <span className="text-accent-primary">✓</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-text-secondary">
              Žádné skupiny nenalezeny
            </div>
          )}

          {/* Создать новую группу */}
          {isNewGroup && (
            <>
              <div className="border-t border-divider" />
              {isDuplicate ? (
                <div className="px-3 py-2 text-sm text-yellow-500 flex items-center gap-2">
                  <span>⚠ Podobná skupina existuje: &quot;{caseInsensitiveMatch}&quot;</span>
                </div>
              ) : (
                <button
                  onClick={handleAddNewGroup}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-bg-secondary transition-colors flex items-center gap-2 text-accent-primary font-medium"
                >
                  <Plus size={16} />
                  <span>Vytvořit: &quot;{searchTerm.trim()}&quot;</span>
                  <span className="ml-auto text-xs text-text-muted opacity-70">Enter</span>
                </button>
              )}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
