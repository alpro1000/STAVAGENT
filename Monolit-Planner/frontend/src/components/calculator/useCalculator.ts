/**
 * useCalculator — Custom hook encapsulating all calculator state and logic.
 * Extracted from PlannerPage.tsx (Phase 3).
 *
 * Owns: form state, result, wizard, variants, AI advisor, document suggestions,
 * scenarios, auto-calc, apply-to-position logic.
 * PlannerPage becomes a pure layout component.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  planElement,
  aggregateScheduleDays,
  type PlannerInput,
  type PlannerOutput,
} from '@stavagent/monolit-shared';
import { getSuitableSystemsForElement, classifyElement, recommendFormwork } from '@stavagent/monolit-shared';
import { calculateCuring, calculateLateralPressure, suggestPourStages, inferPourMethod, calculateRebarLite, getElementProfile, filterFormworkByPressure } from '@stavagent/monolit-shared';
import type { CuringResult } from '@stavagent/monolit-shared';
import { findLinkedPositions } from '@stavagent/monolit-shared';
import type { TOVEntries, TOVLaborEntry, TOVMaterialEntry } from '@stavagent/monolit-shared';
import type { StructuralElementType } from '@stavagent/monolit-shared';
import type { ConcreteClass } from '@stavagent/monolit-shared';
import { loadFromLS, LS_FORM_KEY, LS_SCENARIOS_KEY, LS_SCENARIO_SEQ_KEY } from './helpers';
import type { AIAdvisorResult, DocSuggestion, DocSuggestionsResponse, FormState, ScenarioSnapshot, SavedVariant } from './types';
import { DEFAULT_FORM } from './types';
import { plannerVariantsAPI } from '../../services/api';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

export default function useCalculator() {
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
    // BUG-1: concrete consistency (DIN 18218 k-factor)
    if (form.concrete_consistency) input.concrete_consistency = form.concrete_consistency;
    // BUG-4: working joints allowed
    if (form.working_joints_allowed) input.working_joints_allowed = form.working_joints_allowed as any;
    // BUG-2: target pour window for alt pump scenario
    if (form.target_pour_window_h) {
      const tw = parseFloat(form.target_pour_window_h);
      if (Number.isFinite(tw) && tw > 0) input.target_pour_window_h = tw;
    }
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


  // ── Apply to Position (extracted from inline JSX callback) ──────────────
  const handleApplyToPosition = useMemo(() => {
    if (!positionContext) return undefined;
    return async () => {
                if (!plan) return;
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
                    labor_hours: form.wage_czk_h > 0 ? plan.costs.total_labor_czk / form.wage_czk_h : 0,
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
    };
  }, [positionContext, plan, form, setApplyStatus, queryClient, savedVariants]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Position context
    positionContext,
    isMonolitMode,
    isPortalMode,

    // Form state
    form, setForm,
    result, setResult,
    error, setError,
    plan,

    // UI toggles
    showAdvanced, setShowAdvanced,
    showLog, setShowLog,
    showHelp, setShowHelp,
    showNorms, setShowNorms,
    showProductivityNorms, setShowProductivityNorms,

    // Wizard
    wizardMode, setWizardMode,
    wizardStep, setWizardStep,
    wizardCanAdvance,
    wizardNext, wizardBack,
    wizardVisible,
    wizardHint1, wizardHint2, wizardHint3, wizardHint4,

    // Auto-calc
    calcStatus, resultDirty,
    applyStatus, setApplyStatus,

    // Variants
    savedVariants, variantsLoading,
    saveVariant, loadVariant, removeVariant, setAsPlan,

    // AI advisor
    advisor, setAdvisor,
    advisorLoading, setAdvisorLoading,
    fetchAdvisor,

    // Norms scraping
    normsScraping, setNormsScraping,
    normsScrapeResult, setNormsScrapeResult,

    // Document suggestions
    docSuggestions, docSugLoading,
    acceptedParams,
    acceptSuggestion, dismissSuggestion, getSuggestion,

    // Comparison / scenarios
    comparison, setComparison,
    showComparison, setShowComparison,
    scenarios, setScenarios, scenarioSeq, setScenarioSeq,
    handleSaveScenario,

    // Calculation
    handleCalculate, handleCompare,
    handleApplyToPosition,

    // Misc
    kridlaFormwork,
    autoClassification: classificationHint,
    initialForm,
    update,
  };
}
