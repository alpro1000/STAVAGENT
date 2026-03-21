/**
 * PortalImportModal — Confirmation dialog for importing positions from Portal
 *
 * Shows a preview of what will be imported:
 *  - File name, sheet count, total items
 *  - Work type breakdown
 *  - Confirm / Cancel buttons
 *
 * Design: Slate Minimal (CSS variables --r0-*)
 */

import { createPortal } from 'react-dom';
import { useEffect } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PortalSheet {
  name: string;
  items: Array<{
    popis: string;
    kod?: string;
    mj?: string;
    mnozstvi?: number;
    detectedType?: string;
  }>;
}

interface PortalData {
  success: boolean;
  file_id: string;
  file_name: string;
  sheets: PortalSheet[];
  totalItems?: number;
  metadata?: Record<string, unknown>;
}

interface PortalImportModalProps {
  data: PortalData;
  onConfirm: () => void;
  onCancel: () => void;
  importing: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  beton: 'Beton', bedneni: 'Bednění', vyztuze: 'Výztuž',
  zemni: 'Zemní práce', izolace: 'Izolace', komunikace: 'Komunikace',
  piloty: 'Piloty', kotveni: 'Kotvení', prefab: 'Prefab', doprava: 'Doprava',
  jine: 'Ostatní', unknown: 'Ostatní',
};

const TYPE_COLORS: Record<string, string> = {
  beton: '#6366f1', bedneni: '#8b5cf6', vyztuze: '#ec4899',
  zemni: '#a3763d', izolace: '#06b6d4', komunikace: '#64748b',
  piloty: '#d97706', kotveni: '#ef4444', prefab: '#0ea5e9', doprava: '#10b981',
  jine: '#9ca3af', unknown: '#9ca3af',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function PortalImportModal({ data, onConfirm, onCancel, importing }: PortalImportModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !importing) onCancel(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onCancel, importing]);

  const allItems = data.sheets.flatMap(s => s.items);
  const totalItems = allItems.length;
  const fileName = data.file_name?.replace(/\.[^.]+$/, '') || 'Import z Portal';

  // Work type breakdown
  const byType = allItems.reduce<Record<string, number>>((acc, item) => {
    const type = item.detectedType || 'jine';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const modalContent = (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, padding: '24px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !importing) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Import z Portal"
    >
      <div style={{
        background: 'var(--r0-bg, #fff)',
        border: '1px solid var(--r0-border, #e2e8f0)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--r0-border, #e2e8f0)',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '20px' }}>📥</span>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--r0-text, #1e293b)' }}>
              Import z Portal
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--r0-text-muted, #94a3b8)', margin: 0 }}>
              {fileName}
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Pozice', value: String(totalItems) },
              { label: 'Listy', value: String(data.sheets.length) },
              { label: 'Soubor', value: fileName.length > 12 ? fileName.slice(0, 12) + '…' : fileName },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: 'var(--r0-bg-alt, #f8fafc)', borderRadius: '8px',
                padding: '8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--r0-text, #1e293b)' }}>{value}</div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--r0-text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Work types */}
          {Object.keys(byType).length > 0 && (
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--r0-text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', margin: '0 0 6px' }}>
                Typy prací
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {Object.entries(byType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <span key={type} style={{
                      padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                      background: `${TYPE_COLORS[type] || '#9ca3af'}15`,
                      color: TYPE_COLORS[type] || '#9ca3af',
                    }}>
                      {TYPE_LABELS[type] || type} {count}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Sheets list */}
          {data.sheets.length > 1 && (
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--r0-text-muted, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', margin: '0 0 6px' }}>
                Listy ({data.sheets.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {data.sheets.map(sh => (
                  <div key={sh.name} style={{
                    display: 'flex', justifyContent: 'space-between', fontSize: '12px',
                    padding: '4px 10px', background: 'var(--r0-bg-alt, #f8fafc)', borderRadius: '6px',
                  }}>
                    <span style={{ color: 'var(--r0-text, #374151)', fontWeight: 500 }}>{sh.name}</span>
                    <span style={{ color: 'var(--r0-text-muted, #94a3b8)' }}>{sh.items.length} pol.</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div style={{
            padding: '8px 12px', borderRadius: '8px',
            background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
            fontSize: '11px', color: '#4f46e5',
          }}>
            Bude vytvořen nový projekt „{fileName}" s {totalItems} pozicemi.
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--r0-border, #e2e8f0)',
          display: 'flex', gap: '8px', justifyContent: 'flex-end',
        }}>
          <button
            onClick={onCancel}
            disabled={importing}
            className="btn-secondary"
            style={{
              padding: '7px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 500,
              border: '1px solid var(--r0-border, #d1d5db)',
              background: 'var(--r0-bg, #fff)',
              color: 'var(--r0-text, #374151)',
              cursor: importing ? 'not-allowed' : 'pointer',
              opacity: importing ? 0.5 : 1,
            }}
          >
            Zrušit
          </button>
          <button
            onClick={onConfirm}
            disabled={importing}
            className="btn-primary"
            style={{
              padding: '7px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
              border: 'none',
              background: importing ? '#94a3b8' : '#6366f1',
              color: '#fff',
              cursor: importing ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {importing ? (
              <>
                <span style={{
                  display: 'inline-block', width: 14, height: 14,
                  border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                }} />
                Importování…
              </>
            ) : (
              <>Importovat {totalItems} pozic</>
            )}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export type { PortalData };
