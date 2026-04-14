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
