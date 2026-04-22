/**
 * SkupinaToolbar — Part A flat-style toolbar for the active skupina.
 *
 * Scope (AUDIT_Registry_FlatLayout.md §4.3.4, PR 2 of §5.3.1 rollout):
 *   - Lifts Sparkles (applyToSimilar) and Globe (applyToAllSheets) from
 *     row-level into a single toolbar above the table.
 *   - Surfaces rename + delete from <GroupManager> without replacing it.
 *   - Adds collapse-all chevron + non-interactive info badges (N, Σ Kč).
 *
 * "Active skupina" model (PR 2 interpretation of §4.3.4):
 *   - When the column-Skupina filter is narrowed to exactly 1 group,
 *     that group is locked as the active skupina (inline label, no picker).
 *   - Otherwise the toolbar renders a native <select> populated from the
 *     skupiny actually present in the current sheet. Actions always target
 *     the selected group — the picker is the single point of context.
 *
 * Per-group inline rendering (one toolbar per skupina block inside the
 * virtualized list) is out of PR 2 scope: it requires sort-by-skupina
 * enforcement + variable-height virtualizer rows — tracked in
 * next-session.md for PR-2-B.
 */

import { useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  Globe,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import type { ParsedItem } from '../../types';
import { useRegistryStore } from '../../stores/registryStore';

interface SkupinaToolbarProps {
  /** All items in the current sheet — source for picker, counts and totals. */
  items: ParsedItem[];
  /** Currently active skupina (null = toolbar hidden / no active group). */
  activeSkupina: string | null;
  onActiveSkupinaChange: (skupina: string | null) => void;
  /** True when column filter pins the picker to exactly one skupina. */
  isFilterLocked: boolean;
  /** Apply activeSkupina to similar items across all sheets in the project. */
  onApplyToSimilar: (sourceItem: ParsedItem) => void;
  /** Apply activeSkupina globally to items with matching kod. */
  onApplyToAllSheets: (sourceItem: ParsedItem) => void;
  /** Collapse every main row inside the active skupina. */
  onCollapseAllInSkupina: (skupina: string) => void;
  applyingSimilar: boolean;
  applyingGlobal: boolean;
}

export function SkupinaToolbar({
  items,
  activeSkupina,
  onActiveSkupinaChange,
  isFilterLocked,
  onApplyToSimilar,
  onApplyToAllSheets,
  onCollapseAllInSkupina,
  applyingSimilar,
  applyingGlobal,
}: SkupinaToolbarProps) {
  const { renameGroup, deleteGroup } = useRegistryStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Skupiny actually present in this sheet, sorted with named first.
  const skupinyInSheet = useMemo(() => {
    const counts = new Map<string, { count: number; total: number; firstWithKod: ParsedItem | null }>();
    items.forEach((item) => {
      if (!item.skupina) return;
      if (item.rowRole === 'section') return;
      const existing = counts.get(item.skupina);
      const total = item.cenaCelkem || 0;
      if (existing) {
        existing.count += 1;
        existing.total += total;
        if (!existing.firstWithKod && item.kod) existing.firstWithKod = item;
      } else {
        counts.set(item.skupina, {
          count: 1,
          total,
          firstWithKod: item.kod ? item : null,
        });
      }
    });
    return Array.from(counts.entries())
      .map(([skupina, stats]) => ({ skupina, ...stats }))
      .sort((a, b) => a.skupina.localeCompare(b.skupina));
  }, [items]);

  const activeStats = activeSkupina
    ? skupinyInSheet.find((s) => s.skupina === activeSkupina)
    : undefined;

  // Nothing to show when the sheet has no skupiny assigned at all.
  if (skupinyInSheet.length === 0) return null;

  const handleStartRename = () => {
    if (!activeSkupina) return;
    setEditValue(activeSkupina);
    setIsEditing(true);
    setConfirmDelete(false);
    requestAnimationFrame(() => editInputRef.current?.select());
  };

  const handleSaveRename = () => {
    if (!activeSkupina) return;
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === activeSkupina) {
      setIsEditing(false);
      return;
    }
    const affected = renameGroup(activeSkupina, trimmed);
    if (affected > 0) {
      onActiveSkupinaChange(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleDelete = () => {
    if (!activeSkupina) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteGroup(activeSkupina);
    setConfirmDelete(false);
    onActiveSkupinaChange(null);
  };

  const handleCollapseAll = () => {
    if (activeSkupina) onCollapseAllInSkupina(activeSkupina);
  };

  const handleApplySimilar = () => {
    if (!activeStats?.firstWithKod) return;
    onApplyToSimilar(activeStats.firstWithKod);
  };

  const handleApplyAllSheets = () => {
    if (!activeStats?.firstWithKod) return;
    onApplyToAllSheets(activeStats.firstWithKod);
  };

  const actionsDisabled = !activeSkupina || !activeStats?.firstWithKod;
  const hasActiveSkupina = activeSkupina !== null;

  return (
    <div
      className="skupina-toolbar"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        padding: '8px 16px',
        background: 'var(--flat-header-bg)',
        borderBottom: '2px solid var(--flat-border)',
        borderTopLeftRadius: 'var(--radius-sm)',
        borderTopRightRadius: 'var(--radius-sm)',
        minHeight: 'var(--flat-header-h)',
      }}
    >
      {/* Collapse-all chevron (structural toggle) */}
      <button
        onClick={() => {
          setIsCollapsed((c) => !c);
          handleCollapseAll();
        }}
        disabled={!hasActiveSkupina}
        className="p-1 rounded transition-colors disabled:opacity-30"
        style={{ color: 'var(--flat-text-label)' }}
        title={hasActiveSkupina ? `Sbalit všechny řádky ve skupině "${activeSkupina}"` : 'Vyberte skupinu'}
      >
        {isCollapsed
          ? <ChevronRight size={11} className="w-[11px] h-[11px]" />
          : <ChevronDown size={11} className="w-[11px] h-[11px]" />}
      </button>

      {/* Skupina picker OR locked label (when filter narrows to single skupina) */}
      {isEditing ? (
        <div className="flex items-center gap-1">
          <input
            ref={editInputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveRename();
              if (e.key === 'Escape') handleCancelRename();
            }}
            className="text-[13px] font-medium bg-white border rounded px-2 py-1 focus:outline-none"
            style={{ borderColor: 'var(--flat-accent)', minWidth: 140 }}
            autoFocus
          />
          <button
            onClick={handleSaveRename}
            className="p-1 rounded hover:bg-bg-secondary"
            style={{ color: 'var(--green-500)' }}
            title="Uložit přejmenování"
          >
            <Check size={13} className="w-[13px] h-[13px]" />
          </button>
          <button
            onClick={handleCancelRename}
            className="p-1 rounded hover:bg-bg-secondary"
            style={{ color: 'var(--flat-text-label)' }}
            title="Zrušit"
          >
            <X size={13} className="w-[13px] h-[13px]" />
          </button>
        </div>
      ) : isFilterLocked && activeSkupina ? (
        <span
          className="text-[13px] font-medium"
          style={{ color: 'var(--flat-text)' }}
          title="Aktivní skupina (filtr omezen na 1)"
        >
          {activeSkupina}
        </span>
      ) : (
        <select
          value={activeSkupina ?? ''}
          onChange={(e) => onActiveSkupinaChange(e.target.value || null)}
          className="text-[13px] font-medium bg-white border rounded px-2 py-1 focus:outline-none cursor-pointer"
          style={{ borderColor: 'var(--flat-border)', color: 'var(--flat-text)' }}
          title="Vybrat aktivní skupinu"
        >
          <option value="">— vyberte skupinu —</option>
          {skupinyInSheet.map((s) => (
            <option key={s.skupina} value={s.skupina}>
              {s.skupina}
            </option>
          ))}
        </select>
      )}

      {/* Info badges (non-interactive, tabular) */}
      {activeStats && (
        <>
          <span className="flat-el-info__sep" aria-hidden />
          <span
            className="text-[11px] uppercase tabular-nums"
            style={{ color: 'var(--flat-text-label)', letterSpacing: '0.05em' }}
            title={`Počet položek ve skupině "${activeSkupina}"`}
          >
            {activeStats.count} položek
          </span>
          <span
            className="text-[11px] tabular-nums"
            style={{ color: 'var(--flat-text-label)' }}
            title="Součet cenaCelkem v této skupině"
          >
            {activeStats.total.toLocaleString('cs-CZ', { minimumFractionDigits: 2 })} Kč
          </span>
        </>
      )}

      {/* Spacer pushes actions to the right edge on desktop; wraps on mobile */}
      <div style={{ flex: '1 1 auto' }} />

      {/* Delete confirm inline message */}
      {confirmDelete && activeSkupina && (
        <span
          className="text-[11px] flex items-center gap-1"
          style={{ color: 'var(--red-500)' }}
        >
          <AlertTriangle size={11} className="w-[11px] h-[11px]" />
          Opravdu smazat? ({activeStats?.count ?? 0} položek zůstane bez skupiny)
        </span>
      )}

      {/* Actions cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={handleApplySimilar}
          disabled={actionsDisabled || applyingSimilar}
          className="p-1 rounded hover:bg-bg-secondary transition-colors disabled:opacity-30"
          title="Aplikovat na podobné položky v celém projektu (všechny listy)"
        >
          <Sparkles
            size={13}
            className="w-[13px] h-[13px]"
            style={{ color: 'var(--flat-accent)' }}
          />
        </button>
        <button
          onClick={handleApplyAllSheets}
          disabled={actionsDisabled || applyingGlobal}
          className="p-1 rounded hover:bg-bg-secondary transition-colors disabled:opacity-30"
          title="Aplikovat na VŠECHNY listy se stejným kódem"
        >
          <Globe
            size={13}
            className="w-[13px] h-[13px]"
            style={{ color: 'var(--blue-500)' }}
          />
        </button>

        <span className="flat-el-info__sep" aria-hidden />

        <button
          onClick={handleStartRename}
          disabled={!hasActiveSkupina}
          className="p-1 rounded hover:bg-bg-secondary transition-colors disabled:opacity-30"
          style={{ color: 'var(--flat-text-label)' }}
          title="Přejmenovat skupinu (ovlivní všechny položky)"
        >
          <Pencil size={13} className="w-[13px] h-[13px]" />
        </button>
        <button
          onClick={handleDelete}
          disabled={!hasActiveSkupina}
          className="p-1 rounded hover:bg-bg-secondary transition-colors disabled:opacity-30"
          style={{
            color: confirmDelete ? 'var(--red-500)' : 'var(--flat-text-label)',
            opacity: confirmDelete ? 1 : 0.5,
          }}
          title={confirmDelete ? 'Potvrdit smazání' : 'Smazat skupinu (položky zůstanou bez skupiny)'}
        >
          <Trash2 size={13} className="w-[13px] h-[13px]" />
        </button>
      </div>
    </div>
  );
}
