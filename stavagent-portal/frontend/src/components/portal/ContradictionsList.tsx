/**
 * ContradictionsList — displays cross-document contradictions with severity badges.
 * Filter by severity (critical/warning/info) and SO code.
 */

import React, { useState } from 'react';
import type { ContradictionRecord } from '../../types/passport';

interface ContradictionsListProps {
  contradictions: ContradictionRecord[];
}

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: '#e74c3c', bg: '#fdf0ef', label: 'Kritický' },
  warning: { color: '#f39c12', bg: '#fef9ed', label: 'Varování' },
  info: { color: '#3498db', bg: '#edf5fd', label: 'Info' },
};

export default function ContradictionsList({ contradictions }: ContradictionsListProps) {
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);
  const [filterSO, setFilterSO] = useState<string | null>(null);

  // Counts
  const counts = {
    critical: contradictions.filter(c => c.severity === 'critical').length,
    warning: contradictions.filter(c => c.severity === 'warning').length,
    info: contradictions.filter(c => c.severity === 'info').length,
  };

  // SO codes present
  const soCodes = [...new Set(contradictions.map(c => c.so_code).filter(Boolean))];

  // Filtered
  const filtered = contradictions.filter(c => {
    if (filterSeverity && c.severity !== filterSeverity) return false;
    if (filterSO && c.so_code !== filterSO) return false;
    return true;
  });

  if (contradictions.length === 0) {
    return (
      <div className="c-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Žádné rozpory nebyly nalezeny mezi dokumenty.
      </div>
    );
  }

  return (
    <div>
      {/* Summary badges */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {Object.entries(counts).map(([sev, count]) => {
          if (count === 0) return null;
          const cfg = SEVERITY_CONFIG[sev];
          const isActive = filterSeverity === sev;
          return (
            <button
              key={sev}
              onClick={() => setFilterSeverity(isActive ? null : sev)}
              className="c-badge"
              style={{
                backgroundColor: isActive ? cfg.color : cfg.bg,
                color: isActive ? '#fff' : cfg.color,
                border: `1px solid ${cfg.color}`,
                cursor: 'pointer',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {count} {cfg.label}
            </button>
          );
        })}

        {soCodes.length > 1 && (
          <select
            value={filterSO || ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterSO(e.target.value || null)}
            className="c-input"
            style={{ fontSize: '13px', padding: '4px 8px', maxWidth: '140px' }}
          >
            <option value="">Všechny SO</option>
            {soCodes.map(so => (
              <option key={so} value={so!}>{so}</option>
            ))}
          </select>
        )}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.map((c, i) => {
          const cfg = SEVERITY_CONFIG[c.severity || 'info'];
          return (
            <div
              key={i}
              className="c-card"
              style={{
                padding: '12px 16px',
                borderLeft: `4px solid ${cfg.color}`,
                backgroundColor: cfg.bg,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
                    {c.so_code && <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>[{c.so_code}]</span>}
                    <code style={{ backgroundColor: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: '3px' }}>
                      {c.field_name}
                    </code>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    <strong>{c.value_1}</strong>
                    <span style={{ color: 'var(--text-secondary)', margin: '0 6px' }}>({c.source_1})</span>
                    <span style={{ color: cfg.color, margin: '0 4px' }}>vs</span>
                    <strong>{c.value_2}</strong>
                    <span style={{ color: 'var(--text-secondary)', margin: '0 6px' }}>({c.source_2})</span>
                  </div>
                  {c.resolution && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                      → {c.resolution}
                    </div>
                  )}
                </div>
                <span
                  className="c-badge"
                  style={{
                    backgroundColor: cfg.color,
                    color: '#fff',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {cfg.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
