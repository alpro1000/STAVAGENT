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
 *   4. User clicks Apply / Doplnit — form pre-filled
 *
 * Task 1 (2026-04-20) — TZ context lock:
 *   When opened from Monolit Planner (`position_id` URL param), parent
 *   context is authoritative. Smart Extractor skips LOCKED fields,
 *   INCOMPATIBLE params, and ALREADY-FILLED fields (Doplnit mode).
 *
 * Task 3 (2026-04-20) — Incremental mode:
 *   TZ text persists per-position (tzStorage.ts). Returning the user sees
 *   "TZ uloženo {ts}" banner + a secondary textarea for appending new
 *   fragments. Results are split into 4 groups: Přidáno / Zachováno /
 *   Konflikt / Ignorováno. Checkbox "Přepsat existující hodnoty" flips
 *   the apply mode to force-overwrite (safety-reset on mount).
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  extractFromText,
  explainIncompatibility,
  type ExtractedParam,
  type StructuralElementType,
} from '@stavagent/monolit-shared';
import type { FormState } from './types';
import {
  isFieldEmpty,
  formatTzHistoryLine,
  TZ_MAX_CHARS,
  type TzHistoryEntry,
} from './tzStorage';

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
  /** Task 3: `position_id` URL marker — enables incremental-mode features. */
  tzPositionId?: string | null;
  /** Task 3: ISO timestamp of last apply for this position. */
  tzLastAppliedAt?: string | null;
  /** Task 3: persisted history ring buffer (most-recent-last). */
  tzHistory?: TzHistoryEntry[];
  /** Task 3: persist a new history entry after each apply. */
  appendTzHistoryCb?: (entry: {
    method: 'doplnit' | 'prepsat';
    added: string[]; kept: string[]; conflicts: string[]; ignored: string[];
  }) => void;
  /** Task 3: clear both text + history (confirm dialog handled here). */
  clearTz?: () => void;
}

// ─── Triage bookkeeping ─────────────────────────────────────────────────────

type IgnoreReason = 'locked' | 'incompatible' | 'already_filled';

interface IgnoredParam {
  param: ExtractedParam;
  reason: IgnoreReason;
  reasonText: string;
}

interface ConflictParam {
  param: ExtractedParam;
  /** Primary + alternatives, deduplicated. First entry = extractor's pick. */
  choices: (string | number)[];
}

interface LastApplied {
  method: 'doplnit' | 'prepsat';
  added: string[];
  kept: string[];
  conflicts: string[];
  ignored: string[];
}

// ─── Param → FormState writer ───────────────────────────────────────────────

/**
 * Apply one extracted param's value (or a user-resolved conflict choice)
 * to the form. Returns `true` when the write was a real FormState update;
 * `false` when the param has no direct FormState mapping (informational).
 */
function writeParamToForm(
  name: string,
  value: string | number | boolean | string[],
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void,
): boolean {
  switch (name) {
    case 'concrete_class': update('concrete_class', value as FormState['concrete_class']); return true;
    case 'exposure_class': update('exposure_class', String(value)); return true;
    case 'exposure_classes':
      update('exposure_classes', Array.isArray(value) ? value as string[] : [String(value)]);
      return true;
    case 'formwork_area_m2': update('formwork_area_m2', String(value)); return true;
    case 'height_m': update('height_m', String(value)); return true;
    case 'nk_width_m': update('nk_width_m', String(value)); return true;
    case 'total_length_m': update('total_length_m', Number(value)); return true;
    case 'span_m': update('span_m', String(value)); return true;
    case 'num_spans': update('num_spans', String(value)); return true;
    case 'is_prestressed': update('is_prestressed', Boolean(value)); return true;
    case 'bridge_deck_subtype': update('bridge_deck_subtype', String(value)); return true;
    case 'pile_diameter_mm': update('pile_diameter_mm', String(value)); return true;
    case 'element_type': update('element_type', value as FormState['element_type']); return true;
    case 'volume_m3': update('volume_m3', Number(value)); return true;
    // Informational-only params (no direct FormState binding).
    case 'prestress_tensioning':
    case 'prestress_cables_count':
    case 'prestress_strands_per_cable':
    case 'thickness_mm':
    case 'reinforcement_total_kg':
    case 'reinforcement_ratio_kg_m3':
      return false;
    default:
      return false; // unknown future param — skip silently (forward compat)
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TzTextInput({
  tzText,
  setTzText,
  form,
  update,
  isTzContextLocked = false,
  lockedFieldSet,
  positionCode,
  tzPositionId = null,
  tzLastAppliedAt = null,
  tzHistory = [],
  appendTzHistoryCb,
  clearTz,
}: TzTextInputProps) {
  // Task 3: the component auto-expands when opening a position that already
  // has saved TZ so the user doesn't have to fish for it; in standalone or
  // fresh-position mode it stays collapsed behind the "Vložit text z TZ" CTA.
  const initialExpanded = !!tzPositionId && tzText.trim().length > 0;
  const [expanded, setExpanded] = useState(initialExpanded);
  const [extracted, setExtracted] = useState<ExtractedParam[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [lastApplied, setLastApplied] = useState<LastApplied | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Task 3: secondary textarea for appending (only when saved TZ exists).
  const [secondaryText, setSecondaryText] = useState('');
  // Task 3: "Přepsat existující hodnoty" toggle. Default OFF, reset on mount.
  const [overwrite, setOverwrite] = useState(false);
  // Task 3: user-resolved conflict choices (param_name → chosen value).
  const [conflictChoice, setConflictChoice] = useState<Record<string, string | number>>({});
  // Task 3: collapsible history panel.
  const [historyOpen, setHistoryOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // The effective text the extractor reads = main + optional appended fragment.
  const combinedText = useMemo(() => {
    if (!secondaryText.trim()) return tzText;
    if (!tzText.trim()) return secondaryText;
    return `${tzText}\n${secondaryText}`;
  }, [tzText, secondaryText]);

  // Debounced extraction on text change.
  useEffect(() => {
    if (!combinedText.trim()) {
      setExtracted([]);
      setChecked(new Set());
      setLastApplied(null);
      setConflictChoice({});
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = extractFromText(combinedText, { element_type: form.element_type });
      setExtracted(params);
      setChecked(new Set(params.map(p => p.name)));
      setLastApplied(null);
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [combinedText, form.element_type]);

  /**
   * Triage each extracted param into one of four buckets. The ordering of
   * the checks matters:
   *   1. LOCKED   — parent context is authoritative (Task 1)
   *   2. INCOMPATIBLE — param doesn't apply to this element_type (Task 1)
   *   3. CONFLICT — extractor found multiple distinct values for the field
   *      and the user hasn't resolved the pick yet
   *   4. ALREADY FILLED — Doplnit mode: don't overwrite manual entries
   *      (skipped when `overwrite` toggle is ON — Task 3)
   *   5. APPLICABLE — will be written on "Doplnit z TZ" click
   */
  const triage = useMemo(() => {
    const applicable: ExtractedParam[] = [];
    const ignored: IgnoredParam[] = [];
    const conflicts: ConflictParam[] = [];
    const lockSet = lockedFieldSet ?? new Set<string>();
    const elemType = form.element_type as StructuralElementType;

    for (const p of extracted) {
      if (lockSet.has(p.name)) {
        ignored.push({
          param: p, reason: 'locked',
          reasonText: `Pole je uzamčeno z pozice${positionCode ? ` ${positionCode}` : ''} (Monolit Planner).`,
        });
        continue;
      }
      const reasonCs = explainIncompatibility(p.name, elemType);
      if (reasonCs !== null) {
        ignored.push({ param: p, reason: 'incompatible', reasonText: reasonCs });
        continue;
      }
      // Task 3 — conflict if the extractor surfaced alternatives and the
      // user hasn't resolved the pick yet.
      const hasAlternatives = Array.isArray(p.alternatives) && p.alternatives.length > 0;
      const resolved = conflictChoice[p.name];
      if (hasAlternatives && resolved === undefined) {
        const choices = [p.value as (string | number), ...(p.alternatives as (string | number)[])];
        conflicts.push({ param: p, choices });
        continue;
      }
      // Doplnit mode — don't overwrite filled fields (Task 1 default).
      const currentValue = (form as unknown as Record<string, unknown>)[p.name];
      if (!overwrite && !isFieldEmpty(currentValue)) {
        ignored.push({
          param: p, reason: 'already_filled',
          reasonText: `Pole je již vyplněné (${String(currentValue)}). Zapněte „Přepsat" pro přepsání nebo vyčistěte ručně.`,
        });
        continue;
      }
      applicable.push(p);
    }
    return { applicable, ignored, conflicts };
  }, [extracted, form, lockedFieldSet, positionCode, overwrite, conflictChoice]);

  const applyParams = () => {
    const method: 'doplnit' | 'prepsat' = overwrite ? 'prepsat' : 'doplnit';
    const added: string[] = [];
    const kept: string[] = triage.ignored
      .filter(ig => ig.reason === 'already_filled')
      .map(ig => ig.param.name);
    const ignoredNames: string[] = triage.ignored
      .filter(ig => ig.reason !== 'already_filled')
      .map(ig => ig.param.name);

    for (const p of triage.applicable) {
      if (!checked.has(p.name)) continue;
      const valueToUse = conflictChoice[p.name] ?? p.value;
      if (writeParamToForm(p.name, valueToUse as any, update)) {
        added.push(p.name);
      }
    }

    // Task 3 — also apply any conflict the user actually resolved this round.
    for (const c of triage.conflicts) {
      const picked = conflictChoice[c.param.name];
      if (picked !== undefined && writeParamToForm(c.param.name, picked, update)) {
        added.push(c.param.name);
      }
    }

    const conflictsNames = triage.conflicts.map(c => c.param.name);

    setLastApplied({ method, added, kept, conflicts: conflictsNames, ignored: ignoredNames });
    appendTzHistoryCb?.({
      method, added, kept, conflicts: conflictsNames, ignored: ignoredNames,
    });

    // Task 3: pulling the new fragment into main text so history survives,
    // then wiping the secondary area. Feels natural: user pasted extra, we
    // adopted it.
    if (secondaryText.trim()) {
      setTzText(combinedText);
      setSecondaryText('');
    }
  };

  const toggleParam = (name: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleClear = () => {
    if (!window.confirm('Smazat uložený TZ text a historii pro tuto pozici?')) return;
    setSecondaryText('');
    setExtracted([]);
    setChecked(new Set());
    setLastApplied(null);
    setConflictChoice({});
    if (clearTz) clearTz();
    else setTzText('');
  };

  // ─── Collapsed state ─────────────────────────────────────────────────────

  if (!expanded) {
    const hint = tzText.trim().length > 0
      ? `TZ uloženo · ${tzText.length.toLocaleString('cs-CZ')} znaků`
      : 'Vložit text z TZ (Ctrl+V)';
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          width: '100%', padding: '8px 10px', marginBottom: 8,
          background: 'var(--r0-slate-50, #f8fafc)',
          border: `1px dashed ${tzText ? 'var(--r0-blue, #3b82f6)' : 'var(--r0-slate-300)'}`,
          borderRadius: 6, fontSize: 12,
          color: tzText ? 'var(--r0-blue-text, #1e40af)' : 'var(--r0-slate-600)',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        {hint}
      </button>
    );
  }

  // ─── Expanded state ──────────────────────────────────────────────────────

  const applicableNames = new Set(triage.applicable.map(p => p.name));
  const hasSavedTz = !!tzPositionId && !!tzLastAppliedAt;
  const primaryBtnLabel = hasSavedTz ? 'Doplnit z TZ' : 'Aplikovat z TZ';
  const applyDisabled = triage.applicable.length === 0 && Object.keys(conflictChoice).length === 0;
  const charCount = tzText.length + (secondaryText.length || 0);
  const overCap = charCount > TZ_MAX_CHARS;

  return (
    <div style={{
      marginBottom: 10, padding: '8px 10px',
      background: 'var(--r0-slate-50, #f8fafc)',
      border: '1px solid var(--r0-slate-200, #e2e8f0)',
      borderRadius: 6,
    }}>
      {/* Task 1: Lock banner */}
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

      {/* Task 3: Saved-TZ banner */}
      {hasSavedTz && (
        <div style={{
          marginBottom: 6, padding: '4px 8px',
          background: 'var(--r0-blue-bg, #eff6ff)',
          border: '1px solid var(--r0-blue-border, #bfdbfe)',
          borderRadius: 4, fontSize: 10, color: 'var(--r0-blue-text, #1e40af)',
          lineHeight: 1.4,
        }}>
          💾 TZ uloženo{tzLastAppliedAt ? ` ${new Date(tzLastAppliedAt).toLocaleString('cs-CZ')}` : ''}
          {' '}· {tzText.length.toLocaleString('cs-CZ')} znaků. Vložený text bude při zavření uložen
          pro pozici {positionCode ?? tzPositionId}.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--r0-slate-600)' }}>
          Text z TZ (technická zpráva)
        </span>
        <button onClick={() => { setExpanded(false); setLastApplied(null); }}
          style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--r0-slate-400)', cursor: 'pointer' }}>
          Zavřít
        </button>
      </div>

      <textarea
        value={tzText}
        onChange={e => setTzText(e.target.value)}
        placeholder='Vložte úryvek z TZ... např. "Nosná konstrukce z betonu C35/45 XF2, rozpětí 15+4×20+15 m"'
        style={{
          width: '100%', minHeight: 60, maxHeight: 200, padding: '6px 8px',
          fontSize: 12, fontFamily: 'inherit', border: '1px solid var(--r0-slate-200)',
          borderRadius: 4, resize: 'vertical', boxSizing: 'border-box',
          background: 'white',
        }}
      />

      {/* Task 3: Secondary "add new fragment" textarea — only when TZ already saved */}
      {hasSavedTz && (
        <textarea
          value={secondaryText}
          onChange={e => setSecondaryText(e.target.value)}
          placeholder="Přidat nový text TZ (z jiného dokumentu, např. geologie)…"
          style={{
            width: '100%', minHeight: 40, maxHeight: 150, padding: '6px 8px',
            marginTop: 4, fontSize: 12, fontFamily: 'inherit',
            border: '1px dashed var(--r0-slate-300)', borderRadius: 4,
            resize: 'vertical', boxSizing: 'border-box',
            background: 'white',
          }}
        />
      )}

      {/* Char counter + 50k warning */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <span style={{
          fontSize: 10,
          color: overCap ? 'var(--r0-red-text, #991b1b)' : 'var(--r0-slate-400)',
          fontWeight: overCap ? 600 : 400,
        }}>
          {charCount.toLocaleString('cs-CZ')} / {TZ_MAX_CHARS.toLocaleString('cs-CZ')} znaků
          {overCap && ' — překračuje limit, zkraťte prosím text'}
        </span>
      </div>

      {extracted.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--r0-slate-600)', marginBottom: 4 }}>
            Nalezeno ({extracted.length} parametrů):
            {(triage.ignored.length + triage.conflicts.length) > 0 && (
              <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--r0-slate-400)' }}>
                {triage.applicable.length} použitelných · {triage.conflicts.length} konflikt · {triage.ignored.length} přeskočeno
              </span>
            )}
          </div>
          {extracted.map((p, i) => {
            const isApplicable = applicableNames.has(p.name);
            const ignoredEntry = triage.ignored.find(x => x.param.name === p.name);
            const conflictEntry = triage.conflicts.find(x => x.param.name === p.name);
            return (
              <label key={`${p.name}-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                color: isApplicable ? 'var(--r0-slate-700)' : 'var(--r0-slate-400)',
                cursor: isApplicable ? 'pointer' : 'not-allowed', padding: '1px 0',
                opacity: isApplicable || conflictEntry ? 1 : 0.5,
              }}>
                <input type="checkbox" checked={checked.has(p.name) && isApplicable}
                  disabled={!isApplicable && !conflictEntry}
                  onChange={() => toggleParam(p.name)} style={{ margin: 0 }} />
                <span style={{ opacity: p.confidence >= 1 ? 1 : 0.7 }}>
                  {p.label_cs}
                </span>
                {conflictEntry && (
                  <select
                    value={String(conflictChoice[p.name] ?? '')}
                    onChange={e => setConflictChoice(prev => ({
                      ...prev, [p.name]: e.target.value,
                    }))}
                    style={{
                      marginLeft: 4, fontSize: 10, padding: '0 4px',
                      border: '1px solid var(--r0-amber-border, #fcd34d)',
                      borderRadius: 3,
                    }}
                  >
                    <option value="">— vyberte —</option>
                    {conflictEntry.choices.map((c, j) => (
                      <option key={`c-${j}`} value={String(c)}>{String(c)}</option>
                    ))}
                  </select>
                )}
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

          {/* Task 3: "Přepsat existující hodnoty" checkbox */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginTop: 6, padding: '3px 6px', fontSize: 11,
            background: overwrite ? 'var(--r0-amber-bg, #fef3c7)' : 'transparent',
            border: overwrite ? '1px solid var(--r0-amber-border, #fcd34d)' : '1px solid transparent',
            borderRadius: 3,
            color: overwrite ? 'var(--r0-amber-text, #92400e)' : 'var(--r0-slate-600)',
            cursor: 'pointer',
          }}>
            <input type="checkbox"
              checked={overwrite}
              onChange={e => setOverwrite(e.target.checked)}
              style={{ margin: 0 }} />
            <span style={{ fontWeight: overwrite ? 600 : 400 }}>
              Přepsat existující hodnoty
            </span>
            {overwrite && (
              <span style={{ fontSize: 9, marginLeft: 'auto' }}>
                ⚠️ Ruční úpravy budou přepsány
              </span>
            )}
          </label>

          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <button
              onClick={applyParams}
              disabled={applyDisabled || overCap}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                background: applyDisabled || overCap
                  ? 'var(--r0-slate-200)'
                  : overwrite ? 'var(--r0-amber-text, #b45309)' : 'var(--r0-blue, #3b82f6)',
                color: applyDisabled || overCap ? 'var(--r0-slate-400)' : 'white',
                border: 'none', borderRadius: 4,
                cursor: applyDisabled || overCap ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {primaryBtnLabel} ({triage.applicable.filter(p => checked.has(p.name)).length})
            </button>
            <button
              onClick={handleClear}
              style={{
                padding: '4px 10px', fontSize: 11,
                background: 'none', border: '1px solid var(--r0-slate-300)',
                borderRadius: 4, cursor: 'pointer', color: 'var(--r0-slate-600)', fontFamily: 'inherit',
              }}
            >
              Vymazat TZ
            </button>
          </div>
        </div>
      )}

      {/* Post-apply feedback: 4-group split */}
      {lastApplied && (
        <div style={{ marginTop: 8, padding: '6px 8px',
          background: 'white', border: '1px solid var(--r0-slate-200)', borderRadius: 4 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, flexWrap: 'wrap' }}>
            <span style={{
              padding: '2px 6px', borderRadius: 3,
              background: 'var(--r0-emerald-bg, #d1fae5)',
              color: 'var(--r0-emerald-text, #065f46)', fontWeight: 600,
            }}>
              ✓ Přidáno: {lastApplied.added.length}
            </span>
            {lastApplied.kept.length > 0 && (
              <span style={{
                padding: '2px 6px', borderRadius: 3,
                background: 'var(--r0-slate-100, #f1f5f9)',
                color: 'var(--r0-slate-600)', fontWeight: 600,
              }}>
                = Zachováno: {lastApplied.kept.length}
              </span>
            )}
            {lastApplied.conflicts.length > 0 && (
              <span style={{
                padding: '2px 6px', borderRadius: 3,
                background: 'var(--r0-amber-bg, #fef3c7)',
                color: 'var(--r0-amber-text, #92400e)', fontWeight: 600,
              }}>
                ⚡ Konflikt: {lastApplied.conflicts.length}
              </span>
            )}
            {lastApplied.ignored.length > 0 && (
              <button
                onClick={() => setDetailsOpen(o => !o)}
                style={{
                  padding: '2px 6px', borderRadius: 3, border: 'none',
                  background: 'var(--r0-slate-100, #f1f5f9)',
                  color: 'var(--r0-slate-600)', fontWeight: 600, fontSize: 11,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                ⊘ Ignorováno: {lastApplied.ignored.length} {detailsOpen ? '▴' : '▾'}
              </button>
            )}
          </div>
          {detailsOpen && lastApplied.ignored.length > 0 && (
            <ul style={{ margin: '6px 0 0 0', paddingLeft: 16, fontSize: 10, color: 'var(--r0-slate-600)', lineHeight: 1.6 }}>
              {lastApplied.ignored.map((name, i) => {
                const entry = triage.ignored.find(x => x.param.name === name);
                return (
                  <li key={`ig-${i}`}>
                    <strong>{entry?.param.label_cs ?? name}</strong>
                    {entry ? ` — ${entry.reasonText}` : ''}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Task 3: History panel — last 5 applies */}
      {tzHistory.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setHistoryOpen(o => !o)}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: 10, color: 'var(--r0-slate-500)', cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Historie úprav ({tzHistory.length}) {historyOpen ? '▴' : '▾'}
          </button>
          {historyOpen && (
            <ol style={{
              margin: '4px 0 0 0', paddingLeft: 16, fontSize: 10,
              color: 'var(--r0-slate-600)', lineHeight: 1.6,
            }}>
              {[...tzHistory].reverse().map((h, i) => (
                <li key={`h-${i}`}>
                  <span style={{ color: 'var(--r0-slate-400)' }}>
                    {new Date(h.ts).toLocaleString('cs-CZ')}
                  </span>
                  {' · '}
                  <span style={{
                    textTransform: 'uppercase', fontSize: 9,
                    color: h.method === 'prepsat' ? 'var(--r0-amber-text, #92400e)' : 'var(--r0-blue-text, #1e40af)',
                  }}>
                    {h.method === 'prepsat' ? 'Přepsat' : 'Doplnit'}
                  </span>
                  {' · '}
                  {formatTzHistoryLine(h)}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
