/**
 * InlineOtskpSearch — Minimal OTSKP code search for INFO row.
 *
 * Uses createPortal to render dropdown at document.body,
 * avoiding overflow:hidden clipping from table/parent containers.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { otskpAPI } from '../../services/api';
import type { OtskpCode } from '@stavagent/monolit-shared';

interface Props {
  value: string;
  onSelect: (code: string, name: string, unitPrice?: number) => void;
  disabled?: boolean;
}

export default function InlineOtskpSearch({ value, onSelect, disabled }: Props) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<OtskpCode[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [userTyping, setUserTyping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync value prop
  useEffect(() => {
    if (value && value !== query) {
      setUserTyping(false);
      setQuery(value);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (!userTyping || query.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const resp = await otskpAPI.search(query, 8);
        setResults(resp.results || []);
        setOpen((resp.results || []).length > 0);
        setSelectedIdx(-1);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, userTyping]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = useCallback((item: OtskpCode) => {
    setUserTyping(false);
    setQuery(item.code);
    setOpen(false);
    onSelect(item.code, item.name, item.unit_price);
  }, [onSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && selectedIdx >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Dropdown position (portal)
  const getDropdownPos = () => {
    if (!inputRef.current) return { top: 0, left: 0, width: 380 };
    const rect = inputRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + 2,
      left: rect.left,
      width: 380,
    };
  };

  const pos = getDropdownPos();

  return (
    <>
      <div style={{ position: 'relative', width: 82, flexShrink: 0 }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setUserTyping(true); setQuery(e.target.value); }}
          onFocus={() => { if (results.length) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="OTSKP"
          disabled={disabled}
          className="flat-otskp-input"
        />
        {loading && <Search size={11} className="flat-otskp-spinner" />}
      </div>

      {/* Portal dropdown — renders at body level to avoid overflow clipping */}
      {open && results.length > 0 && createPortal(
        <div
          ref={dropdownRef}
          className="flat-otskp-dropdown"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: pos.width,
          }}
        >
          {results.map((item, i) => (
            <div
              key={item.code}
              className={`flat-otskp-dropdown__item ${i === selectedIdx ? 'flat-otskp-dropdown__item--sel' : ''}`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="flat-mono" style={{ fontWeight: 600, color: 'var(--orange-500)', fontSize: 12 }}>
                  {item.code}
                </span>
                <span className="flat-mono" style={{ color: 'var(--flat-text-secondary)', fontSize: 11 }}>
                  {item.unit_price?.toLocaleString('cs-CZ')} Kč/{item.unit}
                </span>
              </div>
              <div style={{
                fontSize: 11, color: 'var(--flat-text)', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {item.name}
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
