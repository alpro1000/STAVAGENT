/**
 * DeleteBridgeModal - Confirmation dialog for bridge deletion
 * Uses Portal to render above all other elements
 */

import { useEffect } from 'react';
import { TriangleAlert, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface Bridge {
  bridge_id: string;
  object_name?: string;
  project_name?: string;
  element_count?: number;
}

interface Props {
  bridge: Bridge | null;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export default function DeleteBridgeModal({ bridge, isOpen, onConfirm, onCancel, isDeleting = false }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handleEsc); document.body.style.overflow = ''; };
  }, [isOpen, onCancel]);

  if (!isOpen || !bridge) return null;

  const modalContent = (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Smazat objekt">
      <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header delete-header">
          <h2><TriangleAlert size={18} className="inline" /> Smazat objekt?</h2>
          <button className="btn-close" onClick={onCancel} title="Zavřít"><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="delete-warning">
            <p className="delete-main-text">
              Opravdu chcete smazat objekt <strong>„{bridge.bridge_id}"</strong>?
            </p>
            {bridge.object_name && (
              <p className="delete-sub-text">
                {bridge.object_name}
              </p>
            )}
          </div>

          <div className="delete-impacts">
            <p className="delete-impacts-title">Tato akce smaže:</p>
            <ul className="delete-impacts-list">
              <li>✓ Objekt „{bridge.bridge_id}"</li>
              {bridge.element_count !== undefined && (
                <li>✓ Všechny pozice ({bridge.element_count} ks)</li>
              )}
              <li>✓ Všechny snapshoty</li>
              <li>✓ Všechny exporty</li>
            </ul>
          </div>

          <div className="delete-final-warning">
            <TriangleAlert size={14} className="inline" /> <strong>Tuto akci nelze vrátit!</strong>
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
            {isDeleting ? <><Trash2 size={14} className="inline" /> Mažu...</> : <><Trash2 size={14} className="inline" /> Smazat natrvalo</>}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
