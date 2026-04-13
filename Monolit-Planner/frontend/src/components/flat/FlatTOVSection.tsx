/**
 * FlatTOVSection — Expandable TOV (Tabulka Objemu Výkonů) under a position row.
 *
 * Shows work items grouped by Práce/Materiál/Stroje with formulas.
 * Rendered as table rows inside the positions table.
 *
 * Supports two data sources:
 *   1. tov_entries in metadata (from calculator Aplikovat) — multiple professions
 *   2. Position's own fields (crew_size, days, wage) — legacy single profession
 *
 * Quick-fix #2: each calculator-added labor row has a [×] delete button.
 * Click → confirm → onDeleteLaborEntry(entryId). Parent recomputes totals.
 */

import { Fragment } from 'react';
import { X } from 'lucide-react';
import type { Position } from '@stavagent/monolit-shared';
import { SUBTYPE_LABELS } from '@stavagent/monolit-shared';
import type { TOVEntries, TOVLaborEntry } from '@stavagent/monolit-shared';

interface Props {
  positionId: string;
  position: Position;
  /**
   * Called when the user confirms deletion of a calculator-added labor entry.
   * Only labor rows from `tov_entries` (source='calculator') are deletable —
   * legacy / import rows have no [×] button.
   */
  onDeleteLaborEntry?: (entry: TOVLaborEntry) => void | Promise<void>;
}

/** Parse metadata JSON safely */
function parseMetadata(pos: Position): Record<string, any> | null {
  if (!pos.metadata) return null;
  try {
    return typeof pos.metadata === 'string' ? JSON.parse(pos.metadata) : pos.metadata;
  } catch { return null; }
}

function fmt(n: number | null | undefined, d = 0): string {
  if (n == null || isNaN(n)) return '';
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export default function FlatTOVSection({ position: pos, onDeleteLaborEntry }: Props) {
  const meta = parseMetadata(pos);
  const tovEntries: TOVEntries | null = meta?.tov_entries ?? null;

  // If no calculated data at all, show placeholder
  if (!pos.labor_hours && !pos.cost_czk && !tovEntries) {
    return (
      <tr className="flat-tov">
        <td colSpan={14} style={{ padding: '8px 16px', fontStyle: 'italic', color: 'var(--stone-400)' }}>
          Zatím nespočítáno — klikněte na Vypočítat.
        </td>
      </tr>
    );
  }

  // If tov_entries exist (from calculator), render rich multi-profession TOV
  if (tovEntries && (tovEntries.labor.length > 0 || tovEntries.materials.length > 0)) {
    return (
      <>
        <RichTOV tov={tovEntries} pos={pos} meta={meta} onDeleteLaborEntry={onDeleteLaborEntry} />
        <LinkedPositionsBadges meta={meta} />
      </>
    );
  }

  // Legacy: single-profession from position fields
  return (
    <>
      <LegacyTOV pos={pos} meta={meta} />
      <LinkedPositionsBadges meta={meta} />
    </>
  );
}

/** Rich TOV with multiple professions — from calculator Aplikovat */
function RichTOV({
  tov, meta, onDeleteLaborEntry,
}: {
  tov: TOVEntries;
  pos: Position;
  meta: Record<string, any> | null;
  onDeleteLaborEntry?: (entry: TOVLaborEntry) => void | Promise<void>;
}) {
  // Calculator-added entries are deletable. Legacy/import entries don't have
  // a TOVEntries blob at all (they go through LegacyTOV), so we can simply
  // gate on source==='calculator'.
  const isCalculatorSource = tov.source === 'calculator';
  const deletable = isCalculatorSource && !!onDeleteLaborEntry;

  const totalLaborH = tov.labor.reduce((s, e) => s + e.normHours, 0);
  const totalLaborCZK = tov.labor.reduce((s, e) => s + e.totalCost, 0);
  const totalMatCZK = tov.materials.reduce((s, e) => s + e.totalCost, 0);
  const totalPump = meta?.pump_cost_czk || 0;

  const handleDelete = (entry: TOVLaborEntry) => {
    if (!onDeleteLaborEntry) return;
    const label = `${entry.profession}${entry.note ? ` (${entry.note})` : ''}`;
    if (!confirm(`Smazat práci "${label}"?\n\nTato akce odstraní řádek z TOV a přepočítá souhrn pozice (celkem hodin a Kč).`)) return;
    void onDeleteLaborEntry(entry);
  };

  return (
    <>
      {tov.labor.length > 0 && (
        <>
          <TOVRow row={{ type: 'group', label: 'Lidské zdroje' }} />
          {tov.labor.map((entry, i) => (
            <LaborEntryRows
              key={entry.id || i}
              entry={entry}
              deletable={deletable}
              onDelete={() => handleDelete(entry)}
            />
          ))}
          <TOVRow row={{
            type: 'total',
            label: 'Celkem práce',
            hours: fmt(totalLaborH, 1),
            cost: fmt(totalLaborCZK),
          }} />
        </>
      )}

      {tov.materials.length > 0 && (
        <>
          <TOVRow row={{ type: 'group', label: 'Materiály / Pronájem' }} />
          {tov.materials.map((entry, i) => {
            const rentalInfo = entry.rentalMonths ? ` × ${entry.rentalMonths} měs.` : '';
            return (
              <Fragment key={entry.id || i}>
                <TOVRow row={{
                  type: 'item',
                  label: `${entry.name}${entry.note ? ` (${entry.note})` : ''}`,
                  hours: `${fmt(entry.quantity, 1)} ${entry.unit}`,
                  cost: fmt(entry.totalCost),
                }} />
                {entry.unitPrice > 0 && (
                  <TOVRow row={{
                    type: 'detail',
                    label: `${fmt(entry.quantity, 1)} ${entry.unit} × ${fmt(entry.unitPrice)} Kč/${entry.unit}${rentalInfo}`,
                  }} />
                )}
              </Fragment>
            );
          })}
          <TOVRow row={{ type: 'total', label: 'Celkem materiály', cost: fmt(totalMatCZK) }} />
        </>
      )}

      {meta?.pump_cost_czk ? (
        <>
          <TOVRow row={{ type: 'group', label: 'Stroje' }} />
          <TOVRow row={{ type: 'item', label: 'Čerpadlo betonu', cost: fmt(meta.pump_cost_czk) }} />
        </>
      ) : null}

      <TOVRow row={{
        type: 'total',
        label: 'CELKEM',
        hours: fmt(totalLaborH, 1),
        cost: fmt(totalLaborCZK + totalMatCZK + totalPump),
      }} />
    </>
  );
}

/** A labor entry rendered as item + detail rows, optionally with [×] delete */
function LaborEntryRows({
  entry, deletable, onDelete,
}: {
  entry: TOVLaborEntry;
  deletable: boolean;
  onDelete: () => void;
}) {
  const label = `${entry.profession}${entry.note ? ` (${entry.note})` : ''}`;
  return (
    <>
      <tr className="flat-tov">
        <td colSpan={8}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {label}
            {deletable && (
              <button
                type="button"
                onClick={onDelete}
                title={`Smazat práci "${label}"`}
                style={{
                  marginLeft: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  padding: 0,
                  border: '1px solid var(--stone-300, #d6d3d1)',
                  borderRadius: 4,
                  background: 'transparent',
                  color: 'var(--stone-400, #a8a29e)',
                  cursor: 'pointer',
                  lineHeight: 0,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#dc2626';
                  e.currentTarget.style.borderColor = '#fecaca';
                  e.currentTarget.style.background = '#fef2f2';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--stone-400, #a8a29e)';
                  e.currentTarget.style.borderColor = 'var(--stone-300, #d6d3d1)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <X size={11} />
              </button>
            )}
          </span>
        </td>
        <td className="flat-col--right flat-mono">{fmt(entry.normHours, 1)}</td>
        <td className="flat-col--right flat-mono">{fmt(entry.totalCost)}</td>
        <td colSpan={4}></td>
      </tr>
      <tr className="flat-tov flat-tov--detail">
        <td colSpan={8} style={{ paddingLeft: 32 }}>
          {`${entry.count} lid${entry.count === 1 ? '' : entry.count < 5 ? 'é' : 'í'} × ${fmt(entry.hours, 1)}h × ${entry.hourlyRate} Kč/h`}
        </td>
        <td className="flat-col--right flat-mono"></td>
        <td className="flat-col--right flat-mono"></td>
        <td colSpan={4}></td>
      </tr>
    </>
  );
}

/** Legacy single-profession TOV from position fields */
function LegacyTOV({ pos, meta }: { pos: Position; meta: Record<string, any> | null }) {
  const rows: { type: 'group' | 'item' | 'detail' | 'total'; label: string; hours?: string; cost?: string }[] = [];

  rows.push({ type: 'group', label: 'Práce' });
  rows.push({
    type: 'item',
    label: SUBTYPE_LABELS[pos.subtype] || pos.subtype,
    hours: fmt(pos.labor_hours),
    cost: fmt(pos.cost_czk),
  });

  if (pos.crew_size && pos.shift_hours && pos.days) {
    rows.push({
      type: 'detail',
      label: `${pos.crew_size} lidí × ${pos.shift_hours}h × ${pos.days}d = ${fmt(pos.labor_hours)} Nhod`,
    });
  }
  if (pos.labor_hours && pos.wage_czk_ph) {
    rows.push({
      type: 'detail',
      label: `${fmt(pos.labor_hours)} Nhod × ${fmt(pos.wage_czk_ph)} Kč/h = ${fmt(pos.cost_czk)} Kč`,
    });
  }

  if (meta?.pump_cost_czk) {
    rows.push({ type: 'group', label: 'Stroje' });
    rows.push({ type: 'item', label: 'Čerpadlo betonu', cost: fmt(meta.pump_cost_czk) });
  }

  const totalCost = (pos.cost_czk || 0) + (meta?.pump_cost_czk || 0);
  rows.push({ type: 'total', label: 'Celkem', hours: fmt(pos.labor_hours), cost: fmt(totalCost) });

  return <>{rows.map((row, i) => <TOVRow key={i} row={row} />)}</>;
}

/** Shared row renderer */
function TOVRow({ row }: { row: { type: string; label: string; hours?: string; cost?: string } }) {
  const cls = `flat-tov ${
    row.type === 'group' ? 'flat-tov--group' :
    row.type === 'detail' ? 'flat-tov--detail' :
    row.type === 'total' ? 'flat-tov--total' : ''
  }`;
  return (
    <tr className={cls}>
      <td colSpan={8} style={row.type === 'detail' ? { paddingLeft: 32 } : undefined}>
        {row.label}
      </td>
      <td className="flat-col--right flat-mono">{row.hours || ''}</td>
      <td className="flat-col--right flat-mono">{row.cost || ''}</td>
      <td colSpan={4}></td>
    </tr>
  );
}

/** Show linked positions from import (výztuž, bednění found by OTSKP prefix) */
function LinkedPositionsBadges({ meta }: { meta: Record<string, any> | null }) {
  const linked: Array<{ code: string; name: string; mj: string; mnozstvi: number; typ: string }> =
    meta?.linked_positions || [];
  if (linked.length === 0) return null;

  return (
    <tr className="flat-tov flat-tov--detail">
      <td colSpan={14} style={{ padding: '4px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {linked.map((lp, i) => (
            <span key={i} title={lp.name} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 4, fontSize: 10,
              background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af',
              cursor: 'default', whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize: 11 }}>&#128206;</span>
              {lp.code && <strong>{lp.code}</strong>}
              {lp.typ}
              {lp.mnozstvi > 0 && ` (${lp.mnozstvi.toLocaleString('cs')} ${lp.mj})`}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}
