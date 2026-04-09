/**
 * OtskpAutocomplete - Autocomplete search for OTSKP codes
 * Allows searching by code or name from the OTSKP catalog
 */

import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { otskpAPI } from '../services/api';
import type { OtskpCode } from '../../../shared/src/types';

interface Props {
  value: string;
  onSelect: (code: string, name: string, unitPrice?: number, unit?: string) => void;
  disabled?: boolean;
}

export default function OtskpAutocomplete({ value, onSelect, disabled }: Props) {
  const [searchQuery, setSearchQuery] = useState(value || '');
  const [results, setResults] = useState<OtskpCode[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [userTyping, setUserTyping] = useState(false);  // Only search on user input, not prop init
  const [searchReason, setSearchReason] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize searchQuery when value prop changes (without triggering search)
  useEffect(() => {
    if (value && value !== searchQuery) {
      setUserTyping(false);
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

  // Debounced search — only when user is actively typing
  useEffect(() => {
    if (!userTyping || searchQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      setSearchReason(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsLoading(true);
        setSearchReason(null);
        const response = await otskpAPI.search(searchQuery, 20);
        setResults(response.results || []);
        // Backend returns reason: 'ok' | 'no_match' | 'db_empty' | 'db_error'
        setSearchReason(response.reason || (response.results?.length ? 'ok' : 'no_match'));
        const shouldOpen = (response.results || []).length > 0;
        setIsOpen(shouldOpen);
        setSelectedIndex(-1);
      } catch (error) {
        setResults([]);
        setIsOpen(false);
        setSearchReason('network_error');
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, userTyping]);

  const handleSelect = (item: OtskpCode) => {
    setUserTyping(false);
    onSelect(item.code, item.name, item.unit_price, item.unit);
    setSearchQuery(item.code);
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
          onChange={(e) => { setUserTyping(true); setSearchQuery(e.target.value); }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Hledat kód nebo název..."
          disabled={disabled}
          title="Začněte psát pro vyhledání v katalogu OTSKP"
        />
        {isLoading && <span className="otskp-loading"><Search size={14} /></span>}
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

      {!isOpen && searchQuery.length >= 2 && !isLoading && results.length === 0 && searchReason && (
        <div className="otskp-dropdown">
          <div className="otskp-no-results">
            {searchReason === 'db_empty' && (
              <>OTSKP databáze není načtena.<br/><small>Kontaktujte administrátora — spustit import katalogu.</small></>
            )}
            {searchReason === 'db_error' && (
              <>Chyba OTSKP databáze.<br/><small>Zkuste později.</small></>
            )}
            {searchReason === 'network_error' && (
              <>Chyba připojení k serveru.<br/><small>Zkontrolujte síť.</small></>
            )}
            {(searchReason === 'no_match' || searchReason === 'ok') && (
              <>Nenalezeno pro "{searchQuery}".<br/><small>Zkuste jiný kód nebo popis.</small></>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
