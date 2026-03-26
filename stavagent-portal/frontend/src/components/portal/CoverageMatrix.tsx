/**
 * CoverageMatrix — shows which document categories exist per SO.
 *
 * Table: rows = SO codes, columns = doc categories (TZ, VY, GE, RO, HA, PD, SM)
 * ✓ = present (green), ✗ = missing (red)
 */

import type { CSSProperties } from 'react';
import type { SOFileGroup } from '../../types/passport';
import { DOC_CATEGORY_LABELS } from '../../types/passport';

interface CoverageMatrixProps {
  fileGroups: SOFileGroup[];
}

const COVERAGE_CATEGORIES = ['TZ', 'VY', 'GE', 'RO', 'HA', 'PD', 'SM', 'ZP'];

const CATEGORY_LABELS: Record<string, string> = {
  TZ: 'TZ',
  VY: 'VY',
  GE: 'GE',
  RO: 'RO',
  HA: 'HA',
  PD: 'PD',
  SM: 'SM',
  ZP: 'ZP',
};

export default function CoverageMatrix({ fileGroups }: CoverageMatrixProps) {
  if (fileGroups.length === 0) {
    return (
      <div className="c-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Žádné skupiny souborů.
      </div>
    );
  }

  return (
    <div>
      {/* Matrix table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: '100px' }}>SO</th>
              {COVERAGE_CATEGORIES.map(cat => (
                <th key={cat} style={{ ...thStyle, textAlign: 'center', width: '60px' }}>
                  {CATEGORY_LABELS[cat]}
                </th>
              ))}
              <th style={{ ...thStyle, textAlign: 'center' }}>Soubory</th>
            </tr>
          </thead>
          <tbody>
            {fileGroups.map(group => (
              <tr key={group.so_code}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  {group.so_code}
                  {group.so_name && (
                    <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '8px', fontSize: '12px' }}>
                      {group.so_name}
                    </span>
                  )}
                </td>
                {COVERAGE_CATEGORIES.map(cat => {
                  const present = group.coverage?.[cat];
                  return (
                    <td key={cat} style={{ ...tdStyle, textAlign: 'center' }}>
                      {present === true && (
                        <span style={{ color: '#27ae60', fontWeight: 700 }}>✓</span>
                      )}
                      {present === false && (
                        <span style={{ color: '#e74c3c', fontWeight: 700 }}>✗</span>
                      )}
                      {present === undefined && (
                        <span style={{ color: '#ccc' }}>—</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {group.files?.length || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Missing categories warnings */}
      {fileGroups.some(g => g.missing_categories && g.missing_categories.length > 0) && (
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600 }}>Chybějící dokumenty</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {fileGroups
              .filter(g => g.missing_categories && g.missing_categories.length > 0)
              .map(g => (
                <div key={g.so_code} style={{ fontSize: '13px', color: '#e74c3c' }}>
                  <strong>{g.so_code}:</strong> chybí{' '}
                  {g.missing_categories!.map(cat => DOC_CATEGORY_LABELS[cat as keyof typeof DOC_CATEGORY_LABELS] || cat).join(', ')}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* File list per SO */}
      <div style={{ marginTop: '20px' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600 }}>Soubory podle SO</h4>
        {fileGroups.map(group => (
          <div key={group.so_code} style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{group.so_code}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '16px' }}>
              {group.files?.map((f, i) => (
                <div key={i} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {f.filename}
                  {f.classification && (
                    <span
                      className="c-badge"
                      style={{
                        marginLeft: '8px',
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(0,0,0,0.06)',
                      }}
                    >
                      {f.classification.category}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: '8px 6px',
  borderBottom: '2px solid var(--border-color, #e0e0e0)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  color: 'var(--text-secondary)',
  letterSpacing: '0.5px',
};

const tdStyle: CSSProperties = {
  padding: '8px 6px',
  borderBottom: '1px solid var(--border-color, #f0f0f0)',
};
