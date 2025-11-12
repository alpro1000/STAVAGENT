/**
 * CustomWorkModal - Modal for custom work input ("Jiné" type)
 * Allows user to enter custom work name and unit of measurement
 */

import { useState } from 'react';
import type { Unit } from '@monolit/shared';

interface Props {
  onSelect: (itemName: string, unit: Unit) => void;
  onCancel: () => void;
}

const COMMON_UNITS: Unit[] = ['ks', 'm2', 'M3', 'kg', 't'];

export default function CustomWorkModal({ onSelect, onCancel }: Props) {
  const [itemName, setItemName] = useState('');
  const [unit, setUnit] = useState<Unit>('ks');
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [customUnit, setCustomUnit] = useState('');

  const handleCreate = () => {
    if (!itemName.trim()) {
      alert('Zadejte název práce');
      return;
    }

    const finalUnit = isCustomUnit ? (customUnit.trim() || 'ks') : unit;
    console.log(`✏️ Custom work created: "${itemName}" (${finalUnit})`);
    onSelect(itemName, finalUnit as Unit);
  };

  const selectedUnit = isCustomUnit ? customUnit : unit;

  return (
    <div className="custom-work-modal-overlay" onClick={onCancel}>
      <div className="custom-work-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="custom-work-title">➕ Přidat vlastní práci</h3>

        <div className="custom-work-content">
          {/* Work name input */}
          <div className="custom-work-section">
            <label className="custom-work-label">
              Název práce: *
            </label>
            <input
              type="text"
              className="custom-work-input"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="např. Kontrola betonu, Údržba lešení, Odvoz materiálu"
              autoFocus
            />
          </div>

          {/* Unit selection */}
          <div className="custom-work-section">
            <label className="custom-work-label">
              Jednotka měření: *
            </label>
            <div className="unit-selector">
              {COMMON_UNITS.map((u) => (
                <button
                  key={u}
                  className={`unit-button ${!isCustomUnit && unit === u ? 'selected' : ''}`}
                  onClick={() => {
                    setUnit(u);
                    setIsCustomUnit(false);
                  }}
                  type="button"
                >
                  {u}
                </button>
              ))}
              <button
                className={`unit-button custom-unit-btn ${isCustomUnit ? 'selected' : ''}`}
                onClick={() => setIsCustomUnit(true)}
                type="button"
              >
                Vlastní
              </button>
            </div>

            {isCustomUnit && (
              <input
                type="text"
                className="custom-unit-input"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                placeholder="např. hod, den, balení"
                maxLength={20}
              />
            )}
          </div>

          {/* Preview */}
          <div className="custom-work-preview">
            <span className="preview-label">Náhled:</span>
            <span className="preview-value">
              {itemName || '(Název...)'} ({selectedUnit || 'jednotka'})
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="custom-work-buttons">
          <button
            className="btn-create-work"
            onClick={handleCreate}
            disabled={!itemName.trim()}
          >
            Vytvořit
          </button>
          <button className="btn-cancel-work" onClick={onCancel}>
            Zrušit
          </button>
        </div>
      </div>

      <style>{`
        .custom-work-modal-overlay {
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

        .custom-work-modal {
          background: var(--bg-secondary);
          border-radius: 12px;
          padding: 2rem;
          max-width: 500px;
          width: 90%;
          box-shadow: var(--shadow-xl);
          animation: slideUp 0.3s ease;
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

        .custom-work-title {
          margin: 0 0 1.5rem 0;
          font-size: 1.5rem;
          color: var(--text-primary);
          text-align: center;
        }

        .custom-work-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .custom-work-section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .custom-work-label {
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        .custom-work-input,
        .custom-unit-input {
          padding: 0.75rem;
          border: 1px solid var(--border-default);
          border-radius: 6px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          font-size: 1rem;
          font-family: inherit;
          transition: all 0.2s ease;
        }

        .custom-work-input:focus,
        .custom-unit-input:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
        }

        .custom-work-input::placeholder {
          color: var(--text-tertiary);
        }

        /* Unit selector */
        .unit-selector {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .unit-button {
          padding: 0.5rem 1rem;
          border: 1px solid var(--border-default);
          border-radius: 6px;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .unit-button:hover {
          border-color: var(--color-primary);
          background: var(--bg-hover);
        }

        .unit-button.selected {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        .custom-unit-btn {
          min-width: 80px;
          text-align: center;
        }

        .custom-unit-input {
          margin-top: 0.5rem;
          width: 100%;
          box-sizing: border-box;
        }

        /* Preview */
        .custom-work-preview {
          padding: 1rem;
          background: var(--bg-tertiary);
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .preview-label {
          color: var(--text-secondary);
          font-size: 0.9rem;
          min-width: 60px;
        }

        .preview-value {
          color: var(--text-primary);
          font-weight: 500;
          font-family: var(--font-mono);
        }

        /* Buttons */
        .custom-work-buttons {
          display: flex;
          gap: 1rem;
        }

        .btn-create-work,
        .btn-cancel-work {
          flex: 1;
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .btn-create-work {
          background: var(--color-success);
          color: white;
        }

        .btn-create-work:hover:not(:disabled) {
          background: var(--color-success-dark);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
        }

        .btn-create-work:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-cancel-work {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          border: 1px solid var(--border-default);
        }

        .btn-cancel-work:hover {
          background: var(--bg-dark);
          border-color: var(--border-hover);
        }

        /* Mobile responsive */
        @media (max-width: 480px) {
          .custom-work-modal {
            padding: 1.5rem;
          }

          .custom-work-title {
            font-size: 1.25rem;
          }

          .unit-selector {
            gap: 0.3rem;
          }

          .unit-button {
            padding: 0.4rem 0.8rem;
            font-size: 0.85rem;
          }

          .custom-work-buttons {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
