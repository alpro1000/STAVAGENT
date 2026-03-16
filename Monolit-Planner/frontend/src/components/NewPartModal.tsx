/**
 * NewPartModal - Modal for creating new bridge parts with OTSKP search
 * Type 1: Adding NEW bridge elements (ZÁKLADY, ŘÍMSY, etc.) - requires OTSKP code
 * Design: Slate Minimal (shared .modal-overlay / .modal-content)
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import OtskpAutocomplete from './OtskpAutocomplete';

interface Props {
  onSelect: (code: string, name: string) => void;
  onCancel: () => void;
}

export default function NewPartModal({ onSelect, onCancel }: Props) {
  const [selectedCode, setSelectedCode] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [partName, setPartName] = useState('');

  // ESC key handler + body scroll lock
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [onCancel]);

  const handleOtskpSelect = (code: string, name: string) => {
    setSelectedCode(code);
    setSelectedName(name);
    setPartName(name); // Auto-fill part name from OTSKP
  };

  const handleCreate = () => {
    if (!partName.trim()) {
      alert('Zadejte název části konstrukce');
      return;
    }
    onSelect(selectedCode, partName);
  };

  const modalContent = (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Přidat novou část konstrukce">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', overflow: 'visible' }}>
        <div className="modal-header">
          <h2>Přidat novou část konstrukce</h2>
          <button className="btn-close" onClick={onCancel} title="Zavřít">✕</button>
        </div>

        <div className="modal-body" style={{ overflow: 'visible' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
              1. Vyhledejte OTSKP kód (volitelné):
            </label>
            <OtskpAutocomplete
              value={selectedCode}
              onSelect={handleOtskpSelect}
            />
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0', fontStyle: 'italic' }}>
              Začněte psát kód nebo název prvku (např. "základ", "opěra", "římsa")
            </p>
          </div>

          {selectedCode && (
            <div style={{
              padding: '10px 12px', marginBottom: '16px',
              background: 'rgba(76, 175, 80, 0.1)', border: '1px solid var(--color-success)',
              borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px',
            }}>
              ✓ Vybrán OTSKP: <strong>{selectedCode}</strong> - {selectedName}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
              2. Název části konstrukce:
            </label>
            <input
              type="text"
              className="slate-input"
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              placeholder="např. ZÁKLADY ZE ŽELEZOBETONU DO C30/37"
              autoFocus
              style={{ width: '100%' }}
            />
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0', fontStyle: 'italic' }}>
              Přesný název prvku podle projektové dokumentace
            </p>
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-secondary" onClick={onCancel}>
            Zrušit
          </button>
          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={!partName.trim()}
          >
            ✓ Vytvořit část
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
