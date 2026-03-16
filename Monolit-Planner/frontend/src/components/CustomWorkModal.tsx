/**
 * CustomWorkModal - Modal for custom work input ("Jiné" type)
 * Allows user to enter custom work name and unit of measurement
 * Design: Slate Minimal (shared .modal-overlay / .modal-content)
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Unit } from '@stavagent/monolit-shared';

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

  const handleCreate = () => {
    if (!itemName.trim()) {
      alert('Zadejte název práce');
      return;
    }

    const finalUnit = isCustomUnit ? (customUnit.trim() || 'ks') : unit;
    onSelect(itemName, finalUnit as Unit);
  };

  const selectedUnit = isCustomUnit ? customUnit : unit;

  const modalContent = (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Přidat vlastní práci">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2>Přidat vlastní práci</h2>
          <button className="btn-close" onClick={onCancel} title="Zavřít">✕</button>
        </div>

        <div className="modal-body">
          {/* Work name input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Název práce: *
            </label>
            <input
              type="text"
              className="slate-input"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="např. Kontrola betonu, Údržba lešení, Odvoz materiálu"
              autoFocus
              style={{ width: '100%' }}
            />
          </div>

          {/* Unit selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Jednotka měření: *
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {COMMON_UNITS.map((u) => (
                <button
                  key={u}
                  className={`btn-secondary ${!isCustomUnit && unit === u ? 'btn-primary' : ''}`}
                  onClick={() => { setUnit(u); setIsCustomUnit(false); }}
                  type="button"
                  style={{ padding: '6px 16px', fontSize: '14px' }}
                >
                  {u}
                </button>
              ))}
              <button
                className={`btn-secondary ${isCustomUnit ? 'btn-primary' : ''}`}
                onClick={() => setIsCustomUnit(true)}
                type="button"
                style={{ padding: '6px 16px', fontSize: '14px', minWidth: '80px' }}
              >
                Vlastní
              </button>
            </div>

            {isCustomUnit && (
              <input
                type="text"
                className="slate-input"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                placeholder="např. hod, den, balení"
                maxLength={20}
                style={{ width: '100%', marginTop: '8px' }}
              />
            )}
          </div>

          {/* Preview */}
          <div style={{
            padding: '12px', background: 'var(--bg-tertiary)',
            borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Náhled:</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
              {itemName || '(Název...)'} ({selectedUnit || 'jednotka'})
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>
            Zrušit
          </button>
          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={!itemName.trim()}
          >
            Vytvořit
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
