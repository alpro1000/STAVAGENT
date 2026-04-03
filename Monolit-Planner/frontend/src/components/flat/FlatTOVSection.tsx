/**
 * FlatTOVSection — Expandable TOV (Tabulka Objemu Výkonů) under a position row.
 *
 * Shows work items grouped by Práce/Materiál/Stroje with formulas.
 * Rendered as table rows inside the positions table.
 */

import type { Position } from '@stavagent/monolit-shared';
import { SUBTYPE_LABELS } from '@stavagent/monolit-shared';

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

  // If no calculated data, show minimal info
  if (!pos.labor_hours && !pos.cost_czk) {
    return (
      <tr className="flat-tov">
        <td colSpan={13} style={{ padding: '8px 16px', fontStyle: 'italic', color: 'var(--stone-400)' }}>
          Zatím nespočítáno — klikněte na Vypočítat.
        </td>
      </tr>
    );
  }

  const rows: { type: 'group' | 'item' | 'detail' | 'total'; label: string; hours?: string; cost?: string; formula?: string }[] = [];

  // Group: Práce
  rows.push({ type: 'group', label: 'Práce' });

  // Main work item
  rows.push({
    type: 'item',
    label: SUBTYPE_LABELS[pos.subtype] || pos.subtype,
    hours: fmt(pos.labor_hours),
    cost: fmt(pos.cost_czk),
  });

  // Formula detail
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

  // Pump cost from metadata
  if (meta?.pump_cost_czk) {
    rows.push({ type: 'group', label: 'Stroje' });
    rows.push({
      type: 'item',
      label: 'Čerpadlo betonu',
      cost: fmt(meta.pump_cost_czk),
    });
  }

  // Total
  const totalCost = (pos.cost_czk || 0) + (meta?.pump_cost_czk || 0);
  rows.push({
    type: 'total',
    label: 'Celkem',
    hours: fmt(pos.labor_hours),
    cost: fmt(totalCost),
  });

  return (
    <>
      {rows.map((row, i) => {
        const cls = `flat-tov ${
          row.type === 'group' ? 'flat-tov--group' :
          row.type === 'detail' ? 'flat-tov--detail' :
          row.type === 'total' ? 'flat-tov--total' : ''
        }`;

        return (
          <tr key={i} className={cls}>
            <td colSpan={7} style={row.type === 'detail' ? { paddingLeft: 32 } : undefined}>
              {row.label}
            </td>
            <td></td>
            <td className="flat-col--right flat-mono">{row.hours || ''}</td>
            <td className="flat-col--right flat-mono">{row.cost || ''}</td>
            <td colSpan={3}></td>
          </tr>
        );
      })}
    </>
  );
}
