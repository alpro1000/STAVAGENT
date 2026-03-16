/**
 * DeleteProjectModal - Confirmation dialog for entire project deletion
 * Deletes ALL objects within a project (grouped by project_name)
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  projectName: string | null;
  objectCount: number;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export default function DeleteProjectModal({
  projectName,
  objectCount,
  isOpen,
  onConfirm,
  onCancel,
  isDeleting = false
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleEsc); document.body.style.overflow = ''; };
  }, [isOpen, onCancel]);

  if (!isOpen || !projectName) return null;

  const modalContent = (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Smazat projekt">
      <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header delete-header">
          <h2>⚠️ Smazat celý projekt?</h2>
          <button className="btn-close" onClick={onCancel} title="Zavřít">✕</button>
        </div>

        <div className="modal-body">
          <div className="delete-warning">
            <p className="delete-main-text">
              Opravdu chcete smazat projekt <strong>„{projectName}"</strong>?
            </p>
            <p className="delete-sub-text">
              Projekt obsahuje {objectCount} {objectCount === 1 ? 'objekt' : objectCount < 5 ? 'objekty' : 'objektů'}
            </p>
          </div>

          <div className="delete-impacts">
            <p className="delete-impacts-title">Tato akce smaže:</p>
            <ul className="delete-impacts-list">
              <li>✓ Všechny objekty v projektu ({objectCount} ks)</li>
              <li>✓ Všechny pozice ve všech objektech</li>
              <li>✓ Všechny snapshoty</li>
              <li>✓ Všechny exporty</li>
            </ul>
          </div>

          <div className="delete-final-warning">
            ⚠️ <strong>Tuto akci nelze vrátit!</strong>
          </div>
        </div>

        <div className="modal-footer delete-footer">
          <button
            className="btn-secondary"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Zrušit
          </button>
          <button
            className="btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? '🗑️ Mažu...' : '🗑️ Smazat celý projekt'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
