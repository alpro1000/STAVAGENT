/**
 * FormworkAIModal v2
 *
 * AI-assisted formwork scheduling wizard.
 * Opens from ✨ button in FormworkCalculatorModal.
 *
 * Flow:
 *  [Kalkulačka] — Q1-Q5 → POST /api/formwork-assistant → cycle + 3 strategies + rebar
 *  [Poradna]    — free-text → POST /api/kb/research → answer + sources
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Zap, Brain, Bot, AlertTriangle, CheckCircle, X, BookOpen, Database, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { API_URL } from '../services/api';

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
  // Q5: Rebar (optional)
  rebar_kg_per_m3:      number;
  concrete_m3_per_tact: number;
  diameter_main_mm:     number;
  diameter_stirrups_mm: number;
  stirrup_fraction:     number;
  mesh_m2:              number;
  crew_size_rebar:      number;
}

interface Strategy {
  id:          string;
  label:       string;
  sets:        number;
  total_days:  number;
  rental_cost: number;
}

interface RebarDetails {
  rebar_mass_kg:      number;
  rebar_mass_t:       number;
  rebar_hours:        number;
  rebar_days:         number;
  rebar_crew:         number;
  parallel_overlap:   number;
  norm_main_h_t:      number;
  norm_stirrups_h_t:  number;
  spacer_pcs:         number;
  spacer_cost_czk:    number;
}

interface Deterministic {
  pocet_taktu:               number;
  total_area_m2:             number;
  set_area_m2:               number;
  assembly_days:             number;
  rebar_days:                number;
  concrete_days:             number;
  curing_days:               number;
  curing_base_days:          number;
  cement_factor:             number;
  disassembly_days:          number;
  cycle_days:                number;
  work_days:                 number;
  props_min_days:            number;
  orientation:               string;
  strategies:                Strategy[];
  recommended_cost:          string;
  recommended_time:          string;
  crew_size:                 number;
  shift_hours:               number;
  crane:                     boolean;
  rebar:                     RebarDetails | null;
  labor_cost_per_tact:       number;
  labor_cost_total:          number;
  rental_per_m2_day:         number;
  // Legacy compat
  assembly_days_per_tact:    number;
  disassembly_days_per_tact: number;
  days_per_tact:             number;
  zrani_days:                number;
  formwork_term_days:        number;
}

interface AssistantResult {
  success:        boolean;
  deterministic:  Deterministic;
  ai_explanation: string;
  warnings:       string[];
  model_used:     string;
}

interface KBSource { url: string; title: string; }
interface KBResearchResult {
  answer: string; sources: KBSource[]; from_kb: boolean;
  kb_saved: boolean; kb_category: string; model_used: string;
}

interface Props {
  totalAreaM2: number;
  setAreaM2:   number;
  systemName:  string;
  onApply:     (daysPerTact: number, formworkTermDays: number) => void;
  onClose:     () => void;
}

// ── Question definitions ──────────────────────────────────────────────────────

const Q1_OPTIONS: { value: ConstructionType; label: string; hint: string }[] = [
  { value: 'zakladove_pasy', label: 'Základové pásy / piloty', hint: 'Nízké stěny, hloubení — zrání 0.5–2 d' },
  { value: 'pilire_mostu',   label: 'Pilíře mostu',           hint: 'Výška takt max 3 m — zrání 1–3 d' },
  { value: 'mostovka',       label: 'Mostovka / deska',       hint: 'XD3/XF4, stojky 14–28 d — zrání 7–14 d' },
  { value: 'steny',          label: 'Stěny / opěry',          hint: 'Standardní — zrání 1–3 d' },
  { value: 'sloupy',         label: 'Sloupy',                 hint: 'Sloupové SL-1 — zrání 1–3 d' },
  { value: 'rimsy',          label: 'Římsы / konzoly',        hint: 'Vozíkové / konzolové — zrání 3–7 d' },
];

const Q2_OPTIONS: { value: Season; label: string; factor: string }[] = [
  { value: 'leto',        label: 'Léto (>15 °C)',          factor: '×1.0' },
  { value: 'podzim_jaro', label: 'Podzim / jaro (5–15 °C)', factor: '×1.5–2.0' },
  { value: 'zima',        label: 'Zima (<5 °C)',            factor: '×2.0–3.0' },
];

const Q3_CLASS_OPTIONS: { value: ConcreteClass; label: string }[] = [
  { value: 'C20_25', label: 'C 20/25' },
  { value: 'C25_30', label: 'C 25/30' },
  { value: 'C30_37', label: 'C 30/37' },
  { value: 'C35_45', label: 'C 35/45' },
  { value: 'C40_50', label: 'C 40/50' },
];

const Q3_CEMENT_OPTIONS: { value: CementType; label: string; note: string }[] = [
  { value: 'CEM_I_II', label: 'CEM I / II',   note: 'Standardní — ×1.0' },
  { value: 'CEM_III',  label: 'CEM III',       note: 'Struska — ×1.8 pomalejší' },
];

const Q4_OPTIONS: { value: Crew; label: string; hint: string }[] = [
  { value: '2_bez_jeravu', label: '2 lidé bez jeřábu', hint: 'Pomalá montáž, ruční' },
  { value: '4_bez_jeravu', label: '4 lidé bez jeřábu', hint: 'Standardní tempo' },
  { value: '4_s_jeravem',  label: '4 lidé + jeřáb',   hint: '+20 % rychlost' },
  { value: '6_s_jeravem',  label: '6 lidí + jeřáb',   hint: 'Nejvyšší tempo' },
];

const PORADNA_SUGGESTIONS = [
  'Jak se montuje bednění pilíře mostu?',
  'ČSN normy pro beton C30/37 — mostní konstrukce',
  'Minimální pevnost betonu pro odbednění stěny',
  'Technologický postup betonáže v zimě (pod 5 °C)',
  'Cena systémového bednění Doka 2025 Kč/m²',
  'Ošetřování betonu — požadavky TKP17',
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function FormworkAIModal({ totalAreaM2, setAreaM2, systemName, onApply, onClose }: Props) {
  const [answers, setAnswers] = useState<Answers>({
    construction_type: 'steny',
    season:            'leto',
    concrete_class:    'C30_37',
    cement_type:       'CEM_I_II',
    crew:              '4_bez_jeravu',
    rebar_kg_per_m3:      0,
    concrete_m3_per_tact: 0,
    diameter_main_mm:     16,
    diameter_stirrups_mm: 8,
    stirrup_fraction:     0.15,
    mesh_m2:              0,
    crew_size_rebar:      0,
  });
  const [model, setModel]       = useState<AIModel>('gemini');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<AssistantResult | null>(null);
  const [error, setError]       = useState('');
  const [showRebar, setShowRebar] = useState(false);

  const [activeTab, setActiveTab]           = useState<ModalTab>('kalkulacka');
  const [poradnaQ, setPoradnaQ]             = useState('');
  const [poradnaResult, setPoradnaResult]   = useState<KBResearchResult | null>(null);
  const [poradnaLoading, setPoradnaLoading] = useState(false);
  const [poradnaError, setPoradnaError]     = useState('');

  function set<K extends keyof Answers>(key: K, val: Answers[K]) {
    setAnswers(prev => ({ ...prev, [key]: val }));
    setResult(null);
    setError('');
  }

  async function handleCalculate() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`${API_URL}/api/formwork-assistant`, {
        method: 'POST',
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

  function handleApplyStrategy(strategy: Strategy) {
    if (!result) return;
    const { days_per_tact } = result.deterministic;
    onApply(days_per_tact, strategy.total_days);
    onClose();
  }

  async function handlePoradna() {
    if (!poradnaQ.trim()) return;
    setPoradnaLoading(true);
    setPoradnaError('');
    setPoradnaResult(null);
    try {
      const res = await fetch(`${API_URL}/api/kb/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: poradnaQ.trim(), save_to_kb: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setPoradnaResult(await res.json());
    } catch (e: any) {
      setPoradnaError(e.message || 'Chyba');
    } finally {
      setPoradnaLoading(false);
    }
  }

  const canCalculate = totalAreaM2 > 0 && setAreaM2 > 0;

  return createPortal(
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
        maxWidth: '800px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 12px 48px rgba(0,0,0,0.35)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 22px',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} color="#FFD700" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '16px' }}>Kalkulátor Bednění v2</div>
              <div style={{ fontSize: '11px', opacity: 0.75 }}>
                {systemName} · {totalAreaM2} m² · {setAreaM2} m²/sada · ČSN EN 13670
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default, #e2e8f0)' }}>
          {(['kalkulacka', 'poradna'] as ModalTab[]).map(tab => {
            const active = activeTab === tab;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1, padding: '10px 0', background: 'none', border: 'none',
                borderBottom: active ? '2px solid var(--accent-orange, #FF9F1C)' : '2px solid transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: active ? 700 : 400, fontSize: '13px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                marginBottom: '-1px',
              }}>
                {tab === 'kalkulacka' ? <><Sparkles size={14} /> Kalkulačka</> : <><BookOpen size={14} /> Poradna norem</>}
              </button>
            );
          })}
        </div>

        {/* Scrollable body */}
        <div style={{ overflow: 'auto', flex: 1, padding: '18px 22px' }}>

          {/* ══════ PORADNA TAB ══════ */}
          {activeTab === 'poradna' && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.5' }}>
                Zeptejte se na normy, technologické postupy, ceny nebo předpisy.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {PORADNA_SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => { setPoradnaQ(s); setPoradnaResult(null); setPoradnaError(''); }}
                    style={{
                      padding: '4px 10px', borderRadius: '20px',
                      border: `1px solid ${poradnaQ === s ? 'var(--accent-orange)' : 'var(--border-default, #ddd)'}`,
                      background: poradnaQ === s ? 'rgba(255,159,28,0.1)' : 'var(--panel-bg, #fff)',
                      color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer',
                    }}>{s}</button>
                ))}
              </div>
              <textarea value={poradnaQ} onChange={e => { setPoradnaQ(e.target.value); setPoradnaResult(null); setPoradnaError(''); }}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePoradna(); }}
                placeholder="Napište otázku… (Ctrl+Enter = odeslat)" rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-default, #ddd)', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', background: 'var(--panel-bg)', color: 'var(--text-primary)', marginBottom: '10px' }}
              />
              <button onClick={handlePoradna} disabled={poradnaLoading || !poradnaQ.trim()}
                style={{
                  width: '100%', padding: '11px',
                  background: poradnaLoading || !poradnaQ.trim() ? 'var(--border-default, #ccc)' : 'linear-gradient(135deg, #1a1a2e 0%, #4a4e69 100%)',
                  color: poradnaLoading || !poradnaQ.trim() ? '#888' : '#fff',
                  border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px',
                  cursor: poradnaLoading || !poradnaQ.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px',
                }}>
                {poradnaLoading ? <><SpinnerIcon /> Vyhledávám…</> : <><Globe size={14} /> Vyhledat v normách</>}
              </button>
              {poradnaError && <ErrorBox text={poradnaError} />}
              {poradnaResult && (
                <div>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    {poradnaResult.from_kb ? (
                      <Badge icon={<Database size={11} />} text="Z KB cache" bg="#f0fdf4" border="#86efac" color="#166534" />
                    ) : (
                      <Badge icon={<Globe size={11} />} text={poradnaResult.model_used} bg="#eff6ff" border="#93c5fd" color="#1e40af" />
                    )}
                    {poradnaResult.kb_saved && <Badge icon={<Database size={11} />} text={`Uloženo → KB/${poradnaResult.kb_category}`} bg="#fefce8" border="#fde68a" color="#92400e" />}
                  </div>
                  <div style={{ background: 'var(--panel-inset, #f9f9f9)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
                    <MarkdownText text={poradnaResult.answer} />
                  </div>
                  {poradnaResult.sources.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Zdroje ({poradnaResult.sources.length})</div>
                      {poradnaResult.sources.slice(0, 5).map((src, i) => (
                        <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'block', fontSize: '11px', color: '#3b82f6', textDecoration: 'none', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {i + 1}. {src.title || src.url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════ KALKULAČKA TAB ══════ */}
          {activeTab === 'kalkulacka' && <>

          {/* Q1 */}
          <QuestionSection label="Q1 — Typ konstrukce">
            <RadioGroup
              options={Q1_OPTIONS.map(o => ({ value: o.value, label: o.label, sublabel: o.hint }))}
              value={answers.construction_type}
              onChange={v => set('construction_type', v as ConstructionType)}
            />
          </QuestionSection>

          {/* Q2 */}
          <QuestionSection label="Q2 — Roční období">
            <RadioGroup
              options={Q2_OPTIONS.map(o => ({ value: o.value, label: o.label, tag: o.factor }))}
              value={answers.season}
              onChange={v => set('season', v as Season)}
            />
          </QuestionSection>

          {/* Q3 */}
          <QuestionSection label="Q3 — Beton">
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Třída betonu</div>
                <RadioGroup
                  options={Q3_CLASS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  value={answers.concrete_class}
                  onChange={v => set('concrete_class', v as ConcreteClass)}
                  inline
                />
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Typ cementu</div>
                <RadioGroup
                  options={Q3_CEMENT_OPTIONS.map(o => ({ value: o.value, label: o.label, sublabel: o.note }))}
                  value={answers.cement_type}
                  onChange={v => set('cement_type', v as CementType)}
                />
              </div>
            </div>
          </QuestionSection>

          {/* Q4 */}
          <QuestionSection label="Q4 — Pracovní síla (bednění)">
            <RadioGroup
              options={Q4_OPTIONS.map(o => ({ value: o.value, label: o.label, sublabel: o.hint }))}
              value={answers.crew}
              onChange={v => set('crew', v as Crew)}
            />
          </QuestionSection>

          {/* Q5 — Rebar (collapsible) */}
          <div style={{ marginBottom: '18px' }}>
            <button onClick={() => setShowRebar(!showRebar)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)',
              background: 'none', border: 'none', cursor: 'pointer',
              paddingBottom: '4px', borderBottom: '2px solid var(--accent-orange, #FF9F1C)',
            }}>
              Q5 — Výztuž (armování)
              {showRebar ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {answers.rebar_kg_per_m3 > 0 && <span style={{ color: '#16a34a', fontSize: '11px', fontWeight: 400 }}>({answers.rebar_kg_per_m3} kg/m³)</span>}
            </button>

            {showRebar && (
              <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <NumberInput label="Výztuž (kg/m³)" value={answers.rebar_kg_per_m3} onChange={v => set('rebar_kg_per_m3', v)} hint="0 = bez armování" />
                <NumberInput label="Beton/takt (m³)" value={answers.concrete_m3_per_tact} onChange={v => set('concrete_m3_per_tact', v)} hint="Objem betonu za 1 záběr" />
                <NumberInput label="Hlavní pruty (mm)" value={answers.diameter_main_mm} onChange={v => set('diameter_main_mm', v)} hint="d10–d32" />
                <NumberInput label="Třmínky (mm)" value={answers.diameter_stirrups_mm} onChange={v => set('diameter_stirrups_mm', v)} hint="Norma ~30 h/t" />
                <NumberInput label="Podíl třmínků" value={answers.stirrup_fraction} onChange={v => set('stirrup_fraction', v)} hint="0.25 trám, 0.15 sloup, 0.05 deska" step={0.05} />
                <NumberInput label="KARI sítě (m²)" value={answers.mesh_m2} onChange={v => set('mesh_m2', v)} hint="0.08–0.12 h/m²" />
                <NumberInput label="Brig. armovačů" value={answers.crew_size_rebar} onChange={v => set('crew_size_rebar', v)} hint="0 = společná s bedna." />
              </div>
            )}
          </div>

          {/* Model toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', background: 'var(--panel-inset, #f9f9f9)',
            borderRadius: '8px', marginBottom: '16px', flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Model:</span>
            <ModelButton active={model === 'gemini'} onClick={() => setModel('gemini')} icon={<Zap size={13} />} label="Gemini 2.5 Flash" note="~1 s" />
            <ModelButton active={model === 'openai'} onClick={() => setModel('openai')} icon={<Bot size={13} />} label="GPT-4o mini" note="~2 s" />
            <ModelButton active={model === 'claude'} onClick={() => setModel('claude')} icon={<Brain size={13} />} label="Claude Sonnet 4.6" note="~5 s" />
          </div>

          {/* Calculate button */}
          {!canCalculate && <div style={{ fontSize: '12px', color: '#e53e3e', marginBottom: '10px' }}>Vyplňte plochu a sadu v kalkulátoru bednění.</div>}
          <button onClick={handleCalculate} disabled={loading || !canCalculate}
            style={{
              width: '100%', padding: '12px',
              background: loading || !canCalculate ? 'var(--border-default, #ccc)' : 'linear-gradient(135deg, #1a1a2e 0%, #4a4e69 100%)',
              color: loading || !canCalculate ? '#888' : '#fff',
              border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '14px',
              cursor: loading || !canCalculate ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px',
            }}>
            {loading ? <><SpinnerIcon /> Počítám…</> : <><Sparkles size={16} /> Vypočítat</>}
          </button>

          {error && <ErrorBox text={error} />}

          {/* ── RESULTS ── */}
          {result && (
            <div>
              {/* Cycle breakdown */}
              <div style={{ background: 'var(--panel-inset, #f4f7ff)', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px', border: '1px solid #dbeafe' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px', color: '#1e40af' }}>
                  Cyklus zachvátky (ČSN EN 13670)
                </div>
                <CycleGrid det={result.deterministic} />
              </div>

              {/* Strategy comparison */}
              <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px', border: '1px solid #86efac' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px', color: '#166534' }}>
                  Srovnání strategií
                </div>
                <StrategyTable
                  strategies={result.deterministic.strategies}
                  recommendedCost={result.deterministic.recommended_cost}
                  recommendedTime={result.deterministic.recommended_time}
                  onApply={handleApplyStrategy}
                />
              </div>

              {/* Rebar details */}
              {result.deterministic.rebar && (
                <div style={{ background: '#fefce8', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px', color: '#92400e' }}>
                    Armování
                  </div>
                  <RebarGrid rebar={result.deterministic.rebar} />
                </div>
              )}

              {/* Props warning (horizontal) */}
              {result.deterministic.props_min_days > 0 && (
                <div style={{ background: '#fff7ed', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', border: '1px solid #fed7aa' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', fontWeight: 600, color: '#9a3412' }}>
                    <AlertTriangle size={14} />
                    Stojky zůstávají min. {result.deterministic.props_min_days} dní (horizontální konstrukce — {result.deterministic.orientation})
                  </div>
                </div>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px' }}>
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
                <div style={{ background: 'var(--panel-bg, #fff)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    AI vysvětlení ({result.model_used === 'fallback' ? 'deterministická kalkulace' : result.model_used})
                  </div>
                  <MarkdownText text={result.ai_explanation} />
                </div>
              )}
            </div>
          )}

          </> /* end kalkulacka tab */}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
          padding: '12px 22px',
          borderTop: '1px solid var(--border-default, #eee)',
          background: 'var(--data-surface-alt, #f9f9f9)',
        }}>
          <button onClick={onClose} style={{
            background: 'var(--bg-tertiary, #eee)', color: 'var(--text-primary)',
            border: '1px solid var(--border-default)', borderRadius: '6px',
            padding: '8px 18px', cursor: 'pointer', fontSize: '13px',
          }}>Zavřít</button>
          {result && activeTab === 'kalkulacka' && (
            <button onClick={handleApply} style={{
              background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px',
              padding: '8px 20px', fontWeight: 700, cursor: 'pointer', fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <CheckCircle size={15} />
              Použít strat. A ({result.deterministic.formwork_term_days} dní)
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function QuestionSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', paddingBottom: '4px', borderBottom: '2px solid var(--accent-orange, #FF9F1C)', display: 'inline-block' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

interface RadioOption { value: string; label: string; sublabel?: string; tag?: string; }

function RadioGroup({ options, value, onChange, inline = false }: {
  options: RadioOption[]; value: string; onChange: (v: string) => void; inline?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: inline ? 'row' : 'column', gap: '6px', flexWrap: 'wrap' }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <label key={opt.value} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 10px', borderRadius: '6px',
            border: `1px solid ${active ? 'var(--accent-orange, #FF9F1C)' : 'var(--border-default, #ddd)'}`,
            background: active ? 'rgba(255,159,28,0.08)' : 'var(--panel-bg, #fff)',
            cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s',
          }}>
            <input type="radio" checked={active} onChange={() => onChange(opt.value)} style={{ accentColor: 'var(--accent-orange)', margin: 0 }} />
            <span>
              <span style={{ fontWeight: active ? 600 : 400 }}>{opt.label}</span>
              {opt.sublabel && <span style={{ color: 'var(--text-secondary)', marginLeft: '6px', fontSize: '11px' }}>— {opt.sublabel}</span>}
              {opt.tag && <span style={{ marginLeft: '8px', background: active ? 'var(--accent-orange)' : '#e2e8f0', color: active ? '#1a1a1a' : '#4a5568', padding: '1px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, fontFamily: 'monospace' }}>{opt.tag}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function NumberInput({ label, value, onChange, hint, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; step?: number;
}) {
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</div>
      <input
        type="number"
        value={value || ''}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        step={step}
        min={0}
        style={{
          width: '100%', padding: '6px 8px', borderRadius: '6px',
          border: '1px solid var(--border-default, #ddd)', fontSize: '13px',
          fontFamily: 'monospace', boxSizing: 'border-box',
          background: 'var(--panel-bg)', color: 'var(--text-primary)',
        }}
      />
      {hint && <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{hint}</div>}
    </div>
  );
}

function ModelButton({ active, onClick, icon, label, note }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; note: string;
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '5px 12px', borderRadius: '20px',
      border: `1.5px solid ${active ? '#1a1a2e' : 'var(--border-default, #ccc)'}`,
      background: active ? '#1a1a2e' : 'transparent',
      color: active ? '#fff' : 'var(--text-secondary)',
      cursor: 'pointer', fontSize: '12px', fontWeight: active ? 600 : 400, transition: 'all 0.15s',
    }}>
      {icon} {label} <span style={{ opacity: 0.7, fontSize: '10px' }}>({note})</span>
    </button>
  );
}

/** Cycle breakdown grid: A → R → B → C → D = total */
function CycleGrid({ det }: { det: Deterministic }) {
  const phases: [string, string, string?][] = [
    ['Počet taktů',        `${det.pocet_taktu} ks`,              `${det.total_area_m2} m² ÷ ${det.set_area_m2} m²`],
    ['Montáž (A)',         `${det.assembly_days} dní`,           `parta ${det.crew_size}L × ${det.shift_hours}h${det.crane ? ' + jeřáb' : ''}`],
  ];
  if (det.rebar_days > 0) {
    phases.push(['Armování (R)', `${det.rebar_days} dní`, det.rebar ? `${det.rebar.rebar_mass_kg} kg, brig. ${det.rebar.rebar_crew}L` : '']);
  }
  phases.push(
    ['Betonáž (B)',        `${det.concrete_days} den`,           '1 den fixní'],
    ['Zrání min. (C)',     `${det.curing_days} dní`,
      det.cement_factor > 1
        ? `základ ${det.curing_base_days}d × CEM III ×${det.cement_factor}`
        : `ČSN EN 13670 (${det.orientation})`],
    ['Demontáž (D)',       `${det.disassembly_days} dní`,        ''],
    ['Cyklus celkem',      `${det.cycle_days} dní`,              'A + R + B + C + D'],
  );

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
      <tbody>
        {phases.map(([label, value, note], i) => {
          const isTotal = i === phases.length - 1;
          return (
            <tr key={i} style={{ borderBottom: i < phases.length - 1 ? '1px solid #dbeafe' : 'none' }}>
              <td style={{ padding: '5px 0', color: isTotal ? '#1e40af' : 'var(--text-secondary)', width: '35%', fontWeight: isTotal ? 700 : 400 }}>{label}</td>
              <td style={{ padding: '5px 0', fontWeight: 700, fontFamily: 'monospace', width: '20%', color: isTotal ? '#1e40af' : undefined }}>{value}</td>
              <td style={{ padding: '5px 0', color: 'var(--text-secondary)', fontSize: '11px' }}>{note || ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Strategy comparison table with apply buttons */
function StrategyTable({ strategies, recommendedCost, recommendedTime, onApply }: {
  strategies: Strategy[]; recommendedCost: string; recommendedTime: string;
  onApply: (s: Strategy) => void;
}) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #86efac' }}>
          <th style={{ textAlign: 'left', padding: '4px 0', color: '#166534', fontWeight: 600 }}>Strategie</th>
          <th style={{ textAlign: 'center', padding: '4px 0', color: '#166534', fontWeight: 600 }}>Sady</th>
          <th style={{ textAlign: 'center', padding: '4px 0', color: '#166534', fontWeight: 600 }}>Doba</th>
          <th style={{ textAlign: 'right', padding: '4px 0', color: '#166534', fontWeight: 600 }}>Nájem</th>
          <th style={{ textAlign: 'center', padding: '4px 0', width: '30px' }}></th>
          <th style={{ textAlign: 'center', padding: '4px 0', width: '70px' }}></th>
        </tr>
      </thead>
      <tbody>
        {strategies.map(s => {
          const isCost = s.id === recommendedCost;
          const isTime = s.id === recommendedTime;
          return (
            <tr key={s.id} style={{ borderBottom: '1px solid #d1fae5' }}>
              <td style={{ padding: '6px 0', fontWeight: 600 }}>{s.label}</td>
              <td style={{ padding: '6px 0', textAlign: 'center', fontFamily: 'monospace' }}>{s.sets}</td>
              <td style={{ padding: '6px 0', textAlign: 'center', fontWeight: 700, fontFamily: 'monospace' }}>{s.total_days} d</td>
              <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace' }}>{s.rental_cost > 0 ? s.rental_cost.toLocaleString('cs') + ' Kč' : '—'}</td>
              <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                {isCost && <span title="Nejlevnější" style={{ fontSize: '14px' }}>💰</span>}
                {isTime && !isCost && <span title="Nejrychlejší" style={{ fontSize: '14px' }}>⚡</span>}
                {isCost && isTime && <span title="Optimum" style={{ fontSize: '14px' }}>⭐</span>}
              </td>
              <td style={{ padding: '4px 0', textAlign: 'center' }}>
                <button onClick={() => onApply(s)} style={{
                  padding: '3px 10px', borderRadius: '4px', border: '1px solid #86efac',
                  background: '#f0fdf4', color: '#166534', fontSize: '11px', fontWeight: 600,
                  cursor: 'pointer',
                }}>Použít</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Rebar details grid */
function RebarGrid({ rebar }: { rebar: RebarDetails }) {
  const rows: [string, string][] = [
    ['Hmotnost',     `${rebar.rebar_mass_kg} kg (${rebar.rebar_mass_t} t)`],
    ['Normohodiny',  `${rebar.rebar_hours.toFixed(1)} h (hl. ${rebar.norm_main_h_t} h/t, třm. ${rebar.norm_stirrups_h_t} h/t)`],
    ['Doba arm.',    `${rebar.rebar_days} dní (brig. ${rebar.rebar_crew}L)`],
  ];
  if (rebar.parallel_overlap > 0) {
    rows.push(['Paralelní úspora', `-${rebar.parallel_overlap} dní (arm. + bedna. současně)`]);
  }
  if (rebar.spacer_pcs > 0) {
    rows.push(['Dist. kroužky',  `${rebar.spacer_pcs} ks × ${(4.50).toFixed(1)} Kč = ${rebar.spacer_cost_czk.toFixed(0)} Kč`]);
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid #fde68a' : 'none' }}>
            <td style={{ padding: '4px 0', color: '#92400e', width: '35%' }}>{label}</td>
            <td style={{ padding: '4px 0', fontWeight: 600, fontFamily: 'monospace' }}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div style={{ padding: '10px 14px', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', color: '#c53030', fontSize: '13px', marginBottom: '16px' }}>
      {text}
    </div>
  );
}

function Badge({ icon, text, bg, border, color }: { icon: React.ReactNode; text: string; bg: string; border: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '12px', background: bg, border: `1px solid ${border}`, color, fontSize: '11px', fontWeight: 600 }}>
      {icon} {text}
    </span>
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div style={{ fontSize: '12px', lineHeight: '1.65', color: 'var(--text-primary)' }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />;
        if (line.startsWith('# '))  return <h3 key={i} style={{ margin: '8px 0 4px', fontSize: '13px' }}>{line.slice(2)}</h3>;
        if (line.startsWith('## ')) return <h4 key={i} style={{ margin: '6px 0 3px', fontSize: '12px' }}>{line.slice(3)}</h4>;
        if (line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{ fontWeight: 700, marginTop: '8px' }}>{line.slice(2, -2)}</div>;
        if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} style={{ paddingLeft: '14px', marginBottom: '2px' }}>• {renderBold(line.slice(2))}</div>;
        if (line.startsWith('|')) return <div key={i} style={{ fontFamily: 'monospace', fontSize: '11px' }}>{line}</div>;
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
