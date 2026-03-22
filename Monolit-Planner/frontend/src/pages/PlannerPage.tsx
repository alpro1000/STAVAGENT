/**
 * Planner Page v1.0
 *
 * Interactive UI for the planElement() orchestrator.
 * Client-side only — all calculations run in the browser via shared library.
 *
 * Input form → planElement() → result display with:
 *   - Element classification
 *   - Pour decision (mode, tacts)
 *   - Formwork system + 3-phase costs
 *   - Rebar estimation
 *   - Schedule (Gantt chart)
 *   - Cost summary
 *   - Warnings + decision log
 */

import { useState, useMemo, useCallback } from 'react';
import {
  planElement,
  addWorkDays,
  type PlannerInput,
  type PlannerOutput,
} from '@stavagent/monolit-shared';
import { FORMWORK_SYSTEMS, ELEMENT_DIMENSION_HINTS } from '@stavagent/monolit-shared';
import type { StructuralElementType, SeasonMode } from '@stavagent/monolit-shared';
import type { ConcreteClass, CementType } from '@stavagent/monolit-shared';
import PortalBreadcrumb from '../components/PortalBreadcrumb';
import PlannerGantt from '../components/PlannerGantt';
import { exportPlanToXLSX } from '../utils/exportPlanXLSX';
import '../styles/r0.css';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

// ─── AI Advisor types ──────────────────────────────────────────────────────

interface AIAdvisorResult {
  approach: {
    text: string;
    model: string;
    confidence: number;
    parsed?: {
      pour_mode?: string;
      sub_mode?: string;
      recommended_tacts?: number;
      tact_volume_m3?: number;
      reasoning?: string;
      warnings?: string[];
      overtime_recommendation?: string;
      pump_type?: string;
    };
  } | null;
  formwork_suggestion: {
    recommended: { name: string; manufacturer: string; rental_czk_m2_month: number } | null;
    alternatives: { name: string; manufacturer: string }[];
    num_sets_recommendation: number;
    tip: string;
  } | null;
  norms: {
    answer: string;
    sources: string[];
    model: string;
  } | null;
  productivity_norms: {
    source: string;
    work_types: string[];
    data: Record<string, any>;
  } | null;
  warnings: string[];
}

// ─── Element type labels ────────────────────────────────────────────────────

const ELEMENT_TYPES: { value: StructuralElementType; label: string; group: string }[] = [
  // Building elements (pozemní stavby)
  { value: 'zakladova_deska', label: 'Základová deska', group: 'Pozemní stavby' },
  { value: 'zakladovy_pas', label: 'Základový pás', group: 'Pozemní stavby' },
  { value: 'zakladova_patka', label: 'Základová patka', group: 'Pozemní stavby' },
  { value: 'stropni_deska', label: 'Stropní / podlahová deska', group: 'Pozemní stavby' },
  { value: 'stena', label: 'Monolitická stěna', group: 'Pozemní stavby' },
  { value: 'sloup', label: 'Sloup', group: 'Pozemní stavby' },
  { value: 'pruvlak', label: 'Průvlak / trám', group: 'Pozemní stavby' },
  { value: 'schodiste', label: 'Schodiště', group: 'Pozemní stavby' },
  { value: 'nadrz', label: 'Nádrž / jímka / bazén', group: 'Pozemní stavby' },
  { value: 'podzemni_stena', label: 'Podzemní stěna (milánská)', group: 'Pozemní stavby' },
  { value: 'pilota', label: 'Pilota / mikropilota', group: 'Pozemní stavby' },
  // Bridge elements (mostní prvky)
  { value: 'zaklady_piliru', label: 'Základy pilířů', group: 'Mostní prvky' },
  { value: 'driky_piliru', label: 'Dříky pilířů', group: 'Mostní prvky' },
  { value: 'operne_zdi', label: 'Opěrné zdi', group: 'Mostní prvky' },
  { value: 'mostovkova_deska', label: 'Mostovková deska', group: 'Mostní prvky' },
  { value: 'rimsa', label: 'Římsová deska', group: 'Mostní prvky' },
  { value: 'rigel', label: 'Příčník (ригель)', group: 'Mostní prvky' },
  { value: 'opery_ulozne_prahy', label: 'Opěry, úložné prahy', group: 'Mostní prvky' },
  { value: 'mostni_zavirne_zidky', label: 'Závěrné zídky', group: 'Mostní prvky' },
  { value: 'other', label: 'Jiný typ', group: '' },
];

const SEASONS: { value: SeasonMode; label: string }[] = [
  { value: 'normal', label: 'Normální (5-25°C)' },
  { value: 'hot', label: 'Horko (>25°C)' },
  { value: 'cold', label: 'Zima (<5°C)' },
];

const CONCRETE_CLASSES: ConcreteClass[] = [
  'C12/15', 'C16/20', 'C20/25', 'C25/30', 'C30/37',
  'C35/45', 'C40/50', 'C45/55', 'C50/60',
];

const CEMENT_TYPES: { value: CementType; label: string }[] = [
  { value: 'CEM_I', label: 'CEM I (OPC - rychlé)' },
  { value: 'CEM_II', label: 'CEM II (směsný - střední)' },
  { value: 'CEM_III', label: 'CEM III (struska - pomalé)' },
];

// ─── Default form values ────────────────────────────────────────────────────

type TactMode = 'spary' | 'manual';

interface FormState {
  element_type: StructuralElementType;
  element_name: string;
  use_name_classification: boolean;
  volume_m3: number;
  formwork_area_m2: string; // empty = auto-estimate
  rebar_mass_kg: string;    // empty = auto-estimate
  height_m: string;         // empty = not set (props can't be calculated)
  tact_mode: TactMode;      // 'spary' = auto from joints, 'manual' = direct input
  has_dilatacni_spary: boolean;
  spara_spacing_m: number;
  total_length_m: number;
  adjacent_sections: boolean;
  num_tacts_override: string; // empty = auto, number = direct
  tact_volume_m3_override: string; // empty = auto-divide
  scheduling_mode_override: '' | 'linear' | 'chess';
  season: SeasonMode;
  use_retarder: boolean;
  concrete_class: ConcreteClass;
  cement_type: CementType;
  temperature_c: number;
  num_sets: number;
  num_formwork_crews: number;
  num_rebar_crews: number;
  crew_size: number;
  shift_h: number;
  wage_czk_h: number;
  formwork_system_name: string; // empty = auto
  enable_monte_carlo: boolean;
  start_date: string; // ISO date string for calendar mapping
  num_bridges: number; // 1 = jeden most, 2 = levý+pravý (souběžné)
}

const DEFAULT_FORM: FormState = {
  element_type: 'operne_zdi',
  element_name: '',
  use_name_classification: false,
  volume_m3: 120,
  formwork_area_m2: '',
  rebar_mass_kg: '',
  height_m: '',
  tact_mode: 'spary',
  has_dilatacni_spary: true,
  spara_spacing_m: 10,
  total_length_m: 50,
  adjacent_sections: true,
  num_tacts_override: '',
  tact_volume_m3_override: '',
  scheduling_mode_override: '',
  season: 'normal',
  use_retarder: false,
  concrete_class: 'C30/37',
  cement_type: 'CEM_I',
  temperature_c: 15,
  num_sets: 2,
  num_formwork_crews: 1,
  num_rebar_crews: 1,
  crew_size: 4,
  shift_h: 10,
  wage_czk_h: 398,
  formwork_system_name: '',
  enable_monte_carlo: true,
  start_date: new Date().toISOString().split('T')[0],
  num_bridges: 1,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCZK(val: number): string {
  return val.toLocaleString('cs-CZ', { maximumFractionDigits: 0 }) + ' Kč';
}

function formatNum(val: number, decimals = 1): string {
  return val.toLocaleString('cs-CZ', { maximumFractionDigits: decimals });
}

/** Map work-day range [start, end] to calendar date string */
function formatWorkDayRange(baseDate: Date, range: [number, number]): string {
  const fmt = (d: Date) => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
  const startResult = addWorkDays(baseDate, Math.floor(range[0]));
  const endResult = addWorkDays(baseDate, Math.ceil(range[1]));
  const startStr = fmt(startResult.end_date);
  const endStr = fmt(endResult.end_date);
  return startStr === endStr ? startStr : `${startStr} – ${endStr}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PlannerPage() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [result, setResult] = useState<PlannerOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [advisor, setAdvisor] = useState<AIAdvisorResult | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [comparison, setComparison] = useState<Array<{
    system: string;
    manufacturer: string;
    total_days: number;
    total_cost_czk: number;
    formwork_labor_czk: number;
    rental_czk: number;
    assembly_days: number;
    disassembly_days: number;
  }> | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [showNorms, setShowNorms] = useState(false);
  const [showProductivityNorms, setShowProductivityNorms] = useState(false);
  const [normsScraping, setNormsScraping] = useState(false);
  const [normsScrapeResult, setNormsScrapeResult] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // ── AI Advisor call ─────────────────────────────────────────────────────
  const fetchAdvisor = useCallback(async () => {
    setAdvisorLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/planner-advisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          element_type: form.use_name_classification ? undefined : form.element_type,
          element_name: form.use_name_classification ? form.element_name : undefined,
          volume_m3: form.volume_m3,
          has_dilatacni_spary: form.tact_mode === 'spary' ? form.has_dilatacni_spary : false,
          concrete_class: form.concrete_class,
          temperature_c: form.temperature_c,
          total_length_m: form.total_length_m,
          spara_spacing_m: form.spara_spacing_m,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Try to parse JSON from approach text
        if (data.approach?.text) {
          try {
            // Use non-greedy match to find the first complete JSON object
            const jsonMatch = data.approach.text.match(/\{[\s\S]*?\}(?=[^}]*$)/)
              || data.approach.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              data.approach.parsed = JSON.parse(jsonMatch[0]);
            }
          } catch {
            // If JSON parse fails, try to extract key-value pairs from text
            console.warn('AI Advisor: could not parse JSON from response, using text fallback');
          }
        }
        setAdvisor(data);
      }
    } catch (err) {
      console.warn('AI Advisor error:', err);
    } finally {
      setAdvisorLoading(false);
    }
  }, [form.element_type, form.element_name, form.use_name_classification, form.volume_m3,
      form.has_dilatacni_spary, form.tact_mode, form.concrete_class, form.temperature_c,
      form.total_length_m, form.spara_spacing_m]);

  const handleCalculate = () => {
    setError(null);
    setShowComparison(false);
    try {
      const input = buildInput();
      if (form.formwork_system_name) {
        input.formwork_system_name = form.formwork_system_name;
      }
      const output = planElement(input);
      setResult(output);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba výpočtu');
      setResult(null);
    }
  };

  const handleCompare = () => {
    if (!result) return;
    const baseInput = buildInput();
    const results: typeof comparison = [];
    for (const sys of FORMWORK_SYSTEMS) {
      if (sys.unit === 'bm') continue; // skip linear-meter systems (cornice)
      try {
        const out = planElement({ ...baseInput, formwork_system_name: sys.name });
        results.push({
          system: sys.name,
          manufacturer: sys.manufacturer,
          total_days: out.schedule.total_days,
          total_cost_czk: out.costs.total_labor_czk + out.costs.formwork_rental_czk,
          formwork_labor_czk: out.costs.formwork_labor_czk,
          rental_czk: out.costs.formwork_rental_czk,
          assembly_days: out.formwork.assembly_days,
          disassembly_days: out.formwork.disassembly_days,
        });
      } catch {
        // skip incompatible systems
      }
    }
    results.sort((a, b) => a.total_cost_czk - b.total_cost_czk);
    setComparison(results);
    setShowComparison(true);
  };

  /** Build PlannerInput from current form state (shared by calculate + compare) */
  const buildInput = (): PlannerInput => {
    const effectiveHasSpary = form.tact_mode === 'spary' ? form.has_dilatacni_spary : false;
    const input: PlannerInput = {
      volume_m3: form.volume_m3,
      has_dilatacni_spary: effectiveHasSpary,
      season: form.season,
      use_retarder: form.use_retarder,
      concrete_class: form.concrete_class,
      cement_type: form.cement_type,
      temperature_c: form.temperature_c,
      num_sets: form.num_sets,
      num_formwork_crews: form.num_formwork_crews,
      num_rebar_crews: form.num_rebar_crews,
      crew_size: form.crew_size,
      shift_h: form.shift_h,
      k: 0.8,
      wage_czk_h: form.wage_czk_h,
      enable_monte_carlo: form.enable_monte_carlo,
    };
    if (form.use_name_classification && form.element_name.trim()) {
      input.element_name = form.element_name.trim();
    } else {
      input.element_type = form.element_type;
    }
    if (form.formwork_area_m2) input.formwork_area_m2 = parseFloat(form.formwork_area_m2);
    if (form.rebar_mass_kg) input.rebar_mass_kg = parseFloat(form.rebar_mass_kg);
    if (effectiveHasSpary) {
      input.spara_spacing_m = form.spara_spacing_m;
      input.total_length_m = form.total_length_m;
      input.adjacent_sections = form.adjacent_sections;
    }
    if (form.tact_mode === 'manual' && form.num_tacts_override) {
      input.num_tacts_override = parseInt(form.num_tacts_override);
      if (form.tact_volume_m3_override) input.tact_volume_m3_override = parseFloat(form.tact_volume_m3_override);
      if (form.scheduling_mode_override) input.scheduling_mode_override = form.scheduling_mode_override;
    }
    if (form.height_m) input.height_m = parseFloat(form.height_m);
    if (form.num_bridges > 1) input.num_bridges = form.num_bridges;
    return input;
  };

  // Auto-calculate on first render with defaults
  const firstRun = useMemo(() => {
    try {
      return planElement({
        element_type: DEFAULT_FORM.element_type,
        volume_m3: DEFAULT_FORM.volume_m3,
        has_dilatacni_spary: DEFAULT_FORM.has_dilatacni_spary,
        spara_spacing_m: DEFAULT_FORM.spara_spacing_m,
        total_length_m: DEFAULT_FORM.total_length_m,
        adjacent_sections: DEFAULT_FORM.adjacent_sections,
        concrete_class: DEFAULT_FORM.concrete_class,
        temperature_c: DEFAULT_FORM.temperature_c,
      });
    } catch {
      return null;
    }
  }, []);

  const plan = result ?? firstRun;

  return (
    <div className="r0-app">
      <PortalBreadcrumb />
      {/* Header */}
      <header className="r0-header">
        <div className="r0-header-left">
          <a href="/" className="r0-back-link">← Zpět na Monolit</a>
          <h1 className="r0-title">
            <span className="r0-icon">📐</span>
            Plánovač elementu
          </h1>
        </div>
        <div className="r0-header-right">
          <button
            onClick={() => setShowHelp(!showHelp)}
            style={{
              background: showHelp ? 'var(--r0-orange)' : 'transparent',
              color: showHelp ? 'white' : 'var(--r0-slate-600)',
              border: `1px solid ${showHelp ? 'var(--r0-orange)' : 'var(--r0-slate-300)'}`,
              borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
              fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
            }}
          >
            ? Nápověda
          </button>
          <span className="r0-badge">v1.0</span>
        </div>
      </header>

      {/* ─── Help Panel ─── */}
      {showHelp && (
        <div style={{
          background: 'var(--r0-slate-50)', borderBottom: '1px solid var(--r0-slate-200)',
          padding: '20px 24px', fontSize: 13, lineHeight: 1.7, color: 'var(--r0-slate-700)',
          maxHeight: 'calc(100vh - 60px)', overflowY: 'auto',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* ── Intro ── */}
            <h3 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--r0-slate-800)' }}>
              Plánovač elementu — Deterministický kalkulátor betonáže
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--r0-slate-600)' }}>
              Cíl: <strong>co nejpřesněji spočítat dobu a náklady betonáže</strong> monolitické
              konstrukce — od bednění přes výztuž až po harmonogram a pravděpodobnostní
              odhad termínů. Nepoužívá AI pro výpočty — je založen na <strong>deterministických
              matematických modelech</strong> s daty z norem a katalogů výrobců. AI (Vertex AI Gemini)
              se používá pouze pro doporučení postupu betonáže, ne pro samotné výpočty.
            </p>

            {/* ── Quick Start ── */}
            <div style={{
              background: 'var(--r0-info-bg)', border: '1px solid var(--r0-info-border)',
              borderRadius: 8, padding: '12px 16px', marginBottom: 16,
            }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--r0-badge-blue-text)' }}>Jak začít (5 kroků)</h4>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li>Vyberte <strong>typ elementu</strong> (20 typů: mosty + budovy) nebo zadejte název pro AI klasifikaci</li>
                <li>Zadejte <strong>objem betonu</strong> (m³) — povinný údaj</li>
                <li>Volitelně: plocha bednění (m²), hmotnost výztuže (kg) — jinak se odhadnou z profilu</li>
                <li>Nastavte záběry — dilatační spáry nebo ruční počet záběrů</li>
                <li>Klikněte <strong>Vypočítat plán</strong> — vše se spočítá okamžitě v prohlížeči</li>
              </ol>
            </div>

            {/* ── 3-column grid: Pipeline + Models + Settings ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

              {/* Column 1: Pipeline */}
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--r0-orange)' }}>
                  7-krokový výpočetní pipeline
                </h4>
                <div style={{ fontSize: 12 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong>1. Klasifikace elementu</strong>
                    <div style={{ color: 'var(--r0-slate-500)' }}>
                      Katalog 20 typů konstrukcí (9 mostních + 11 pozemních).
                      Každý typ má profil: orientace, typická výztuž (kg/m³),
                      maximální rychlost betonáže, doporučené bednění.
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>2. Rozhodnutí o betonáži</strong>
                    <div style={{ color: 'var(--r0-slate-500)' }}>
                      Rozhodovací strom: dilatační spáry → sekční režim,
                      bez spár → monolitický. Výpočet T-window (max. doba
                      nepřerušitelné betonáže), počet čerpadel, retardér.
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>3. Bednění — 3-fázový model</strong>
                    <div style={{ color: 'var(--r0-slate-500)' }}>
                      Fáze 1: první montáž (+15% přirážka). Fáze 2: přestavba
                      (střední záběry). Fáze 3: finální demontáž (-10%).
                      Normy z katalogů DOKA, PERI, NOE (h/m²).
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>4. Výztuž (Rebar Lite)</strong>
                    <div style={{ color: 'var(--r0-slate-500)' }}>
                      Doba = (hmotnost × norma h/t) ÷ (četa × směna × využití).
                      3-bodový odhad PERT: optimistická (-15%), pesimistická (+30%).
                      Norma ČSN 73 0210: 40–55 h/t dle typu elementu.
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>5. Betonáž (Pour Task)</strong>
                    <div style={{ color: 'var(--r0-slate-500)' }}>
                      Analýza úzkého hrdla: efektivní rychlost = MIN(čerpadlo,
                      betonárna, mixéry, omezení elementu). Výpočet počtu
                      čerpadel, záložní čerpadlo pro objemy &gt;200 m³.
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>6. RCPSP Scheduler</strong>
                    <div style={{ color: 'var(--r0-slate-500)' }}>
                      Plánování s omezenými zdroji (čety, sady bednění).
                      DAG graf závislostí → metoda kritické cesty (CPM) →
                      Ganttův diagram. Detaily níže.
                    </div>
                  </div>
                  <div>
                    <strong>7. PERT Monte Carlo</strong>
                    <div style={{ color: 'var(--r0-slate-500)' }}>
                      10 000 simulací s náhodným rozptylem dob → percentily
                      P50/P80/P90/P95. Detaily níže.
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 2: Mathematical Models */}
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--r0-orange)' }}>
                  Matematické modely
                </h4>
                <div style={{ fontSize: 12 }}>
                  <div style={{
                    marginBottom: 10, padding: '8px 10px',
                    background: 'white', border: '1px solid var(--r0-slate-200)', borderRadius: 6,
                  }}>
                    <strong>RCPSP (Resource-Constrained Project Scheduling)</strong>
                    <div style={{ color: 'var(--r0-slate-500)', marginTop: 4 }}>
                      Orientovaný acyklický graf (DAG): 5 aktivit × N záběrů.
                      Každý záběr = montáž → výztuž → beton → zrání → demontáž.
                      Závislosti: Finish-to-Start (beton po výztuži),
                      Start-to-Start s lagem (výztuž může začít při 50% montáže).
                      Greedy forward pass s prioritním řazením, pak zpětný průchod
                      pro výpočet rezerv (slack). Kritická cesta = aktivity s nulovou rezervou.
                    </div>
                  </div>
                  <div style={{
                    marginBottom: 10, padding: '8px 10px',
                    background: 'white', border: '1px solid var(--r0-slate-200)', borderRadius: 6,
                  }}>
                    <strong>Monte Carlo simulace (PERT)</strong>
                    <div style={{ color: 'var(--r0-slate-500)', marginTop: 4 }}>
                      <em>Co to je:</em> Metoda, která místo jednoho "přesného" čísla
                      dá <strong>pravděpodobnostní rozložení</strong> — s jakou pravděpodobností
                      se stavba vejde do termínu.<br/>
                      <em>Jak funguje:</em> Pro každou aktivitu máme 3 odhady doby
                      (optimistická, nejpravděpodobnější, pesimistická).
                      Simulace 10 000× náhodně vybere dobu z trojúhelníkového
                      rozdělení a sečte kritickou cestu.<br/>
                      <em>Výsledek:</em> P50 = medián (50% šance), P80 = konzervativní
                      plán, P90/P95 = bezpečná rezerva. Vzorec PERT:
                      t = (o + 4m + p) / 6, σ = (p - o) / 6.
                    </div>
                  </div>
                  <div style={{
                    marginBottom: 10, padding: '8px 10px',
                    background: 'white', border: '1px solid var(--r0-slate-200)', borderRadius: 6,
                  }}>
                    <strong>Nurse-Saul Maturity (zrání betonu)</strong>
                    <div style={{ color: 'var(--r0-slate-500)', marginTop: 4 }}>
                      Index zralosti: M = &Sigma;(T - T<sub>datum</sub>) &times; &Delta;t.
                      Dle ČSN EN 13670 Tab. NA.2: minimální doba zrání závisí
                      na teplotě, třídě betonu a typu cementu (CEM I/II/III).
                      Horizontální elementy: 70% f<sub>ck</sub> pro odbednění,
                      vertikální: 50% f<sub>ck</sub>.
                    </div>
                  </div>
                  <div style={{
                    padding: '8px 10px',
                    background: 'white', border: '1px solid var(--r0-slate-200)', borderRadius: 6,
                  }}>
                    <strong>Bottleneck Rate Analysis (betonáž)</strong>
                    <div style={{ color: 'var(--r0-slate-500)', marginTop: 4 }}>
                      Efektivní rychlost = MIN(kapacita čerpadla, výkon
                      betonárny, frekvence mixérů, omezení elementu).
                      Kalkulátor identifikuje úzké hrdlo a varuje,
                      pokud betonáž neprojde do T-window.
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 3: Settings + Norms */}
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--r0-orange)' }}>
                  Pokročilé nastavení
                </h4>
                <div style={{ fontSize: 12, marginBottom: 12 }}>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    <li><strong>Sady bednění</strong> — víc sad = rychlejší rotace mezi záběry</li>
                    <li><strong>Čety bednění / výztuže</strong> — oddělené čety, paralelní práce</li>
                    <li><strong>Pracovníků / četa</strong> — přímo ovlivňuje dobu výztuže (výchozí: 4)</li>
                    <li><strong>Směna</strong> — délka pracovního dne (výchozí: 10 h)</li>
                    <li><strong>Využití (k)</strong> — faktor 0.8 = 80% efektivního času (přestávky, logistika)</li>
                    <li><strong>Systém bednění</strong> — Frami Xlife, Framax, Top 50, Dokaflex, PERI VARIO</li>
                    <li><strong>Třída betonu</strong> — C12/15 až C50/60, ovlivňuje dobu zrání</li>
                    <li><strong>Typ cementu</strong> — CEM I (rychlý), CEM II (-15%), CEM III (-40%)</li>
                  </ul>
                </div>

                <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--r0-orange)' }}>
                  Normy a zdroje dat
                </h4>
                <div style={{ fontSize: 12 }}>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    <li><strong>ČSN EN 13670</strong> — provádění betonových konstrukcí, tabulka zrání NA.2</li>
                    <li><strong>ČSN 73 0210</strong> — výztuž, oborové normy pracnosti (40–55 h/t)</li>
                    <li><strong>ČSN EN 206+A2</strong> — trvanlivost betonu, třídy</li>
                    <li><strong>Katalogy DOKA / PERI / NOE</strong> — normy montáže/demontáže bednění (h/m²)</li>
                    <li><strong>KROS</strong> — zaokrouhlení cen: ceil(x/50) × 50</li>
                    <li><strong>PMI PMBOK</strong> — PERT, CPM, RCPSP metodika</li>
                  </ul>
                </div>

                <div style={{
                  marginTop: 12, padding: '8px 10px',
                  background: 'var(--r0-warn-bg)', border: '1px solid var(--r0-warn-border)',
                  borderRadius: 6, fontSize: 11, color: 'var(--r0-warn-text)',
                }}>
                  <strong>Traceabilita:</strong> Každý výpočet je zdokumentován v sekcích
                  "Zdroje norem" a "Rozhodovací log" ve výsledcích. Můžete ověřit,
                  jaké normy a hodnoty byly použity.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 56px)' }}>
        {/* LEFT: Input Form */}
        <aside style={{
          width: 380,
          flexShrink: 0,
          background: 'var(--r0-slate-50)',
          borderRight: '1px solid var(--r0-slate-200)',
          overflowY: 'auto',
          padding: '16px 20px',
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px', color: 'var(--r0-slate-800)' }}>
            Vstupní parametry
          </h2>

          {/* ─── Element ─── */}
          <Section title="Element">
            <label style={labelStyle}>
              <input
                type="checkbox"
                checked={form.use_name_classification}
                onChange={e => update('use_name_classification', e.target.checked)}
              />
              {' '}Klasifikace podle názvu (AI)
            </label>

            {form.use_name_classification ? (
              <Field label="Název elementu">
                <input
                  style={inputStyle}
                  value={form.element_name}
                  onChange={e => update('element_name', e.target.value)}
                  placeholder="např. Opěrné zdi, Mostovka..."
                />
              </Field>
            ) : (
              <Field label="Typ elementu">
                <select
                  style={inputStyle}
                  value={form.element_type}
                  onChange={e => update('element_type', e.target.value as StructuralElementType)}
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
              </Field>
            )}
          </Section>

          {/* ─── Mostovková deska: bridge config + context hint ─── */}
          {(form.element_type === 'mostovkova_deska' && !form.use_name_classification) && (
            <>
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
            </>
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
                  <button
                    disabled={normsScraping}
                    onClick={async () => {
                      setNormsScraping(true);
                      setNormsScrapeResult(null);
                      try {
                        // Proxy through Monolit backend to avoid CORS issues
                        const r = await fetch(`${API_URL}/api/planner-advisor/norms/scrape-all`, {
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
                    {normsScraping ? '⏳ Stahuji všechny normy...' : '📥 Stáhnout všechny normy z methvin.co'}
                  </button>
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

          {/* ─── Volumes ─── */}
          <Section title="Objemy">
            <Field label="Objem betonu (m³)">
              <input
                type="number"
                style={inputStyle}
                value={form.volume_m3}
                onChange={e => update('volume_m3', parseFloat(e.target.value) || 0)}
                min={1}
              />
            </Field>
            <Field label="Plocha bednění (m²)" hint="prázdné = odhad">
              <input
                type="number"
                style={inputStyle}
                value={form.formwork_area_m2}
                onChange={e => update('formwork_area_m2', e.target.value)}
                placeholder="automatický odhad"
              />
            </Field>
            <Field label="Hmotnost výztuže (kg)" hint="prázdné = odhad">
              <input
                type="number"
                style={inputStyle}
                value={form.rebar_mass_kg}
                onChange={e => update('rebar_mass_kg', e.target.value)}
                placeholder="automatický odhad"
              />
            </Field>

            {/* ─── Height + Element Dimension Hint ─── */}
            {(() => {
              const elemType = form.use_name_classification ? 'other' : form.element_type;
              const hint = ELEMENT_DIMENSION_HINTS[elemType];
              if (!hint) return null;
              return (
                <>
                  {hint.has_height && (
                    <Field
                      label="Výška (m)"
                      hint={hint.typical_height_range
                        ? `typicky ${hint.typical_height_range[0]}–${hint.typical_height_range[1]} m`
                        : 'pro výpočet podpěr'}
                    >
                      <input
                        type="number"
                        style={inputStyle}
                        value={form.height_m}
                        onChange={e => update('height_m', e.target.value)}
                        placeholder={hint.typical_height_range
                          ? `${hint.typical_height_range[0]}–${hint.typical_height_range[1]} m`
                          : 'výška elementu'}
                        min={0.1}
                        step={0.1}
                      />
                    </Field>
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
          </Section>

          {/* ─── Záběry (Tacts) ─── */}
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
                      <input
                        type="number"
                        style={inputStyle}
                        value={form.spara_spacing_m}
                        onChange={e => update('spara_spacing_m', parseFloat(e.target.value) || 0)}
                      />
                    </Field>
                    <Field label="Celková délka (m)">
                      <input
                        type="number"
                        style={inputStyle}
                        value={form.total_length_m}
                        onChange={e => update('total_length_m', parseFloat(e.target.value) || 0)}
                      />
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
                  <input
                    type="number"
                    style={inputStyle}
                    value={form.num_tacts_override}
                    onChange={e => update('num_tacts_override', e.target.value)}
                    placeholder="např. 10"
                    min={1}
                  />
                </Field>
                <Field label="Objem na záběr (m³)" hint="prázdné = celkem ÷ záběry">
                  <input
                    type="number"
                    style={inputStyle}
                    value={form.tact_volume_m3_override}
                    onChange={e => update('tact_volume_m3_override', e.target.value)}
                    placeholder={form.num_tacts_override
                      ? `${(form.volume_m3 / (parseInt(form.num_tacts_override) || 1)).toFixed(1)} m³ (auto)`
                      : 'automatický výpočet'}
                  />
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
          </Section>

          {/* ─── Environment ─── */}
          <Section title="Podmínky">
            <Field label="Datum zahájení" hint="pro kalendářní Gantt">
              <input
                type="date"
                style={inputStyle}
                value={form.start_date}
                onChange={e => update('start_date', e.target.value)}
              />
            </Field>

            <Field label="Sezóna">
              <select
                style={inputStyle}
                value={form.season}
                onChange={e => update('season', e.target.value as SeasonMode)}
              >
                {SEASONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
          </Section>

          {/* ─── Concrete / Maturity ─── */}
          <Section title="Beton / Zrání">
            <Field label="Třída betonu">
              <select style={inputStyle} value={form.concrete_class}
                onChange={e => update('concrete_class', e.target.value as ConcreteClass)}>
                {CONCRETE_CLASSES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
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
            <Field label="Teplota (°C)">
              <input type="number" style={inputStyle} value={form.temperature_c}
                onChange={e => update('temperature_c', parseFloat(e.target.value) || 0)} />
            </Field>
          </Section>

          {/* ─── Advanced ─── */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              background: 'none', border: 'none', color: 'var(--r0-blue)',
              cursor: 'pointer', fontSize: 13, padding: '8px 0', width: '100%', textAlign: 'left',
            }}
          >
            {showAdvanced ? '▼' : '▶'} Pokročilé nastavení
          </button>

          {showAdvanced && (
            <>
              <Section title="Zdroje">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Field label="Sady bednění">
                    <input type="number" style={inputStyle} value={form.num_sets} min={1} max={10}
                      onChange={e => update('num_sets', parseInt(e.target.value) || 1)} />
                  </Field>
                  <Field label="Čety bednění">
                    <input type="number" style={inputStyle} value={form.num_formwork_crews} min={1} max={5}
                      onChange={e => update('num_formwork_crews', parseInt(e.target.value) || 1)} />
                  </Field>
                  <Field label="Čety výztuže">
                    <input type="number" style={inputStyle} value={form.num_rebar_crews} min={1} max={5}
                      onChange={e => update('num_rebar_crews', parseInt(e.target.value) || 1)} />
                  </Field>
                  <Field label="Pracovníků/četa">
                    <input type="number" style={inputStyle} value={form.crew_size} min={2} max={10}
                      onChange={e => update('crew_size', parseInt(e.target.value) || 4)} />
                  </Field>
                  <Field label="Směna (h)">
                    <input type="number" style={inputStyle} value={form.shift_h} min={6} max={12}
                      onChange={e => update('shift_h', parseFloat(e.target.value) || 10)} />
                  </Field>
                  <Field label="Mzda (Kč/h)">
                    <input type="number" style={inputStyle} value={form.wage_czk_h} min={100}
                      onChange={e => update('wage_czk_h', parseFloat(e.target.value) || 398)} />
                  </Field>
                </div>
              </Section>

              <Section title="Bednění (override)">
                <Field label="Systém bednění">
                  <select style={inputStyle} value={form.formwork_system_name}
                    onChange={e => update('formwork_system_name', e.target.value)}>
                    <option value="">Automatický výběr</option>
                    {FORMWORK_SYSTEMS.map(s => (
                      <option key={s.name} value={s.name}>{s.name} ({s.manufacturer})</option>
                    ))}
                  </select>
                </Field>
              </Section>

              <Section title="Simulace">
                <label style={labelStyle}>
                  <input type="checkbox" checked={form.enable_monte_carlo}
                    onChange={e => update('enable_monte_carlo', e.target.checked)} />
                  {' '}Monte Carlo simulace (PERT)
                </label>
              </Section>
            </>
          )}

          {/* ─── Calculate Button ─── */}
          <button
            onClick={handleCalculate}
            style={{
              width: '100%', padding: '12px', marginTop: 16,
              background: 'var(--r0-orange)', color: 'white', border: 'none',
              borderRadius: 6, fontSize: 15, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Vypočítat plán
          </button>
          {result && (
            <button
              onClick={handleCompare}
              style={{
                width: '100%', padding: '10px', marginTop: 8,
                background: 'var(--r0-slate-200, #e2e8f0)', color: 'var(--r0-slate-700, #334155)',
                border: '1px solid var(--r0-slate-300, #cbd5e1)',
                borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Porovnat bednění (všechny systémy)
            </button>
          )}

          {error && (
            <div style={{
              marginTop: 12, padding: 12, background: 'var(--r0-error-bg)',
              border: '1px solid var(--r0-error-border)', borderRadius: 6, color: 'var(--r0-error-text)', fontSize: 13,
            }}>
              {error}
            </div>
          )}
        </aside>

        {/* RIGHT: Results */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: 'var(--r0-slate-100)' }}>
          {plan ? (
            <PlanResult plan={plan} startDate={form.start_date} showLog={showLog} onToggleLog={() => setShowLog(!showLog)} />
          ) : (
            <div style={{ textAlign: 'center', paddingTop: 100, color: 'var(--r0-slate-400)' }}>
              <div style={{ fontSize: 48 }}>📐</div>
              <p style={{ fontSize: 16, marginTop: 16 }}>Nastavte parametry a klikněte "Vypočítat plán"</p>
            </div>
          )}

          {/* ─── Formwork Comparison Table ─── */}
          {showComparison && comparison && comparison.length > 0 && (
            <div style={{
              marginTop: 16, padding: 16,
              background: 'var(--r0-white, #fff)',
              borderRadius: 8,
              border: '1px solid var(--r0-slate-200, #e2e8f0)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--r0-slate-800, #1e293b)' }}>
                  Porovnání bednění ({comparison.length} systémů)
                </h3>
                <button onClick={() => setShowComparison(false)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--r0-slate-400)',
                }}>✕</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--r0-slate-400)', marginBottom: 8 }}>
                Seřazeno od nejlevnějšího. Zelené = nejlepší varianta.
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', fontFamily: "'JetBrains Mono', monospace" }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--r0-slate-200, #e2e8f0)' }}>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--r0-slate-500)', fontWeight: 600 }}>#</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--r0-slate-500)', fontWeight: 600 }}>Systém</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--r0-slate-500)', fontWeight: 600 }}>Výrobce</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: 'var(--r0-slate-500)', fontWeight: 600 }}>Celkem dní</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: 'var(--r0-slate-500)', fontWeight: 600 }}>Montáž (d)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: 'var(--r0-slate-500)', fontWeight: 600 }}>Demontáž (d)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: 'var(--r0-slate-500)', fontWeight: 600 }}>Práce (Kč)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: 'var(--r0-slate-500)', fontWeight: 600 }}>Pronájem (Kč)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: 'var(--r0-slate-500)', fontWeight: 600, borderLeft: '2px solid var(--r0-orange, #f59e0b)' }}>Celkem (Kč)</th>
                      <th style={{ textAlign: 'right', padding: '6px 8px', fontSize: 11, color: 'var(--r0-slate-500)', fontWeight: 600 }}>vs. 1.</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', fontSize: 11 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((c, i) => {
                      const isBest = i === 0;
                      const isCurrent = plan && c.system === plan.formwork.system.name;
                      const diff = i > 0 ? c.total_cost_czk - comparison[0].total_cost_czk : 0;
                      const diffPct = i > 0 ? ((diff / comparison[0].total_cost_czk) * 100).toFixed(0) : '';
                      return (
                        <tr key={c.system} style={{
                          borderBottom: '1px solid var(--r0-slate-100, #f1f5f9)',
                          background: isBest ? 'rgba(34,197,94,0.06)' : isCurrent ? 'rgba(245,158,11,0.06)' : undefined,
                        }}>
                          <td style={{ padding: '5px 8px', fontWeight: isBest ? 700 : 400 }}>{i + 1}</td>
                          <td style={{ padding: '5px 8px', fontWeight: isBest || isCurrent ? 700 : 400 }}>
                            {c.system} {isCurrent ? '◀' : ''}
                          </td>
                          <td style={{ padding: '5px 8px', color: 'var(--r0-slate-500)' }}>{c.manufacturer}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{c.total_days}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{c.assembly_days}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{c.disassembly_days}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatCZK(c.formwork_labor_czk)}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatCZK(c.rental_czk)}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, borderLeft: '2px solid var(--r0-orange, #f59e0b)' }}>
                            {formatCZK(c.total_cost_czk)}
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', color: i === 0 ? '#22c55e' : '#ef4444', fontSize: 11 }}>
                            {i === 0 ? 'BEST' : `+${diffPct}%`}
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                            {!isCurrent && (
                              <button
                                onClick={() => { update('formwork_system_name', c.system); }}
                                style={{
                                  background: 'none', border: '1px solid var(--r0-slate-300)', borderRadius: 4,
                                  padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--r0-slate-600)',
                                }}
                              >Použít</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Export ──────────────────────────────────────────────────────────────────

function exportPlanToCSV(plan: PlannerOutput, startDate: string) {
  const BOM = '\uFEFF';
  const lines: string[] = [];
  const add = (label: string, value: string) => lines.push(`"${label}","${value}"`);

  add('Element', plan.element.label_cs);
  add('Režim betonáže', `${plan.pour_decision.pour_mode} / ${plan.pour_decision.sub_mode}`);
  add('Počet záběrů', String(plan.pour_decision.num_tacts));
  add('Objem / záběr (m³)', String(plan.pour_decision.tact_volume_m3));
  add('Celkem dní (prac.)', String(plan.schedule.total_days));
  add('Sekvenčně (dní)', String(plan.schedule.sequential_days));
  add('Úspora (%)', String(plan.schedule.savings_pct));
  add('Bednění - systém', plan.formwork.system.name);
  add('Montáž (dní/záběr)', String(plan.formwork.assembly_days));
  add('Zrání (dní)', String(plan.formwork.curing_days));
  add('Demontáž (dní/záběr)', String(plan.formwork.disassembly_days));
  add('Náklady - bednění práce (Kč)', String(Math.round(plan.costs.formwork_labor_czk)));
  add('Náklady - výztuž práce (Kč)', String(Math.round(plan.costs.rebar_labor_czk)));
  add('Náklady - betonáž práce (Kč)', String(Math.round(plan.costs.pour_labor_czk)));
  add('Náklady - pronájem bednění (Kč)', String(Math.round(plan.costs.formwork_rental_czk)));
  add('Celkem práce (Kč)', String(Math.round(plan.costs.total_labor_czk)));
  add('Celkem vše (Kč)', String(Math.round(plan.costs.total_labor_czk + plan.costs.formwork_rental_czk)));
  if (plan.monte_carlo) {
    add('P50 (dní)', String(plan.monte_carlo.p50));
    add('P80 (dní)', String(plan.monte_carlo.p80));
    add('P90 (dní)', String(plan.monte_carlo.p90));
  }

  // Tact details
  if (plan.schedule.tact_details?.length) {
    lines.push('');
    lines.push('"Záběr","Sada","Montáž od","Montáž do","Beton od","Beton do","Zrání od","Zrání do","Demontáž od","Demontáž do"');
    for (const td of plan.schedule.tact_details) {
      lines.push(`"T${td.tact}","S${td.set}","${td.assembly[0]}","${td.assembly[1]}","${td.concrete[0]}","${td.concrete[1]}","${td.curing[0]}","${td.curing[1]}","${td.stripping[0]}","${td.stripping[1]}"`);
    }
  }

  const blob = new Blob([BOM + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plan_${plan.element.type}_${startDate || 'export'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Result Display ─────────────────────────────────────────────────────────

function PlanResult({ plan, startDate, showLog, onToggleLog }: {
  plan: PlannerOutput;
  startDate: string;
  showLog: boolean;
  onToggleLog: () => void;
}) {
  // Calendar date mapping
  const calendarInfo = useMemo(() => {
    if (!startDate) return null;
    const start = new Date(startDate + 'T00:00:00');
    if (isNaN(start.getTime())) return null;
    const result = addWorkDays(start, plan.schedule.total_days);
    return {
      start,
      end: result.end_date,
      calendarDays: result.calendar_days,
      formatDate: (d: Date) => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' }),
      formatShort: (d: Date) => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' }),
    };
  }, [startDate, plan.schedule.total_days]);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => { exportPlanToXLSX(plan as any, startDate); }}
          style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
            borderRadius: 6, fontFamily: 'inherit',
            background: 'var(--r0-green-dark)', color: 'white',
          }}
        >
          Stáhnout Excel (.xlsx)
        </button>
        <button
          onClick={() => exportPlanToCSV(plan, startDate)}
          style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid var(--r0-slate-300)',
            cursor: 'pointer', borderRadius: 6, fontFamily: 'inherit',
            background: 'white', color: 'var(--r0-slate-700)',
          }}
        >
          Stáhnout CSV
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(plan.schedule.gantt || '');
            alert('Gantt zkopírován do schránky');
          }}
          style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600, border: '1px solid var(--r0-slate-300)',
            cursor: 'pointer', borderRadius: 6, fontFamily: 'inherit',
            background: 'white', color: 'var(--r0-slate-700)',
          }}
        >
          Kopírovat Gantt
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <KPICard label="Celkem dní" value={plan.schedule.total_days} unit={calendarInfo ? `prac. dní (${calendarInfo.calendarDays} kal.)` : 'prac. dní'} color="var(--r0-blue)" />
        <KPICard label="Počet záběrů" value={plan.pour_decision.num_tacts} unit="taktů" color="var(--r0-orange)" />
        <KPICard label="Náklady práce" value={formatCZK(plan.costs.total_labor_czk)} color="var(--r0-green)" />
        <KPICard label="Úspora vs. sekvenční" value={plan.schedule.savings_pct + '%'} color={plan.schedule.savings_pct > 0 ? 'var(--r0-green)' : 'var(--r0-slate-400)'} />
      </div>

      {/* Warnings */}
      {plan.warnings.length > 0 && (
        <Card title="Varování" icon="⚠️" borderColor="var(--r0-orange)">
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--r0-warn-text)' }}>
            {plan.warnings.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
          </ul>
        </Card>
      )}

      {/* Element + Pour */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card title="Element" icon="🧱">
          <Row label="Typ" value={plan.element.label_cs} />
          <Row label="Klasifikace" value={`${(plan.element.classification_confidence * 100).toFixed(0)}%`} />
          <Row label="Orientace" value={plan.element.profile.orientation === 'horizontal' ? 'Horizontální' : 'Vertikální'} />
          <Row label="Výztuž typická" value={`${plan.element.profile.rebar_ratio_kg_m3} kg/m³`} />
          <Row label="Podpěry" value={plan.element.profile.needs_supports ? 'Ano' : 'Ne'} />
          <Row label="Jeřáb" value={plan.element.profile.needs_crane ? 'Ano' : 'Ne'} />
        </Card>

        <Card title="Betonáž" icon="🏗️">
          <Row label="Režim" value={plan.pour_decision.pour_mode === 'sectional' ? 'Záběrový' : 'Monolitický'} />
          <Row label="Sub-mód" value={plan.pour_decision.sub_mode} />
          <Row label="Záběrů" value={plan.pour_decision.num_tacts.toString()} />
          <Row label="Objem/záběr" value={`${formatNum(plan.pour_decision.tact_volume_m3)} m³`} />
          <Row label="Rychlost" value={`${formatNum(plan.pour.effective_rate_m3_h)} m³/h`} />
          <Row label="Bottleneck" value={plan.pour.rate_bottleneck} />
        </Card>
      </div>

      {/* Formwork */}
      <Card title="Bednění" icon="📦">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <div style={subTitle}>Systém</div>
            <Row label="Název" value={plan.formwork.system.name} />
            <Row label="Výrobce" value={plan.formwork.system.manufacturer} />
            <Row label="Pronájem" value={plan.formwork.system.rental_czk_m2_month > 0
              ? `${formatNum(plan.formwork.system.rental_czk_m2_month, 0)} Kč/m²/měs`
              : 'Bez pronájmu'} />
          </div>
          <div>
            <div style={subTitle}>Časy (na záběr)</div>
            <Row label="Montáž" value={`${plan.formwork.assembly_days} dní`} />
            <Row label="Zrání" value={`${plan.formwork.curing_days} dní`} />
            <Row label="Demontáž" value={`${plan.formwork.disassembly_days} dní`} />
          </div>
          <div>
            <div style={subTitle}>3-fázový model</div>
            <Row label="1. záběr" value={formatCZK(plan.formwork.three_phase.initial_cost_labor)} />
            <Row label="Střední" value={formatCZK(plan.formwork.three_phase.middle_cost_labor)} />
            <Row label="Poslední" value={formatCZK(plan.formwork.three_phase.final_cost_labor)} />
            <Row label="Celkem" value={formatCZK(plan.formwork.three_phase.total_cost_labor)} bold />
          </div>
        </div>
      </Card>

      {/* Rebar */}
      <Card title="Výztuž" icon="🔩">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <Row label="Hmotnost / záběr" value={`${formatNum(plan.rebar.mass_kg, 0)} kg`} />
            <Row label="Zdroj" value={plan.rebar.mass_source === 'estimated' ? 'Odhad z profilu' : 'Zadaná hodnota'} />
            <Row label="Doba / záběr" value={`${formatNum(plan.rebar.duration_days)} dní`} />
          </div>
          <div>
            <Row label="Pracovníků (výpočet)" value={plan.rebar.crew_size.toString()} />
            {plan.rebar.recommended_crew !== plan.rebar.crew_size && (
              <Row label="Doporučeno" value={`${plan.rebar.recommended_crew} pracovníků`} />
            )}
            <Row label="Norma" value={`${plan.rebar.norm_h_per_t} h/t`} />
            <Row label="Náklady / záběr" value={formatCZK(plan.rebar.cost_labor)} />
          </div>
        </div>
        {/* PERT 3-point estimate */}
        <div style={{ marginTop: 8, fontSize: 13, color: '#666', display: 'flex', gap: 16 }}>
          <span>PERT: optimistická {formatNum(plan.rebar.optimistic_days)} d</span>
          <span>| nejpravděpodobnější {formatNum(plan.rebar.most_likely_days)} d</span>
          <span>| pesimistická {formatNum(plan.rebar.pessimistic_days)} d</span>
        </div>
      </Card>

      {/* Props (podpěry) */}
      {plan.props && plan.props.needed && (
        <Card title="Podpěrná konstrukce (stojky / skruž)" icon="🏗️">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div>
              <div style={subTitle}>Systém</div>
              <Row label="Typ" value={plan.props.system.name} />
              <Row label="Výrobce" value={plan.props.system.manufacturer} />
              <Row label="Raster" value={`${plan.props.grid_spacing_m} × ${plan.props.grid_spacing_m} m`} />
              <Row label="Počet stojek" value={`${plan.props.num_props_per_tact} ks`} bold />
            </div>
            <div>
              <div style={subTitle}>Časy (na záběr)</div>
              <Row label="Montáž" value={`${plan.props.assembly_days} dní`} />
              <Row label="Ponechání" value={`${plan.props.hold_days} dní`} bold />
              <Row label="Demontáž" value={`${plan.props.disassembly_days} dní`} />
              <Row label="Pronájem celkem" value={`${plan.props.rental_days} dní`} />
            </div>
            <div>
              <div style={subTitle}>Náklady</div>
              <Row label="Pronájem" value={formatCZK(plan.props.rental_cost_czk)} />
              <Row label="Práce" value={formatCZK(plan.props.labor_cost_czk)} />
              <Row label="Celkem" value={formatCZK(plan.props.total_cost_czk)} bold />
              <Row label="Hmotnost" value={`${(plan.props.total_weight_kg / 1000).toFixed(1)} t`} />
              {plan.props.crane_needed && (
                <Row label="Jeřáb" value="Nutný pro montáž" />
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Schedule / Gantt */}
      <Card title="Harmonogram" icon="📅">
        <div style={{ display: 'grid', gridTemplateColumns: calendarInfo ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Row label="Celkem (prac.)" value={`${plan.schedule.total_days} dní`} bold />
          <Row label="Sekvenčně" value={`${plan.schedule.sequential_days} dní`} />
          <Row label="Úspora" value={`${plan.schedule.savings_pct}%`} bold />
          {calendarInfo && (
            <Row label="Kalendářně" value={`${calendarInfo.calendarDays} dní`} />
          )}
        </div>

        {/* Calendar dates banner */}
        {calendarInfo && (
          <div style={{
            display: 'flex', gap: 16, padding: '10px 14px', marginBottom: 12,
            background: 'var(--r0-slate-50)', borderRadius: 6,
            border: '1px solid var(--r0-slate-200)', fontSize: 13,
          }}>
            <span>
              <span style={{ color: 'var(--r0-slate-500)' }}>Zahájení: </span>
              <strong>{calendarInfo.formatDate(calendarInfo.start)}</strong>
            </span>
            <span>
              <span style={{ color: 'var(--r0-slate-500)' }}>Dokončení: </span>
              <strong>{calendarInfo.formatDate(calendarInfo.end)}</strong>
            </span>
            <span style={{ color: 'var(--r0-slate-400)', fontSize: 12 }}>
              (Prac. dní: Po-Pá, svátky ČR)
            </span>
          </div>
        )}

        {plan.schedule.tact_details && plan.schedule.tact_details.length > 0 && (
          <PlannerGantt
            tact_details={plan.schedule.tact_details}
            total_days={plan.schedule.total_days}
            ganttText={plan.schedule.gantt}
          />
        )}

        {/* Calendar timeline — map work-day milestones to dates */}
        {calendarInfo && plan.schedule.tact_details && plan.schedule.tact_details.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--r0-slate-600)', marginBottom: 4 }}>
              Kalendářní milníky (záběry)
            </div>
            <div style={{ fontSize: 11, color: 'var(--r0-slate-400)', marginBottom: 8 }}>
              Datumy = kalendářní rozsah (vč. víkendů). Samotná betonáž trvá{' '}
              <strong style={{ color: 'var(--r0-phase-concrete, #f59e0b)' }}>
                {plan.pour.total_pour_hours < 1
                  ? `${Math.round(plan.pour.total_pour_hours * 60)} min`
                  : `${formatNum(plan.pour.total_pour_hours)} h`}
              </strong> / záběr ({formatNum(plan.pour.effective_rate_m3_h)} m³/h).
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--r0-slate-200)' }}>
                    <th style={thStyle}>Záběr</th>
                    <th style={{ ...thStyle, borderLeft: '3px solid var(--r0-phase-assembly)' }}>Montáž</th>
                    <th style={{ ...thStyle, borderLeft: '3px solid var(--r0-phase-rebar)' }}>Výztuž</th>
                    <th style={{ ...thStyle, borderLeft: '3px solid var(--r0-phase-concrete)' }}>Beton</th>
                    <th style={{ ...thStyle, borderLeft: '3px solid var(--r0-phase-curing)' }}>Zrání</th>
                    <th style={{ ...thStyle, borderLeft: '3px solid var(--r0-phase-stripping)' }}>Demontáž</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.schedule.tact_details.map(td => (
                    <tr key={td.tact} style={{ borderBottom: '1px solid var(--r0-slate-100)' }}>
                      <td style={tdStyle}><strong>T{td.tact}</strong> <span style={{ color: 'var(--r0-slate-400)' }}>S{td.set}</span></td>
                      <td style={{ ...tdStyle, borderLeft: '3px solid var(--r0-phase-assembly)' }}>{formatWorkDayRange(calendarInfo.start, td.assembly)}</td>
                      <td style={{ ...tdStyle, borderLeft: '3px solid var(--r0-phase-rebar)' }}>{formatWorkDayRange(calendarInfo.start, td.rebar)}</td>
                      <td style={{ ...tdStyle, borderLeft: '3px solid var(--r0-phase-concrete)' }}>{formatWorkDayRange(calendarInfo.start, td.concrete)}</td>
                      <td style={{ ...tdStyle, borderLeft: '3px solid var(--r0-phase-curing)' }}>{formatWorkDayRange(calendarInfo.start, td.curing)}</td>
                      <td style={{ ...tdStyle, borderLeft: '3px solid var(--r0-phase-stripping)' }}>{formatWorkDayRange(calendarInfo.start, td.stripping)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Monte Carlo */}
      {plan.monte_carlo && (
        <Card title="Monte Carlo (PERT)" icon="🎲">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Row label="P50 (medián)" value={`${plan.monte_carlo.p50} dní`} />
            <Row label="P80" value={`${plan.monte_carlo.p80} dní`} />
            <Row label="P90" value={`${plan.monte_carlo.p90} dní`} />
            <Row label="P95" value={`${plan.monte_carlo.p95} dní`} />
          </div>
          <div style={{ marginTop: 8 }}>
            <Row label="Průměr" value={`${formatNum(plan.monte_carlo.mean)} dní`} />
            <Row label="Směrodatná odchylka" value={`${formatNum(plan.monte_carlo.std_dev)} dní`} />
          </div>
        </Card>
      )}

      {/* Costs Summary */}
      <Card title="Souhrn nákladů" icon="💰">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Row label="Bednění (práce)" value={formatCZK(plan.costs.formwork_labor_czk)} />
            <Row label="Výztuž (práce)" value={formatCZK(plan.costs.rebar_labor_czk)} />
            <Row label="Betonáž (práce)" value={formatCZK(plan.costs.pour_labor_czk)} />
          </div>
          <div>
            <Row label="Pronájem bednění" value={formatCZK(plan.costs.formwork_rental_czk)} />
            <Row label="Celkem práce" value={formatCZK(plan.costs.total_labor_czk)} bold />
            <Row label="Celkem vše" value={formatCZK(plan.costs.total_labor_czk + plan.costs.formwork_rental_czk)} bold />
          </div>
        </div>
      </Card>

      {/* Norms Sources */}
      {plan.norms_sources && (
        <Card title="Zdroje norem" icon="📚">
          <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--r0-slate-600)' }}>
            <Row label="Montáž bednění" value={plan.norms_sources.formwork_assembly} />
            <Row label="Demontáž" value={plan.norms_sources.formwork_disassembly} />
            <Row label="Výztuž" value={plan.norms_sources.rebar} />
            <Row label="Zrání betonu" value={plan.norms_sources.curing} />
            {plan.norms_sources.skruz && (
              <Row label="Skruž" value={plan.norms_sources.skruz} />
            )}
          </div>
        </Card>
      )}

      {/* Decision Log */}
      <button onClick={onToggleLog} style={{
        background: 'none', border: 'none', color: 'var(--r0-blue)',
        cursor: 'pointer', fontSize: 13, padding: '8px 0',
      }}>
        {showLog ? '▼' : '▶'} Rozhodovací log ({plan.decision_log.length} kroků)
      </button>

      {showLog && (
        <Card title="Traceability" icon="📋">
          <ol style={{ margin: 0, paddingLeft: 24, fontSize: 12, color: 'var(--r0-slate-600)' }}>
            {plan.decision_log.map((entry, i) => (
              <li key={i} style={{ marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>{entry}</li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

// ─── UI Primitives ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
        color: 'var(--r0-slate-500)', letterSpacing: '0.05em', marginBottom: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--r0-slate-600)', marginBottom: 3 }}>
        {label}
        {hint && <span style={{ color: 'var(--r0-slate-400)', marginLeft: 4 }}>({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function Card({ title, icon, children, borderColor }: {
  title: string; icon: string; children: React.ReactNode; borderColor?: string;
}) {
  return (
    <div style={{
      background: 'white', borderRadius: 8, padding: 16, marginBottom: 12,
      border: '1px solid var(--r0-slate-200)',
      borderLeft: borderColor ? `4px solid ${borderColor}` : undefined,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', color: 'var(--r0-slate-800)' }}>
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function KPICard({ label, value, unit, color }: {
  label: string; value: string | number; unit?: string; color: string;
}) {
  return (
    <div style={{
      background: 'white', borderRadius: 8, padding: '14px 16px',
      border: '1px solid var(--r0-slate-200)', borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 11, color: 'var(--r0-slate-500)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--r0-slate-800)', fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </div>
      {unit && <div style={{ fontSize: 11, color: 'var(--r0-slate-400)' }}>{unit}</div>}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '3px 0', fontSize: 13, borderBottom: '1px solid var(--r0-slate-100)',
    }}>
      <span style={{ color: 'var(--r0-slate-500)' }}>{label}</span>
      <span style={{
        color: 'var(--r0-slate-800)',
        fontWeight: bold ? 700 : 500,
        fontFamily: "'JetBrains Mono', monospace",
      }}>{value}</span>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid var(--r0-slate-300)', borderRadius: 4,
  background: 'white', fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, color: 'var(--r0-slate-700)',
  marginBottom: 8, cursor: 'pointer',
};

const subTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--r0-slate-600)',
  marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '6px 8px', fontSize: 11,
  color: 'var(--r0-slate-500)', fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '5px 8px', fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
};
