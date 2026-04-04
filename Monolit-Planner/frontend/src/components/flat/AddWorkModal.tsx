/**
 * AddWorkModal — Add work type to an element.
 *
 * Section 1: Standard work types (only those not yet in element)
 * Section 2: Custom work (free text + unit)
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { positionsAPI } from '../../services/api';
import { useUI } from '../../context/UIContext';
import type { Subtype } from '@stavagent/monolit-shared';

interface Props {
  partName: string;
  existingSubtypes: Subtype[];
  onClose: () => void;
}

const STANDARD_WORKS: { subtype: Subtype; label: string; unit: string }[] = [
  { subtype: 'bednění', label: 'Bednění', unit: 'm2' },
  { subtype: 'odbednění', label: 'Odbednění', unit: 'm2' },
  { subtype: 'výztuž', label: 'Výztuž', unit: 't' },
];

const UNIT_OPTIONS = ['m3', 'm2', 't', 'kg', 'ks', 'bm', 'hod', 'den', 'kpl'];

export default function AddWorkModal({ partName, existingSubtypes, onClose }: Props) {
  const { selectedProjectId } = useUI();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  // Custom work fields
  const [customName, setCustomName] = useState('');
  const [customUnit, setCustomUnit] = useState('m2');
  const [customQty, setCustomQty] = useState('');

  const availableStandard = STANDARD_WORKS.filter(
    w => !existingSubtypes.includes(w.subtype)
  );

  const addWork = async (subtype: Subtype, itemName: string, unit: string, qty: number) => {
    if (!selectedProjectId) return;
    setSubmitting(true);
    try {
      await positionsAPI.create(selectedProjectId, [{
        bridge_id: selectedProjectId,
        part_name: partName,
        subtype,
        item_name: itemName,
        unit: unit as any,
        qty,
        crew_size: 4,
        wage_czk_ph: 398,
        shift_hours: 10,
        days: 0,
      }]);
      qc.invalidateQueries({ queryKey: ['positions', selectedProjectId] });
      onClose();
    } catch (err) {
      console.error('Failed to add work:', err);
      alert('Nepodařilo se přidat práci.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStandard = (w: typeof STANDARD_WORKS[0]) => {
    addWork(w.subtype, w.label, w.unit, 0);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    addWork('jiné', customName.trim(), customUnit, parseFloat(customQty) || 0);
  };

  return (
    <div className="flat-modal-overlay" onClick={onClose}>
      <div className="flat-modal" onClick={e => e.stopPropagation()}>
        <h2 className="flat-modal__title">Přidat práci — {partName}</h2>

        {/* Section 1: Standard works */}
        {availableStandard.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--flat-text-label)', marginBottom: 8, textTransform: 'uppercase' }}>
              Standardní práce
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {availableStandard.map(w => (
                <button
                  key={w.subtype}
                  className="flat-btn"
                  onClick={() => handleAddStandard(w)}
                  disabled={submitting}
                >
                  {w.label} ({w.unit === 'm2' ? 'm²' : w.unit})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        {availableStandard.length > 0 && (
          <div style={{ borderTop: '1px solid var(--flat-border)', margin: '12px 0' }} />
        )}

        {/* Section 2: Custom work */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--flat-text-label)', marginBottom: 8, textTransform: 'uppercase' }}>
            Vlastní práce
          </div>
          <form onSubmit={handleAddCustom}>
            <div className="flat-field">
              <label className="flat-field__label">Název práce</label>
              <input
                className="flat-field__input"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="Např. Hydroizolace, Nátěr..."
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="flat-field" style={{ flex: 1 }}>
                <label className="flat-field__label">Jednotka MJ</label>
                <select
                  className="flat-field__select"
                  value={customUnit}
                  onChange={e => setCustomUnit(e.target.value)}
                >
                  {UNIT_OPTIONS.map(u => (
                    <option key={u} value={u}>{u === 'm2' ? 'm²' : u === 'm3' ? 'm³' : u}</option>
                  ))}
                </select>
              </div>
              <div className="flat-field" style={{ flex: 1 }}>
                <label className="flat-field__label">Množství (nepovinné)</label>
                <input
                  className="flat-field__input"
                  type="number"
                  value={customQty}
                  onChange={e => setCustomQty(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flat-modal__actions">
              <button type="button" className="flat-btn" onClick={onClose}>Zrušit</button>
              <button
                type="submit"
                className="flat-btn flat-btn--primary"
                disabled={!customName.trim() || submitting}
              >
                {submitting ? 'Přidávám...' : 'Přidat'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
