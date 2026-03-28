/**
 * PositionsPanel Component
 *
 * Shows cross-kiosk linked positions for a portal project.
 * Each position has deep-link buttons to open it in the relevant kiosk.
 *
 * API: GET /api/positions/project/{projectId}/linked
 */

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Loader } from 'lucide-react';
import { API_URL } from '../../services/api';

interface LinkedPosition {
  position_instance_id: string;
  catalog_code: string;
  description: string;
  qty: number;
  unit: string;
  skupina?: string;
  row_role?: string;
  monolith_payload?: Record<string, unknown>;
  dov_payload?: Record<string, unknown>;
  created_at?: string;
}

interface PositionsPanelProps {
  projectId: string;
}

const KIOSK_URLS: Record<string, string> = {
  monolit: 'https://kalkulator.stavagent.cz',
  registry: 'https://registry.stavagent.cz',
};

function buildKioskDeepLink(
  kioskType: 'monolit' | 'registry',
  projectId: string,
  positionInstanceId: string,
): string {
  const base = KIOSK_URLS[kioskType];
  if (kioskType === 'monolit') {
    return `${base}/?project=${projectId}&position_instance_id=${positionInstanceId}`;
  }
  return `${base}/registry/${projectId}?position_instance_id=${positionInstanceId}`;
}

export function PositionsPanel({ projectId }: PositionsPanelProps) {
  const [positions, setPositions] = useState<LinkedPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const loadPositions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/api/positions/project/${projectId}/linked`);
      if (!res.ok) {
        if (res.status === 404) {
          setPositions([]);
          return;
        }
        throw new Error(`Chyba ${res.status}`);
      }
      const data = await res.json();
      setPositions(data.positions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst pozice');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const monolitCount = positions.filter(p => p.monolith_payload).length;
  const dovCount = positions.filter(p => p.dov_payload).length;

  return (
    <div style={{ borderBottom: '1px solid #e5e5e5' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 24px',
          background: '#f8f8f8',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          color: '#1e293b',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{'\u{1F4CD}'}</span>
          Pozice
          {!loading && positions.length > 0 && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: '#6b7280',
                background: '#e5e7eb',
                padding: '1px 8px',
                borderRadius: '999px',
              }}
            >
              {positions.length}
            </span>
          )}
          {!loading && monolitCount > 0 && (
            <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 500 }}>
              Monolit: {monolitCount}
            </span>
          )}
          {!loading && dovCount > 0 && (
            <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 500 }}>
              Registry: {dovCount}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp style={{ width: '16px', height: '16px', color: '#6b7280' }} />
        ) : (
          <ChevronDown style={{ width: '16px', height: '16px', color: '#6b7280' }} />
        )}
      </button>

      {open && (
        <div style={{ padding: '0 24px 20px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280', fontSize: '13px' }}>
              <Loader style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
              Nacitani pozic...
            </div>
          )}

          {error && !loading && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              padding: '12px',
              color: '#dc2626',
              fontSize: '13px',
              marginTop: '12px',
            }}>
              {error}
            </div>
          )}

          {!loading && !error && positions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 16px', marginTop: '12px' }}>
              <p style={{ fontSize: '14px', fontWeight: 500, color: '#6b7280', margin: '0 0 6px' }}>
                Zadne propojene pozice
              </p>
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                Pozice se vytvori po importu souboru do kiosku.
              </p>
            </div>
          )}

          {!loading && !error && positions.length > 0 && (
            <div style={{ paddingTop: '12px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>Kod</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>Popis</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>Mn.</th>
                    <th style={{ textAlign: 'left', padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>MJ</th>
                    <th style={{ textAlign: 'center', padding: '8px 6px', color: '#6b7280', fontWeight: 600 }}>Kiosky</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.slice(0, 50).map(p => {
                    const hasMonolit = !!p.monolith_payload;
                    const hasDov = !!p.dov_payload;
                    return (
                      <tr
                        key={p.position_instance_id}
                        style={{ borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                      >
                        <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontWeight: 600, color: '#374151' }}>
                          {p.catalog_code || '-'}
                        </td>
                        <td style={{ padding: '8px 6px', color: '#1e293b', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.description}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>
                          {p.qty}
                        </td>
                        <td style={{ padding: '8px 6px', color: '#6b7280' }}>
                          {p.unit}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            {hasMonolit && (
                              <button
                                onClick={() => window.open(buildKioskDeepLink('monolit', projectId, p.position_instance_id), '_blank')}
                                title="Otevrit v Monolitu"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                                  padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
                                  border: '1px solid #c7d2fe', color: '#4f46e5', background: '#eef2ff',
                                  cursor: 'pointer',
                                }}
                              >
                                <ExternalLink style={{ width: '10px', height: '10px' }} />
                                Monolit
                              </button>
                            )}
                            {hasDov && (
                              <button
                                onClick={() => window.open(buildKioskDeepLink('registry', projectId, p.position_instance_id), '_blank')}
                                title="Otevrit v Registru"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                                  padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
                                  border: '1px solid #fde68a', color: '#d97706', background: '#fffbeb',
                                  cursor: 'pointer',
                                }}
                              >
                                <ExternalLink style={{ width: '10px', height: '10px' }} />
                                Registry
                              </button>
                            )}
                            {!hasMonolit && !hasDov && (
                              <span style={{ fontSize: '11px', color: '#9ca3af' }}>-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {positions.length > 50 && (
                <p style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', marginTop: '12px' }}>
                  Zobrazeno 50 z {positions.length} pozic
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
