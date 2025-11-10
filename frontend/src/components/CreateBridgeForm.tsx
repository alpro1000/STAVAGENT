/**
 * CreateBridgeForm - Manual bridge creation form
 * User inputs: object_name, bridge_id, optional metadata
 */

import { useState } from 'react';
import { createBridge } from '../services/api';

interface CreateBridgeFormProps {
  onSuccess: (bridge_id: string) => void;
  onCancel?: () => void;
}

export default function CreateBridgeForm({ onSuccess, onCancel }: CreateBridgeFormProps) {
  const [projectName, setProjectName] = useState('');
  const [objectName, setObjectName] = useState('');
  const [bridgeId, setBridgeId] = useState('');
  const [spanLength, setSpanLength] = useState('');
  const [deckWidth, setDeckWidth] = useState('');
  const [pdWeeks, setPdWeeks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!bridgeId.trim()) {
      setError('Číslo mostu je povinné');
      return;
    }

    setIsSubmitting(true);

    try {
      await createBridge({
        bridge_id: bridgeId.trim(),
        project_name: projectName.trim() || undefined,
        object_name: objectName.trim() || bridgeId.trim(),
        span_length_m: spanLength ? parseFloat(spanLength) : undefined,
        deck_width_m: deckWidth ? parseFloat(deckWidth) : undefined,
        pd_weeks: pdWeeks ? parseFloat(pdWeeks) : undefined,
      });

      onSuccess(bridgeId.trim());
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Chyba při vytváření mostu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-bridge-form">
      <h2>🌉 Vytvořit nový most</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Číslo mostu (Bridge ID) *
            <input
              type="text"
              value={bridgeId}
              onChange={(e) => setBridgeId(e.target.value)}
              placeholder="např: SO201, SO202..."
              required
              disabled={isSubmitting}
              autoFocus
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Stavba (Project)
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="např: D6 Žalmanov – Knínice, VD – ZDS, bez cen"
              disabled={isSubmitting}
            />
            <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
              Název projektu - ke kterému patří více mostů
            </small>
          </label>
        </div>

        <div className="form-row">
          <label>
            Objekt (Bridge Name)
            <input
              type="text"
              value={objectName}
              onChange={(e) => setObjectName(e.target.value)}
              placeholder="např: SO 204 - Most na D6 přes biokoridor v km 3,340"
              disabled={isSubmitting}
            />
            <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
              Název конкретного моста (опционально, по умолчанию = Bridge ID)
            </small>
          </label>
        </div>

        <h3>Volitelné parametry:</h3>

        <div className="form-row">
          <label>
            Délka pole (m)
            <input
              type="number"
              step="0.01"
              value={spanLength}
              onChange={(e) => setSpanLength(e.target.value)}
              placeholder="například: 25.5"
              disabled={isSubmitting}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Šířka mostovky (m)
            <input
              type="number"
              step="0.01"
              value={deckWidth}
              onChange={(e) => setDeckWidth(e.target.value)}
              placeholder="například: 12.0"
              disabled={isSubmitting}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            PD týdny
            <input
              type="number"
              step="0.01"
              value={pdWeeks}
              onChange={(e) => setPdWeeks(e.target.value)}
              placeholder="například: 4.0"
              disabled={isSubmitting}
            />
          </label>
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        <div className="form-actions">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? 'Vytváření...' : 'Vytvořit most'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={isSubmitting} className="btn-secondary">
              Zrušit
            </button>
          )}
        </div>
      </form>

      <style>{`
        .create-bridge-form {
          max-width: 500px;
          margin: 0 auto;
          padding: 2rem;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .create-bridge-form h2 {
          margin-bottom: 1.5rem;
          color: #333;
        }

        .create-bridge-form h3 {
          margin-top: 2rem;
          margin-bottom: 1rem;
          font-size: 1rem;
          color: #666;
        }

        .form-row {
          margin-bottom: 1.5rem;
        }

        .form-row label {
          display: block;
          font-weight: 500;
          margin-bottom: 0.5rem;
          color: #333;
        }

        .form-row input {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
          transition: border-color 0.2s;
          background: #FFA726; /* Orange input cells */
          color: #000;
        }

        .form-row input:required {
          background: #FFA726; /* Orange for required fields */
        }

        .form-row input:not(:required) {
          background: #f5f5f5; /* Gray for optional fields */
        }

        .form-row input:focus {
          outline: none;
          border-color: #FFA726;
        }

        .form-row input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .error-message {
          padding: 1rem;
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 4px;
          color: #c00;
          margin-bottom: 1rem;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
        }

        .btn-primary,
        .btn-secondary {
          flex: 1;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #4CAF50;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #45a049;
        }

        .btn-secondary {
          background: #9e9e9e;
          color: white;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #757575;
        }

        .btn-primary:disabled,
        .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
