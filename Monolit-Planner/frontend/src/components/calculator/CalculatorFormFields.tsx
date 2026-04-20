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
import { FORMWORK_SYSTEMS, ELEMENT_DIMENSION_HINTS, getSuitableSystemsForElement, filterFormworkByPressure, getElementProfile, getRebarNormForDiameter } from '@stavagent/monolit-shared';
import { Section, Field, NumInput, SuggestionBadge } from './ui';
import { ExposureClassesPicker } from './ExposureClassesPicker';
import { getMostRestrictive } from '@stavagent/monolit-shared';
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

  // B1 (2026-04-15): for bored piles the formwork-related fields are
  // still RENDERED but DISABLED (with a tooltip) so the user sees they
  // exist for other elements and isn't left wondering where they went.
  // Previously the Bednění override section was hidden entirely with
  // `display: none`, which made the UI feel inconsistent between
  // element types. Zemina slouží jako forma pro vrtanou pilotu.
  const isPile = form.element_type === 'pilota';
  const pileDisabledTitle = 'Pilota nemá systémové bednění — zemina slouží jako forma (CFA / pažnice / tremie).';
  const disabledInputStyle = {
    ...inputStyle,
    background: 'var(--r0-slate-100, #f1f5f9)',
    color: 'var(--r0-slate-400)',
    cursor: 'not-allowed',
  } as React.CSSProperties;

  return (
    <>
          {/* ─── Volumes (wizard step 2: objem + beton) ─── */}
          <div className={wizardVisible.objemy ? 'r0-wizard-step' : ''} style={wizardVisible.objemy ? undefined : { display: 'none' }}>
          <Section title={wizardMode ? ['', 'Objem a beton', 'Geometrie', 'Výztuž a zdroje'][wizardStep - 1] || 'Objemy' : 'Objemy'}>
            {/* ── Step 2: Volume ── */}
            <div style={wizardVisible.objemy_volume ? undefined : { display: 'none' }}>
            <Field label="Objem betonu (m³)">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <NumInput
                  // E1 (2026-04-15): read-only for pilota (volume is always
                  // derived from Ø×L×count via the pile engine).
                  style={{
                    ...inputStyle, flex: 1,
                    ...(isPile ? {
                      background: 'var(--r0-slate-100, #f1f5f9)',
                      color: 'var(--r0-slate-500)',
                    } : {}),
                  }}
                  value={form.volume_m3} min={0} fallback={0}
                  onChange={v => {
                    if (isPile) return; // pile volume is locked to geometry
                    // Typing into volume → flip to manual mode so the
                    // L×W×H useEffect stops overwriting this value.
                    update('volume_m3', v as number);
                    if (form.volume_mode !== 'manual') {
                      update('volume_mode', 'manual');
                    }
                  }}
                />
                <SuggestionBadge
                  suggestion={getSuggestion('volume_m3')}
                  onAccept={onAcceptSuggestion}
                  onDismiss={onDismissSuggestion}
                />
              </div>
              {/* Volume source hint */}
              {form.volume_mode === 'from_geometry' && form.volume_m3 > 0 && (
                <div style={{ marginTop: 3, fontSize: 10, color: 'var(--r0-slate-500)' }}>
                  📐 vypočítáno z geometrie ({isPile ? 'Ø × L × počet' : 'D × Š × V'})
                </div>
              )}
              {isPile && (
                <div style={{ marginTop: 3, fontSize: 10, color: 'var(--r0-slate-500)' }}>
                  Pilota: objem je vždy odvozen z geometrie v kroku 3.
                </div>
              )}
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
                  TKP18: třída ošetřování {wizardHint2.curing_class}, {form.concrete_class} + {form.cement_type}
                  {form.exposure_class ? ` + ${form.exposure_class}` : ''}
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

            {/* E2 (2026-04-15): Length × Width × Height block for horizontal
                foundation blocks. When all three are set, volume and
                formwork area are auto-derived via useCalculator. Also
                visible for vertical opěry (task spec) because they have
                rectangular geometry and share the D/Š/V entry pattern. */}
            {(() => {
              const elemType = form.element_type;
              // BUG 7: driky_piliru added — L×W×H for pier shaft, fw area = 2(L+W)×H
              const geomTypes = [
                'zaklady_piliru', 'zakladova_patka', 'zakladovy_pas',
                'opery_ulozne_prahy', 'driky_piliru',
              ];
              if (!geomTypes.includes(elemType)) return null;
              return (
                <div style={{
                  marginBottom: 10, padding: '8px 10px',
                  background: 'var(--r0-slate-50, #f8fafc)',
                  border: '1px solid var(--r0-slate-200, #e2e8f0)',
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r0-slate-600)', marginBottom: 6 }}>
                    Rozměry bloku (volitelné) — objem a plocha bednění se dopočítají
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                    <Field label="Délka D (m)">
                      <NumInput style={inputStyle} value={form.length_m_input} min={0}
                        onChange={v => {
                          update('length_m_input', String(v));
                          if (String(v) && form.volume_mode !== 'from_geometry') {
                            update('volume_mode', 'from_geometry');
                          }
                        }} placeholder="např. 6" />
                    </Field>
                    <Field label="Šířka Š (m)">
                      <NumInput style={inputStyle} value={form.width_m_input} min={0}
                        onChange={v => {
                          update('width_m_input', String(v));
                          if (String(v) && form.volume_mode !== 'from_geometry') {
                            update('volume_mode', 'from_geometry');
                          }
                        }} placeholder="např. 4" />
                    </Field>
                    <Field label="Výška V (m)">
                      <NumInput style={inputStyle} value={form.height_m} min={0}
                        onChange={v => {
                          update('height_m', String(v));
                          if (String(v) && form.length_m_input && form.width_m_input
                              && form.volume_mode !== 'from_geometry') {
                            update('volume_mode', 'from_geometry');
                          }
                        }} placeholder="např. 1.5" />
                    </Field>
                  </div>
                  {form.length_m_input && form.width_m_input && form.height_m && (() => {
                    const L = parseFloat(form.length_m_input);
                    const W = parseFloat(form.width_m_input);
                    const H = parseFloat(form.height_m);
                    if (!(L > 0 && W > 0 && H > 0)) return null;
                    const v = L * W * H;
                    const fwA = 2 * (L + W) * H;
                    return (
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--r0-slate-600)' }}>
                        📐 Objem = {L}×{W}×{H} = <strong>{v.toFixed(2)} m³</strong>
                        {' · '}Plocha bednění = 2×({L}+{W})×{H} = <strong>{fwA.toFixed(1)} m²</strong>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* 2026-04-15: hide "Plocha bednění" for piles — bored piles
                have no system formwork, the pile geometry block below
                takes over entirely. */}
            {form.element_type !== 'pilota' && (
            <Field label="Plocha bednění (m²)" hint="prázdné = automatický odhad z objemu a výšky">
              <NumInput style={inputStyle} value={form.formwork_area_m2} min={0}
                onChange={v => update('formwork_area_m2', String(v))} placeholder="automatický odhad" />
            </Field>
            )}

            {/* Ztracené bednění (trapézový plech) — only for horizontal elements */}
            {(() => {
              const elemType = form.element_type;
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
            {/*
              v4.24 BUG A fix: rebar main-bar diameter. Drives
              REBAR_RATES_MATRIX[category][diameter] h/t lookup.
              Empty = element default (D12 walls, D20 slabs, D25 pilíře, …).
            */}
            {(() => {
              const elemType = form.element_type;
              if (elemType === 'pilota') return null; // pile has own armokoš workflow
              const profile = getElementProfile(elemType);
              const defaultD = profile.rebar_default_diameter_mm;
              const selectedD = form.rebar_diameter_mm
                ? parseFloat(form.rebar_diameter_mm)
                : defaultD;
              const norm = getRebarNormForDiameter(elemType, selectedD).norm_h_per_t;
              return (
                <Field
                  label="Průměr hlavní výztuže (mm)"
                  hint={`prázdné = výchozí ${defaultD} mm pro ${profile.label_cs}`}
                >
                  <select
                    style={inputStyle}
                    value={form.rebar_diameter_mm}
                    onChange={e => update('rebar_diameter_mm', e.target.value)}
                  >
                    <option value="">auto — D{defaultD} ({norm} h/t)</option>
                    <option value="6">D6</option>
                    <option value="8">D8</option>
                    <option value="10">D10</option>
                    <option value="12">D12</option>
                    <option value="14">D14</option>
                    <option value="16">D16</option>
                    <option value="20">D20</option>
                    <option value="25">D25</option>
                    <option value="32">D32</option>
                    <option value="40">D40</option>
                  </select>
                  <div style={{ fontSize: 10, color: 'var(--r0-slate-400)', marginTop: 2 }}>
                    Norma {norm} h/t ({profile.rebar_category} D{selectedD}) — methvin.co, ČSN 73&nbsp;0210
                  </div>
                </Field>
              );
            })()}

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
            {/* 2026-04-15: PILOTA geometry block. Bored piles use a totally
                different geometry model — diameter × length × count instead
                of width × height × area. We render this BEFORE the standard
                hint block and short-circuit it via `return null` from the
                hint-IIFE below when element_type === 'pilota', so the same
                wizard step 3 slot shows pile fields. */}
            {(() => {
              const elemType = form.element_type;
              if (elemType !== 'pilota') return null;
              // Auto-compute volume preview from diameter × length × count
              // so the user sees the math the engine will use.
              const dMm = parseFloat(form.pile_diameter_mm) || 600;
              const lM = parseFloat(form.pile_length_m) || 10;
              const n = parseInt(form.pile_count, 10) || 0;
              const r = dMm / 2 / 1000;
              const v1 = Math.PI * r * r * lM;
              const vTotal = n > 0 ? v1 * n : 0;
              return (
                <div style={{
                  padding: '10px 12px', marginBottom: 10,
                  background: 'var(--r0-slate-50, #f8fafc)',
                  border: '1px solid var(--r0-slate-200, #e2e8f0)',
                  borderRadius: 6,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r0-slate-600, #475569)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Geometrie piloty
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label="Průměr (mm)" hint="standardní katalog">
                      <select style={inputStyle} value={form.pile_diameter_mm}
                        onChange={e => update('pile_diameter_mm', e.target.value)}>
                        <option value="">600 (default)</option>
                        <option value="400">400</option>
                        <option value="500">500</option>
                        <option value="600">600</option>
                        <option value="750">750</option>
                        <option value="900">900</option>
                        <option value="1200">1200</option>
                        <option value="1500">1500</option>
                      </select>
                    </Field>
                    <Field label="Délka (m)" hint="3–35 m">
                      <NumInput style={inputStyle} value={form.pile_length_m} min={1} step={0.5}
                        onChange={v => update('pile_length_m', String(v))} placeholder="10" />
                    </Field>
                  </div>
                  <Field label="Počet pilot" hint="klíčový parametr — určuje objem a rozvrh">
                    <NumInput style={inputStyle} value={form.pile_count} min={1} step={1}
                      onChange={v => update('pile_count', String(Math.max(1, Math.round(Number(v)))))} placeholder="auto z objemu" />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label="Geologie">
                      <select style={inputStyle} value={form.pile_geology}
                        onChange={e => update('pile_geology', e.target.value as any)}>
                        <option value="">Soudržná (default)</option>
                        <option value="cohesive">Soudržná</option>
                        <option value="noncohesive">Nesoudržná</option>
                        <option value="below_gwt">Pod hladinou podzemní vody</option>
                        <option value="rock">Skalní podloží</option>
                      </select>
                    </Field>
                    <Field label="Metoda vrtání">
                      <select style={inputStyle} value={form.pile_casing_method}
                        onChange={e => update('pile_casing_method', e.target.value as any)}>
                        <option value="">CFA (default)</option>
                        <option value="cfa">CFA (průběžný šnek)</option>
                        <option value="cased">S pažnicí</option>
                        <option value="uncased">Bez pažení</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Index vyztužení (kg/m³)" hint="armokoš — typ. 30–60, default 40">
                    <NumInput style={inputStyle} value={form.pile_rebar_index_kg_m3} min={20} max={120} step={5}
                      onChange={v => update('pile_rebar_index_kg_m3', String(v))} placeholder="40" />
                  </Field>
                  {/* Volume preview — what the engine will use */}
                  {(n > 0 || form.pile_count) && (
                    <div style={{
                      marginTop: 8, padding: '6px 10px', background: 'white',
                      border: '1px dashed var(--r0-slate-300)', borderRadius: 4,
                      fontSize: 11, color: 'var(--r0-slate-600)', fontFamily: "var(--r0-font-mono, 'JetBrains Mono', monospace)",
                    }}>
                      Objem 1 piloty: <strong>{v1.toFixed(2)} m³</strong>
                      {' · '}
                      {n > 0 ? (
                        <>celkem: <strong>{vTotal.toFixed(1)} m³</strong> ({n}× pilot)</>
                      ) : (
                        <span style={{ color: 'var(--r0-slate-400)' }}>počet odvozen z objemu</span>
                      )}
                    </div>
                  )}
                  {/* Hlavice (pile cap) — optional */}
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginTop: 10, fontSize: 12, color: 'var(--r0-slate-600)',
                    cursor: 'pointer', userSelect: 'none',
                  }}>
                    <input
                      type="checkbox"
                      checked={form.has_pile_cap}
                      onChange={e => update('has_pile_cap', e.target.checked)}
                    />
                    Hlavice piloty (ŽB patka nad pilotou)
                  </label>
                  {form.has_pile_cap && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--r0-slate-600)', marginBottom: 3 }}>Délka (m)</label>
                        <NumInput style={inputStyle} value={form.pile_cap_length_m} min={0.5} step={0.1}
                          onChange={v => update('pile_cap_length_m', String(v))} placeholder="1.5" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--r0-slate-600)', marginBottom: 3 }}>Šířka (m)</label>
                        <NumInput style={inputStyle} value={form.pile_cap_width_m} min={0.5} step={0.1}
                          onChange={v => update('pile_cap_width_m', String(v))} placeholder="1.5" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, color: 'var(--r0-slate-600)', marginBottom: 3 }}>Výška (m)</label>
                        <NumInput style={inputStyle} value={form.pile_cap_height_m} min={0.3} step={0.1}
                          onChange={v => update('pile_cap_height_m', String(v))} placeholder="0.8" />
                      </div>
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 10, color: 'var(--r0-slate-400)', fontStyle: 'italic' }}>
                    Pilota nemá bednění (zemina = forma), nemá boční tlak, nemá záběry.
                    Konzistence betonu min. S4. Beton je ukládán kontraktorovou rourou.
                  </div>
                </div>
              );
            })()}
            {(() => {
              const elemType = form.element_type;
              // Pilota uses its own geometry block above — skip the standard hint block.
              if (elemType === 'pilota') return null;
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
                      // Mostovka A1 (2026-04-16): relabel so the user sees
                      // "Výška nad terénem" (prop height) and not just
                      // "Výška", which was ambiguous with deck thickness.
                      label={elemType === 'mostovkova_deska' ? 'Výška nad terénem (m)' : 'Výška (m)'}
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
                  {/* Mostovka A1: deck cross-section thickness is a separate
                      input — was previously conflated with "Výška" and the
                      0.3–2.5 sanity range triggered false warnings for real
                      bridges (6–15 m tall support scaffolds). Optional —
                      empty = engine derives from volume/(span×width). */}
                  {elemType === 'mostovkova_deska' && (
                    <Field
                      label="Tloušťka desky (m)"
                      hint="průřez NK (typ. 0.3–2.5 m). Volitelné — dopočítá se z objemu/(rozpětí×šířka)."
                    >
                      <NumInput style={inputStyle} value={form.deck_thickness_m} min={0} step={0.05}
                        onChange={v => update('deck_thickness_m', v ? String(v) : '')}
                        placeholder="např. 1.2" />
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
          <Section title="Členění konstrukce">
            {/* Block A (2026-04): hierarchical sections × záběry per section
                replaces the legacy two-tab UI ("Dilatační spáry" / "Počet záběrů").
                The two layers are independent — a dilatation cell may itself
                contain multiple záběry depending on volume + capacity. */}

            {/* MSS-6 hard lock (2026-04-17): when the user picked
                construction_technology=mss for a mostovka, the number
                of tacts is physically locked to the number of spans
                (jeden pole = jeden takt MSS). Form fields go read-only
                with a badge; engine ignores any manual override (see
                orchestrator mismatch warning). */}
            {(() => {
              const isMssLock = form.element_type === 'mostovkova_deska'
                && form.construction_technology === 'mss';
              const numSpansForLock = form.num_spans ? parseInt(form.num_spans, 10) : 0;
              return isMssLock ? (
                <div style={{
                  padding: '8px 10px', marginBottom: 8, borderRadius: 6,
                  background: 'var(--r0-info-bg, #eff6ff)',
                  border: '1px solid var(--r0-info-border, #bfdbfe)',
                  fontSize: 11, lineHeight: 1.5, color: 'var(--r0-slate-700)',
                }}>
                  <strong>🌉 MSS: záběry zamčeny na počet polí</strong>
                  <div style={{ marginTop: 2 }}>
                    Posuvná skruž pracuje pole za polem — {numSpansForLock || 'N'} taktů
                    {numSpansForLock ? ` (= ${numSpansForLock} polí)` : ''}.
                    Dilatační spáry / ruční záběry nejsou pro MSS relevantní.
                  </div>
                </div>
              ) : null;
            })()}

            {/* ─── KROK 1: Dilatační celky ─── */}
            {(() => {
              const isMssLock = form.element_type === 'mostovkova_deska'
                && form.construction_technology === 'mss';
              return (
                <label style={{
                  ...labelStyle,
                  opacity: isMssLock ? 0.5 : 1,
                  cursor: isMssLock ? 'not-allowed' : 'pointer',
                }} title={isMssLock ? 'Pro MSS jsou dilatační celky irelevantní — každé pole = jeden takt.' : undefined}>
                  <input
                    type="checkbox"
                    disabled={isMssLock}
                    checked={isMssLock ? false : form.has_dilatation_joints}
                    onChange={e => {
                      if (isMssLock) return;
                      update('has_dilatation_joints', e.target.checked);
                      if (!e.target.checked) update('num_dilatation_sections', 1);
                    }}
                  />
                  {' '}Konstrukce má dilatační spáry
                </label>
              );
            })()}

            {form.has_dilatation_joints
             && !(form.element_type === 'mostovkova_deska' && form.construction_technology === 'mss') && (
              <>
                <Field label="Počet dilatačních celků" hint="z TZ / projektu">
                  <NumInput
                    style={inputStyle}
                    value={form.num_dilatation_sections}
                    min={1}
                    fallback={1}
                    onChange={v => update('num_dilatation_sections', v as number)}
                  />
                </Field>
                <Field label="Rozteč spár (m)" hint="prázdné = ručně počet">
                  <NumInput
                    style={inputStyle}
                    value={form.dilatation_spacing_m}
                    min={0.1}
                    onChange={v => {
                      const spacing = v as number;
                      update('dilatation_spacing_m', String(spacing));
                      // Auto-derive num_dilatation_sections from total_length / spacing
                      if (spacing > 0 && form.total_length_m > 0) {
                        update('num_dilatation_sections', Math.max(1, Math.ceil(form.total_length_m / spacing)));
                      }
                    }}
                    placeholder="např. 15"
                  />
                </Field>
                <Field label="Celková délka (m)">
                  <NumInput
                    style={inputStyle}
                    value={form.total_length_m}
                    min={0.1}
                    fallback={1}
                    onChange={v => update('total_length_m', v as number)}
                  />
                </Field>
                <label style={labelStyle}>
                  <input
                    type="checkbox"
                    checked={form.adjacent_sections}
                    onChange={e => update('adjacent_sections', e.target.checked)}
                  />
                  {' '}Šachové betonování sousedních celků
                </label>
              </>
            )}

            <div style={{ height: 1, background: 'var(--r0-slate-200)', margin: '10px 0' }} />

            {/* ─── KROK 2: Záběry per celek ─── */}
            {(() => {
              const isMssLock = form.element_type === 'mostovkova_deska'
                && form.construction_technology === 'mss';
              const numSpansForLock = form.num_spans ? parseInt(form.num_spans, 10) : 0;
              return isMssLock ? (
                <Field label="Záběry v jednom celku">
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={numSpansForLock > 0 ? `${numSpansForLock} taktů (= ${numSpansForLock} polí, MSS)` : 'N taktů (= N polí, MSS)'}
                    style={{
                      ...inputStyle,
                      background: 'var(--r0-slate-100, #f1f5f9)',
                      color: 'var(--r0-slate-600)',
                      cursor: 'not-allowed',
                    }}
                    title="MSS: jeden pole = jeden takt. Nelze měnit ručně."
                  />
                </Field>
              ) : (
                <Field label="Záběry v jednom celku">
                  <select
                    style={inputStyle}
                    value={form.tacts_per_section_mode}
                    onChange={e => update('tacts_per_section_mode', e.target.value as 'auto' | 'manual')}
                  >
                    <option value="auto">Automaticky (dle kapacity)</option>
                    <option value="manual">Ručně</option>
                  </select>
                </Field>
              );
            })()}

            {form.tacts_per_section_mode === 'manual'
             && !(form.element_type === 'mostovkova_deska' && form.construction_technology === 'mss') && (
              <Field label="Počet záběrů per celek">
                <NumInput
                  style={inputStyle}
                  value={form.tacts_per_section_manual}
                  min={1}
                  onChange={v => update('tacts_per_section_manual', String(v))}
                  placeholder="např. 2"
                />
              </Field>
            )}

            {/* ─── Náhled výsledku ─── */}
            <div style={{
              padding: '8px 10px', marginTop: 10,
              background: 'var(--r0-info-bg)', border: '1px solid var(--r0-info-border)',
              borderRadius: 4, fontSize: 11, color: 'var(--r0-badge-blue-text)', lineHeight: 1.5,
            }}>
              {(() => {
                const nSec = form.has_dilatation_joints ? Math.max(1, form.num_dilatation_sections || 1) : 1;
                const tps = form.tacts_per_section_mode === 'manual'
                  ? Math.max(1, parseInt(form.tacts_per_section_manual || '0', 10) || 0)
                  : 0;
                const totalLabel = tps > 0
                  ? `${nSec} celk${nSec === 1 ? '' : nSec < 5 ? 'y' : 'ů'} × ${tps} záběr${tps === 1 ? '' : tps < 5 ? 'y' : 'ů'} = ${nSec * tps} celkem`
                  : `${nSec} celk${nSec === 1 ? '' : nSec < 5 ? 'y' : 'ů'} × auto záběry (engine spočítá z objemu/kapacity)`;
                return <>Členění: <strong>{totalLabel}</strong></>;
              })()}
            </div>

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
            {/* Smart defaults info — show what auto-values are applied */}
            {(form.exposure_class || form.curing_class) && (
              <div style={{ marginTop: 4, fontSize: 10, color: 'var(--r0-slate-500)' }}>
                {form.exposure_class && <>Prostředí: <strong>{form.exposure_class}</strong> (auto) · </>}
                {form.curing_class && <>Ošetřování: třída <strong>{form.curing_class}</strong> (auto) · </>}
                <button style={{ background: 'none', border: 'none', color: 'var(--r0-blue)', cursor: 'pointer', fontSize: 10, padding: 0 }}
                  onClick={() => setShowAdvanced(true)}>
                  změnit ▸
                </button>
              </div>
            )}

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
            {showAdvanced ? '▼' : '▶'} Expertní parametry
          </button>
          )}

          {(showAdvanced || wizardMode) && (
            <>
              {/* ─── Expert: exposure, curing, cement (moved from Beton section) ─── */}
              {!wizardMode && (
              <Section title="Prostředí a ošetřování">
                {/* Task 2 (2026-04-20): multi-select checkbox grid per
                    ČSN EN 206+A2. Concrete is typically exposed to
                    multiple environmental actions simultaneously (XF2 +
                    XD1 + XC4 for bridge decks) — the picker applies
                    combined rules over the selection and writes a single
                    array to FormState. Legacy singular `exposure_class`
                    is derived here as the most-restrictive class so
                    downstream readers (advisor prompt, calculator-
                    suggestions payload) still see a meaningful value. */}
                <Field label="Třídy prostředí" hint="Vyberte vše, co pro konstrukci platí (ČSN EN 206+A2). Motor použije přísnější pravidlo z každé kategorie.">
                  <ExposureClassesPicker
                    value={form.exposure_classes ?? []}
                    onChange={next => {
                      update('exposure_classes', next);
                      const primary = getMostRestrictive(next) ?? '';
                      update('exposure_class', primary);
                    }}
                    cement_type_is_sulfate_resistant={
                      // CEM with 'SV' / 'SR' in identifier is sulfate-resistant
                      /SR|SV/i.test(form.cement_type ?? '')
                    }
                  />
                </Field>
                <Field label="Třída ošetřování" hint="TKP18 §7.8.3. Auto = dle typu prvku">
                  <select style={inputStyle} value={form.curing_class}
                    onChange={e => update('curing_class', e.target.value as '' | '2' | '3' | '4')}>
                    <option value="">Auto (dle typu prvku)</option>
                    <option value="2">2 — základy, podkladní beton</option>
                    <option value="3">3 — spodní stavba (opěry, pilíře)</option>
                    <option value="4">4 — nosná konstrukce, římsy</option>
                  </select>
                </Field>
                <Field label="Typ cementu">
                  <select style={inputStyle} value={form.cement_type}
                    onChange={e => update('cement_type', e.target.value as CementType)}>
                    {CEMENT_TYPES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </Field>
              </Section>
              )}
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

                {/* A1 (2026-04-15): default num_sets = 1. Hint suggests 2 only when
                    num_identical_elements > 1 (the obrátkovost path uses formwork_sets_count
                    above for that, so this stays at 1 sada).
                    B1 (2026-04-15): disabled for pilota with explanatory tooltip. */}
                <Field
                  label="Sady bednění (kompletní soupravy)"
                  hint={
                    isPile
                      ? 'Pilota: bez systémového bednění.'
                      : form.num_identical_elements > 1
                        ? `Pro ${form.num_identical_elements} identických elementů zvažte 2 sady (rotace).`
                        : '1 sada = standard pro většinu prvků (římsa, stěna, pilíř, deska).'
                  }
                >
                  {isPile ? (
                    <input
                      type="text"
                      readOnly
                      disabled
                      value="—"
                      title={pileDisabledTitle}
                      style={disabledInputStyle}
                    />
                  ) : (
                    <NumInput style={inputStyle} value={form.num_sets} min={1} max={10} fallback={1}
                      onChange={v => update('num_sets', v as number)} />
                  )}
                </Field>

                {/* Tesaři (bednění + podpěry). Label call-out makes it
                    explicit that the same crew builds skruž AND bednění —
                    the orchestrator sequences both onto ASM/STR since
                    4/2026 (B1 fix). */}
                <div
                  style={{
                    marginTop: 10, padding: '8px 10px',
                    background: isPile ? 'var(--r0-slate-100, #f1f5f9)' : 'var(--r0-slate-50, #f8fafc)',
                    borderRadius: 6,
                    border: '1px solid var(--r0-slate-200, #e2e8f0)',
                    opacity: isPile ? 0.6 : 1,
                  }}
                  title={isPile ? pileDisabledTitle : undefined}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r0-slate-600, #475569)', marginBottom: 6 }}>
                    {form.element_type === 'mostovkova_deska' || form.element_type === 'stropni_deska'
                      ? 'Tesaři (bednění + podpěrná konstrukce)'
                      : 'Tesaři / bednáři (bednění)'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label="Čety">
                      {isPile ? (
                        <input
                          type="text" readOnly disabled value="—"
                          title={pileDisabledTitle} style={disabledInputStyle}
                        />
                      ) : (
                        <NumInput style={inputStyle} value={form.num_formwork_crews} min={1} max={5} fallback={1}
                          onChange={v => update('num_formwork_crews', v as number)} />
                      )}
                    </Field>
                    <Field label="Pracovníků / četa">
                      {isPile ? (
                        <input
                          type="text" readOnly disabled value="—"
                          title={pileDisabledTitle} style={disabledInputStyle}
                        />
                      ) : (
                        <NumInput style={inputStyle} value={form.crew_size} min={2} max={10} fallback={4}
                          onChange={v => update('crew_size', v as number)} />
                      )}
                    </Field>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--r0-slate-500, #64748b)', marginTop: 4, fontWeight: 600 }}>
                    {isPile
                      ? 'Pilota: bez tesařů (vrtací souprava + železáři)'
                      : `Celkem tesařů: ${form.num_formwork_crews * form.crew_size}`}
                  </div>
                  {/* B2 (2026-04-16): formwork crew recommendation. Mirrors
                      the existing rebar hint style so users see both trades
                      side-by-side. ~0.6 Nhod/m² is the avg assembly norm
                      across the DOKA/PERI catalog (Framax 0.55, Dokaflex
                      0.72) — close enough for a sidebar rule of thumb.
                      Not shown for pilota (no bednění). */}
                  {!isPile && form.formwork_area_m2 && parseFloat(form.formwork_area_m2) > 0 && (() => {
                    const area = parseFloat(form.formwork_area_m2);
                    const shift = form.shift_h || 10;
                    const targetDays = 2;
                    const optimal = Math.max(2, Math.ceil((area * 0.6) / (targetDays * shift)));
                    const current = form.num_formwork_crews * form.crew_size;
                    const color = current >= optimal ? 'var(--r0-success-text, #059669)' : 'var(--r0-warn-text, #b45309)';
                    return (
                      <div style={{ fontSize: 10, color, marginTop: 2 }}>
                        Doporučeno ~{optimal} tesařů pro {area.toFixed(0)} m² / {targetDays} dny (0,6 Nh/m²)
                      </div>
                    );
                  })()}
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

                {/* A2 (2026-04-15): Směna + Mzda na jednom řádku. Labels zkráceny
                    (kontext "tesaři + železáři" je už v section headeru výše),
                    aby se vešly do dvousloupcového gridu i v úzkém sidebaru. */}
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Field label="Směna (h)">
                    <NumInput style={inputStyle} value={form.shift_h} min={6} max={12} fallback={10}
                      onChange={v => update('shift_h', v as number)} />
                  </Field>
                  <Field label="Mzda (Kč/h)">
                    <NumInput style={inputStyle} value={form.wage_czk_h} min={100} fallback={398}
                      onChange={v => update('wage_czk_h', v as number)} />
                  </Field>
                </div>
                {/* A3 (2026-04-15): per-profession wages behind a toggle.
                    OFF (default): all 3 fields hidden, engine uses wage_czk_h for everyone.
                    ON: 3 fields shown, pre-filled with current base wage. Empty value
                    in any field still falls back to base via the existing `?:` guard
                    in useCalculator.buildInput (lines 762-764).
                    Toggling OFF clears the 3 fields so they're not silently sent. */}
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  marginTop: 8, fontSize: 12, color: 'var(--r0-slate-600)',
                  cursor: 'pointer', userSelect: 'none',
                }}>
                  <input
                    type="checkbox"
                    checked={form.use_per_profession_wages}
                    onChange={e => {
                      const on = e.target.checked;
                      update('use_per_profession_wages', on);
                      if (on) {
                        // Pre-fill all 3 with the current base wage so user sees
                        // sensible starting values they can then override.
                        const base = String(form.wage_czk_h);
                        if (!form.wage_formwork_czk_h) update('wage_formwork_czk_h', base);
                        if (!form.wage_rebar_czk_h) update('wage_rebar_czk_h', base);
                        if (!form.wage_pour_czk_h) update('wage_pour_czk_h', base);
                      } else {
                        // Clear so engine falls back to base — prevents stale
                        // overrides being silently sent after the user hides them.
                        update('wage_formwork_czk_h', '');
                        update('wage_rebar_czk_h', '');
                        update('wage_pour_czk_h', '');
                      }
                    }}
                  />
                  Různé sazby podle profese
                </label>
                {form.use_per_profession_wages && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 6 }}>
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
                )}
              </Section>

              {/* D2 (2026-04-15): Bednění section always visible in expert
                  mode (outside Pokročilé toggle — the wrapper auto-opens).
                  B1: disabled for pilota with tooltip + opacity instead of
                  display:none so users see it exists for other elements. */}
              <div
                style={{
                  display: wizardMode ? 'none' : undefined,
                  opacity: isPile ? 0.55 : 1,
                  pointerEvents: isPile ? 'none' : undefined,
                }}
                title={isPile ? pileDisabledTitle : undefined}
              >
              {isPile && (
                <div style={{
                  marginBottom: 8, padding: '6px 10px',
                  background: 'var(--r0-slate-100, #f1f5f9)',
                  border: '1px dashed var(--r0-slate-300)',
                  borderRadius: 6, fontSize: 11, color: 'var(--r0-slate-500)',
                  pointerEvents: 'auto',
                }}>
                  Pilota: systémové bednění se neaplikuje (zemina = forma).
                </div>
              )}
              <Section title="Bednění (systém + výrobce + cena)">
                {/* Task 4 (2026-04): vendor pre-filter — orchestrator pins to
                    the chosen vendor when picking the auto-recommended
                    system. Auto = no constraint (default). Falls back to
                    Auto + warning if the chosen vendor has no feasible
                    system for the current geometry / pressure. */}
                <Field
                  label="Výrobce bednění"
                  hint="Auto = engine vybere napříč všemi výrobci"
                >
                  <select
                    style={inputStyle}
                    value={form.preferred_manufacturer}
                    onChange={e => update('preferred_manufacturer', e.target.value as FormState['preferred_manufacturer'])}
                  >
                    <option value="">Auto (všichni výrobci)</option>
                    <option value="DOKA">DOKA</option>
                    <option value="PERI">PERI</option>
                    <option value="ULMA">ULMA</option>
                    <option value="NOE">NOE</option>
                    <option value="Místní">Místní (tradiční)</option>
                  </select>
                </Field>
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
