/**
 * CreateObjectModal — Modal for creating a new construction object.
 *
 * Fields: Stavba (project), Číslo objektu, Popis, Poznámka.
 * Object type is determined automatically (not selected by user).
 */

import { useState, useMemo } from 'react';
import { v4 as uuid } from 'uuid';
import { useProjects } from '../../hooks/useProjects';
import { useUI } from '../../context/UIContext';

interface Props {
  onClose: () => void;
}

export default function CreateObjectModal({ onClose }: Props) {
  const { projects, createProject } = useProjects();
  const { selectProject } = useUI();

  const [projectName, setProjectName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [objectNumber, setObjectNumber] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Unique existing project names for dropdown
  const existingProjects = useMemo(() => {
    const names = new Set<string>();
    projects.forEach(p => { if (p.project_name) names.add(p.project_name); });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'cs'));
  }, [projects]);

  const isNewProject = projectName === '__new__';
  const finalProjectName = isNewProject ? newProjectName.trim() : projectName;
  const objectName = [objectNumber, description].filter(Boolean).join(' - ');
  const canSubmit = objectNumber.trim() && finalProjectName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      const id = uuid();
      await createProject({
        project_id: id,
        project_name: finalProjectName || undefined,
        object_name: objectName || objectNumber,
        description: note || undefined,
      });
      selectProject(id);
      onClose();
    } catch (err) {
      console.error('Failed to create object:', err);
      alert('Nepodařilo se vytvořit objekt.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flat-modal-overlay" onClick={onClose}>
      <div className="flat-modal" onClick={e => e.stopPropagation()}>
        <h2 className="flat-modal__title">Vytvořit nový objekt</h2>

        <form onSubmit={handleSubmit}>
          {/* Stavba (project) */}
          <div className="flat-field">
            <label className="flat-field__label">Stavba (Projekt)</label>
            <select
              className="flat-field__select"
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
            >
              <option value="">Bez projektu</option>
              {existingProjects.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
              <option value="__new__">+ Nový projekt...</option>
            </select>
          </div>

          {isNewProject && (
            <div className="flat-field">
              <label className="flat-field__label">Název nového projektu</label>
              <input
                className="flat-field__input"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                placeholder="D6 Žalmanov – Knínice"
                autoFocus
              />
            </div>
          )}

          {/* Číslo objektu */}
          <div className="flat-field">
            <label className="flat-field__label">Číslo objektu *</label>
            <input
              className="flat-field__input"
              value={objectNumber}
              onChange={e => setObjectNumber(e.target.value)}
              placeholder="SO-201"
              required
            />
          </div>

          {/* Popis objektu */}
          <div className="flat-field">
            <label className="flat-field__label">Popis objektu</label>
            <input
              className="flat-field__input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Most přes řeku, Opěra 1, Pilíř P2..."
            />
          </div>

          {/* Poznámka */}
          <div className="flat-field">
            <label className="flat-field__label">Poznámka</label>
            <input
              className="flat-field__input"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Volný text..."
            />
          </div>

          <div className="flat-modal__actions">
            <button type="button" className="flat-btn" onClick={onClose}>
              Zrušit
            </button>
            <button
              type="submit"
              className="flat-btn flat-btn--primary"
              disabled={!canSubmit || submitting}
            >
              {submitting ? 'Vytvářím...' : 'Vytvořit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
