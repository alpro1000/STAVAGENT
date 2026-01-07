/**
 * CreateMonolithForm - VARIANT 1 (Single Object Type)
 * Simple universal form for creating all object types
 * User describes type in the object_name field (e.g., "Мост через реку", "Офисное здание")
 *
 * TERMINOLOGY:
 * - Stavba (Project) = project_name = группа объектов ("D6 Žalmanov – Knínice")
 * - Objekt = bridge_id + object_name = конкретный объект ("SO201", "Most přes řeku")
 */

import { useState, useMemo, useEffect } from 'react';
import { useBridges } from '../hooks/useBridges';

interface CreateMonolithFormProps {
  onSuccess: (bridgeId: string) => void;
  onCancel?: () => void;
  preselectedProject?: string; // If set, the form will create object in this project
}

export default function CreateMonolithForm({ onSuccess, onCancel, preselectedProject }: CreateMonolithFormProps) {
  // Get bridges directly from query (not context) to ensure fresh data
  const { data: bridges = [], createBridge } = useBridges();

  // Form state - clear naming
  const [bridgeId, setBridgeId] = useState('');           // ID объекта (SO201, SO202)
  const [selectedProject, setSelectedProject] = useState(''); // Выбранный существующий проект
  const [newProjectName, setNewProjectName] = useState('');   // Новое название проекта
  const [objectName, setObjectName] = useState('');           // Описание объекта
  const [description, setDescription] = useState('');         // Доп. заметки

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-select preselected project on mount
  useEffect(() => {
    if (preselectedProject) {
      setSelectedProject(preselectedProject);
    }
  }, [preselectedProject]);

  // Extract unique project names from existing bridges
  const existingProjects = useMemo(() => {
    const projects = new Map<string, string>();
    bridges.forEach(bridge => {
      if (bridge.project_name) {
        projects.set(bridge.project_name, bridge.project_name);
      }
    });
    return Array.from(projects.values()).sort();
  }, [bridges]);

  // Determine final project name
  const getFinalProjectName = (): string | undefined => {
    if (selectedProject && selectedProject !== '__new__') {
      return selectedProject;
    }
    return newProjectName.trim() || undefined;
  };

  const handleProjectSelectChange = (value: string) => {
    setSelectedProject(value);
    if (value !== '__new__') {
      setNewProjectName('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedBridgeId = bridgeId.trim();

    if (!trimmedBridgeId) {
      setError('Číslo objektu je povinné');
      return;
    }

    // Validate bridge_id - no slashes or special URL characters
    if (/[\/\\?#%]/.test(trimmedBridgeId)) {
      setError('Číslo objektu nesmí obsahovat znaky: / \\ ? # %');
      return;
    }

    setIsSubmitting(true);

    try {
      // API expects project_id (historical naming), but it's actually bridge_id
      await createBridge({
        project_id: trimmedBridgeId,
        project_name: getFinalProjectName(),
        object_name: objectName.trim() || trimmedBridgeId,
        description: description.trim() || undefined
      });

      onSuccess(trimmedBridgeId);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Chyba při vytváření objektu');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="c-panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 className="u-text-orange u-mb-lg" style={{ fontSize: 'var(--font-size-xl)' }}>
        ➕ {preselectedProject ? 'Přidat objekt do projektu' : 'Vytvořit nový objekt'}
      </h2>

      {error && (
        <div className="c-badge--error u-mb-md" style={{ padding: 'var(--space-md)', display: 'block', background: 'rgba(244, 67, 54, 0.1)' }}>
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 1. Stavba (Project) - Select existing or create new - FIRST */}
        <div className="u-mb-lg">
          <label className="u-text-bold u-mb-sm" style={{ display: 'block', fontSize: 'var(--font-size-sm)' }}>
            📁 Stavba (Project)
          </label>

          {preselectedProject ? (
            // Read-only mode - project is preselected
            <div
              className="c-input"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                cursor: 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📁 {preselectedProject}
            </div>
          ) : existingProjects.length > 0 ? (
            <>
              <select
                className="c-select"
                value={selectedProject}
                onChange={(e) => handleProjectSelectChange(e.target.value)}
                disabled={isSubmitting}
                style={{ width: '100%', marginBottom: 'var(--space-sm)' }}
              >
                <option value="">-- Vyberte stavbu nebo vytvořte novou --</option>
                {existingProjects.map(project => (
                  <option key={project} value={project}>
                    📁 {project}
                  </option>
                ))}
                <option value="__new__">➕ Nová stavba...</option>
              </select>

              {selectedProject === '__new__' && (
                <input
                  type="text"
                  className="c-input"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Název nové stavby..."
                  disabled={isSubmitting}
                />
              )}

              <small className="u-text-muted" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Stavba = skupina objektů (např. "D6 Žalmanov – Knínice")
              </small>
            </>
          ) : (
            <>
              <input
                type="text"
                className="c-input"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="např: D6 Žalmanov – Knínice"
                disabled={isSubmitting}
              />
              <small className="u-text-muted" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Stavba = skupina objektů (volitelné)
              </small>
            </>
          )}
        </div>

        {/* 2. Číslo objektu (Bridge ID) - SECOND */}
        <div className="u-mb-lg">
          <label className="u-text-bold u-mb-sm" style={{ display: 'block', fontSize: 'var(--font-size-sm)' }}>
            🏗️ Číslo objektu *
          </label>
          <input
            type="text"
            className="c-input c-input--code"
            value={bridgeId}
            onChange={(e) => setBridgeId(e.target.value)}
            placeholder="např: SO201, SO202, SO301..."
            required
            disabled={isSubmitting}
            autoFocus
          />
          <small className="u-text-muted" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>
            Jedinečný identifikátor objektu v rámci stavby
          </small>
        </div>

        {/* 3. Popis objektu (Object Name) - THIRD */}
        <div className="u-mb-lg">
          <label className="u-text-bold u-mb-sm" style={{ display: 'block', fontSize: 'var(--font-size-sm)' }}>
            📝 Popis objektu
          </label>
          <input
            type="text"
            className="c-input"
            value={objectName}
            onChange={(e) => setObjectName(e.target.value)}
            placeholder="např: Most přes řeku, Opěra 1, Pilíř P2..."
            disabled={isSubmitting}
          />
          <small className="u-text-muted" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>
            Krátký popis co stavíte (most, pilíř, opěra, budova...)
          </small>
        </div>

        {/* 4. Poznámka (Description) - FOURTH */}
        <div className="u-mb-lg">
          <label className="u-text-bold u-mb-sm" style={{ display: 'block', fontSize: 'var(--font-size-sm)' }}>
            💬 Poznámka
          </label>
          <textarea
            className="c-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Další informace..."
            disabled={isSubmitting}
            rows={2}
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
