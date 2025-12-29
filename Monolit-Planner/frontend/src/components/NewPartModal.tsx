/**
 * NewPartModal - Modal for creating new bridge parts with OTSKP search
 * Type 1: Adding NEW bridge elements (ZÁKLADY, ŘÍMSY, etc.) - requires OTSKP code
 */

import { useState } from 'react';
import OtskpAutocomplete from './OtskpAutocomplete';

interface Props {
  onSelect: (code: string, name: string) => void;
  onCancel: () => void;
}

export default function NewPartModal({ onSelect, onCancel }: Props) {
  const [selectedCode, setSelectedCode] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [partName, setPartName] = useState('');

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

  return (
    <div className="new-part-modal-overlay" onClick={onCancel}>
      <div className="new-part-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="new-part-title">Přidat novou část konstrukce</h3>

        <div className="new-part-content">
          <div className="new-part-section">
            <label className="new-part-label">
              1. Vyhledejte OTSKP kód (volitelné):
            </label>
            <OtskpAutocomplete
              value={selectedCode}
              onSelect={handleOtskpSelect}
            />
            <p className="new-part-hint">
              Začněte psát kód nebo název prvku (např. "základ", "opěra", "římsa")
            </p>
          </div>

          {selectedCode && (
            <div className="new-part-selected">
              ✓ Vybrán OTSKP: <strong>{selectedCode}</strong> - {selectedName}
            </div>
          )}

          <div className="new-part-section">
            <label className="new-part-label">
              2. Název části konstrukce:
            </label>
            <input
              type="text"
              className="new-part-input"
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              placeholder="např. ZÁKLADY ZE ŽELEZOBETONU DO C30/37"
              autoFocus
            />
            <p className="new-part-hint">
              Přesný název prvku podle projektové dokumentace
            </p>
          </div>
        </div>

        <div className="new-part-actions">
          <button className="btn-cancel-new-part" onClick={onCancel}>
            Zrušit
          </button>
          <button
            className="btn-create-new-part"
            onClick={handleCreate}
            disabled={!partName.trim()}
          >
            ✓ Vytvořit část
          </button>
        </div>
      </div>

      <style>{`
        .new-part-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .new-part-modal {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 2rem;
          max-width: 600px;
          width: 90%;
          box-shadow: var(--shadow-xl);
          animation: slideUp 0.3s ease;
          max-height: 90vh;
          overflow: visible;
          display: flex;
          flex-direction: column;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .new-part-title {
          margin: 0 0 1.5rem 0;
          font-size: 1.5rem;
          color: var(--text-primary);
          text-align: center;
        }

        .new-part-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .new-part-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        /* Expand OTSKP autocomplete to full width inside modal */
        .new-part-section .otskp-autocomplete-container {
          max-width: 100%;
        }

        .new-part-label {
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        .new-part-input {
          width: 100%;
          padding: 0.75rem;
          font-size: 1rem;
          border: 2px solid var(--border-default);
          border-radius: 6px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          transition: all 0.2s ease;
        }

        .new-part-input:focus {
          outline: none;
          border-color: var(--color-primary);
          background: var(--bg-secondary);
        }

        .new-part-hint {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0;
          font-style: italic;
        }

        .new-part-selected {
          padding: 0.75rem;
          background: rgba(76, 175, 80, 0.1);
          border: 1px solid var(--color-success);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .new-part-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }

        .btn-cancel-new-part {
          padding: 0.75rem 1.5rem;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-default);
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-cancel-new-part:hover {
          background: var(--bg-dark);
          border-color: var(--border-hover);
        }

        .btn-create-new-part {
          padding: 0.75rem 1.5rem;
          background: var(--color-primary);
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-create-new-part:hover:not(:disabled) {
          background: var(--color-primary-dark);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(63, 81, 181, 0.3);
        }

        .btn-create-new-part:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Mobile responsive */
        @media (max-width: 480px) {
          .new-part-modal {
            padding: 1.5rem;
            width: 95%;
          }

          .new-part-title {
            font-size: 1.25rem;
          }

          .new-part-actions {
            flex-direction: column;
          }

          .btn-cancel-new-part,
          .btn-create-new-part {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
