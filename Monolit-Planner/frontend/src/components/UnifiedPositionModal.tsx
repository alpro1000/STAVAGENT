import { useEffect, useState } from 'react';
import { getPositionById, PositionInstance } from '../api/registryApi';

interface Props {
  positionId: string;
  onClose: () => void;
}

export default function UnifiedPositionModal({ positionId, onClose }: Props) {
  const [position, setPosition] = useState<PositionInstance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPositionById(positionId)
      .then(setPosition)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [positionId]);

  if (loading) return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="c-panel" style={{ maxWidth: '600px', width: '90%', padding: '48px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <p>Načítání...</p>
      </div>
    </div>
  );
  
  if (!position) return null;

  const kioskIcon = position.kiosk_type === 'monolit' ? '🪨' : '📋';
  const kioskColor = position.kiosk_type === 'monolit' ? '#e3f2fd' : '#fff3e0';
  const kioskTextColor = position.kiosk_type === 'monolit' ? '#1976d2' : '#f57c00';

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '24px'
    }}>
      <div className="c-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>📋 Detail pozice</h2>
          <button onClick={onClose} className="c-btn c-btn--sm" style={{ minWidth: 'auto' }}>×</button>
        </div>
        
        <div style={{ display: 'grid', gap: '16px' }}>
          <div className="c-panel c-panel--inset">
            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <strong style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Kód:</strong>
                <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'monospace' }}>{position.catalog_code}</div>
              </div>
              <div>
                <strong style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Popis:</strong>
                <div style={{ fontSize: '14px' }}>{position.description}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <strong style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Množství:</strong>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-orange)' }}>{position.qty} {position.unit}</div>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Kiosk:</strong>
                  <div>
                    <span className="c-badge" style={{ background: kioskColor, color: kioskTextColor, fontSize: '14px' }}>
                      {kioskIcon} {position.kiosk_type}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <strong style={{ color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Kategorie:</strong>
                <div style={{ fontSize: '14px' }}>{position.work_category}</div>
              </div>
            </div>
          </div>
          
          {position.monolith_payload && (
            <details className="c-panel c-panel--inset">
              <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '8px', userSelect: 'none' }}>
                🪨 Monolit data
              </summary>
              <pre style={{
                background: 'var(--bg-secondary)',
                padding: '12px',
                borderRadius: '6px',
                overflow: 'auto',
                fontSize: '12px',
                marginTop: '8px'
              }}>
                {JSON.stringify(position.monolith_payload, null, 2)}
              </pre>
            </details>
          )}

          {position.tov_payload && (
            <details className="c-panel c-panel--inset">
              <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '8px', userSelect: 'none' }}>
                📋 Registry TOV data
              </summary>
              <pre style={{
                background: 'var(--bg-secondary)',
                padding: '12px',
                borderRadius: '6px',
                overflow: 'auto',
                fontSize: '12px',
                marginTop: '8px'
              }}>
                {JSON.stringify(position.tov_payload, null, 2)}
              </pre>
            </details>
          )}

          {position.urs_payload && (
            <details className="c-panel c-panel--inset">
              <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '8px', userSelect: 'none' }}>
                🔍 URS Matcher data
              </summary>
              <pre style={{
                background: 'var(--bg-secondary)',
                padding: '12px',
                borderRadius: '6px',
                overflow: 'auto',
                fontSize: '12px',
                marginTop: '8px'
              }}>
                {JSON.stringify(position.urs_payload, null, 2)}
              </pre>
            </details>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '24px', justifyContent: 'flex-end' }}>
          <button className="c-btn" onClick={onClose}>
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
