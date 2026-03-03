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

  if (loading) return <div className="modal-overlay"><div className="c-panel">Načítání...</div></div>;
  if (!position) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="c-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
        <h2>Detail pozice</h2>
        
        <div style={{ display: 'grid', gap: '12px' }}>
          <div>
            <strong>Kód:</strong> {position.catalog_code}
          </div>
          <div>
            <strong>Popis:</strong> {position.description}
          </div>
          <div>
            <strong>Množství:</strong> {position.qty} {position.unit}
          </div>
          <div>
            <strong>Kiosk:</strong> <span style={{
              padding: '2px 8px',
              borderRadius: '4px',
              background: position.kiosk_type === 'monolit' ? '#e3f2fd' : '#fff3e0'
            }}>{position.kiosk_type}</span>
          </div>
          <div>
            <strong>Kategorie:</strong> {position.work_category}
          </div>
          
          {position.monolith_payload && (
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Monolit data</summary>
              <pre style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', overflow: 'auto' }}>
                {JSON.stringify(position.monolith_payload, null, 2)}
              </pre>
            </details>
          )}
        </div>

        <button className="c-btn" onClick={onClose} style={{ marginTop: '16px' }}>
          Zavřít
        </button>
      </div>
    </div>
  );
}
