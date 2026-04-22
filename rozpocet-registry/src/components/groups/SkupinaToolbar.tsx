/**
 * SkupinaToolbar — Part A flat-style management surface for one skupina.
 *
 * Scope (AUDIT_Registry_FlatLayout.md §4.3.4, PR 2 of §5.3.1 rollout):
 *   - Surfaces rename + delete + collapse-all for the currently-active
 *     skupina without requiring the user to open <GroupManager>.
 *   - Shows count + sum info badges (§4.3.4 "N položek · Σ Kč").
 *
 * Scope reversal vs. initial PR 2 attempt:
 *   - Sparkles (applyToSimilar) and Globe (applyToAllSheets) stay on
 *     row-level (where each row already carries the source item those
 *     handlers need). The earlier lift into the toolbar required a
 *     picker and duplicated the existing column-filter; per-row was
 *     faster in practice.
 *   - No picker. Active skupina is driven entirely by the column-Skupina
 *     filter — when the filter pins exactly one group, the parent passes
 *     that group as activeSkupina; otherwise it passes null and this
 *     component returns null.
 *
 * Contract: parent owns the filter-lock decision. This component never
 * renders its own skupina-selection UI.
 */

import { useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react';
import type { ParsedItem } from '../../types';
import { useRegistryStore } from '../../stores/registryStore';

interface SkupinaToolbarProps {
  /** All items in the current sheet — source for counts and totals. */
  items: ParsedItem[];
  /**
   * Active skupina, or null to hide the toolbar. Parent derives this from
   * the column-Skupina filter (exactly one selected = that skupina).
   */
  activeSkupina: string | null;
  /** Collapse every expanded main row inside the active skupina. */
  onCollapseAllInSkupina: (skupina: string) => void;
  /** Parent syncs filterGroups from old → new name after rename. */
  onSkupinaRenamed: (oldName: string, newName: string) => void;
  /** Parent clears filterGroups entry after delete. */
  onSkupinaDeleted: (name: string) => void;
}

export function SkupinaToolbar({
  items,
  activeSkupina,
  onCollapseAllInSkupina,
  onSkupinaRenamed,
  onSkupinaDeleted,
}: SkupinaToolbarProps) {
  const { renameGroup, deleteGroup } = useRegistryStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Count + sum for the active skupina, derived from the current sheet.
  const activeStats = useMemo(() => {
    if (!activeSkupina) return null;
    let count = 0;
    let total = 0;
    items.forEach((item) => {
      if (item.skupina !== activeSkupina) return;
      if (item.rowRole === 'section') return;
      count += 1;
      total += item.cenaCelkem || 0;
    });
    return { count, total };
  }, [items, activeSkupina]);

  // Hide entirely when parent hasn't locked the filter to a single skupina.
  if (!activeSkupina) return null;

  const handleStartRename = () => {
    setEditValue(activeSkupina);
    setIsEditing(true);
    setConfirmDelete(false);
    requestAnimationFrame(() => editInputRef.current?.select());
  };

  const handleSaveRename = () => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === activeSkupina) {
      setIsEditing(false);
      return;
    }
    const affected = renameGroup(activeSkupina, trimmed);
    if (affected > 0) {
      onSkupinaRenamed(activeSkupina, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteGroup(activeSkupina);
    setConfirmDelete(false);
    onSkupinaDeleted(activeSkupina);
  };

  const handleCollapseAll = () => {
    onCollapseAllInSkupina(activeSkupina);
  };

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
        className="p-1 rounded transition-colors"
        style={{ color: 'var(--flat-text-label)' }}
        title={`Sbalit všechny řádky ve skupině "${activeSkupina}"`}
      >
        {isCollapsed
          ? <ChevronRight size={11} className="w-[11px] h-[11px]" />
          : <ChevronDown size={11} className="w-[11px] h-[11px]" />}
      </button>

      {/* Active skupina label / inline rename input */}
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
      ) : (
        <span
          className="text-[13px] font-medium"
          style={{ color: 'var(--flat-text)' }}
          title="Aktivní skupina (filtr omezen na 1)"
        >
          {activeSkupina}
        </span>
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
      {confirmDelete && (
        <span
          className="text-[11px] flex items-center gap-1"
          style={{ color: 'var(--red-500)' }}
        >
          <AlertTriangle size={11} className="w-[11px] h-[11px]" />
          Opravdu smazat? ({activeStats?.count ?? 0} položek zůstane bez skupiny)
        </span>
      )}

      {/* Actions cluster — management only (per-row Sparkles/Globe live in the cell) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={handleStartRename}
          className="p-1 rounded hover:bg-bg-secondary transition-colors"
          style={{ color: 'var(--flat-text-label)' }}
          title="Přejmenovat skupinu (ovlivní všechny položky)"
        >
          <Pencil size={13} className="w-[13px] h-[13px]" />
        </button>
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-bg-secondary transition-colors"
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
