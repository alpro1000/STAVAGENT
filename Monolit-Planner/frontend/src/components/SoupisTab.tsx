/**
 * SoupisTab — Bill of Quantities (Soupis prací) tab
 *
 * Displays generated OTSKP-priced items with URS classification button.
 * Part of the Monolit-Planner main view.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { soupisAPI, SoupisItem } from '../services/api';
import UrsClassifierDrawer from './UrsClassifierDrawer';

interface SoupisTabProps {
  projectId: string;
}

export default function SoupisTab({ projectId }: SoupisTabProps) {
  const [items, setItems] = useState<SoupisItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCzk, setTotalCzk] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // URS Classifier drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SoupisItem | null>(null);

  const loadSoupis = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await soupisAPI.get(projectId);
      if (result.success) {
        setItems(result.data.items || []);
        setTotalCzk(result.data.total_czk || 0);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadSoupis();
  }, [loadSoupis]);

  const handleOpenUrs = (item: SoupisItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  const handleUrsSelected = async (ursCode: string, ursName: string, confidence: number) => {
    if (!selectedItem) return;
    try {
      await soupisAPI.updateUrs(projectId, selectedItem.item_id, ursCode, ursName, confidence);
      // Update local state
      setItems(prev => prev.map(i =>
        i.item_id === selectedItem.item_id
          ? { ...i, code_urs: ursCode, urs_name: ursName, urs_confidence: confidence }
          : i
      ));
      setDrawerOpen(false);
    } catch (e: any) {
      console.error('Failed to save URS code:', e);
    }
  };

  const formatCzk = (n: number | undefined | null) => {
    if (n == null) return '-';
    return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(n);
  };

  if (loading) {
    return <div className="r0-panel r0-p-4">Nacitam soupis praci...</div>;
  }

  if (error) {
    return <div className="r0-panel r0-p-4 r0-text-error">{error}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="r0-panel r0-p-4" style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--r0-text-secondary)', marginBottom: '1rem' }}>
          Soupis praci zatim nebyl vygenerovan.
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--r0-text-tertiary)' }}>
          Pouzijte Python price engine pro generovani soupisu z parametru TZ.
        </p>
      </div>
    );
  }

  return (
    <div className="r0-panel" style={{ overflow: 'auto' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.75rem 1rem', borderBottom: '1px solid var(--r0-border)'
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Soupis praci</h3>
        <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>
          Celkem: {formatCzk(totalCzk)} CZK
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--r0-border)', textAlign: 'left' }}>
            <th style={{ padding: '0.5rem' }}>ID</th>
            <th style={{ padding: '0.5rem' }}>OTSKP</th>
            <th style={{ padding: '0.5rem' }}>Popis</th>
            <th style={{ padding: '0.5rem' }}>MJ</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Mnozstvi</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Jed.cena</th>
            <th style={{ padding: '0.5rem', textAlign: 'right' }}>Celkem</th>
            <th style={{ padding: '0.5rem' }}>URS</th>
            <th style={{ padding: '0.5rem', width: '60px' }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.item_id} style={{
              borderBottom: '1px solid var(--r0-border)',
              background: item.quantity_status === 'ODHADNUTO'
                ? 'var(--r0-bg-warning, rgba(255,159,28,0.05))'
                : undefined,
            }}>
              <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{item.item_id}</td>
              <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontWeight: 500 }}>
                {item.code_otskp}
                {item.is_composite && (
                  <span title="Kompozitni polozka" style={{
                    marginLeft: '4px', fontSize: '0.7rem',
                    background: 'var(--r0-accent, #FF9F1C)',
                    color: '#fff', padding: '1px 4px', borderRadius: '3px'
                  }}>K</span>
                )}
              </td>
              <td style={{ padding: '0.5rem', maxWidth: '300px' }}>
                <div style={{ fontWeight: 500 }}>{item.description}</div>
                {item.specification && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--r0-text-secondary)' }}>
                    {item.specification.substring(0, 80)}
                  </div>
                )}
              </td>
              <td style={{ padding: '0.5rem' }}>{item.unit}</td>
              <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>
                {item.quantity != null ? formatCzk(item.quantity) : '-'}
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>
                {item.unit_price != null ? formatCzk(item.unit_price) : '-'}
              </td>
              <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                {item.total_price != null ? formatCzk(item.total_price) : '-'}
              </td>
              <td style={{ padding: '0.5rem' }}>
                {item.code_urs ? (
                  <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'green' }}>
                    {item.code_urs}
                  </span>
                ) : (
                  <span style={{ color: 'var(--r0-text-tertiary)', fontSize: '0.8rem' }}>-</span>
                )}
              </td>
              <td style={{ padding: '0.5rem' }}>
                <button
                  onClick={() => handleOpenUrs(item)}
                  style={{
                    border: '1px solid var(--r0-border)',
                    background: 'var(--r0-bg-secondary)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                  title="Najit URS kod"
                >
                  URS
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedItem && (
        <UrsClassifierDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          otskpCode={selectedItem.code_otskp || ''}
          otskpName={selectedItem.description}
          otskpMj={selectedItem.unit}
          quantity={selectedItem.quantity || 0}
          onSelectUrs={handleUrsSelected}
        />
      )}
    </div>
  );
}
