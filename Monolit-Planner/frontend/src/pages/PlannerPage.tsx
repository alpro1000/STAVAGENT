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

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  planElement,
  addWorkDays,
  type PlannerInput,
  type PlannerOutput,
} from '@stavagent/monolit-shared';
import { FORMWORK_SYSTEMS, ELEMENT_DIMENSION_HINTS, getSuitableSystemsForElement } from '@stavagent/monolit-shared';
import type { StructuralElementType, SeasonMode } from '@stavagent/monolit-shared';
import type { ConcreteClass, CementType } from '@stavagent/monolit-shared';
import PortalBreadcrumb from '../components/PortalBreadcrumb';
import PlannerGantt from '../components/PlannerGantt';
import { exportPlanToXLSX } from '../utils/exportPlanXLSX';
import '../styles/r0.css';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
const IS_ADMIN = (import.meta as any).env?.VITE_ADMIN_MODE === 'true';

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
  { value: 'rimsa', label: 'Římsa', group: 'Mostní prvky' },
  { value: 'rigel', label: 'Příčník (ригель)', group: 'Mostní prvky' },
  { value: 'opery_ulozne_prahy', label: 'Opěry, úložné prahy', group: 'Mostní prvky' },
  { value: 'mostni_zavirne_zidky', label: 'Závěrné zídky', group: 'Mostní prvky' },
  { value: 'other', label: 'Jiný typ', group: '' },
];

const SEASONS: { value: SeasonMode; label: string; temp: number }[] = [
  { value: 'normal', label: 'Normální (5-25°C)', temp: 15 },
  { value: 'hot', label: 'Horko (>25°C)', temp: 30 },
  { value: 'cold', label: 'Zima (<5°C)', temp: 0 },
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
  rebar_norm_kg_m3: string; // empty = auto, kg per m³
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
  crew_size_rebar: number;
  shift_h: number;
  wage_czk_h: number;
  wage_formwork_czk_h: string; // empty = use wage_czk_h
  wage_rebar_czk_h: string;    // empty = use wage_czk_h
  wage_pour_czk_h: string;     // empty = use wage_czk_h
  formwork_system_name: string; // empty = auto
  rental_czk_override: string; // empty = catalog price, number = user override
  enable_monte_carlo: boolean;
  start_date: string; // ISO date string for calendar mapping
  num_bridges: number; // 1 = jeden most, 2 = levý+pravý (souběžné)
  deadline_days: string; // empty = no deadline, number = investor deadline in working days
}

const DEFAULT_FORM: FormState = {
  element_type: 'operne_zdi',
  element_name: '',
  use_name_classification: false,
  volume_m3: 120,
  formwork_area_m2: '',
  rebar_mass_kg: '',
  rebar_norm_kg_m3: '',
  height_m: '',
  tact_mode: 'spary',
  has_dilatacni_spary: false,
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
  crew_size_rebar: 4,
  shift_h: 10,
  wage_czk_h: 398,
  wage_formwork_czk_h: '',
  wage_rebar_czk_h: '',
  wage_pour_czk_h: '',
  formwork_system_name: '',
  rental_czk_override: '',
  enable_monte_carlo: false,
  start_date: new Date().toISOString().split('T')[0],
  num_bridges: 1,
  deadline_days: '',
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

// ─── Scenario Snapshot ──────────────────────────────────────────────────────

interface ScenarioSnapshot {
  id: number;
  label: string;
  crew_size: number;
  crew_size_rebar: number;
  num_sets: number;
  shift_h: number;
  wage_czk_h: number;
  wage_formwork_czk_h?: number;
  wage_rebar_czk_h?: number;
  wage_pour_czk_h?: number;
  num_formwork_crews: number;
  num_rebar_crews: number;
  formwork_system: string;
  manufacturer: string;
  total_days: number;
  formwork_labor_czk: number;
  rebar_labor_czk: number;
  pour_labor_czk: number;
  props_labor_czk: number;
  props_rental_czk: number;
  total_labor_czk: number;
  rental_czk: number;
  total_all_czk: number;
  assembly_days: number;
  disassembly_days: number;
  curing_days: number;
  pour_hours: number;
  has_overtime: boolean;
  overtime_info: string;
  savings_pct: number;
}

// ─── NumInput: allows clearing field while editing, validates on blur ────────

function NumInput({ value, onChange, min = 0, max, fallback, step, style, placeholder }: {
  value: number | string;
  onChange: (v: number | string) => void;
  min?: number;
  max?: number;
  fallback?: number;       // value to set if field left empty (undefined = allow empty string)
  step?: number;
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const editing = draft !== null;

  const handleFocus = () => setDraft(String(value));
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value);
  const handleBlur = () => {
    const raw = (draft ?? '').trim();
    setDraft(null);
    if (raw === '') {
      onChange(fallback !== undefined ? fallback : '');
      return;
    }
    let num = parseFloat(raw);
    if (isNaN(num)) { onChange(fallback !== undefined ? fallback : ''); return; }
    if (num < min) num = min;
    if (max !== undefined && num > max) num = max;
    onChange(typeof value === 'string' && fallback === undefined ? String(num) : num);
  };

  return (
    <input
      type="number"
      style={style}
      value={editing ? draft : value}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
    />
  );
}

// ─── localStorage keys ──────────────────────────────────────────────────────

const LS_FORM_KEY = 'planner-form';
const LS_SCENARIOS_KEY = 'planner-scenarios';
const LS_SCENARIO_SEQ_KEY = 'planner-scenario-seq';

function loadFromLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PlannerPage() {
  const [searchParams] = useSearchParams();

  // Position context — when opened from PositionsTable with position params
  const positionContext = useMemo(() => {
    const itemId = searchParams.get('item_id');
    const projectId = searchParams.get('project_id');
    const bridgeId = searchParams.get('bridge_id');
    if (!itemId && !projectId && !bridgeId) return null;
    return {
      item_id: itemId,
      project_id: projectId,
      bridge_id: bridgeId,
      position_id: searchParams.get('position_id'),
      part_name: searchParams.get('part_name'),
      subtype: searchParams.get('subtype'),
      volume_m3: searchParams.get('volume_m3') ? parseFloat(searchParams.get('volume_m3')!) : undefined,
      concrete_class: searchParams.get('concrete_class') as ConcreteClass | undefined,
    };
  }, [searchParams]);

  // If position context, prefill form
  const initialForm = useMemo(() => {
    if (!positionContext) return loadFromLS(LS_FORM_KEY, DEFAULT_FORM);
    const f = { ...DEFAULT_FORM };
    if (positionContext.volume_m3) f.volume_m3 = positionContext.volume_m3;
    if (positionContext.concrete_class) f.concrete_class = positionContext.concrete_class;
    return f;
  }, [positionContext]);

  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<PlannerOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [applyStatus, setApplyStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
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
    is_recommended?: boolean;
  }> | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  // ── Scenario snapshots for side-by-side comparison ──
  const [scenarios, setScenarios] = useState<ScenarioSnapshot[]>(() => loadFromLS(LS_SCENARIOS_KEY, []));
  const [scenarioSeq, setScenarioSeq] = useState(() => loadFromLS(LS_SCENARIO_SEQ_KEY, 0));

  // ── Persist to localStorage ──
  useEffect(() => { localStorage.setItem(LS_FORM_KEY, JSON.stringify(form)); }, [form]);
  useEffect(() => { localStorage.setItem(LS_SCENARIOS_KEY, JSON.stringify(scenarios)); }, [scenarios]);
  useEffect(() => { localStorage.setItem(LS_SCENARIO_SEQ_KEY, JSON.stringify(scenarioSeq)); }, [scenarioSeq]);
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
    // Filter systems suitable for the current element type
    const elemType = form.use_name_classification ? 'other' : form.element_type;
    const suitable = getSuitableSystemsForElement(elemType);
    for (const sys of suitable.all) {
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
          is_recommended: suitable.recommended.some(r => r.name === sys.name),
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
      crew_size_rebar: form.crew_size_rebar,
      shift_h: form.shift_h,
      k: 0.8,
      wage_czk_h: form.wage_czk_h,
      ...(form.wage_formwork_czk_h ? { wage_formwork_czk_h: Number(form.wage_formwork_czk_h) } : {}),
      ...(form.wage_rebar_czk_h ? { wage_rebar_czk_h: Number(form.wage_rebar_czk_h) } : {}),
      ...(form.wage_pour_czk_h ? { wage_pour_czk_h: Number(form.wage_pour_czk_h) } : {}),
      enable_monte_carlo: form.enable_monte_carlo,
      ...(form.deadline_days ? { deadline_days: Number(form.deadline_days) } : {}),
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
    if (form.rental_czk_override) input.rental_czk_override = parseFloat(form.rental_czk_override);
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

  /** Save current result as a scenario snapshot for comparison */
  const handleSaveScenario = () => {
    if (!plan) return;
    const nextSeq = scenarioSeq + 1;
    setScenarioSeq(nextSeq);
    const overtimeWarning = plan.warnings.find(w => w.includes('přesčas') || w.includes('Monolitická zálivka'));
    const snap: ScenarioSnapshot = {
      id: nextSeq,
      label: `S${nextSeq}: ${plan.formwork.system.name}, T${form.num_formwork_crews}×${form.crew_size} Ž${form.num_rebar_crews}×${form.crew_size_rebar}, ${form.num_sets} kompl.`,
      crew_size: form.crew_size,
      crew_size_rebar: form.crew_size_rebar,
      num_sets: form.num_sets,
      shift_h: form.shift_h,
      wage_czk_h: form.wage_czk_h,
      wage_formwork_czk_h: form.wage_formwork_czk_h ? Number(form.wage_formwork_czk_h) : undefined,
      wage_rebar_czk_h: form.wage_rebar_czk_h ? Number(form.wage_rebar_czk_h) : undefined,
      wage_pour_czk_h: form.wage_pour_czk_h ? Number(form.wage_pour_czk_h) : undefined,
      num_formwork_crews: form.num_formwork_crews,
      num_rebar_crews: form.num_rebar_crews,
      formwork_system: plan.formwork.system.name,
      manufacturer: plan.formwork.system.manufacturer,
      total_days: plan.schedule.total_days,
      formwork_labor_czk: plan.costs.formwork_labor_czk,
      rebar_labor_czk: plan.costs.rebar_labor_czk,
      pour_labor_czk: plan.costs.pour_labor_czk,
      props_labor_czk: plan.costs.props_labor_czk || 0,
      props_rental_czk: plan.costs.props_rental_czk || 0,
      total_labor_czk: plan.costs.total_labor_czk,
      rental_czk: plan.costs.formwork_rental_czk,
      total_all_czk: plan.costs.total_labor_czk + plan.costs.formwork_rental_czk + (plan.costs.props_labor_czk || 0) + (plan.costs.props_rental_czk || 0),
      assembly_days: plan.formwork.assembly_days,
      disassembly_days: plan.formwork.disassembly_days,
      curing_days: plan.formwork.curing_days,
      pour_hours: plan.pour.total_pour_hours,
      has_overtime: !!overtimeWarning,
      overtime_info: overtimeWarning || '',
      savings_pct: plan.schedule.savings_pct,
    };
    setScenarios(prev => [...prev, snap]);
  };

  return (
    <div className="r0-app">
      <PortalBreadcrumb />
      {/* Header */}
      <header className="r0-header">
        <div className="r0-header-left">
          <a href="/" className="r0-back-link">← Kalkulátor rozpočtu</a>
          <h1 className="r0-title">
            <span className="r0-icon">📐</span>
            Kalkulátor betonáže
          </h1>
        </div>
        <div className="r0-header-right">
          <button
            className="r0-btn"
            onClick={() => setShowHelp(!showHelp)}
            style={{
              background: showHelp ? 'var(--r0-orange)' : 'transparent',
              color: showHelp ? 'white' : 'var(--r0-slate-600)',
              border: `1px solid ${showHelp ? 'var(--r0-orange)' : 'var(--r0-slate-300)'}`,
              borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
              fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
            }}
          >
            ?
          </button>
          <span className="r0-badge">v1.0</span>
        </div>
      </header>

      {/* ─── Help Panel ─── */}
      {showHelp && (
        <div style={{
          background: 'var(--r0-slate-50)', borderBottom: '1px solid var(--r0-slate-200)',
          padding: '20px 24px', fontSize: 13, lineHeight: 1.7, color: 'var(--r0-slate-700)',
          maxHeight: 'calc(100vh - 60px)', overflowY: 'auto', position: 'relative',
        }}>
          <button onClick={() => setShowHelp(false)} style={{
            position: 'sticky', top: 0, float: 'right', background: 'var(--r0-slate-200)',
            border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, color: 'var(--r0-slate-700)', zIndex: 1,
          }}>Zavřít nápovědu ✕</button>
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
            <div className="r0-help-grid">

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
                    <li><strong>Tesaři</strong> — čety × pracovníků/četa = celkem tesařů na bednění</li>
                    <li><strong>Železáři</strong> — čety × pracovníků/četa = celkem železářů (přímo ovlivňuje dobu výztuže)</li>
                    <li><strong>Směna</strong> — délka pracovního dne, max 12 h (platí pro tesaře i železáře)</li>
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

      <div className="r0-planner-layout">
        {/* LEFT: Input Form */}
        <aside className="r0-planner-sidebar">
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
          <div style={{
            maxHeight: (form.element_type === 'mostovkova_deska' && !form.use_name_classification) ? 300 : 0,
            opacity: (form.element_type === 'mostovkova_deska' && !form.use_name_classification) ? 1 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.3s ease, opacity 0.2s ease, margin 0.3s ease',
            marginBottom: (form.element_type === 'mostovkova_deska' && !form.use_name_classification) ? 12 : 0,
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
          </div>

          {/* ─── Římsa: length-based pour hint ─── */}
          {(form.element_type === 'rimsa' && !form.use_name_classification) && (
            <div style={{
              padding: '10px 12px', marginBottom: 12,
              background: 'var(--r0-info-bg)', border: '1px solid var(--r0-info-border)', borderRadius: 6,
              fontSize: 11, color: 'var(--r0-info-text)', lineHeight: 1.6,
            }}>
              <strong>Římsa — záběry podle délky mostu:</strong><br/>
              Římsy se betonují po úsecích 25–30 m. Počet záběrů závisí na celkové délce mostu.<br/>
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

          {/* ─── Volumes ─── */}
          <Section title="Objemy">
            <Field label="Objem betonu (m³)">
              <NumInput style={inputStyle} value={form.volume_m3} min={0.1} fallback={1}
                onChange={v => update('volume_m3', v as number)} />
            </Field>
            <Field label="Plocha bednění (m²)" hint="prázdné = odhad">
              <NumInput style={inputStyle} value={form.formwork_area_m2} min={0}
                onChange={v => update('formwork_area_m2', String(v))} placeholder="automatický odhad" />
            </Field>
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
                      <NumInput style={inputStyle} value={form.height_m} min={0.1} step={0.1}
                        onChange={v => update('height_m', String(v))}
                        placeholder={hint.typical_height_range
                          ? `${hint.typical_height_range[0]}–${hint.typical_height_range[1]} m`
                          : 'výška elementu'} />
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
                width: '100%', padding: '12px', marginTop: 8,
                background: 'var(--r0-orange)', color: 'white',
                border: 'none',
                borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Porovnat bednění (všechny systémy)
            </button>
          )}
          {plan && (
            <button
              onClick={handleSaveScenario}
              style={{
                width: '100%', padding: '10px', marginTop: 8,
                background: 'var(--r0-slate-100, #f1f5f9)', color: 'var(--r0-slate-700, #334155)',
                border: '1px solid var(--r0-slate-300, #cbd5e1)',
                borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              + Uložit scénář {scenarios.length > 0 ? `(${scenarios.length})` : ''}
            </button>
          )}
          {scenarios.length > 0 && (
            <button
              onClick={() => { setScenarios([]); setScenarioSeq(0); }}
              style={{
                width: '100%', padding: '6px', marginTop: 4,
                background: 'none', color: 'var(--r0-slate-400)',
                border: 'none', fontSize: 11, cursor: 'pointer',
              }}
            >
              Vymazat scénáře
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

        {/* RIGHT: Results */}
        <main className="r0-planner-main">
          {plan ? (
            <PlanResult
              plan={plan}
              startDate={positionContext ? '' : form.start_date}
              showLog={showLog}
              onToggleLog={() => setShowLog(!showLog)}
              scenarios={scenarios}
              applyStatus={applyStatus}
              onApplyToPosition={positionContext ? async () => {
                setApplyStatus('saving');
                try {
                  const monolit_data = {
                    part_name: positionContext.part_name || '',
                    subtype: positionContext.subtype || plan.element.label_cs,
                    concrete_m3: form.volume_m3,
                    crew_size: form.crew_size,
                    wage_czk_ph: form.wage_czk_h,
                    shift_hours: form.shift_h,
                    days: plan.schedule.total_days,
                    labor_hours: plan.costs.total_labor_czk / form.wage_czk_h,
                    cost_czk: plan.costs.total_labor_czk,
                    unit_cost_on_m3: form.volume_m3 > 0 ? plan.costs.total_labor_czk / form.volume_m3 : 0,
                    kros_unit_czk: plan.costs.formwork_rental_czk + plan.costs.total_labor_czk,
                    kros_total_czk: plan.costs.formwork_rental_czk + plan.costs.total_labor_czk,
                    curing_days: plan.formwork.curing_days,
                    monolit_position_id: positionContext.position_id || undefined,
                    monolit_project_id: positionContext.bridge_id || positionContext.project_id || undefined,
                    calculated_at: new Date().toISOString(),
                    // Extended cost breakdown for TOV pre-fill (P3)
                    costs: {
                      formwork_labor_czk: plan.costs.formwork_labor_czk,
                      rebar_labor_czk: plan.costs.rebar_labor_czk,
                      pour_labor_czk: plan.costs.pour_labor_czk,
                      pour_night_premium_czk: plan.costs.pour_night_premium_czk,
                      total_labor_czk: plan.costs.total_labor_czk,
                      formwork_rental_czk: plan.costs.formwork_rental_czk,
                      props_labor_czk: plan.costs.props_labor_czk,
                      props_rental_czk: plan.costs.props_rental_czk,
                    },
                    resources: {
                      total_formwork_workers: plan.resources.total_formwork_workers,
                      total_rebar_workers: plan.resources.total_rebar_workers,
                      crew_size_formwork: plan.resources.crew_size_formwork,
                      crew_size_rebar: plan.resources.crew_size_rebar,
                      shift_h: plan.resources.shift_h,
                      wage_formwork_czk_h: plan.resources.wage_formwork_czk_h,
                      wage_rebar_czk_h: plan.resources.wage_rebar_czk_h,
                      wage_pour_czk_h: plan.resources.wage_pour_czk_h,
                      pour_shifts: plan.resources.pour_shifts,
                    },
                    formwork_info: {
                      system_name: plan.formwork.system.name,
                      manufacturer: plan.formwork.system.manufacturer,
                      rental_czk_m2_month: plan.formwork.system.rental_czk_m2_month,
                      assembly_days: plan.formwork.assembly_days,
                      disassembly_days: plan.formwork.disassembly_days,
                      curing_days: plan.formwork.curing_days,
                      formwork_area_m2: parseFloat(form.formwork_area_m2) || plan.rebar?.formwork_area_m2 || 0,
                      num_tacts: plan.pour_decision.num_tacts,
                      num_sets: form.num_sets,
                    },
                    schedule_info: {
                      total_days: plan.schedule.total_days,
                      tact_count: plan.pour_decision.num_tacts,
                    },
                  };
                  // Write to position via Monolit backend (days + full metadata for TOV pre-fill)
                  if (positionContext.position_id) {
                    const res = await fetch(`${API_URL}/api/positions`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ positions: [{
                        id: positionContext.position_id,
                        days: plan.schedule.total_days,
                        cost_czk: plan.costs.total_labor_czk,
                        concrete_m3: form.volume_m3,
                        curing_days: plan.formwork.curing_days,
                        metadata: JSON.stringify({
                          costs: monolit_data.costs,
                          resources: monolit_data.resources,
                          formwork_info: monolit_data.formwork_info,
                          schedule_info: monolit_data.schedule_info,
                          calculated_at: monolit_data.calculated_at,
                        }),
                      }] }),
                    });
                    if (!res.ok) throw new Error('Chyba při ukládání');
                  }
                  setApplyStatus('saved');
                  setTimeout(() => setApplyStatus('idle'), 3000);
                } catch (err) {
                  setApplyStatus('error');
                  setTimeout(() => setApplyStatus('idle'), 3000);
                }
              } : undefined}
            />
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
                Pouze systémy vhodné pro tento typ elementu. Seřazeno od nejlevnějšího. Zelené = nejlepší.
                {' '}Ceny pronájmu: DOKA ceník 2024, PERI nabídka DO-25-0056409 (2025), ULMA CZ 2024, NOE 2024.
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
                            {c.system} {isCurrent ? '◀' : ''}{' '}
                            {c.is_recommended && <span title="Doporučeno pro tento typ elementu" style={{ color: '#22c55e', fontSize: 10 }}>REC</span>}
                          </td>
                          <td style={{ padding: '5px 8px', color: 'var(--r0-slate-500)' }}>{c.manufacturer}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatNum(c.total_days, 1)}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatNum(c.assembly_days, 1)}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatNum(c.disassembly_days, 1)}</td>
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

          {/* ─── Scenario Comparison Panel ─── */}
          {scenarios.length >= 2 && (
            <div style={{
              marginTop: 16, padding: 16,
              background: 'var(--r0-white, #fff)',
              borderRadius: 8,
              border: '2px solid var(--r0-orange, #f59e0b)',
            }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: 'var(--r0-slate-800, #1e293b)' }}>
                Porovnání scénářů ({scenarios.length})
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--r0-slate-400)', marginBottom: 12 }}>
                <span>Zelené = nejlevnější, oranžové = nejrychlejší. Scénáře se ukládají v prohlížeči.</span>
                <button onClick={() => { setScenarios([]); setScenarioSeq(0); }}
                  style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>
                  Vymazat vše
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', fontFamily: "'JetBrains Mono', monospace" }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--r0-slate-200, #e2e8f0)' }}>
                      {['Scénář', 'Bednění', 'Tesaři', 'Železáři', 'Sady', 'Směna', 'Mzda', 'Dní', 'Montáž', 'Zrání',
                        'Demontáž', 'Betonáž (h)', 'Práce (Kč)', 'Pronájem (Kč)', 'Celkem (Kč)', 'OT', ''].map((h, idx) => (
                        <th key={idx} style={{
                          textAlign: idx <= 1 ? 'left' : idx === 15 ? 'center' : 'right',
                          padding: '6px 4px', fontSize: 10,
                          color: 'var(--r0-slate-500)', fontWeight: 600, whiteSpace: 'nowrap',
                          ...(h === 'Celkem (Kč)' ? { borderLeft: '2px solid var(--r0-orange, #f59e0b)' } : {}),
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const minCost = Math.min(...scenarios.map(s => s.total_all_czk));
                      const minDays = Math.min(...scenarios.map(s => s.total_days));
                      return scenarios.map((s) => {
                        const isCheapest = s.total_all_czk === minCost;
                        const isFastest = s.total_days === minDays;
                        return (
                          <tr key={s.id} style={{
                            borderBottom: '1px solid var(--r0-slate-100, #f1f5f9)',
                            background: isCheapest ? 'rgba(34,197,94,0.06)' : isFastest ? 'rgba(245,158,11,0.06)' : undefined,
                          }}>
                            <td style={{ padding: '5px 6px', fontWeight: 600, fontSize: 11 }}>
                              S{s.id}
                              {isCheapest && <span title="Nejlevnější" style={{ color: '#22c55e', marginLeft: 4 }}>$</span>}
                              {isFastest && <span title="Nejrychlejší" style={{ color: '#f59e0b', marginLeft: 2 }}>⚡</span>}
                            </td>
                            <td style={{ padding: '5px 6px', fontSize: 11 }}>{s.formwork_system}<br /><span style={{ color: 'var(--r0-slate-400)', fontSize: 10 }}>{s.manufacturer}</span></td>
                            <td style={{ padding: '5px 4px', textAlign: 'right' }}>{s.num_formwork_crews ?? 1}×{s.crew_size}={((s.num_formwork_crews ?? 1) * s.crew_size)}</td>
                            <td style={{ padding: '5px 4px', textAlign: 'right' }}>{s.num_rebar_crews ?? 1}×{s.crew_size_rebar ?? s.crew_size}={((s.num_rebar_crews ?? 1) * (s.crew_size_rebar ?? s.crew_size))}</td>
                            <td style={{ padding: '5px 4px', textAlign: 'right' }}>{s.num_sets}</td>
                            <td style={{ padding: '5px 4px', textAlign: 'right' }}>{s.shift_h}h</td>
                            <td style={{ padding: '5px 4px', textAlign: 'right' }} title={
                              (s.wage_formwork_czk_h || s.wage_rebar_czk_h || s.wage_pour_czk_h)
                                ? `T: ${s.wage_formwork_czk_h ?? s.wage_czk_h}, Ž: ${s.wage_rebar_czk_h ?? s.wage_czk_h}, B: ${s.wage_pour_czk_h ?? s.wage_czk_h}`
                                : undefined
                            }>
                              {(s.wage_formwork_czk_h || s.wage_rebar_czk_h || s.wage_pour_czk_h)
                                ? <span style={{ fontSize: 10 }}>T{s.wage_formwork_czk_h ?? s.wage_czk_h}/Ž{s.wage_rebar_czk_h ?? s.wage_czk_h}/B{s.wage_pour_czk_h ?? s.wage_czk_h}</span>
                                : (s.wage_czk_h ?? 398)
                              }
                            </td>
                            <td style={{ padding: '5px 4px', textAlign: 'right', fontWeight: 700 }}>{formatNum(s.total_days, 1)}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatNum(s.assembly_days, 1)}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatNum(s.curing_days, 1)}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatNum(s.disassembly_days, 1)}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatNum(s.pour_hours, 1)}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatCZK(s.total_labor_czk)}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatCZK(s.rental_czk)}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 700, borderLeft: '2px solid var(--r0-orange, #f59e0b)' }}>
                              {formatCZK(s.total_all_czk)}
                            </td>
                            <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                              {s.has_overtime ? (
                                <span title={s.overtime_info} style={{
                                  display: 'inline-block', background: '#fef3c7', color: '#92400e',
                                  borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600,
                                  cursor: 'help',
                                }}>OT</span>
                              ) : (
                                <span style={{ color: '#22c55e', fontSize: 10 }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '5px 6px' }}>
                              <button onClick={() => setScenarios(prev => prev.filter(x => x.id !== s.id))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--r0-slate-400)', fontSize: 14 }}
                                title="Odebrat">✕</button>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
              {scenarios.length >= 2 && (() => {
                const cheapest = scenarios.reduce((a, b) => a.total_all_czk <= b.total_all_czk ? a : b);
                const mostExpensive = scenarios.reduce((a, b) => a.total_all_czk >= b.total_all_czk ? a : b);
                const savings = mostExpensive.total_all_czk - cheapest.total_all_czk;
                const savingsPct = ((savings / mostExpensive.total_all_czk) * 100).toFixed(0);
                const fastest = scenarios.reduce((a, b) => a.total_days <= b.total_days ? a : b);
                const slowest = scenarios.reduce((a, b) => a.total_days >= b.total_days ? a : b);
                return (
                  <div style={{ marginTop: 12, padding: 10, background: 'var(--r0-slate-50, #f8fafc)', borderRadius: 6, fontSize: 12 }}>
                    <strong>Rozdíl:</strong>{' '}
                    Nejlevnější <strong>S{cheapest.id}</strong> ({formatCZK(cheapest.total_all_czk)}) vs
                    nejdražší <strong>S{mostExpensive.id}</strong> ({formatCZK(mostExpensive.total_all_czk)})
                    → úspora <strong style={{ color: '#22c55e' }}>{formatCZK(savings)} (−{savingsPct}%)</strong>
                    {fastest.id !== slowest.id && (
                      <span>
                        {' | '}Čas: <strong>S{fastest.id}</strong> ({formatNum(fastest.total_days, 1)}d) vs
                        <strong> S{slowest.id}</strong> ({formatNum(slowest.total_days, 1)}d)
                        → <strong style={{ color: '#f59e0b' }}>{formatNum(slowest.total_days - fastest.total_days, 1)} dní</strong> rozdíl
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          {scenarios.length === 1 && (
            <div style={{
              marginTop: 16, padding: 12, background: 'var(--r0-white, #fff)',
              borderRadius: 8, border: '1px dashed var(--r0-slate-300, #cbd5e1)',
              fontSize: 12, color: 'var(--r0-slate-500)', textAlign: 'center',
            }}>
              Uložen 1 scénář (<strong>{scenarios[0].label}</strong>).
              Změňte nastavení a klikněte "Uložit scénář" pro porovnání.
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

function PlanResult({ plan, startDate, showLog, onToggleLog, scenarios, applyStatus, onApplyToPosition }: {
  plan: PlannerOutput;
  startDate: string;
  showLog: boolean;
  onToggleLog: () => void;
  scenarios?: any[];
  applyStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onApplyToPosition?: () => void;
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
      <div className="r0-action-bar">
        <button
          onClick={() => { exportPlanToXLSX(plan as any, startDate, scenarios && scenarios.length > 0 ? scenarios : undefined); }}
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
        {onApplyToPosition && (
          <button
            onClick={onApplyToPosition}
            disabled={applyStatus === 'saving'}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
              borderRadius: 6, fontFamily: 'inherit',
              background: applyStatus === 'saved' ? '#22c55e' : applyStatus === 'error' ? '#ef4444' : '#FF9F1C',
              color: 'white',
              opacity: applyStatus === 'saving' ? 0.6 : 1,
            }}
          >
            {applyStatus === 'saving' ? '⏳ Ukládám...' :
             applyStatus === 'saved' ? '✅ Uloženo' :
             applyStatus === 'error' ? '❌ Chyba' :
             '📋 Aplikovat do pozice'}
          </button>
        )}
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
      <div className="r0-grid-4" style={{ marginBottom: 20 }}>
        <KPICard label={plan.deadline_check && !plan.deadline_check.fits ? `Celkem dní (termín ${plan.deadline_check.deadline_days}d)` : 'Celkem dní'} value={plan.schedule.total_days} unit={calendarInfo ? `prac. dní (${calendarInfo.calendarDays} kal.)` : 'prac. dní'} color={plan.deadline_check && !plan.deadline_check.fits ? '#ef4444' : 'var(--r0-blue)'} />
        <KPICard label="Počet záběrů" value={plan.pour_decision.num_tacts} unit="taktů" color="var(--r0-orange)" />
        <KPICard label="Náklady práce" value={formatCZK(plan.costs.total_labor_czk)} color="var(--r0-green)" />
        <KPICard label="Úspora vs. sekvenční" value={plan.schedule.savings_pct + '%'} color={plan.schedule.savings_pct > 0 ? 'var(--r0-green)' : 'var(--r0-slate-400)'} />
      </div>

      {/* Resource Optimization + Deadline Check */}
      {plan.deadline_check && (() => {
        const dc = plan.deadline_check;
        const hasDeadline = dc.deadline_days != null;
        const hasSuggestions = dc.suggestions.length > 0;

        // Determine card style
        const deadlineExceeded = hasDeadline && !dc.fits;
        const title = deadlineExceeded
          ? `Termín investora — PŘEKROČEN (+${dc.overrun_days}d)`
          : hasSuggestions
            ? 'Optimalizace zdrojů'
            : 'Optimalizace zdrojů — aktuální nastavení je optimální';
        const icon = deadlineExceeded ? '🚨' : hasSuggestions ? '⚡' : '✅';
        const borderColor = deadlineExceeded ? '#ef4444' : hasSuggestions ? 'var(--r0-blue)' : 'var(--r0-green)';

        return (
          <Card title={title} icon={icon} borderColor={borderColor}>
            <div style={{ fontSize: 13 }}>
              {/* Deadline overrun banner */}
              {deadlineExceeded && (
                <div style={{
                  marginBottom: 12, padding: '10px 14px', borderRadius: 6,
                  background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                  fontWeight: 600,
                }}>
                  Termín: {dc.deadline_days} dní | Vypočteno: {dc.calculated_days} dní | Překročení: +{dc.overrun_days} dní ({Math.round((dc.overrun_days / dc.deadline_days!) * 100)}%)
                </div>
              )}

              {/* Suggestions table */}
              {hasSuggestions ? (
                <>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--r0-slate-200)' }}>
                        <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--r0-slate-500)', fontSize: 11 }}>#</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--r0-slate-500)', fontSize: 11 }}>Konfigurace</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--r0-slate-500)', fontSize: 11 }}>Dní</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--r0-slate-500)', fontSize: 11 }}>Úspora dní</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--r0-slate-500)', fontSize: 11 }}>Náklady</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--r0-slate-500)', fontSize: 11 }}>Rozdíl Kč</th>
                        {hasDeadline && <th style={{ textAlign: 'center', padding: '4px 6px', color: 'var(--r0-slate-500)', fontSize: 11 }}>Termín</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {dc.suggestions.map((s, i) => {
                        const isBestDeadline = hasDeadline && dc.best_for_deadline && s.label === dc.best_for_deadline.label;
                        return (
                          <tr key={i} style={{
                            borderBottom: '1px solid var(--r0-slate-100)',
                            background: isBestDeadline ? '#f0fdf4' : i === 0 ? '#eff6ff' : 'transparent',
                            fontWeight: isBestDeadline || i === 0 ? 600 : 400,
                          }}>
                            <td style={{ padding: '5px 6px' }}>{isBestDeadline ? '⭐' : i + 1}</td>
                            <td style={{ padding: '5px 6px' }}>{s.label}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatNum(s.total_days, 1)}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right', color: '#16a34a' }}>
                              −{formatNum(dc.calculated_days - s.total_days, 1)}
                            </td>
                            <td style={{ padding: '5px 6px', textAlign: 'right' }}>{formatCZK(s.total_cost_czk)}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'right', color: s.extra_cost_czk > 0 ? '#dc2626' : '#16a34a' }}>
                              {s.extra_cost_czk > 0 ? '+' : ''}{formatCZK(s.extra_cost_czk)}
                            </td>
                            {hasDeadline && (
                              <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                                {s.fits_deadline ? <span style={{ color: '#16a34a' }}>OK</span> : <span style={{ color: '#dc2626' }}>NE</span>}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Summary line */}
                  <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 6, background: 'var(--r0-slate-50, #f8fafc)', fontSize: 12 }}>
                    {dc.fastest && (
                      <span>
                        <strong>Nejrychlejší:</strong> {formatNum(dc.fastest.total_days, 1)} dní ({dc.fastest.label})
                        {dc.fastest.extra_cost_czk > 0 && <span style={{ color: '#dc2626' }}> +{formatCZK(dc.fastest.extra_cost_czk)}</span>}
                      </span>
                    )}
                    {dc.cheapest_faster && dc.fastest && dc.cheapest_faster.label !== dc.fastest.label && (
                      <span>
                        {' | '}<strong>Nejlevnější zrychlení:</strong> {formatNum(dc.cheapest_faster.total_days, 1)} dní
                        {dc.cheapest_faster.extra_cost_czk > 0
                          ? <span style={{ color: '#dc2626' }}> +{formatCZK(dc.cheapest_faster.extra_cost_czk)}</span>
                          : <span style={{ color: '#16a34a' }}> {formatCZK(dc.cheapest_faster.extra_cost_czk)}</span>
                        }
                      </span>
                    )}
                  </div>

                  {/* Deadline best recommendation */}
                  {deadlineExceeded && dc.best_for_deadline && (
                    <div style={{
                      marginTop: 8, padding: '10px 14px', borderRadius: 6,
                      background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534',
                    }}>
                      <strong>Pro splnění termínu:</strong> {dc.best_for_deadline.label} → {formatNum(dc.best_for_deadline.total_days, 1)} dní
                      {dc.best_for_deadline.extra_cost_czk > 0 && (
                        <span> (navíc {formatCZK(dc.best_for_deadline.extra_cost_czk)})</span>
                      )}
                    </div>
                  )}
                  {deadlineExceeded && !dc.best_for_deadline && (
                    <div style={{
                      marginTop: 8, padding: '10px 14px', borderRadius: 6,
                      background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                    }}>
                      Žádná kombinace zdrojů (až 4 čety, 6 sad) nesplní termín {dc.deadline_days} dní.
                      Zvažte delší směny, jiný systém bednění, nebo úpravu projektu.
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: 'var(--r0-slate-500)', fontStyle: 'italic' }}>
                  Aktuální konfigurace je již optimální — přidání čet nebo sad nezrychlí harmonogram.
                </div>
              )}
            </div>
          </Card>
        );
      })()}

      {/* Warnings */}
      {plan.warnings.length > 0 && (
        <Card title="Varování" icon="⚠️" borderColor="var(--r0-orange)">
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--r0-warn-text)' }}>
            {plan.warnings.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
          </ul>
        </Card>
      )}

      {/* Element + Pour */}
      <div className="r0-grid-2">
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
          <Row label="Úzké hrdlo" value={plan.pour.rate_bottleneck} />
        </Card>
      </div>

      {/* Formwork */}
      <Card title="Bednění" icon="📦">
        <div className="r0-grid-3">
          <div>
            <div style={subTitle}>Systém</div>
            <Row label="Název" value={plan.formwork.system.name} />
            <Row label="Výrobce" value={plan.formwork.system.manufacturer} />
            <Row label="Pronájem" value={plan.formwork.system.rental_czk_m2_month > 0
              ? `${formatNum(plan.formwork.system.rental_czk_m2_month, 0)} Kč/m²/měs`
              : 'Bez pronájmu'} />
            <Row label="Tesařů celkem" value={`${plan.resources?.total_formwork_workers ?? '-'} (${plan.resources?.num_formwork_crews ?? 1}×${plan.resources?.crew_size_formwork ?? '-'})`} />
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
        {(() => {
          const nTacts = plan.pour_decision.num_tacts;
          const totalMassKg = plan.rebar.mass_kg * nTacts;
          const totalMassT = totalMassKg / 1000;
          return (
            <>
              <div className="r0-grid-2" style={{ gap: 16 }}>
                <div>
                  <Row label="Hmotnost celkem" value={totalMassT >= 1 ? `${formatNum(totalMassT, 1)} t` : `${formatNum(totalMassKg, 0)} kg`} bold />
                  <Row label="Hmotnost / záběr" value={`${formatNum(plan.rebar.mass_kg, 0)} kg`} />
                  <Row label="Zdroj" value={plan.rebar.mass_source === 'estimated' ? 'Odhad z profilu' : 'Zadaná hodnota'} />
                  <Row label="Doba / záběr" value={`${formatNum(plan.rebar.duration_days)} dní`} />
                </div>
                <div>
                  <Row label="Náklady celkem" value={formatCZK(plan.rebar.cost_labor * nTacts)} bold />
                  <Row label="Náklady / záběr" value={formatCZK(plan.rebar.cost_labor)} />
                  <Row label="Železářů celkem" value={`${plan.resources?.total_rebar_workers ?? plan.rebar.crew_size} (${plan.resources?.num_rebar_crews ?? 1}×${plan.resources?.crew_size_rebar ?? plan.rebar.crew_size})`} />
                  {plan.rebar.recommended_crew !== plan.rebar.crew_size && (
                    <div style={{
                      background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 6,
                      padding: '4px 8px', marginTop: 4,
                    }}>
                      <Row label="⚠️ Doporučeno" value={`${plan.rebar.recommended_crew} pracovníků`} bold />
                    </div>
                  )}
                  <Row label="Norma" value={`${plan.rebar.norm_h_per_t} h/t`} />
                </div>
              </div>
              {/* PERT 3-point estimate */}
              <div className="r0-pert-row" style={{ color: '#666' }}>
                <span>PERT: optimistická {formatNum(plan.rebar.optimistic_days)} d</span>
                <span>| nejpravděpodobnější {formatNum(plan.rebar.most_likely_days)} d</span>
                <span>| pesimistická {formatNum(plan.rebar.pessimistic_days)} d</span>
              </div>
            </>
          );
        })()}
      </Card>

      {/* Props (podpěry) */}
      {plan.props && plan.props.needed && (
        <Card title="Podpěrná konstrukce (stojky / skruž)" icon="🏗️">
          <div className="r0-grid-3">
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
        <div className={calendarInfo ? 'r0-grid-4' : 'r0-grid-3'} style={{ marginBottom: 12 }}>
          <Row label="Celkem (prac.)" value={`${plan.schedule.total_days} dní`} bold />
          <Row label="Sekvenčně" value={`${plan.schedule.sequential_days} dní`} />
          <Row label="Úspora" value={`${plan.schedule.savings_pct}%`} bold />
          {calendarInfo && (
            <Row label="Kalendářně" value={`${calendarInfo.calendarDays} dní`} />
          )}
        </div>

        {/* Calendar dates banner */}
        {calendarInfo && (
          <div className="r0-calendar-banner">
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
          <div className="r0-grid-4">
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
        {(() => {
          const propsLabor = plan.costs.props_labor_czk || 0;
          const propsRental = plan.costs.props_rental_czk || 0;
          const totalAll = plan.costs.total_labor_czk + plan.costs.formwork_rental_czk + propsLabor + propsRental;
          return (
            <div className="r0-grid-2">
              <div>
                <Row label="Bednění (práce)" value={formatCZK(plan.costs.formwork_labor_czk)} />
                <Row label="Výztuž (práce)" value={formatCZK(plan.costs.rebar_labor_czk)} />
                <Row label="Betonáž (práce)" value={formatCZK(plan.costs.pour_labor_czk)} />
                {propsLabor > 0 && <Row label="Podpěry (práce)" value={formatCZK(propsLabor)} />}
              </div>
              <div>
                <Row label="Pronájem bednění" value={formatCZK(plan.costs.formwork_rental_czk)} />
                {propsRental > 0 && <Row label="Pronájem podpěr" value={formatCZK(propsRental)} />}
                <Row label="Celkem práce" value={formatCZK(plan.costs.total_labor_czk + propsLabor)} bold />
                <Row label="Celkem vše" value={formatCZK(totalAll)} bold />
              </div>
            </div>
          );
        })()}
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
