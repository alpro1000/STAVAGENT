/**
 * EditBridgeForm - Edit existing bridge metadata
 * Allows updating: object_name, span_length_m, deck_width_m, pd_weeks, concrete_m3
 */

import { useState, useEffect } from 'react';
import { bridgesAPI } from '../services/api';
import type { Bridge } from '../../../shared/src/types';

interface EditBridgeFormProps {
  bridge: Bridge;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function EditBridgeForm({ bridge, onSuccess, onCancel }: EditBridgeFormProps) {
  const [objectName, setObjectName] = useState(bridge.object_name || '');
  const [spanLength, setSpanLength] = useState(bridge.span_length_m?.toString() || '');
  const [deckWidth, setDeckWidth] = useState(bridge.deck_width_m?.toString() || '');
  const [pdWeeks, setPdWeeks] = useState(bridge.pd_weeks?.toString() || '');
  const [concreteM3, setConcreteM3] = useState(bridge.concrete_m3?.toString() || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Update form if bridge prop changes
    setObjectName(bridge.object_name || '');
    setSpanLength(bridge.span_length_m?.toString() || '');
    setDeckWidth(bridge.deck_width_m?.toString() || '');
    setPdWeeks(bridge.pd_weeks?.toString() || '');
    setConcreteM3(bridge.concrete_m3?.toString() || '');
  }, [bridge]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!objectName.trim()) {
      setError('Název objektu je povinný');
      return;
    }

    setIsSubmitting(true);

    try {
      await bridgesAPI.update(bridge.bridge_id, {
        object_name: objectName.trim(),
        span_length_m: spanLength ? parseFloat(spanLength) : undefined,
        deck_width_m: deckWidth ? parseFloat(deckWidth) : undefined,
        pd_weeks: pdWeeks ? parseFloat(pdWeeks) : undefined,
        concrete_m3: concreteM3 ? parseFloat(concreteM3) : undefined,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Chyba při aktualizaci mostu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="edit-bridge-form">
      <h2>✏️ Upravit most: {bridge.bridge_id}</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Název objektu (Stavba/Objekt) *
            <input
              type="text"
              value={objectName}
              onChange={(e) => setObjectName(e.target.value)}
              placeholder="např: D6 Žalmanov – Knínice, SO 204 - Most přes biokoridor"
              required
              disabled={isSubmitting}
              autoFocus
            />
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
              placeholder="např: 25.5"
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
              placeholder="např: 12.0"
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
              placeholder="např: 4.0"
              disabled={isSubmitting}
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Objem betonu celkem (m³)
            <input
              type="number"
              step="0.01"
              value={concreteM3}
              onChange={(e) => setConcreteM3(e.target.value)}
              placeholder="např: 150.5"
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
            {isSubmitting ? 'Ukládání...' : '💾 Uložit změny'}
          </button>
          <button type="button" onClick={onCancel} disabled={isSubmitting} className="btn-secondary">
            Zrušit
          </button>
        </div>
      </form>

      <style>{`
        .edit-bridge-form {
          max-width: 600px;
          margin: 0 auto;
          padding: 2rem;
          background: var(--bg-secondary);
          border-radius: 8px;
          box-shadow: var(--shadow-lg);
        }

        .edit-bridge-form h2 {
          margin-bottom: 1.5rem;
          color: var(--text-primary);
          font-size: 1.5rem;
        }

        .edit-bridge-form h3 {
          margin-top: 2rem;
          margin-bottom: 1rem;
          font-size: 1rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        .form-row {
          margin-bottom: 1.5rem;
        }

        .form-row label {
          display: block;
          font-weight: 500;
          margin-bottom: 0.5rem;
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .form-row input {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid var(--input-border);
          border-radius: 4px;
          font-size: 1rem;
          transition: border-color 0.2s;
          background: var(--input-bg);
          color: var(--text-primary);
        }

        .form-row input:required {
          background: var(--input-required);
          border-color: #FF9800;
        }

        .form-row input:focus {
          outline: none;
          border-color: var(--input-focus);
          box-shadow: 0 0 0 3px rgba(255, 112, 67, 0.2);
        }

        .form-row input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          background: var(--bg-tertiary);
        }

        .error-message {
          padding: 1rem;
          background: rgba(244, 67, 54, 0.1);
          border: 1px solid rgba(244, 67, 54, 0.3);
          border-radius: 4px;
          color: var(--color-error);
          margin-bottom: 1rem;
          font-weight: 500;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
        }

        .form-actions .btn-primary,
        .form-actions .btn-secondary {
          flex: 1;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .form-actions .btn-primary {
          background: var(--color-success);
          color: var(--bg-secondary);
        }

        .form-actions .btn-primary:hover:not(:disabled) {
          background: var(--accent-hover);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .form-actions .btn-secondary {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border-default);
        }

        .form-actions .btn-secondary:hover:not(:disabled) {
          background: var(--bg-dark);
          transform: translateY(-2px);
        }

        .form-actions .btn-primary:disabled,
        .form-actions .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
}
