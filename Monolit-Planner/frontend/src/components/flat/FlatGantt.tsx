/**
 * FlatGantt — Embedded project Gantt chart with drag-and-drop part reordering.
 *
 * Rendered as a section on the main page (not a separate route).
 * Parts sorted by construction sequence, with drag & drop override.
 * Calculated elements use real schedule_info; others show estimates.
 * Part order persisted to localStorage between sessions.
 */

import { useMemo, useState, useCallback, useRef } from 'react';
import type { Position } from '@stavagent/monolit-shared';
import { sortPartsBySequence, SUBTYPE_LABELS } from '@stavagent/monolit-shared';
import { useUI } from '../../context/UIContext';

interface Props {
  positions: Position[];
}

interface GanttBar {
  partName: string;
  subtype: string;
  startDay: number;
  duration: number;
  isEstimate: boolean;
  label: string;
}

function parseMetadata(pos: Position): Record<string, any> | null {
  if (!pos.metadata) return null;
  try {
    return typeof pos.metadata === 'string' ? JSON.parse(pos.metadata) : pos.metadata;
  } catch { return null; }
}

/** Storage key for persisted part order */
function ganttOrderKey(projectId: string | null): string {
  return `monolit-gantt-order-${projectId || 'default'}`;
}

export default function FlatGantt({ positions }: Props) {
  const { selectedProjectId } = useUI();

  // Persisted part order (drag & drop overrides)
  const [customOrder, setCustomOrder] = useState<string[] | null>(() => {
    try {
      const stored = localStorage.getItem(ganttOrderKey(selectedProjectId));
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  // Drag state
  const dragPart = useRef<string | null>(null);
  const [dragOverPart, setDragOverPart] = useState<string | null>(null);

  // Build part order: custom (if saved) or auto-sorted by construction sequence
  const partOrder = useMemo(() => {
    const partNames = [...new Set(positions.map(p => p.part_name))];
    if (customOrder) {
      // Use custom order, appending any new parts not in the saved order
      const known = new Set(customOrder);
      const extra = partNames.filter(n => !known.has(n));
      return [...customOrder.filter(n => partNames.includes(n)), ...extra];
    }
    return sortPartsBySequence(partNames);
  }, [positions, customOrder]);

  // Compute bars
  const bars = useMemo(() => {
    if (!positions.length || !partOrder.length) return [];
    const result: GanttBar[] = [];
    let currentDay = 1;

    for (const partName of partOrder) {
      const partPositions = positions.filter(p => p.part_name === partName);
      const beton = partPositions.find(p => p.subtype === 'beton');
      const meta = beton ? parseMetadata(beton) : null;

      if (meta?.schedule_info?.phases) {
        for (const phase of meta.schedule_info.phases) {
          result.push({
            partName,
            subtype: phase.subtype || phase.name || 'beton',
            startDay: currentDay + (phase.start_day || 0),
            duration: phase.duration || 1,
            isEstimate: false,
            label: phase.name || (SUBTYPE_LABELS as Record<string, string>)[phase.subtype] || phase.subtype,
          });
        }
        currentDay += meta.schedule_info.total_days || beton?.days || 1;
      } else {
        const subtypeOrder: string[] = ['bednění', 'výztuž', 'beton', 'odbednění', 'jiné'];
        const ordered = [...partPositions].sort((a, b) =>
          (subtypeOrder.indexOf(a.subtype) ?? 99) - (subtypeOrder.indexOf(b.subtype) ?? 99)
        );
        let dayOffset = 0;
        for (const pos of ordered) {
          const dur = pos.days || 1;
          result.push({
            partName,
            subtype: pos.subtype,
            startDay: currentDay + dayOffset,
            duration: dur,
            isEstimate: true,
            label: SUBTYPE_LABELS[pos.subtype] || pos.subtype,
          });
          dayOffset += dur;
        }
        currentDay += dayOffset || 1;
      }
    }
    return result;
  }, [positions, partOrder]);

  // Drag & drop handlers
  const handleDragStart = useCallback((partName: string) => {
    dragPart.current = partName;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, partName: string) => {
    e.preventDefault();
    setDragOverPart(partName);
  }, []);

  const handleDrop = useCallback((targetPart: string) => {
    const src = dragPart.current;
    if (!src || src === targetPart) {
      dragPart.current = null;
      setDragOverPart(null);
      return;
    }
    // Reorder
    const newOrder = [...partOrder];
    const srcIdx = newOrder.indexOf(src);
    const tgtIdx = newOrder.indexOf(targetPart);
    if (srcIdx === -1 || tgtIdx === -1) return;
    newOrder.splice(srcIdx, 1);
    newOrder.splice(tgtIdx, 0, src);

    setCustomOrder(newOrder);
    localStorage.setItem(ganttOrderKey(selectedProjectId), JSON.stringify(newOrder));
    dragPart.current = null;
    setDragOverPart(null);
  }, [partOrder, selectedProjectId]);

  const handleDragEnd = useCallback(() => {
    dragPart.current = null;
    setDragOverPart(null);
  }, []);

  if (!bars.length) return null;

  const maxDay = Math.max(...bars.map(b => b.startDay + b.duration), 1);
  const dayWidth = Math.max(16, Math.min(40, 800 / maxDay));

  // KPI summary
  const totalDays = maxDay - 1;
  const totalM3 = positions.filter(p => p.subtype === 'beton').reduce((s, p) => s + (p.concrete_m3 || 0), 0);
  const totalCost = positions.reduce((s, p) => s + (p.kros_total_czk || 0), 0);

  return (
    <div style={{ marginTop: 24 }}>
      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--flat-text-label)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        Harmonogram
      </h4>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 12 }}>
        <span><strong>{totalDays}</strong> dní</span>
        <span><strong>{partOrder.length}</strong> částí</span>
        <span><strong>{totalM3.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })}</strong> m³</span>
        {totalCost > 0 && <span><strong>{totalCost.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })}</strong> Kč</span>}
      </div>

      <div className="flat-gantt">
        {/* Day scale */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--flat-border)', padding: '4px 120px' }}>
          {Array.from({ length: Math.min(maxDay, 60) }, (_, i) => (
            <div key={i} style={{
              width: dayWidth, flexShrink: 0, textAlign: 'center',
              fontSize: 10, color: 'var(--stone-400)',
            }}>
              {i + 1}
            </div>
          ))}
          {maxDay > 60 && <div style={{ fontSize: 10, color: 'var(--stone-400)', padding: '0 8px' }}>...</div>}
        </div>

        {/* Bars by part — draggable */}
        {partOrder.map(partName => {
          const partBars = bars.filter(b => b.partName === partName);
          const isDragOver = dragOverPart === partName;
          return (
            <div
              key={partName}
              draggable
              onDragStart={() => handleDragStart(partName)}
              onDragOver={e => handleDragOver(e, partName)}
              onDrop={() => handleDrop(partName)}
              onDragEnd={handleDragEnd}
              style={{
                display: 'flex', alignItems: 'center',
                borderBottom: '1px solid var(--flat-border)', minHeight: 28,
                cursor: 'grab',
                background: isDragOver ? 'var(--blue-50)' : undefined,
              }}
            >
              <div style={{
                width: 120, flexShrink: 0, padding: '4px 8px',
                fontSize: 11, fontWeight: 600, color: 'var(--flat-text-label)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {partName}
              </div>
              <div style={{ flex: 1, position: 'relative', height: 24 }}>
                {partBars.map((bar, i) => {
                  const barColor = bar.subtype.includes('bedn') ? 'flat-gantt__bar--bedneni'
                    : bar.subtype.includes('výztuž') ? 'flat-gantt__bar--vystuz'
                    : 'flat-gantt__bar--beton';
                  return (
                    <div
                      key={i}
                      className={`flat-gantt__bar ${barColor} ${bar.isEstimate ? 'flat-gantt__bar--estimate' : ''}`}
                      title={`${bar.label}: Den ${bar.startDay}–${bar.startDay + bar.duration - 1}${bar.isEstimate ? ' (odhad)' : ''}`}
                      style={{
                        position: 'absolute',
                        left: (bar.startDay - 1) * dayWidth,
                        width: bar.duration * dayWidth - 2,
                        top: 3,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, padding: '8px 12px', fontSize: 11, color: 'var(--flat-text-secondary)' }}>
          <span><span className="flat-gantt__bar flat-gantt__bar--beton" style={{ display: 'inline-block', width: 16, height: 10, verticalAlign: 'middle', marginRight: 4 }} /> Beton</span>
          <span><span className="flat-gantt__bar flat-gantt__bar--bedneni" style={{ display: 'inline-block', width: 16, height: 10, verticalAlign: 'middle', marginRight: 4 }} /> Bednění</span>
          <span><span className="flat-gantt__bar flat-gantt__bar--vystuz" style={{ display: 'inline-block', width: 16, height: 10, verticalAlign: 'middle', marginRight: 4 }} /> Výztuž</span>
          <span><span className="flat-gantt__bar flat-gantt__bar--estimate" style={{ display: 'inline-block', width: 16, height: 10, verticalAlign: 'middle', marginRight: 4, background: 'var(--stone-500)' }} /> Odhad</span>
          <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>Přetáhněte části pro změnu pořadí</span>
        </div>
      </div>
    </div>
  );
}
