/**
 * CalculatorSidebar — Input form for the Kalkulátor betonáže.
 * Extracted from PlannerPage.tsx.
 *
 * Contains: wizard step indicator, form sections (Element, Objemy, Beton,
 * Záběry, Podmínky, Zdroje, Bednění, Simulace), action buttons.
 * All state is owned by PlannerPage — this component reads/writes via props.
 */

import type { PlannerOutput } from '@stavagent/monolit-shared';
import type { CuringResult } from '@stavagent/monolit-shared';
import type { StructuralElementType } from '@stavagent/monolit-shared';
import { FORMWORK_SYSTEMS, ELEMENT_DIMENSION_HINTS, getSuitableSystemsForElement, recommendBridgeTechnology, getMSSTactDays } from '@stavagent/monolit-shared';
import { Section, Field, NumInput, SuggestionBadge, DocWarningsBanner } from './ui';
import { formatCZK, formatNum, inputStyle, labelStyle } from './helpers';
import type { AIAdvisorResult, DocSuggestion, DocSuggestionsResponse, FormState } from './types';
import { ELEMENT_TYPES, SEASONS, CONCRETE_CLASSES, CEMENT_TYPES, DEFAULT_FORM } from './types';
import { Download, Hourglass, Star } from 'lucide-react';
import CalculatorFormFields from './CalculatorFormFields';
import WizardHintsPanel, { ReviewHint } from './WizardHints';

// ─── Props ─────────────────────────────────────────────────────────────────

export interface CalculatorSidebarProps {
  // Form state
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  result: PlannerOutput | null;
  setResult: (r: PlannerOutput | null) => void;
  error: string | null;
  setError: (e: string | null) => void;

  // Wizard
  wizardMode: boolean;
  wizardStep: number;
  wizardCanAdvance: boolean;
  wizardNext: () => void;
  wizardBack: () => void;
  wizardVisible: Record<string, boolean>;
  wizardHint1: any;
  wizardHint2: CuringResult | null;
  wizardHint3: any;
  wizardHint4: any;

  // UI toggles
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  showNorms: boolean;
  setShowNorms: (v: boolean) => void;
  showProductivityNorms: boolean;
  setShowProductivityNorms: (v: boolean) => void;

  // AI advisor
  advisor: AIAdvisorResult | null;
  advisorLoading: boolean;
  setAdvisor: (v: AIAdvisorResult | null) => void;
  setAdvisorLoading: (v: boolean) => void;

  // Document suggestions
  docSuggestions: DocSuggestionsResponse | null;
  docSugLoading: boolean;
  acceptedParams: Set<string>;
  onAcceptSuggestion: (param: string, value: any) => void;
  onDismissSuggestion: (param: string) => void;

  // Comparison
  comparison: any[] | null;
  setComparison: (v: any[] | null) => void;
  showComparison: boolean;
  setShowComparison: (v: boolean) => void;

  // Context
  positionContext: any;
  isMonolitMode: boolean;
  autoClassification: { source?: string; confidence: number; element_type: string } | null;

  // Actions
  handleCalculate: () => void;
  handleCompare: () => void;
  fetchAdvisor: () => void;
  /** A2: false until volume_m3 > 0 and element_type is set */
  canCalculate: boolean;

  // Form update helper
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;

  // Norms scraping
  normsScraping: boolean;
  setNormsScraping: (v: boolean) => void;
  normsScrapeResult: string | null;
  setNormsScrapeResult: (v: string | null) => void;

  // Variant save
  onSaveVariant?: () => void;

  // Config
  apiUrl: string;
  isAdmin: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function CalculatorSidebar(props: CalculatorSidebarProps) {
  const {
    form, setForm, result, setResult, error, setError,
    wizardMode, wizardStep, wizardCanAdvance, wizardNext, wizardBack, wizardVisible,
    wizardHint1, wizardHint2, wizardHint3, wizardHint4,
    showAdvanced, setShowAdvanced, showNorms, setShowNorms, showProductivityNorms, setShowProductivityNorms,
    advisor, advisorLoading, setAdvisor, setAdvisorLoading,
    docSuggestions, docSugLoading, acceptedParams, onAcceptSuggestion, onDismissSuggestion,
    comparison, setComparison, showComparison, setShowComparison,
    positionContext, isMonolitMode, autoClassification,
    handleCalculate, handleCompare, fetchAdvisor, canCalculate,
    update,
    normsScraping, setNormsScraping, normsScrapeResult, setNormsScrapeResult,
    onSaveVariant,
    apiUrl, isAdmin,
  } = props;

  // Alias for backward compatibility with extracted JSX
  const classificationHint = autoClassification;
  const IS_ADMIN = isAdmin;

  // Helper: get suggestion for a param
  const getSuggestion = (param: string): DocSuggestion | undefined => {
    if (!docSuggestions) return undefined;
    return docSuggestions.suggestions.find(s => s.param === param && !acceptedParams.has(param));
  };

  return (
    <aside className="r0-planner-sidebar">
      {/* ── Wizard step indicator ── */}
      {wizardMode && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--r0-slate-800)' }}>
              Krok {wizardStep} z 5: {['Element', 'Objem a beton', 'Geometrie', 'Výztuž a zdroje', 'Záběry a podmínky'][wizardStep - 1]}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ height: 4, background: 'var(--r0-slate-200)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${(wizardStep / 5) * 100}%`,
              background: 'var(--r0-orange, #f59e0b)', borderRadius: 2,
              transition: 'width 0.2s ease',
            }} />
          </div>
        </div>
      )}

      {/* Document suggestions banner */}
      {docSugLoading && <div style={{ fontSize: 11, color: 'var(--r0-slate-400)', marginBottom: 8 }}>Analyzuji dokumenty projektu…</div>}
      <DocWarningsBanner response={docSuggestions} />

          {/* ─── Element ─── */}
          <div className={wizardVisible.element ? 'r0-wizard-step' : ''} style={wizardVisible.element ? undefined : { display: 'none' }}>
          <Section title="Element">
            {/* 2026-04-15: removed the misleading "Klasifikace podle názvu
                (AI)" checkbox + the element_name text input it gated. The
                underlying classifier is regex + OTSKP keyword matching
                (not an LLM) and already runs unconditionally on
                position-context load via useCalculator.initialForm. The
                badge below the dropdown still surfaces that result. */}
            <Field label="Typ elementu">
              <select
                style={inputStyle}
                value={form.element_type}
                onChange={e => {
                  const next = e.target.value as StructuralElementType;
                  if (next === form.element_type) return;
                  // A1 (2026-04-15): clear stale results when the user
                  // switches element type. Without this, the right-hand
                  // KPI cards show old numbers from the previous type
                  // (e.g. 136 m³ bednění from Dříky leaking into Pilota)
                  // until the next recalc kicks in. Form values are
                  // preserved so the user can re-run instantly.
                  update('element_type', next);
                  setResult(null);
                  setError(null);
                  setComparison(null);
                  setShowComparison(false);
                }}
              >
                {(() => {
                  const groups = [...new Set(ELEMENT_TYPES.map(t => t.group).filter(Boolean))];
                  const ungrouped = ELEMENT_TYPES.filter(t => !t.group);
                  return (
                    <>
                      {groups.map(g => (
                        <optgroup key={g} label={g}>
                          {ELEMENT_TYPES.filter(t => t.group === g).map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </optgroup>
                      ))}
                      {ungrouped.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </>
                  );
                })()}
              </select>
              {classificationHint && form.element_type === classificationHint.element_type && (
                <div style={{
                  marginTop: 4, fontSize: 10, padding: '3px 8px', borderRadius: 4,
                  background: classificationHint.source === 'otskp' ? '#ecfdf5' : '#eff6ff',
                  color: classificationHint.source === 'otskp' ? '#065f46' : '#1e40af',
                  border: `1px solid ${classificationHint.source === 'otskp' ? '#a7f3d0' : '#bfdbfe'}`,
                }}>
                  Rozpoznáno z {classificationHint.source === 'otskp' ? 'OTSKP katalogu' : 'klíčových slov'}{' '}
                  (confidence {(classificationHint.confidence * 100).toFixed(0)}%)
                </div>
              )}
            </Field>
          </Section>

          {/* ─── Mostovková deska: bridge config + context hint ─── */}
          <div style={{
            maxHeight: form.element_type === 'mostovkova_deska' ? 900 : 0,
            opacity: form.element_type === 'mostovkova_deska' ? 1 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.3s ease, opacity 0.2s ease, margin 0.3s ease',
            marginBottom: form.element_type === 'mostovkova_deska' ? 12 : 0,
          }}>
              <div style={{
                padding: '10px 12px', marginBottom: 12,
                background: 'var(--r0-info-bg)', border: '1px solid var(--r0-info-border)', borderRadius: 6,
                fontSize: 11, color: 'var(--r0-info-text)', lineHeight: 1.6,
              }}>
                <strong>Mostovková deska — logika záběrů:</strong><br/>
                <strong>Bez dilatačních spár:</strong> zálivka v jednom průchodu → navýšit čerpadla, osádku a kapacitu čerstvého betonu.<br/>
                <strong>Se spárami:</strong> sekční postup, šachovnicový pořadí; počet souprav bednění = počet souběžných záběrů.<br/>
                <strong>Levý + pravý most:</strong> bez spár = 2 kompletní soupravy; se spárami = šachovnice napříč mosty nebo postup z obou konců.
              </div>
              <Field label="Počet mostů">
                <select
                  style={inputStyle}
                  value={form.num_bridges}
                  onChange={e => update('num_bridges', parseInt(e.target.value))}
                >
                  <option value={1}>1 — jeden most</option>
                  <option value={2}>2 — levý + pravý (souběžné)</option>
                </select>
              </Field>
              <Field label="Typ nosné konstrukce">
                <select
                  style={inputStyle}
                  value={form.bridge_deck_subtype}
                  onChange={e => update('bridge_deck_subtype', e.target.value)}
                >
                  <option value="">Deskový (plná deska)</option>
                  <option value="deskovy">Deskový (plná deska)</option>
                  <option value="jednotram">Trámový — jednotrámový (T-průřez)</option>
                  <option value="dvoutram">Trámový — dvoutrámový (π-průřez)</option>
                  <option value="vicetram">Trámový — vícetrámový (3+ trámů)</option>
                  <option value="jednokomora">Komorový — jednokomorový</option>
                  <option value="dvoukomora">Komorový — dvoukomorový</option>
                  <option value="ramovy">Rámový most</option>
                  <option value="sprazeny">Spřažený (prefab + monolit)</option>
                </select>
              </Field>
              <Field label="Předpjatý beton">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.is_prestressed}
                    onChange={e => update('is_prestressed', e.target.checked)}
                  />
                  <span style={{ fontSize: 12 }}>Předpjatá NK (kabely Y1860S7, injektáž)</span>
                </label>
              </Field>

              {/* ─── Parametry mostu (bridge geometry) ─── */}
              <div style={{
                marginTop: 8, padding: '10px 12px',
                background: 'var(--r0-slate-50)', border: '1px solid var(--r0-slate-200)', borderRadius: 6,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r0-slate-600)', marginBottom: 8 }}>
                  Parametry mostu (nepovinné — pro doporučení technologie)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <Field label="Rozpětí pole (m)">
                    <input style={inputStyle} type="number" step="0.5" min="5" max="200"
                      placeholder="např. 36"
                      value={form.span_m}
                      onChange={e => update('span_m', e.target.value)} />
                  </Field>
                  <Field label="Počet polí">
                    <input style={inputStyle} type="number" step="1" min="1" max="30"
                      placeholder="např. 9"
                      value={form.num_spans}
                      onChange={e => update('num_spans', e.target.value)} />
                  </Field>
                  <Field label="Šířka NK (m)">
                    <input style={inputStyle} type="number" step="0.1" min="3" max="30"
                      placeholder="12"
                      value={form.nk_width_m}
                      onChange={e => update('nk_width_m', e.target.value)} />
                  </Field>
                </div>
                {form.span_m && form.num_spans && (
                  <div style={{ fontSize: 11, color: 'var(--r0-slate-500)', marginTop: 4 }}>
                    Celková délka NK: {(parseFloat(form.span_m) * parseInt(form.num_spans)).toFixed(0)} m
                    {form.nk_width_m && ` | Plocha NK: ${(parseFloat(form.span_m) * parseInt(form.num_spans) * parseFloat(form.nk_width_m)).toFixed(0)} m²`}
                  </div>
                )}

                {/* Technology recommendation */}
                {(() => {
                  const spanVal = parseFloat(form.span_m);
                  const numSpansVal = parseInt(form.num_spans);
                  const heightVal = parseFloat(form.height_m) || 10;
                  if (!spanVal || !numSpansVal || spanVal < 5 || numSpansVal < 1) return null;

                  const techRec = recommendBridgeTechnology({
                    span_m: spanVal,
                    clearance_height_m: heightVal,
                    num_spans: numSpansVal,
                    deck_subtype: form.bridge_deck_subtype || undefined,
                    is_prestressed: form.is_prestressed,
                    nk_width_m: parseFloat(form.nk_width_m) || undefined,
                  });

                  const selectedTech = form.construction_technology || techRec.recommended;

                  return (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--r0-slate-600)', marginBottom: 6 }}>
                        Technologie výstavby
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {techRec.options.map((opt: { technology: string; label_cs: string; feasible: boolean; infeasible_reason?: string; is_recommended: boolean }) => (
                          <label key={opt.technology} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            cursor: opt.feasible ? 'pointer' : 'not-allowed',
                            opacity: opt.feasible ? 1 : 0.5,
                            fontSize: 12,
                          }}>
                            <input
                              type="radio"
                              name="construction_technology"
                              value={opt.technology}
                              checked={selectedTech === opt.technology}
                              disabled={!opt.feasible}
                              onChange={() => update('construction_technology', opt.technology as FormState['construction_technology'])}
                            />
                            <span>
                              {opt.label_cs}
                              {opt.is_recommended && <span style={{ color: '#16a34a', fontWeight: 600, marginLeft: 4 }}>DOPORUČENO</span>}
                              {!opt.feasible && opt.infeasible_reason && (
                                <span style={{ color: 'var(--r0-slate-400)', marginLeft: 4 }}>— {opt.infeasible_reason}</span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>

                      {/* Recommendation card */}
                      <div style={{
                        marginTop: 8, padding: '8px 10px', borderRadius: 6,
                        background: selectedTech === techRec.recommended ? '#f0fdf4' : '#fefce8',
                        border: `1px solid ${selectedTech === techRec.recommended ? '#bbf7d0' : '#fef08a'}`,
                        fontSize: 11, lineHeight: 1.6,
                      }}>
                        <div style={{ fontWeight: 700, color: selectedTech === techRec.recommended ? '#166534' : '#854d0e', marginBottom: 2 }}>
                          {selectedTech === techRec.recommended ? '✓' : '⚠'} {selectedTech === techRec.recommended ? 'DOPORUČENO' : 'Uživatelský výběr'}:{' '}
                          {techRec.options.find((o: { technology: string; label_cs: string }) => o.technology === selectedTech)?.label_cs}
                        </div>
                        <div style={{ color: 'var(--r0-slate-600)' }}>
                          {techRec.reason}
                        </div>
                        {selectedTech === 'mss' && (
                          <div style={{ marginTop: 4, color: 'var(--r0-slate-500)' }}>
                            Záběr: 1 pole ({spanVal}m × {parseFloat(form.nk_width_m) || 12}m = {(spanVal * (parseFloat(form.nk_width_m) || 12)).toFixed(0)} m²)
                            {' | '}Počet taktů: {numSpansVal}
                            {' | '}Orientační doba: {numSpansVal} × {getMSSTactDays(form.bridge_deck_subtype || undefined)} dní + montáž/demontáž
                          </div>
                        )}
                      </div>

                      {/* MSS tact duration override */}
                      {selectedTech === 'mss' && (
                        <div style={{ marginTop: 6 }}>
                          <Field label="Doba taktu MSS (dní/pole)" hint="auto dle typu NK">
                            <input style={inputStyle} type="number" step="1" min="7" max="60"
                              placeholder={String(getMSSTactDays(form.bridge_deck_subtype || undefined))}
                              value={form.mss_tact_days}
                              onChange={e => update('mss_tact_days', e.target.value)} />
                          </Field>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
          </div>

          {/* ─── Opěry: composite křídla toggle ─── */}
          {form.element_type === 'opery_ulozne_prahy' && (
            <div style={{
              maxHeight: 120, opacity: 1,
              transition: 'max-height 0.3s ease, opacity 0.2s ease',
              marginBottom: 12,
            }}>
              <Field label="Součástí jsou křídla">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.include_kridla}
                    onChange={e => update('include_kridla', e.target.checked)}
                  />
                  <span style={{ fontSize: 12 }}>Zahrnout křídla opěr (samostatná sada bednění)</span>
                </label>
              </Field>
              {form.include_kridla && (
                <Field label="Výška křídel (m)">
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    min="0.5"
                    placeholder="Typicky 1.8–6.0 m"
                    value={form.kridla_height_m}
                    onChange={e => update('kridla_height_m', e.target.value)}
                  />
                </Field>
              )}
            </div>
          )}

          {/* ─── Římsa: length-based pour hint ─── */}
          {form.element_type === 'rimsa' && (
            <div style={{
              padding: '10px 12px', marginBottom: 12,
              background: 'var(--r0-info-bg)', border: '1px solid var(--r0-info-border)', borderRadius: 6,
              fontSize: 11, color: 'var(--r0-info-text)', lineHeight: 1.6,
            }}>
              <strong>Římsa — záběry podle délky mostu:</strong><br/>
              Římsy se betonují po úsecích 20–30 m (default 20 m). Počet záběrů závisí na celkové délce mostu.<br/>
              Zadejte délku mostu v sekci záběrů pro správný výpočet.
            </div>
          )}

          {/* ─── AI Advisor Button ─── */}
          <button
            onClick={fetchAdvisor}
            disabled={advisorLoading}
            style={{
              width: '100%', padding: '10px', marginBottom: 12,
              background: advisorLoading ? 'var(--r0-slate-300)' : 'linear-gradient(135deg, var(--r0-indigo), var(--r0-purple))',
              color: 'white', border: 'none', borderRadius: 6,
              fontSize: 13, fontWeight: 600, cursor: advisorLoading ? 'wait' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {advisorLoading ? '⏳ AI analyzuje...' : '✨ AI doporučení (podstup, bednění, normy)'}
          </button>

          {/* ─── AI Advisor Results ─── */}
          {advisor && (
            <div style={{
              marginBottom: 12, padding: '10px 12px',
              background: 'var(--r0-ai-bg)', border: '1px solid var(--r0-ai-border)', borderRadius: 6,
              fontSize: 12, lineHeight: 1.6,
            }}>
              {/* Approach recommendation */}
              {advisor.approach?.parsed && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, color: 'var(--r0-ai-text)', marginBottom: 4 }}>Doporučený postup:</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: advisor.approach.parsed.pour_mode === 'sectional' ? 'var(--r0-badge-blue-bg)' : 'var(--r0-badge-green-bg)',
                      color: advisor.approach.parsed.pour_mode === 'sectional' ? 'var(--r0-badge-blue-text)' : 'var(--r0-badge-green-text)',
                    }}>
                      {advisor.approach.parsed.pour_mode === 'sectional' ? 'Záběrový' : 'Monolitický'}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: 'var(--r0-badge-amber-bg)', color: 'var(--r0-warn-text)',
                    }}>
                      {advisor.approach.parsed.sub_mode || 'auto'}
                    </span>
                    {advisor.approach.parsed.recommended_tacts && (
                      <span style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11,
                        background: 'var(--r0-badge-indigo-bg)', color: 'var(--r0-badge-indigo-text)',
                      }}>
                        {advisor.approach.parsed.recommended_tacts} záběrů
                      </span>
                    )}
                  </div>
                  {advisor.approach.parsed.reasoning && (
                    <div style={{ color: 'var(--r0-ai-muted)', fontSize: 11 }}>
                      {advisor.approach.parsed.reasoning}
                    </div>
                  )}
                  {advisor.approach.parsed.pump_type && (
                    <div style={{ color: 'var(--r0-ai-muted)', fontSize: 11, marginTop: 2 }}>
                      Čerpadlo: <strong>{advisor.approach.parsed.pump_type}</strong>
                    </div>
                  )}
                </div>
              )}
              {advisor.approach && !advisor.approach.parsed && advisor.approach.text && (
                <div style={{ marginBottom: 8, color: 'var(--r0-ai-muted)', fontSize: 12, lineHeight: 1.5 }}>
                  {advisor.approach.text
                    .replace(/[{}"]/g, '')
                    .replace(/,\s*/g, '\n')
                    .split('\n')
                    .filter((line: string) => line.trim())
                    .slice(0, 10)
                    .map((line: string, i: number) => {
                      const [key, ...rest] = line.split(':');
                      const val = rest.join(':').trim();
                      if (!val) return <div key={i}>{line.trim()}</div>;
                      const label: Record<string, string> = {
                        pour_mode: 'Postup', sub_mode: 'Režim', recommended_tacts: 'Záběry',
                        tact_volume_m3: 'Objem záběru', reasoning: 'Zdůvodnění',
                        warnings: 'Upozornění', overtime_recommendation: 'Přesčas',
                        pump_type: 'Čerpadlo',
                      };
                      return (
                        <div key={i} style={{ marginBottom: 2 }}>
                          <strong>{label[key.trim()] || key.trim()}:</strong>{' '}
                          {val.replace(/[\[\]]/g, '')}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Formwork suggestion */}
              {advisor.formwork_suggestion?.recommended && (
                <div style={{ marginBottom: 8, paddingTop: 8, borderTop: '1px solid var(--r0-ai-divider)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--r0-ai-text)', marginBottom: 4 }}>Doporučené bednění:</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: 'var(--r0-norms-border)', color: 'var(--r0-norms-text)',
                    }}>
                      {advisor.formwork_suggestion.recommended.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--r0-slate-500)' }}>
                      ({advisor.formwork_suggestion.recommended.manufacturer})
                    </span>
                    <button
                      onClick={() => {
                        update('formwork_system_name', advisor.formwork_suggestion!.recommended!.name);
                        setShowAdvanced(true);
                      }}
                      style={{
                        padding: '2px 8px', border: '1px solid var(--r0-indigo)', borderRadius: 4,
                        background: 'white', color: 'var(--r0-indigo)', fontSize: 10, cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Použít
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--r0-ai-muted)', marginTop: 4 }}>
                    {advisor.formwork_suggestion.tip}
                  </div>
                  {advisor.formwork_suggestion.alternatives.length > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--r0-slate-500)', marginTop: 2 }}>
                      Alternativy: {advisor.formwork_suggestion.alternatives.map(a => a.name).join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Norms */}
              {advisor.norms?.answer && (
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--r0-ai-divider)' }}>
                  <button
                    onClick={() => setShowNorms(!showNorms)}
                    style={{
                      background: 'none', border: 'none', color: 'var(--r0-indigo)', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, padding: 0, fontFamily: 'inherit',
                    }}
                  >
                    {showNorms ? '▼' : '▶'} Relevantní normy ČSN EN
                    {advisor.norms.sources?.length > 0 && ` (${advisor.norms.sources.length} zdrojů)`}
                  </button>
                  {showNorms && (
                    <div style={{
                      marginTop: 6, fontSize: 11, color: 'var(--r0-ai-text)',
                      whiteSpace: 'pre-wrap', lineHeight: 1.5,
                      maxHeight: 200, overflowY: 'auto',
                    }}>
                      {advisor.norms.answer}
                    </div>
                  )}
                </div>
              )}

              {/* Productivity Norms (from methvin.co) */}
              <div style={{ paddingTop: 8, borderTop: '1px solid var(--r0-ai-divider)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {advisor.productivity_norms?.data && Object.keys(advisor.productivity_norms.data).length > 0 ? (
                    <button
                      onClick={() => setShowProductivityNorms(!showProductivityNorms)}
                      style={{
                        background: 'none', border: 'none', color: 'var(--r0-green-dark)', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, padding: 0, fontFamily: 'inherit',
                      }}
                    >
                      {showProductivityNorms ? '▼' : '▶'} Výrobní normy (methvin.co)
                      {` — ${advisor.productivity_norms.work_types?.join(', ')}`}
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--r0-slate-400)' }}>
                      Výrobní normy zatím nestaženy
                    </span>
                  )}
                  {/* Scrape button — admin only (VITE_ADMIN_MODE=true) */}
                  {IS_ADMIN && (
                    <button
                      disabled={normsScraping}
                      onClick={async () => {
                        setNormsScraping(true);
                        setNormsScrapeResult(null);
                        try {
                          // Proxy through Monolit backend to avoid CORS issues
                          const r = await fetch(`${apiUrl}/api/planner-advisor/norms/scrape-all`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({}),
                          });
                          if (r.ok) {
                            const data = await r.json();
                            const cats = data.summary?.categories || {};
                            const total = Object.keys(cats).length;
                            const ok = Object.values(cats).filter((c: any) => c.has_data).length;
                            setNormsScrapeResult(`Staženo ${ok}/${total} kategorií (${data.summary?.total_queries || '?'} dotazů)`);
                          } else {
                            setNormsScrapeResult('Chyba při stahování');
                          }
                        } catch (e: any) {
                          setNormsScrapeResult(`Chyba: ${e.message}`);
                        }
                        setNormsScraping(false);
                        // Refresh advisor to pick up new norms
                        fetchAdvisor();
                      }}
                      style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 4,
                        border: '1px solid var(--r0-slate-300)', background: normsScraping ? 'var(--r0-slate-100)' : 'var(--r0-norms-bg)',
                        color: 'var(--r0-green-dark)', cursor: normsScraping ? 'wait' : 'pointer',
                        fontFamily: 'inherit', fontWeight: 500,
                      }}
                    >
                      {normsScraping ? <><Hourglass size={14} className="inline" /> Stahuji všechny normy...</> : <><Download size={14} className="inline" /> Stáhnout všechny normy z methvin.co</>}
                    </button>
                  )}
                </div>
                {normsScrapeResult && (
                  <div style={{ fontSize: 10, color: 'var(--r0-green-dark)', marginTop: 4 }}>
                    {normsScrapeResult}
                  </div>
                )}
                {showProductivityNorms && advisor.productivity_norms?.data && (
                  <div style={{
                    marginTop: 6, fontSize: 11, color: 'var(--r0-norms-text)',
                    maxHeight: 300, overflowY: 'auto',
                  }}>
                    {Object.entries(advisor.productivity_norms.data).map(([key, val]) => {
                      const items = Array.isArray(val) ? val : typeof val === 'object' && val ? [val] : [];
                      return (
                        <div key={key} style={{ marginBottom: 8 }}>
                          <div style={{ fontWeight: 600, color: 'var(--r0-norms-accent)', marginBottom: 2 }}>
                            {key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </div>
                          {items.length > 0 ? (
                            <table style={{ fontSize: 10, borderCollapse: 'collapse', width: '100%' }}>
                              <tbody>
                                {items.slice(0, 20).map((item: any, i: number) => (
                                  <tr key={i} style={{ borderBottom: '1px solid var(--r0-norms-border)' }}>
                                    {typeof item === 'object' ? (
                                      Object.entries(item).slice(0, 5).map(([k, v]) => (
                                        <td key={k} style={{ padding: '2px 6px', verticalAlign: 'top' }}>
                                          <span style={{ color: 'var(--r0-muted)' }}>{k}: </span>
                                          <span style={{ color: 'var(--r0-norms-text)' }}>{String(v)}</span>
                                        </td>
                                      ))
                                    ) : (
                                      <td style={{ padding: '2px 6px', color: 'var(--r0-norms-text)' }}>{String(item)}</td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div style={{ fontSize: 10, color: 'var(--r0-norms-text)', padding: '2px 6px' }}>
                              {typeof val === 'string' ? val : JSON.stringify(val, null, 2).slice(0, 500)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 9, color: 'var(--r0-muted)', marginTop: 4 }}>
                      Zdroj: {advisor.productivity_norms.source}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ fontSize: 10, color: 'var(--r0-slate-400)', marginTop: 6, textAlign: 'right' }}>
                Model: {advisor.approach?.model || 'vertex-ai'}
              </div>
            </div>
          )}

          {/* Wizard hint: element profile */}
          {wizardMode && wizardStep === 1 && wizardHint1 && (
            <div style={{ margin: '8px 0 12px', padding: '10px 12px', background: 'var(--r0-info-bg, #eff6ff)', border: '1px solid var(--r0-info-border, #bfdbfe)', borderRadius: 6, fontSize: 11, lineHeight: 1.6, color: 'var(--r0-slate-700)' }}>
              <strong>{wizardHint1.label_cs}</strong>
              <div style={{ marginTop: 4, color: 'var(--r0-slate-500)' }}>
                Orientace: {wizardHint1.orientation === 'vertical' ? 'svislý' : 'vodorovný'}
                {' | '}Obtížnost: {wizardHint1.difficulty_factor}x
                {' | '}Výztuž: ~{wizardHint1.rebar_ratio_kg_m3} kg/m³
                {wizardHint1.needs_supports ? ' | Podpěry: ano' : ''}
                {wizardHint1.needs_crane ? ' | Jeřáb: ano' : ''}
              </div>
              {wizardHint1.orientation === 'vertical' && (
                <div style={{ marginTop: 4, fontSize: 10, color: 'var(--r0-slate-400)' }}>
                  Betonáž po výškových záběrech — výška záběru omezena bočním tlakem na bednění (DIN 18218)
                </div>
              )}
            </div>
          )}
          {/* Smart wizard hints: missing/sanity/technology/review (HINT-1,2,3,4) */}
          <WizardHintsPanel
            wizardMode={wizardMode}
            wizardStep={wizardStep}
            elementType={form.element_type}
            form={form}
            currentSystemName={form.formwork_system_name}
            onApplyRecommendedSystem={(systemName, numTacts) => {
              update('formwork_system_name', systemName);
              if (numTacts && numTacts > 1) {
                update('tact_mode', 'manual');
                update('num_tacts_override', String(numTacts));
              }
            }}
          />
          </div>{/* /wizard element */}


      {/* Remaining form sections: Objemy, Záběry, Podmínky, Beton, Zdroje, Bednění, Simulace */}
      <CalculatorFormFields {...props} getSuggestion={getSuggestion} />


      {/* ── Action buttons ── */}
      {wizardMode && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            onClick={wizardBack}
            disabled={wizardStep <= 1}
            style={{
              flex: 1, padding: '10px 16px', border: '1px solid var(--r0-slate-300)',
              borderRadius: 6, background: 'white', cursor: wizardStep > 1 ? 'pointer' : 'not-allowed',
              fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
              color: wizardStep > 1 ? 'var(--r0-slate-700)' : 'var(--r0-slate-300)',
            }}
          >
            ← Zpět
          </button>
          <button
            onClick={wizardNext}
            disabled={!wizardCanAdvance}
            style={{
              flex: 1, padding: '10px 16px', border: 'none', borderRadius: 6,
              background: wizardCanAdvance ? 'var(--r0-orange)' : 'var(--r0-slate-300)',
              color: 'white', cursor: wizardCanAdvance ? 'pointer' : 'not-allowed',
              fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            {wizardStep === 5 ? 'Vypočítat →' : 'Další →'}
          </button>
        </div>
      )}
      {/* D1/D3 (2026-04-15): Ceny section — always visible above the
          Vypočítat button. Empty inputs = odhad with warning in the
          cost table; "Počítat bez cen" toggle switches to harmonogram-only
          presentation (costs rendered as "— (zadejte ceny)"). */}
      <div style={{ marginTop: 16 }}>
        <Section title="Ceny (volitelné)">
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 8, fontSize: 12, color: 'var(--r0-slate-600)',
            cursor: 'pointer', userSelect: 'none',
          }}>
            <input
              type="checkbox"
              checked={form.price_mode === 'schedule_only'}
              onChange={e => update('price_mode', e.target.checked ? 'schedule_only' : 'full')}
            />
            Počítat bez cen (pouze harmonogram)
          </label>
          {form.price_mode === 'full' && (
            <>
              <div style={{
                fontSize: 10, color: 'var(--r0-slate-400)',
                marginBottom: 6, lineHeight: 1.5,
              }}>
                Prázdná pole = odhad (zobrazeno s varováním). Vyplněná = vaše sazby.
              </div>
              {/* Jeřáb */}
              <Field label="Jeřáb (Kč/směna)">
                <NumInput style={inputStyle} value={form.price_crane_czk_shift} min={0}
                  onChange={v => update('price_crane_czk_shift', String(v))}
                  placeholder="odhad" />
              </Field>
              {/* Čerpadlo */}
              <Field label="Čerpadlo (Kč/h)">
                <NumInput style={inputStyle} value={form.price_pump_czk_h} min={0}
                  onChange={v => update('price_pump_czk_h', String(v))}
                  placeholder="odhad" />
              </Field>
              {/* Pile rig — only for pilota */}
              {form.element_type === 'pilota' && (
                <Field label="Vrtací souprava (Kč/směna)">
                  <NumInput style={inputStyle} value={form.pile_rig_czk_per_shift} min={0}
                    onChange={v => update('pile_rig_czk_per_shift', String(v))}
                    placeholder="25 000 (odhad)" />
                </Field>
              )}
            </>
          )}
          {form.price_mode === 'schedule_only' && (
            <div style={{
              padding: '8px 10px',
              background: 'var(--r0-warn-bg, #fffbeb)',
              border: '1px solid var(--r0-warn-border, #fde68a)',
              borderRadius: 6,
              fontSize: 11, color: 'var(--r0-slate-700)', lineHeight: 1.5,
            }}>
              Režim <strong>Harmonogram</strong>: karty nákladů zobrazí
              &ldquo;— (zadejte ceny)&rdquo;. Plán dnů, záběrů, čet a PERT se počítá normálně.
            </div>
          )}
        </Section>
      </div>

      {/* Expert mode: review summary above the calculate button (Task 1) */}
      {!wizardMode && (
        <div style={{ marginTop: 16 }}>
          <ReviewHint
            elementType={form.element_type}
            form={form}
          />
        </div>
      )}
      {/* Expert mode: normal calculate button */}
      {!wizardMode && (
      <>
      <button
        onClick={handleCalculate}
        disabled={!canCalculate}
        title={!canCalculate ? 'Vyplňte typ elementu a objem betonu' : undefined}
        style={{
          width: '100%', padding: '12px', marginTop: 8,
          background: canCalculate ? 'var(--r0-orange)' : 'var(--r0-slate-200)',
          color: canCalculate ? 'white' : 'var(--r0-slate-400)',
          border: 'none',
          borderRadius: 6, fontSize: 15, fontWeight: 700,
          cursor: canCalculate ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
        }}
      >
        Vypočítat plán
      </button>
      {!canCalculate && (
        <div style={{
          marginTop: 6, fontSize: 11, color: 'var(--r0-slate-500)',
          textAlign: 'center', fontStyle: 'italic',
        }}>
          Zadejte typ elementu a objem betonu
        </div>
      )}
      </>
      )}
      {/* 2026-04-15: the formwork comparison button is always rendered,
          but DISABLED for piles (B1) with an explanatory tooltip so the
          user sees it exists for other element types. */}
      {result && (() => {
        const isPile = result.element.type === 'pilota' || form.element_type === 'pilota';
        return (
          <button
            onClick={isPile ? undefined : handleCompare}
            disabled={isPile}
            title={isPile ? 'Pilota nemá systémové bednění — není co porovnávat.' : undefined}
            style={{
              width: '100%', padding: '12px', marginTop: 8,
              background: isPile ? 'var(--r0-slate-200)' : 'var(--r0-orange)',
              color: isPile ? 'var(--r0-slate-400)' : 'white',
              border: 'none',
              borderRadius: 6, fontSize: 14, fontWeight: 700,
              cursor: isPile ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Porovnat bednění (všechny systémy)
          </button>
        );
      })()}
      {result && onSaveVariant && (
        <button
          onClick={onSaveVariant}
          style={{
            width: '100%', padding: '10px', marginTop: 8,
            background: 'white', color: 'var(--r0-slate-700)',
            border: '1px solid var(--r0-slate-300)',
            borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Uložit variantu
        </button>
      )}

      <button
        onClick={() => { setForm(DEFAULT_FORM); setResult(null); setError(null); setAdvisor(null); setComparison(null); }}
        style={{
          width: '100%', padding: '6px', marginTop: 8,
          background: 'none', color: 'var(--r0-slate-400)',
          border: '1px solid var(--r0-slate-300, #cbd5e1)',
          borderRadius: 6, fontSize: 11, cursor: 'pointer',
        }}
      >
        Resetovat formulář
      </button>

      {error && (
        <div style={{
          marginTop: 12, padding: 12, background: 'var(--r0-error-bg)',
          border: '1px solid var(--r0-error-border)', borderRadius: 6, color: 'var(--r0-error-text)', fontSize: 13,
        }}>
          {error}
        </div>
      )}
    </aside>
  );
}
