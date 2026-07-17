/**
 * tz-ai-extraction — the AI layer of the TZ smart input (2026-07-11,
 * Alexander: «Я за кнопку ии»).
 *
 * Extraction ladder (Determinism > AI, repo confidence rules):
 *   1. `extractFromText` regex/smeta pass — conf 1.0/0.9, runs as today;
 *   2. the «Doplnit pomocí AI» BUTTON asks the backend (→ CORE Vertex) to
 *      fill ONLY the gaps — every AI param arrives with a verbatim quote,
 *      capped at confidence 0.70, and NEVER overwrites a deterministic hit.
 *
 * This module is the pure, hermetic core shared by the frontend (merge +
 * validation before anything is shown) and the Monolit backend (prompt is
 * built server-side from the SAME manifest — one source for "what to
 * extract"; the future MCP consumer reads the same manifest, ADR-008 note).
 */

import {
  explainIncompatibility,
  REQUIRED_FIELDS,
  SANITY_RANGES,
} from '../classifiers/element-classifier.js';
import type { StructuralElementType } from '../calculators/pour-decision.js';
import type { ExtractedParam } from './tz-text-extractor.js';

// ─── Manifest: what the AI may extract, per element type ────────────────────

export interface AiFieldSpec {
  /** FormState / PlannerInput field name (must have a form writer). */
  field: string;
  label_cs: string;
  unit?: string;
  type: 'number' | 'boolean' | 'string' | 'string_array';
  /** Sanity range from SANITY_RANGES (when the engine defines one). */
  range?: [number, number];
}

/**
 * Universe = fields the TZ apply-flow can actually WRITE to the form
 * (TzTextInput.writeParamToForm) minus `element_type` (the AI must never
 * silently switch the element — too invasive) and minus single
 * `exposure_class` (the array form is the preferred engine API).
 */
const FIELD_DEFS: readonly Omit<AiFieldSpec, 'range'>[] = [
  { field: 'concrete_class', label_cs: 'Třída betonu', type: 'string' },
  { field: 'exposure_classes', label_cs: 'Třídy prostředí', type: 'string_array' },
  { field: 'volume_m3', label_cs: 'Objem betonu', unit: 'm³', type: 'number' },
  { field: 'height_m', label_cs: 'Výška', unit: 'm', type: 'number' },
  { field: 'formwork_area_m2', label_cs: 'Plocha bednění', unit: 'm²', type: 'number' },
  { field: 'total_length_m', label_cs: 'Délka', unit: 'm', type: 'number' },
  { field: 'span_m', label_cs: 'Rozpětí pole', unit: 'm', type: 'number' },
  { field: 'num_spans', label_cs: 'Počet polí', type: 'number' },
  { field: 'nk_width_m', label_cs: 'Šířka NK', unit: 'm', type: 'number' },
  { field: 'is_prestressed', label_cs: 'Předpjatý beton', type: 'boolean' },
  { field: 'bridge_deck_subtype', label_cs: 'Typ NK', type: 'string' },
  { field: 'pile_diameter_mm', label_cs: 'Průměr piloty', unit: 'mm', type: 'number' },
  // Tubus geometry (element 24, §2.10 explicit inputs) — 2026-07-17, Alexander
  // live finding «подсказка не всё вытянула из задания». Gated to the tubus
  // via ELEMENT_TZ_COMPATIBILITY (explainIncompatibility filter below); field
  // names match FormState/PlannerInput 1:1 (TzTextInput.writeParamToForm).
  { field: 'tubus_dc_count', label_cs: 'Počet dilatačních celků', type: 'number' },
  { field: 'tubus_section_length_m', label_cs: 'Délka sekce (dilatačního celku)', unit: 'm', type: 'number' },
  { field: 'tubus_clear_width_m', label_cs: 'Světlá šířka rámu', unit: 'm', type: 'number' },
  { field: 'tubus_clear_height_m', label_cs: 'Světlá výška rámu', unit: 'm', type: 'number' },
  { field: 'tubus_bottom_thickness_m', label_cs: 'Tloušťka spodní desky', unit: 'm', type: 'number' },
  { field: 'tubus_wall_thickness_m', label_cs: 'Tloušťka stěn', unit: 'm', type: 'number' },
  { field: 'tubus_top_thickness_m', label_cs: 'Tloušťka stropní desky', unit: 'm', type: 'number' },
];

const RANGE_FIELDS = ['volume_m3', 'height_m', 'formwork_area_m2'] as const;

/** Per-element extraction manifest: applicable fields + element-specific
 *  labels (REQUIRED_FIELDS wording, e.g. «Výška pilíře») + sanity ranges. */
export function buildExtractionManifest(element_type: StructuralElementType): AiFieldSpec[] {
  const required = REQUIRED_FIELDS[element_type] ?? [];
  const ranges = SANITY_RANGES[element_type] ?? {};
  return FIELD_DEFS
    .filter(def => explainIncompatibility(def.field, element_type) === null)
    .map(def => {
      const req = required.find(r => r.field === def.field);
      const range = (RANGE_FIELDS as readonly string[]).includes(def.field)
        ? (ranges as Record<string, [number, number] | undefined>)[def.field]
        : undefined;
      return {
        ...def,
        ...(req ? { label_cs: req.label_cs } : {}),
        ...(range ? { range } : {}),
      };
    });
}

// ─── Prompt (built server-side from the SAME manifest) ──────────────────────

export function buildAiExtractionPrompt(
  element_type: StructuralElementType,
  tz_text: string,
): string {
  const manifest = buildExtractionManifest(element_type);
  const fieldLines = manifest.map(f => {
    const unit = f.unit ? ` [${f.unit}]` : '';
    const range = f.range ? ` (obvykle ${f.range[0]}–${f.range[1]})` : '';
    return `- ${f.field}: ${f.label_cs}${unit}${range} — typ ${f.type}`;
  }).join('\n');
  // Truncation guard mirrors the advisor's 2000-char tz_excerpt discipline —
  // extraction needs more context, 6000 keeps the prompt bounded.
  const excerpt = tz_text.length > 6000 ? `${tz_text.slice(0, 6000)}…` : tz_text;
  return (
    `Jsi extraktor parametrů z technické zprávy (TZ) pro kalkulátor betonáže. ` +
    `Prvek: ${element_type}.\n\n` +
    `Z TEXTU NÍŽE vytáhni POUZE tato pole (pokud v textu skutečně jsou):\n${fieldLines}\n\n` +
    `PRAVIDLA:\n` +
    `1. NIKDY nefabrikuj — pole, které v textu není, VYNECH.\n` +
    `2. Ke KAŽDÉMU poli přilož "quote" = doslovná citace věty/úseku z textu, odkud hodnota pochází.\n` +
    `3. exposure_classes = pole řetězců (např. ["XF2","XD1","XC4"]).\n` +
    `4. Čísla vracej jako čísla (desetinná tečka), ne řetězce.\n` +
    `5. ODPOVĚZ POUZE VALIDNÍM JSON polem, žádný další text:\n` +
    `[{"field": "...", "value": ..., "quote": "...", "confidence": 0.0-1.0}]\n\n` +
    `TEXT TZ:\n${excerpt}`
  );
}

// ─── Merge guard: AI fills gaps, never overwrites, everything validated ─────

export interface AiRejectedParam {
  field: string;
  reason_cs: string;
}

export interface AiMergeResult {
  /** Validated AI params in ExtractedParam shape (source 'ai', conf ≤ 0.70,
   *  quote in matched_text) — ready for the existing triage/apply flow. */
  accepted: ExtractedParam[];
  rejected: AiRejectedParam[];
}

/** Repo confidence ladder: AI tier. */
export const AI_CONFIDENCE_CAP = 0.7;

export function mergeAiParams(
  deterministic: readonly ExtractedParam[],
  aiRaw: unknown,
  element_type: StructuralElementType,
): AiMergeResult {
  const accepted: ExtractedParam[] = [];
  const rejected: AiRejectedParam[] = [];
  if (!Array.isArray(aiRaw)) {
    return { accepted, rejected: [{ field: '*', reason_cs: 'AI nevrátila pole návrhů (formát).' }] };
  }
  const manifest = new Map(buildExtractionManifest(element_type).map(f => [f.field, f]));
  const already = new Set(deterministic.map(p => p.name));
  const seen = new Set<string>();

  for (const raw of aiRaw) {
    const item = raw as { field?: unknown; value?: unknown; quote?: unknown; confidence?: unknown };
    const field = typeof item?.field === 'string' ? item.field : '';
    if (!field) { rejected.push({ field: '?', reason_cs: 'Návrh bez jména pole.' }); continue; }
    if (seen.has(field)) { rejected.push({ field, reason_cs: 'Duplicitní návrh — první vyhrává.' }); continue; }
    seen.add(field);
    const spec = manifest.get(field);
    if (!spec) { rejected.push({ field, reason_cs: 'Pole není v manifestu pro tento typ prvku.' }); continue; }
    if (already.has(field)) {
      rejected.push({ field, reason_cs: 'Deterministická extrakce už hodnotu má — AI nikdy nepřepisuje.' });
      continue;
    }
    const quote = typeof item.quote === 'string' ? item.quote.trim() : '';
    if (!quote) { rejected.push({ field, reason_cs: 'Chybí citace z TZ — bez citace se návrh nezobrazuje.' }); continue; }

    // Type coercion + validation per manifest.
    let value: ExtractedParam['value'];
    if (spec.type === 'number') {
      const n = typeof item.value === 'number' ? item.value : Number(String(item.value).replace(',', '.'));
      if (!Number.isFinite(n)) { rejected.push({ field, reason_cs: 'Hodnota není číslo.' }); continue; }
      if (spec.range && (n < spec.range[0] || n > spec.range[1])) {
        rejected.push({
          field,
          reason_cs: `Hodnota ${n} mimo obvyklý rozsah ${spec.range[0]}–${spec.range[1]} — ověřte v TZ ručně.`,
        });
        continue;
      }
      value = n;
    } else if (spec.type === 'boolean') {
      value = item.value === true || item.value === 'true' || item.value === 'ano';
    } else if (spec.type === 'string_array') {
      const arr = Array.isArray(item.value)
        ? item.value.map(String)
        : String(item.value ?? '').split(/[+,\s]+/).filter(Boolean);
      if (arr.length === 0) { rejected.push({ field, reason_cs: 'Prázdný seznam hodnot.' }); continue; }
      value = arr.map(s => s.toUpperCase());
    } else {
      const s = String(item.value ?? '').trim();
      if (!s) { rejected.push({ field, reason_cs: 'Prázdná hodnota.' }); continue; }
      value = s;
    }

    const rawConf = typeof item.confidence === 'number' ? item.confidence : AI_CONFIDENCE_CAP;
    accepted.push({
      name: field,
      value,
      label_cs: spec.label_cs,
      confidence: Math.min(AI_CONFIDENCE_CAP, Math.max(0, rawConf)),
      source: 'ai',
      matched_text: quote,
    });
  }
  return { accepted, rejected };
}
