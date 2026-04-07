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

import { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calculator, AlertTriangle, Lock, Plus, Zap, Trash2,
  ChevronDown, ChevronRight, AlertCircle, ArrowRightLeft, Upload,
} from 'lucide-react';
import type { Position, Subtype } from '@stavagent/monolit-shared';
import {
  SUBTYPE_LABELS, UNIT_LABELS,
  sortPartsBySequence,
  calculatePositionFields,
} from '@stavagent/monolit-shared';
import { useUI } from '../../context/UIContext';
import { useProjectPositions } from '../../hooks/useProjectPositions';
import { otskpAPI } from '../../services/api';
import InlineOtskpSearch from './InlineOtskpSearch';
import FlatKPIPanel from './FlatKPIPanel';
import FlatProjectSettings from './FlatProjectSettings';
import FlatToolbar from './FlatToolbar';
import FlatGantt from './FlatGantt';
import FlatSnapshots from './FlatSnapshots';
import FlatTOVSection from './FlatTOVSection';
import AddWorkModal from './AddWorkModal';

/* ── Helpers ─────────────────────────────────────────────────── */

const SUBTYPE_ORDER: Record<string, number> = {
  beton: 0, 'bednění': 1, 'výztuž': 2, 'zrání': 3, 'odbednění': 4, 'jiné': 5,
};

function subtypeBadgeClass(subtype: Subtype): string {
  const map: Record<string, string> = {
    beton: 'flat-badge--beton',
    'bednění': 'flat-badge--bedneni',
    'odbednění': 'flat-badge--odbedneni',
    'výztuž': 'flat-badge--vystuz',
    'zrání': 'flat-badge--zrani',
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
    updatePositions, deletePosition,
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
  // Special: bednění qty auto-syncs to odbednění (same formwork area)
  const handleFieldChange = useCallback(async (
    pos: Position, field: keyof Position, value: number
  ): Promise<boolean> => {
    if (isLocked || !pos.id) return false;
    const err = validateField(field as string, value);
    if (err) return false;

    const updates: { id: string; [k: string]: any }[] = [{ id: pos.id, [field]: value }];

    // Sync bednění qty → odbednění qty (same formwork area)
    if (field === 'qty' && (pos.subtype === 'bednění' || pos.subtype === 'odbednění')) {
      const siblingSubtype = pos.subtype === 'bednění' ? 'odbednění' : 'bednění';
      const sibling = positions.find(
        p => p.part_name === pos.part_name && p.bridge_id === pos.bridge_id && p.subtype === siblingSubtype && p.id
      );
      if (sibling?.id) {
        updates.push({ id: sibling.id, qty: value });
      }
    }

    await updatePositions(updates);
    return true;
  }, [isLocked, updatePositions, positions]);

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

  // Delete all positions of an element
  const handleDeleteElement = useCallback(async (element: ElementGroup) => {
    if (isLocked) return;
    const name = element.positions[0]?.item_name || element.partName;
    if (!confirm(`Odstranit element "${name}" a všechny jeho práce? Tato akce je nevratná.`)) return;
    for (const pos of element.positions) {
      if (pos.id) await deletePosition(pos.id);
    }
  }, [isLocked, deletePosition]);

  const toggleElement = useCallback((partName: string) => {
    setCollapsedElements(prev => {
      const next = new Set(prev);
      if (next.has(partName)) next.delete(partName); else next.add(partName);
      return next;
    });
  }, []);

  // Always render toolbar so action buttons are accessible
  if (!selectedProjectId) {
    return (
      <div>
        <FlatToolbar positionCount={0} />
        <EmptyStateNoProject />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div>
        <FlatToolbar positionCount={0} />
        <div className="flat-loading"><div className="flat-spinner" /> Načítání pozic...</div>
      </div>
    );
  }

  return (
    <div>
      <FlatProjectSettings />
      <FlatKPIPanel kpi={headerKPI} positions={calcPositions} />
      <FlatToolbar positionCount={positions.length} />

      {positions.length === 0 ? (
        <EmptyStateNoPositions />
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
                  onDelete={() => handleDeleteElement(el)}
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
  onToggle, onCalculate, onFieldChange, onSpeedChange, onOtskpSelect, onAddWork, onToggleTOV, onDelete,
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
  onDelete: () => void;
  onToggleTOV: (posId: string) => void;
}) {
  const [katalogPrice, setKatalogPrice] = useState<number | null>(null);

  const betonPos = element.positions.find(p => p.subtype === 'beton');

  // Fetch catalog price on mount if OTSKP code already set
  useEffect(() => {
    if (!betonPos?.otskp_code || katalogPrice !== null) return;
    otskpAPI.getByCode(betonPos.otskp_code)
      .then(data => { if (data?.unit_price) setKatalogPrice(data.unit_price); })
      .catch(() => {}); // Ignore if code not found
  }, [betonPos?.otskp_code]); // eslint-disable-line react-hooks/exhaustive-deps

  const partM3 = element.positions
    .filter(p => p.subtype === 'beton')
    .reduce((s, p) => s + (p.concrete_m3 || p.qty || 0), 0);

  // Celkem dní: if calculator metadata exists → use it, otherwise SUM (sequential)
  const betonMeta = betonPos?.metadata
    ? (() => { try { return JSON.parse(typeof betonPos.metadata === 'string' ? betonPos.metadata : '{}'); } catch { return null; } })()
    : null;
  const totalDays = betonMeta?.schedule_info?.total_days
    || element.positions.reduce((s, p) => s + (p.days || 0), 0);

  const totalKros = element.positions.reduce((s, p) => s + (p.kros_total_czk || 0), 0);
  const calcPricePerM3 = partM3 > 0 ? totalKros / partM3 : 0;
  const hasDays = totalDays > 0;

  const handleOtskp = (code: string, name: string, unitPrice?: number) => {
    if (betonPos?.id) {
      onOtskpSelect(betonPos.id, code, name, unitPrice);
      if (unitPrice) setKatalogPrice(unitPrice);
    }
  };

  // Výpočet color: green if cheaper than katalog, red if more expensive
  const vypocetColor = calcPricePerM3 > 0
    ? (katalogPrice && calcPricePerM3 > katalogPrice ? 'var(--red-500)' : 'var(--green-500)')
    : 'var(--stone-400)';

  return (
    <>
      {/* Layer 1: INFO row */}
      <tr className="flat-el-info" id={`part-${element.partName}`}>
        <td colSpan={COL_COUNT}>
          <div className="flat-el-info__inner">
            {/* ▼ Toggle — 24px */}
            <button className="flat-el-info__toggle" onClick={onToggle} style={{ width: 24, flexShrink: 0 }}>
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* Name — flex:1, takes remaining space */}
            <span className="flat-el-info__name" title={betonPos?.item_name || element.partName}>
              {betonPos?.item_name || element.partName}
            </span>

            {/* OTSKP input — 82px fixed */}
            {betonPos?.id && !isLocked ? (
              <InlineOtskpSearch
                value={betonPos.otskp_code || ''}
                onSelect={handleOtskp}
                disabled={isLocked}
              />
            ) : (
              <span style={{ width: 82, flexShrink: 0 }} />
            )}

            {/* | separator */}
            <span className="flat-el-info__sep" />

            {/* Katalog — 90px */}
            <span className="flat-el-info__metric" style={{ width: 90 }}>
              <span className="flat-el-info__metric-label">Katalog</span>
              <span className="flat-el-info__metric-value flat-mono" style={{
                color: katalogPrice ? 'var(--green-500)' : 'var(--stone-400)',
              }}>
                {katalogPrice ? fmt(katalogPrice) : '—'}
                {katalogPrice ? <span style={{ fontSize: 9, color: 'var(--stone-400)', marginLeft: 2 }}>Kč/m³</span> : null}
              </span>
            </span>

            {/* | */}
            <span className="flat-el-info__sep" />

            {/* Výpočet — 90px */}
            <span className="flat-el-info__metric" style={{ width: 90 }}>
              <span className="flat-el-info__metric-label">Výpočet</span>
              <span className="flat-el-info__metric-value flat-mono" style={{ color: vypocetColor }}>
                {calcPricePerM3 > 0 ? fmt(calcPricePerM3) : '—'}
                {calcPricePerM3 > 0 ? <span style={{ fontSize: 9, color: 'var(--stone-400)', marginLeft: 2 }}>Kč/m³</span> : null}
              </span>
            </span>

            {/* | */}
            <span className="flat-el-info__sep" />

            {/* Objem — 60px */}
            <span className="flat-el-info__metric" style={{ width: 60 }}>
              <span className="flat-el-info__metric-label">Objem</span>
              <span className="flat-el-info__metric-value flat-mono">
                {partM3 ? fmt(partM3, 1) : '—'}
                {partM3 ? <span style={{ fontSize: 9, color: 'var(--stone-400)', marginLeft: 2 }}>m³</span> : null}
              </span>
            </span>

            {/* | */}
            <span className="flat-el-info__sep" />

            {/* Celkem dní — 52px */}
            <span className="flat-el-info__metric" style={{ width: 52 }}>
              <span className="flat-el-info__metric-label">Celkem</span>
              <span className="flat-el-info__metric-value flat-mono" style={{
                color: hasDays ? 'var(--flat-text)' : 'var(--stone-400)',
                fontWeight: hasDays ? 600 : 400,
              }}>
                {hasDays ? fmt(totalDays) : '—'}
                {hasDays ? <span style={{ fontSize: 9, color: 'var(--stone-400)', marginLeft: 2 }}>dní</span> : null}
              </span>
            </span>

            {/* Vypočítat / Upřesnit + Delete */}
            {!isLocked && betonPos && (
              <>
                <button
                  className={`flat-btn flat-btn--sm ${hasDays ? '' : 'flat-btn--primary'}`}
                  onClick={onCalculate}
                  style={{ flexShrink: 0 }}
                >
                  <Zap size={13} />
                  {hasDays ? 'Upřesnit' : 'Vypočítat'}
                </button>
                <button
                  className="sb__icon-btn sb__icon-btn--danger"
                  onClick={onDelete}
                  title="Odstranit element"
                  style={{ flexShrink: 0, opacity: 0.4 }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>

      {/* Layers 2-4: only when expanded */}
      {!collapsed && (
        <>
          {/* Layer 2: Column headers */}
          <tr className="flat-el-colheader">
            <th style={{ width: 100 }}>Typ práce</th>
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
  const isZrani = pos.subtype === 'zrání';

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

      {/* Množství — editable (not for zrání) */}
      <td className="flat-col--right">
        {!isZrani && <EditableNum value={pos.qty} field="qty" disabled={isLocked} decimals={1}
          onChange={v => onFieldChange(pos, 'qty', v)} />}
      </td>

      {/* Lidé (not for zrání) */}
      <td className="flat-col--right flat-col--hide-mobile">
        {!isZrani && <EditableNum value={pos.crew_size} field="crew_size" disabled={isLocked}
          onChange={v => onFieldChange(pos, 'crew_size', v)} />}
      </td>

      {/* Kč/h (not for zrání) */}
      <td className="flat-col--right flat-col--hide-mobile">
        {!isZrani && <EditableNum value={pos.wage_czk_ph} field="wage_czk_ph" disabled={isLocked}
          onChange={v => onFieldChange(pos, 'wage_czk_ph', v)}
          overridden={wageOverridden}
          overrideTooltip={`Přepsáno pro tuto pozici (projekt: ${PROJECT_DEFAULTS.wage})`} />}
      </td>

      {/* Hod/den (not for zrání) */}
      <td className="flat-col--right flat-col--hide-mobile">
        {!isZrani && <EditableNum value={pos.shift_hours} field="shift_hours" disabled={isLocked}
          onChange={v => onFieldChange(pos, 'shift_hours', v)}
          overridden={shiftOverridden}
          overrideTooltip={`Přepsáno pro tuto pozici (projekt: ${PROJECT_DEFAULTS.shift})`} />}
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

/* ── EMPTY STATES ────────────────────────────────────────────── */

function EmptyStateNoProject() {
  return (
    <div className="flat-empty" style={{ padding: '80px 24px' }}>
      <Calculator size={48} className="flat-empty__icon" />
      <div className="flat-empty__title" style={{ fontSize: 18 }}>Zatím nemáte žádný projekt</div>
      <div className="flat-empty__text" style={{ marginBottom: 20 }}>
        Začněte jedním z těchto kroků:
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <EmptyAction icon={<Plus size={16} />} label="Vytvořit objekt" desc="Ručně zadat nový objekt" id="create" />
        <EmptyAction icon={<ArrowRightLeft size={16} />} label="Načíst z Rozpočtu" desc="Importovat z Registry" id="registry" />
        <EmptyAction icon={<Upload size={16} />} label="Nahrát Excel" desc="Nahrát soubor se smetou" id="upload" />
      </div>
    </div>
  );
}

function EmptyStateNoPositions() {
  return (
    <div className="flat-empty" style={{ padding: '48px 24px' }}>
      <AlertTriangle size={32} className="flat-empty__icon" />
      <div className="flat-empty__title">Objekt je prázdný</div>
      <div className="flat-empty__text" style={{ marginBottom: 16 }}>
        Přidejte pozice jedním z těchto způsobů:
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <EmptyAction icon={<ArrowRightLeft size={16} />} label="Načíst z Rozpočtu" desc="Importovat z Registry" id="registry" />
        <EmptyAction icon={<Upload size={16} />} label="Nahrát Excel" desc="Nahrát soubor se smetou" id="upload" />
      </div>
    </div>
  );
}

/** Action card for empty states — triggers toolbar actions via DOM click */
function EmptyAction({ icon, label, desc, id }: { icon: React.ReactNode; label: string; desc: string; id: string }) {
  const handleClick = () => {
    // Find and click the corresponding toolbar button
    if (id === 'create') {
      // Click sidebar "+ Nový objekt" button
      const btn = document.querySelector('.sb__new-btn') as HTMLButtonElement;
      if (btn) btn.click();
    } else if (id === 'registry') {
      // Find the "Načíst z Rozpočtu" button in toolbar
      const btns = document.querySelectorAll('.flat-toolbar .flat-btn');
      for (const b of btns) { if (b.textContent?.includes('Rozpočtu')) (b as HTMLButtonElement).click(); }
    } else if (id === 'upload') {
      const btns = document.querySelectorAll('.flat-toolbar .flat-btn');
      for (const b of btns) { if (b.textContent?.includes('Excel')) (b as HTMLButtonElement).click(); }
    }
  };

  return (
    <button onClick={handleClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '16px 24px', background: 'white', border: '1px solid var(--stone-200)',
      borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s',
      minWidth: 160,
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--orange-500)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(249,115,22,0.1)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--stone-200)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <span style={{ color: 'var(--orange-500)' }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--flat-text)' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--stone-400)' }}>{desc}</span>
    </button>
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
