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
    <div className="c-panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 className="u-text-orange u-mb-lg" style={{ fontSize: 'var(--font-size-xl)' }}>➕ Vytvořit nový objekt</h2>

      {error && (
        <div className="c-badge--error u-mb-md" style={{ padding: 'var(--space-md)', display: 'block', background: 'rgba(244, 67, 54, 0.1)' }}>
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Project ID (required) */}
        <div className="u-mb-lg">
          <label className="u-text-bold u-mb-sm" style={{ display: 'block', fontSize: 'var(--font-size-sm)' }}>
            Číslo projektu (Project ID) *
          </label>
          <input
            type="text"
            className="c-input c-input--code"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="např: SO201, SO202..."
            required
            disabled={isSubmitting}
            autoFocus
          />
          <small className="u-text-muted" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>
            Jedinečný identifikátor projektu
          </small>
        </div>

        {/* Project Name */}
        <div className="u-mb-lg">
          <label className="u-text-bold u-mb-sm" style={{ display: 'block', fontSize: 'var(--font-size-sm)' }}>
            Stavba (Project Name)
          </label>
          <input
            type="text"
            className="c-input"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="např: D6 Žalmanov – Knínice"
            disabled={isSubmitting}
          />
          <small className="u-text-muted" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>
            Název nadřazeného projektu (opcionálně)
          </small>
        </div>

        {/* Object Name - user describes type here */}
        <div className="u-mb-lg">
          <label className="u-text-bold u-mb-sm" style={{ display: 'block', fontSize: 'var(--font-size-sm)' }}>
            Popis objektu *
          </label>
          <input
            type="text"
            className="c-input"
            value={objectName}
            onChange={(e) => setObjectName(e.target.value)}
            placeholder="např: Most přes řeku, Ofisní budova, Parkoviště..."
            disabled={isSubmitting}
          />
          <small className="u-text-muted" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>
            Popis co přesně budujete (most, budova, parkoviště, komunikace, atd.)
          </small>
        </div>

        {/* Description */}
        <div className="u-mb-lg">
          <label className="u-text-bold u-mb-sm" style={{ display: 'block', fontSize: 'var(--font-size-sm)' }}>
            Poznámka
          </label>
          <textarea
            className="c-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Další informace o projektu..."
            disabled={isSubmitting}
            rows={3}
            style={{ fontFamily: 'var(--font-mono)', resize: 'vertical' }}
          />
        </div>

        {/* Form buttons */}
        <div className="u-flex u-gap-md u-mt-xl">
          <button
            type="submit"
            disabled={isSubmitting}
            className="c-btn c-btn--success"
            style={{ flex: 1 }}
          >
            {isSubmitting ? 'Vytváření...' : '✅ Vytvořit objekt'}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="c-btn"
              style={{ flex: 1 }}
            >
              ❌ Zrušit
            </button>
          )}
        </div>
      </form>

    </div>
  );
}
