/**
 * Shared types for the Calculator (PlannerPage Part B).
 * Extracted from PlannerPage.tsx for reuse across calculator sub-components.
 */

import type { StructuralElementType, SeasonMode, ConcreteClass, CementType } from '@stavagent/monolit-shared';

// ─── AI Advisor types ──────────────────────────────────────────────────────

export interface AIAdvisorResult {
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

export interface DocFactSource {
  document: string;
  page: number | null;
  confidence: number;
  source_type: string;
}

export interface DocSuggestion {
  param: string;
  value: any;
  label: string;
  source: DocFactSource;
  accepted: boolean;
}

export interface DocWarning {
  severity: 'blocking' | 'recommended' | 'info';
  message: string;
  param: string | null;
  rule: string;
}

export interface DocConflict {
  param: string;
  values: Array<{ value: any; source: DocFactSource }>;
  recommended_value: any;
  recommendation_reason: string;
}

export interface DocSuggestionsResponse {
  project_id: string;
  building_object: string;
  suggestions: DocSuggestion[];
  warnings: DocWarning[];
  conflicts: DocConflict[];
  facts_count: number;
  documents_used: string[];
}

// ─── Form state ────────────────────────────────────────────────────────────

export type TactMode = 'spary' | 'manual';

export interface FormState {
  element_type: StructuralElementType;
  element_name: string;
  use_name_classification: boolean;
  volume_m3: number;
  formwork_area_m2: string;
  rebar_mass_kg: string;
  rebar_norm_kg_m3: string;
  height_m: string;
  tact_mode: TactMode;
  has_dilatacni_spary: boolean;
  spara_spacing_m: number;
  total_length_m: number;
  adjacent_sections: boolean;
  num_tacts_override: string;
  tact_volume_m3_override: string;
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
  wage_formwork_czk_h: string;
  wage_rebar_czk_h: string;
  wage_pour_czk_h: string;
  formwork_system_name: string;
  rental_czk_override: string;
  formwork_shape_correction: string;
  num_identical_elements: number;
  formwork_sets_count: string;
  enable_monte_carlo: boolean;
  start_date: string;
  num_bridges: number;
  deadline_days: string;
  is_prestressed: boolean;
  bridge_deck_subtype: string;
  include_kridla: boolean;
  kridla_height_m: string;
  span_m: string;
  num_spans: string;
  nk_width_m: string;
  construction_technology: '' | 'fixed_scaffolding' | 'mss' | 'cantilever';
  mss_tact_days: string;
  has_lost_formwork: boolean;
  lost_formwork_area_m2: string;
}

// ─── Scenario Snapshot ──────────────────────────────────────────────────────

export interface ScenarioSnapshot {
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

// ─── Saved Variant ──────────────────────────────────────────────────────────

export interface SavedVariant {
  id: string;
  label: string;
  total_days: number;
  total_cost_czk: number;
  is_plan?: boolean;
  plan?: any;
  form?: any;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const ELEMENT_TYPES: { value: StructuralElementType; label: string; group: string }[] = [
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

export const SEASONS: { value: SeasonMode; label: string; temp: number }[] = [
  { value: 'normal', label: 'Normální (5-25°C)', temp: 15 },
  { value: 'hot', label: 'Horko (>25°C)', temp: 30 },
  { value: 'cold', label: 'Zima (<5°C)', temp: 0 },
];

export const CONCRETE_CLASSES: ConcreteClass[] = [
  'C12/15', 'C16/20', 'C20/25', 'C25/30', 'C30/37',
  'C35/45', 'C40/50', 'C45/55', 'C50/60',
];

export const CEMENT_TYPES: { value: CementType; label: string }[] = [
  { value: 'CEM_I', label: 'CEM I (OPC - rychlé)' },
  { value: 'CEM_II', label: 'CEM II (směsný - střední)' },
  { value: 'CEM_III', label: 'CEM III (struska - pomalé)' },
];

export const DEFAULT_FORM: FormState = {
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
