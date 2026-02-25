/**
 * FormworkAIModal
 *
 * AI-assisted formwork scheduling wizard.
 * Opens from ✨ button in FormworkCalculatorModal.
 *
 * Flow:
 * Two tabs:
 *  [Kalkulačka] — 4 questions → POST /api/formwork-assistant → results + apply
 *  [Poradna]    — free-text question → POST /api/kb/research → answer + sources
 *               Answers cached in concrete-agent KB (no repeat API cost).
 */

import { useState } from 'react';
import { Sparkles, Zap, Brain, Bot, AlertTriangle, CheckCircle, X, BookOpen, Database, Globe } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConstructionType = 'zakladove_pasy' | 'pilire_mostu' | 'mostovka' | 'steny' | 'sloupy' | 'rimsy';
type Season           = 'leto' | 'podzim_jaro' | 'zima';
type ConcreteClass    = 'C20_25' | 'C25_30' | 'C30_37' | 'C35_45' | 'C40_50';
type CementType       = 'CEM_I_II' | 'CEM_III';
type Crew             = '2_bez_jeravu' | '4_bez_jeravu' | '4_s_jeravem' | '6_s_jeravem';
type AIModel          = 'gemini' | 'claude' | 'openai';
type ModalTab         = 'kalkulacka' | 'poradna';

interface Answers {
  construction_type: ConstructionType;
  season:            Season;
  concrete_class:    ConcreteClass;
  cement_type:       CementType;
  crew:              Crew;
}

interface Deterministic {
  pocet_taktu:               number;
  set_area_m2:               number;
  total_area_m2:             number;
  assembly_days_per_tact:    number;
  disassembly_days_per_tact: number;
  days_per_tact:             number;
  zrani_days:                number;
  base_curing_days:          number;
  temp_factor:               number;
  cement_factor:             number;
  formwork_term_days:        number;
  crew_size:                 number;
  shift_hours:               number;
  crane:                     boolean;
}

interface AssistantResult {
  success:        boolean;
  deterministic:  Deterministic;
  ai_explanation: string;
  warnings:       string[];
  model_used:     string;
}

interface KBSource {
  url:   string;
  title: string;
}

interface KBResearchResult {
  answer:      string;
  sources:     KBSource[];
  from_kb:     boolean;
  kb_saved:    boolean;
  kb_category: string;
  model_used:  string;
}

interface Props {
  /** Current row data — pre-fills context */
  totalAreaM2: number;
  setAreaM2:   number;
  systemName:  string;
  onApply:     (daysPerTact: number, formworkTermDays: number) => void;
  onClose:     () => void;
}

// ── Question definitions ──────────────────────────────────────────────────────

const Q1_OPTIONS: { value: ConstructionType; label: string; hint: string }[] = [
  { value: 'zakladove_pasy', label: 'Základové pásy / piloty', hint: 'Nízké stěny, hloubení' },
  { value: 'pilire_mostu',   label: 'Pilíře mostu',           hint: 'Výška takt max 3 m, XC4/XF3' },
  { value: 'mostovka',       label: 'Mostovka / deska',       hint: 'XD3/XF4, krytí 60 mm' },
  { value: 'steny',          label: 'Stěny / opěry',          hint: 'Standardní konstrukce' },
  { value: 'sloupy',         label: 'Sloupy',                 hint: 'Sloupové bednění SL-1' },
  { value: 'rimsy',          label: 'Římsы / konzoly',        hint: 'Vozíkové / konzolové bednění' },
];

const Q2_OPTIONS: { value: Season; label: string; factor: string }[] = [
  { value: 'leto',        label: 'Léto (>15 °C)',          factor: '×1.0' },
  { value: 'podzim_jaro', label: 'Podzim / jaro (5–15 °C)', factor: '×1.5' },
  { value: 'zima',        label: 'Zima (<5 °C)',            factor: '×3.0' },
];

const Q3_CLASS_OPTIONS: { value: ConcreteClass; label: string }[] = [
  { value: 'C20_25', label: 'C 20/25' },
  { value: 'C25_30', label: 'C 25/30' },
  { value: 'C30_37', label: 'C 30/37' },
  { value: 'C35_45', label: 'C 35/45' },
  { value: 'C40_50', label: 'C 40/50' },
];

const Q3_CEMENT_OPTIONS: { value: CementType; label: string; note: string }[] = [
  { value: 'CEM_I_II', label: 'CEM I / II',   note: 'Standardní rychlost'    },
  { value: 'CEM_III',  label: 'CEM III',       note: '×1.8 — pomalejší nárůst pevnosti' },
];

const Q4_OPTIONS: { value: Crew; label: string; hint: string }[] = [
  { value: '2_bez_jeravu', label: '2 lidé bez jeřábu', hint: 'Pomalá montáž, ruční přemisťování' },
  { value: '4_bez_jeravu', label: '4 lidé bez jeřábu', hint: 'Standardní tempo, středně těžké panely' },
  { value: '4_s_jeravem',  label: '4 lidé + jeřáb',   hint: '+20 % rychlost, těžké panely Framax' },
  { value: '6_s_jeravem',  label: '6 lidí + jeřáb',   hint: 'Nejvyšší tempo, velká plocha' },
];

// ── Component ─────────────────────────────────────────────────────────────────

const PORADNA_SUGGESTIONS = [
  'Jak se montuje bednění pilíře mostu?',
  'ČSN normy pro beton C30/37 — mostní konstrukce',
  'Minimální pevnost betonu pro odbednění stěny',
  'Technologický postup betonáže v zimě (pod 5 °C)',
  'Cena systémového bednění Doka 2025 Kč/m²',
  'Ošetřování betonu — požadavky TKP17',
];

export default function FormworkAIModal({ totalAreaM2, setAreaM2, systemName, onApply, onClose }: Props) {
  // ── Kalkulačka state ──────────────────────────────────────────────────────
  const [answers, setAnswers] = useState<Answers>({
    construction_type: 'steny',
    season:            'leto',
    concrete_class:    'C30_37',
    cement_type:       'CEM_I_II',
    crew:              '4_bez_jeravu',
  });
  const [model, setModel]     = useState<AIModel>('gemini');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<AssistantResult | null>(null);
  const [error, setError]     = useState<string>('');

  // ── Poradna state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]           = useState<ModalTab>('kalkulacka');
  const [poradnaQ, setPoradnaQ]             = useState('');
  const [poradnaResult, setPoradnaResult]   = useState<KBResearchResult | null>(null);
  const [poradnaLoading, setPoradnaLoading] = useState(false);
  const [poradnaError, setPoradnaError]     = useState('');

  function set<K extends keyof Answers>(key: K, val: Answers[K]) {
    setAnswers(prev => ({ ...prev, [key]: val }));
    setResult(null); // reset result on change
    setError('');
  }

  async function handleCalculate() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/formwork-assistant', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...answers,
          total_area_m2: totalAreaM2,
          set_area_m2:   setAreaM2,
          system_name:   systemName,
          model,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data: AssistantResult = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Chyba při výpočtu');
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!result) return;
    const { days_per_tact, formwork_term_days } = result.deterministic;
    onApply(days_per_tact, formwork_term_days);
    onClose();
  }

  async function handlePoradna() {
    if (!poradnaQ.trim()) return;
    setPoradnaLoading(true);
    setPoradnaError('');
    setPoradnaResult(null);
    try {
      const res = await fetch('/api/kb/research', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: poradnaQ.trim(), save_to_kb: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data: KBResearchResult = await res.json();
      setPoradnaResult(data);
    } catch (e: any) {
      setPoradnaError(e.message || 'Chyba při vyhledávání');
    } finally {
      setPoradnaLoading(false);
    }
  }

  const canCalculate = totalAreaM2 > 0 && setAreaM2 > 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: 'var(--panel-bg, #fff)',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '740px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 12px 48px rgba(0,0,0,0.35)',
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 22px',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} color="#FFD700" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px' }}>AI Průvodce Bedněním</div>
              <div style={{ fontSize: '11px', opacity: 0.75 }}>
                {systemName} · {totalAreaM2} m² celkem · {setAreaM2} m² / sada
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#aaa',
            cursor: 'pointer', padding: '4px'
          }}>
            <X size={20} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-default, #e2e8f0)',
          background: 'var(--panel-bg, #fff)',
        }}>
          {(['kalkulacka', 'poradna'] as ModalTab[]).map(tab => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--accent-orange, #FF9F1C)' : '2px solid transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: active ? 700 : 400,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s',
                  marginBottom: '-1px',
                }}
              >
                {tab === 'kalkulacka' ? <><Sparkles size={14} /> Kalkulačka</> : <><BookOpen size={14} /> Poradna norem</>}
              </button>
            );
          })}
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflow: 'auto', flex: 1, padding: '18px 22px' }}>

          {/* ══════════ PORADNA TAB ══════════ */}
          {activeTab === 'poradna' && (
            <div>
              {/* Intro */}
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginBottom: '14px',
                lineHeight: '1.5',
              }}>
                Zeptejte se na normy, GOSTy, technologické postupy, ceny nebo předpisy.
                Odpověď se prohledá přes Perplexity a uloží do KB — příští dotaz vrátí okamžitě z cache.
              </div>

              {/* Suggested questions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {PORADNA_SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => { setPoradnaQ(s); setPoradnaResult(null); setPoradnaError(''); }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      border: `1px solid ${poradnaQ === s ? 'var(--accent-orange, #FF9F1C)' : 'var(--border-default, #ddd)'}`,
                      background: poradnaQ === s ? 'rgba(255,159,28,0.1)' : 'var(--panel-bg, #fff)',
                      color: 'var(--text-secondary)',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                value={poradnaQ}
                onChange={e => { setPoradnaQ(e.target.value); setPoradnaResult(null); setPoradnaError(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePoradna(); }}
                placeholder="Napište otázku… (Ctrl+Enter = odeslat)"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default, #ddd)',
                  fontSize: '13px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  background: 'var(--panel-bg, #fff)',
                  color: 'var(--text-primary)',
                  marginBottom: '10px',
                }}
              />

              {/* Submit */}
              <button
                onClick={handlePoradna}
                disabled={poradnaLoading || !poradnaQ.trim()}
                style={{
                  width: '100%',
                  padding: '11px',
                  background: poradnaLoading || !poradnaQ.trim()
                    ? 'var(--border-default, #ccc)'
                    : 'linear-gradient(135deg, #1a1a2e 0%, #4a4e69 100%)',
                  color: poradnaLoading || !poradnaQ.trim() ? '#888' : '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: poradnaLoading || !poradnaQ.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '16px',
                }}
              >
                {poradnaLoading ? <><SpinnerIcon /> Vyhledávám…</> : <><Globe size={14} /> Vyhledat v normách</>}
              </button>

              {/* Error */}
              {poradnaError && (
                <div style={{
                  padding: '10px 14px',
                  background: '#fff5f5',
                  border: '1px solid #fed7d7',
                  borderRadius: '8px',
                  color: '#c53030',
                  fontSize: '13px',
                  marginBottom: '14px',
                }}>
                  ⚠ {poradnaError}
                </div>
              )}

              {/* Result */}
              {poradnaResult && (
                <div>
                  {/* Status badges */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    {poradnaResult.from_kb ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 10px', borderRadius: '12px',
                        background: '#f0fdf4', border: '1px solid #86efac',
                        color: '#166534', fontSize: '11px', fontWeight: 600,
                      }}>
                        <Database size={11} /> Z KB cache
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 10px', borderRadius: '12px',
                        background: '#eff6ff', border: '1px solid #93c5fd',
                        color: '#1e40af', fontSize: '11px', fontWeight: 600,
                      }}>
                        <Globe size={11} /> {poradnaResult.model_used}
                      </span>
                    )}
                    {poradnaResult.kb_saved && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 10px', borderRadius: '12px',
                        background: '#fefce8', border: '1px solid #fde68a',
                        color: '#92400e', fontSize: '11px', fontWeight: 600,
                      }}>
                        <Database size={11} /> Uloženo → KB/{poradnaResult.kb_category}
                      </span>
                    )}
                  </div>

                  {/* Answer */}
                  <div style={{
                    background: 'var(--panel-inset, #f9f9f9)',
                    border: '1px solid var(--border-default, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    marginBottom: '12px',
                  }}>
                    <MarkdownText text={poradnaResult.answer} />
                  </div>

                  {/* Sources */}
                  {poradnaResult.sources.length > 0 && (
                    <div style={{ marginBottom: '6px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Zdroje ({poradnaResult.sources.length})
                      </div>
                      {poradnaResult.sources.slice(0, 5).map((src, i) => (
                        <a
                          key={i}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'block',
                            fontSize: '11px',
                            color: '#3b82f6',
                            textDecoration: 'none',
                            marginBottom: '3px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {i + 1}. {src.title || src.url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════ KALKULAČKA TAB ══════════ */}
          {activeTab === 'kalkulacka' && <>

          {/* Q1 */}
          <QuestionSection label="Q1 — Typ konstrukce">
            <RadioGroup
              options={Q1_OPTIONS.map(o => ({
                value: o.value,
                label: o.label,
                sublabel: o.hint,
              }))}
              value={answers.construction_type}
              onChange={v => set('construction_type', v as ConstructionType)}
            />
          </QuestionSection>

          {/* Q2 */}
          <QuestionSection label="Q2 — Roční období">
            <RadioGroup
              options={Q2_OPTIONS.map(o => ({
                value: o.value,
                label: o.label,
                tag: o.factor,
              }))}
              value={answers.season}
              onChange={v => set('season', v as Season)}
            />
          </QuestionSection>

          {/* Q3 */}
          <QuestionSection label="Q3 — Beton">
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Třída betonu
                </div>
                <RadioGroup
                  options={Q3_CLASS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  value={answers.concrete_class}
                  onChange={v => set('concrete_class', v as ConcreteClass)}
                  inline
                />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Typ cementu
                </div>
                <RadioGroup
                  options={Q3_CEMENT_OPTIONS.map(o => ({ value: o.value, label: o.label, sublabel: o.note }))}
                  value={answers.cement_type}
                  onChange={v => set('cement_type', v as CementType)}
                />
              </div>
            </div>
          </QuestionSection>

          {/* Q4 */}
          <QuestionSection label="Q4 — Pracovní síla">
            <RadioGroup
              options={Q4_OPTIONS.map(o => ({
                value: o.value,
                label: o.label,
                sublabel: o.hint,
              }))}
              value={answers.crew}
              onChange={v => set('crew', v as Crew)}
            />
          </QuestionSection>

          {/* Model toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px',
            background: 'var(--panel-inset, #f9f9f9)',
            borderRadius: '8px',
            marginBottom: '16px',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Model:</span>
            <ModelButton
              active={model === 'gemini'}
              onClick={() => setModel('gemini')}
              icon={<Zap size={13} />}
              label="Gemini 2.5 Flash"
              note="~1 s · levnější"
            />
            <ModelButton
              active={model === 'openai'}
              onClick={() => setModel('openai')}
              icon={<Bot size={13} />}
              label="GPT-4o mini"
              note="~2 s · střední"
            />
            <ModelButton
              active={model === 'claude'}
              onClick={() => setModel('claude')}
              icon={<Brain size={13} />}
              label="Claude Sonnet 4.6"
              note="~5 s · podrobnější"
            />
          </div>

          {/* Calculate button */}
          {!canCalculate && (
            <div style={{ fontSize: '12px', color: '#e53e3e', marginBottom: '10px' }}>
              ⚠ Vyplňte plochu a sadu v kalkulátoru bednění.
            </div>
          )}
          <button
            onClick={handleCalculate}
            disabled={loading || !canCalculate}
            style={{
              width: '100%',
              padding: '12px',
              background: loading || !canCalculate
                ? 'var(--border-default, #ccc)'
                : 'linear-gradient(135deg, #1a1a2e 0%, #4a4e69 100%)',
              color: loading || !canCalculate ? '#888' : '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '14px',
              cursor: loading || !canCalculate ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '16px',
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? (
              <>
                <SpinnerIcon />
                Počítám…
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Vypočítat
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px',
              background: '#fff5f5',
              border: '1px solid #fed7d7',
              borderRadius: '8px',
              color: '#c53030',
              fontSize: '13px',
              marginBottom: '16px',
            }}>
              ⚠ {error}
            </div>
          )}

          {/* ── Results ── */}
          {result && (
            <div>
              {/* Deterministic grid */}
              <div style={{
                background: 'var(--panel-inset, #f4f7ff)',
                borderRadius: '10px',
                padding: '14px 16px',
                marginBottom: '14px',
                border: '1px solid #dbeafe',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px', color: '#1e40af' }}>
                  Deterministický výpočet
                </div>
                <ResultGrid det={result.deterministic} />
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '14px',
                }}>
                  {result.warnings.map((w, i) => (
                    <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', fontSize: '12px', marginBottom: i < result.warnings.length - 1 ? '6px' : 0 }}>
                      <AlertTriangle size={13} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
                      {w}
                    </div>
                  ))}
                </div>
              )}

              {/* AI explanation */}
              {result.ai_explanation && (
                <div style={{
                  background: 'var(--panel-bg, #fff)',
                  border: '1px solid var(--border-default, #e2e8f0)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  marginBottom: '14px',
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    AI vysvětlení ({result.model_used === 'fallback' ? 'záložní výpočet' : result.model_used})
                  </div>
                  <MarkdownText text={result.ai_explanation} />
                </div>
              )}
            </div>
          )}

          </> /* end kalkulacka tab */}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
          padding: '12px 22px',
          borderTop: '1px solid var(--border-default, #eee)',
          background: 'var(--data-surface-alt, #f9f9f9)',
        }}>
          <button onClick={onClose} style={{
            background: 'var(--bg-tertiary, #eee)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
            borderRadius: '6px',
            padding: '8px 18px',
            cursor: 'pointer',
            fontSize: '13px',
          }}>
            Zavřít
          </button>
          {result && activeTab === 'kalkulacka' && (
            <button onClick={handleApply} style={{
              background: '#16a34a',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 20px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <CheckCircle size={15} />
              Použít ({result.deterministic.days_per_tact} dní/takt, termín {result.deterministic.formwork_term_days} dní)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QuestionSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{
        fontSize: '12px',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '8px',
        paddingBottom: '4px',
        borderBottom: '2px solid var(--accent-orange, #FF9F1C)',
        display: 'inline-block',
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

interface RadioOption {
  value:    string;
  label:    string;
  sublabel?: string;
  tag?:     string;
}

function RadioGroup({ options, value, onChange, inline = false }: {
  options:  RadioOption[];
  value:    string;
  onChange: (v: string) => void;
  inline?:  boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: inline ? 'row' : 'column', gap: '6px', flexWrap: 'wrap' }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <label key={opt.value} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '6px',
            border: `1px solid ${active ? 'var(--accent-orange, #FF9F1C)' : 'var(--border-default, #ddd)'}`,
            background: active ? 'rgba(255,159,28,0.08)' : 'var(--panel-bg, #fff)',
            cursor: 'pointer',
            fontSize: '12px',
            transition: 'all 0.15s',
          }}>
            <input
              type="radio"
              checked={active}
              onChange={() => onChange(opt.value)}
              style={{ accentColor: 'var(--accent-orange, #FF9F1C)', margin: 0 }}
            />
            <span>
              <span style={{ fontWeight: active ? 600 : 400 }}>{opt.label}</span>
              {opt.sublabel && (
                <span style={{ color: 'var(--text-secondary)', marginLeft: '6px', fontSize: '11px' }}>
                  — {opt.sublabel}
                </span>
              )}
              {opt.tag && (
                <span style={{
                  marginLeft: '8px',
                  background: active ? 'var(--accent-orange, #FF9F1C)' : '#e2e8f0',
                  color: active ? '#1a1a1a' : '#4a5568',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}>
                  {opt.tag}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function ModelButton({ active, onClick, icon, label, note }: {
  active:  boolean;
  onClick: () => void;
  icon:    React.ReactNode;
  label:   string;
  note:    string;
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      padding: '5px 12px',
      borderRadius: '20px',
      border: `1.5px solid ${active ? '#1a1a2e' : 'var(--border-default, #ccc)'}`,
      background: active ? '#1a1a2e' : 'transparent',
      color: active ? '#fff' : 'var(--text-secondary)',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: active ? 600 : 400,
      transition: 'all 0.15s',
    }}>
      {icon}
      {label}
      <span style={{ opacity: 0.7, fontSize: '10px' }}>({note})</span>
    </button>
  );
}

function ResultGrid({ det }: { det: Deterministic }) {
  const rows: [string, string, string?][] = [
    ['Počet taktů',     `${det.pocet_taktu} ks`,                        `${det.total_area_m2} m² ÷ ${det.set_area_m2} m²`],
    ['Montáž/takt',     `${det.assembly_days_per_tact.toFixed(1)} dní`,  `parta ${det.crew_size}L × ${det.shift_hours}h`],
    ['Demontáž/takt',   `${det.disassembly_days_per_tact.toFixed(1)} dní`],
    ['Dny/takt',        `${det.days_per_tact} dní`,                       'montáž + demontáž'],
    ['Ošetřování',      `${det.zrani_days} dní`,
      `základ ${det.base_curing_days}d × teplota ×${det.temp_factor} × cement ×${det.cement_factor}`],
    ['Termín bednění',  `${det.formwork_term_days} dní`,                  `${det.pocet_taktu} × (${det.days_per_tact} + ${det.zrani_days})`],
  ];

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
      <tbody>
        {rows.map(([label, value, note], i) => (
          <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid #dbeafe' : 'none' }}>
            <td style={{ padding: '5px 0', color: 'var(--text-secondary)', width: '38%' }}>{label}</td>
            <td style={{ padding: '5px 0', fontWeight: 700, fontFamily: 'monospace', width: '22%' }}>{value}</td>
            <td style={{ padding: '5px 0', color: 'var(--text-secondary)', fontSize: '11px' }}>{note || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Minimal markdown renderer — bold, bullet lists, headers */
function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div style={{ fontSize: '12px', lineHeight: '1.65', color: 'var(--text-primary)' }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />;
        if (line.startsWith('# '))  return <h3 key={i} style={{ margin: '8px 0 4px', fontSize: '13px' }}>{line.slice(2)}</h3>;
        if (line.startsWith('## ')) return <h4 key={i} style={{ margin: '6px 0 3px', fontSize: '12px' }}>{line.slice(3)}</h4>;
        if (line.startsWith('**') && line.endsWith('**')) {
          return <div key={i} style={{ fontWeight: 700, marginTop: '8px' }}>{line.slice(2, -2)}</div>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <div key={i} style={{ paddingLeft: '14px', marginBottom: '2px' }}>• {renderBold(line.slice(2))}</div>;
        }
        return <div key={i}>{renderBold(line)}</div>;
      })}
    </div>
  );
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
