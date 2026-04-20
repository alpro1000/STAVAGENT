/**
 * TzTextInput — textarea for pasting TZ (technická zpráva) excerpts.
 *
 * Extracts construction parameters via regex (shared/parsers/tz-text-extractor)
 * and allows the user to apply them to the calculator form.
 *
 * Part of the "text-first smart input" strategy:
 *   1. User copies text from TZ PDF
 *   2. Pastes into textarea
 *   3. Regex extracts params (realtime, debounced 500ms)
 *   4. User clicks "Převzít" or selects individual params
 *   5. Form pre-filled, ready for calculation
 *
 * Task 1 (2026-04-20) — TZ context lock:
 *   When the calculator is opened from Monolit Planner (`position_id` URL
 *   param), the parent context is authoritative. Smart Extractor then:
 *     • skips LOCKED fields (element_type, volume_m3)
 *     • skips parameters NOT compatible with current element_type
 *     • fills non-locked fields ONLY IF CURRENTLY EMPTY / DEFAULT
 *   Rejected params surface in an expandable "ignored" list with reasons.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  extractFromText,
  explainIncompatibility,
  isParamCompatibleWith,
  type ExtractedParam,
  type StructuralElementType,
} from '@stavagent/monolit-shared';
import type { FormState } from './types';

interface TzTextInputProps {
  tzText: string;
  setTzText: (v: string) => void;
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  /** Task 1: calculator opened from Monolit Planner (position_id present). */
  isTzContextLocked?: boolean;
  /** Task 1: FormState keys locked from parent context — never overwrite. */
  lockedFieldSet?: ReadonlySet<string>;
  /** Task 1: position code displayed in lock banner (e.g. "272325"). */
  positionCode?: string | null;
}

// ─── Field-value helpers ─────────────────────────────────────────────────────

/**
 * Return `true` when a FormState field is considered "empty/default" for
 * the purpose of "fill only if empty" policy (Task 1 decision).
 * Numbers: 0 / NaN counts as empty. Strings: '' counts as empty. Booleans:
 * false counts as empty. Undefined/null counts as empty.
 */
function isFieldEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return value === 0 || Number.isNaN(value);
  if (typeof value === 'boolean') return value === false;
  return false;
}

/**
 * Ignored-param record — why a TZ extraction was not applied to the form.
 * Surfaced in an expandable UI list so the user understands what the
 * filter dropped (trust signal, not a silent skip).
 */
interface IgnoredParam {
  param: ExtractedParam;
  reason: 'locked' | 'incompatible' | 'already_filled';
  reasonText: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TzTextInput({
  tzText,
  setTzText,
  form,
  update,
  isTzContextLocked = false,
  lockedFieldSet,
  positionCode,
}: TzTextInputProps) {
  const [expanded, setExpanded] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedParam[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [lastApplied, setLastApplied] = useState<{ applied: number; ignored: IgnoredParam[] } | null>(null);
  const [ignoredOpen, setIgnoredOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced extraction on text change
  useEffect(() => {
    if (!tzText.trim()) {
      setExtracted([]);
      setChecked(new Set());
      setLastApplied(null);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = extractFromText(tzText, { element_type: form.element_type });
      setExtracted(params);
      setChecked(new Set(params.map(p => p.name)));
      setLastApplied(null);
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [tzText, form.element_type]);

  /**
   * Classify every extracted param against three filters (in order):
   *   1. Locked: field is in `lockedFieldSet` (parent-context source of truth)
   *   2. Incompatible: param is not meaningful for the current element_type
   *   3. Already filled: non-locked & compatible, but target field is not empty
   * Returns the subset that is APPLICABLE (will be filled) + the rejection list.
   */
  const triage = useMemo(() => {
    const applicable: ExtractedParam[] = [];
    const ignored: IgnoredParam[] = [];
    const lockSet = lockedFieldSet ?? new Set<string>();
    const elemType = form.element_type as StructuralElementType;
    for (const p of extracted) {
      // Lock filter (Scenario A only — lockedFieldSet is empty in Scenario B)
      if (lockSet.has(p.name)) {
        ignored.push({
          param: p, reason: 'locked',
          reasonText: `Pole je uzamčeno z pozice${positionCode ? ` ${positionCode}` : ''} (Monolit Planner).`,
        });
        continue;
      }
      // Compatibility filter (both scenarios)
      const reasonCs = explainIncompatibility(p.name, elemType);
      if (reasonCs !== null) {
        ignored.push({ param: p, reason: 'incompatible', reasonText: reasonCs });
        continue;
      }
      // Fill-only-if-empty filter (both scenarios — user design decision Task 1)
      const currentValue = (form as unknown as Record<string, unknown>)[p.name];
      if (!isFieldEmpty(currentValue)) {
        ignored.push({
          param: p, reason: 'already_filled',
          reasonText: `Pole je již vyplněné (${String(currentValue)}). Pro přepsání nejprve vymažte ručně.`,
        });
        continue;
      }
      applicable.push(p);
    }
    return { applicable, ignored };
  }, [extracted, form, lockedFieldSet, positionCode]);

  const applyParams = () => {
    let appliedCount = 0;
    for (const p of triage.applicable) {
      if (!checked.has(p.name)) continue;
      switch (p.name) {
        case 'concrete_class': update('concrete_class', p.value as FormState['concrete_class']); break;
        case 'exposure_class': update('exposure_class', String(p.value)); break;
        case 'formwork_area_m2': update('formwork_area_m2', String(p.value)); break;
        case 'height_m': update('height_m', String(p.value)); break;
        case 'nk_width_m': update('nk_width_m', String(p.value)); break;
        case 'total_length_m': update('total_length_m', Number(p.value)); break;
        case 'span_m': update('span_m', String(p.value)); break;
        case 'num_spans': update('num_spans', String(p.value)); break;
        case 'is_prestressed': update('is_prestressed', Boolean(p.value)); break;
        case 'bridge_deck_subtype': update('bridge_deck_subtype', String(p.value)); break;
        case 'pile_diameter_mm': update('pile_diameter_mm', String(p.value)); break;
        // element_type / volume_m3 are in lockedFieldSet when isTzContextLocked;
        // in Scenario B the applicable filter still accepts them:
        case 'element_type': update('element_type', p.value as FormState['element_type']); break;
        case 'volume_m3': update('volume_m3', Number(p.value)); break;
        case 'prestress_tensioning':
        case 'prestress_cables_count':
        case 'prestress_strands_per_cable':
        case 'thickness_mm':
        case 'reinforcement_total_kg':
        case 'reinforcement_ratio_kg_m3':
          // Informational — no direct FormState binding (surfaced in UI only)
          break;
        default:
          // Unknown future param — skip silently (forward compat)
          break;
      }
      appliedCount += 1;
    }
    setLastApplied({ applied: appliedCount, ignored: triage.ignored });
  };

  const toggleParam = (name: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          width: '100%', padding: '8px 10px', marginBottom: 8,
          background: 'var(--r0-slate-50, #f8fafc)',
          border: '1px dashed var(--r0-slate-300, #cbd5e1)',
          borderRadius: 6, fontSize: 12, color: 'var(--r0-slate-600)',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        Vložit text z TZ (Ctrl+V)
      </button>
    );
  }

  // Build a lookup set of "applicable" names for rendering state
  const applicableNames = new Set(triage.applicable.map(p => p.name));

  return (
    <div style={{
      marginBottom: 10, padding: '8px 10px',
      background: 'var(--r0-slate-50, #f8fafc)',
      border: '1px solid var(--r0-slate-200, #e2e8f0)',
      borderRadius: 6,
    }}>
      {/* Task 1: Lock banner — shown only in Scenario A (position_id present) */}
      {isTzContextLocked && (
        <div style={{
          marginBottom: 6, padding: '4px 8px',
          background: 'var(--r0-amber-bg, #fef3c7)',
          border: '1px solid var(--r0-amber-border, #fcd34d)',
          borderRadius: 4, fontSize: 10, color: 'var(--r0-amber-text, #92400e)',
          lineHeight: 1.4,
        }}>
          🔒 Z pozice{positionCode ? ` ${positionCode}` : ''} (Monolit Planner).
          Typ elementu a objem jsou uzamčené — TZ je pouze doplňkový zdroj.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--r0-slate-600)' }}>
          Text z TZ (technická zpráva)
        </span>
        <button onClick={() => { setExpanded(false); setTzText(''); setLastApplied(null); }}
          style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--r0-slate-400)', cursor: 'pointer' }}>
          Zavřít
        </button>
      </div>

      <textarea
        value={tzText}
        onChange={e => setTzText(e.target.value)}
        placeholder="Vložte úryvek z TZ... např. &quot;Nosná konstrukce z betonu C35/45 XF2, rozpětí 15+4×20+15 m&quot;"
        style={{
          width: '100%', minHeight: 60, maxHeight: 200, padding: '6px 8px',
          fontSize: 12, fontFamily: 'inherit', border: '1px solid var(--r0-slate-200)',
          borderRadius: 4, resize: 'vertical', boxSizing: 'border-box',
          background: 'white',
        }}
      />

      {extracted.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--r0-slate-600)', marginBottom: 4 }}>
            Nalezeno ({extracted.length} parametrů):
            {triage.ignored.length > 0 && (
              <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--r0-slate-400)' }}>
                {triage.applicable.length} použitelných · {triage.ignored.length} přeskočeno
              </span>
            )}
          </div>
          {extracted.map((p, i) => {
            const isApplicable = applicableNames.has(p.name);
            const ignoredEntry = triage.ignored.find(x => x.param.name === p.name);
            return (
              <label key={`${p.name}-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                color: isApplicable ? 'var(--r0-slate-700)' : 'var(--r0-slate-400)',
                cursor: isApplicable ? 'pointer' : 'not-allowed', padding: '1px 0',
                opacity: isApplicable ? 1 : 0.5,
              }}>
                <input type="checkbox" checked={checked.has(p.name) && isApplicable}
                  disabled={!isApplicable}
                  onChange={() => toggleParam(p.name)} style={{ margin: 0 }} />
                <span style={{ opacity: p.confidence >= 1 ? 1 : 0.7 }}>
                  {p.label_cs}
                </span>
                {ignoredEntry && (
                  <span style={{ fontSize: 9, color: 'var(--r0-slate-400)' }}>
                    ({ignoredEntry.reason === 'locked' ? 'uzamčeno'
                      : ignoredEntry.reason === 'incompatible' ? 'jiný typ'
                      : 'už vyplněno'})
                  </span>
                )}
                {p.confidence < 1 && isApplicable && (
                  <span style={{ fontSize: 9, color: 'var(--r0-slate-400)' }}>
                    ({Math.round(p.confidence * 100)}%)
                  </span>
                )}
              </label>
            );
          })}
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <button
              onClick={applyParams}
              disabled={triage.applicable.length === 0}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                background: triage.applicable.length > 0 ? 'var(--r0-blue, #3b82f6)' : 'var(--r0-slate-200)',
                color: triage.applicable.length > 0 ? 'white' : 'var(--r0-slate-400)',
                border: 'none', borderRadius: 4,
                cursor: triage.applicable.length > 0 ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              Převzít ({triage.applicable.filter(p => checked.has(p.name)).length})
            </button>
            <button
              onClick={() => { setTzText(''); setExtracted([]); setLastApplied(null); }}
              style={{
                padding: '4px 10px', fontSize: 11,
                background: 'none', border: '1px solid var(--r0-slate-300)',
                borderRadius: 4, cursor: 'pointer', color: 'var(--r0-slate-600)', fontFamily: 'inherit',
              }}
            >
              Vymazat
            </button>
          </div>
        </div>
      )}

      {/* Post-apply feedback: applied + ignored badges + expandable list */}
      {lastApplied && (
        <div style={{ marginTop: 8, padding: '6px 8px',
          background: 'white', border: '1px solid var(--r0-slate-200)', borderRadius: 4 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
            <span style={{
              padding: '2px 6px', borderRadius: 3,
              background: 'var(--r0-emerald-bg, #d1fae5)',
              color: 'var(--r0-emerald-text, #065f46)', fontWeight: 600,
            }}>
              ✓ Aplikováno: {lastApplied.applied}
            </span>
            {lastApplied.ignored.length > 0 && (
              <button
                onClick={() => setIgnoredOpen(o => !o)}
                style={{
                  padding: '2px 6px', borderRadius: 3, border: 'none',
                  background: 'var(--r0-slate-100, #f1f5f9)',
                  color: 'var(--r0-slate-600)', fontWeight: 600, fontSize: 11,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                ⊘ Ignorováno: {lastApplied.ignored.length} {ignoredOpen ? '▴' : '▾'}
              </button>
            )}
          </div>
          {ignoredOpen && lastApplied.ignored.length > 0 && (
            <ul style={{ margin: '6px 0 0 0', paddingLeft: 16, fontSize: 10, color: 'var(--r0-slate-600)', lineHeight: 1.6 }}>
              {lastApplied.ignored.map((ig, i) => (
                <li key={`ig-${i}`}>
                  <strong>{ig.param.label_cs}</strong> — {ig.reasonText}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
