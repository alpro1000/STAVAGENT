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
import { Calculator, ArrowLeft, Star } from 'lucide-react';
import CalculatorResult from '../components/calculator/CalculatorResult';
import CalculatorSidebar from '../components/calculator/CalculatorSidebar';

import { formatCZK, formatNum, loadFromLS, LS_FORM_KEY, LS_SCENARIOS_KEY, LS_SCENARIO_SEQ_KEY } from '../components/calculator/helpers';
import type { AIAdvisorResult, DocSuggestion, DocSuggestionsResponse, FormState, ScenarioSnapshot, SavedVariant, TactMode } from '../components/calculator/types';
import { DEFAULT_FORM } from '../components/calculator/types';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  planElement,
  aggregateScheduleDays,
  type PlannerInput,
  type PlannerOutput,
} from '@stavagent/monolit-shared';
import { classifyElement, recommendFormwork, getSuitableSystemsForElement } from '@stavagent/monolit-shared';
import { calculateCuring, calculateLateralPressure, suggestPourStages, inferPourMethod, calculateRebarLite, getElementProfile, filterFormworkByPressure } from '@stavagent/monolit-shared';
import type { CuringResult } from '@stavagent/monolit-shared';
import { findLinkedPositions } from '@stavagent/monolit-shared';
import type { TOVEntries, TOVLaborEntry, TOVMaterialEntry } from '@stavagent/monolit-shared';
import type { StructuralElementType, SeasonMode } from '@stavagent/monolit-shared';
import type { ConcreteClass, CementType } from '@stavagent/monolit-shared';
import PortalBreadcrumb from '../components/PortalBreadcrumb';
import { plannerVariantsAPI } from '../services/api';
import '../styles/r0.css';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
const IS_ADMIN = (import.meta as any).env?.VITE_ADMIN_MODE === 'true';
const PORTAL_URL = 'https://www.stavagent.cz/portal';

// ─── Component ──────────────────────────────────────────────────────────────

// Types, constants, helpers, and UI primitives are imported from
// ../components/calculator/{types,helpers,ui}.ts

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

  // Auto-save removed (v4.1): variants are created ONLY by explicit user action
  // (Uložit variantu button), never automatically on auto-calc.

  // Plan variants (saved scenarios per position)
  // Mode A (position_id present): persisted in PostgreSQL via /api/planner-variants
  // Mode B (standalone): in-memory state only, lost on page leave
  // ── Wizard / Expert mode toggle ──────────────────────────────────────────
  // wizardMode=true → 5-step wizard (same form state, just controls visibility)
  // wizardMode=false → flat expert form (all sections visible)
  const [wizardMode, setWizardMode] = useState(() => {
    try { return localStorage.getItem('planner_wizard_mode') !== 'false'; } catch { return true; }
  });
  const [wizardStep, setWizardStep] = useState(1); // 1-5

  useEffect(() => {
    try { localStorage.setItem('planner_wizard_mode', String(wizardMode)); } catch { /* ignore */ }
  }, [wizardMode]);

  /** Wizard step validation — can user proceed to next step? */
  const wizardCanAdvance = useMemo(() => {
    switch (wizardStep) {
      case 1: return !!form.element_type || (form.use_name_classification && !!form.element_name.trim());
      case 2: return form.volume_m3 > 0;
      case 3: return true; // geometry is optional
      case 4: return true; // rebar has defaults
      case 5: return true; // záběry have defaults
      default: return false;
    }
  }, [wizardStep, form.element_type, form.use_name_classification, form.element_name, form.volume_m3]);

  const wizardNext = useCallback(() => {
    if (wizardStep < 5 && wizardCanAdvance) {
      setWizardStep(wizardStep + 1);
    } else if (wizardStep === 5) {
      // Final step: trigger calculation
      runCalculation();
    }
  }, [wizardStep, wizardCanAdvance]); // eslint-disable-line react-hooks/exhaustive-deps

  const wizardBack = useCallback(() => {
    if (wizardStep > 1) setWizardStep(wizardStep - 1);
  }, [wizardStep]);

  // Keyboard navigation for wizard: Enter = next, Escape = back
  useEffect(() => {
    if (!wizardMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        wizardNext();
      } else if (e.key === 'Escape') {
        wizardBack();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [wizardMode, wizardNext, wizardBack]);

  /** Which sections are visible in the current wizard step.
   *  Objemy section contains fields from steps 2+3+4, so we use sub-field visibility. */
  const wizardVisible = useMemo(() => {
    if (!wizardMode) return { element: true, objemy: true, zabery: true, conditions: true, beton: true, resources: true, formwork: true, simulation: true,
      // Sub-field visibility within Objemy (all true in expert)
      objemy_volume: true, objemy_geometry: true, objemy_rebar: true };
    return {
      element: wizardStep === 1,
      objemy: wizardStep >= 2 && wizardStep <= 4, // Objemy section visible for steps 2-4
      objemy_volume: wizardStep === 2,    // volume m³
      objemy_geometry: wizardStep === 3,  // formwork area, lost formwork, height, shape
      objemy_rebar: wizardStep === 4,     // rebar norm/mass
      zabery: wizardStep === 5,
      conditions: wizardStep === 5,
      beton: wizardStep === 2,            // concrete class, cement → shown with volumes
      resources: wizardStep === 4,        // crew, shift, wages → shown with rebar
      formwork: false,                    // formwork override = expert only
      simulation: false,                  // monte carlo = expert only
    };
  }, [wizardMode, wizardStep]);

  // ── Engine-powered wizard hints ──────────────────────────────────────────
  // Progressive engine calls per step (Variant B: use defaults for missing data).
  // Each hint is a REAL engine calculation, not a static text.

  /** Step 1 hint: element profile from classifier */
  const wizardHint1 = useMemo(() => {
    if (!wizardMode) return null;
    const et = form.use_name_classification ? 'other' : form.element_type;
    try {
      const profile = getElementProfile(et);
      return profile;
    } catch { return null; }
  }, [wizardMode, form.element_type, form.use_name_classification]);

  /** Step 2 hint: maturity/curing from concrete class + temp */
  const wizardHint2 = useMemo<CuringResult | null>(() => {
    if (!wizardMode || wizardStep < 2) return null;
    if (!form.concrete_class || form.volume_m3 <= 0) return null;
    const et = form.use_name_classification ? 'other' : form.element_type;
    const profile = (() => { try { return getElementProfile(et); } catch { return null; } })();
    const elemType = profile?.orientation === 'vertical' ? 'wall' as const : 'slab' as const;
    try {
      return calculateCuring({
        concrete_class: form.concrete_class,
        temperature_c: form.temperature_c,
        cement_type: form.cement_type,
        element_type: elemType,
      });
    } catch { return null; }
  }, [wizardMode, wizardStep, form.concrete_class, form.temperature_c, form.cement_type, form.element_type, form.use_name_classification, form.volume_m3]);

  /** Step 3 hint: lateral pressure + formwork recommendation */
  const wizardHint3 = useMemo(() => {
    if (!wizardMode || wizardStep < 3) return null;
    const et = form.use_name_classification ? 'other' : form.element_type;
    const profile = (() => { try { return getElementProfile(et); } catch { return null; } })();
    const h = parseFloat(form.height_m);
    if (!profile || !h || h <= 0) return null;
    const isVert = profile.orientation === 'vertical';
    if (!isVert) return null; // lateral pressure only for vertical elements
    try {
      const pourMethod = inferPourMethod(profile.pump_typical, h);
      const lp = calculateLateralPressure(h, pourMethod);
      const { all: allSystems } = getSuitableSystemsForElement(et);
      const filtered = filterFormworkByPressure(lp.pressure_kn_m2, allSystems);
      const stages = suggestPourStages(h, pourMethod, allSystems);
      return { lateralPressure: lp, filtered, stages, profile };
    } catch { return null; }
  }, [wizardMode, wizardStep, form.element_type, form.use_name_classification, form.height_m]);

  /** Step 4 hint: rebar estimation */
  const wizardHint4 = useMemo(() => {
    if (!wizardMode || wizardStep < 4) return null;
    const et = form.use_name_classification ? 'other' : form.element_type;
    if (form.volume_m3 <= 0) return null;
    const massKg = form.rebar_mass_kg ? parseFloat(form.rebar_mass_kg) : undefined;
    try {
      return calculateRebarLite({
        element_type: et,
        volume_m3: form.volume_m3,
        mass_kg: massKg,
        crew_size: form.crew_size_rebar,
        shift_h: form.shift_h,
        wage_czk_h: form.wage_czk_h,
      });
    } catch { return null; }
  }, [wizardMode, wizardStep, form.element_type, form.use_name_classification, form.volume_m3, form.rebar_mass_kg, form.crew_size_rebar, form.shift_h, form.wage_czk_h]);
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
        // Auto-restore plán variant if one exists
        const planVar = loaded.find(v => v.is_plan);
        if (planVar && planVar.form && planVar.plan) {
          skipNextAutoCalcRef.current = true;
          setForm(planVar.form);
          setResult(planVar.plan);
          setResultDirty(false);
          // hasExistingResultRef removed (v4.1)
        }
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
    // Use max existing variant number + 1 to avoid duplicates after deletion
    const existingNums = savedVariants.map(v => {
      const m = v.label.match(/^V(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const num = existingNums.length === 0 ? 1 : Math.max(...existingNums) + 1;
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

  // Save prompt + auto-save removed (v4.1): auto-calc is pure preview,
  // never saves variants or asks the user to save before recalculating.

  // Auto-calculate on form change with 1.5s debounce (v4.1: pure preview, no save).
  useEffect(() => {
    if (skipNextAutoCalcRef.current) {
      skipNextAutoCalcRef.current = false;
      return;
    }
    // In wizard mode, auto-calc only runs after step 5 (all data entered)
    if (wizardMode && wizardStep < 5) return;
    // Mark result as stale
    setResultDirty(true);
    // Debounce — clear prior timer
    if (autoCalcTimerRef.current) clearTimeout(autoCalcTimerRef.current);
    autoCalcTimerRef.current = setTimeout(() => {
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
      autoCalcTimerRef.current = null;
    }, 1500);

    return () => {
      if (autoCalcTimerRef.current) {
        clearTimeout(autoCalcTimerRef.current);
        autoCalcTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // pendingApplyPlan + applyFnRef removed (v4.1): Aplikovat do pozice
  // now applies the CURRENT result directly, no variant load needed.

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
      // Use initialForm (from URL params / position context), not DEFAULT_FORM
      const f = initialForm;
      const input: PlannerInput = {
        element_type: f.use_name_classification ? undefined : f.element_type,
        element_name: f.use_name_classification ? f.element_name : undefined,
        volume_m3: f.volume_m3,
        has_dilatacni_spary: f.tact_mode === 'spary' ? f.has_dilatacni_spary : false,
        spara_spacing_m: f.spara_spacing_m,
        total_length_m: f.total_length_m,
        adjacent_sections: f.adjacent_sections,
        concrete_class: f.concrete_class,
        temperature_c: f.temperature_c,
      };
      if (f.formwork_area_m2) input.formwork_area_m2 = parseFloat(f.formwork_area_m2);
      if (f.height_m) input.height_m = parseFloat(f.height_m);
      if (f.rebar_mass_kg) input.rebar_mass_kg = parseFloat(f.rebar_mass_kg);
      return planElement(input);
    } catch {
      return null;
    }
  }, [initialForm]);

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
          <button
            onClick={() => { setWizardMode(!wizardMode); if (wizardMode) setWizardStep(1); }}
            style={{
              background: !wizardMode ? 'var(--r0-slate-800)' : 'transparent',
              color: !wizardMode ? 'white' : 'var(--r0-slate-600)',
              border: `1px solid ${!wizardMode ? 'var(--r0-slate-800)' : 'var(--r0-slate-300)'}`,
              borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
              fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
            }}
          >
            {wizardMode ? 'Průvodce' : 'Expertní'}
          </button>
          <span className="r0-badge">v1.1</span>
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
        <CalculatorSidebar
          form={form}
          setForm={setForm}
          result={result}
          setResult={setResult}
          error={error}
          setError={setError}
          wizardMode={wizardMode}
          wizardStep={wizardStep}
          wizardCanAdvance={wizardCanAdvance}
          wizardNext={wizardNext}
          wizardBack={wizardBack}
          wizardVisible={wizardVisible}
          wizardHint1={wizardHint1}
          wizardHint2={wizardHint2}
          wizardHint3={wizardHint3}
          wizardHint4={wizardHint4}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          showNorms={showNorms}
          setShowNorms={setShowNorms}
          showProductivityNorms={showProductivityNorms}
          setShowProductivityNorms={setShowProductivityNorms}
          advisor={advisor}
          advisorLoading={advisorLoading}
          setAdvisor={setAdvisor}
          setAdvisorLoading={setAdvisorLoading}
          docSuggestions={docSuggestions}
          docSugLoading={docSugLoading}
          acceptedParams={acceptedParams}
          onAcceptSuggestion={acceptSuggestion}
          onDismissSuggestion={dismissSuggestion}
          comparison={comparison}
          setComparison={setComparison}
          showComparison={showComparison}
          setShowComparison={setShowComparison}
          positionContext={positionContext}
          isMonolitMode={isMonolitMode}
          autoClassification={autoClassification}
          handleCalculate={handleCalculate}
          handleCompare={handleCompare}
          apiUrl={API_URL}
          isAdmin={IS_ADMIN}
        />

        {/* RIGHT: Results */}
        <main className="r0-planner-main">
          {plan ? (
            <CalculatorResult
              plan={plan}
              startDate={positionContext ? '' : form.start_date}
              showLog={showLog}
              onToggleLog={() => setShowLog(!showLog)}
              scenarios={scenarios}
              applyStatus={applyStatus}
              onApplyToPosition={(() => { if (!positionContext) return undefined; const fn = async () => {
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

                    // Betonář (pour crew = formwork crew by design; effectivePourCrew for continuous pours not exposed separately)
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
              }; return fn; })()}
              savedVariants={savedVariants}
              onSaveVariant={() => { saveVariant(plan); }}
              onLoadVariant={loadVariant}
              onRemoveVariant={removeVariant}
              onSetAsPlan={setAsPlan}
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

      {/* Save prompt removed (v4.1): auto-calc is pure preview, user saves explicitly */}
    </div>
  );
}

