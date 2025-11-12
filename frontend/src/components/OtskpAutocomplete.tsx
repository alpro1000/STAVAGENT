/**
 * OtskpAutocomplete - Autocomplete search for OTSKP codes
 * Allows searching by code or name from the OTSKP catalog
 */

import { useState, useEffect, useRef } from 'react';
import { otskpAPI } from '../services/api';
import type { OtskpCode } from '../../../shared/src/types';

interface Props {
  value: string;
  onSelect: (code: string, name: string) => void;
  disabled?: boolean;
}

export default function OtskpAutocomplete({ value, onSelect, disabled }: Props) {
  const [searchQuery, setSearchQuery] = useState(value || '');
  const [results, setResults] = useState<OtskpCode[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize searchQuery when value prop changes
  useEffect(() => {
    if (value && value !== searchQuery) {
      setSearchQuery(value);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsLoading(true);
        const response = await otskpAPI.search(searchQuery, 20);
        setResults(response.results);
        const shouldOpen = response.results.length > 0;
        setIsOpen(shouldOpen);
        setSelectedIndex(-1);
      } catch (error) {
        setResults([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSelect = (item: OtskpCode) => {
    onSelect(item.code, item.name);
    setSearchQuery(item.code); // Show the selected code in the input
    setIsOpen(false);
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
            case 'Backspace':
    case 'Delete':
      // Allow deletion of characters
      break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        break;
    }
  };

  return (
    <div className="otskp-autocomplete-container" ref={dropdownRef}>
      <div className="otskp-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="otskp-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Hledat kód nebo název..."
          disabled={disabled}
          title="Začněte psát pro vyhledání v katalogu OTSKP"
        />
        {isLoading && <span className="otskp-loading">🔍</span>}
      </div>

      {isOpen && results.length > 0 && (
        <div className="otskp-dropdown">
          {results.map((item, index) => (
            <div
              key={item.code}
              className={`otskp-dropdown-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="otskp-item-header">
                <span className="otskp-item-code">{item.code}</span>
                <span className="otskp-item-price">
                  {item.unit_price.toFixed(2)} Kč/{item.unit}
                </span>
              </div>
              <div className="otskp-item-name">{item.name}</div>
              {item.specification && (
                <div className="otskp-item-spec">{item.specification}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isOpen && searchQuery.length >= 2 && !isLoading && results.length === 0 && (
        <div className="otskp-dropdown">
          <div className="otskp-no-results">
            Nenalezeny žádné výsledky pro "{searchQuery}"
          </div>
        </div>
      )}
    </div>
  );
}
