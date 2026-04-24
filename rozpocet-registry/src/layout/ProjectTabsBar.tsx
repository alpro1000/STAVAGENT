/**
 * ProjectTabsBar — Row 2 of the ribbon layout.
 *
 * 40-px-tall strip with inline project tabs. Active project is
 * highlighted with the solid accent fill (`var(--flat-accent)` + white
 * text). Clicking a tab selects; clicking the trailing × removes.
 *
 * The legacy App.tsx renders a double-height project strip with
 * `◀◀ ◀ ▶ ▶▶` navigation buttons around a scrolling tab container —
 * the ribbon replaces that with a single horizontal-scroll strip
 * (`overflow-x-auto`) + a trailing "Přidat" pill and "Smazat vše"
 * destructive action. No explicit nav buttons: native horizontal
 * scroll + the small overflow cue is enough at ribbon scale.
 */

import { FileSpreadsheet, Plus, Trash2, X } from 'lucide-react';
import type { Project } from '../types';
import { PortalLinkBadge } from '../components/portal/PortalLinkBadge';

export interface ProjectTabsBarProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelect: (projectId: string) => void;
  onRemove: (projectId: string) => void;
  onAdd: () => void;
  onRemoveAll: () => void;
}

export function ProjectTabsBar({
  projects,
  activeProjectId,
  onSelect,
  onRemove,
  onAdd,
  onRemoveAll,
}: ProjectTabsBarProps) {
  return (
    <nav
      className="h-10 flex items-center px-4 gap-2 border-b flex-shrink-0"
      style={{
        background: 'var(--flat-surface)',
        borderColor: 'var(--flat-border)',
      }}
      aria-label="Projekty"
    >
      <span
        className="hidden md:inline text-[11px] uppercase font-semibold whitespace-nowrap tracking-wide"
        style={{ color: 'var(--flat-text-label)', fontFamily: 'var(--font-body)' }}
      >
        Projekty:
      </span>

      {/* Scrollable tab strip. Scrollbar hidden for visual calm —
          native horizontal scroll (wheel / touchpad / touch) still
          works, and the trailing action buttons cap the visual width
          so the strip rarely exceeds the viewport in practice. */}
      <div
        className="flex items-center gap-1 flex-1 overflow-x-auto min-w-0"
        style={{ scrollbarWidth: 'none' }}
      >
        {projects.map((p) => {
          const isActive = p.id === activeProjectId;
          return (
            <div
              key={p.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(p.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(p.id);
                }
              }}
              className={`h-7 px-3 rounded-md text-[12px] flex items-center gap-2 whitespace-nowrap flex-shrink-0 cursor-pointer transition-colors ${
                isActive
                  ? ''
                  : 'hover:bg-[var(--flat-hover)]'
              }`}
              style={{
                fontFamily: 'var(--font-body)',
                background: isActive ? 'var(--flat-accent)' : 'transparent',
                color: isActive ? '#FFFFFF' : 'var(--flat-text)',
              }}
              title={p.projectName}
            >
              <FileSpreadsheet size={13} className="w-[13px] h-[13px] flex-shrink-0" />
              <span className="truncate max-w-[180px]">{p.projectName}</span>
              <span className="text-[10px] opacity-70 tabular-nums flex-shrink-0">
                ({p.sheets.length})
              </span>
              <PortalLinkBadge project={p} compact />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(p.id);
                }}
                className="p-0.5 rounded opacity-60 hover:opacity-100 hover:bg-black/10 transition-opacity"
                title="Smazat projekt"
                aria-label={`Smazat projekt ${p.projectName}`}
              >
                <X size={11} className="w-[11px] h-[11px]" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-1 ml-auto flex-shrink-0">
        {projects.length > 0 && (
          <button
            type="button"
            onClick={onRemoveAll}
            className="h-7 px-2 text-[12px] rounded-md flex items-center gap-1 transition-colors hover:bg-[var(--red-50)]"
            style={{
              color: 'var(--red-500)',
              fontFamily: 'var(--font-body)',
            }}
            title="Smazat všechny projekty"
          >
            <Trash2 size={13} className="w-[13px] h-[13px]" />
            <span className="hidden md:inline">Smazat vše</span>
          </button>
        )}
        <button
          type="button"
          onClick={onAdd}
          className="h-7 px-3 text-[12px] rounded-md flex items-center gap-1 transition-colors"
          style={{
            background: 'var(--flat-accent)',
            color: '#FFFFFF',
            fontFamily: 'var(--font-body)',
          }}
        >
          <Plus size={13} className="w-[13px] h-[13px]" />
          <span className="hidden md:inline">Přidat</span>
        </button>
      </div>
    </nav>
  );
}
