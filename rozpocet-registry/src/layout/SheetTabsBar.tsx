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

import { useRef } from 'react';
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import type { Sheet } from '../types';

export interface SheetTabsBarProps {
  sheets: Sheet[];
  activeSheetId: string | null;
  onSelect: (sheetId: string) => void;
}

const SCROLL_STEP_PX = 240;

export function SheetTabsBar({ sheets, activeSheetId, onSelect }: SheetTabsBarProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => stripRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  const scrollToEdge = (edge: 'start' | 'end') => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollTo({ left: edge === 'start' ? 0 : el.scrollWidth, behavior: 'smooth' });
  };

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

      {/* Leading nav (start + step-back) — always rendered so users have
          a predictable click target. Excel-style: arrows are part of the
          tab strip's affordance, not a contextual extra. */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => scrollToEdge('start')}
          className="h-7 w-7 rounded border text-[var(--flat-text-label)] hover:bg-[var(--flat-hover)] hover:border-[var(--flat-accent)] flex items-center justify-center transition-colors"
          style={{ borderColor: 'var(--flat-border)' }}
          title="Na začátek"
          aria-label="Posunout na začátek seznamu listů"
        >
          <ChevronsLeft size={14} className="w-[14px] h-[14px]" />
        </button>
        <button
          type="button"
          onClick={() => scrollBy(-SCROLL_STEP_PX)}
          className="h-7 w-7 rounded border text-[var(--flat-text-label)] hover:bg-[var(--flat-hover)] hover:border-[var(--flat-accent)] flex items-center justify-center transition-colors"
          style={{ borderColor: 'var(--flat-border)' }}
          title="Předchozí"
          aria-label="Posunout o krok vlevo"
        >
          <ChevronLeft size={14} className="w-[14px] h-[14px]" />
        </button>
      </div>

      <div
        ref={stripRef}
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

      {/* Trailing nav (step-forward + jump-to-end). */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={() => scrollBy(SCROLL_STEP_PX)}
          className="h-7 w-7 rounded border text-[var(--flat-text-label)] hover:bg-[var(--flat-hover)] hover:border-[var(--flat-accent)] flex items-center justify-center transition-colors"
          style={{ borderColor: 'var(--flat-border)' }}
          title="Další"
          aria-label="Posunout o krok vpravo"
        >
          <ChevronRight size={14} className="w-[14px] h-[14px]" />
        </button>
        <button
          type="button"
          onClick={() => scrollToEdge('end')}
          className="h-7 w-7 rounded border text-[var(--flat-text-label)] hover:bg-[var(--flat-hover)] hover:border-[var(--flat-accent)] flex items-center justify-center transition-colors"
          style={{ borderColor: 'var(--flat-border)' }}
          title="Na konec"
          aria-label="Posunout na konec seznamu listů"
        >
          <ChevronsRight size={14} className="w-[14px] h-[14px]" />
        </button>
      </div>
    </nav>
  );
}
