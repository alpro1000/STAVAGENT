/**
 * RenameProjectModal - Dialog for renaming a project
 * Renames project_name for ALL objects within the project group
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  projectName: string | null;
  isOpen: boolean;
  onConfirm: (newName: string) => void;
  onCancel: () => void;
  isRenaming?: boolean;
}

export default function RenameProjectModal({
  projectName,
  isOpen,
  onConfirm,
  onCancel,
  isRenaming = false
}: Props) {
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && projectName) {
      setNewName(projectName);
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [isOpen, projectName]);

  if (!isOpen || !projectName) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (trimmed && trimmed !== projectName) {
      onConfirm(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const modalContent = (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div className="modal-header">
          <h2>Přejmenovat projekt</h2>
          <button className="btn-close" onClick={onCancel} title="Zavřít">✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              Nový název projektu:
            </label>
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="c-input"
              style={{ width: '100%', padding: '8px 12px', fontSize: '14px' }}
              placeholder="Zadejte název projektu"
              autoFocus
              disabled={isRenaming}
            />
          </div>

          <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
              disabled={isRenaming}
            >
              Zrušit
            </button>
            <button
              type="submit"
              className="c-btn c-btn--primary"
              disabled={isRenaming || !newName.trim() || newName.trim() === projectName}
            >
              {isRenaming ? 'Ukládám...' : 'Přejmenovat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
