/**
 * FlatPositionsTable — Element-grouped positions table.
 *
 * Structure per element (part_name group):
 *   Layer 1: INFO row (stone-100) — name, m³, OTSKP, prices, days, Vypočítat
 *   Layer 2: Column headers (stone-50, 28px, muted)
 *   Layer 3: Work rows (white, 32px) — one per position, no element name repeat
 *   Layer 4: "+ Přidat práci" button row
 *
 * Uses calculatePositionFields from shared for client-side display of calculated columns.
 */

import { useMemo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator, AlertTriangle, Lock, Plus,
  ChevronDown, ChevronRight, AlertCircle,
} from 'lucide-react';
import type { Position, Subtype } from '@stavagent/monolit-shared';
import {
  SUBTYPE_LABELS, UNIT_LABELS,
  sortPartsBySequence,
  calculatePositionFields,
} from '@stavagent/monolit-shared';
import { useUI } from '../../context/UIContext';
import { useProjectPositions } from '../../hooks/useProjectPositions';
import OtskpAutocomplete from '../OtskpAutocomplete';
import FlatKPIPanel from './FlatKPIPanel';
import FlatProjectSettings from './FlatProjectSettings';
import FlatToolbar from './FlatToolbar';
import FlatGantt from './FlatGantt';
import FlatSnapshots from './FlatSnapshots';
import AddWorkModal from './AddWorkModal';

/* ── Helpers ─────────────────────────────────────────────────── */

const SUBTYPE_ORDER: Record<string, number> = {
  beton: 0, 'bednění': 1, 'odbednění': 2, 'výztuž': 3, 'jiné': 4,
};

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

function fmt(n: number | null | undefined, d = 0): string {
  if (n == null || isNaN(n)) return '';
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function calcSpeed(pos: Position): number | null {
  if (!pos.labor_hours || !pos.qty) return null;
  return pos.qty / pos.labor_hours;
}

interface ElementGroup {
  partName: string;
  positions: Position[];
}

const PROJECT_DEFAULTS = { wage: 398, shift: 10 };

/* Column count for colSpan */
const COL_COUNT = 14;

/* ── MAIN COMPONENT ──────────────────────────────────────────── */

export default function FlatPositionsTable() {
  const { selectedProjectId, activeSnapshot } = useUI();
  const {
    positions, headerKPI, isLoading,
    updatePositions,
  } = useProjectPositions();
  const navigate = useNavigate();
  const isLocked = activeSnapshot?.is_locked ?? false;

  const [collapsedElements, setCollapsedElements] = useState<Set<string>>(new Set());
  const [addWorkFor, setAddWorkFor] = useState<string | null>(null);

  // Client-side calculated positions (apply shared formulas for display)
  const calcPositions = useMemo(() => {
    if (!positions.length) return positions;
    return positions.map(p => calculatePositionFields(p, positions));
  }, [positions]);

  // Group by part_name, sorted by construction sequence
  const elements = useMemo((): ElementGroup[] => {
    if (!calcPositions.length) return [];
    const partNames = [...new Set(calcPositions.map(p => p.part_name))];
    const sorted = sortPartsBySequence(partNames);
    return sorted.map(partName => ({
      partName,
      positions: calcPositions
        .filter(p => p.part_name === partName)
        .sort((a, b) => (SUBTYPE_ORDER[a.subtype] ?? 5) - (SUBTYPE_ORDER[b.subtype] ?? 5)),
    }));
  }, [calcPositions]);

  // Navigate to calculator
  const handleCalculate = useCallback((element: ElementGroup) => {
    const betonPos = element.positions.find(p => p.subtype === 'beton');
    if (!betonPos) return;
    sessionStorage.setItem('monolit-planner-return-part', element.partName);
    sessionStorage.setItem('monolit-planner-scroll-y', String(window.scrollY));
    const bedneniPos = element.positions.find(p => p.subtype === 'bednění');
    const vystuzPos = element.positions.find(p => p.subtype === 'výztuž');
    const params = new URLSearchParams();
    params.set('bridge_id', betonPos.bridge_id);
    if (betonPos.id) params.set('position_id', betonPos.id);
    params.set('part_name', element.partName);
    params.set('subtype', 'beton');
    if (betonPos.concrete_m3) params.set('volume_m3', String(betonPos.concrete_m3));
    if (betonPos.qty) params.set('qty', String(betonPos.qty));
    if (bedneniPos?.id) params.set('bedneni_position_id', bedneniPos.id);
    if (vystuzPos?.id) params.set('vystuz_position_id', vystuzPos.id);
    navigate(`/planner?${params.toString()}`);
  }, [navigate]);

  const handleFieldChange = useCallback(async (
    pos: Position, field: keyof Position, value: number
  ) => {
    if (isLocked || !pos.id) return;
    await updatePositions([{ id: pos.id, [field]: value }]);
  }, [isLocked, updatePositions]);

  const handleSpeedChange = useCallback(async (pos: Position, speed: number) => {
    if (isLocked || !pos.id || !speed || !pos.qty) return;
    const laborHours = pos.qty / speed;
    const days = Math.ceil(laborHours / ((pos.crew_size || 4) * (pos.shift_hours || 10)));
    await updatePositions([{ id: pos.id, days }]);
  }, [isLocked, updatePositions]);

  const handleOtskpSelect = useCallback(async (
    posId: string, code: string, _name: string, _unitPrice?: number
  ) => {
    if (isLocked) return;
    await updatePositions([{ id: posId, otskp_code: code }]);
  }, [isLocked, updatePositions]);

  const toggleElement = useCallback((partName: string) => {
    setCollapsedElements(prev => {
      const next = new Set(prev);
      if (next.has(partName)) next.delete(partName); else next.add(partName);
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
      <FlatKPIPanel kpi={headerKPI} positions={calcPositions} />
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
            <tbody>
              {elements.map(el => (
                <ElementBlock
                  key={el.partName}
                  element={el}
                  isLocked={isLocked}
                  collapsed={collapsedElements.has(el.partName)}
                  onToggle={() => toggleElement(el.partName)}
                  onCalculate={() => handleCalculate(el)}
                  onFieldChange={handleFieldChange}
                  onSpeedChange={handleSpeedChange}
                  onOtskpSelect={handleOtskpSelect}
                  onAddWork={() => setAddWorkFor(el.partName)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {positions.length > 0 && <FlatGantt positions={calcPositions} />}
      <FlatSnapshots />

      {addWorkFor && (
        <AddWorkModal
          partName={addWorkFor}
          existingSubtypes={
            elements.find(e => e.partName === addWorkFor)
              ?.positions.map(p => p.subtype) ?? []
          }
          onClose={() => setAddWorkFor(null)}
        />
      )}
    </div>
  );
}

/* ── ELEMENT BLOCK ───────────────────────────────────────────── */

function ElementBlock({
  element, isLocked, collapsed,
  onToggle, onCalculate, onFieldChange, onSpeedChange, onOtskpSelect, onAddWork,
}: {
  element: ElementGroup;
  isLocked: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onCalculate: () => void;
  onFieldChange: (pos: Position, field: keyof Position, value: number) => void;
  onSpeedChange: (pos: Position, speed: number) => void;
  onOtskpSelect: (posId: string, code: string, name: string, unitPrice?: number) => void;
  onAddWork: () => void;
}) {
  const betonPos = element.positions.find(p => p.subtype === 'beton');
  const partM3 = element.positions
    .filter(p => p.subtype === 'beton')
    .reduce((s, p) => s + (p.concrete_m3 || p.qty || 0), 0);
  const maxDays = Math.max(...element.positions.map(p => p.days || 0), 0);
  const calcPrice = betonPos?.kros_unit_czk || 0;

  return (
    <>
      {/* Layer 1: INFO row */}
      <tr className="flat-el-info" id={`part-${element.partName}`}>
        <td colSpan={COL_COUNT}>
          <div className="flat-el-info__inner">
            {/* Collapse toggle */}
            <button className="flat-el-info__toggle" onClick={onToggle}>
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Element name */}
            <span className="flat-el-info__name" title={betonPos?.item_name || element.partName}>
              {betonPos?.item_name || element.partName}
            </span>

            {/* Volume */}
            <span className="flat-el-info__vol flat-mono">
              {partM3 ? fmt(partM3, 1) + ' m³' : ''}
            </span>

            {/* OTSKP autocomplete */}
            {betonPos?.id && !isLocked && (
              <span className="flat-el-info__otskp">
                <OtskpAutocomplete
                  value={betonPos.otskp_code || ''}
                  onSelect={(code, name, price, _unit) => onOtskpSelect(betonPos.id!, code, name, price)}
                  disabled={isLocked}
                />
              </span>
            )}

            {/* Prices */}
            <span className="flat-el-info__price">
              Výpočet: <strong className="flat-mono">{calcPrice ? fmt(calcPrice) + ' Kč/m³' : '—'}</strong>
            </span>

            {/* Days */}
            <span className="flat-el-info__days flat-mono">
              {maxDays ? fmt(maxDays) + ' dní' : '0 dní'}
            </span>

            {/* Vypočítat button */}
            {!isLocked && betonPos && (
              <button className="flat-btn flat-btn--primary flat-btn--sm" onClick={onCalculate}>
                <Calculator size={13} /> Vypočítat
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Layers 2-4: only when expanded */}
      {!collapsed && (
        <>
          {/* Layer 2: Column headers */}
          <tr className="flat-el-colheader">
            <th>Typ práce</th>
            <th className="flat-col--right">MJ</th>
            <th className="flat-col--right">Množství</th>
            <th className="flat-col--right flat-col--hide-mobile">Lidé</th>
            <th className="flat-col--right flat-col--hide-mobile">Kč/h</th>
            <th className="flat-col--right flat-col--hide-mobile">Hod/den</th>
            <th className="flat-col--right">Dny</th>
            <th className="flat-col--right flat-col--hide-mobile">MJ/h</th>
            <th className="flat-col--right flat-col--hide-mobile">Celk.hod</th>
            <th className="flat-col--right flat-col--hide-mobile">Celk.Kč</th>
            <th className="flat-col--right flat-col--hide-mobile">Kč/m³</th>
            <th className="flat-col--right">Jedn. cena</th>
            <th className="flat-col--right">Celkem</th>
            <th className="flat-col--center">ⓘ</th>
          </tr>

          {/* Layer 3: Work rows */}
          {element.positions.map(pos => (
            <WorkRow
              key={pos.id || `${pos.part_name}-${pos.subtype}`}
              pos={pos}
              isLocked={isLocked}
              onFieldChange={onFieldChange}
              onSpeedChange={onSpeedChange}
            />
          ))}

          {/* Layer 4: Add work button */}
          {!isLocked && (
            <tr className="flat-el-add">
              <td colSpan={COL_COUNT}>
                <button className="flat-el-add__btn" onClick={onAddWork}>
                  <Plus size={13} /> Přidat práci
                </button>
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}

/* ── WORK ROW ────────────────────────────────────────────────── */

function WorkRow({
  pos, isLocked, onFieldChange, onSpeedChange,
}: {
  pos: Position;
  isLocked: boolean;
  onFieldChange: (pos: Position, field: keyof Position, value: number) => void;
  onSpeedChange: (pos: Position, speed: number) => void;
}) {
  const unitLabel = UNIT_LABELS[pos.unit] || pos.unit || '';
  const speed = calcSpeed(pos);
  const wageOverridden = pos.wage_czk_ph !== PROJECT_DEFAULTS.wage;
  const shiftOverridden = pos.shift_hours !== PROJECT_DEFAULTS.shift;

  return (
    <tr
      className={`flat-work-row ${pos.has_rfi ? 'flat-row--rfi' : ''}`}
      data-position-instance-id={pos.position_instance_id}
    >
      {/* Typ práce */}
      <td>
        <span className={`flat-badge ${subtypeBadgeClass(pos.subtype)}`}>
          {SUBTYPE_LABELS[pos.subtype] || pos.subtype}
        </span>
      </td>

      {/* MJ */}
      <td className="flat-col--right flat-mono">{unitLabel}</td>

      {/* Množství */}
      <td className="flat-col--right">
        <EditableCell value={pos.qty} disabled={isLocked}
          onChange={v => onFieldChange(pos, 'qty', v)} decimals={1} />
      </td>

      {/* Lidé */}
      <td className="flat-col--right flat-col--hide-mobile">
        <EditableCell value={pos.crew_size} disabled={isLocked}
          onChange={v => onFieldChange(pos, 'crew_size', v)} />
      </td>

      {/* Kč/h */}
      <td className="flat-col--right flat-col--hide-mobile">
        <span className="flat-tooltip" style={{ display: 'block' }}>
          <EditableCell value={pos.wage_czk_ph} disabled={isLocked}
            onChange={v => onFieldChange(pos, 'wage_czk_ph', v)}
            overridden={wageOverridden} />
          {wageOverridden && (
            <span className="flat-tooltip__content">
              Přepsáno: {fmt(pos.wage_czk_ph)} Kč/h (projekt: {PROJECT_DEFAULTS.wage})
            </span>
          )}
        </span>
      </td>

      {/* Hod/den */}
      <td className="flat-col--right flat-col--hide-mobile">
        <span className="flat-tooltip" style={{ display: 'block' }}>
          <EditableCell value={pos.shift_hours} disabled={isLocked}
            onChange={v => onFieldChange(pos, 'shift_hours', v)}
            overridden={shiftOverridden} />
          {shiftOverridden && (
            <span className="flat-tooltip__content">
              Přepsáno: {fmt(pos.shift_hours)} h (projekt: {PROJECT_DEFAULTS.shift})
            </span>
          )}
        </span>
      </td>

      {/* Dny */}
      <td className="flat-col--right">
        <EditableCell value={pos.days} disabled={isLocked}
          onChange={v => onFieldChange(pos, 'days', v)} />
      </td>

      {/* MJ/h — bidirectional */}
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

      {/* Celk.hod */}
      <td className="flat-col--right flat-col--hide-mobile">
        <span className="flat-mono flat-tooltip">
          {fmt(pos.labor_hours)}
          {pos.labor_hours ? (
            <span className="flat-tooltip__content">
              {pos.crew_size} × {pos.shift_hours}h × {pos.days}d = {fmt(pos.labor_hours)} Nhod
            </span>
          ) : null}
        </span>
      </td>

      {/* Celk.Kč */}
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

      {/* Kč/m³ */}
      <td className="flat-col--right flat-col--hide-mobile">
        <span className="flat-mono flat-tooltip">
          {pos.unit_cost_on_m3 ? fmt(pos.unit_cost_on_m3) : ''}
          {pos.unit_cost_on_m3 && pos.concrete_m3 ? (
            <span className="flat-tooltip__content">
              {fmt(pos.cost_czk)} / {fmt(pos.concrete_m3, 1)} m³ = {fmt(pos.unit_cost_on_m3)} Kč/m³
            </span>
          ) : null}
        </span>
      </td>

      {/* Jedn. cena */}
      <td className="flat-col--right">
        <span className="flat-mono flat-tooltip">
          {pos.kros_unit_czk ? fmt(pos.kros_unit_czk) : ''}
          {pos.kros_unit_czk ? (
            <span className="flat-tooltip__content">
              ⌈{fmt(pos.unit_cost_on_m3)}/50⌉×50 = {fmt(pos.kros_unit_czk)} Kč
            </span>
          ) : null}
        </span>
      </td>

      {/* Celkem */}
      <td className="flat-col--right">
        <span className="flat-mono flat-tooltip">
          {pos.kros_total_czk ? fmt(pos.kros_total_czk) : ''}
          {pos.kros_total_czk && pos.concrete_m3 ? (
            <span className="flat-tooltip__content">
              {fmt(pos.kros_unit_czk)} × {fmt(pos.concrete_m3, 1)} m³ = {fmt(pos.kros_total_czk)} Kč
            </span>
          ) : null}
        </span>
      </td>

      {/* ⓘ (RFI / status) */}
      <td className="flat-col--center">
        {pos.has_rfi ? (
          <span className="flat-tooltip">
            <AlertCircle size={14} style={{ color: 'var(--orange-500)' }} />
            {pos.rfi_message ? (
              <span className="flat-tooltip__content">{pos.rfi_message}</span>
            ) : null}
          </span>
        ) : pos.kros_total_czk ? (
          <span style={{ color: 'var(--green-500)', fontSize: 11, fontWeight: 600 }}>OK</span>
        ) : null}
      </td>
    </tr>
  );
}

/* ── EDITABLE CELL ───────────────────────────────────────────── */

function EditableCell({
  value, disabled, onChange, overridden, decimals = 0,
}: {
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
  overridden?: boolean;
  decimals?: number;
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
        style={{
          cursor: disabled ? 'default' : 'pointer',
          display: 'block',
          textAlign: 'right',
          color: overridden ? 'var(--orange-500)' : undefined,
        }}
      >
        {value ? fmt(value, decimals) : ''}
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
