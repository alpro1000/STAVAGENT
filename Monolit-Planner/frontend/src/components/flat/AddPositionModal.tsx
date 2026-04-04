/**
 * AddPositionModal — Create a new construction element (position) manually.
 *
 * Fields: Popis, Kód OTSKP, MJ, Množství, Část (part_name).
 * Creates a beton position via POST /api/positions.
 */

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { positionsAPI, otskpAPI, configAPI } from '../../services/api';
import { useUI } from '../../context/UIContext';
import { useProjectPositions } from '../../hooks/useProjectPositions';
import type { OtskpCode } from '@stavagent/monolit-shared';

interface Props {
  onClose: () => void;
}

const UNIT_OPTIONS = [
  { value: 'M3', label: 'm³' },
  { value: 'm2', label: 'm²' },
  { value: 't', label: 't' },
  { value: 'kg', label: 'kg' },
  { value: 'ks', label: 'ks' },
];

export default function AddPositionModal({ onClose }: Props) {
  const { selectedProjectId } = useUI();
  const { positions } = useProjectPositions();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [popis, setPopis] = useState('');
  const [otskpCode, setOtskpCode] = useState('');
  const [unit, setUnit] = useState('M3');
  const [qty, setQty] = useState('');
  const [partName, setPartName] = useState('');
  const [newPartName, setNewPartName] = useState('');

  // OTSKP search
  const [otskpResults, setOtskpResults] = useState<OtskpCode[]>([]);
  const [otskpOpen, setOtskpOpen] = useState(false);

  // Project config for defaults
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => configAPI.get(),
    staleTime: 10 * 60_000,
  });
  const defaultWage = config?.defaults?.DEFAULT_WAGE_CZK_PH ?? 398;
  const defaultShift = config?.defaults?.DEFAULT_SHIFT_HOURS ?? 10;

  // Existing part names from positions
  const existingParts = useMemo(() => {
    const parts = new Set(positions.map(p => p.part_name));
    return Array.from(parts).sort((a, b) => a.localeCompare(b, 'cs'));
  }, [positions]);

  const finalPartName = partName === '__new__' ? newPartName.trim() : (partName || popis);

  // OTSKP debounced search
  const handleOtskpInput = (val: string) => {
    setOtskpCode(val);
    if (val.length < 3) { setOtskpResults([]); setOtskpOpen(false); return; }
    const timer = setTimeout(async () => {
      try {
        const resp = await otskpAPI.search(val, 6);
        setOtskpResults(resp.results || []);
        setOtskpOpen((resp.results || []).length > 0);
      } catch { setOtskpResults([]); }
    }, 300);
    return () => clearTimeout(timer);
  };

  const handleOtskpSelect = (item: OtskpCode) => {
    setOtskpCode(item.code);
    if (!popis) setPopis(item.name);
    if (item.unit) {
      const unitMap: Record<string, string> = { 'm3': 'M3', 'm³': 'M3', 'm2': 'm2', 'm²': 'm2', 't': 't', 'kg': 'kg', 'ks': 'ks' };
      setUnit(unitMap[item.unit.toLowerCase()] || unit);
    }
    setOtskpOpen(false);
  };

  const canSubmit = popis.trim() && finalPartName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedProjectId || submitting) return;
    setSubmitting(true);
    try {
      await positionsAPI.create(selectedProjectId, [{
        bridge_id: selectedProjectId,
        part_name: finalPartName,
        item_name: popis.trim(),
        subtype: 'beton',
        unit: unit as any,
        qty: parseFloat(qty) || 0,
        otskp_code: otskpCode || undefined,
        crew_size: 4,
        wage_czk_ph: defaultWage,
        shift_hours: defaultShift,
        days: 0,
      }]);
      qc.invalidateQueries({ queryKey: ['positions', selectedProjectId] });
      onClose();
    } catch (err) {
      console.error('Failed to create position:', err);
      alert('Nepodařilo se vytvořit pozici.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flat-modal-overlay" onClick={onClose}>
      <div className="flat-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h2 className="flat-modal__title">Přidat pozici</h2>

        <form onSubmit={handleSubmit}>
          {/* Popis */}
          <div className="flat-field">
            <label className="flat-field__label">Popis (název) *</label>
            <input className="flat-field__input" value={popis}
              onChange={e => setPopis(e.target.value)}
              placeholder="ZÁKLADY ZE ŽELEZOBETONU DO C30/37" required />
          </div>

          {/* OTSKP kód */}
          <div className="flat-field" style={{ position: 'relative' }}>
            <label className="flat-field__label">Kód OTSKP</label>
            <input className="flat-field__input" value={otskpCode}
              onChange={e => handleOtskpInput(e.target.value)}
              onFocus={() => { if (otskpResults.length) setOtskpOpen(true); }}
              placeholder="272325" />
            {otskpOpen && otskpResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: 'white', border: '1px solid var(--flat-border)',
                borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                maxHeight: 200, overflowY: 'auto',
              }}>
                {otskpResults.map(item => (
                  <div key={item.code} onClick={() => handleOtskpSelect(item)}
                    style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid var(--flat-border)', fontSize: 12 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--flat-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="flat-mono" style={{ fontWeight: 600, color: 'var(--orange-500)' }}>{item.code}</span>
                      <span className="flat-mono" style={{ color: 'var(--stone-400)', fontSize: 11 }}>
                        {item.unit_price?.toLocaleString('cs-CZ')} Kč/{item.unit}
                      </span>
                    </div>
                    <div style={{ color: 'var(--flat-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MJ + Množství */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="flat-field" style={{ width: 120 }}>
              <label className="flat-field__label">MJ</label>
              <select className="flat-field__select" value={unit} onChange={e => setUnit(e.target.value)}>
                {UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div className="flat-field" style={{ flex: 1 }}>
              <label className="flat-field__label">Množství</label>
              <input className="flat-field__input" type="number" min="0" step="0.1"
                value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
            </div>
          </div>

          {/* Část (part_name) */}
          <div className="flat-field">
            <label className="flat-field__label">Část (part_name)</label>
            <select className="flat-field__select" value={partName}
              onChange={e => setPartName(e.target.value)}>
              <option value="">Stejný jako popis</option>
              {existingParts.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="__new__">+ Nová část...</option>
            </select>
          </div>

          {partName === '__new__' && (
            <div className="flat-field">
              <label className="flat-field__label">Název nové části</label>
              <input className="flat-field__input" value={newPartName}
                onChange={e => setNewPartName(e.target.value)} placeholder="ZÁKLADY" autoFocus />
            </div>
          )}

          <div className="flat-modal__actions">
            <button type="button" className="flat-btn" onClick={onClose}>Zrušit</button>
            <button type="submit" className="flat-btn flat-btn--primary"
              disabled={!canSubmit || submitting}>
              {submitting ? 'Vytvářím...' : 'Přidat pozici'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
