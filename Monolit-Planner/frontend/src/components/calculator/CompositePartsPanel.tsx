/**
 * CompositePartsPanel — Fáze 2 #7 (composite-element-parts) Gate 5.
 *
 * Lets the user decompose a composite element (opěra) into a manual list of
 * structural parts (dřík + úložný práh + závěrná zídka + křídla). Each part is
 * a COMPACT row (type + optional volume OR L×W×H + optional formwork override);
 * everything else is inherited from the parent + getSmartDefaults (Gate 5
 * interview 2026-06-26, option (a)). The shared planComposite engine computes
 * per-part bednění/takty/beton and closes the volume to 100 % of the parent
 * total (exact parts win; estimate parts share the remainder → ODHAD badge).
 * "Aplikovat" writes each part as work rows tagged metadata.structural_part.
 */

import { Plus, Trash2, Layers } from 'lucide-react';
import { getSuitableSystemsForElement } from '@stavagent/monolit-shared';
import type { CompositeOutput, CompositePartResult, StructuralElementType } from '@stavagent/monolit-shared';
import type { PartFormState } from './types';
import { ELEMENT_TYPES } from './types';
import { formatCZK, formatNum } from './helpers';

interface Props {
  parts: PartFormState[];
  compositeResult: CompositeOutput | null;
  addPart: (et: StructuralElementType, label?: string) => void;
  removePart: (id: string) => void;
  updatePart: (id: string, patch: Partial<PartFormState>) => void;
  seedAbutmentParts: () => void;
  clearParts: () => void;
  /** Present only when the calculator is bound to a position (linked mode). */
  onApplyComposite?: () => void;
  applyStatus?: 'idle' | 'saving' | 'saved' | 'error';
}

/** Total money for a part = direct labor + every rental kept outside labor. */
function partCost(p: CompositePartResult): number {
  const c = p.plan?.costs;
  if (!c) return 0;
  return (c.total_labor_czk || 0) + (c.formwork_rental_czk || 0)
    + (c.props_rental_czk || 0) + (c.mss_rental_czk || 0);
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '4px 6px', fontSize: 12, borderRadius: 4,
  border: '1px solid var(--r0-slate-300)', fontFamily: 'inherit',
};
const numStyle: React.CSSProperties = { ...inputStyle, fontFamily: 'var(--r0-font-mono)', textAlign: 'right' };

export default function CompositePartsPanel({
  parts, compositeResult, addPart, removePart, updatePart,
  seedAbutmentParts, clearParts, onApplyComposite, applyStatus,
}: Props) {
  return (
    <div style={{
      marginBottom: 16, padding: 16, background: 'white',
      borderRadius: 8, border: '1px solid var(--r0-slate-200)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--r0-slate-800)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={16} /> Složený prvek — části
        </h3>
        {parts.length > 0 && (
          <button onClick={clearParts} style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
            border: '1px solid var(--r0-slate-200)', background: 'white', color: 'var(--r0-slate-500)',
          }}>Vyčistit části</button>
        )}
      </div>

      {parts.length === 0 ? (
        <div>
          <p style={{ fontSize: 12, color: 'var(--r0-slate-500)', lineHeight: 1.6, marginTop: 0 }}>
            Rozložte opěru na strukturní části (dřík · úložný práh · závěrná zídka · křídla). Každá část má
            vlastní bednění, takty a beton. Bez objemu části se rozdělí podle typových podílů (ODHAD), součet
            vždy odpovídá celkovému objemu.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={seedAbutmentParts} style={{
              fontSize: 12, padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontWeight: 600,
              border: '1px solid var(--r0-orange)', background: 'var(--r0-orange)', color: 'white',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <Layers size={14} /> Šablona opěry (4 části)
            </button>
            <button onClick={() => addPart('driky_piliru')} style={{
              fontSize: 12, padding: '6px 12px', borderRadius: 4, cursor: 'pointer',
              border: '1px solid var(--r0-slate-300)', background: 'white', color: 'var(--r0-slate-700)',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <Plus size={14} /> Přidat díl
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Editor: one compact row per part ── */}
          <div style={{ overflowX: 'auto', marginBottom: 12 }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--r0-slate-200)' }}>
                  {['Část', 'Typ', 'Objem (m³)', 'D×Š×V (m)', 'Bednění', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', padding: '4px 6px', fontSize: 10, color: 'var(--r0-slate-500)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => {
                  const systems = getSuitableSystemsForElement(p.element_type).all;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--r0-slate-100)' }}>
                      <td style={{ padding: '4px 6px', minWidth: 110 }}>
                        <input style={inputStyle} value={p.part_label}
                          placeholder="Název části"
                          onChange={(e) => updatePart(p.id, { part_label: e.target.value })} />
                      </td>
                      <td style={{ padding: '4px 6px', minWidth: 150 }}>
                        <select style={inputStyle} value={p.element_type}
                          onChange={(e) => updatePart(p.id, { element_type: e.target.value as StructuralElementType })}>
                          {ELEMENT_TYPES.filter(t => t.value !== 'other').map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '4px 6px', minWidth: 80 }}>
                        <input style={numStyle} type="number" min="0" step="0.1" value={p.volume_m3}
                          placeholder="odhad"
                          onChange={(e) => updatePart(p.id, { volume_m3: e.target.value })} />
                      </td>
                      <td style={{ padding: '4px 6px', minWidth: 130 }}>
                        <div style={{ display: 'flex', gap: 3 }}>
                          <input style={numStyle} type="number" min="0" step="0.1" value={p.length_m}
                            placeholder="D" onChange={(e) => updatePart(p.id, { length_m: e.target.value })} />
                          <input style={numStyle} type="number" min="0" step="0.1" value={p.width_m}
                            placeholder="Š" onChange={(e) => updatePart(p.id, { width_m: e.target.value })} />
                          <input style={numStyle} type="number" min="0" step="0.1" value={p.height_m}
                            placeholder="V" onChange={(e) => updatePart(p.id, { height_m: e.target.value })} />
                        </div>
                      </td>
                      <td style={{ padding: '4px 6px', minWidth: 130 }}>
                        <select style={inputStyle} value={p.formwork_system_name}
                          onChange={(e) => updatePart(p.id, { formwork_system_name: e.target.value })}>
                          <option value="">auto</option>
                          {systems.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        <button onClick={() => removePart(p.id)} title="Odebrat část" style={{
                          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--r0-slate-400)', padding: 2,
                        }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => addPart('driky_piliru')} style={{
              fontSize: 12, padding: '5px 10px', borderRadius: 4, cursor: 'pointer',
              border: '1px solid var(--r0-slate-300)', background: 'white', color: 'var(--r0-slate-700)',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <Plus size={14} /> Přidat díl
            </button>
          </div>

          {/* ── Results: per-part roll-up + aggregate ── */}
          {compositeResult && compositeResult.is_detailed && (
            <div style={{ borderTop: '1px solid var(--r0-slate-200)', paddingTop: 12 }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--r0-slate-200)' }}>
                    {['Část', 'm³', 'Bednění', 'Taktů', 'Dní', 'Kč'].map((h, i) => (
                      <th key={i} style={{ textAlign: i === 0 || i === 2 ? 'left' : 'right', padding: '5px 6px', fontSize: 10, color: 'var(--r0-slate-500)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compositeResult.parts.map((part, i) => {
                    const odhad = part.volume_source === 'odhad_family_ratio';
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--r0-slate-100)' }}>
                        <td style={{ padding: '5px 6px', fontWeight: 500 }}>{part.label}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'var(--r0-font-mono)', whiteSpace: 'nowrap' }}>
                          {formatNum(part.volume_m3, 1)}
                          {odhad && (
                            <span title="Objem odhadnut z typového podílu — zadej rozměry pro přesnost" style={{
                              marginLeft: 4, fontSize: 9, padding: '0 4px', borderRadius: 3,
                              background: '#fef3c7', color: '#92400e', fontWeight: 700,
                            }}>ODHAD</span>
                          )}
                        </td>
                        <td style={{ padding: '5px 6px', color: 'var(--r0-slate-600)' }}>{part.plan?.formwork.system.name ?? '—'}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'var(--r0-font-mono)' }}>{part.plan?.pour_decision.num_tacts ?? '—'}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'var(--r0-font-mono)' }}>{part.plan ? formatNum(part.plan.schedule.total_days, 1) : '—'}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'var(--r0-font-mono)' }}>{part.plan ? formatCZK(partCost(part)) : '—'}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: '2px solid var(--r0-slate-200)', fontWeight: 700 }}>
                    <td style={{ padding: '6px 6px' }}>Σ opěra</td>
                    <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'var(--r0-font-mono)' }}>{formatNum(compositeResult.total_volume_m3, 1)}</td>
                    <td />
                    <td />
                    <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'var(--r0-font-mono)' }}>
                      {compositeResult.aggregate.schedule_total_days != null ? formatNum(compositeResult.aggregate.schedule_total_days, 1) : '—'}
                    </td>
                    <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'var(--r0-font-mono)' }}>{formatCZK(compositeResult.aggregate.total_cost_czk)}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: 6, fontSize: 11, color: compositeResult.volume_closed ? 'var(--r0-slate-500)' : '#b45309' }}>
                {compositeResult.volume_closed
                  ? `Součet částí = ${formatNum(compositeResult.total_volume_m3, 1)} m³ (uzavřeno na 100 %).`
                  : 'Součet částí ≠ celkový objem — zkontroluj zadání.'}
              </div>

              {compositeResult.warnings.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {compositeResult.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 11, color: 'var(--r0-slate-600)', lineHeight: 1.5 }}>{w}</div>
                  ))}
                </div>
              )}

              {onApplyComposite && (
                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={onApplyComposite}
                    disabled={applyStatus === 'saving'}
                    style={{
                      fontSize: 13, padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                      border: 'none', color: 'white',
                      background: applyStatus === 'saved' ? 'var(--r0-success, #059669)'
                        : applyStatus === 'error' ? '#dc2626' : 'var(--r0-orange)',
                    }}
                  >
                    {applyStatus === 'saving' ? 'Ukládám…'
                      : applyStatus === 'saved' ? '✓ Aplikováno'
                      : applyStatus === 'error' ? '✕ Chyba — zkuste znovu'
                      : 'Aplikovat části do pozice'}
                  </button>
                  <div style={{ marginTop: 4, fontSize: 10, color: 'var(--r0-slate-400)' }}>
                    Každá část se zapíše jako řádky práce pod opěrou (jedna smětní položka).
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
