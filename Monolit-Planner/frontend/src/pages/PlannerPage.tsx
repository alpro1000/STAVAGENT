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

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Calculator, TriangleAlert, ArrowLeft, Download, Hourglass, Blocks, Siren, Zap, CircleCheckBig, Star, CalendarDays, DollarSign } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  planElement,
  addWorkDays,
  aggregateScheduleDays,
  type PlannerInput,
  type PlannerOutput,
} from '@stavagent/monolit-shared';
import { FORMWORK_SYSTEMS, ELEMENT_DIMENSION_HINTS, getSuitableSystemsForElement, classifyElement, recommendFormwork, recommendBridgeTechnology, getMSSTactDays } from '@stavagent/monolit-shared';
import { findLinkedPositions, detectWorkType } from '@stavagent/monolit-shared';
import type { TOVEntries, TOVLaborEntry, TOVMaterialEntry } from '@stavagent/monolit-shared';
import type { StructuralElementType, SeasonMode } from '@stavagent/monolit-shared';
import type { ConcreteClass, CementType } from '@stavagent/monolit-shared';
import PortalBreadcrumb from '../components/PortalBreadcrumb';
import PlannerGantt from '../components/PlannerGantt';
import { exportPlanToXLSX } from '../utils/exportPlanXLSX';
import { plannerVariantsAPI } from '../services/api';
import '../styles/r0.css';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
const IS_ADMIN = (import.meta as any).env?.VITE_ADMIN_MODE === 'true';
const PORTAL_URL = 'https://www.stavagent.cz/portal';

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

// ─── Document Suggestion types ──────────────────────────────────────────────

interface DocFactSource {
  document: string;
  page: number | null;
  confidence: number;
  source_type: string;
}

interface DocSuggestion {
  param: string;
  value: any;
  label: string;
  source: DocFactSource;
  accepted: boolean;
}

interface DocWarning {
  severity: 'blocking' | 'recommended' | 'info';
  message: string;
  param: string | null;
  rule: string;
}

interface DocConflict {
  param: string;
  values: Array<{ value: any; source: DocFactSource }>;
  recommended_value: any;
  recommendation_reason: string;
}

interface DocSuggestionsResponse {
  project_id: string;
  building_object: string;
  suggestions: DocSuggestion[];
  warnings: DocWarning[];
  conflicts: DocConflict[];
  facts_count: number;
  documents_used: string[];
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
  { value: 'prechodova_deska', label: 'Přechodová deska', group: 'Mostní prvky' },
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
  // Manual záběry (custom non-uniform tacts) — overrides num_tacts + volume split
  // When enabled, each záběr has its own volume and optional name/formwork area.
  // The engine receives num_tacts_override = array.length and
  // tact_volume_m3_override = max(volumes) (bottleneck, drives schedule).
  use_manual_zabery: boolean;
  manual_zabery: Array<{ name: string; volume_m3: string; formwork_area_m2: string }>;
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
  formwork_shape_correction: string; // '1.0' | '1.3' | '1.5' | '1.8'
  num_identical_elements: number; // default 1
  formwork_sets_count: string; // empty = use num_sets
  enable_monte_carlo: boolean;
  start_date: string; // ISO date string for calendar mapping
  num_bridges: number; // 1 = jeden most, 2 = levý+pravý (souběžné)
  deadline_days: string; // empty = no deadline, number = investor deadline in working days
  is_prestressed: boolean;
  bridge_deck_subtype: string;
  include_kridla: boolean;
  kridla_height_m: string; // empty = not set
  // Bridge geometry (mostovka only)
  span_m: string;         // empty = not set
  num_spans: string;      // empty = not set
  nk_width_m: string;     // empty = auto (12m)
  construction_technology: '' | 'fixed_scaffolding' | 'mss' | 'cantilever';
  mss_tact_days: string;  // empty = auto from subtype
  // Ztracené bednění (lost formwork / trapézový plech) — only for horizontal elements
  has_lost_formwork: boolean;
  lost_formwork_area_m2: string; // empty = 0
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
  use_manual_zabery: false,
  manual_zabery: [],
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
  formwork_shape_correction: '1.0',
  num_identical_elements: 1,
  formwork_sets_count: '',
  enable_monte_carlo: false,
  start_date: new Date().toISOString().split('T')[0],
  num_bridges: 1,
  deadline_days: '',
  is_prestressed: false,
  bridge_deck_subtype: '',
  include_kridla: false,
  kridla_height_m: '',
  span_m: '',
  num_spans: '',
  nk_width_m: '',
  construction_technology: '',
  mss_tact_days: '',
  has_lost_formwork: false,
  lost_formwork_area_m2: '',
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
  const queryClient = useQueryClient();

  // Position context — when opened from PositionsTable with position params
  const positionContext = useMemo(() => {
    const itemId = searchParams.get('item_id');
    const projectId = searchParams.get('project_id');
    const bridgeId = searchParams.get('bridge_id');
    if (!itemId && !projectId && !bridgeId) return null;

    const partName = searchParams.get('part_name') || '';

    // Extract concrete class from part_name: C20/25, C30/37, etc.
    const concreteMatch = partName.match(/C(\d{2})\/(\d{2,3})/i);
    const extractedConcreteClass = concreteMatch ? `C${concreteMatch[1]}/${concreteMatch[2]}` : undefined;

    // Extract exposure class from part_name: XC1, XD2, XF2, etc.
    const exposureMatch = partName.match(/X[CDFASM]\d/i);
    const extractedExposure = exposureMatch ? exposureMatch[0].toUpperCase() : undefined;

    return {
      item_id: itemId,
      project_id: projectId,
      bridge_id: bridgeId,
      position_id: searchParams.get('position_id'),
      part_name: partName,
      subtype: searchParams.get('subtype'),
      volume_m3: searchParams.get('volume_m3') ? parseFloat(searchParams.get('volume_m3')!) : undefined,
      concrete_class: (searchParams.get('concrete_class') || extractedConcreteClass) as ConcreteClass | undefined,
      exposure_class: extractedExposure,
      // Sibling position IDs for TOV mapping (bednění, výztuž, zrání, odbednění)
      bedneni_position_id: searchParams.get('bedneni_position_id'),
      bedneni_m2: searchParams.get('bedneni_m2') ? parseFloat(searchParams.get('bedneni_m2')!) : undefined,
      vyzuz_position_id: searchParams.get('vyzuz_position_id'),
      vyzuz_qty: searchParams.get('vyzuz_qty') ? parseFloat(searchParams.get('vyzuz_qty')!) : undefined,
      zrani_position_id: searchParams.get('zrani_position_id'),
      odbedneni_position_id: searchParams.get('odbedneni_position_id'),
      podperna_position_id: searchParams.get('podperna_position_id'),
      predpeti_position_id: searchParams.get('predpeti_position_id'),
      otskp_code: searchParams.get('otskp_code') || '',
    };
  }, [searchParams]);

  /** Mode A = opened from Monolit position (ordinal days, no date picker) */
  const isMonolitMode = !!positionContext?.position_id || !!positionContext?.part_name;

  /** Portal mode: opened from Portal (back-link → Portal, not Monolit) */
  const isPortalMode = !!localStorage.getItem('monolit-portal-project');

  // If position context, prefill form with auto-classification
  const initialForm = useMemo(() => {
    if (!positionContext) return loadFromLS(LS_FORM_KEY, DEFAULT_FORM);
    const f = { ...DEFAULT_FORM };

    // Auto-classify element_type from part_name (with bridge context)
    if (positionContext.part_name) {
      const isBridge = !!(positionContext.bridge_id && /^SO[-\s]?\d/i.test(positionContext.bridge_id));
      const classified = classifyElement(positionContext.part_name, { is_bridge: isBridge });
      if (classified.element_type !== 'other' || classified.confidence > 0.5) {
        f.element_type = classified.element_type;
      }
      // Use OTSKP metadata to prefill form fields
      if (classified.is_prestressed_detected === true) f.is_prestressed = true;
      if (classified.concrete_class_detected) f.concrete_class = classified.concrete_class_detected as any;
      if (classified.bridge_deck_subtype_detected) f.bridge_deck_subtype = classified.bridge_deck_subtype_detected;
      if (classified.has_kridla_detected) f.include_kridla = true;
    }

    if (positionContext.volume_m3) f.volume_m3 = positionContext.volume_m3;
    if (positionContext.concrete_class) f.concrete_class = positionContext.concrete_class;
    if (positionContext.bedneni_m2) f.formwork_area_m2 = String(positionContext.bedneni_m2);
    if (positionContext.vyzuz_qty) f.rebar_mass_kg = String(positionContext.vyzuz_qty);

    // Auto-detect bridge deck subtype and is_prestressed from part_name
    if (f.element_type === 'mostovkova_deska' && positionContext.part_name) {
      const pn = positionContext.part_name.toUpperCase();
      if (/KOMOR/.test(pn)) f.bridge_deck_subtype = 'jednokomora';
      else if (/RÁM/.test(pn)) f.bridge_deck_subtype = 'ramovy';
      else if (/SPŘAŽ|PREFAB/.test(pn)) f.bridge_deck_subtype = 'sprazeny';
      else if (/TRÁM|NOSN.*TRÁM/.test(pn)) f.bridge_deck_subtype = 'dvoutram';
      else if (/DESK/.test(pn)) f.bridge_deck_subtype = 'deskovy';
      // Auto-detect is_prestressed from part_name
      if (/PŘEDPJ|PŘEDPĚT|PŘEPJ|PREDPJ/.test(pn)) f.is_prestressed = true;
    }

    // Auto-detect composite opěry+křídla from part_name
    if (positionContext.part_name) {
      const pnUpper = positionContext.part_name.toUpperCase();
      const hasOpery = /OPĚR|OPER/.test(pnUpper);
      const hasKridla = /KŘÍDL|KRIDL|KŘÍDEL/.test(pnUpper);
      if (hasOpery && hasKridla) f.include_kridla = true;
    }

    // Clear start_date in Monolit mode (ordinal days only)
    f.start_date = '';

    return f;
  }, [positionContext]);

  // Store classification hint from auto-detection (OTSKP/keywords) for display
  const classificationHint = useMemo(() => {
    if (!positionContext?.part_name) return null;
    const isBridge = !!(positionContext.bridge_id && /^SO[-\s]?\d/i.test(positionContext.bridge_id));
    const classified = classifyElement(positionContext.part_name, { is_bridge: isBridge });
    if (classified.element_type === 'other' && classified.confidence <= 0.5) return null;
    return {
      source: classified.classification_source as 'otskp' | 'keywords' | undefined,
      confidence: classified.confidence,
      element_type: classified.element_type,
    };
  }, [positionContext]);

  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<PlannerOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Křídla: compute separate formwork recommendation when composite enabled
  const kridlaFormwork = useMemo(() => {
    if (!result || !form.include_kridla || !form.kridla_height_m) return null;
    const kH = parseFloat(form.kridla_height_m);
    if (!kH || kH <= 0) return null;
    const fw = recommendFormwork('kridla_opery', kH);
    return { system: fw, height_m: kH };
  }, [result, form.include_kridla, form.kridla_height_m]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [applyStatus, setApplyStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Auto-calculate state (Part 1 of calc refactor)
  // calcStatus: indicator shown while computing
  // resultDirty: true when form has changed but result hasn't been recomputed yet
  // skipNextAutoCalc: set when loading a variant or on page mount — skips the next auto-calc trigger
  const [calcStatus, setCalcStatus] = useState<'idle' | 'calculating'>('idle');
  const [resultDirty, setResultDirty] = useState(false);
  const skipNextAutoCalcRef = useRef(true); // Skip on first mount — first calc happens via firstRun useMemo
  const autoCalcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save toggle (persisted in localStorage so it survives sessions)
  const [autoSaveVariants, setAutoSaveVariants] = useState<boolean>(() => {
    try { return localStorage.getItem('planner_autosave_variants') === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('planner_autosave_variants', String(autoSaveVariants)); } catch { /* ignore */ }
  }, [autoSaveVariants]);

  // Plan variants (saved scenarios per position)
  // Mode A (position_id present): persisted in PostgreSQL via /api/planner-variants
  // Mode B (standalone): in-memory state only, lost on page leave
  interface SavedVariant {
    id: string;
    label: string;
    total_days: number;
    total_cost_czk: number;
    num_tacts: number;
    system_name: string;
    saved_at: string;
    plan: PlannerOutput;
    form: FormState;
    is_plan?: boolean;  // one variant per position can be marked as the chosen plan
  }
  const positionId = positionContext?.position_id || null;
  const [savedVariants, setSavedVariants] = useState<SavedVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  // Load variants from backend when position changes (Mode A)
  useEffect(() => {
    if (!positionId) {
      setSavedVariants([]);
      return;
    }
    let cancelled = false;
    setVariantsLoading(true);
    plannerVariantsAPI.list(positionId)
      .then(rows => {
        if (cancelled) return;
        const loaded: SavedVariant[] = rows.map(r => ({
          id: r.id,
          label: r.description || `V${r.variant_number}`,
          total_days: Number(r.total_days) || 0,
          total_cost_czk: Number(r.total_cost_czk) || 0,
          num_tacts: r.calc_result?.pour_decision?.num_tacts || 0,
          system_name: r.system_name || '',
          saved_at: r.created_at || new Date().toISOString(),
          plan: r.calc_result as PlannerOutput,
          form: r.input_params as FormState,
          is_plan: !!r.is_plan,
        }));
        setSavedVariants(loaded);
      })
      .catch(err => {
        console.warn('[PlannerVariants] Failed to load:', err);
      })
      .finally(() => {
        if (!cancelled) setVariantsLoading(false);
      });
    return () => { cancelled = true; };
  }, [positionId]);

  const saveVariant = async (plan: PlannerOutput): Promise<SavedVariant | null> => {
    const num = savedVariants.length + 1;
    const description = `V${num}: ${plan.formwork.system.name}, ${plan.resources.num_formwork_crews} čet`;
    const baseVariant: SavedVariant = {
      id: Date.now().toString(36),  // temp id for Mode B
      label: description,
      total_days: plan.schedule.total_days,
      total_cost_czk: plan.costs.total_labor_czk + plan.costs.formwork_rental_czk,
      num_tacts: plan.pour_decision.num_tacts,
      system_name: plan.formwork.system.name,
      saved_at: new Date().toISOString(),
      plan,
      form: { ...form },
      is_plan: false,
    };

    if (positionId) {
      // Mode A: persist via API
      try {
        const created = await plannerVariantsAPI.create({
          position_id: positionId,
          description,
          input_params: form,
          calc_result: plan,
          total_days: plan.schedule.total_days,
          total_cost_czk: plan.costs.total_labor_czk + plan.costs.formwork_rental_czk,
          system_name: plan.formwork.system.name,
        });
        const variant: SavedVariant = {
          ...baseVariant,
          id: created.id,
          label: created.description || description,
        };
        setSavedVariants(prev => [...prev, variant]);
        return variant;
      } catch (err) {
        console.error('[PlannerVariants] Save failed:', err);
        return null;
      }
    } else {
      // Mode B: in-memory only
      setSavedVariants(prev => [...prev, baseVariant]);
      return baseVariant;
    }
  };

  const removeVariant = async (id: string) => {
    if (positionId) {
      try {
        await plannerVariantsAPI.delete(id);
      } catch (err) {
        console.warn('[PlannerVariants] Delete failed:', err);
      }
    }
    setSavedVariants(prev => prev.filter(v => v.id !== id));
  };

  const loadVariant = (variant: SavedVariant) => {
    // Skip auto-calc — loading a variant should restore its result as-is,
    // not trigger a new computation.
    skipNextAutoCalcRef.current = true;
    setForm(variant.form);
    setResult(variant.plan);
    setResultDirty(false);
  };

  /** Mark a variant as the "chosen plan" (✅ PLÁN badge). Only one plan per position. */
  const setAsPlan = async (id: string) => {
    if (positionId) {
      try {
        await plannerVariantsAPI.update(id, { is_plan: true });
      } catch (err) {
        console.warn('[PlannerVariants] setAsPlan failed:', err);
      }
    }
    setSavedVariants(prev => prev.map(v => ({ ...v, is_plan: v.id === id })));
  };
  const [advisor, setAdvisor] = useState<AIAdvisorResult | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);

  // ── Document-based suggestions ──────────────────────────────────────────
  const [docSuggestions, setDocSuggestions] = useState<DocSuggestionsResponse | null>(null);
  const [docSugLoading, setDocSugLoading] = useState(false);
  const [acceptedParams, setAcceptedParams] = useState<Set<string>>(new Set());
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

  // ── Set page title ──
  useEffect(() => { document.title = 'Kalkulátor betonáže | StavAgent'; }, []);

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

  // ── Document suggestions fetch (once on mount, when portal_project_id is known) ──
  useEffect(() => {
    const portalProjectId = positionContext?.project_id
      || searchParams.get('portal_project_id');
    if (!portalProjectId) return;

    const bridgeId = positionContext?.bridge_id || searchParams.get('bridge_id') || '';
    // Extract SO-xxx from bridge_id
    const soMatch = bridgeId.match(/SO[-\s]?\d{3}/i);
    const buildingObject = soMatch ? soMatch[0].replace(/\s/g, '-').toUpperCase() : undefined;

    setDocSugLoading(true);
    fetch(`${API_URL}/api/planner-advisor/calculator-suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portal_project_id: portalProjectId,
        building_object: buildingObject,
      }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data && data.facts_count > 0) setDocSuggestions(data); })
      .catch(() => {})  // graceful: no suggestions = calculator works as before
      .finally(() => setDocSugLoading(false));
  }, [positionContext?.project_id, positionContext?.bridge_id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Accept a document suggestion: apply value to form + mark as accepted */
  const acceptSuggestion = useCallback((param: string, value: any) => {
    // Map suggestion params to form fields
    const paramMap: Record<string, (v: any) => void> = {
      concrete_class: v => update('concrete_class', v),
      volume_m3: v => update('volume_m3', v),
      // exposure_class has no direct form field — shown as info
    };
    const handler = paramMap[param];
    if (handler) handler(value);
    setAcceptedParams(prev => new Set(prev).add(param));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  /** Dismiss a suggestion */
  const dismissSuggestion = useCallback((param: string) => {
    setAcceptedParams(prev => new Set(prev).add(param));
  }, []);

  /** Get suggestion for a specific param */
  const getSuggestion = useCallback((param: string): DocSuggestion | undefined => {
    if (!docSuggestions || acceptedParams.has(param)) return undefined;
    return docSuggestions.suggestions.find(s => s.param === param);
  }, [docSuggestions, acceptedParams]);

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

  /**
   * Run the calculation synchronously.
   * Called both by the manual "Vypočítat" button AND the auto-calc debounced effect.
   */
  const runCalculation = useCallback(() => {
    setError(null);
    setShowComparison(false);
    try {
      const input = buildInput();
      if (form.formwork_system_name) {
        input.formwork_system_name = form.formwork_system_name;
      }
      const output = planElement(input);
      setResult(output);
      setResultDirty(false);
      // After a real calc, mark that a previous result exists — next change
      // will trigger the save prompt (unless auto-save is on).
      hasExistingResultRef.current = true;
      return output;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chyba výpočtu');
      setResult(null);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  /** Manual "Vypočítat" button handler — forces calc even if not dirty */
  const handleCalculate = () => {
    // Cancel any pending auto-calc so we don't double-run
    if (autoCalcTimerRef.current) {
      clearTimeout(autoCalcTimerRef.current);
      autoCalcTimerRef.current = null;
    }
    setCalcStatus('calculating');
    const t0 = Date.now();
    runCalculation();
    const elapsed = Date.now() - t0;
    // Only show indicator briefly if calc was fast
    if (elapsed < 500) {
      setCalcStatus('idle');
    } else {
      setTimeout(() => setCalcStatus('idle'), 200);
    }
  };

  // Pending save prompt (Part 2): shown when the user changes inputs while
  // there's an unsaved result. User chooses: save+continue / discard+continue.
  const [savePrompt, setSavePrompt] = useState<{ oldResult: PlannerOutput; oldForm: FormState } | null>(null);
  const hasExistingResultRef = useRef(false);

  // Auto-calculate on form change with 1.5s debounce.
  // Skip if:
  //  - skipNextAutoCalcRef is set (first mount, variant load, etc.)
  //  - a save prompt is already showing
  useEffect(() => {
    if (skipNextAutoCalcRef.current) {
      skipNextAutoCalcRef.current = false;
      return;
    }
    // Mark result as stale
    setResultDirty(true);
    // Debounce — clear prior timer
    if (autoCalcTimerRef.current) clearTimeout(autoCalcTimerRef.current);
    autoCalcTimerRef.current = setTimeout(() => {
      // If there's a previous result and auto-save is OFF and no prompt showing yet,
      // show the save-before-recalc prompt instead of running calc immediately
      if (hasExistingResultRef.current && !autoSaveVariants && !savePrompt && result) {
        setSavePrompt({ oldResult: result, oldForm: { ...form } });
        autoCalcTimerRef.current = null;
        return;
      }
      // If auto-save is ON, save the previous result silently before recomputing
      if (hasExistingResultRef.current && autoSaveVariants && result) {
        saveVariant(result).catch(() => {});
      }
      // Show "Počítám..." indicator only if calc takes >500ms
      const indicatorTimer = setTimeout(() => setCalcStatus('calculating'), 500);
      const t0 = Date.now();
      runCalculation();
      clearTimeout(indicatorTimer);
      const elapsed = Date.now() - t0;
      if (elapsed >= 500) {
        setCalcStatus('calculating');
        setTimeout(() => setCalcStatus('idle'), 200);
      } else {
        setCalcStatus('idle');
      }
      hasExistingResultRef.current = true;
      autoCalcTimerRef.current = null;
    }, 1500);

    return () => {
      if (autoCalcTimerRef.current) {
        clearTimeout(autoCalcTimerRef.current);
        autoCalcTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, autoSaveVariants]);

  /** User chose "Uložit a pokračovat" in the save prompt. */
  const handleSaveAndContinue = async () => {
    if (savePrompt) {
      await saveVariant(savePrompt.oldResult);
    }
    setSavePrompt(null);
    // Now run the pending calculation with the NEW form
    runCalculation();
    hasExistingResultRef.current = true;
  };

  /** User chose "Zahodit a pokračovat" in the save prompt. */
  const handleDiscardAndContinue = () => {
    setSavePrompt(null);
    runCalculation();
    hasExistingResultRef.current = true;
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
    // Manual záběry (non-uniform volumes) override both tact count and per-tact volume.
    // Bottleneck záběr (largest volume) drives schedule calculation.
    if (form.use_manual_zabery && form.manual_zabery.length > 0) {
      const volumes = form.manual_zabery
        .map(z => parseFloat(z.volume_m3) || 0)
        .filter(v => v > 0);
      if (volumes.length > 0) {
        input.num_tacts_override = volumes.length;
        input.tact_volume_m3_override = Math.max(...volumes);  // bottleneck for schedule
      }
    } else if (form.tact_mode === 'manual' && form.num_tacts_override) {
      input.num_tacts_override = parseInt(form.num_tacts_override);
      if (form.tact_volume_m3_override) input.tact_volume_m3_override = parseFloat(form.tact_volume_m3_override);
      if (form.scheduling_mode_override) input.scheduling_mode_override = form.scheduling_mode_override;
    }
    if (form.height_m) input.height_m = parseFloat(form.height_m);
    if (form.num_bridges > 1) input.num_bridges = form.num_bridges;
    if (form.rental_czk_override) input.rental_czk_override = parseFloat(form.rental_czk_override);
    // Shape correction: římsa always uses 1.5 (complex geometry), regardless of form value
    const elemTypeForShape = form.use_name_classification ? 'other' : form.element_type;
    if (elemTypeForShape === 'rimsa') {
      input.formwork_shape_correction = 1.5;
    } else {
      const sc = parseFloat(form.formwork_shape_correction);
      if (sc && sc !== 1.0) input.formwork_shape_correction = sc;
    }
    if (form.num_identical_elements > 1) {
      input.num_identical_elements = form.num_identical_elements;
      if (form.formwork_sets_count) input.formwork_sets_count = parseInt(form.formwork_sets_count);
    }
    // Prestressed concrete
    if (form.is_prestressed) input.is_prestressed = true;
    // Bridge deck subtype
    if (form.bridge_deck_subtype) input.bridge_deck_subtype = form.bridge_deck_subtype as any;
    // Bridge geometry (mostovka only)
    if (form.span_m) input.span_m = parseFloat(form.span_m);
    if (form.num_spans) input.num_spans = parseInt(form.num_spans);
    if (form.nk_width_m) input.nk_width_m = parseFloat(form.nk_width_m);
    if (form.construction_technology) input.construction_technology = form.construction_technology as any;
    if (form.mss_tact_days) input.mss_tact_days = parseInt(form.mss_tact_days);
    // Lost formwork (trapézový plech) — horizontal elements only
    if (form.has_lost_formwork && form.lost_formwork_area_m2) {
      const lostArea = parseFloat(form.lost_formwork_area_m2);
      if (lostArea > 0) input.lost_formwork_area_m2 = lostArea;
    }
    // Exposure class from URL context
    if (positionContext?.exposure_class) input.exposure_class = positionContext.exposure_class;
    // Total length for non-spáry mode (needed for prestress days calculation)
    if (form.total_length_m > 0 && !effectiveHasSpary) input.total_length_m = form.total_length_m;
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
          <a
            href={isPortalMode ? PORTAL_URL : (positionContext?.bridge_id ? `/?bridge=${positionContext.bridge_id}` : '/')}
            className="r0-back-link"
          >
            {isPortalMode ? <><ArrowLeft size={14} className="inline" /> Portál</> : <><ArrowLeft size={14} className="inline" /> Monolit Planner</>}
          </a>
          <h1 className="r0-title">
            <span className="r0-icon"><Calculator size={20} /></span>
            Kalkulátor betonáže
          </h1>
          {isMonolitMode && positionContext?.part_name && (
            <div style={{ fontSize: 12, color: 'var(--r0-slate-500)', marginLeft: 8, fontWeight: 400 }}>
              {positionContext.part_name}
              {positionContext.volume_m3 ? ` — ${positionContext.volume_m3} m³` : ''}
            </div>
          )}
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
              Kalkulátor betonáže — Deterministický výpočet monolitických konstrukcí
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

          {/* ─── Document suggestions banner ─── */}
          {docSugLoading && (
            <div style={{ padding: '6px 10px', marginBottom: 8, fontSize: 11, color: 'var(--r0-slate-500)' }}>
              Nacitani doporuceni z dokumentu projektu...
            </div>
          )}
          <DocWarningsBanner response={docSuggestions} />

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
            )}
          </Section>

          {/* ─── Mostovková deska: bridge config + context hint ─── */}
          <div style={{
            maxHeight: (form.element_type === 'mostovkova_deska' && !form.use_name_classification) ? 900 : 0,
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
          {(form.element_type === 'opery_ulozne_prahy' && !form.use_name_classification) && (
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
          {(form.element_type === 'rimsa' && !form.use_name_classification) && (
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

          {/* ─── Volumes ─── */}
          <Section title="Objemy">
            <Field label="Objem betonu (m³)">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <NumInput style={{ ...inputStyle, flex: 1 }} value={form.volume_m3} min={0.1} fallback={1}
                  onChange={v => update('volume_m3', v as number)} />
                <SuggestionBadge
                  suggestion={getSuggestion('volume_m3')}
                  onAccept={acceptSuggestion}
                  onDismiss={dismissSuggestion}
                />
              </div>
            </Field>
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

          {/* ─── Environment ─── */}
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

          {/* ─── Concrete / Maturity ─── */}
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
                  onAccept={acceptSuggestion}
                  onDismiss={dismissSuggestion}
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
          {/*
            "+ Uložit scénář" and "Vymazat scénáře" buttons removed.
            Variant saving now happens automatically via the prompt-based
            flow (Part 2 of calc refactor) when the user changes inputs
            with an unsaved result. See savePrompt modal below.
          */}

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
                      formwork_area_m2: parseFloat(form.formwork_area_m2) || 0,
                      num_tacts: plan.pour_decision.num_tacts,
                      num_sets: form.num_sets,
                    },
                    schedule_info: {
                      total_days: plan.schedule.total_days,
                      tact_count: plan.pour_decision.num_tacts,
                    },
                  };
                  // Write to positions via Monolit backend (TOV mapping)
                  const bridgeId = positionContext.bridge_id || positionContext.project_id || '';
                  if (positionContext.position_id && bridgeId) {
                    const updates: Array<Record<string, unknown>> = [];

                    // Aggregate schedule tact_details → labor-days per subtype
                    const tacts = plan.schedule.tact_details || [];
                    const numTacts = plan.pour_decision.num_tacts || 1;
                    const roundDay = (v: number) => Math.round(v * 10) / 10;
                    const agg = aggregateScheduleDays(tacts, {
                      numTacts,
                      assemblyDaysPerTact: plan.formwork.assembly_days,
                      rebarDaysPerTact: plan.rebar.duration_days,
                      concreteDaysPerTact: 1,
                      curingDays: plan.formwork.curing_days,
                      strippingDaysPerTact: plan.formwork.disassembly_days,
                      prestressDaysPerTact: plan.prestress?.days,
                    });
                    const betonDays = agg.beton;
                    const bedneniDays = agg.bedneni;
                    const vyztuzDays = agg.vyztuž;
                    const zraniDays = agg.zrani;
                    const odbedneniDays = agg.odbedneni;

                    // Rental duration (days) = total schedule + transport buffer
                    const rentalDays = plan.schedule.total_days + 2;
                    const rentalMonths = Math.round((rentalDays / 30) * 10) / 10;
                    const k = 0.8;

                    // ── Build TOV entries for the main (beton) position ──
                    const tovLabor: TOVLaborEntry[] = [];
                    const tovMaterials: TOVMaterialEntry[] = [];
                    let idC = 1;

                    // Betonář
                    const pourCrew = plan.resources.crew_size_formwork;
                    const pourWage = plan.resources.wage_pour_czk_h;
                    const pourH = roundDay(pourCrew * plan.resources.shift_h * k * betonDays);
                    tovLabor.push({
                      id: `tov-${idC++}`, profession: 'Betonář', professionCode: 'BET',
                      count: pourCrew, hours: pourH, normHours: pourH,
                      hourlyRate: pourWage, totalCost: Math.round(pourH * pourWage),
                    });

                    // Tesař — montáž
                    const fwCrew = plan.resources.crew_size_formwork;
                    const fwWage = plan.resources.wage_formwork_czk_h;
                    const fwAsmH = roundDay(fwCrew * plan.resources.shift_h * k * bedneniDays);
                    tovLabor.push({
                      id: `tov-${idC++}`, profession: 'Tesař/Bednář', professionCode: 'TES',
                      count: fwCrew, hours: fwAsmH, normHours: fwAsmH,
                      hourlyRate: fwWage, totalCost: Math.round(fwAsmH * fwWage),
                      note: 'montáž bednění',
                    });

                    // Tesař — demontáž
                    const fwDisH = roundDay(fwCrew * plan.resources.shift_h * k * odbedneniDays);
                    tovLabor.push({
                      id: `tov-${idC++}`, profession: 'Tesař/Bednář', professionCode: 'TES',
                      count: fwCrew, hours: fwDisH, normHours: fwDisH,
                      hourlyRate: fwWage, totalCost: Math.round(fwDisH * fwWage),
                      note: 'demontáž bednění',
                    });

                    // Ošetřovatel (curing — shorter shift)
                    if (zraniDays > 0) {
                      const curingWorkers = 1;
                      const curingShiftH = 5; // 3× denně kropení, ne celý den
                      const curingWage = 320;
                      const curingH = roundDay(curingWorkers * curingShiftH * zraniDays);
                      tovLabor.push({
                        id: `tov-${idC++}`, profession: 'Ošetřovatel betonu', professionCode: 'OSE',
                        count: curingWorkers, hours: curingH, normHours: curingH,
                        hourlyRate: curingWage, totalCost: Math.round(curingH * curingWage),
                        note: 'zrání — kropení, zakrytí fólií',
                      });
                    }

                    // Železář (if no separate linked výztuž position found later)
                    const rbCrew = plan.resources.crew_size_rebar;
                    const rbWage = plan.resources.wage_rebar_czk_h;
                    const rbH = roundDay(rbCrew * plan.resources.shift_h * k * vyztuzDays);

                    // Předpětí specialist
                    let prestressEntry: TOVLaborEntry | null = null;
                    if (plan.prestress) {
                      const prDays = agg.predpeti || roundDay(plan.prestress.days * numTacts);
                      const prCrew = plan.prestress.crew_size || 5;
                      const prWage = 550;
                      const prH = roundDay(prCrew * plan.resources.shift_h * k * prDays);
                      prestressEntry = {
                        id: `tov-${idC++}`, profession: 'Specialista předpětí', professionCode: 'PRE',
                        count: prCrew, hours: prH, normHours: prH,
                        hourlyRate: prWage, totalCost: Math.round(prH * prWage),
                      };
                    }

                    // Formwork rental material
                    const fwArea = parseFloat(form.formwork_area_m2) || 0;
                    if (plan.costs.formwork_rental_czk > 0 && fwArea > 0) {
                      tovMaterials.push({
                        id: `tov-mat-${idC++}`,
                        name: `Pronájem ${plan.formwork.system.name} (${plan.formwork.system.manufacturer})`,
                        quantity: fwArea, unit: 'm²',
                        unitPrice: plan.formwork.system.rental_czk_m2_month,
                        totalCost: Math.round(plan.costs.formwork_rental_czk),
                        rentalMonths,
                        note: `${rentalDays} dní (${rentalMonths} měs.)`,
                      });
                    }

                    // Props rental
                    if (plan.props?.needed && plan.costs.props_rental_czk > 0) {
                      tovMaterials.push({
                        id: `tov-mat-${idC++}`,
                        name: `Pronájem ${plan.props.system.name} (${plan.props.system.manufacturer})`,
                        quantity: plan.props.num_props_per_tact, unit: 'ks',
                        unitPrice: plan.props.system.rental_czk_per_prop_day,
                        totalCost: Math.round(plan.costs.props_rental_czk),
                        rentalMonths: Math.round((plan.props.rental_days / 30) * 10) / 10,
                        note: `${plan.props.rental_days} dní pronájmu`,
                      });
                    }

                    // ── Find linked positions by OTSKP/URS code prefix ──
                    let allPositions: any[] = [];
                    try {
                      const posRes = await fetch(`${API_URL}/api/positions?bridge_id=${bridgeId}`);
                      if (posRes.ok) allPositions = (await posRes.json()).positions || [];
                    } catch { /* ignore */ }

                    const currentCode = positionContext.otskp_code || '';
                    const linked = findLinkedPositions(currentCode, allPositions);

                    // Determine if výztuž goes into separate linked position or into main TOV
                    const linkedVyzuz = linked.related.find(r => r.work_type === 'výztuž');
                    const linkedPredpeti = linked.related.find(r => r.work_type === 'předpětí');

                    // If no linked výztuž position — add Železář to main TOV
                    if (!linkedVyzuz && rbH > 0) {
                      tovLabor.push({
                        id: `tov-${idC++}`, profession: 'Železář', professionCode: 'ZEL',
                        count: rbCrew, hours: rbH, normHours: rbH,
                        hourlyRate: rbWage, totalCost: Math.round(rbH * rbWage),
                      });
                    }

                    // If no linked předpětí position — add to main TOV
                    if (!linkedPredpeti && prestressEntry) {
                      tovLabor.push(prestressEntry);
                    }

                    // Blended wage for position fields (beton days only)
                    const nightPremium = plan.costs.pour_night_premium_czk || 0;
                    const pourLaborHours = pourCrew * plan.resources.shift_h * betonDays;
                    const effectivePourWage = pourLaborHours > 0 && nightPremium > 0
                      ? Math.round(((pourLaborHours * pourWage + nightPremium) / pourLaborHours) * 100) / 100
                      : pourWage;

                    const mainTovEntries: TOVEntries = {
                      labor: tovLabor,
                      materials: tovMaterials,
                      source: 'calculator',
                      calculated_at: monolit_data.calculated_at,
                    };

                    // 1. Main (beton) position — update with TOV entries in metadata
                    // Use betonDays (pour-only duration) NOT total_days (full schedule)
                    updates.push({
                      id: positionContext.position_id,
                      days: betonDays,
                      crew_size: pourCrew,
                      wage_czk_ph: effectivePourWage,
                      shift_hours: plan.resources.shift_h,
                      curing_days: Math.round(plan.formwork.curing_days),
                      metadata: JSON.stringify({
                        costs: monolit_data.costs,
                        resources: monolit_data.resources,
                        formwork_info: monolit_data.formwork_info,
                        schedule_info: monolit_data.schedule_info,
                        calculated_at: monolit_data.calculated_at,
                        tov_entries: mainTovEntries,
                      }),
                    });

                    // 2. Linked výztuž position — write Železář TOV
                    if (linkedVyzuz && rbH > 0) {
                      const vyzTov: TOVEntries = {
                        labor: [{
                          id: 'tov-vyz-1', profession: 'Železář', professionCode: 'ZEL',
                          count: rbCrew, hours: rbH, normHours: rbH,
                          hourlyRate: rbWage, totalCost: Math.round(rbH * rbWage),
                        }],
                        materials: [],
                        source: 'calculator',
                        calculated_at: monolit_data.calculated_at,
                      };
                      updates.push({
                        id: linkedVyzuz.id,
                        days: vyztuzDays,
                        crew_size: rbCrew,
                        wage_czk_ph: rbWage,
                        shift_hours: plan.resources.shift_h,
                        metadata: JSON.stringify({
                          rebar_mass_kg: plan.rebar.mass_kg,
                          norm_h_per_t: plan.rebar.norm_h_per_t,
                          calculated_at: monolit_data.calculated_at,
                          tov_entries: vyzTov,
                        }),
                      });
                    }

                    // 3. Linked předpětí position — write specialist TOV
                    if (linkedPredpeti && prestressEntry) {
                      const preTov: TOVEntries = {
                        labor: [prestressEntry],
                        materials: [],
                        source: 'calculator',
                        calculated_at: monolit_data.calculated_at,
                      };
                      const prDays = agg.predpeti || roundDay((plan.prestress?.days || 5) * numTacts);
                      updates.push({
                        id: linkedPredpeti.id,
                        days: prDays,
                        crew_size: prestressEntry.count,
                        wage_czk_ph: prestressEntry.hourlyRate,
                        shift_hours: plan.resources.shift_h,
                        metadata: JSON.stringify({
                          calculated_at: monolit_data.calculated_at,
                          tov_entries: preTov,
                        }),
                      });
                    }

                    // Filter out undefined values from updates
                    const cleanUpdates = updates.map(u => {
                      const clean: Record<string, unknown> = {};
                      for (const [k, v] of Object.entries(u)) {
                        if (v !== undefined) clean[k] = v;
                      }
                      return clean;
                    });

                    const res = await fetch(`${API_URL}/api/positions`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ bridge_id: bridgeId, updates: cleanUpdates }),
                    });
                    if (!res.ok) {
                      const errData = await res.json().catch(() => null);
                      throw new Error(errData?.error || `HTTP ${res.status}`);
                    }
                  }
                  // Invalidate positions cache so table refetches when user returns
                  queryClient.invalidateQueries({ queryKey: ['positions'] });
                  queryClient.invalidateQueries({ queryKey: ['bridges'] });
                  queryClient.invalidateQueries({ queryKey: ['monolith-projects'] });
                  setApplyStatus('saved');
                  setTimeout(() => setApplyStatus('idle'), 3000);
                } catch (err) {
                  setApplyStatus('error');
                  setTimeout(() => setApplyStatus('idle'), 3000);
                }
              } : undefined}
              savedVariants={savedVariants}
              onSaveVariant={() => { saveVariant(plan); }}
              onLoadVariant={loadVariant}
              onRemoveVariant={removeVariant}
              onSetAsPlan={setAsPlan}
              positionId={positionId}
              kridlaFormwork={kridlaFormwork}
              calcStatus={calcStatus}
              resultDirty={resultDirty}
            />
          ) : (
            <div style={{ textAlign: 'center', paddingTop: 100, color: 'var(--r0-slate-400)' }}>
              <div style={{ fontSize: 48 }}><Calculator size={48} /></div>
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

      {/* Save-before-recalc prompt (Part 2 of calc refactor) */}
      {savePrompt && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: 16,
        }} onClick={(e) => { if (e.target === e.currentTarget) handleDiscardAndContinue(); }}>
          <div style={{
            background: 'white', borderRadius: 8, padding: 24, maxWidth: 480, width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--r0-slate-800)' }}>
              ⚠ Máte neuložený výpočet
            </div>
            <div style={{ fontSize: 13, color: 'var(--r0-slate-600)', marginBottom: 14 }}>
              {savePrompt.oldResult.formwork.system.name}, {savePrompt.oldResult.resources.num_formwork_crews} čet
              {' — '}
              <strong>{savePrompt.oldResult.schedule.total_days} dní</strong>,{' '}
              <strong>{Math.round(savePrompt.oldResult.costs.total_labor_czk + savePrompt.oldResult.costs.formwork_rental_czk).toLocaleString('cs')} Kč</strong>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={handleSaveAndContinue} style={{
                flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 600,
                border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                background: 'var(--r0-orange, #f59e0b)', color: 'white',
              }}>Uložit a pokračovat</button>
              <button onClick={handleDiscardAndContinue} style={{
                flex: 1, padding: '10px 14px', fontSize: 13, fontWeight: 600,
                border: '1px solid var(--r0-slate-300)', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                background: 'white', color: 'var(--r0-slate-700)',
              }}>Zahodit a pokračovat</button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--r0-slate-500)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoSaveVariants}
                onChange={e => setAutoSaveVariants(e.target.checked)}
              />
              Ukládat automaticky (neptát se)
            </label>
          </div>
        </div>
      )}
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

function PlanResult({ plan, startDate, showLog, onToggleLog, scenarios, applyStatus, onApplyToPosition, savedVariants, onSaveVariant, onLoadVariant, onRemoveVariant, onSetAsPlan, positionId, kridlaFormwork, calcStatus, resultDirty }: {
  plan: PlannerOutput;
  startDate: string;
  showLog: boolean;
  onToggleLog: () => void;
  scenarios?: any[];
  applyStatus: 'idle' | 'saving' | 'saved' | 'error';
  onApplyToPosition?: () => void;
  savedVariants?: Array<{ id: string; label: string; total_days: number; total_cost_czk: number; is_plan?: boolean }>;
  onSaveVariant?: () => void;
  onLoadVariant?: (variant: any) => void;
  onRemoveVariant?: (id: string) => void;
  onSetAsPlan?: (id: string) => void;
  positionId?: string | null;
  kridlaFormwork?: { system: { name: string; manufacturer: string; rental_czk_m2_month: number; needs_crane?: boolean }; height_m: number } | null;
  calcStatus?: 'idle' | 'calculating';
  resultDirty?: boolean;
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
             applyStatus === 'saved' ? 'Uloženo' :
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
        {/*
          "💾 Uložit plán" button removed — variant saving is now automatic
          via the prompt modal when user changes inputs (see savePrompt in
          PlannerPage). To mark a variant as the chosen plan, use the "✓"
          button in the variants table below.
        */}
      </div>

      {/* Saved variants comparison (Monolit mode only) */}
      {savedVariants && savedVariants.length > 0 && (
        <div style={{
          marginBottom: 16, padding: 12, background: 'var(--r0-slate-50)',
          borderRadius: 8, border: '1px solid var(--r0-slate-200)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--r0-slate-700)' }}>
            Uložené varianty ({savedVariants.length})
          </div>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--r0-slate-200)' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--r0-slate-500)', fontWeight: 600 }}>#</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--r0-slate-500)', fontWeight: 600 }}>Konfigurace</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--r0-slate-500)', fontWeight: 600 }}>Dní</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: 'var(--r0-slate-500)', fontWeight: 600 }}>Náklady</th>
                <th style={{ textAlign: 'center', padding: '4px 8px' }}>Stav</th>
                <th style={{ textAlign: 'center', padding: '4px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {savedVariants.map((v: any, i: number) => (
                <tr key={v.id} style={{
                  borderBottom: '1px solid var(--r0-slate-100)',
                  background: v.is_plan ? 'rgba(34,197,94,0.06)' : undefined,
                }}>
                  <td style={{ padding: '6px 8px', color: 'var(--r0-slate-400)' }}>{i + 1}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 500, cursor: onLoadVariant ? 'pointer' : 'default' }}
                      onClick={() => onLoadVariant && onLoadVariant(v)}>
                    {v.label}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--r0-font-mono)' }}>{v.total_days}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--r0-font-mono)' }}>{Math.round(v.total_cost_czk).toLocaleString('cs')} Kč</td>
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    {v.is_plan && <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 3,
                      background: '#dcfce7', color: '#166534', fontWeight: 700,
                    }}>✓ PLÁN</span>}
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {onSetAsPlan && !v.is_plan && <button onClick={() => onSetAsPlan(v.id)} style={{
                      fontSize: 10, padding: '2px 6px', border: '1px solid var(--r0-slate-300)',
                      borderRadius: 4, cursor: 'pointer', background: 'white', fontFamily: 'inherit', marginRight: 4,
                    }} title="Označit jako plán">✓</button>}
                    {onLoadVariant && <button onClick={() => onLoadVariant(v)} style={{
                      fontSize: 11, padding: '2px 8px', border: '1px solid var(--r0-slate-300)',
                      borderRadius: 4, cursor: 'pointer', background: 'white', fontFamily: 'inherit', marginRight: 4,
                    }}>Načíst</button>}
                    {onRemoveVariant && <button onClick={() => {
                      if (v.is_plan && !confirm('Tato varianta je označena jako PLÁN. Opravdu smazat?')) return;
                      onRemoveVariant(v.id);
                    }} style={{
                      fontSize: 11, padding: '2px 6px', border: '1px solid var(--r0-slate-200)',
                      borderRadius: 4, cursor: 'pointer', background: 'white', color: 'var(--r0-slate-400)', fontFamily: 'inherit',
                    }}>✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {positionId && savedVariants.some((v: any) => v.is_plan) && onApplyToPosition && (
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <button
                onClick={onApplyToPosition}
                disabled={applyStatus === 'saving'}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 600,
                  border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
                  background: applyStatus === 'saved' ? '#22c55e' : applyStatus === 'error' ? '#ef4444' : '#16a34a',
                  color: 'white',
                }}
              >
                {applyStatus === 'saving' ? 'Ukládám…'
                  : applyStatus === 'saved' ? '✓ Aplikováno'
                  : applyStatus === 'error' ? '✗ Chyba'
                  : '✓ Aplikovat plán do pozice'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Auto-calc indicator */}
      {(calcStatus === 'calculating' || resultDirty) && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '4px 12px', marginBottom: 10,
          background: calcStatus === 'calculating' ? 'var(--r0-info-bg, #eff6ff)' : 'var(--r0-slate-50, #f8fafc)',
          border: `1px solid ${calcStatus === 'calculating' ? 'var(--r0-info-border, #bfdbfe)' : 'var(--r0-slate-200, #e2e8f0)'}`,
          borderRadius: 4, fontSize: 11,
          color: calcStatus === 'calculating' ? 'var(--r0-info-text, #1e40af)' : 'var(--r0-slate-500, #64748b)',
        }}>
          {calcStatus === 'calculating'
            ? <><span className="flat-spinner" style={{ width: 10, height: 10 }} /> Počítám…</>
            : 'Čekám na zastavení vstupu…'}
        </div>
      )}

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
        const icon = deadlineExceeded ? <Siren size={16} /> : hasSuggestions ? <Zap size={16} /> : <CircleCheckBig size={16} />;
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
                            <td style={{ padding: '5px 6px' }}>{isBestDeadline ? <Star size={14} /> : i + 1}</td>
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
        <Card title="Varování" icon={<TriangleAlert size={16} className="inline" />} borderColor="var(--r0-orange)">
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--r0-warn-text)' }}>
            {plan.warnings.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
          </ul>
        </Card>
      )}

      {/* Element + Pour */}
      <div className="r0-grid-2">
        <Card title="Element" icon={<Blocks size={16} />}>
          <Row label="Typ" value={plan.element.label_cs} />
          <Row label="Klasifikace" value={`${(plan.element.classification_confidence * 100).toFixed(0)}%${
            plan.element.profile.classification_source === 'otskp' ? ' (OTSKP katalog)' :
            plan.element.profile.classification_source === 'keywords' ? ' (klíčová slova)' : ''
          }`} />
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
            {plan.props?.needed && (
              <Row label="Podpěra" value={`${plan.props.system.name} (${plan.props.system.manufacturer}), ${plan.props.num_props_per_tact} ks`} bold />
            )}
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

      {/* Křídla formwork (composite opěry+křídla) */}
      {kridlaFormwork && (
        <Card title="Bednění křídel" icon="📦">
          <div className="r0-grid-2">
            <div>
              <Row label="Systém" value={kridlaFormwork.system.name} bold />
              <Row label="Výrobce" value={kridlaFormwork.system.manufacturer} />
              <Row label="Výška křídel" value={`${kridlaFormwork.height_m} m`} />
              <Row label="Pronájem" value={kridlaFormwork.system.rental_czk_m2_month > 0
                ? `${formatNum(kridlaFormwork.system.rental_czk_m2_month, 0)} Kč/m²/měs`
                : 'Bez pronájmu'} />
            </div>
            <div>
              <Row label="Jeřáb" value={kridlaFormwork.system.needs_crane ? 'Nutný (panel > 150 kg)' : 'Nepotřebuje'} />
              {kridlaFormwork.height_m > 1.2 && (
                <Row label="Vzpěry" value="IB vzpěry nutné (h > 1.2 m)" />
              )}
              <div style={{ fontSize: 10, color: 'var(--r0-slate-400)', marginTop: 8 }}>
                Samostatná sada bednění — křídla se betonují jako oddělený záběr od dříku opěry.
              </div>
            </div>
          </div>
        </Card>
      )}

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
                      <Row label={<><TriangleAlert size={14} className="inline" /> Doporučeno</>} value={`${plan.rebar.recommended_crew} pracovníků`} bold />
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

      {/* Bridge Technology (MSS / Fixed) */}
      {plan.bridge_technology && (
        <Card title={`Technologie: ${plan.bridge_technology.technology_label_cs}`} icon="🌉" borderColor="var(--r0-blue)">
          <Row label="Technologie" value={plan.bridge_technology.technology_label_cs} bold />
          <Row label="Doporučení" value={plan.bridge_technology.recommendation.recommended === plan.bridge_technology.technology ? 'Shoduje se s doporučením' : 'Uživatelský výběr'} />

          {plan.bridge_technology.mss_schedule && (
            <div style={{ marginTop: 8 }}>
              <div style={subTitle}>Harmonogram MSS</div>
              <Row label="Montáž MSS" value={`${plan.bridge_technology.mss_schedule.setup_days} dní`} />
              <Row label="Taktů" value={`${plan.bridge_technology.mss_schedule.num_tacts}`} />
              <Row label="Doba taktu" value={`${plan.bridge_technology.mss_schedule.tact_days} dní`} />
              <Row label="Demontáž MSS" value={`${plan.bridge_technology.mss_schedule.teardown_days} dní`} />
              <Row label="Celkem MSS" value={`${plan.bridge_technology.mss_schedule.total_days} dní`} bold />
              <div style={{ fontSize: 11, color: 'var(--r0-slate-400)', marginTop: 4 }}>
                = montáž {plan.bridge_technology.mss_schedule.setup_days}d
                + {plan.bridge_technology.mss_schedule.num_tacts} × {plan.bridge_technology.mss_schedule.tact_days}d
                + demontáž {plan.bridge_technology.mss_schedule.teardown_days}d
              </div>
            </div>
          )}

          {plan.bridge_technology.mss_cost && (
            <div style={{ marginTop: 8 }}>
              <div style={subTitle}>Náklady MSS</div>
              <Row label="Mobilizace" value={formatCZK(plan.bridge_technology.mss_cost.mobilization_czk)} />
              <Row label="Pronájem" value={`${formatCZK(plan.bridge_technology.mss_cost.rental_czk_month)}/měs × ${plan.bridge_technology.mss_cost.rental_months} měs`} />
              <Row label="Pronájem celkem" value={formatCZK(plan.bridge_technology.mss_cost.rental_total_czk)} />
              <Row label="Demobilizace" value={formatCZK(plan.bridge_technology.mss_cost.demobilization_czk)} />
              <Row label="Celkem MSS" value={formatCZK(plan.bridge_technology.mss_cost.total_czk)} bold />
              <Row label="JC" value={`${plan.bridge_technology.mss_cost.unit_cost_czk_m2.toLocaleString('cs')} Kč/m² NK`} />
              <Row label="Plocha NK" value={`${plan.bridge_technology.mss_cost.nk_area_m2.toLocaleString('cs')} m²`} />
            </div>
          )}
        </Card>
      )}

      {/* Schedule / Gantt */}
      <Card title="Harmonogram" icon={<CalendarDays size={16} />}>
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
            mode={startDate ? 'calendar' : 'relative'}
            startDate={startDate}
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
      <Card title="Souhrn nákladů" icon={<DollarSign size={16} />}>
        {(() => {
          const propsLabor = plan.costs.props_labor_czk || 0;
          const propsRental = plan.costs.props_rental_czk || 0;
          const totalAll = plan.costs.total_labor_czk + plan.costs.formwork_rental_czk + propsLabor + propsRental;
          const nT = plan.pour_decision.num_tacts;
          const k = 0.8;
          const fwDays = (plan.formwork.assembly_days + plan.formwork.disassembly_days) * nT;
          const fwH = fwDays * plan.resources.crew_size_formwork * plan.resources.shift_h * k;
          const rbDays = plan.rebar.duration_days * nT;
          const rbH = rbDays * plan.resources.crew_size_rebar * plan.resources.shift_h * k;
          const pourH = plan.pour.total_pour_hours * nT;
          const rentalDays = plan.schedule.total_days + 2; // +2 transport (same as orchestrator)
          const rentalMonths = (rentalDays / 30).toFixed(1);
          const cs = { padding: '4px 10px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", textAlign: 'right' as const, whiteSpace: 'nowrap' as const };
          const cl = { ...cs, textAlign: 'left' as const, color: 'var(--r0-slate-500)' };
          const cb = { ...cs, fontWeight: 700 };
          return (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--r0-slate-200)' }}>
                      <th style={{ ...cl, fontSize: 11, fontWeight: 600 }}>Položka</th>
                      <th style={{ ...cs, fontSize: 11, fontWeight: 600, color: 'var(--r0-slate-500)' }}>Náklady</th>
                      <th style={{ ...cs, fontSize: 11, fontWeight: 600, color: 'var(--r0-slate-500)' }}>Dní</th>
                      <th style={{ ...cs, fontSize: 11, fontWeight: 600, color: 'var(--r0-slate-500)' }}>Normohodin</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--r0-slate-100)' }}>
                      <td style={cl}>Bednění (práce)</td>
                      <td style={cs}>{formatCZK(plan.costs.formwork_labor_czk)}</td>
                      <td style={cs}>{formatNum(fwDays, 1)}</td>
                      <td style={cs}>{formatNum(fwH, 0)} h</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--r0-slate-100)' }}>
                      <td style={cl}>Výztuž (práce)</td>
                      <td style={cs}>{formatCZK(plan.costs.rebar_labor_czk)}</td>
                      <td style={cs}>{formatNum(rbDays, 1)}</td>
                      <td style={cs}>{formatNum(rbH, 0)} h</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--r0-slate-100)' }}>
                      <td style={cl}>Betonáž (práce)</td>
                      <td style={cs}>{formatCZK(plan.costs.pour_labor_czk)}</td>
                      <td style={cs}>—</td>
                      <td style={cs}>{formatNum(pourH, 1)} h</td>
                    </tr>
                    {propsLabor > 0 && (
                      <tr style={{ borderBottom: '1px solid var(--r0-slate-100)' }}>
                        <td style={cl}>Podpěry (práce)</td>
                        <td style={cs}>{formatCZK(propsLabor)}</td>
                        <td style={cs}>{plan.props ? formatNum(plan.props.assembly_days + plan.props.disassembly_days, 1) : '—'}</td>
                        <td style={cs}>—</td>
                      </tr>
                    )}
                    <tr style={{ borderBottom: '1px solid var(--r0-slate-100)', background: 'var(--r0-slate-50)' }}>
                      <td style={cl}>Pronájem bednění</td>
                      <td style={cs}>{formatCZK(plan.costs.formwork_rental_czk)}</td>
                      <td style={{ ...cs, color: 'var(--r0-slate-500)' }} colSpan={2}>{rentalDays} dní ({rentalMonths} měs.)</td>
                    </tr>
                    {propsRental > 0 && (
                      <tr style={{ borderBottom: '1px solid var(--r0-slate-100)', background: 'var(--r0-slate-50)' }}>
                        <td style={cl}>Pronájem podpěr</td>
                        <td style={cs}>{formatCZK(propsRental)}</td>
                        <td style={{ ...cs, color: 'var(--r0-slate-500)' }} colSpan={2}>{plan.props?.rental_days ?? '—'} dní</td>
                      </tr>
                    )}
                    <tr style={{ borderTop: '2px solid var(--r0-slate-300)' }}>
                      <td style={{ ...cl, fontWeight: 700 }}>Celkem práce</td>
                      <td style={cb}>{formatCZK(plan.costs.total_labor_czk + propsLabor)}</td>
                      <td style={cs} colSpan={2}></td>
                    </tr>
                    <tr>
                      <td style={{ ...cl, fontWeight: 700 }}>Celkem vše</td>
                      <td style={cb}>{formatCZK(totalAll)}</td>
                      <td style={cs} colSpan={2}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
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

// ─── SuggestionBadge: inline badge next to form field ──────────────────────

function SuggestionBadge({ suggestion, onAccept, onDismiss }: {
  suggestion: DocSuggestion | undefined;
  onAccept: (param: string, value: any) => void;
  onDismiss: (param: string) => void;
}) {
  if (!suggestion) return null;

  const confPct = Math.round(suggestion.source.confidence * 100);
  const displayValue = Array.isArray(suggestion.value)
    ? suggestion.value.join(', ')
    : String(suggestion.value);

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 6px', marginLeft: 6,
      background: 'var(--r0-info-bg, #e8f4fd)', border: '1px solid var(--r0-info-border, #b3d9f2)',
      borderRadius: 4, fontSize: 10, lineHeight: '16px', whiteSpace: 'nowrap',
    }}>
      <span style={{ color: 'var(--r0-info-text, #1a73e8)' }} title={
        `Zdroj: ${suggestion.source.document}${suggestion.source.page ? `, str. ${suggestion.source.page}` : ''} (${confPct}%)`
      }>
        {suggestion.label}: <strong>{displayValue}</strong>
      </span>
      <button
        onClick={() => onAccept(suggestion.param, suggestion.value)}
        title="Přijmout doporučení"
        style={{
          background: 'var(--r0-green, #34a853)', color: 'white', border: 'none',
          borderRadius: 3, padding: '0 4px', fontSize: 10, cursor: 'pointer',
          fontFamily: 'inherit', lineHeight: '14px',
        }}
      >
        Prijmout
      </button>
      <button
        onClick={() => onDismiss(suggestion.param)}
        title="Odmítnout"
        style={{
          background: 'none', color: 'var(--r0-slate-400, #999)', border: 'none',
          padding: '0 2px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          lineHeight: '14px',
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── DocWarningsBanner: blocking + recommended warnings from documents ──────

function DocWarningsBanner({ response }: {
  response: DocSuggestionsResponse | null;
}) {
  if (!response || response.warnings.length === 0) return null;

  const blocking = response.warnings.filter(w => w.severity === 'blocking');
  const recommended = response.warnings.filter(w => w.severity === 'recommended');
  const info = response.warnings.filter(w => w.severity === 'info');

  // Don't show info-only if user has accepted all suggestions
  const hasActionable = blocking.length > 0 || recommended.length > 0;

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Blocking warnings */}
      {blocking.map((w, i) => (
        <div key={`b-${i}`} style={{
          padding: '8px 10px', marginBottom: 4,
          background: '#fde8e8', border: '1px solid #f5c6c6',
          borderRadius: 6, fontSize: 11, color: '#c53030', lineHeight: 1.5,
        }}>
          <strong>Chyba:</strong> {w.message}
          {w.rule && <span style={{ opacity: 0.7, marginLeft: 4 }}>({w.rule})</span>}
        </div>
      ))}

      {/* Recommended warnings */}
      {recommended.map((w, i) => (
        <div key={`r-${i}`} style={{
          padding: '8px 10px', marginBottom: 4,
          background: '#fef9e7', border: '1px solid #f5e6a3',
          borderRadius: 6, fontSize: 11, color: '#7c6a0a', lineHeight: 1.5,
        }}>
          <strong>Doporuceni:</strong> {w.message}
        </div>
      ))}

      {/* Info: documents used */}
      {info.length > 0 && !hasActionable && (
        <div style={{
          padding: '6px 10px', marginBottom: 4,
          background: 'var(--r0-info-bg, #e8f4fd)', border: '1px solid var(--r0-info-border, #b3d9f2)',
          borderRadius: 6, fontSize: 10, color: 'var(--r0-info-text, #1a73e8)',
        }}>
          {info[0].message}
          {response.documents_used.length > 0 && (
            <span style={{ marginLeft: 4, opacity: 0.7 }}>
              ({response.documents_used.join(', ')})
            </span>
          )}
        </div>
      )}
    </div>
  );
}

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
  title: string; icon: React.ReactNode; children: React.ReactNode; borderColor?: string;
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

function Row({ label, value, bold }: { label: React.ReactNode; value: string; bold?: boolean }) {
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
