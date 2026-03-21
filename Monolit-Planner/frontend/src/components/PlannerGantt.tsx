/**
 * PlannerGantt — Visual Gantt chart for element planner schedule
 *
 * Renders colored horizontal bars for each tact showing:
 * assembly, rebar, concrete, curing, stripping phases
 * with day scale, set labels, and phase legend
 */
import React, { useMemo, useState } from 'react';

interface TactDetail {
  tact: number;
  set: number;
  assembly: [number, number];
  rebar: [number, number];
  concrete: [number, number];
  curing: [number, number];
  stripping: [number, number];
}

interface PlannerGanttProps {
  tact_details: TactDetail[];
  total_days: number;
  ganttText?: string;
}

const PHASES = [
  { key: 'assembly', label: 'Montáž', color: '#3b82f6', textColor: '#1e3a5f' },
  { key: 'rebar', label: 'Výztuž', color: '#f59e0b', textColor: '#78350f' },
  { key: 'concrete', label: 'Beton', color: '#ef4444', textColor: '#7f1d1d' },
  { key: 'curing', label: 'Zrání', color: '#a3e635', textColor: '#365314' },
  { key: 'stripping', label: 'Demontáž', color: '#8b5cf6', textColor: '#3b0764' },
] as const;

type PhaseKey = typeof PHASES[number]['key'];

export default function PlannerGantt({ tact_details, total_days, ganttText }: PlannerGanttProps) {
  const days = Math.ceil(total_days);
  const dayWidth = Math.max(18, Math.min(36, 700 / Math.max(days, 1)));

  // Group tacts by set
  const setGroups = useMemo(() => {
    const groups = new Map<number, TactDetail[]>();
    for (const td of tact_details) {
      if (!groups.has(td.set)) groups.set(td.set, []);
      groups.get(td.set)!.push(td);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [tact_details]);

  const [showText, setShowText] = useState(false);

  return (
    <div>
      {/* Visual Gantt */}
      <div style={{ overflowX: 'auto', marginBottom: 12 }}>
        <div style={{ minWidth: days * dayWidth + 120 }}>
          {/* Day scale header */}
          <div style={{ display: 'flex', marginLeft: 100 }}>
            {Array.from({ length: days }, (_, d) => (
              <div
                key={d}
                style={{
                  width: dayWidth,
                  textAlign: 'center',
                  fontSize: 10,
                  color: d % 5 === 0 ? '#334155' : '#94a3b8',
                  fontWeight: d % 5 === 0 ? 700 : 400,
                  fontFamily: "'JetBrains Mono', monospace",
                  borderLeft: d % 5 === 0 ? '1px solid #e2e8f0' : 'none',
                  paddingBottom: 4,
                }}
              >
                {d % 5 === 0 || days <= 20 ? d : ''}
              </div>
            ))}
          </div>

          {/* Tact rows */}
          {tact_details.map(td => (
            <div key={td.tact} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
              {/* Label */}
              <div style={{
                width: 100, flexShrink: 0, paddingRight: 8,
                fontSize: 11, fontWeight: 600, color: '#475569',
                textAlign: 'right', fontFamily: "'JetBrains Mono', monospace",
              }}>
                T{td.tact} <span style={{ color: '#94a3b8', fontWeight: 400 }}>(S{td.set})</span>
              </div>

              {/* Bar area */}
              <div style={{
                position: 'relative', height: 22, flex: 1,
                background: '#f8fafc',
                borderRadius: 3,
              }}>
                {/* Grid lines */}
                {Array.from({ length: days }, (_, d) => d % 5 === 0 ? (
                  <div key={d} style={{
                    position: 'absolute', left: d * dayWidth, top: 0, bottom: 0,
                    width: 1, background: '#e2e8f0',
                  }} />
                ) : null)}

                {/* Phase bars */}
                {PHASES.map(phase => {
                  const range = td[phase.key as PhaseKey] as [number, number];
                  if (!range || range[1] <= range[0]) return null;
                  const left = range[0] * dayWidth;
                  const width = Math.max(2, (range[1] - range[0]) * dayWidth);
                  return (
                    <div
                      key={phase.key}
                      title={`${phase.label}: den ${range[0].toFixed(1)}–${range[1].toFixed(1)}`}
                      style={{
                        position: 'absolute',
                        left,
                        top: 2,
                        height: 18,
                        width,
                        background: phase.color,
                        borderRadius: 2,
                        opacity: 0.85,
                        cursor: 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {width > 30 && (
                        <span style={{
                          fontSize: 8, fontWeight: 700, color: 'white',
                          textShadow: '0 0 2px rgba(0,0,0,0.3)',
                          whiteSpace: 'nowrap',
                        }}>
                          {phase.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap',
        padding: '8px 12px', background: '#f8fafc', borderRadius: 6,
        marginBottom: 8,
      }}>
        {PHASES.map(p => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 14, height: 10, borderRadius: 2, background: p.color }} />
            <span style={{ fontSize: 11, color: '#475569' }}>{p.label}</span>
          </div>
        ))}
      </div>

      {/* Toggle ASCII Gantt */}
      {ganttText && (
        <div>
          <button
            onClick={() => setShowText(!showText)}
            style={{
              background: 'none', border: 'none', color: '#6366f1',
              cursor: 'pointer', fontSize: 11, padding: 0, fontFamily: 'inherit',
            }}
          >
            {showText ? '▼' : '▶'} ASCII Gantt (terminál)
          </button>
          {showText && (
            <pre style={{
              background: '#1e293b', color: '#e2e8f0',
              padding: 12, borderRadius: 6, fontSize: 10, lineHeight: 1.5,
              overflowX: 'auto', margin: '6px 0 0', fontFamily: "'JetBrains Mono', monospace",
            }}>
              {ganttText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

