/**
 * FlatGantt — Embedded project Gantt chart.
 *
 * Renders as a section/tab on the main page (not a separate route).
 * Shows parts in construction sequence order.
 * Calculated elements use real schedule_info; others show estimates.
 */

import { useMemo } from 'react';
import type { Position } from '@stavagent/monolit-shared';
import { sortPartsBySequence, SUBTYPE_LABELS } from '@stavagent/monolit-shared';

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

export default function FlatGantt({ positions }: Props) {
  const bars = useMemo(() => {
    if (!positions.length) return [];

    const partNames = [...new Set(positions.map(p => p.part_name))];
    const sorted = sortPartsBySequence(partNames);

    const result: GanttBar[] = [];
    let currentDay = 1;

    for (const partName of sorted) {
      const partPositions = positions.filter(p => p.part_name === partName);
      const beton = partPositions.find(p => p.subtype === 'beton');
      const meta = beton ? parseMetadata(beton) : null;

      if (meta?.schedule_info?.phases) {
        // Calculated element: use real schedule phases
        for (const phase of meta.schedule_info.phases) {
          result.push({
            partName,
            subtype: phase.subtype || phase.name || 'beton',
            startDay: currentDay + (phase.start_day || 0),
            duration: phase.duration || 1,
            isEstimate: false,
            label: phase.name || SUBTYPE_LABELS[phase.subtype] || phase.subtype,
          });
        }
        const totalDays = meta.schedule_info.total_days || beton?.days || 1;
        currentDay += totalDays;
      } else {
        // Estimate: simplified sequential (bednění → výztuž → beton)
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
  }, [positions]);

  if (!bars.length) return null;

  const maxDay = Math.max(...bars.map(b => b.startDay + b.duration), 1);
  const dayWidth = Math.max(16, Math.min(40, 800 / maxDay));

  // Unique parts for row labels
  const parts = [...new Set(bars.map(b => b.partName))];

  return (
    <div className="flat-gantt" style={{ marginTop: 16 }}>
      {/* Day scale header */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--flat-border)', padding: '4px 120px' }}>
        {Array.from({ length: Math.min(maxDay, 60) }, (_, i) => (
          <div key={i} style={{
            width: dayWidth, flexShrink: 0, textAlign: 'center',
            fontSize: 10, color: 'var(--stone-400)',
          }}>
            {i + 1}
          </div>
        ))}
        {maxDay > 60 && (
          <div style={{ fontSize: 10, color: 'var(--stone-400)', padding: '0 8px' }}>...</div>
        )}
      </div>

      {/* Bars by part */}
      {parts.map(partName => {
        const partBars = bars.filter(b => b.partName === partName);
        return (
          <div key={partName} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--flat-border)', minHeight: 28 }}>
            {/* Part label */}
            <div style={{
              width: 120, flexShrink: 0, padding: '4px 8px',
              fontSize: 11, fontWeight: 600, color: 'var(--flat-text-label)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {partName}
            </div>

            {/* Bars */}
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
      </div>
    </div>
  );
}
