/**
 * InlineResourcePanel — inline resource editor shown above the result.
 *
 * Implements Part C of the calculator audit: the user can tweak resource
 * parameters (crews, sets, shifts, pumps window, deadline) directly above
 * the result, without re-entering the wizard.
 *
 * Changes to any field update the shared form state, which triggers the
 * existing 1.5s auto-calc debounce in useCalculator. Inline editing is
 * therefore purely a UX shell — engine behavior is unchanged.
 *
 * Element type, volume, geometry, concrete class etc. remain wizard-only.
 */

import { useState } from 'react';
import type { FormState } from './types';

export interface InlineResourcePanelProps {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  calcStatus?: 'idle' | 'calculating';
  resultDirty?: boolean;
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--r0-slate-500)',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  marginBottom: 2,
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--r0-slate-700)',
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  marginBottom: 8,
  paddingBottom: 4,
  borderBottom: '1px solid var(--r0-slate-200)',
};

const selectStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid var(--r0-slate-300)',
  borderRadius: 4,
  fontSize: 12,
  fontFamily: 'inherit',
  background: 'white',
  minHeight: 32,
  width: '100%',
};

const cellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

/**
 * Inline resource panel that only edits resource-level FormState fields.
 * Element type, volume, geometry etc. are intentionally NOT surfaced here —
 * those require the wizard for consistency.
 */
export default function InlineResourcePanel({ form, update, calcStatus, resultDirty }: InlineResourcePanelProps) {
  const [expanded, setExpanded] = useState(true);

  const toInt = (v: string, fallback = 0): number => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  };

  return (
    <div style={{
      marginBottom: 16,
      border: '1px solid var(--r0-slate-200)',
      borderRadius: 8,
      background: 'var(--r0-slate-50, #f8fafc)',
      overflow: 'hidden',
    }}>
      <div
        style={{
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          borderBottom: expanded ? '1px solid var(--r0-slate-200)' : 'none',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--r0-slate-800)' }}>
            Zdroje
          </span>
          <span style={{ fontSize: 11, color: 'var(--r0-slate-500)' }}>
            (změna = okamžitý přepočet)
          </span>
          {calcStatus === 'calculating' && (
            <span style={{ fontSize: 11, color: 'var(--r0-info-text, #1e40af)' }}>
              · přepočítávám…
            </span>
          )}
          {calcStatus !== 'calculating' && resultDirty && (
            <span style={{ fontSize: 11, color: 'var(--r0-slate-500)' }}>
              · čekám na přepočet…
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: 'var(--r0-slate-400)' }}>
          {expanded ? '−' : '+'}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ─── Pracovní čety — paired četa count + workers per crew ─── */}
          <div>
            <div style={sectionHeaderStyle}>Pracovní čety</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 12,
            }}>
              <div style={cellStyle}>
                <label style={labelStyle}>Čety bednění</label>
                <select
                  value={form.num_formwork_crews}
                  onChange={e => update('num_formwork_crews', toInt(e.target.value, 1))}
                  style={selectStyle}
                >
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div style={cellStyle}>
                <label style={labelStyle}>Tesařů / četa</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={form.crew_size}
                  onChange={e => update('crew_size', toInt(e.target.value, 1))}
                  style={selectStyle}
                />
              </div>

              <div style={cellStyle}>
                <label style={labelStyle}>Čety výztuže</label>
                <select
                  value={form.num_rebar_crews}
                  onChange={e => update('num_rebar_crews', toInt(e.target.value, 1))}
                  style={selectStyle}
                >
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div style={cellStyle}>
                <label style={labelStyle}>Železářů / četa</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={form.crew_size_rebar}
                  onChange={e => update('crew_size_rebar', toInt(e.target.value, 1))}
                  style={selectStyle}
                />
              </div>
            </div>
          </div>

          {/* ─── Parametry výpočtu — everything else ─── */}
          <div>
            <div style={sectionHeaderStyle}>Parametry výpočtu</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 12,
            }}>
              <div style={cellStyle}>
                <label style={labelStyle}>Soupravy bednění</label>
                <select
                  value={form.num_sets}
                  onChange={e => update('num_sets', toInt(e.target.value, 1))}
                  style={selectStyle}
                >
                  {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div style={cellStyle}>
                <label style={labelStyle}>Směna (h)</label>
                <select
                  value={form.shift_h}
                  onChange={e => update('shift_h', toInt(e.target.value, 10))}
                  style={selectStyle}
                >
                  <option value={8}>8 (jedna směna)</option>
                  <option value={10}>10 (prodloužená)</option>
                  <option value={12}>12 (max. dle ZP)</option>
                </select>
              </div>

              <div style={cellStyle}>
                <label style={labelStyle}>Cílové okno (h)</label>
                <input
                  type="text"
                  placeholder="—"
                  value={form.target_pour_window_h}
                  onChange={e => update('target_pour_window_h', e.target.value)}
                  style={selectStyle}
                  title="Pro alternativní scénář pumpy (BUG-2)"
                />
              </div>

              <div style={cellStyle}>
                <label style={labelStyle}>Termín (prac. dní)</label>
                <input
                  type="text"
                  placeholder="—"
                  value={form.deadline_days}
                  onChange={e => update('deadline_days', e.target.value)}
                  style={selectStyle}
                />
              </div>

              <div style={cellStyle}>
                <label style={labelStyle}>Konzistence</label>
                <select
                  value={form.concrete_consistency}
                  onChange={e => update('concrete_consistency', e.target.value as FormState['concrete_consistency'])}
                  style={selectStyle}
                  title="DIN 18218: k-factor pro boční tlak"
                >
                  <option value="standard">Standard (k=0.85)</option>
                  <option value="plastic">Plastický S3–S4 (k=1.0)</option>
                  <option value="scc">SCC (k=1.5)</option>
                </select>
              </div>

              <div style={cellStyle}>
                <label style={labelStyle}>Pracovní spáry</label>
                <select
                  value={form.working_joints_allowed}
                  onChange={e => update('working_joints_allowed', e.target.value as FormState['working_joints_allowed'])}
                  style={selectStyle}
                  title="Když element nemá dilatační spáry, povolit pracovní spáry?"
                >
                  <option value="">— výchozí (monolit)</option>
                  <option value="yes">Ano (členit po záběrech)</option>
                  <option value="no">Ne (nepřetržitě)</option>
                  <option value="unknown">Neznámo (ověřit v RDS)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
