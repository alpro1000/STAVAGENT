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
 *   4. User clicks "Převzít vše" or selects individual params
 *   5. Form pre-filled, ready for calculation
 */

import React, { useState, useEffect, useRef } from 'react';
import { extractFromText, type ExtractedParam } from '@stavagent/monolit-shared';
import type { FormState } from './types';

interface TzTextInputProps {
  tzText: string;
  setTzText: (v: string) => void;
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

/**
 * Params that only apply to specific element types.
 * Universal params (concrete_class, exposure_class, volume_m3, height_m) apply to ALL.
 */
const ELEMENT_SPECIFIC_PARAMS: Record<string, string[]> = {
  is_prestressed: ['mostovkova_deska', 'rigel'],
  prestress_tensioning: ['mostovkova_deska', 'rigel'],
  prestress_cables_count: ['mostovkova_deska', 'rigel'],
  prestress_strands_per_cable: ['mostovkova_deska', 'rigel'],
  span_m: ['mostovkova_deska', 'rigel'],
  num_spans: ['mostovkova_deska', 'rigel'],
  nk_width_m: ['mostovkova_deska'],
  bridge_deck_subtype: ['mostovkova_deska'],
  pile_diameter_mm: ['pilota'],
};

/** Check if an extracted param is relevant for the current element_type. */
function isRelevantForElement(paramName: string, elementType: string): boolean {
  const allowed = ELEMENT_SPECIFIC_PARAMS[paramName];
  if (!allowed) return true; // universal param
  return allowed.includes(elementType);
}

export function TzTextInput({ tzText, setTzText, form, update }: TzTextInputProps) {
  const [expanded, setExpanded] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedParam[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced extraction on text change
  useEffect(() => {
    if (!tzText.trim()) {
      setExtracted([]);
      setChecked(new Set());
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = extractFromText(tzText);
      setExtracted(params);
      setChecked(new Set(params.map(p => p.name)));
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [tzText]);

  const applyParams = (params: ExtractedParam[]) => {
    for (const p of params) {
      if (!checked.has(p.name)) continue;
      // Skip params not relevant for current element_type (e.g., prestress for základ)
      if (!isRelevantForElement(p.name, form.element_type)) continue;
      switch (p.name) {
        case 'element_type': update('element_type', p.value as any); break;
        case 'concrete_class': update('concrete_class', p.value as any); break;
        case 'exposure_class': update('exposure_class', String(p.value)); break;
        case 'volume_m3': update('volume_m3', Number(p.value)); break;
        case 'height_m': update('height_m', String(p.value)); break;
        case 'nk_width_m': update('nk_width_m', String(p.value)); break;
        case 'total_length_m': update('total_length_m', Number(p.value)); break;
        case 'span_m': update('span_m', String(p.value)); break;
        case 'num_spans': update('num_spans', String(p.value)); break;
        case 'is_prestressed': update('is_prestressed', Boolean(p.value)); break;
        case 'bridge_deck_subtype': update('bridge_deck_subtype', String(p.value)); break;
        case 'pile_diameter_mm': update('pile_diameter_mm', String(p.value)); break;
        case 'prestress_tensioning':
          // This field doesn't exist in FormState yet — skip for now
          break;
        case 'prestress_cables_count':
        case 'prestress_strands_per_cable':
        case 'thickness_mm':
          // These are informational — shown but not directly mappable to form fields
          break;
      }
    }
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

  return (
    <div style={{
      marginBottom: 10, padding: '8px 10px',
      background: 'var(--r0-slate-50, #f8fafc)',
      border: '1px solid var(--r0-slate-200, #e2e8f0)',
      borderRadius: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--r0-slate-600)' }}>
          Text z TZ (technická zpráva)
        </span>
        <button onClick={() => { setExpanded(false); setTzText(''); }}
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
          </div>
          {extracted.map((p, i) => {
            const relevant = isRelevantForElement(p.name, form.element_type);
            return (
              <label key={`${p.name}-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                color: relevant ? 'var(--r0-slate-700)' : 'var(--r0-slate-400)',
                cursor: 'pointer', padding: '1px 0',
                opacity: relevant ? 1 : 0.5,
              }}>
                <input type="checkbox" checked={checked.has(p.name) && relevant}
                  disabled={!relevant}
                  onChange={() => toggleParam(p.name)} style={{ margin: 0 }} />
                <span style={{ opacity: p.confidence >= 1 ? 1 : 0.7 }}>
                  {p.label_cs}
                </span>
                {!relevant && (
                  <span style={{ fontSize: 9, color: 'var(--r0-slate-400)' }}>
                    (jiný typ)
                  </span>
                )}
                {p.confidence < 1 && relevant && (
                  <span style={{ fontSize: 9, color: 'var(--r0-slate-400)' }}>
                    ({Math.round(p.confidence * 100)}%)
                  </span>
                )}
              </label>
            );
          })}
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <button
              onClick={() => applyParams(extracted)}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                background: 'var(--r0-blue, #3b82f6)', color: 'white',
                border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Převzít ({checked.size})
            </button>
            <button
              onClick={() => { setTzText(''); setExtracted([]); }}
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
    </div>
  );
}
