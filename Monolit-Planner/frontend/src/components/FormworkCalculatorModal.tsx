/**
 * FormworkCalculatorModal - Kalkulátor pronájmu bednění
 * Modal with a table for calculating formwork rental costs
 * Results are transferred to PositionsTable as "nájem bednění" rows
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sparkles } from 'lucide-react';
import {
  calculateFormworkTacts,
  calculateFormworkTerm,
  calculateMonthlyRentalPerSet,
  calculateFinalRentalCost,
  generateFormworkKrosDescription
} from '@stavagent/monolit-shared';
import type { FormworkCalculatorRow } from '@stavagent/monolit-shared';
import { FORMWORK_SYSTEMS, findFormworkSystem, getDefaultFormworkSystem } from '../constants/formworkSystems';
import FormworkAIModal from './FormworkAIModal';
import { API_URL } from '../services/api';

interface Props {
  bridgeId: string;
  partNames: string[];        // Available part names for linking (future use)
  currentPartName?: string;   // Part that opened the calculator (for display)
  elementTotalDays?: number;  // Total element occupancy days (all work types + curing)
  onTransfer: (rows: FormworkCalculatorRow[]) => void;
  onClose: () => void;
  initialRows?: FormworkCalculatorRow[];
}

function createEmptyRow(bridgeId: string): FormworkCalculatorRow {
  const sys = getDefaultFormworkSystem();
  return {
    id: uuidv4(),
    bridge_id: bridgeId,
    construction_name: '',
    total_area_m2: 0,
    set_area_m2: 0,
    num_tacts: 1,
    num_sets: 1,
    assembly_days_per_tact: 0,
    disassembly_days_per_tact: 0,
    days_per_tact: 0,
    formwork_term_days: 0,
    system_name: sys.name,
    system_height: sys.heights[0] || '',
    rental_czk_per_m2_month: sys.rental_czk_m2_month,
    monthly_rental_per_set: 0,
    final_rental_czk: 0,
    kros_code: '',
    kros_description: ''
  };
}

/** Recalculate dependent fields after any edit
 * @param elementTotalDays - if > 0, use as rental term (total element occupancy)
 * @param forceRecompute - if true, ignore manual overrides (used on crew/shift change)
 *
 * Calculation rules:
 * - assembly/disassembly days: ALWAYS computed from norms (display-only, blue columns)
 * - days_per_tact: computed from norms, BUT user can override manually
 * - formwork_term_days (doba): computed from tacts/sets/daysPerTact, BUT user can override
 * - num_sets > 1: parallel tacts → effective_tacts = ceil(numTacts / numSets)
 *   More sets = faster project (shorter doba), rental cost stays ~same (total set-days ≈ const)
 *
 * Rental formula:
 *   doba = effectiveTacts × daysPerTact
 *   totalRental = numSets × monthlyPerSet × (doba / 30)
 */
function recalcRow(row: FormworkCalculatorRow, crewSize: number, shiftHours: number, elementTotalDays = 0, forceRecompute = false): FormworkCalculatorRow {
  const sys = findFormworkSystem(row.system_name);

  // Assembly/disassembly days from norm (if system selected)
  const assemblyHPerM2 = sys?.assembly_h_m2 || 0.72;
  const disassemblyRatio = sys?.disassembly_ratio || 0.35;

  // Days per tact for assembly: (set_area × norm_h/m²) / (crew × shift)
  const assemblyHours = row.set_area_m2 * assemblyHPerM2;
  const disassemblyHours = assemblyHours * disassemblyRatio;
  const dailyHours = crewSize * shiftHours;

  const assemblyDays = dailyHours > 0 ? assemblyHours / dailyHours : 0;
  const disassemblyDays = dailyHours > 0 ? disassemblyHours / dailyHours : 0;
  const computedDaysPerTact = parseFloat((assemblyDays + disassemblyDays).toFixed(1));

  // Use user's manual days_per_tact if they overrode it; otherwise use computed
  // forceRecompute=true resets to computed (used when crew/shift changes)
  const daysPerTact = (!forceRecompute && row.days_per_tact > 0 && row.days_per_tact !== computedDaysPerTact && row.set_area_m2 > 0)
    ? row.days_per_tact
    : computedDaysPerTact;

  // Tacts: default from area, but user can override
  const autoTacts = calculateFormworkTacts(row.total_area_m2, row.set_area_m2);
  const numTacts = row.num_tacts > 0 ? row.num_tacts : autoTacts;

  // Multiple sets run tacts in parallel: effective tacts = ceil(numTacts / numSets)
  // 1 set, 5 tacts → 5 sequential rounds
  // 2 sets, 5 tacts → 3 rounds (set A: tact 1,3,5 | set B: tact 2,4)
  // 3 sets, 5 tacts → 2 rounds
  const numSets = Math.max(1, row.num_sets || 1);
  const effectiveTacts = Math.ceil(numTacts / numSets);

  // Doba (duration): how long the project needs formwork
  // With elementTotalDays: full element occupancy (includes curing)
  // Without: formwork-only = effectiveTacts × daysPerTact
  const computedTermDays = elementTotalDays > 0
    ? elementTotalDays
    : calculateFormworkTerm(effectiveTacts, daysPerTact);

  // Keep user's manual term override if they set it directly
  const termDays = (!forceRecompute && row.formwork_term_days > 0 && row.formwork_term_days !== computedTermDays && row.set_area_m2 > 0)
    ? row.formwork_term_days
    : computedTermDays;

  // Rental: each set is rented for the full doba period
  // totalRental = numSets × monthlyPerSet × (doba / 30)
  const monthlyPerSet = calculateMonthlyRentalPerSet(row.set_area_m2, row.rental_czk_per_m2_month);
  const finalRental = calculateFinalRentalCost(monthlyPerSet * numSets, termDays);

  const updated: FormworkCalculatorRow = {
    ...row,
    num_tacts: numTacts,
    assembly_days_per_tact: parseFloat(assemblyDays.toFixed(2)),
    disassembly_days_per_tact: parseFloat(disassemblyDays.toFixed(2)),
    days_per_tact: daysPerTact,
    formwork_term_days: termDays,
    monthly_rental_per_set: parseFloat(monthlyPerSet.toFixed(2)),
    final_rental_czk: parseFloat(finalRental.toFixed(2))
  };

  updated.kros_description = generateFormworkKrosDescription(updated);

  return updated;
}

export default function FormworkCalculatorModal({
  bridgeId,
  partNames: _partNames,
  currentPartName: _currentPartName,
  elementTotalDays = 0,
  onTransfer,
  onClose,
  initialRows
}: Props) {
  const [rows, setRows] = useState<FormworkCalculatorRow[]>(
    initialRows && initialRows.length > 0
      ? initialRows
      : [createEmptyRow(bridgeId)]
  );
  const [crewSize, setCrew] = useState(4);
  const [shiftHours, setShift] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  // AI modal state
  const [aiModalRowId, setAiModalRowId] = useState<string | null>(null);

  // Use refs for crew/shift to avoid stale closures in load effect
  const crewRef = useRef(crewSize);
  const shiftRef = useRef(shiftHours);
  crewRef.current = crewSize;
  shiftRef.current = shiftHours;

  // Load saved data on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/formwork-calculator/${bridgeId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.rows && data.rows.length > 0) {
            setRows(data.rows.map((r: FormworkCalculatorRow) => recalcRow(r, crewRef.current, shiftRef.current, elementTotalDays)));
          }
        }
      } catch (err) {
        console.warn('[FormworkCalc] Failed to load saved data:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [bridgeId]);

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => {
      fetch(`${API_URL}/api/formwork-calculator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridge_id: bridgeId, rows })
      }).catch(err => console.warn('[FormworkCalc] Auto-save failed:', err));
    }, 1000);
    return () => clearTimeout(timer);
  }, [rows, bridgeId, isLoading]);

  // Recalc all rows when crew/shift or elementTotalDays changes
  // forceRecompute=true: old days_per_tact was computed with old crew/shift, so reset
  useEffect(() => {
    setRows(prev => prev.map(r => recalcRow(r, crewSize, shiftHours, elementTotalDays, true)));
  }, [crewSize, shiftHours, elementTotalDays]);

  const handleFieldChange = useCallback((rowId: string, field: keyof FormworkCalculatorRow, value: any) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const updated = { ...r, [field]: value };

      // When system changes, update defaults from catalog and reset manual overrides
      if (field === 'system_name') {
        const sys = findFormworkSystem(value as string);
        if (sys) {
          updated.rental_czk_per_m2_month = sys.rental_czk_m2_month;
          if (sys.heights.length > 0 && !sys.heights.includes(updated.system_height)) {
            updated.system_height = sys.heights[0];
          }
        }
        // Reset overrides — norm changed, so recompute
        updated.days_per_tact = 0;
        updated.formwork_term_days = 0;
      }

      // When total_area changes and set_area exists, recalculate tacts
      if (field === 'total_area_m2' && updated.set_area_m2 > 0) {
        updated.num_tacts = calculateFormworkTacts(value as number, updated.set_area_m2);
        updated.formwork_term_days = 0; // Reset term override
      }

      // When set_area changes, reset days override (norm inputs changed)
      if (field === 'set_area_m2') {
        updated.days_per_tact = 0;
        updated.formwork_term_days = 0;
      }

      // When num_tacts or num_sets change, reset term override
      if (field === 'num_tacts' || field === 'num_sets') {
        updated.formwork_term_days = 0;
      }

      return recalcRow(updated, crewSize, shiftHours, elementTotalDays);
    }));
  }, [crewSize, shiftHours, elementTotalDays]);

  /** Apply AI suggestion to a specific row */
  const handleAIApply = useCallback((rowId: string, daysPerTact: number, formworkTermDays: number) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const updated = { ...r, days_per_tact: daysPerTact, formwork_term_days: formworkTermDays };
      // Recalculate rental cost with new term
      const monthlyPerSet = calculateMonthlyRentalPerSet(updated.set_area_m2, updated.rental_czk_per_m2_month);
      const finalRental   = calculateFinalRentalCost(monthlyPerSet, formworkTermDays);
      return {
        ...updated,
        monthly_rental_per_set: parseFloat(monthlyPerSet.toFixed(2)),
        final_rental_czk:       parseFloat(finalRental.toFixed(2)),
        kros_description:       generateFormworkKrosDescription(updated),
      };
    }));
  }, []);

  const addRow = () => {
    setRows(prev => [...prev, createEmptyRow(bridgeId)]);
  };

  const removeRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
  };

  const handleTransfer = () => {
    const validRows = rows.filter(r => r.total_area_m2 > 0 && r.set_area_m2 > 0);
    if (validRows.length === 0) {
      alert('Žádné platné řádky k přenosu. Vyplňte alespoň plochu.');
      return;
    }
    onTransfer(validRows);
  };

  // Totals
  const totals = useMemo(() => ({
    totalArea: rows.reduce((s, r) => s + r.total_area_m2, 0),
    totalRental: rows.reduce((s, r) => s + r.final_rental_czk, 0),
    maxTerm: Math.max(0, ...rows.map(r => r.formwork_term_days))
  }), [rows]);

  const formatCZK = (n: number) => n.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // The row currently selected for AI assistance
  const aiRow = aiModalRowId ? rows.find(r => r.id === aiModalRowId) : null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="modal-content" style={{
        background: 'var(--panel-bg, #fff)',
        borderRadius: '12px',
        width: '95vw',
        maxWidth: '1600px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '2px solid var(--border-default, #ddd)',
          background: 'var(--data-surface-alt, #f5f5f5)'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Kalkulátor Bednění</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Výpočet montáže a demontáže bednění • Nájem se počítá v Registry TOV
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: '24px',
            cursor: 'pointer', color: 'var(--text-secondary)'
          }}>✕</button>
        </div>

        {/* Crew settings */}
        <div style={{
          display: 'flex', gap: '24px', padding: '12px 24px',
          background: 'var(--panel-inset, #f9f9f9)',
          borderBottom: '1px solid var(--border-default, #eee)',
          alignItems: 'center', flexWrap: 'wrap'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            Parta:
            <input type="number" min={1} max={20} value={crewSize}
              onChange={e => setCrew(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: '50px', padding: '4px 6px', border: '1px solid var(--border-default)', borderRadius: '4px' }}
            />
            lidí
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            Směna:
            <input type="number" min={1} max={16} step={0.5} value={shiftHours}
              onChange={e => setShift(Math.max(1, parseFloat(e.target.value) || 8))}
              style={{ width: '50px', padding: '4px 6px', border: '1px solid var(--border-default)', borderRadius: '4px' }}
            />
            h/den
          </label>
          <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Celkem: <b>{formatCZK(totals.totalArea)} m²</b> |
            Doba bednění: <b>{totals.maxTerm} dní</b>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflow: 'auto', flex: 1, padding: '0' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: '12px', whiteSpace: 'nowrap'
          }}>
            <thead>
              <tr style={{ background: 'var(--data-surface-alt, #f0f0f0)', position: 'sticky', top: 0, zIndex: 2 }}>
                <th style={thStyle}>Konstrukce</th>
                <th style={thStyle}>Celkem [m²/bm]</th>
                <th style={thStyle}>Sada [m²/bm]</th>
                <th style={thStyle}>Taktů [ks]</th>
                <th style={thStyle} title="Počet sad (komletů). Víc sad = kratší doba, nájem ≈ stejný">Sad [ks]</th>
                <th style={{...thStyle, background: '#e3f2fd'}}>Montáž [dny]</th>
                <th style={{...thStyle, background: '#e3f2fd'}}>Demontáž [dny]</th>
                <th style={thStyle}>Dny/takt (z+o)</th>
                <th style={thStyle} title={elementTotalDays > 0 ? 'Celk. doba prvku (montáž+výztuž+beton+zrání+demontáž)' : 'Doba bednění = ⌈taktů/sad⌉ × dny/takt'}>
                  {elementTotalDays > 0 ? 'Celk.doba [den]' : 'Doba [den]'}
                </th>
                <th style={thStyle}>Systém</th>
                <th style={thStyle}>Výška</th>
                <th style={thStyle}>Akce</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <FormworkRow
                  key={row.id}
                  row={row}
                  onChange={handleFieldChange}
                  onRemove={removeRow}
                  onAISuggest={() => setAiModalRowId(row.id)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 24px',
          borderTop: '2px solid var(--border-default, #ddd)',
          background: 'var(--data-surface-alt, #f5f5f5)'
        }}>
          <button onClick={addRow} style={{
            background: 'var(--accent-orange, #FF9F1C)', color: '#1a1a1a',
            border: 'none', borderRadius: '6px', padding: '8px 16px',
            fontWeight: 600, cursor: 'pointer', fontSize: '13px'
          }}>
            + Přidat řádek
          </button>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} style={{
              background: 'var(--bg-tertiary, #eee)', color: 'var(--text-primary)',
              border: '1px solid var(--border-default)', borderRadius: '6px',
              padding: '8px 20px', cursor: 'pointer', fontSize: '13px'
            }}>
              Zavřít
            </button>
            <button onClick={handleTransfer} style={{
              background: '#4CAF50', color: 'white',
              border: 'none', borderRadius: '6px', padding: '8px 20px',
              fontWeight: 600, cursor: 'pointer', fontSize: '13px'
            }}>
              Přenést Montáž + Demontáž ({rows.filter(r => r.total_area_m2 > 0).length * 2} řádků)
            </button>
          </div>
        </div>
      </div>

      {/* AI modal — rendered inside overlay so it stacks on top */}
      {aiRow && (
        <FormworkAIModal
          totalAreaM2={aiRow.total_area_m2}
          setAreaM2={aiRow.set_area_m2}
          systemName={aiRow.system_name}
          onApply={(daysPerTact, formworkTermDays) => {
            handleAIApply(aiRow.id, daysPerTact, formworkTermDays);
            setAiModalRowId(null);
          }}
          onClose={() => setAiModalRowId(null)}
        />
      )}
    </div>
  );
}

// ---- Sub-components ----

const thStyle: React.CSSProperties = {
  padding: '8px 6px',
  textAlign: 'center',
  borderBottom: '2px solid var(--border-default, #ccc)',
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--text-secondary)'
};

const cellStyle: React.CSSProperties = {
  padding: '4px 4px',
  borderBottom: '1px solid var(--border-default, #eee)',
  textAlign: 'center'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  border: '1px solid var(--border-default, #ddd)',
  borderRadius: '3px',
  textAlign: 'right',
  fontSize: '12px',
  background: '#fffef5'
};

const computedStyle: React.CSSProperties = {
  ...inputStyle,
  background: 'var(--panel-inset, #f5f5f5)',
  color: 'var(--text-secondary)',
  border: '1px solid transparent'
};

function FormworkRow({
  row,
  onChange,
  onRemove,
  onAISuggest,
}: {
  row: FormworkCalculatorRow;
  onChange: (id: string, field: keyof FormworkCalculatorRow, value: any) => void;
  onRemove: (id: string) => void;
  onAISuggest: () => void;
}) {
  const sys = findFormworkSystem(row.system_name);
  const heights = sys?.heights || [];
  const unitLabel = sys?.unit === 'bm' ? 'bm' : 'm²';

  const fmt = (n: number, d = 2) => n.toLocaleString('cs-CZ', {
    minimumFractionDigits: d, maximumFractionDigits: d
  });

  return (
    <tr>
      {/* Konstrukce */}
      <td style={{ ...cellStyle, textAlign: 'left', minWidth: '200px' }}>
        <input
          type="text"
          value={row.construction_name}
          onChange={e => onChange(row.id, 'construction_name', e.target.value)}
          placeholder="Základ OP (sada: 1x základ / LM)"
          style={{ ...inputStyle, textAlign: 'left', minWidth: '180px' }}
        />
      </td>

      {/* Celkem m²/bm */}
      <td style={cellStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <input type="number" min={0} step={0.1}
            value={row.total_area_m2 || ''}
            onChange={e => onChange(row.id, 'total_area_m2', parseFloat(e.target.value) || 0)}
            style={{ ...inputStyle, width: '60px' }}
          />
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{unitLabel}</span>
        </div>
      </td>

      {/* Sada m²/bm */}
      <td style={cellStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <input type="number" min={0} step={0.1}
            value={row.set_area_m2 || ''}
            onChange={e => onChange(row.id, 'set_area_m2', parseFloat(e.target.value) || 0)}
            style={{ ...inputStyle, width: '60px' }}
          />
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{unitLabel}</span>
        </div>
      </td>

      {/* Taktů (editable) */}
      <td style={cellStyle}>
        <input type="number" min={1} step={1}
          value={row.num_tacts}
          onChange={e => onChange(row.id, 'num_tacts', Math.max(1, parseInt(e.target.value) || 1))}
          style={{ ...inputStyle, width: '50px' }}
        />
      </td>

      {/* Sad (editable) */}
      <td style={cellStyle}>
        <input type="number" min={1} step={1}
          value={row.num_sets}
          onChange={e => onChange(row.id, 'num_sets', Math.max(1, parseInt(e.target.value) || 1))}
          style={{ ...inputStyle, width: '50px' }}
        />
      </td>

      {/* Montáž [dny] - computed */}
      <td style={{ ...cellStyle, background: '#e3f2fd22' }}>
        <span style={computedStyle}>{fmt(row.assembly_days_per_tact, 1)}</span>
      </td>

      {/* Demontáž [dny] - computed */}
      <td style={{ ...cellStyle, background: '#e3f2fd22' }}>
        <span style={computedStyle}>{fmt(row.disassembly_days_per_tact, 1)}</span>
      </td>

      {/* Dny/takt */}
      <td style={cellStyle}>
        <input type="number" min={0} step={0.5}
          value={row.days_per_tact}
          onChange={e => {
            const val = parseFloat(e.target.value) || 0;
            // When user overrides days_per_tact, recalculate term
            onChange(row.id, 'days_per_tact', val);
          }}
          style={{ ...inputStyle, width: '60px', fontWeight: 600 }}
        />
      </td>

      {/* Termín */}
      <td style={cellStyle}>
        <input type="number" min={0} step={1}
          value={row.formwork_term_days}
          onChange={e => onChange(row.id, 'formwork_term_days', parseFloat(e.target.value) || 0)}
          style={{ ...inputStyle, width: '55px' }}
        />
      </td>

      {/* Systém */}
      <td style={cellStyle}>
        <select
          value={row.system_name}
          onChange={e => onChange(row.id, 'system_name', e.target.value)}
          style={{ ...inputStyle, textAlign: 'left', width: '120px', background: '#fffef5' }}
        >
          {FORMWORK_SYSTEMS.map(s => (
            <option key={s.name} value={s.name}>{s.name}</option>
          ))}
        </select>
      </td>

      {/* Výška */}
      <td style={cellStyle}>
        {heights.length > 1 ? (
          <select
            value={row.system_height}
            onChange={e => onChange(row.id, 'system_height', e.target.value)}
            style={{ ...inputStyle, width: '75px' }}
          >
            {heights.map(h => (
              <option key={h} value={h}>h= {h} m</option>
            ))}
          </select>
        ) : (
          <input type="text"
            value={row.system_height}
            onChange={e => onChange(row.id, 'system_height', e.target.value)}
            placeholder="h= 0.9 m"
            style={{ ...inputStyle, width: '75px' }}
          />
        )}
      </td>

      {/* Akce */}
      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
        <button
          onClick={onAISuggest}
          title="AI průvodce bedněním — ✨ 4 otázky + výpočet zrání"
          style={{
            background: 'linear-gradient(135deg, #1a1a2e, #4a4e69)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            padding: '4px 6px',
            marginRight: '4px',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <Sparkles size={13} color="#FFD700" />
        </button>
        <button onClick={() => onRemove(row.id)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '14px', padding: '4px'
        }} title="Smazat řádek">❌</button>
      </td>
    </tr>
  );
}
