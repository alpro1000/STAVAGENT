/**
 * SheetTabsBar — Row 3 of the ribbon layout.
 *
 * Mirrors `ProjectTabsBar` but for the selected project's sheets.
 * Visual hierarchy vs. project tabs:
 *
 *   project  ACTIVE = solid orange fill + white text (strong signal)
 *   sheet    ACTIVE = light orange background + orange text (weaker)
 *
 * The weaker active signal keeps the two strips visually distinct so
 * the user doesn't confuse "selected project" with "selected sheet"
 * at a glance. Returns null when the active project has no sheets
 * (the legacy layout showed an empty label strip in that case).
 */

import type { Sheet } from '../types';

export interface SheetTabsBarProps {
  sheets: Sheet[];
  activeSheetId: string | null;
  onSelect: (sheetId: string) => void;
}

export function SheetTabsBar({ sheets, activeSheetId, onSelect }: SheetTabsBarProps) {
  if (sheets.length === 0) return null;

  return (
    <nav
      className="h-10 flex items-center px-4 gap-2 border-b flex-shrink-0"
      style={{
        background: 'var(--flat-surface-2)',
        borderColor: 'var(--flat-border)',
      }}
      aria-label="Listy"
    >
      <span
        className="hidden md:inline text-[11px] uppercase font-semibold whitespace-nowrap tracking-wide"
        style={{ color: 'var(--flat-text-label)', fontFamily: 'var(--font-body)' }}
      >
        Listy:
      </span>

      <div
        className="flex items-center gap-1 flex-1 overflow-x-auto min-w-0"
        style={{ scrollbarWidth: 'none' }}
      >
        {sheets.map((s) => {
          const isActive = s.id === activeSheetId;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(s.id)}
              className={`h-7 px-3 rounded-md text-[12px] whitespace-nowrap flex-shrink-0 transition-colors ${
                isActive ? '' : 'hover:bg-[var(--flat-hover)]'
              }`}
              style={{
                fontFamily: 'var(--font-body)',
                background: isActive ? 'var(--flat-accent-light)' : 'transparent',
                color: isActive ? 'var(--flat-accent)' : 'var(--flat-text)',
                fontWeight: isActive ? 600 : 400,
              }}
              title={s.name}
            >
              {s.name}
              <span
                className="text-[10px] ml-1 tabular-nums"
                style={{ opacity: isActive ? 0.7 : 0.6 }}
              >
                ({s.stats.totalItems})
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
