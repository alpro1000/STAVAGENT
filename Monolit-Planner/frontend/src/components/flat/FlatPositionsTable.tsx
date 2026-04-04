/**
 * FlatPositionsTable — Element-grouped positions table.
 *
 * Structure per element (part_name group):
 *   Layer 1: INFO row — name, OTSKP, Katalog, Výpočet, Objem, Celkem dní, Vypočítat
 *   Layer 2: Column headers (stone-50, 28px, muted)
 *   Layer 3: Work rows (white, 32px) — editable cells with validation
 *   Layer 4: "+ Přidat práci" button row
 *
 * calculatePositionFields applied client-side for instant calculated columns.
 * All editable cells: click → input → Enter/blur → validated PUT → optimistic update.
 * Negative values rejected with shake animation.
 */

import { useMemo, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator, AlertTriangle, Lock, Plus, Zap,
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
import FlatTOVSection from './FlatTOVSection';
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

/** Round to nearest 0.5 */
function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

/** Validation rules per field */
function validateField(field: string, value: number): string | null {
  if (isNaN(value)) return 'Neplatné číslo';
  if (value < 0) return 'Záporná hodnota';
  if (field === 'crew_size' && value < 1) return 'Min. 1 osoba';
  if (field === 'shift_hours' && value < 0.5) return 'Min. 0,5 h';
  return null;
}

interface ElementGroup {
  partName: string;
  positions: Position[];
}

const PROJECT_DEFAULTS = { wage: 398, shift: 10 };
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
  const [expandedTOV, setExpandedTOV] = useState<Set<string>>(new Set());
  const [addWorkFor, setAddWorkFor] = useState<string | null>(null);

  const toggleTOV = useCallback((posId: string) => {
    setExpandedTOV(prev => {
      const next = new Set(prev);
      if (next.has(posId)) next.delete(posId); else next.add(posId);
      return next;
    });
  }, []);

  // Client-side calculated positions
  const calcPositions = useMemo(() => {
    if (!positions.length) return positions;
    return positions.map(p => calculatePositionFields(p, positions));
  }, [positions]);

  // Group by part_name, sorted by construction sequence.
  // "Podkladní beton" and shared positions → "Ostatní" at the bottom.
  const elements = useMemo((): ElementGroup[] => {
    if (!calcPositions.length) return [];
    const partNames = [...new Set(calcPositions.map(p => p.part_name))];

    // Separate podkladní/shared from normal parts
    const isPodkladni = (name: string) => /podklad/i.test(name);
    const normalParts = partNames.filter(n => !isPodkladni(n));
    const ostatniParts = partNames.filter(n => isPodkladni(n));

    const sorted = sortPartsBySequence(normalParts);
    const allOrdered = [...sorted, ...ostatniParts];

    return allOrdered.map(partName => ({
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
    if (vystuzPos?.id) params.set('vyzuz_position_id', vystuzPos.id);
    navigate(`/planner?${params.toString()}`);
  }, [navigate]);

  // Single-field update with validation
  const handleFieldChange = useCallback(async (
    pos: Position, field: keyof Position, value: number
  ): Promise<boolean> => {
    if (isLocked || !pos.id) return false;
    const err = validateField(field as string, value);
    if (err) return false;
    await updatePositions([{ id: pos.id, [field]: value }]);
    return true;
  }, [isLocked, updatePositions]);

  // Bidirectional MJ/h: single PUT with days recalculated
  const handleSpeedChange = useCallback(async (pos: Position, speed: number): Promise<boolean> => {
    if (isLocked || !pos.id || !pos.qty || speed <= 0) return false;
    const laborHours = pos.qty / speed;
    const days = roundHalf(laborHours / ((pos.crew_size || 4) * (pos.shift_hours || 10)));
    await updatePositions([{ id: pos.id, days: Math.max(days, 0.5) }]);
    return true;
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
                  expandedTOV={expandedTOV}
                  onToggle={() => toggleElement(el.partName)}
                  onCalculate={() => handleCalculate(el)}
                  onFieldChange={handleFieldChange}
                  onSpeedChange={handleSpeedChange}
                  onOtskpSelect={handleOtskpSelect}
                  onAddWork={() => setAddWorkFor(el.partName)}
                  onToggleTOV={toggleTOV}
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
  element, isLocked, collapsed, expandedTOV,
  onToggle, onCalculate, onFieldChange, onSpeedChange, onOtskpSelect, onAddWork, onToggleTOV,
}: {
  element: ElementGroup;
  isLocked: boolean;
  collapsed: boolean;
  expandedTOV: Set<string>;
  onToggle: () => void;
  onCalculate: () => void;
  onFieldChange: (pos: Position, field: keyof Position, value: number) => Promise<boolean>;
  onSpeedChange: (pos: Position, speed: number) => Promise<boolean>;
  onOtskpSelect: (posId: string, code: string, name: string, unitPrice?: number) => void;
  onAddWork: () => void;
  onToggleTOV: (posId: string) => void;
}) {
  const betonPos = element.positions.find(p => p.subtype === 'beton');
  const partM3 = element.positions
    .filter(p => p.subtype === 'beton')
    .reduce((s, p) => s + (p.concrete_m3 || p.qty || 0), 0);
  const maxDays = Math.max(...element.positions.map(p => p.days || 0), 0);
  const totalKros = element.positions.reduce((s, p) => s + (p.kros_total_czk || 0), 0);
  const calcPricePerM3 = partM3 > 0 ? totalKros / partM3 : 0;
  const hasDays = maxDays > 0;

  return (
    <>
      {/* Layer 1: INFO row */}
      <tr className="flat-el-info" id={`part-${element.partName}`}>
        <td colSpan={COL_COUNT}>
          <div className="flat-el-info__inner">
            {/* Toggle */}
            <button className="flat-el-info__toggle" onClick={onToggle}>
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Name (flex) */}
            <span className="flat-el-info__name" title={betonPos?.item_name || element.partName}>
              {betonPos?.item_name || element.partName}
            </span>

            {/* OTSKP input */}
            {betonPos?.id && !isLocked && (
              <span className="flat-el-info__otskp">
                <OtskpAutocomplete
                  value={betonPos.otskp_code || ''}
                  onSelect={(code, name, price, _unit) => onOtskpSelect(betonPos.id!, code, name, price)}
                  disabled={isLocked}
                />
              </span>
            )}

            {/* Separator */}
            <span className="flat-el-info__sep" />

            {/* Katalog Kč/m³ */}
            <span className="flat-el-info__metric">
              <span className="flat-el-info__metric-label">Katalog</span>
              <span className="flat-el-info__metric-value flat-mono" style={{ color: 'var(--stone-400)' }}>
                —
              </span>
            </span>

            {/* Výpočet Kč/m³ */}
            <span className="flat-el-info__metric">
              <span className="flat-el-info__metric-label">Výpočet</span>
              <span
                className="flat-el-info__metric-value flat-mono"
                style={{ color: calcPricePerM3 > 0 ? 'var(--green-500)' : 'var(--stone-400)' }}
              >
                {calcPricePerM3 > 0 ? fmt(calcPricePerM3) + ' Kč/m³' : '—'}
              </span>
            </span>

            {/* Objem m³ */}
            <span className="flat-el-info__metric">
              <span className="flat-el-info__metric-label">Objem</span>
              <span className="flat-el-info__metric-value flat-mono">
                {partM3 ? fmt(partM3, 1) + ' m³' : '—'}
              </span>
            </span>

            {/* Celkem dní (display only) */}
            <span className="flat-el-info__metric">
              <span className="flat-el-info__metric-label">Celkem dní</span>
              <span
                className="flat-el-info__metric-value flat-mono"
                style={{
                  color: hasDays ? 'var(--flat-text)' : 'var(--stone-400)',
                  fontWeight: hasDays ? 600 : 400,
                }}
              >
                {hasDays ? fmt(maxDays) : '—'}
              </span>
            </span>

            {/* Vypočítat / Upřesnit button */}
            {!isLocked && betonPos && (
              <button
                className={`flat-btn flat-btn--sm ${hasDays ? '' : 'flat-btn--primary'}`}
                onClick={onCalculate}
              >
                <Zap size={13} />
                {hasDays ? 'Upřesnit' : 'Vypočítat'}
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
            <th style={{ width: 140 }}>Typ práce</th>
            <th style={{ width: 50 }} className="flat-col--right">MJ</th>
            <th style={{ width: 75 }} className="flat-col--right">Množství</th>
            <th style={{ width: 50 }} className="flat-col--right flat-col--hide-mobile">Lidé</th>
            <th style={{ width: 65 }} className="flat-col--right flat-col--hide-mobile">Kč/h</th>
            <th style={{ width: 60 }} className="flat-col--right flat-col--hide-mobile">Hod/den</th>
            <th style={{ width: 55 }} className="flat-col--right">Dny</th>
            <th style={{ width: 55 }} className="flat-col--right flat-col--hide-mobile">MJ/h</th>
            <th style={{ width: 70 }} className="flat-col--right flat-col--hide-mobile">Celk.hod</th>
            <th style={{ width: 80 }} className="flat-col--right flat-col--hide-mobile">Celk.Kč</th>
            <th style={{ width: 70 }} className="flat-col--right flat-col--hide-mobile">Kč/m³</th>
            <th style={{ width: 75 }} className="flat-col--right">Jedn. cena</th>
            <th style={{ width: 85 }} className="flat-col--right">Celkem</th>
            <th style={{ width: 35 }} className="flat-col--center">ⓘ</th>
          </tr>

          {/* Layer 3: Work rows + TOV */}
          {element.positions.map(pos => (
            <WorkRow
              key={pos.id || `${pos.part_name}-${pos.subtype}`}
              pos={pos}
              isLocked={isLocked}
              showTOV={!!pos.id && expandedTOV.has(pos.id)}
              onFieldChange={onFieldChange}
              onSpeedChange={onSpeedChange}
              onToggleTOV={onToggleTOV}
            />
          ))}

          {/* Layer 4: Add work */}
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
  pos, isLocked, showTOV, onFieldChange, onSpeedChange, onToggleTOV,
}: {
  pos: Position;
  isLocked: boolean;
  showTOV: boolean;
  onFieldChange: (pos: Position, field: keyof Position, value: number) => Promise<boolean>;
  onSpeedChange: (pos: Position, speed: number) => Promise<boolean>;
  onToggleTOV: (posId: string) => void;
}) {
  const unitLabel = UNIT_LABELS[pos.unit] || pos.unit || '';
  const speed = calcSpeed(pos);
  const wageOverridden = pos.wage_czk_ph !== PROJECT_DEFAULTS.wage;
  const shiftOverridden = pos.shift_hours !== PROJECT_DEFAULTS.shift;

  return (
    <>
    <tr
      className={`flat-work-row ${pos.has_rfi ? 'flat-row--rfi' : ''}`}
      data-position-instance-id={pos.position_instance_id}
    >
      {/* Typ práce (badge) — click to expand TOV */}
      <td className="flat-work-row__type"
        style={{ cursor: 'pointer' }}
        onClick={() => pos.id && onToggleTOV(pos.id)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {pos.id && (showTOV
            ? <ChevronDown size={11} style={{ color: 'var(--flat-text-secondary)', flexShrink: 0 }} />
            : <ChevronRight size={11} style={{ color: 'var(--flat-text-secondary)', flexShrink: 0 }} />)}
          <span className={`flat-badge ${subtypeBadgeClass(pos.subtype)}`}>
            {SUBTYPE_LABELS[pos.subtype] || pos.subtype}
          </span>
        </span>
      </td>

      {/* MJ */}
      <td className="flat-col--right flat-mono">{unitLabel}</td>

      {/* Množství — editable, min 0 */}
      <td className="flat-col--right">
        <EditableNum value={pos.qty} field="qty" disabled={isLocked} decimals={1}
          onChange={v => onFieldChange(pos, 'qty', v)} />
      </td>

      {/* Lidé — editable, min 1 */}
      <td className="flat-col--right flat-col--hide-mobile">
        <EditableNum value={pos.crew_size} field="crew_size" disabled={isLocked}
          onChange={v => onFieldChange(pos, 'crew_size', v)} />
      </td>

      {/* Kč/h — editable, min 0, override detection */}
      <td className="flat-col--right flat-col--hide-mobile">
        <EditableNum value={pos.wage_czk_ph} field="wage_czk_ph" disabled={isLocked}
          onChange={v => onFieldChange(pos, 'wage_czk_ph', v)}
          overridden={wageOverridden}
          overrideTooltip={`Přepsáno pro tuto pozici (projekt: ${PROJECT_DEFAULTS.wage})`} />
      </td>

      {/* Hod/den — editable, min 0.5, override detection */}
      <td className="flat-col--right flat-col--hide-mobile">
        <EditableNum value={pos.shift_hours} field="shift_hours" disabled={isLocked}
          onChange={v => onFieldChange(pos, 'shift_hours', v)}
          overridden={shiftOverridden}
          overrideTooltip={`Přepsáno pro tuto pozici (projekt: ${PROJECT_DEFAULTS.shift})`} />
      </td>

      {/* Dny — editable, min 0, step 0.5 */}
      <td className="flat-col--right">
        <EditableNum value={pos.days} field="days" disabled={isLocked} step={0.5}
          onChange={v => onFieldChange(pos, 'days', v)} />
      </td>

      {/* MJ/h — editable, bidirectional */}
      <td className="flat-col--right flat-col--hide-mobile">
        <EditableNum
          value={speed ? Math.round(speed * 100) / 100 : 0}
          field="speed"
          disabled={isLocked}
          decimals={2}
          onChange={v => onSpeedChange(pos, v)}
          tooltip={speed
            ? `${fmt(pos.qty, 1)} ${unitLabel} / ${fmt(pos.labor_hours)} hod = ${fmt(speed, 2)} ${unitLabel}/h`
            : undefined}
        />
      </td>

      {/* Celk.hod — calculated, not editable */}
      <td className="flat-col--right flat-col--hide-mobile flat-cell--calc">
        <span className="flat-mono flat-tooltip">
          {fmt(pos.labor_hours)}
          {pos.labor_hours ? (
            <span className="flat-tooltip__content">
              {pos.crew_size} × {pos.shift_hours}h × {pos.days}d = {fmt(pos.labor_hours)} Nhod
            </span>
          ) : null}
        </span>
      </td>

      {/* Celk.Kč — calculated */}
      <td className="flat-col--right flat-col--hide-mobile flat-cell--calc">
        <span className="flat-mono flat-tooltip">
          {fmt(pos.cost_czk)}
          {pos.cost_czk ? (
            <span className="flat-tooltip__content">
              {fmt(pos.labor_hours)} × {fmt(pos.wage_czk_ph)} Kč/h = {fmt(pos.cost_czk)} Kč
            </span>
          ) : null}
        </span>
      </td>

      {/* Kč/m³ — calculated */}
      <td className="flat-col--right flat-col--hide-mobile flat-cell--calc">
        <span className="flat-mono flat-tooltip">
          {pos.unit_cost_on_m3 ? fmt(pos.unit_cost_on_m3) : ''}
          {pos.unit_cost_on_m3 && pos.concrete_m3 ? (
            <span className="flat-tooltip__content">
              {fmt(pos.cost_czk)} / {fmt(pos.concrete_m3, 1)} m³ = {fmt(pos.unit_cost_on_m3)} Kč/m³
            </span>
          ) : null}
        </span>
      </td>

      {/* Jedn. cena — calculated */}
      <td className="flat-col--right flat-cell--calc">
        <span className="flat-mono flat-tooltip">
          {pos.kros_unit_czk ? fmt(pos.kros_unit_czk) : ''}
          {pos.kros_unit_czk ? (
            <span className="flat-tooltip__content">
              ⌈{fmt(pos.unit_cost_on_m3)}/50⌉×50 = {fmt(pos.kros_unit_czk)} Kč
            </span>
          ) : null}
        </span>
      </td>

      {/* Celkem — calculated */}
      <td className="flat-col--right flat-cell--calc">
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

    {/* TOV expandable section */}
    {showTOV && pos.id && (
      <FlatTOVSection positionId={pos.id} position={pos} />
    )}
    </>
  );
}

/* ── EDITABLE NUMERIC CELL ───────────────────────────────────── */

function EditableNum({
  value, field, disabled, onChange, decimals = 0, step,
  overridden, overrideTooltip, tooltip,
}: {
  value: number;
  field: string;
  disabled: boolean;
  onChange: (v: number) => Promise<boolean>;
  decimals?: number;
  step?: number;
  overridden?: boolean;
  overrideTooltip?: string;
  tooltip?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [shaking, setShaking] = useState(false);
  const cellRef = useRef<HTMLSpanElement>(null);

  const reject = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 400);
  };

  const commit = async () => {
    setEditing(false);
    const n = parseFloat(text);
    const err = validateField(field, n);
    if (err) {
      reject();
      return;
    }
    if (n === value) return; // no change
    const ok = await onChange(n);
    if (!ok) reject();
  };

  if (!editing) {
    return (
      <span
        ref={cellRef}
        className={`flat-ecell ${shaking ? 'flat-ecell--shake' : ''} ${overridden ? 'flat-ecell--override' : ''}`}
        onClick={() => {
          if (disabled) return;
          setEditing(true);
          setText(String(value || ''));
        }}
        title={overridden ? overrideTooltip : tooltip}
      >
        {value ? fmt(value, decimals) : ''}
      </span>
    );
  }

  return (
    <input
      className={`flat-ecell-input ${shaking ? 'flat-ecell--shake' : ''}`}
      type="number"
      min={field === 'crew_size' ? 1 : field === 'shift_hours' ? 0.5 : 0}
      step={step || (decimals > 0 ? Math.pow(10, -decimals) : 1)}
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setEditing(false);
      }}
      autoFocus
    />
  );
}
