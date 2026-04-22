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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isFilterActive = filterGroups.size > 0;

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dropdownHeight = 340; // max-h of the dropdown
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
    setPos({
      top: openUp ? rect.top : rect.bottom,
      left: Math.min(rect.right - 240, window.innerWidth - 260), // 240 = min-w, clamp right edge
      openUp,
    });
  }, []);

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
          className="bg-bg-primary border-2 border-border-color rounded-lg min-w-[240px] max-h-[340px] overflow-y-auto"
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.openUp ? undefined : pos.top + 4,
            bottom: pos.openUp ? window.innerHeight - pos.top + 4 : undefined,
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
