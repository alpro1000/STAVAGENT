/**
 * CreateMonolithForm - VARIANT 1 (Single Object Type)
 * Simple universal form for creating all object types
 * User describes type in the object_name field (e.g., "Мост через реку", "Офисное здание")
 */

import { useState } from 'react';
import { useBridges } from '../hooks/useBridges';

interface CreateMonolithFormProps {
  onSuccess: (project_id: string) => void;
  onCancel?: () => void;
}

export default function CreateMonolithForm({ onSuccess, onCancel }: CreateMonolithFormProps) {
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [objectName, setObjectName] = useState('');
  const [description, setDescription] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { createBridge } = useBridges();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedId = projectId.trim();

    if (!trimmedId) {
      setError('Číslo projektu je povinné');
      return;
    }

    // Validate project_id - no slashes or special URL characters
    if (/[\/\\?#%]/.test(trimmedId)) {
      setError('Číslo projektu nesmí obsahovat znaky: / \\ ? # %');
      return;
    }

    setIsSubmitting(true);

    try {
      // VARIANT 1: Simple object creation - user describes type in object_name
      await createBridge({
        project_id: trimmedId,
        project_name: projectName.trim() || undefined,
        object_name: objectName.trim() || trimmedId,
        description: description.trim() || undefined
      });

      onSuccess(trimmedId);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Chyba při vytváření objektu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-monolith-form">
      <h2>➕ Vytvořit nový objekt</h2>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Project ID (required) */}
        <div className="form-row">
          <label>
            Číslo projektu (Project ID) *
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="např: SO201, SO202..."
              required
              disabled={isSubmitting}
              autoFocus
            />
            <small style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
              Jedinečný identifikátor projektu
            </small>
          </label>
        </div>

        {/* Project Name */}
        <div className="form-row">
          <label>
            Stavba (Project Name)
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="např: D6 Žalmanov – Knínice"
              disabled={isSubmitting}
            />
            <small style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
              Název nadřazeného projektu (opcionálně)
            </small>
          </label>
        </div>

        {/* Object Name - user describes type here */}
        <div className="form-row">
          <label>
            Popis objektu *
            <input
              type="text"
              value={objectName}
              onChange={(e) => setObjectName(e.target.value)}
              placeholder="např: Mост через реку, Ofisní budova, Parkoviště..."
              disabled={isSubmitting}
            />
            <small style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
              Popis co přesně budujete (mост, budova, parkoviště, komunikace, atd.)
            </small>
          </label>
        </div>

        {/* Description */}
        <div className="form-row">
          <label>
            Poznámka
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Další informace o projektu..."
              disabled={isSubmitting}
              rows={3}
              style={{ fontFamily: 'monospace', resize: 'vertical' }}
            />
          </label>
        </div>

        {/* Form buttons */}
        <div className="form-buttons">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
          >
            {isSubmitting ? 'Vytváření...' : '✅ Vytvořit objekt'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="btn-secondary"
            >
              ❌ Zrušit
            </button>
          )}
        </div>
      </form>

      <style>{`
        .create-monolith-form {
          max-width: 600px;
          margin: 0 auto;
          padding: 2rem;
          background: var(--bg-secondary);
          border-radius: 8px;
          box-shadow: var(--shadow-lg);
        }

        .create-monolith-form h2 {
          margin-bottom: 1.5rem;
          color: var(--text-primary);
          font-size: 1.5rem;
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

        .form-row input,
        .form-row textarea {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid var(--input-border);
          border-radius: 4px;
          font-size: 1rem;
          transition: border-color 0.2s;
          background: var(--input-bg);
          color: var(--text-primary);
        }

        .form-row input:focus,
        .form-row textarea:focus {
          outline: none;
          border-color: var(--input-focus);
          box-shadow: 0 0 0 3px rgba(255, 112, 67, 0.2);
        }

        .form-row input:disabled,
        .form-row textarea:disabled {
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

        .form-buttons {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
        }

        .form-buttons .btn-primary,
        .form-buttons .btn-secondary {
          flex: 1;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .form-buttons .btn-primary {
          background: var(--color-success);
          color: var(--bg-secondary);
        }

        .form-buttons .btn-primary:hover:not(:disabled) {
          background: var(--accent-hover);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .form-buttons .btn-secondary {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border-default);
        }

        .form-buttons .btn-secondary:hover:not(:disabled) {
          background: var(--bg-dark);
          transform: translateY(-2px);
        }

        .form-buttons .btn-primary:disabled,
        .form-buttons .btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
      `}</style>
    </div>
  );
}
