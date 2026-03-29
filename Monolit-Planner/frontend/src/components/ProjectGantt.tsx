/**
 * ProjectGantt — Project-level Gantt chart
 *
 * Shows all positions with planner data on a single timeline.
 * Groups by part_name, each position = one bar, axis = working days.
 * Supports drag-and-drop reordering + typical bridge/building sequence.
 *
 * Data source: positions from the active bridge via API.
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { usePositions } from '../hooks/usePositions';
import type { Position } from '@stavagent/monolit-shared';
import PortalBreadcrumb from './PortalBreadcrumb';
import '../styles/r0.css';

// Typical construction sequence for bridges
const BRIDGE_SEQUENCE = [
  'PILOTY', 'ZÁKLADY', 'ZÁKLADY PILÍŘŮ', 'DŘÍKY PILÍŘŮ', 'PILÍŘE',
  'OPĚRY', 'ÚLOŽNÉ PRAHY', 'OPĚRNÉ ZDI', 'MOSTOVKA', 'MOSTOVKOVÁ DESKA',
  'PŘÍČNÍKY', 'ZÁVĚRNÉ ZÍDKY', 'ŘÍMSY', 'IZOLACE', 'ZÁBRADLÍ',
];

// Typical construction sequence for buildings
const BUILDING_SEQUENCE = [
  'ZEMNÍ PRÁCE', 'PILOTY', 'ZÁKLADY', 'ZÁKLADOVÁ DESKA', 'ZÁKLADOVÝ PAS',
  'SUTERÉN', 'STĚNY', 'SLOUPY', 'PRŮVLAKY', 'STROPNÍ DESKA', 'SCHODIŠTĚ',
  'STŘECHA', 'IZOLACE', 'FASÁDA',
];

interface GanttRow {
  id: string;
  part_name: string;
  subtype: string;
  label: string;
  days: number;
  start_day: number; // computed offset
  color: string;
  position: Position;
  metadata?: Record<string, unknown>;
}

const SUBTYPE_COLORS: Record<string, string> = {
  beton: '#3b82f6',     // blue
  bednění: '#f59e0b',   // orange
  výztuž: '#8b5cf6',    // purple
  jiné: '#6b7280',      // gray
};

function getSubtypeColor(subtype: string): string {
  return SUBTYPE_COLORS[subtype] || SUBTYPE_COLORS.jiné;
}

function sequenceIndex(partName: string, sequence: string[]): number {
  const upper = partName.toUpperCase().trim();
  for (let i = 0; i < sequence.length; i++) {
    if (upper.includes(sequence[i]) || sequence[i].includes(upper)) return i;
  }
  return 999;
}

export default function ProjectGantt() {
  const [searchParams] = useSearchParams();
  const bridgeIdParam = searchParams.get('bridge_id') || searchParams.get('project');
  const { selectedBridge, bridges } = useAppContext();
  const activeBridgeId = bridgeIdParam || selectedBridge;
  const { data: positionsData } = usePositions(activeBridgeId);

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [customOrder, setCustomOrder] = useState<string[] | null>(null);

  const bridgeInfo = bridges.find(b => b.bridge_id === activeBridgeId);

  // Build rows from positions
  const rows: GanttRow[] = useMemo(() => {
    if (!positionsData?.positions) return [];

    const positions: Position[] = positionsData.positions.filter(
      (p: Position) => p.days > 0
    );

    if (positions.length === 0) return [];

    // Group by part_name and sequence
    const grouped = new Map<string, Position[]>();
    for (const p of positions) {
      const key = p.part_name || 'Ostatní';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(p);
    }

    // Sort parts by construction sequence (detect bridge vs building)
    const partNames = [...grouped.keys()];
    const bridgeScore = partNames.reduce((s, n) => s + (sequenceIndex(n, BRIDGE_SEQUENCE) < 999 ? 1 : 0), 0);
    const buildingScore = partNames.reduce((s, n) => s + (sequenceIndex(n, BUILDING_SEQUENCE) < 999 ? 1 : 0), 0);
    const sequence = bridgeScore >= buildingScore ? BRIDGE_SEQUENCE : BUILDING_SEQUENCE;

    let orderedParts: string[];
    if (customOrder) {
      orderedParts = customOrder.filter(p => grouped.has(p));
      // Add any parts not in custom order
      for (const p of partNames) {
        if (!orderedParts.includes(p)) orderedParts.push(p);
      }
    } else {
      orderedParts = partNames.sort((a, b) =>
        sequenceIndex(a, sequence) - sequenceIndex(b, sequence)
      );
    }

    // Build rows with cumulative start days per part
    const result: GanttRow[] = [];
    let currentDay = 0;

    for (const partName of orderedParts) {
      const partPositions = grouped.get(partName) || [];
      // Sort within part: beton first, then bednění, then výztuž
      const subtypeOrder: Record<string, number> = { beton: 0, bednění: 1, výztuž: 2, jiné: 3 };
      partPositions.sort((a, b) =>
        (subtypeOrder[a.subtype] || 3) - (subtypeOrder[b.subtype] || 3)
      );

      const partStart = currentDay;
      let partMaxEnd = currentDay;

      for (const pos of partPositions) {
        // Parse metadata for schedule_info
        let meta: Record<string, unknown> | undefined;
        if (pos.metadata) {
          try { meta = JSON.parse(pos.metadata); } catch { /* ignore */ }
        }

        const days = pos.days || 1;
        // Within a part, concrete positions run in parallel with formwork/rebar
        const startDay = pos.subtype === 'beton' ? partStart : partStart;
        const endDay = startDay + days;

        result.push({
          id: pos.id || `${partName}-${pos.subtype}`,
          part_name: partName,
          subtype: pos.subtype,
          label: `${partName} — ${pos.subtype}${pos.item_name ? ` (${pos.item_name.slice(0, 40)})` : ''}`,
          days,
          start_day: startDay,
          color: getSubtypeColor(pos.subtype),
          position: pos,
          metadata: meta,
        });

        if (endDay > partMaxEnd) partMaxEnd = endDay;
      }

      // Next part starts after this part ends (sequential between parts)
      currentDay = partMaxEnd;
    }

    return result;
  }, [positionsData, customOrder]);

  const totalDays = useMemo(() =>
    rows.length > 0 ? Math.max(...rows.map(r => r.start_day + r.days)) : 0
  , [rows]);

  const dayWidth = Math.max(14, Math.min(32, 900 / Math.max(totalDays, 1)));

  // Drag-and-drop handlers for reordering parts
  const handleDragStart = useCallback((idx: number) => setDragIdx(idx), []);
  const handleDragOver = useCallback((idx: number) => setOverIdx(idx), []);
  const handleDrop = useCallback(() => {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
      const parts = [...new Set(rows.map(r => r.part_name))];
      const [moved] = parts.splice(dragIdx, 1);
      parts.splice(overIdx, 0, moved);
      setCustomOrder(parts);
    }
    setDragIdx(null);
    setOverIdx(null);
  }, [dragIdx, overIdx, rows]);

  // Unique parts for drag handles
  const uniqueParts = useMemo(() => {
    const seen = new Set<string>();
    return rows.filter(r => {
      if (seen.has(r.part_name)) return false;
      seen.add(r.part_name);
      return true;
    }).map(r => r.part_name);
  }, [rows]);

  if (!activeBridgeId) {
    return (
      <div className="r0-page" style={{ padding: 40, textAlign: 'center' }}>
        <PortalBreadcrumb />
        <h2 style={{ color: 'var(--r0-slate-500)' }}>Vyberte projekt/SO v hlavní aplikaci</h2>
        <Link to="/" style={{ color: 'var(--r0-orange)', textDecoration: 'underline' }}>
          Zpět na kalkulátor
        </Link>
      </div>
    );
  }

  return (
    <div className="r0-page" style={{ padding: '16px 24px', maxWidth: 1400, margin: '0 auto' }}>
      <PortalBreadcrumb />

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid var(--r0-slate-200)',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--r0-slate-800)' }}>
            Gantt projektu
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--r0-slate-500)' }}>
            {bridgeInfo?.name || activeBridgeId} — {rows.length} pozic, {totalDays} prac. dní
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to="/"
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600,
              border: '1px solid var(--r0-slate-300)', borderRadius: 6,
              textDecoration: 'none', color: 'var(--r0-slate-700)', background: 'white',
            }}
          >
            ← Kalkulátor
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--r0-slate-400)' }}>
          <div style={{ fontSize: 48 }}>📊</div>
          <p style={{ fontSize: 14, marginTop: 12 }}>
            Žádné pozice s výpočtem (dny {'>'} 0). Spusťte kalkulátor pro jednotlivé pozice.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Summary */}
          <div className="r0-grid-4" style={{ marginBottom: 16 }}>
            <SummaryCard label="Celkem dní" value={totalDays} unit="prac. dní" color="var(--r0-blue)" />
            <SummaryCard label="Pozice" value={rows.length} unit="ks" color="var(--r0-orange)" />
            <SummaryCard
              label="Celkové náklady"
              value={rows.reduce((s, r) => s + (r.position.kros_total_czk || r.position.cost_czk || 0), 0).toLocaleString('cs-CZ')}
              unit="Kč"
              color="var(--r0-green)"
            />
            <SummaryCard
              label="Beton celkem"
              value={Math.round(rows.reduce((s, r) => s + (r.position.concrete_m3 || 0), 0) * 10) / 10}
              unit="m³"
              color="var(--r0-indigo, #6366f1)"
            />
          </div>

          {/* Gantt Chart */}
          <div style={{
            background: 'white', border: '1px solid var(--r0-slate-200)',
            borderRadius: 8, overflow: 'hidden',
          }}>
            <div style={{ overflowX: 'auto', padding: 12 }}>
              <div style={{ minWidth: totalDays * dayWidth + 220 }}>
                {/* Day scale header */}
                <div style={{ display: 'flex', marginLeft: 200 }}>
                  {Array.from({ length: totalDays }, (_, d) => (
                    <div
                      key={d}
                      style={{
                        width: dayWidth,
                        textAlign: 'center',
                        fontSize: 9,
                        color: d % 5 === 0 ? 'var(--r0-slate-700)' : 'var(--r0-slate-300)',
                        fontWeight: d % 5 === 0 ? 700 : 400,
                        fontFamily: 'var(--r0-font-mono)',
                        borderLeft: d % 5 === 0 ? '1px solid var(--r0-slate-200)' : 'none',
                        paddingBottom: 4,
                      }}
                    >
                      {d % 5 === 0 || totalDays <= 30 ? d : ''}
                    </div>
                  ))}
                </div>

                {/* Part groups with rows */}
                {uniqueParts.map((partName, partIdx) => {
                  const partRows = rows.filter(r => r.part_name === partName);
                  return (
                    <div
                      key={partName}
                      draggable
                      onDragStart={() => handleDragStart(partIdx)}
                      onDragOver={(e) => { e.preventDefault(); handleDragOver(partIdx); }}
                      onDrop={handleDrop}
                      style={{
                        borderTop: partIdx > 0 ? '1px solid var(--r0-slate-100)' : 'none',
                        background: overIdx === partIdx && dragIdx !== null ? 'rgba(245,158,11,0.05)' : undefined,
                      }}
                    >
                      {partRows.map((row, rowIdx) => (
                        <div key={row.id} style={{ display: 'flex', alignItems: 'center', height: 28 }}>
                          {/* Label */}
                          <div style={{
                            width: 200, flexShrink: 0, paddingRight: 8,
                            fontSize: 11, color: 'var(--r0-slate-600)',
                            textAlign: 'right',
                            fontWeight: rowIdx === 0 ? 700 : 400,
                            cursor: 'grab',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                            title={row.label}
                          >
                            {rowIdx === 0 ? '⠿ ' : '  '}
                            {row.part_name}
                            <span style={{ color: 'var(--r0-slate-400)', fontWeight: 400, marginLeft: 4 }}>
                              {row.subtype}
                            </span>
                          </div>

                          {/* Bar area */}
                          <div style={{
                            position: 'relative', height: 22, flex: 1,
                            background: 'var(--r0-slate-50)', borderRadius: 2,
                          }}>
                            {/* Grid lines */}
                            {Array.from({ length: totalDays }, (_, d) => d % 5 === 0 ? (
                              <div key={d} style={{
                                position: 'absolute', left: d * dayWidth, top: 0, bottom: 0,
                                width: 1, background: 'var(--r0-slate-100)',
                              }} />
                            ) : null)}

                            {/* Position bar */}
                            <div
                              title={`${row.label}: ${row.days} dní (den ${row.start_day}–${row.start_day + row.days})`}
                              style={{
                                position: 'absolute',
                                left: row.start_day * dayWidth,
                                top: 2,
                                height: 18,
                                width: Math.max(4, row.days * dayWidth),
                                background: row.color,
                                borderRadius: 3,
                                opacity: 0.85,
                                display: 'flex',
                                alignItems: 'center',
                                paddingLeft: 4,
                                overflow: 'hidden',
                              }}
                            >
                              {row.days * dayWidth > 40 && (
                                <span style={{
                                  fontSize: 9, fontWeight: 700, color: 'white',
                                  textShadow: '0 0 2px rgba(0,0,0,0.3)',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {row.days}d
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div style={{
              display: 'flex', gap: 16, padding: '8px 16px',
              borderTop: '1px solid var(--r0-slate-100)',
              background: 'var(--r0-slate-50)',
            }}>
              {Object.entries(SUBTYPE_COLORS).map(([label, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 14, height: 10, borderRadius: 2, background: color }} />
                  <span style={{ fontSize: 11, color: 'var(--r0-slate-600)' }}>{label}</span>
                </div>
              ))}
              <span style={{ fontSize: 11, color: 'var(--r0-slate-400)', marginLeft: 'auto' }}>
                Přetáhněte ⠿ pro změnu pořadí částí
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, unit, color }: {
  label: string; value: string | number; unit?: string; color: string;
}) {
  return (
    <div style={{
      padding: '12px 16px', background: 'white',
      border: '1px solid var(--r0-slate-200)', borderRadius: 8,
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, color: 'var(--r0-slate-500)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--r0-slate-800)', fontFamily: 'var(--r0-font-mono)' }}>
        {value}
        {unit && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--r0-slate-500)', marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  );
}
