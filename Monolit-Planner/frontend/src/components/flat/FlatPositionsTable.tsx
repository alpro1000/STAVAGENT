/**
 * FlatPositionsTable — Full positions table with 15 columns, part grouping.
 *
 * Spec columns: Práce, MJ, Množství, Počet lidí, Kč/h, Hod/den, Dny, MJ/h,
 *               Celk.hod, Celk.Kč, Jedn.cena/m³, Jedn.cena (zaokr.), Celkem, RFI, Akce
 *
 * Features: bidirectional MJ/h ↔ Dny, formula tooltips on all calculated numbers,
 * OTSKP autocomplete in part header, override detection (orange color), AI suggestion.
 */

import { useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator, AlertTriangle, Lock,
  ChevronDown, ChevronRight, Sparkles, AlertCircle,
} from 'lucide-react';
import type { Position, Subtype } from '@stavagent/monolit-shared';
import {
  SUBTYPE_LABELS, UNIT_LABELS,
  sortPartsBySequence,
} from '@stavagent/monolit-shared';
import { useUI } from '../../context/UIContext';
import { useProjectPositions } from '../../hooks/useProjectPositions';
import OtskpAutocomplete from '../OtskpAutocomplete';
import FlatKPIPanel from './FlatKPIPanel';
import FlatProjectSettings from './FlatProjectSettings';
import FlatTOVSection from './FlatTOVSection';
import FlatToolbar from './FlatToolbar';
import FlatGantt from './FlatGantt';
import FlatSnapshots from './FlatSnapshots';

/* ── Helpers ─────────────────────────────────────────────────── */

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

function calcStatus(pos: Position): 'empty' | 'progress' | 'done' | 'incomplete' {
  if (!pos.kros_total_czk && !pos.days) return 'empty';
  if (pos.has_rfi) return 'incomplete';
  if (pos.kros_total_czk && pos.days) return 'done';
  return 'progress';
}

function fmt(n: number | null | undefined, d = 0): string {
  if (n == null || isNaN(n)) return '';
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Speed: MJ/h = qty / labor_hours */
function calcSpeed(pos: Position): number | null {
  if (!pos.labor_hours || !pos.qty) return null;
  return pos.qty / pos.labor_hours;
}

interface PartGroup {
  partName: string;
  positions: Position[];
}

/* ── CONFIG DEFAULTS (for override detection) ─────────────── */
const PROJECT_DEFAULTS = { wage: 398, shift: 10 };

/* ── MAIN COMPONENT ──────────────────────────────────────────── */

export default function FlatPositionsTable() {
  const { selectedProjectId, activeSnapshot } = useUI();
  const {
    positions, headerKPI, isLoading,
    updatePositions,
  } = useProjectPositions();
  const navigate = useNavigate();
  const isLocked = activeSnapshot?.is_locked ?? false;

  const [expandedTOV, setExpandedTOV] = useState<Set<string>>(new Set());

  // Group positions by part_name, sorted by construction sequence
  const groups = useMemo((): PartGroup[] => {
    if (!positions.length) return [];
    const partNames = [...new Set(positions.map(p => p.part_name))];
    const sorted = sortPartsBySequence(partNames);
    return sorted.map(partName => ({
      partName,
      positions: positions
        .filter(p => p.part_name === partName)
        .sort((a, b) => {
          const order: Record<string, number> = { beton: 0, 'bednění': 1, 'odbednění': 2, 'výztuž': 3, 'jiné': 4 };
          return (order[a.subtype] ?? 5) - (order[b.subtype] ?? 5);
        }),
    }));
  }, [positions]);

  // Navigate to calculator
  const handleCalculate = useCallback((pos: Position) => {
    sessionStorage.setItem('monolit-planner-return-part', pos.part_name);
    sessionStorage.setItem('monolit-planner-scroll-y', String(window.scrollY));
    const related = positions.filter(p => p.part_name === pos.part_name && p.id !== pos.id);
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
    pos: Position, field: keyof Position, value: number
  ) => {
    if (isLocked || !pos.id) return;
    await updatePositions([{ id: pos.id, [field]: value }]);
  }, [isLocked, updatePositions]);

  // Bidirectional MJ/h: set speed → recalc days
  const handleSpeedChange = useCallback(async (pos: Position, speed: number) => {
    if (isLocked || !pos.id || !speed || !pos.qty) return;
    // days = qty / (speed * crew_size * shift_hours)
    // but simpler: labor_hours = qty / speed, days = labor_hours / (crew * shift)
    const laborHours = pos.qty / speed;
    const days = Math.ceil(laborHours / ((pos.crew_size || 4) * (pos.shift_hours || 10)));
    await updatePositions([{ id: pos.id, days }]);
  }, [isLocked, updatePositions]);

  // OTSKP select on part
  const handleOtskpSelect = useCallback(async (
    posId: string, code: string, _name: string, _unitPrice?: number
  ) => {
    if (isLocked) return;
    const updates: Partial<Position> & { id: string } = { id: posId, otskp_code: code };
    // Store catalog price in metadata if available
    await updatePositions([updates]);
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
      <FlatProjectSettings />
      <FlatKPIPanel kpi={headerKPI} />
      <FlatToolbar positionCount={positions.length} />

      {positions.length === 0 ? (
        <div className="flat-empty">
          <AlertTriangle size={32} className="flat-empty__icon" />
          <div className="flat-empty__title">Žádné pozice</div>
          <div className="flat-empty__text">Nahrajte Excel nebo importujte z Registry.</div>
        </div>
      ) : (
        <div className="flat-table-wrap">
          <table className="flat-table">
            <thead>
              <tr>
                <th style={{ width: 220 }}>Element</th>
                <th style={{ width: 75 }}>Typ</th>
                <th style={{ width: 50 }} className="flat-col--right">MJ</th>
                <th style={{ width: 75 }} className="flat-col--right">Množství</th>
                <th style={{ width: 50 }} className="flat-col--right flat-col--hide-mobile">Lidé</th>
                <th style={{ width: 60 }} className="flat-col--right flat-col--hide-mobile">Kč/h</th>
                <th style={{ width: 55 }} className="flat-col--right flat-col--hide-mobile">Hod/den</th>
                <th style={{ width: 50 }} className="flat-col--right">Dny</th>
                <th style={{ width: 55 }} className="flat-col--right flat-col--hide-mobile">MJ/h</th>
                <th style={{ width: 70 }} className="flat-col--right flat-col--hide-mobile">Celk.hod</th>
                <th style={{ width: 80 }} className="flat-col--right flat-col--hide-mobile">Celk.Kč</th>
                <th style={{ width: 70 }} className="flat-col--right flat-col--hide-mobile">Kč/m³</th>
                <th style={{ width: 70 }} className="flat-col--right">Jedn. cena</th>
                <th style={{ width: 80 }} className="flat-col--right">Celkem</th>
                <th style={{ width: 40 }} className="flat-col--center flat-col--hide-mobile">RFI</th>
                <th style={{ width: 55 }} className="flat-col--center">Akce</th>
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
                  onSpeedChange={handleSpeedChange}
                  onOtskpSelect={handleOtskpSelect}
                  onToggleTOV={toggleTOV}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {positions.length > 0 && <FlatGantt positions={positions} />}
      <FlatSnapshots />
    </div>
  );
}

/* ── PART GROUP ───────────────────────────────────────────────── */

function PartGroupRows({
  group, isLocked, expandedTOV,
  onCalculate, onFieldChange, onSpeedChange, onOtskpSelect, onToggleTOV,
}: {
  group: PartGroup;
  isLocked: boolean;
  expandedTOV: Set<string>;
  onCalculate: (pos: Position) => void;
  onFieldChange: (pos: Position, field: keyof Position, value: number) => void;
  onSpeedChange: (pos: Position, speed: number) => void;
  onOtskpSelect: (posId: string, code: string, name: string, unitPrice?: number) => void;
  onToggleTOV: (posId: string) => void;
}) {
  const betonPos = group.positions.find(p => p.subtype === 'beton');
  const partM3 = group.positions
    .filter(p => p.subtype === 'beton')
    .reduce((s, p) => s + (p.concrete_m3 || 0), 0);
  const partTotalDays = group.positions
    .filter(p => p.subtype === 'beton')
    .reduce((s, p) => s + (p.days || 0), 0);
  const partKrosTotal = group.positions.reduce((s, p) => s + (p.kros_total_czk || 0), 0);

  return (
    <>
      {/* Part header row — includes OTSKP autocomplete */}
      <tr className="flat-part-header" id={`part-${group.partName}`}>
        <td colSpan={2} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{group.partName}</span>
          {/* OTSKP autocomplete for the beton position of this part */}
          {betonPos?.id && !isLocked && (
            <span style={{ flex: '0 0 200px', display: 'inline-block' }}>
              <OtskpAutocomplete
                value={betonPos.otskp_code || ''}
                onSelect={(code, name, price, _unit) => onOtskpSelect(betonPos.id!, code, name, price)}
                disabled={isLocked}
              />
            </span>
          )}
        </td>
        <td></td>
        <td className="flat-col--right flat-mono">{partM3 ? fmt(partM3, 1) + ' m³' : ''}</td>
        <td colSpan={4}></td>
        <td className="flat-col--right flat-col--hide-mobile"></td>
        <td className="flat-col--right flat-col--hide-mobile flat-mono">{partTotalDays ? fmt(partTotalDays) + ' d' : ''}</td>
        <td></td>
        <td></td>
        <td></td>
        <td className="flat-col--right flat-mono">{partKrosTotal ? fmt(partKrosTotal) + ' Kč' : ''}</td>
        <td></td>
        <td></td>
      </tr>

      {group.positions.map(pos => {
        const isSub = pos.subtype !== 'beton';
        const status = calcStatus(pos);
        const hasTOV = expandedTOV.has(pos.id || '');
        return (
          <PositionRow
            key={pos.id || `${pos.part_name}-${pos.subtype}`}
            pos={pos}
            isSub={isSub}
            status={status}
            isLocked={isLocked}
            showTOV={hasTOV}
            onCalculate={onCalculate}
            onFieldChange={onFieldChange}
            onSpeedChange={onSpeedChange}
            onToggleTOV={onToggleTOV}
          />
        );
      })}
    </>
  );
}

/* ── POSITION ROW (15 columns) ───────────────────────────────── */

function PositionRow({
  pos, isSub, status, isLocked, showTOV,
  onCalculate, onFieldChange, onSpeedChange, onToggleTOV,
}: {
  pos: Position;
  isSub: boolean;
  status: string;
  isLocked: boolean;
  showTOV: boolean;
  onCalculate: (pos: Position) => void;
  onFieldChange: (pos: Position, field: keyof Position, value: number) => void;
  onSpeedChange: (pos: Position, speed: number) => void;
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
  const speed = calcSpeed(pos);

  // Override detection: if position value differs from project default → override
  const wageOverridden = pos.wage_czk_ph !== PROJECT_DEFAULTS.wage;
  const shiftOverridden = pos.shift_hours !== PROJECT_DEFAULTS.shift;

  return (
    <>
      <tr className={rowClass} data-position-instance-id={pos.position_instance_id}>
        {/* 1. Element name */}
        <td style={{ cursor: 'pointer' }} onClick={() => pos.id && onToggleTOV(pos.id)}
          title={pos.item_name || pos.part_name}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {pos.id && (showTOV ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
            {pos.item_name || SUBTYPE_LABELS[pos.subtype] || pos.subtype}
          </span>
        </td>

        {/* 2. Type badge */}
        <td>
          <span className={`flat-badge ${subtypeBadgeClass(pos.subtype)}`}>
            {SUBTYPE_LABELS[pos.subtype] || pos.subtype}
          </span>
        </td>

        {/* 3. MJ (unit) */}
        <td className="flat-col--right flat-mono">{unitLabel}</td>

        {/* 4. Množství */}
        <td className="flat-col--right">
          <span className="flat-mono">{fmt(pos.qty, 1)}</span>
        </td>

        {/* 5. Počet lidí */}
        <td className="flat-col--right flat-col--hide-mobile">
          <EditableCell value={pos.crew_size} disabled={isLocked}
            onChange={v => onFieldChange(pos, 'crew_size', v)} />
        </td>

        {/* 6. Kč/h — orange if overridden */}
        <td className="flat-col--right flat-col--hide-mobile">
          <span className="flat-tooltip" style={{ display: 'block' }}>
            <EditableCell value={pos.wage_czk_ph} disabled={isLocked}
              onChange={v => onFieldChange(pos, 'wage_czk_ph', v)}
              overridden={wageOverridden} />
            {wageOverridden && (
              <span className="flat-tooltip__content">
                Přepsáno: {fmt(pos.wage_czk_ph)} Kč/h (projekt: {PROJECT_DEFAULTS.wage} Kč/h)
              </span>
            )}
          </span>
        </td>

        {/* 7. Hod/den — orange if overridden */}
        <td className="flat-col--right flat-col--hide-mobile">
          <span className="flat-tooltip" style={{ display: 'block' }}>
            <EditableCell value={pos.shift_hours} disabled={isLocked}
              onChange={v => onFieldChange(pos, 'shift_hours', v)}
              overridden={shiftOverridden} />
            {shiftOverridden && (
              <span className="flat-tooltip__content">
                Přepsáno: {fmt(pos.shift_hours)} h (projekt: {PROJECT_DEFAULTS.shift} h)
              </span>
            )}
          </span>
        </td>

        {/* 8. Dny */}
        <td className="flat-col--right">
          <EditableCell value={pos.days} disabled={isLocked}
            onChange={v => onFieldChange(pos, 'days', v)} />
        </td>

        {/* 9. MJ/h (speed) — bidirectional: edit speed → recalc days */}
        <td className="flat-col--right flat-col--hide-mobile">
          <span className="flat-tooltip" style={{ display: 'block' }}>
            <EditableCell value={speed ? Math.round(speed * 100) / 100 : 0}
              disabled={isLocked}
              onChange={v => onSpeedChange(pos, v)} />
            {speed ? (
              <span className="flat-tooltip__content">
                {fmt(pos.qty, 1)} {unitLabel} / {fmt(pos.labor_hours)} hod = {fmt(speed, 2)} {unitLabel}/h
              </span>
            ) : null}
          </span>
        </td>

        {/* 10. Celk.hod (total hours) */}
        <td className="flat-col--right flat-col--hide-mobile">
          <span className="flat-mono flat-tooltip">
            {fmt(pos.labor_hours, 0)}
            {pos.labor_hours ? (
              <span className="flat-tooltip__content">
                {pos.crew_size} lidí × {pos.shift_hours}h × {pos.days}d = {fmt(pos.labor_hours)} Nhod
              </span>
            ) : null}
          </span>
        </td>

        {/* 11. Celk.Kč (total cost native) */}
        <td className="flat-col--right flat-col--hide-mobile">
          <span className="flat-mono flat-tooltip">
            {fmt(pos.cost_czk)}
            {pos.cost_czk ? (
              <span className="flat-tooltip__content">
                {fmt(pos.labor_hours)} Nhod × {fmt(pos.wage_czk_ph)} Kč/h = {fmt(pos.cost_czk)} Kč
              </span>
            ) : null}
          </span>
        </td>

        {/* 12. Kč/m³ (unit cost on m3) */}
        <td className="flat-col--right flat-col--hide-mobile">
          <span className="flat-mono flat-tooltip">
            {pos.unit_cost_on_m3 ? fmt(pos.unit_cost_on_m3) : ''}
            {pos.unit_cost_on_m3 && pos.concrete_m3 ? (
              <span className="flat-tooltip__content">
                {fmt(pos.cost_czk)} Kč / {fmt(pos.concrete_m3, 1)} m³ = {fmt(pos.unit_cost_on_m3)} Kč/m³
              </span>
            ) : null}
          </span>
        </td>

        {/* 13. Jedn. cena (rounded to 50 CZK) */}
        <td className="flat-col--right">
          <span className="flat-mono flat-tooltip">
            {pos.kros_unit_czk ? fmt(pos.kros_unit_czk) : ''}
            {pos.kros_unit_czk ? (
              <span className="flat-tooltip__content">
                CEILING({fmt(pos.unit_cost_on_m3)} / 50) × 50 = {fmt(pos.kros_unit_czk)} Kč
              </span>
            ) : null}
          </span>
        </td>

        {/* 14. Celkem (kros total) */}
        <td className="flat-col--right">
          <span className="flat-mono flat-tooltip">
            {pos.kros_total_czk ? fmt(pos.kros_total_czk) : ''}
            {pos.kros_total_czk && pos.concrete_m3 ? (
              <span className="flat-tooltip__content">
                {fmt(pos.kros_unit_czk)} Kč × {fmt(pos.concrete_m3, 1)} m³ = {fmt(pos.kros_total_czk)} Kč
              </span>
            ) : null}
          </span>
        </td>

        {/* 15. RFI */}
        <td className="flat-col--center flat-col--hide-mobile">
          {pos.has_rfi ? (
            <span className="flat-tooltip">
              <AlertCircle size={14} style={{ color: 'var(--orange-500)' }} />
              {pos.rfi_message ? (
                <span className="flat-tooltip__content">{pos.rfi_message}</span>
              ) : null}
            </span>
          ) : null}
        </td>

        {/* 16. Akce */}
        <td className="flat-col--center">
          {isLocked ? (
            <Lock size={14} style={{ color: 'var(--stone-400)' }} />
          ) : pos.subtype === 'beton' ? (
            <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <button className="flat-icon-btn flat-icon-btn--accent"
                onClick={() => onCalculate(pos)} title="Vypočítat v kalkulátoru">
                <Calculator size={14} />
              </button>
            </div>
          ) : null}
        </td>
      </tr>

      {showTOV && pos.id && (
        <FlatTOVSection positionId={pos.id} position={pos} />
      )}
    </>
  );
}

/* ── EDITABLE CELL ───────────────────────────────────────────── */

function EditableCell({
  value, disabled, onChange, overridden,
}: {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
  overridden?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  if (!editing) {
    return (
      <span
        className={`flat-mono ${overridden ? 'flat-inline-input--overridden' : ''}`}
        onDoubleClick={() => {
          if (disabled) return;
          setEditing(true);
          setText(String(value || ''));
        }}
        style={{
          cursor: disabled ? 'default' : 'pointer',
          display: 'block',
          textAlign: 'right',
          color: overridden ? 'var(--orange-500)' : undefined,
        }}
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
        if (e.key === 'Escape') setEditing(false);
      }}
      autoFocus
      style={{ textAlign: 'right' }}
    />
  );
}
