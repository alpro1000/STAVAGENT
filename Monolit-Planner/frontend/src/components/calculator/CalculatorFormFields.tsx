/**
 * CalculatorFormFields — Form field sections for the Kalkulátor betonáže.
 * Extracted from PlannerPage.tsx.
 *
 * Contains: Objemy (volumes), Záběry (tacts), Podmínky (conditions),
 * Beton/Zrání (concrete/maturity), Zdroje (resources), Bednění (formwork override),
 * Simulace (monte carlo).
 */

import type { PlannerOutput } from '@stavagent/monolit-shared';
import type { CuringResult, SeasonMode, ConcreteClass, CementType } from '@stavagent/monolit-shared';
import { FORMWORK_SYSTEMS, ELEMENT_DIMENSION_HINTS, getSuitableSystemsForElement, filterFormworkByPressure } from '@stavagent/monolit-shared';
import { Section, Field, NumInput, SuggestionBadge } from './ui';
import { formatCZK, formatNum, inputStyle, labelStyle } from './helpers';
import type { AIAdvisorResult, DocSuggestion, DocSuggestionsResponse, FormState } from './types';
import { ELEMENT_TYPES, SEASONS, CONCRETE_CLASSES, CEMENT_TYPES } from './types';
import type { CalculatorSidebarProps } from './CalculatorSidebar';

// ─── Props ─────────────────────────────────────────────────────────────────

export interface CalculatorFormFieldsProps extends CalculatorSidebarProps {
  getSuggestion: (param: string) => DocSuggestion | undefined;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function CalculatorFormFields(props: CalculatorFormFieldsProps) {
  const {
    form, setForm, result, wizardMode, wizardStep, wizardVisible,
    wizardHint2, wizardHint3, wizardHint4,
    showAdvanced, setShowAdvanced,
    advisor, docSuggestions, acceptedParams,
    onAcceptSuggestion, onDismissSuggestion,
    positionContext, isMonolitMode,
    getSuggestion, apiUrl, isAdmin,
    update,
  } = props;

  return (
    <>
          {/* ─── Volumes (wizard step 2: objem + beton) ─── */}
          <div className={wizardVisible.objemy ? 'r0-wizard-step' : ''} style={wizardVisible.objemy ? undefined : { display: 'none' }}>
          <Section title={wizardMode ? ['', 'Objem a beton', 'Geometrie', 'Výztuž a zdroje'][wizardStep - 1] || 'Objemy' : 'Objemy'}>
            {/* ── Step 2: Volume ── */}
            <div style={wizardVisible.objemy_volume ? undefined : { display: 'none' }}>
            <Field label="Objem betonu (m³)">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <NumInput style={{ ...inputStyle, flex: 1 }} value={form.volume_m3} min={0.1} fallback={1}
                  onChange={v => update('volume_m3', v as number)} />
                <SuggestionBadge
                  suggestion={getSuggestion('volume_m3')}
                  onAccept={onAcceptSuggestion}
                  onDismiss={onDismissSuggestion}
                />
              </div>
            </Field>
            {/* Wizard hint: maturity calculation */}
            {wizardMode && wizardStep === 2 && wizardHint2 && (
              <div style={{ margin: '8px 0', padding: '10px 12px', background: 'var(--r0-info-bg, #eff6ff)', border: '1px solid var(--r0-info-border, #bfdbfe)', borderRadius: 6, fontSize: 11, lineHeight: 1.6, color: 'var(--r0-slate-700)' }}>
                <strong>Výpočet zrání (Nurse-Saul)</strong>
                <div style={{ marginTop: 4 }}>
                  Doba zrání: <strong>{formatNum(wizardHint2.min_curing_days, 1)} dní</strong> při {form.temperature_c}°C
                  {' '}(M = {formatNum(wizardHint2.maturity_index, 0)} °C·h)
                </div>
                <div style={{ fontSize: 10, color: 'var(--r0-slate-400)', marginTop: 2 }}>
                  ČSN EN 13670: min. {formatNum(wizardHint2.min_curing_days, 0)} dní pro {form.concrete_class} + {form.cement_type}
                  {' '}(odbednění při {wizardHint2.strip_strength_pct}% f<sub>ck</sub>)
                </div>
                {wizardHint2.warning && (
                  <div style={{ marginTop: 4, color: 'var(--r0-warn-text)', fontSize: 10 }}>
                    {wizardHint2.warning}
                  </div>
                )}
              </div>
            )}
            </div>
            {/* ── Step 3: Geometry (formwork area, lost formwork, height, shape) ── */}
            <div style={wizardVisible.objemy_geometry ? undefined : { display: 'none' }}>
            <Field label="Plocha bednění (m²)" hint="prázdné = automatický odhad z objemu a výšky">
              <NumInput style={inputStyle} value={form.formwork_area_m2} min={0}
                onChange={v => update('formwork_area_m2', String(v))} placeholder="automatický odhad" />
            </Field>

            {/* Ztracené bednění (trapézový plech) — only for horizontal elements */}
            {(() => {
              const elemType = form.use_name_classification ? 'other' : form.element_type;
              const horizontalTypes = ['stropni_deska', 'zakladova_deska', 'mostovkova_deska'];
              if (!horizontalTypes.includes(elemType)) return null;
              return (
                <div style={{ marginTop: 6, padding: '8px 10px', background: 'var(--r0-slate-50, #f8fafc)', borderRadius: 6, border: '1px solid var(--r0-slate-200, #e2e8f0)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--r0-slate-700)' }}>
                    <input
                      type="checkbox"
                      checked={form.has_lost_formwork}
                      onChange={e => update('has_lost_formwork', e.target.checked)}
                    />
                    Ztracené bednění (trapézový plech)
                  </label>
                  {form.has_lost_formwork && (
                    <div style={{ marginTop: 6 }}>
                      <Field label="Plocha ztraceného bednění (m²)" hint="TP 60mm atd. — odečte se od systémového bednění">
                        <NumInput style={inputStyle} value={form.lost_formwork_area_m2} min={0}
                          onChange={v => update('lost_formwork_area_m2', String(v))}
                          placeholder="např. 1325" />
                      </Field>
                      <div style={{ fontSize: 10, color: 'var(--r0-slate-500)', marginTop: 4 }}>
                        Systémové bednění (Dokaflex/TRIO) se spočítá pouze na zbývající plochu.
                        Podpěry pokrývají celou plochu.
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            </div>{/* /wizard geometry (formwork + lost formwork) */}
            {/* ── Step 4: Rebar ── */}
            <div style={wizardVisible.objemy_rebar ? undefined : { display: 'none' }}>
            <Field label="Norma výztuže (kg/m³)" hint="prázdné = odhad z profilu elementu">
              <NumInput style={inputStyle} value={form.rebar_norm_kg_m3} min={0}
                onChange={v => {
                  const norm = String(v);
                  update('rebar_norm_kg_m3', norm);
                  if (norm && form.volume_m3 > 0) {
                    update('rebar_mass_kg', String(Math.round(parseFloat(norm) * form.volume_m3)));
                  } else if (!norm) {
                    update('rebar_mass_kg', '');
                  }
                }} placeholder="auto" />
            </Field>
            <Field label="Hmotnost výztuže celkem (kg)" hint="prázdné = odhad, nebo se vypočte z normy">
              <NumInput style={inputStyle} value={form.rebar_mass_kg} min={0}
                onChange={v => {
                  const kg = String(v);
                  update('rebar_mass_kg', kg);
                  if (kg && form.volume_m3 > 0) {
                    update('rebar_norm_kg_m3', String(Math.round(parseFloat(kg) / form.volume_m3)));
                  } else if (!kg) {
                    update('rebar_norm_kg_m3', '');
                  }
                }} placeholder="automatický odhad" />
            </Field>

            {/* Wizard hint: rebar calculation */}
            {wizardMode && wizardStep === 4 && wizardHint4 && (
              <div style={{ margin: '8px 0', padding: '10px 12px', background: 'var(--r0-info-bg, #eff6ff)', border: '1px solid var(--r0-info-border, #bfdbfe)', borderRadius: 6, fontSize: 11, lineHeight: 1.6, color: 'var(--r0-slate-700)' }}>
                <strong>Výpočet výztuže</strong>
                <div style={{ marginTop: 4 }}>
                  Hmotnost: <strong>{formatNum(wizardHint4.mass_kg, 0)} kg</strong> ({formatNum(wizardHint4.mass_t, 2)} t)
                  {wizardHint4.mass_source === 'estimated' && ' (odhad z profilu)'}
                </div>
                <div>
                  Norma: {wizardHint4.norm_h_per_t} h/t → <strong>{formatNum(wizardHint4.labor_hours, 0)} Nhod</strong>
                </div>
                <div>
                  {form.crew_size_rebar} železáři × {form.shift_h}h = <strong>{formatNum(wizardHint4.duration_days, 1)} dní/záběr</strong>
                </div>
                <div style={{ fontSize: 10, color: 'var(--r0-slate-400)', marginTop: 2 }}>
                  PERT: {formatNum(wizardHint4.optimistic_days, 1)}d (opt.) | {formatNum(wizardHint4.most_likely_days, 1)}d (střed) | {formatNum(wizardHint4.pessimistic_days, 1)}d (pes.)
                </div>
              </div>
            )}
            </div>{/* /wizard rebar */}

            {/* ─── Height + Element Dimension Hint (step 3: geometry) ─── */}
            <div style={wizardVisible.objemy_geometry ? undefined : { display: 'none' }}>
            {(() => {
              const elemType = form.use_name_classification ? 'other' : form.element_type;
              const hint = ELEMENT_DIMENSION_HINTS[elemType];
              if (!hint) return null;

              // Element-specific field visibility overrides:
              // - rimsa: shape_correction is fixed (always složitá geometrie), hide dropdown
              // - pilota, podzemni_stena: no plocha bednění (in the ground)
              const hideShapeCorrection = elemType === 'rimsa'
                || elemType === 'zakladova_deska'
                || elemType === 'zakladovy_pas'
                || elemType === 'zakladova_patka';

              return (
                <>
                  {hint.has_height && (
                    <Field
                      label="Výška (m)"
                      hint={hint.typical_height_range
                        ? `typicky ${hint.typical_height_range[0]}–${hint.typical_height_range[1]} m`
                        : 'pro výpočet podpěr'}
                    >
                      <NumInput style={inputStyle} value={form.height_m} min={0.1} step={0.1}
                        onChange={v => update('height_m', String(v))}
                        placeholder={hint.typical_height_range
                          ? `${hint.typical_height_range[0]}–${hint.typical_height_range[1]} m`
                          : 'výška elementu'} />
                    </Field>
                  )}
                  {/* Shape correction dropdown — hidden for element types with fixed geometry */}
                  {hint.has_height && !hideShapeCorrection && (
                    <Field label="Tvar průřezu" hint="korekce pracnosti bednění za geometrii">
                      <select style={inputStyle} value={form.formwork_shape_correction}
                        onChange={e => update('formwork_shape_correction', e.target.value)}>
                        <option value="1.0">Přímý — rovné plochy (×1.0)</option>
                        <option value="1.3">Zalomený — úhly, šikminy (×1.3)</option>
                        <option value="1.5">Kruhový — segmenty (×1.5)</option>
                        <option value="1.8">Nepravidelný — atypický (×1.8)</option>
                      </select>
                    </Field>
                  )}
                  {/* Info about fixed shape correction for specific types */}
                  {hint.has_height && elemType === 'rimsa' && (
                    <div style={{
                      padding: '4px 8px', marginBottom: 6, fontSize: 10,
                      color: 'var(--r0-slate-500)', fontStyle: 'italic',
                    }}>
                      Římsa: tvar průřezu je fixní (složitá geometrie × 1.5) — nelze přepnout.
                    </div>
                  )}

                  <div style={{
                    padding: '6px 10px', marginBottom: 8,
                    background: 'var(--r0-info-bg)', border: '1px solid var(--r0-info-border)', borderRadius: 4,
                    fontSize: 11, color: 'var(--r0-badge-blue-text)', lineHeight: 1.5,
                  }}>
                    {hint.hint_cs}
                  </div>
                </>
              );
            })()}

          {/* Wizard hint: lateral pressure + formwork (vertical elements) */}
          {wizardMode && wizardStep === 3 && wizardHint3 && (
            <div style={{ margin: '8px 0', padding: '10px 12px', background: 'var(--r0-warn-bg, #fffbeb)', border: '1px solid var(--r0-warn-border, #fde68a)', borderRadius: 6, fontSize: 11, lineHeight: 1.6, color: 'var(--r0-slate-700)' }}>
              <strong>Boční tlak (DIN 18218)</strong>
              <div style={{ marginTop: 4 }}>
                p = {wizardHint3.lateralPressure.formula}
              </div>
              {wizardHint3.stages.needs_staging && (
                <div style={{ marginTop: 4 }}>
                  Záběry z tlaku: <strong>{wizardHint3.stages.num_stages} záběry</strong> po {formatNum(wizardHint3.stages.stage_height_m, 1)}m
                  {' '}(tlak/záběr: {formatNum(wizardHint3.stages.stage_pressure_kn_m2, 0)} kN/m²
                  {' '}≤ {wizardHint3.stages.max_system_pressure_kn_m2} kN/m²)
                </div>
              )}
              {wizardHint3.filtered.suitable.length > 0 && (
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--r0-slate-500)' }}>
                  Vhodné systémy: {wizardHint3.filtered.suitable.map((s: any) => `${s.name} (${s.manufacturer})`).join(', ')}
                </div>
              )}
              {wizardHint3.filtered.rejected.length > 0 && (
                <div style={{ marginTop: 2, fontSize: 10, color: 'var(--r0-error-text, #dc2626)' }}>
                  Nevhodné (nízká nosnost): {wizardHint3.filtered.rejected.map((s: any) => s.name).join(', ')}
                </div>
              )}
            </div>
          )}
          </div>{/* /wizard geometry (height+hints) */}
          </Section>
          </div>{/* /wizard objemy */}

          {/* ─── Záběry (Tacts) — wizard step 5 ─── */}
          <div className={wizardVisible.zabery ? 'r0-wizard-step' : ''} style={wizardVisible.zabery ? undefined : { display: 'none' }}>
          <Section title="Záběry">
            <div style={{
              display: 'flex', gap: 4, marginBottom: 10,
              background: 'var(--r0-slate-200)', borderRadius: 4, padding: 2,
            }}>
              <button
                onClick={() => update('tact_mode', 'spary')}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  borderRadius: 3, fontFamily: 'inherit',
                  background: form.tact_mode === 'spary' ? 'white' : 'transparent',
                  color: form.tact_mode === 'spary' ? 'var(--r0-slate-800)' : 'var(--r0-slate-500)',
                  boxShadow: form.tact_mode === 'spary' ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                }}
              >
                Dilatační spáry
              </button>
              <button
                onClick={() => update('tact_mode', 'manual')}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  borderRadius: 3, fontFamily: 'inherit',
                  background: form.tact_mode === 'manual' ? 'white' : 'transparent',
                  color: form.tact_mode === 'manual' ? 'var(--r0-slate-800)' : 'var(--r0-slate-500)',
                  boxShadow: form.tact_mode === 'manual' ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                }}
              >
                Počet záběrů
              </button>
            </div>

            {form.tact_mode === 'spary' ? (
              <>
                <label style={labelStyle}>
                  <input
                    type="checkbox"
                    checked={form.has_dilatacni_spary}
                    onChange={e => update('has_dilatacni_spary', e.target.checked)}
                  />
                  {' '}Dilatační spáry
                </label>
                {!form.has_dilatacni_spary && (
                  <div style={{
                    padding: '8px 10px', marginBottom: 8,
                    background: 'var(--r0-warn-bg)', border: '1px solid var(--r0-warn-border)', borderRadius: 4,
                    fontSize: 11, color: 'var(--r0-warn-text)', lineHeight: 1.5,
                  }}>
                    Bez dilatačních spár = monolitický záběr v jednom průchodu.
                    Zajistěte dostatečnou kapacitu čerpadla a betonárny.
                  </div>
                )}
                {form.has_dilatacni_spary && (
                  <>
                    <Field label="Rozteč spár (m)">
                      <NumInput style={inputStyle} value={form.spara_spacing_m} min={0.1} fallback={1}
                        onChange={v => update('spara_spacing_m', v as number)} />
                    </Field>
                    <Field label="Celková délka (m)">
                      <NumInput style={inputStyle} value={form.total_length_m} min={0.1} fallback={1}
                        onChange={v => update('total_length_m', v as number)} />
                    </Field>
                    <label style={labelStyle}>
                      <input
                        type="checkbox"
                        checked={form.adjacent_sections}
                        onChange={e => update('adjacent_sections', e.target.checked)}
                      />
                      {' '}Sousední sekce (šachový pořadí)
                    </label>
                  </>
                )}
              </>
            ) : (
              <>
                <div style={{
                  padding: '8px 10px', marginBottom: 10,
                  background: 'var(--r0-info-bg)', border: '1px solid var(--r0-info-border)', borderRadius: 4,
                  fontSize: 11, color: 'var(--r0-badge-blue-text)', lineHeight: 1.5,
                }}>
                  Pro základy, pilíře, opěry: každý element = 1 záběr.<br/>
                  Např. 569 m³ na 2 opěry + 8 pilířů = 10 záběrů.
                </div>
                <Field label="Počet záběrů">
                  <NumInput style={inputStyle} value={form.num_tacts_override} min={1}
                    onChange={v => update('num_tacts_override', String(v))} placeholder="např. 10" />
                </Field>
                <Field label="Objem na záběr (m³)" hint="prázdné = celkem ÷ záběry">
                  <NumInput style={inputStyle} value={form.tact_volume_m3_override} min={0.1}
                    onChange={v => update('tact_volume_m3_override', String(v))}
                    placeholder={form.num_tacts_override
                      ? `${(form.volume_m3 / (parseInt(form.num_tacts_override) || 1)).toFixed(1)} m³ (auto)`
                      : 'automatický výpočet'} />
                </Field>
                <Field label="Režim betonáže">
                  <select
                    style={inputStyle}
                    value={form.scheduling_mode_override}
                    onChange={e => update('scheduling_mode_override', e.target.value as '' | 'linear' | 'chess')}
                  >
                    <option value="">Automatický (dle typu)</option>
                    <option value="linear">Lineární (po řadě)</option>
                    <option value="chess">Šachový (obskakuje sousední)</option>
                  </select>
                </Field>
              </>
            )}

            {/* ─── Block B: Pracovní spáry (visible PŘED prvním výpočtem) ─── */}
            <Field
              label="Pracovní spáry (dle RDS)"
              hint="bez dilatačních spár: jak dělit záběry"
            >
              <select
                style={inputStyle}
                value={form.working_joints_allowed}
                onChange={e => update('working_joints_allowed', e.target.value as FormState['working_joints_allowed'])}
                title={
                  'Automaticky / Nezjištěno: engine rozdělí na záběry podle kapacity + warning "ověřte v RDS". ' +
                  'Povoleny: rozdělí bez warningu. ' +
                  'Zakázány: 1 záběr (nepřetržitá betonáž) + warning.'
                }
              >
                <option value="">Automaticky (default)</option>
                <option value="yes">Povoleny (sekční)</option>
                <option value="no">Zakázány (nepřetržitá betonáž)</option>
                <option value="unknown">Nezjištěno ⚠️</option>
              </select>
            </Field>

            {/* ─── Ruční rozdělení záběrů (non-uniform volumes) ─── */}
            <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--r0-slate-50, #f8fafc)', borderRadius: 6, border: '1px solid var(--r0-slate-200, #e2e8f0)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--r0-slate-700)' }}>
                <input
                  type="checkbox"
                  checked={form.use_manual_zabery}
                  onChange={e => {
                    const enabled = e.target.checked;
                    update('use_manual_zabery', enabled);
                    if (enabled && form.manual_zabery.length === 0) {
                      // Seed with one empty row
                      update('manual_zabery', [{ name: '', volume_m3: '', formwork_area_m2: '' }]);
                    }
                  }}
                />
                Ruční rozdělení záběrů (nerovnoměrné objemy)
              </label>
              {form.use_manual_zabery && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--r0-slate-500)', marginBottom: 6 }}>
                    Zadejte objem každého záběru zvlášť. Největší záběr určuje harmonogram (bottleneck).
                  </div>
                  <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--r0-slate-200)' }}>
                        <th style={{ textAlign: 'left', padding: '3px 4px', color: 'var(--r0-slate-500)', fontWeight: 600 }}>#</th>
                        <th style={{ textAlign: 'left', padding: '3px 4px', color: 'var(--r0-slate-500)', fontWeight: 600 }}>Název</th>
                        <th style={{ textAlign: 'right', padding: '3px 4px', color: 'var(--r0-slate-500)', fontWeight: 600 }}>Objem (m³)</th>
                        <th style={{ textAlign: 'right', padding: '3px 4px', color: 'var(--r0-slate-500)', fontWeight: 600 }}>Plocha (m²)</th>
                        <th style={{ padding: '3px 4px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.manual_zabery.map((z, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--r0-slate-100)' }}>
                          <td style={{ padding: '4px', color: 'var(--r0-slate-400)', fontSize: 10 }}>{i + 1}</td>
                          <td style={{ padding: '2px 4px' }}>
                            <input
                              type="text"
                              value={z.name}
                              onChange={e => {
                                const next = form.manual_zabery.slice();
                                next[i] = { ...next[i], name: e.target.value };
                                update('manual_zabery', next);
                              }}
                              placeholder={`Záběr ${i + 1}`}
                              style={{ width: '100%', padding: '3px 6px', fontSize: 11, border: '1px solid var(--r0-slate-300)', borderRadius: 3, fontFamily: 'inherit' }}
                            />
                          </td>
                          <td style={{ padding: '2px 4px' }}>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={z.volume_m3}
                              onChange={e => {
                                const next = form.manual_zabery.slice();
                                next[i] = { ...next[i], volume_m3: e.target.value };
                                update('manual_zabery', next);
                              }}
                              placeholder="0"
                              style={{ width: '100%', padding: '3px 6px', fontSize: 11, border: '1px solid var(--r0-slate-300)', borderRadius: 3, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}
                            />
                          </td>
                          <td style={{ padding: '2px 4px' }}>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              value={z.formwork_area_m2}
                              onChange={e => {
                                const next = form.manual_zabery.slice();
                                next[i] = { ...next[i], formwork_area_m2: e.target.value };
                                update('manual_zabery', next);
                              }}
                              placeholder="0"
                              style={{ width: '100%', padding: '3px 6px', fontSize: 11, border: '1px solid var(--r0-slate-300)', borderRadius: 3, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}
                            />
                          </td>
                          <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                const next = form.manual_zabery.filter((_, idx) => idx !== i);
                                update('manual_zabery', next);
                              }}
                              style={{
                                fontSize: 10, padding: '2px 6px', border: '1px solid var(--r0-slate-200)',
                                borderRadius: 3, cursor: 'pointer', background: 'white', color: 'var(--r0-slate-400)',
                              }}
                              title="Odstranit záběr"
                            >✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    onClick={() => {
                      update('manual_zabery', [...form.manual_zabery, { name: '', volume_m3: '', formwork_area_m2: '' }]);
                    }}
                    style={{
                      marginTop: 6, padding: '4px 10px', fontSize: 11, border: '1px dashed var(--r0-slate-300)',
                      borderRadius: 4, cursor: 'pointer', background: 'white', color: 'var(--r0-slate-600)', fontFamily: 'inherit',
                    }}
                  >+ Přidat záběr</button>

                  {/* Sum validation */}
                  {(() => {
                    const sum = form.manual_zabery.reduce((s, z) => s + (parseFloat(z.volume_m3) || 0), 0);
                    const total = form.volume_m3 || 0;
                    if (sum === 0 || total === 0) return null;
                    const deviation = Math.abs(sum - total) / total;
                    if (deviation <= 0.05) {
                      return (
                        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--r0-green, #16a34a)' }}>
                          ✓ Σ {sum.toFixed(2)} m³ ≈ {total.toFixed(2)} m³
                        </div>
                      );
                    }
                    return (
                      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--r0-orange, #f59e0b)' }}>
                        ⚠ Σ {sum.toFixed(2)} m³ ≠ {total.toFixed(2)} m³ (odchylka {(deviation * 100).toFixed(0)}%)
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </Section>

          </div>{/* /wizard zabery */}

          {/* ─── Environment — wizard step 5 ─── */}
          <div className={wizardVisible.conditions ? 'r0-wizard-step' : ''} style={wizardVisible.conditions ? undefined : { display: 'none' }}>
          <Section title="Podmínky">
            {!isMonolitMode && (
              <Field label="Datum zahájení" hint="pro kalendářní Gantt">
                <input
                  type="date"
                  style={inputStyle}
                  value={form.start_date}
                  onChange={e => update('start_date', e.target.value)}
                />
              </Field>
            )}
            {isMonolitMode && (
              <div style={{
                padding: '6px 10px', marginBottom: 8,
                background: 'var(--r0-info-bg)', border: '1px solid var(--r0-info-border)', borderRadius: 4,
                fontSize: 11, color: 'var(--r0-badge-blue-text)', lineHeight: 1.5,
              }}>
                Režim Monolit: Gantt zobrazuje pořadové dny (Den 1, Den 2…), ne kalendářní data.
              </div>
            )}
            <Field label="Termín investora (prac. dní)" hint="požadovaný deadline — systém varuje při překročení">
              <input
                type="number"
                style={inputStyle}
                placeholder="např. 35"
                min={1}
                value={form.deadline_days}
                onChange={e => update('deadline_days', e.target.value)}
              />
            </Field>

            <Field label="Sezóna">
              <select
                style={inputStyle}
                value={form.season}
                onChange={e => {
                  const s = e.target.value as SeasonMode;
                  const meta = SEASONS.find(x => x.value === s);
                  setForm(prev => ({ ...prev, season: s, temperature_c: meta?.temp ?? prev.temperature_c }));
                }}
              >
                {SEASONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Teplota (°C)" hint="nastavena dle sezóny, lze upravit">
              <NumInput style={inputStyle} value={form.temperature_c} min={-30} max={50} fallback={15}
                onChange={v => update('temperature_c', v as number)} />
            </Field>
          </Section>

          </div>{/* /wizard conditions */}

          {/* ─── Concrete / Maturity — wizard step 2 ─── */}
          <div style={wizardVisible.beton ? undefined : { display: 'none' }}>
          <Section title="Beton / Zrání">
            <Field label="Třída betonu">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <select style={{ ...inputStyle, flex: 1 }} value={form.concrete_class}
                  onChange={e => update('concrete_class', e.target.value as ConcreteClass)}>
                  {CONCRETE_CLASSES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <SuggestionBadge
                  suggestion={getSuggestion('concrete_class')}
                  onAccept={onAcceptSuggestion}
                  onDismiss={onDismissSuggestion}
                />
              </div>
              {/* Show exposure class info badge (no direct form field) */}
              {getSuggestion('exposure_class') && (
                <div style={{
                  marginTop: 4, padding: '3px 8px',
                  background: 'var(--r0-info-bg, #e8f4fd)', border: '1px solid var(--r0-info-border, #b3d9f2)',
                  borderRadius: 4, fontSize: 10, color: 'var(--r0-info-text, #1a73e8)',
                }}>
                  Stupen prostredí: <strong>
                    {Array.isArray(getSuggestion('exposure_class')!.value)
                      ? getSuggestion('exposure_class')!.value.join(', ')
                      : getSuggestion('exposure_class')!.value}
                  </strong>
                  <span style={{ opacity: 0.7, marginLeft: 4 }}>
                    ({getSuggestion('exposure_class')!.source.document}
                    {getSuggestion('exposure_class')!.source.page && `, str. ${getSuggestion('exposure_class')!.source.page}`})
                  </span>
                </div>
              )}
            </Field>
            <Field label="Typ cementu">
              <select style={inputStyle} value={form.cement_type}
                onChange={e => update('cement_type', e.target.value as CementType)}>
                {CEMENT_TYPES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>

            {/* ─── Special concrete flags from documents ─── */}
            {docSuggestions && (() => {
              const flags = docSuggestions.suggestions.filter(s =>
                ['is_scc', 'is_prestressed', 'is_winter', 'is_massive', 'is_architectural', 'consistency'].includes(s.param)
              );
              if (flags.length === 0) return null;
              return (
                <div style={{
                  padding: '8px 10px', marginTop: 4,
                  background: 'var(--r0-info-bg, #e8f4fd)', border: '1px solid var(--r0-info-border, #b3d9f2)',
                  borderRadius: 6, fontSize: 11, lineHeight: 1.7,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 2, color: 'var(--r0-info-text, #1a73e8)', fontSize: 10, textTransform: 'uppercase' }}>
                    Z dokumentu projektu
                  </div>
                  {flags.map(f => (
                    <div key={f.param} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: f.param.startsWith('is_') ? '#d97706' : 'var(--r0-info-text, #1a73e8)' }}>
                        {f.param === 'is_scc' && 'Samozhutnitelny beton (SCC)'}
                        {f.param === 'is_prestressed' && 'Predpjaty beton'}
                        {f.param === 'is_winter' && 'Zimni betonaz'}
                        {f.param === 'is_massive' && 'Masivni beton'}
                        {f.param === 'is_architectural' && 'Pohledovy beton'}
                        {f.param === 'consistency' && `Konzistence: ${f.value}`}
                      </span>
                      <span style={{ opacity: 0.5, fontSize: 9 }}>
                        ({f.source.document}{f.source.page ? `, str. ${f.source.page}` : ''})
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Section>

          </div>{/* /wizard beton */}

          {/* ─── Advanced (Zdroje in wizard step 4, Bednění+Simulace expert only) ─── */}
          <div style={wizardVisible.resources ? undefined : { display: 'none' }}>
          {!wizardMode && (
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              background: 'none', border: 'none', color: 'var(--r0-blue)',
              cursor: 'pointer', fontSize: 13, padding: '8px 0', width: '100%', textAlign: 'left',
            }}
          >
            {showAdvanced ? '▼' : '▶'} Pokročilé nastavení
          </button>
          )}

          {(showAdvanced || wizardMode) && (
            <>
              <Section title="Zdroje">
                {/* Obrátkovost (repetitive elements) — logically belongs with resources */}
                <Field label="Počet identických elementů" hint="např. 20 patek, 6 pilířů — ovlivňuje obrátkovost bednění">
                  <NumInput style={inputStyle} value={form.num_identical_elements} min={1} step={1}
                    onChange={v => update('num_identical_elements', Math.max(1, Math.round(Number(v))))} placeholder="1" />
                </Field>
                {form.num_identical_elements > 1 && (
                  <Field label="Sad bednění pro obrátky" hint={`${form.num_identical_elements} elementů ÷ sady = obrátkovost (${Math.ceil(form.num_identical_elements / (parseInt(form.formwork_sets_count) || form.num_sets))}×)`}>
                    <NumInput style={inputStyle} value={form.formwork_sets_count} min={1} step={1}
                      onChange={v => update('formwork_sets_count', String(Math.max(1, Math.round(Number(v)))))}
                      placeholder={String(form.num_sets)} />
                  </Field>
                )}

                {/* Sady bednění — separate row */}
                <Field label="Sady bednění (kompletní soupravy)">
                  <NumInput style={inputStyle} value={form.num_sets} min={1} max={10} fallback={1}
                    onChange={v => update('num_sets', v as number)} />
                </Field>

                {/* Tesaři (bednění) */}
                <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--r0-slate-50, #f8fafc)', borderRadius: 6, border: '1px solid var(--r0-slate-200, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r0-slate-600, #475569)', marginBottom: 6 }}>
                    Tesaři / bednáři (bednění)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label="Čety">
                      <NumInput style={inputStyle} value={form.num_formwork_crews} min={1} max={5} fallback={1}
                        onChange={v => update('num_formwork_crews', v as number)} />
                    </Field>
                    <Field label="Pracovníků / četa">
                      <NumInput style={inputStyle} value={form.crew_size} min={2} max={10} fallback={4}
                        onChange={v => update('crew_size', v as number)} />
                    </Field>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--r0-slate-500, #64748b)', marginTop: 4, fontWeight: 600 }}>
                    Celkem tesařů: {form.num_formwork_crews * form.crew_size}
                  </div>
                </div>

                {/* Železáři (výztuž) */}
                <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--r0-slate-50, #f8fafc)', borderRadius: 6, border: '1px solid var(--r0-slate-200, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r0-slate-600, #475569)', marginBottom: 6 }}>
                    Železáři (výztuž)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label="Čety">
                      <NumInput style={inputStyle} value={form.num_rebar_crews} min={1} max={10} fallback={1}
                        onChange={v => update('num_rebar_crews', v as number)} />
                    </Field>
                    <Field label="Pracovníků / četa">
                      <NumInput style={inputStyle} value={form.crew_size_rebar} min={2} max={10} fallback={4}
                        onChange={v => update('crew_size_rebar', v as number)} />
                    </Field>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--r0-slate-500, #64748b)', marginTop: 4, fontWeight: 600 }}>
                    Celkem železářů: {form.num_rebar_crews * form.crew_size_rebar}
                  </div>
                </div>

                {/* Směna + Mzda — shared */}
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Field label="Směna (h) — tesaři + železáři">
                    <NumInput style={inputStyle} value={form.shift_h} min={6} max={12} fallback={10}
                      onChange={v => update('shift_h', v as number)} />
                  </Field>
                  <Field label="Mzda — základ (Kč/h)">
                    <NumInput style={inputStyle} value={form.wage_czk_h} min={100} fallback={398}
                      onChange={v => update('wage_czk_h', v as number)} />
                  </Field>
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--r0-slate-400)' }}>
                  Mzda podle profese (prázdné = základ {form.wage_czk_h} Kč/h):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 4 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--r0-slate-600)', marginBottom: 3, whiteSpace: 'nowrap' }}>Tesaři (Kč/h)</label>
                    <NumInput style={inputStyle} value={form.wage_formwork_czk_h} min={100}
                      onChange={v => update('wage_formwork_czk_h', String(v))} placeholder={String(form.wage_czk_h)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--r0-slate-600)', marginBottom: 3, whiteSpace: 'nowrap' }}>Železáři (Kč/h)</label>
                    <NumInput style={inputStyle} value={form.wage_rebar_czk_h} min={100}
                      onChange={v => update('wage_rebar_czk_h', String(v))} placeholder={String(form.wage_czk_h)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--r0-slate-600)', marginBottom: 3, whiteSpace: 'nowrap' }}>Betonáři (Kč/h)</label>
                    <NumInput style={inputStyle} value={form.wage_pour_czk_h} min={100}
                      onChange={v => update('wage_pour_czk_h', String(v))} placeholder={String(form.wage_czk_h)} />
                  </div>
                </div>
              </Section>

              <div style={wizardMode ? { display: 'none' } : undefined}>
              <Section title="Bednění (override)">
                <Field label="Systém bednění">
                  <select style={inputStyle} value={form.formwork_system_name}
                    onChange={e => {
                      update('formwork_system_name', e.target.value);
                      update('rental_czk_override', ''); // reset override on system change
                    }}>
                    <option value="">Automatický výběr</option>
                    {FORMWORK_SYSTEMS.map(s => (
                      <option key={s.name} value={s.name}>{s.name} ({s.manufacturer})</option>
                    ))}
                  </select>
                </Field>

                {/* Editable rental price */}
                {(() => {
                  const selected = form.formwork_system_name
                    ? FORMWORK_SYSTEMS.find(s => s.name === form.formwork_system_name)
                    : null;
                  const catalogPrice = selected?.rental_czk_m2_month ?? 0;
                  const unit = selected?.unit ?? 'm2';
                  return (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--r0-slate-50, #f8fafc)', borderRadius: 6, border: '1px solid var(--r0-slate-200, #e2e8f0)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r0-slate-600, #475569)', marginBottom: 6 }}>
                        Pronájem bednění
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
                        <Field label={`Katalogová cena (Kč/${unit}/měs)`}>
                          <input style={{ ...inputStyle, background: '#e2e8f0', cursor: 'not-allowed' }}
                            value={selected ? catalogPrice.toFixed(0) : '—'}
                            readOnly disabled />
                        </Field>
                        <Field label={`Vaše cena (Kč/${unit}/měs)`}>
                          <input style={{
                            ...inputStyle,
                            borderColor: form.rental_czk_override ? 'var(--r0-orange, #f59e0b)' : undefined,
                            fontWeight: form.rental_czk_override ? 700 : undefined,
                          }}
                            type="number" min={0} step={10}
                            placeholder={selected ? catalogPrice.toFixed(0) : '—'}
                            value={form.rental_czk_override}
                            onChange={e => update('rental_czk_override', e.target.value)} />
                        </Field>
                      </div>
                      {form.rental_czk_override && (
                        <div style={{ fontSize: 10, color: 'var(--r0-orange, #f59e0b)', marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            Přepsána katalogová cena: {catalogPrice} → {form.rental_czk_override} Kč/{unit}/měs
                            {catalogPrice > 0 && ` (${((parseFloat(form.rental_czk_override) / catalogPrice - 1) * 100).toFixed(0)}%)`}
                          </span>
                          <button onClick={() => update('rental_czk_override', '')}
                            style={{ background: 'none', border: 'none', color: 'var(--r0-slate-400)', cursor: 'pointer', fontSize: 10, textDecoration: 'underline' }}>
                            Obnovit katalog
                          </button>
                        </div>
                      )}

                      {/* Compact catalog table */}
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ fontSize: 11, color: 'var(--r0-blue, #3b82f6)', cursor: 'pointer', userSelect: 'none' }}>
                          Katalog cen ({FORMWORK_SYSTEMS.length} systémů)
                        </summary>
                        <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 6 }}>
                          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', fontFamily: "'JetBrains Mono', monospace" }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--r0-slate-200, #e2e8f0)', position: 'sticky', top: 0, background: 'var(--r0-slate-50, #f8fafc)' }}>
                                <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: 10, fontWeight: 600 }}>Systém</th>
                                <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: 10, fontWeight: 600 }}>Výrobce</th>
                                <th style={{ textAlign: 'right', padding: '3px 4px', fontSize: 10, fontWeight: 600 }}>Kč/j./měs</th>
                                <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 10, fontWeight: 600 }}>j.</th>
                                <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 10, fontWeight: 600 }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {FORMWORK_SYSTEMS.map(s => (
                                <tr key={s.name} style={{
                                  borderBottom: '1px solid var(--r0-slate-100, #f1f5f9)',
                                  background: s.name === form.formwork_system_name ? 'rgba(245,158,11,0.08)' : undefined,
                                }}>
                                  <td style={{ padding: '3px 4px' }}>{s.name}</td>
                                  <td style={{ padding: '3px 4px', color: 'var(--r0-slate-400)' }}>{s.manufacturer}</td>
                                  <td style={{ padding: '3px 4px', textAlign: 'right', fontWeight: 600 }}>
                                    {s.rental_czk_m2_month > 0 ? s.rental_czk_m2_month.toFixed(0) : '—'}
                                  </td>
                                  <td style={{ padding: '3px 4px', textAlign: 'center', color: 'var(--r0-slate-400)' }}>{s.unit}</td>
                                  <td style={{ padding: '2px 4px', textAlign: 'center' }}>
                                    <button onClick={() => {
                                      update('formwork_system_name', s.name);
                                      update('rental_czk_override', '');
                                    }}
                                      style={{
                                        background: s.name === form.formwork_system_name ? 'var(--r0-orange, #f59e0b)' : 'var(--r0-slate-200, #e2e8f0)',
                                        color: s.name === form.formwork_system_name ? 'white' : 'var(--r0-slate-600)',
                                        border: 'none', borderRadius: 3, padding: '1px 6px', fontSize: 10, cursor: 'pointer',
                                      }}>
                                      {s.name === form.formwork_system_name ? '✓' : 'Vybrat'}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    </div>
                  );
                })()}
              </Section>

              <Section title="Simulace">
                <label style={labelStyle}>
                  <input type="checkbox" checked={form.enable_monte_carlo}
                    onChange={e => update('enable_monte_carlo', e.target.checked)} />
                  {' '}Monte Carlo simulace (PERT)
                </label>
                <div style={{ fontSize: 10, color: 'var(--r0-slate-400)', marginTop: 2, marginLeft: 18 }}>
                  1000× náhodná simulace doby záběru. Ukazuje P50–P95 odhady termínů. Zpomaluje výpočet.
                </div>
              </Section>
              </div>{/* /wizard expert-only (bednění + simulace) */}
            </>
          )}
          </div>{/* /wizard resources */}

    </>
  );
}
