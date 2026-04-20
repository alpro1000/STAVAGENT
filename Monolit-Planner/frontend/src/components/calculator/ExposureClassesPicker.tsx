/**
 * ExposureClassesPicker — 5-category checkbox grid for ČSN EN 206+A2
 * exposure classes + live derived-requirements summary.
 *
 * Task 2 (2026-04-20). Replaces the legacy single `<select>` in
 * CalculatorFormFields.tsx that could only pick ONE exposure class and
 * thus misrepresented real-life multi-exposure structures (bridge decks
 * see XF2 + XD1 + XC4 simultaneously).
 */

import React, { useMemo } from 'react';
import {
  EXPOSURE_CLASS_REQUIREMENTS,
  CATEGORY_LABELS_CS,
  combineExposure,
  validateExposureCombination,
  formatCombinedSummary,
  type ExposureCategory,
  type ExposureClass,
} from '@stavagent/monolit-shared';

interface Props {
  /** Currently selected classes. */
  value: string[];
  /** Write-back for the full selection. */
  onChange: (next: string[]) => void;
  /** Cement-type awareness for sulfate warning suppression (optional). */
  cement_type_is_sulfate_resistant?: boolean;
}

const CATEGORY_ORDER: ExposureCategory[] = [
  'zero', 'karbonatace', 'chloridy', 'mraz', 'chemie', 'obrus',
];

// Build "category → classes" map once (top-level const; ~20 items).
const CLASSES_BY_CATEGORY: Record<ExposureCategory, ExposureClass[]> = (() => {
  const out: Record<string, ExposureClass[]> = {};
  for (const [cls, req] of Object.entries(EXPOSURE_CLASS_REQUIREMENTS)) {
    const bucket = out[req.category] ?? [];
    bucket.push(cls as ExposureClass);
    out[req.category] = bucket;
  }
  return out as Record<ExposureCategory, ExposureClass[]>;
})();

export function ExposureClassesPicker({
  value, onChange, cement_type_is_sulfate_resistant,
}: Props) {
  const selected = useMemo(() => new Set(value), [value]);

  const combined = useMemo(() => combineExposure(value), [value]);
  const warnings = useMemo(
    () => validateExposureCombination(value, { cement_type_is_sulfate_resistant }),
    [value, cement_type_is_sulfate_resistant],
  );
  const summary = useMemo(() => formatCombinedSummary(combined), [combined]);

  const toggle = (cls: string) => {
    const next = selected.has(cls)
      ? value.filter(c => c !== cls)
      : [...value, cls];
    onChange(next);
  };

  return (
    <div>
      {CATEGORY_ORDER.map(cat => {
        const classes = CLASSES_BY_CATEGORY[cat] ?? [];
        if (classes.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--r0-slate-600)',
              textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
            }}>
              {CATEGORY_LABELS_CS[cat]}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {classes.map(cls => {
                const on = selected.has(cls);
                const req = EXPOSURE_CLASS_REQUIREMENTS[cls];
                return (
                  <label
                    key={cls}
                    title={req.label_cs}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', fontSize: 11,
                      border: `1px solid ${on ? 'var(--r0-blue, #3b82f6)' : 'var(--r0-slate-300)'}`,
                      background: on ? 'var(--r0-blue-bg, #eff6ff)' : 'white',
                      color: on ? 'var(--r0-blue-text, #1e40af)' : 'var(--r0-slate-700)',
                      borderRadius: 12, cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(cls)}
                      style={{ margin: 0, cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: on ? 600 : 400 }}>{cls}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Derived-requirements summary */}
      <div style={{
        marginTop: 6, padding: '6px 8px',
        background: value.length > 0 ? 'var(--r0-emerald-bg, #ecfdf5)' : 'var(--r0-slate-50, #f8fafc)',
        border: `1px solid ${value.length > 0 ? 'var(--r0-emerald-border, #a7f3d0)' : 'var(--r0-slate-200)'}`,
        borderRadius: 4, fontSize: 11, lineHeight: 1.5,
        color: value.length > 0 ? 'var(--r0-emerald-text, #065f46)' : 'var(--r0-slate-500)',
      }}>
        {summary}
      </div>

      {/* Validation warnings */}
      {warnings.length > 0 && (
        <ul style={{
          margin: '6px 0 0 0', paddingLeft: 16, fontSize: 10, lineHeight: 1.5,
          color: 'var(--r0-amber-text, #92400e)',
        }}>
          {warnings.map((w, i) => (
            <li key={`w-${i}`} style={{
              color: w.severity === 'info' ? 'var(--r0-slate-500)' : 'var(--r0-amber-text, #92400e)',
            }}>
              {w.message_cs}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
