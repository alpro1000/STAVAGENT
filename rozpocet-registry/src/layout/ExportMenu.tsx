/**
 * ExportMenu — content rendered inside the AppRibbon's Export
 * `ChipPopover`. Surfaces all six export options that the legacy
 * App.tsx menu exposed (the ribbon previously wired Export to only
 * `handleExportProject` — full project XLSX — which read as a
 * regression for users who relied on the per-sheet / TOV / original-
 * patch variants).
 *
 * Pure presentational — no state, all callbacks come from the host.
 * Disabled states gate on whether the action is meaningful in the
 * current selection (no sheet → no per-sheet exports; no original
 * file cached → no patch-back-to-original). Each callback is expected
 * to close the popover itself if appropriate (most of these open a
 * download or modal that takes focus).
 */

import { Download, FileSpreadsheet, RotateCcw } from 'lucide-react';

export interface ExportMenuProps {
  hasSheet: boolean;
  hasOriginalFile: boolean;
  sheetCount: number;
  sheetName?: string;
  onExportSheet: () => void;
  onExportProject: () => void;
  onExportSheetWithTOV: () => void;
  onExportProjectWithTOV: () => void;
  onExportToOriginal: () => void;
  onExportToOriginalWithSkupiny: () => void;
}

interface RowProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  hint?: string;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}

function Row({ icon: Icon, label, hint, disabled = false, title, onClick }: RowProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      className="w-full text-left px-4 py-2.5 text-[13px] flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--flat-hover)]"
      style={{ color: 'var(--flat-text)', fontFamily: 'var(--font-body)' }}
    >
      <Icon size={14} className="w-[14px] h-[14px] flex-shrink-0 text-[var(--flat-text-label)]" />
      <span className="flex-1">{label}</span>
      {hint && (
        <span className="text-[11px] text-[var(--flat-text-label)] tabular-nums whitespace-nowrap">
          {hint}
        </span>
      )}
    </button>
  );
}

export function ExportMenu({
  hasSheet,
  hasOriginalFile,
  sheetCount,
  sheetName,
  onExportSheet,
  onExportProject,
  onExportSheetWithTOV,
  onExportProjectWithTOV,
  onExportToOriginal,
  onExportToOriginalWithSkupiny,
}: ExportMenuProps) {
  const sheetSuffix = sheetName ? `(${sheetName})` : undefined;
  const projectSuffix = `(${sheetCount} ${sheetCount === 1 ? 'list' : 'listy'})`;

  return (
    <div className="py-1">
      {/* Section 1: plain XLSX export */}
      <Row
        icon={FileSpreadsheet}
        label="Export list"
        hint={hasSheet ? sheetSuffix : undefined}
        disabled={!hasSheet}
        onClick={onExportSheet}
      />
      <Row
        icon={Download}
        label="Export projekt"
        hint={projectSuffix}
        onClick={onExportProject}
      />

      <div className="my-1 border-t" style={{ borderColor: 'var(--flat-border)' }} />

      {/* Section 2: XLSX + TOV breakdown */}
      <Row
        icon={FileSpreadsheet}
        label="Export list + TOV rozpis"
        hint={hasSheet ? sheetSuffix : undefined}
        disabled={!hasSheet}
        title="Export listu s rozpisem TOV (práce, materiál, mechanizace, bednění)"
        onClick={onExportSheetWithTOV}
      />
      <Row
        icon={Download}
        label="Export projekt + TOV rozpis"
        hint={projectSuffix}
        title="Export celého projektu s rozpisem TOV (práce, materiál, mechanizace, bednění)"
        onClick={onExportProjectWithTOV}
      />

      <div className="my-1 border-t" style={{ borderColor: 'var(--flat-border)' }} />

      {/* Section 3: write back into the original file */}
      <Row
        icon={RotateCcw}
        label="Vrátit do původního"
        hint="(ceny)"
        disabled={!hasOriginalFile}
        title={hasOriginalFile ? 'Zapsat ceny zpět do originálního souboru' : 'Originální soubor není k dispozici'}
        onClick={onExportToOriginal}
      />
      <Row
        icon={RotateCcw}
        label="Vrátit do původního"
        hint="(ceny + skupiny)"
        disabled={!hasOriginalFile}
        title={hasOriginalFile ? 'Zapsat ceny + skupiny zpět do originálního souboru' : 'Originální soubor není k dispozici'}
        onClick={onExportToOriginalWithSkupiny}
      />
    </div>
  );
}
