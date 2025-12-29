/**
 * CreateMonolithForm - VARIANT 1 (Single Object Type)
 * Simple universal form for creating all object types
 * User describes type in the object_name field (e.g., "Мост через реку", "Офисное здание")
 */

import { useState, useMemo } from 'react';
import { useBridges } from '../hooks/useBridges';

interface CreateMonolithFormProps {
  onSuccess: (project_id: string) => void;
  onCancel?: () => void;
}

export default function CreateMonolithForm({ onSuccess, onCancel }: CreateMonolithFormProps) {
  // Get bridges directly from query (not context) to ensure fresh data
  const { data: bridges = [], createBridge } = useBridges();
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [objectName, setObjectName] = useState('');
  const [description, setDescription] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

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
  const getFinalProjectName = () => {
    if (selectedProject && selectedProject !== '__new__') {
      return selectedProject;
    }
    return projectName.trim() || undefined;
  };

  const handleProjectSelectChange = (value: string) => {
    setSelectedProject(value);
    if (value && value !== '__new__') {
      setProjectName(value);
    } else {
      setProjectName('');
    }
  };

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
        project_name: getFinalProjectName(),
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
            Číslo objektu (Object ID) *
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
            Jedinečný identifikátor objektu
          </small>
        </div>

        {/* Project Name - Select existing or create new */}
        <div className="u-mb-lg">
          <label className="u-text-bold u-mb-sm" style={{ display: 'block', fontSize: 'var(--font-size-sm)' }}>
            Stavba (Project)
          </label>

          {existingProjects.length > 0 ? (
            <>
              <select
                className="c-select"
                value={selectedProject}
                onChange={(e) => handleProjectSelectChange(e.target.value)}
                disabled={isSubmitting}
                style={{ width: '100%', marginBottom: 'var(--space-sm)' }}
              >
                <option value="">-- Vyberte existující projekt --</option>
                {existingProjects.map(project => (
                  <option key={project} value={project}>
                    📁 {project}
                  </option>
                ))}
                <option value="__new__">➕ Vytvořit nový projekt...</option>
              </select>

              {selectedProject === '__new__' && (
                <input
                  type="text"
                  className="c-input"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Název nového projektu..."
                  disabled={isSubmitting}
                />
              )}

              <small className="u-text-muted" style={{ fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Vyberte existující projekt nebo vytvořte nový
              </small>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Object Name - user describes type here */}
        <div className="u-mb-lg">
          <label className="u-text-bold u-mb-sm" style={{ display: 'block', fontSize: 'var(--font-size-sm)' }}>
            Popis objektu
          </label>
          <input
            type="text"
            className="c-input"
            value={objectName}
            onChange={(e) => setObjectName(e.target.value)}
            placeholder="např: Most přes řeku, Kancelářská budova, Parkoviště..."
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
