/**
 * Shared helpers for the Calculator (PlannerPage Part B).
 * Extracted from PlannerPage.tsx.
 */

import { addWorkDays } from '@stavagent/monolit-shared';

export function formatCZK(val: number): string {
  return val.toLocaleString('cs-CZ', { maximumFractionDigits: 0 }) + ' Kč';
}

export function formatNum(val: number, decimals = 1): string {
  return val.toLocaleString('cs-CZ', { maximumFractionDigits: decimals });
}

/** Map work-day range [start, end] to calendar date string */
export function formatWorkDayRange(baseDate: Date, range: [number, number]): string {
  const fmt = (d: Date) => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
  const startResult = addWorkDays(baseDate, Math.floor(range[0]));
  const endResult = addWorkDays(baseDate, Math.ceil(range[1]));
  const startStr = fmt(startResult.end_date);
  const endStr = fmt(endResult.end_date);
  return startStr === endStr ? startStr : `${startStr} – ${endStr}`;
}

export function loadFromLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ─── localStorage keys ──────────────────────────────────────────────────────

// Block A (2026-04): bumped from 'planner-form' to 'planner-form-v2' so the
// stale form schema with tact_mode / num_tacts_override is silently dropped
// on first load. Per user decision: clean start, no migration.
export const LS_FORM_KEY = 'planner-form-v2';
export const LS_SCENARIOS_KEY = 'planner-scenarios';
export const LS_SCENARIO_SEQ_KEY = 'planner-scenario-seq';

// ─── Smart Defaults (UI simplification — 3-layer strategy) ─────────────────

import type { StructuralElementType, ConcreteClass } from '@stavagent/monolit-shared';

/**
 * Smart defaults per element_type for expert fields.
 * These are applied automatically when element_type changes (Layer 1 → engine).
 * User can override in Expert panel (Layer 3).
 * Values sourced from TKP18, ČSN EN 206, SO-202/203/207 golden tests.
 */
export interface SmartDefaults {
  /** Legacy singular — derived from `exposure_classes[0]` when array is non-empty. */
  exposure_class: string;
  /** Task 2 (2026-04-20): full multi-class suggestion per ČSN EN 206+A2.
   *  Applied only when the user's current selection is empty (auto-fill). */
  exposure_classes: string[];
  curing_class: '' | '2' | '3' | '4';  // '' = auto from engine
  typical_concrete: ConcreteClass;
  is_prestressed: boolean;
}

// Task 2 (2026-04-20): auto-suggested combinations per element_type,
// from task spec "Scenario B" table (ŘSD real practice).
const SMART_DEFAULTS_MAP: Partial<Record<StructuralElementType, SmartDefaults>> = {
  // ─── Bridge superstructure (class 4) ───
  mostovkova_deska: { exposure_class: 'XF2', exposure_classes: ['XF2', 'XD1', 'XC4'], curing_class: '4', typical_concrete: 'C35/45', is_prestressed: false },
  rimsa:            { exposure_class: 'XF4', exposure_classes: ['XF4', 'XD3'],        curing_class: '4', typical_concrete: 'C30/37', is_prestressed: false },
  rigel:            { exposure_class: 'XF2', exposure_classes: ['XF2', 'XD1', 'XC4'], curing_class: '4', typical_concrete: 'C35/45', is_prestressed: false },
  // ─── Bridge substructure (class 3) ───
  driky_piliru:         { exposure_class: 'XF4', exposure_classes: ['XF4', 'XD3'],        curing_class: '3', typical_concrete: 'C35/45', is_prestressed: false },
  opery_ulozne_prahy:   { exposure_class: 'XF2', exposure_classes: ['XC4', 'XF2'],        curing_class: '3', typical_concrete: 'C30/37', is_prestressed: false },
  zaklady_piliru:       { exposure_class: 'XC2', exposure_classes: ['XC2', 'XA1'],        curing_class: '3', typical_concrete: 'C25/30', is_prestressed: false },
  zaklady_oper:         { exposure_class: 'XC2', exposure_classes: ['XC2', 'XA1'],        curing_class: '3', typical_concrete: 'C25/30', is_prestressed: false }, // Phase 3 Gate 2a — same defaults as zaklady_piliru
  kridla_opery:         { exposure_class: 'XF2', exposure_classes: ['XC4', 'XF2'],        curing_class: '3', typical_concrete: 'C30/37', is_prestressed: false },
  mostni_zavirne_zidky: { exposure_class: 'XF4', exposure_classes: ['XF4', 'XD3'],        curing_class: '3', typical_concrete: 'C30/37', is_prestressed: false },
  podlozkovy_blok:      { exposure_class: 'XF2', exposure_classes: ['XF2', 'XC4'],        curing_class: '3', typical_concrete: 'C35/45', is_prestressed: false },
  operne_zdi:           { exposure_class: 'XC4', exposure_classes: ['XC4', 'XF1'],        curing_class: '3', typical_concrete: 'C25/30', is_prestressed: false },
  // ─── Bridge other (class 2) ───
  prechodova_deska:     { exposure_class: 'XC4', exposure_classes: ['XC4', 'XF1'],        curing_class: '2', typical_concrete: 'C25/30', is_prestressed: false },
  podkladni_beton:      { exposure_class: 'X0',  exposure_classes: ['X0'],                curing_class: '2', typical_concrete: 'C12/15', is_prestressed: false },
  pilota:               { exposure_class: 'XA1', exposure_classes: ['XC2', 'XA1'],        curing_class: '2', typical_concrete: 'C30/37', is_prestressed: false },
  // ─── Building elements (class 2) ───
  stena:            { exposure_class: '',    exposure_classes: [], curing_class: '2', typical_concrete: 'C25/30', is_prestressed: false },
  sloup:            { exposure_class: '',    exposure_classes: [], curing_class: '2', typical_concrete: 'C25/30', is_prestressed: false },
  stropni_deska:    { exposure_class: '',    exposure_classes: [], curing_class: '2', typical_concrete: 'C25/30', is_prestressed: false },
  zakladova_deska:  { exposure_class: 'XC2', exposure_classes: ['XC2'], curing_class: '2', typical_concrete: 'C25/30', is_prestressed: false },
  zakladovy_pas:    { exposure_class: 'XC2', exposure_classes: ['XC2'], curing_class: '2', typical_concrete: 'C25/30', is_prestressed: false },
  zakladova_patka:  { exposure_class: 'XC2', exposure_classes: ['XC2'], curing_class: '2', typical_concrete: 'C25/30', is_prestressed: false },
  pruvlak:          { exposure_class: '',    exposure_classes: [], curing_class: '2', typical_concrete: 'C25/30', is_prestressed: false },
  schodiste:        { exposure_class: '',    exposure_classes: [], curing_class: '2', typical_concrete: 'C25/30', is_prestressed: false },
  nadrz:            { exposure_class: '',    exposure_classes: [], curing_class: '2', typical_concrete: 'C30/37', is_prestressed: false },
  podzemni_stena:   { exposure_class: '',    exposure_classes: [], curing_class: '2', typical_concrete: 'C30/37', is_prestressed: false },
};

const FALLBACK_DEFAULTS: SmartDefaults = {
  exposure_class: '', exposure_classes: [], curing_class: '', typical_concrete: 'C30/37', is_prestressed: false,
};

/** Get smart defaults for an element type. Falls back to generic defaults for 'other'. */
export function getSmartDefaults(elementType: StructuralElementType): SmartDefaults {
  return SMART_DEFAULTS_MAP[elementType] ?? FALLBACK_DEFAULTS;
}

/** Check if a field value differs from its smart default (user override). */
export function isUserOverride(
  elementType: StructuralElementType,
  field: keyof SmartDefaults,
  currentValue: string | boolean,
): boolean {
  const defaults = getSmartDefaults(elementType);
  return currentValue !== '' && currentValue !== defaults[field];
}

// ─── Shared style constants ────────────────────────────────────────────────

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 14,
  border: '1px solid var(--r0-slate-200)', borderRadius: 6,
  background: 'white', fontFamily: 'inherit',
  boxSizing: 'border-box',
};

export const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, color: 'var(--r0-slate-700)',
  marginBottom: 6, cursor: 'pointer',
};

export const subTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--r0-slate-500)',
  marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em',
};

export const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '6px 8px', fontSize: 11,
  color: 'var(--r0-slate-500)', fontWeight: 600,
};

export const tdStyle: React.CSSProperties = {
  padding: '5px 8px', fontSize: 12,
  fontFamily: "var(--r0-font-mono, 'JetBrains Mono', monospace)",
};
