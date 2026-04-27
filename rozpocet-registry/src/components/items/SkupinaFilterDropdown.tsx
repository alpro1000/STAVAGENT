/**
 * SkupinaFilterDropdown — column-header Skupina filter.
 *
 * Rendered via createPortal to document.body with position: fixed so it
 * escapes the virtualized-table scroll container (overflow: auto) which
 * otherwise clips the dropdown and hides the whole checkbox list.
 *
 * Behaviour is identical to the previous inline absolute-positioned
 * version: checkbox list of all groups present in the sheet + "Zobrazit
 * vše" + per-group "pouze" shortcut.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Filter, Check } from 'lucide-react';

const NO_GROUP_LABEL = '(Bez skupiny)';

/**
 * Drag-resize bounds. The user can drag the bottom-right corner to widen
 * the panel for long group names or to lengthen it when many skupiny are
 * defined. Initial size is restored from localStorage on every open.
 */
const SIZE_LS_KEY = 'registry-skupina-filter-size';
const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 340;
const MIN_WIDTH = 240;
const MIN_HEIGHT = 200;
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1000;

interface PersistedSize {
  w: number;
  h: number;
}

function loadPersistedSize(): PersistedSize {
  if (typeof window === 'undefined') return { w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT };
  try {
    const raw = window.localStorage.getItem(SIZE_LS_KEY);
    if (!raw) return { w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT };
    const parsed = JSON.parse(raw) as Partial<PersistedSize>;
    const w = typeof parsed.w === 'number' ? parsed.w : DEFAULT_WIDTH;
    const h = typeof parsed.h === 'number' ? parsed.h : DEFAULT_HEIGHT;
    return {
      w: Math.max(MIN_WIDTH, Math.min(w, MAX_WIDTH)),
      h: Math.max(MIN_HEIGHT, Math.min(h, MAX_HEIGHT)),
    };
  } catch {
    return { w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT };
  }
}

interface SkupinaFilterDropdownProps {
  groupStats: Array<[string, number]>;
  filterGroups: Set<string>;
  toggleGroupFilter: (group: string) => void;
  selectAllGroups: () => void;
  selectOnlyGroup: (group: string) => void;
  itemsCount: number;
  filteredCount: number;
}

export function SkupinaFilterDropdown({
  groupStats,
  filterGroups,
  toggleGroupFilter,
  selectAllGroups,
  selectOnlyGroup,
  itemsCount,
  filteredCount,
}: SkupinaFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const [size, setSize] = useState<PersistedSize>(loadPersistedSize);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isFilterActive = filterGroups.size > 0;

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < size.h && rect.top > size.h;
    // Right-anchor to the filter button + clamp horizontally so the
    // panel stays inside the viewport after the user drag-resizes wider.
    const wantLeft = rect.right - size.w;
    const clampedLeft = Math.max(8, Math.min(wantLeft, window.innerWidth - size.w - 8));
    setPos({
      top: openUp ? rect.top : rect.bottom,
      left: clampedLeft,
      openUp,
    });
  }, [size.w, size.h]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  // Track drag-resize via ResizeObserver. Debounce localStorage writes
  // so we only persist after the user releases the resize handle (at
  // 60 Hz the raw observer would hammer storage on every pixel).
  // `getBoundingClientRect()` returns border-box dimensions, matching
  // the inline `width` / `height` we apply (Tailwind defaults to
  // `box-sizing: border-box`); reading `entries[0].contentRect` would
  // drift by the 4px border each round-trip.
  useEffect(() => {
    if (!isOpen) return;
    const el = dropdownRef.current;
    if (!el) return;
    let timer: number | undefined;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      const next = {
        w: Math.max(MIN_WIDTH, Math.min(Math.round(rect.width), MAX_WIDTH)),
        h: Math.max(MIN_HEIGHT, Math.min(Math.round(rect.height), MAX_HEIGHT)),
      };
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setSize(next);
        try {
          window.localStorage.setItem(SIZE_LS_KEY, JSON.stringify(next));
        } catch {
          /* ignore quota / disabled storage */
        }
      }, 200);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((v) => !v);
        }}
        className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
          isFilterActive
            ? 'bg-accent-primary text-white'
            : 'bg-bg-secondary hover:bg-bg-tertiary'
        }`}
        title="Filtr podle skupiny"
      >
        <Filter size={13} className="w-[13px] h-[13px]" />
        {isFilterActive && (
          <span>{filterGroups.size}/{groupStats.length}</span>
        )}
      </button>

      {isOpen && pos && createPortal(
        <div
          ref={dropdownRef}
          // `resize` (= CSS `resize: both`) enables the browser-native
          // drag handle in the bottom-right corner. Pairs with the
          // ResizeObserver above to persist the chosen size in
          // localStorage so subsequent opens preserve it. `overflow-auto`
          // (instead of overflow-y-only) is required for `resize` to
          // actually take effect.
          className="bg-bg-primary border-2 border-border-color rounded-lg overflow-auto resize"
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.openUp ? undefined : pos.top + 4,
            bottom: pos.openUp ? window.innerHeight - pos.top + 4 : undefined,
            width: size.w,
            height: size.h,
            minWidth: MIN_WIDTH,
            minHeight: MIN_HEIGHT,
            maxWidth: '95vw',
            maxHeight: '90vh',
            zIndex: 9999,
            boxShadow: '0 8px 30px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Select all / Clear */}
          <div className="border-b border-border-color px-3 py-2 flex items-center gap-2">
            <button
              onClick={selectAllGroups}
              className="text-xs text-accent-primary hover:underline"
            >
              Zobrazit vše
            </button>
            <span className="text-text-muted text-xs">
              ({itemsCount} položek)
            </span>
          </div>

          {/* Group checkboxes */}
          <div className="py-1">
            {groupStats.map(([group, count]) => {
              const label = group || NO_GROUP_LABEL;
              const isChecked = filterGroups.size === 0 || filterGroups.has(group);
              return (
                <div
                  key={group}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-bg-secondary cursor-pointer text-sm"
                  onClick={() => toggleGroupFilter(group)}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    isChecked
                      ? 'bg-accent-primary border-accent-primary'
                      : 'border-border-color'
                  }`}>
                    {isChecked && <Check size={11} className="text-white w-[11px] h-[11px]" />}
                  </div>
                  <span className={`flex-1 truncate ${group ? 'font-medium text-accent-primary' : 'text-text-muted italic'}`}>
                    {label}
                  </span>
                  <span className="text-text-muted text-xs flex-shrink-0">
                    {count}
                  </span>
                  {group && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        selectOnlyGroup(group);
                      }}
                      className="text-[10px] text-text-muted hover:text-accent-primary px-1"
                      title={`Zobrazit pouze ${label}`}
                    >
                      pouze
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer with count */}
          {isFilterActive && (
            <div className="border-t border-border-color px-3 py-2 text-xs text-text-muted">
              Zobrazeno {filteredCount} z {itemsCount} položek
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
