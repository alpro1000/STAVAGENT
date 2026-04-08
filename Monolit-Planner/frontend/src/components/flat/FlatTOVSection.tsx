/**
 * FlatTOVSection — Expandable TOV (Tabulka Objemu Výkonů) under a position row.
 *
 * Shows work items grouped by Práce/Materiál/Stroje with formulas.
 * Rendered as table rows inside the positions table.
 *
 * Supports two data sources:
 *   1. tov_entries in metadata (from calculator Aplikovat) — multiple professions
 *   2. Position's own fields (crew_size, days, wage) — legacy single profession
 */

import type { Position } from '@stavagent/monolit-shared';
import { SUBTYPE_LABELS } from '@stavagent/monolit-shared';
import type { TOVEntries } from '@stavagent/monolit-shared';

interface Props {
  positionId: string;
  position: Position;
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

export default function FlatTOVSection({ position: pos }: Props) {
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
        <RichTOV tov={tovEntries} pos={pos} meta={meta} />
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
function RichTOV({ tov, meta }: { tov: TOVEntries; pos: Position; meta: Record<string, any> | null }) {
  const rows: { type: 'group' | 'item' | 'detail' | 'total'; label: string; hours?: string; cost?: string }[] = [];

  // Labor section
  if (tov.labor.length > 0) {
    rows.push({ type: 'group', label: 'Lidské zdroje' });
    let totalLaborH = 0;
    let totalLaborCZK = 0;

    for (const entry of tov.labor) {
      rows.push({
        type: 'item',
        label: `${entry.profession}${entry.note ? ` (${entry.note})` : ''}`,
        hours: fmt(entry.normHours, 1),
        cost: fmt(entry.totalCost),
      });
      rows.push({
        type: 'detail',
        label: `${entry.count} lid${entry.count === 1 ? '' : entry.count < 5 ? 'é' : 'í'} × ${fmt(entry.hours, 1)}h × ${entry.hourlyRate} Kč/h`,
      });
      totalLaborH += entry.normHours;
      totalLaborCZK += entry.totalCost;
    }

    rows.push({
      type: 'total',
      label: 'Celkem práce',
      hours: fmt(totalLaborH, 1),
      cost: fmt(totalLaborCZK),
    });
  }

  // Materials/Rental section
  if (tov.materials.length > 0) {
    rows.push({ type: 'group', label: 'Materiály / Pronájem' });
    let totalMatCZK = 0;

    for (const entry of tov.materials) {
      const rentalInfo = entry.rentalMonths
        ? ` × ${entry.rentalMonths} měs.`
        : '';
      rows.push({
        type: 'item',
        label: `${entry.name}${entry.note ? ` (${entry.note})` : ''}`,
        hours: `${fmt(entry.quantity, 1)} ${entry.unit}`,
        cost: fmt(entry.totalCost),
      });
      if (entry.unitPrice > 0) {
        rows.push({
          type: 'detail',
          label: `${fmt(entry.quantity, 1)} ${entry.unit} × ${fmt(entry.unitPrice)} Kč/${entry.unit}${rentalInfo}`,
        });
      }
      totalMatCZK += entry.totalCost;
    }

    rows.push({
      type: 'total',
      label: 'Celkem materiály',
      cost: fmt(totalMatCZK),
    });
  }

  // Pump from metadata (legacy compat)
  if (meta?.pump_cost_czk) {
    rows.push({ type: 'group', label: 'Stroje' });
    rows.push({ type: 'item', label: 'Čerpadlo betonu', cost: fmt(meta.pump_cost_czk) });
  }

  // Grand total
  const totalLabor = tov.labor.reduce((s, e) => s + e.totalCost, 0);
  const totalMat = tov.materials.reduce((s, e) => s + e.totalCost, 0);
  const totalPump = meta?.pump_cost_czk || 0;
  rows.push({
    type: 'total',
    label: 'CELKEM',
    hours: fmt(tov.labor.reduce((s, e) => s + e.normHours, 0), 1),
    cost: fmt(totalLabor + totalMat + totalPump),
  });

  return <>{rows.map((row, i) => <TOVRow key={i} row={row} />)}</>;
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
