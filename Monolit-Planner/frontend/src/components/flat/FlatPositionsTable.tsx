/**
 * FlatPositionsTable — Positions table with part grouping, flat design.
 *
 * Groups positions by part_name, sorted by construction sequence.
 * beton = primary row, bednění/výztuž = subordinate (indented).
 * Supports: inline editing, RFI filter, Vypočítat navigation.
 */

import { useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator, AlertTriangle, Sparkles, Lock,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import type { Position, Subtype } from '@stavagent/monolit-shared';
import {
  SUBTYPE_LABELS, UNIT_LABELS,
  sortPartsBySequence,
} from '@stavagent/monolit-shared';
import { useUI } from '../../context/UIContext';
import { useProjectPositions } from '../../hooks/useProjectPositions';
import FlatKPIPanel from './FlatKPIPanel';
import FlatProjectSettings from './FlatProjectSettings';
import FlatTOVSection from './FlatTOVSection';
import FlatToolbar from './FlatToolbar';
import FlatGantt from './FlatGantt';
import FlatSnapshots from './FlatSnapshots';

/** Helper: CSS class for subtype badge */
function subtypeBadgeClass(subtype: Subtype): string {
  const map: Record<string, string> = {
    beton: 'flat-badge--beton',
    'bednění': 'flat-badge--bedneni',
    'odbednění': 'flat-badge--odbedneni',
    'výztuž': 'flat-badge--vystuz',
    'jiné': 'flat-badge--jine',
  };
  return map[subtype] || 'flat-badge--jine';
}

/** Helper: calculation status */
function calcStatus(pos: Position): 'empty' | 'progress' | 'done' | 'incomplete' {
  if (!pos.kros_total_czk && !pos.days) return 'empty';
  if (pos.has_rfi) return 'incomplete';
  if (pos.kros_total_czk && pos.days) return 'done';
  return 'progress';
}

/** Format number for display */
function fmt(n: number | null | undefined, d = 0): string {
  if (n == null || isNaN(n)) return '';
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });
}

interface PartGroup {
  partName: string;
  positions: Position[];
}

export default function FlatPositionsTable() {
  const { selectedProjectId, activeSnapshot } = useUI();
  const {
    positions, headerKPI, isLoading,
    updatePositions,
  } = useProjectPositions();
  const navigate = useNavigate();
  const isLocked = activeSnapshot?.is_locked ?? false;

  // Expanded TOV sections
  const [expandedTOV, setExpandedTOV] = useState<Set<string>>(new Set());

  // Group positions by part_name, sorted by construction sequence
  const groups = useMemo((): PartGroup[] => {
    if (!positions.length) return [];

    // Collect unique part names
    const partNames = [...new Set(positions.map(p => p.part_name))];
    const sorted = sortPartsBySequence(partNames);

    return sorted.map(partName => ({
      partName,
      positions: positions
        .filter(p => p.part_name === partName)
        // beton first, then bednění, then výztuž, then rest
        .sort((a, b) => {
          const order: Record<string, number> = { beton: 0, 'bednění': 1, 'odbednění': 2, 'výztuž': 3, 'jiné': 4 };
          return (order[a.subtype] ?? 5) - (order[b.subtype] ?? 5);
        }),
    }));
  }, [positions]);

  // Navigate to calculator
  const handleCalculate = useCallback((pos: Position) => {
    // Save scroll position for return
    sessionStorage.setItem('monolit-planner-return-part', pos.part_name);
    sessionStorage.setItem('monolit-planner-scroll-y', String(window.scrollY));

    // Find related positions (same part: bednění, výztuž)
    const related = positions.filter(
      p => p.part_name === pos.part_name && p.id !== pos.id
    );
    const bedneniPos = related.find(p => p.subtype === 'bednění');
    const vystuzPos = related.find(p => p.subtype === 'výztuž');

    const params = new URLSearchParams();
    params.set('bridge_id', pos.bridge_id);
    if (pos.id) params.set('position_id', pos.id);
    params.set('part_name', pos.part_name);
    params.set('subtype', pos.subtype);
    if (pos.concrete_m3) params.set('volume_m3', String(pos.concrete_m3));
    if (pos.qty) params.set('qty', String(pos.qty));
    if (bedneniPos?.id) params.set('bedneni_position_id', bedneniPos.id);
    if (vystuzPos?.id) params.set('vystuz_position_id', vystuzPos.id);

    navigate(`/planner?${params.toString()}`);
  }, [positions, navigate]);

  // Inline edit handler
  const handleFieldChange = useCallback(async (
    pos: Position,
    field: keyof Position,
    value: number
  ) => {
    if (isLocked || !pos.id) return;
    await updatePositions([{ id: pos.id, [field]: value }]);
  }, [isLocked, updatePositions]);

  const toggleTOV = useCallback((posId: string) => {
    setExpandedTOV(prev => {
      const next = new Set(prev);
      if (next.has(posId)) next.delete(posId); else next.add(posId);
      return next;
    });
  }, []);

  if (!selectedProjectId) {
    return (
      <div className="flat-empty">
        <Calculator size={48} className="flat-empty__icon" />
        <div className="flat-empty__title">Vyberte objekt</div>
        <div className="flat-empty__text">
          Vyberte konstrukční objekt v postranním panelu pro zobrazení pozic.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flat-loading"><div className="flat-spinner" /> Načítání pozic...</div>;
  }

  return (
    <div>
      {/* Project settings (wage, shift, mode) */}
      <FlatProjectSettings />

      {/* KPI panel */}
      <FlatKPIPanel kpi={headerKPI} />

      {/* Toolbar: filters + actions */}
      <FlatToolbar positionCount={positions.length} />

      {/* Positions table */}
      {positions.length === 0 ? (
        <div className="flat-empty">
          <AlertTriangle size={32} className="flat-empty__icon" />
          <div className="flat-empty__title">Žádné pozice</div>
          <div className="flat-empty__text">
            Nahrajte Excel nebo importujte z Registry.
          </div>
        </div>
      ) : (
        <div className="flat-table-wrap">
          <table className="flat-table">
            <thead>
              <tr>
                <th style={{ width: 240 }}>Element</th>
                <th style={{ width: 80 }}>Typ</th>
                <th style={{ width: 70 }} className="flat-col--right">MJ</th>
                <th style={{ width: 80 }} className="flat-col--right">Množství</th>
                <th style={{ width: 60 }} className="flat-col--right flat-col--hide-mobile">Lidé</th>
                <th style={{ width: 70 }} className="flat-col--right flat-col--hide-mobile">Kč/h</th>
                <th style={{ width: 60 }} className="flat-col--right flat-col--hide-mobile">H/den</th>
                <th style={{ width: 60 }} className="flat-col--right">Dny</th>
                <th style={{ width: 80 }} className="flat-col--right flat-col--hide-mobile">Celk.hod</th>
                <th style={{ width: 100 }} className="flat-col--right">Celkem</th>
                <th style={{ width: 90 }} className="flat-col--right flat-col--hide-mobile">Jedn. cena</th>
                <th style={{ width: 60 }} className="flat-col--center">Status</th>
                <th style={{ width: 60 }} className="flat-col--center">Akce</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <PartGroupRows
                  key={group.partName}
                  group={group}
                  isLocked={isLocked}
                  expandedTOV={expandedTOV}
                  onCalculate={handleCalculate}
                  onFieldChange={handleFieldChange}
                  onToggleTOV={toggleTOV}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Gantt chart (embedded, not a separate route) */}
      {positions.length > 0 && (
        <FlatGantt positions={positions} />
      )}

      {/* Snapshots */}
      <FlatSnapshots />
    </div>
  );
}

/** Part group: header row + position rows */
function PartGroupRows({
  group, isLocked, expandedTOV,
  onCalculate, onFieldChange, onToggleTOV,
}: {
  group: PartGroup;
  isLocked: boolean;
  expandedTOV: Set<string>;
  onCalculate: (pos: Position) => void;
  onFieldChange: (pos: Position, field: keyof Position, value: number) => void;
  onToggleTOV: (posId: string) => void;
}) {
  // Sum concrete m3 for this part
  const partM3 = group.positions
    .filter(p => p.subtype === 'beton')
    .reduce((s, p) => s + (p.concrete_m3 || 0), 0);

  return (
    <>
      {/* Part header row */}
      <tr className="flat-part-header" id={`part-${group.partName}`}>
        <td colSpan={2}>{group.partName}</td>
        <td></td>
        <td className="flat-col--right flat-mono">{partM3 ? fmt(partM3, 1) + ' m³' : ''}</td>
        <td colSpan={9}></td>
      </tr>

      {/* Position rows */}
      {group.positions.map(pos => {
        const isSub = pos.subtype !== 'beton';
        const status = calcStatus(pos);
        const hasTOV = expandedTOV.has(pos.id || '');

        return (
          <PositionRows
            key={pos.id || `${pos.part_name}-${pos.subtype}`}
            pos={pos}
            isSub={isSub}
            status={status}
            isLocked={isLocked}
            showTOV={hasTOV}
            onCalculate={onCalculate}
            onFieldChange={onFieldChange}
            onToggleTOV={onToggleTOV}
          />
        );
      })}
    </>
  );
}

/** Single position row + optional TOV expansion */
function PositionRows({
  pos, isSub, status, isLocked, showTOV,
  onCalculate, onFieldChange, onToggleTOV,
}: {
  pos: Position;
  isSub: boolean;
  status: string;
  isLocked: boolean;
  showTOV: boolean;
  onCalculate: (pos: Position) => void;
  onFieldChange: (pos: Position, field: keyof Position, value: number) => void;
  onToggleTOV: (posId: string) => void;
}) {
  const rowClass = [
    'flat-row',
    isSub ? 'flat-row--sub' : 'flat-row--beton',
    pos.has_rfi ? 'flat-row--rfi' : '',
  ].filter(Boolean).join(' ');

  const statusBadge = {
    empty: { cls: 'flat-badge--status-empty', label: '—' },
    progress: { cls: 'flat-badge--status-progress', label: 'Rozprac.' },
    done: { cls: 'flat-badge--status-done', label: 'OK' },
    incomplete: { cls: 'flat-badge--status-incomplete', label: 'NEÚPLNÉ' },
  }[status] || { cls: '', label: '' };

  const unitLabel = UNIT_LABELS[pos.unit] || pos.unit || '';

  return (
    <>
      <tr className={rowClass} data-position-instance-id={pos.position_instance_id}>
        {/* Element name — clickable to expand TOV */}
        <td
          style={{ cursor: 'pointer' }}
          onClick={() => pos.id && onToggleTOV(pos.id)}
          title={pos.item_name || pos.part_name}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {pos.id && (showTOV ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
            {pos.item_name || SUBTYPE_LABELS[pos.subtype] || pos.subtype}
          </span>
        </td>

        {/* Type badge */}
        <td>
          <span className={`flat-badge ${subtypeBadgeClass(pos.subtype)}`}>
            {SUBTYPE_LABELS[pos.subtype] || pos.subtype}
          </span>
        </td>

        {/* Unit */}
        <td className="flat-col--right flat-mono">{unitLabel}</td>

        {/* Quantity */}
        <td className="flat-col--right">
          <span className="flat-mono">{fmt(pos.qty, 1)}</span>
        </td>

        {/* Crew size */}
        <td className="flat-col--right flat-col--hide-mobile">
          <EditableCell
            value={pos.crew_size}
            disabled={isLocked}
            onChange={v => onFieldChange(pos, 'crew_size', v)}
          />
        </td>

        {/* Wage */}
        <td className="flat-col--right flat-col--hide-mobile">
          <EditableCell
            value={pos.wage_czk_ph}
            disabled={isLocked}
            onChange={v => onFieldChange(pos, 'wage_czk_ph', v)}
          />
        </td>

        {/* Shift hours */}
        <td className="flat-col--right flat-col--hide-mobile">
          <EditableCell
            value={pos.shift_hours}
            disabled={isLocked}
            onChange={v => onFieldChange(pos, 'shift_hours', v)}
          />
        </td>

        {/* Days */}
        <td className="flat-col--right">
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <EditableCell
              value={pos.days}
              disabled={isLocked}
              onChange={v => onFieldChange(pos, 'days', v)}
            />
          </div>
        </td>

        {/* Total hours */}
        <td className="flat-col--right flat-col--hide-mobile">
          <span className="flat-mono flat-tooltip">
            {fmt(pos.labor_hours, 0)}
            {pos.labor_hours ? (
              <span className="flat-tooltip__content">
                {pos.crew_size} × {pos.shift_hours}h × {pos.days}d = {fmt(pos.labor_hours)} Nhod
              </span>
            ) : null}
          </span>
        </td>

        {/* Total cost (Celkem) */}
        <td className="flat-col--right">
          <span className="flat-mono flat-tooltip">
            {pos.kros_total_czk ? fmt(pos.kros_total_czk) : fmt(pos.cost_czk)}
            {pos.cost_czk ? (
              <span className="flat-tooltip__content">
                {fmt(pos.labor_hours)} Nhod × {fmt(pos.wage_czk_ph)} Kč/h = {fmt(pos.cost_czk)} Kč
              </span>
            ) : null}
          </span>
        </td>

        {/* Unit price (Jedn. cena) */}
        <td className="flat-col--right flat-col--hide-mobile">
          <span className="flat-mono">
            {pos.kros_unit_czk ? fmt(pos.kros_unit_czk) : ''}
          </span>
        </td>

        {/* Status */}
        <td className="flat-col--center">
          <span className={`flat-badge ${statusBadge.cls}`}>{statusBadge.label}</span>
        </td>

        {/* Actions */}
        <td className="flat-col--center">
          {isLocked ? (
            <Lock size={14} style={{ color: 'var(--stone-400)' }} />
          ) : pos.subtype === 'beton' ? (
            <button
              className="flat-icon-btn flat-icon-btn--accent"
              onClick={() => onCalculate(pos)}
              title="Vypočítat v kalkulátoru"
            >
              <Calculator size={14} />
            </button>
          ) : null}
        </td>
      </tr>

      {/* Expanded TOV section */}
      {showTOV && pos.id && (
        <FlatTOVSection positionId={pos.id} position={pos} />
      )}
    </>
  );
}

/** Inline editable numeric cell */
function EditableCell({
  value, disabled, onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  if (!editing) {
    return (
      <span
        className="flat-mono"
        onDoubleClick={() => {
          if (disabled) return;
          setEditing(true);
          setText(String(value || ''));
        }}
        style={{ cursor: disabled ? 'default' : 'pointer', display: 'block', textAlign: 'right' }}
      >
        {value ? fmt(value) : ''}
      </span>
    );
  }

  return (
    <input
      className="flat-inline-input"
      type="number"
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={() => {
        setEditing(false);
        const n = parseFloat(text);
        if (!isNaN(n) && n !== value) onChange(n);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setEditing(false); }
      }}
      autoFocus
      style={{ textAlign: 'right' }}
    />
  );
}
