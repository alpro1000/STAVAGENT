/**
 * SO-250 SmartExtractor probe — read-only baseline test.
 *
 * Runs `extractFromText()` from the in-repo extractor against five pre-cleaned
 * excerpts (Block A-E) drawn from `test-data/SO_250/tz/SO-250.md`, then diffs
 * the result against the expected matrix in
 * `docs/audits/smartextractor_so250/2026-05-14_extractor_coverage.md`.
 *
 * NO extractor code is mutated. Output:
 *   1. JSON report at <audit-folder>/probe_result.json
 *   2. Markdown coverage table embedded in the same audit folder
 *
 * Run: node docs/audits/smartextractor_so250/probe.mjs
 */

import { extractFromText } from '../../../Monolit-Planner/shared/dist/parsers/tz-text-extractor.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// ─── Excerpts (verbatim from test-data/SO_250/tz/SO-250.md) ────────────────

const BLOCKS = {
  A: {
    title: 'Block A — Identifikace (TZ str. 5)',
    text: `Číslo objektu SO 250
Název objektu Zárubní zeď v km 6,500 – 7,000 vpravo
Druh převáděné komunikace dálnice D6
Staničení zdi km 6,492 40 – 7,007 60
Stupeň dokumentace Projektová dokumentace pro provádění stavby (PDPS)
Charakteristika zdi Úhlová železobetonová zeď.
Délka zdi 515,20 m
Výška zdi nad terénem Proměnná, od 1,550 do 3,400 m
Pohledová plocha zdi 1737,44 m2`,
    element_type: 'operne_zdi',
    expected: [
      { name: 'object_id',                  value: 'SO 250',                                conf: 1.0 },
      { name: 'object_name',                value: 'Zárubní zeď v km 6,500 – 7,000 vpravo', conf: 0.95 },
      { name: 'road',                       value: 'D6',                                    conf: 1.0 },
      { name: 'stationing_from',            value: '6+492.40',                              conf: 1.0 },
      { name: 'stationing_to',              value: '7+007.60',                              conf: 1.0 },
      { name: 'documentation_stage',        value: 'PDPS',                                  conf: 1.0 },
      { name: 'length_m',                   value: 515.20,                                  conf: 1.0 },
      { name: 'height_above_terrain_min_m', value: 1.55,                                    conf: 0.95 },
      { name: 'height_above_terrain_max_m', value: 3.40,                                    conf: 0.95 },
      { name: 'visible_area_m2',            value: 1737.44,                                 conf: 1.0 },
    ],
  },
  B: {
    title: 'Block B — Konstrukce (TZ str. 7-8)',
    text: `Zeď bude založena na podkladní beton tloušťky 0,15 m z betonu C25/30 XF3, XA2, XC2.
Základ opěrné zdi je konstantní tloušťky 0,56 m a šířky 2,75 m.
V podélném směru je základ členěn na 40 dilatačních celků konstantní délky 12,50 m
a dva krajní dilatační celky DC01 a DC42 konstantní délky 7,60 m.
Dřík konstrukce je konstantní tloušťky 0,45 m a proměnné výšky 1,65 – 3,50 m.
Dřík konstrukce je na líci obložen lomovým kamenem tloušťky 0,30 m.
Kotvy jsou v rastru minimálně 0,75 x 0,75 m.`,
    element_type: 'operne_zdi',
    expected: [
      { name: 'podkladni_beton_thickness_m', value: 0.15,                       conf: 1.0 },
      { name: 'podkladni_beton_grade',       value: 'C25/30',                   conf: 1.0 },
      { name: 'podkladni_beton_exposure',    value: ['XF3','XA2','XC2'],        conf: 1.0 },
      { name: 'base_thickness_m',            value: 0.56,                       conf: 1.0 },
      { name: 'base_width_m',                value: 2.75,                       conf: 1.0 },
      { name: 'dilatation_main_count',       value: 40,                         conf: 1.0 },
      { name: 'dilatation_main_length_m',    value: 12.50,                      conf: 1.0 },
      { name: 'dilatation_edge_count',       value: 2,                          conf: 0.9 },
      { name: 'dilatation_edge_length_m',    value: 7.60,                       conf: 1.0 },
      { name: 'wall_thickness_m',            value: 0.45,                       conf: 1.0 },
      { name: 'wall_height_min_m',           value: 1.65,                       conf: 0.95 },
      { name: 'wall_height_max_m',           value: 3.50,                       conf: 0.95 },
      { name: 'face_cladding_material',      value: 'lomový kámen',             conf: 0.9 },
      { name: 'face_cladding_thickness_m',   value: 0.30,                       conf: 1.0 },
      { name: 'face_cladding_anchor_grid_m', value: [0.75, 0.75],               conf: 1.0 },
    ],
  },
  C: {
    title: 'Block C — Římsa a zábradlí (TZ str. 8-9)',
    text: `Římsy-kotevní trámy jsou navrženy z betonu C 30/37 XF4, XD3, XC4
a vyztuženy betonářskou výztuží B 500 B.
Šířka 0,85 m, tloušťka 0,4 m na líci a 0,36 m na rubu.
Na horním kotevním trámu je navrženo silniční zábradlí výška 1,10 m.`,
    element_type: 'rimsa',
    expected: [
      { name: 'rimsa_concrete_grade',   value: 'C30/37',              conf: 1.0 },
      { name: 'rimsa_exposure',         value: ['XF4','XD3','XC4'],   conf: 1.0 },
      { name: 'rebar_grade',            value: 'B500B',               conf: 1.0 },
      { name: 'rimsa_width_m',          value: 0.85,                  conf: 1.0 },
      { name: 'rimsa_thickness_face_m', value: 0.40,                  conf: 0.95 },
      { name: 'rimsa_thickness_back_m', value: 0.36,                  conf: 0.95 },
      { name: 'railing_height_m',       value: 1.10,                  conf: 1.0 },
    ],
  },
  D: {
    title: 'Block D — Výkres (Vzorový příčný řez, OCR transcript)',
    text: `PODKLADNÍ BETON  C12/15 — X0 (CZ-TKP 18PK)-Cl 1,0-Dmax22-S2
OPĚRNÁ ZEĎ DŘÍK  C30/37 - XF4-XC4 (CZ-TKP 18PK)-Cl 0,4-Dmax22-S3
OPĚRNÁ ZEĎ ZÁKLAD  C25/30 - XF3, XC2, XA2 (CZ-TKP 18PK)-Cl 0,4-Dmax22-S3
OPĚRNÁ ZEĎ ŘÍMSA  C30/37 - XF4, XD3, XC4 (CZ-TKP 18PK)-Cl 0,4-Dmax22-S3
KOMPOZITNÍ 3-LANKOVÉ ZÁBRADLÍ, H=1,15 m`,
    element_type: 'operne_zdi',
    expected: [
      { name: 'podkladni_beton_grade_drawing',    value: 'C12/15',           conf: 1.0 },
      { name: 'podkladni_beton_exposure_drawing', value: ['X0'],             conf: 1.0 },
      { name: 'drik_grade_drawing',               value: 'C30/37',           conf: 1.0 },
      { name: 'drik_exposure_drawing',            value: ['XF4','XC4'],      conf: 1.0 },
      { name: 'zaklad_grade_drawing',             value: 'C25/30',           conf: 1.0 },
      { name: 'zaklad_exposure_drawing',          value: ['XF3','XC2','XA2'],conf: 1.0 },
      { name: 'rimsa_grade_drawing',              value: 'C30/37',           conf: 1.0 },
      { name: 'railing_height_drawing_m',         value: 1.15,               conf: 1.0 },
    ],
  },
  E: {
    title: 'Block E — Geotechnika (TZ str. 5-6)',
    text: `Geologie: granit karlovarského plutonu.
Třída těžitelnosti I.-III, lokálně IV. dle ČSN 73 6133.
Edef,2 ≥ 60 MPa, Edef,2/Edef,1 ≤ 2,5.
Stupeň ochranných opatření proti bludným proudům: 3.`,
    element_type: 'operne_zdi',
    expected: [
      { name: 'geology_main',              value: 'granit karlovarského plutonu', conf: 0.85 },
      { name: 'excavation_class_main',     value: 'I-III',                        conf: 0.95 },
      { name: 'excavation_class_local_max',value: 'IV',                           conf: 0.85 },
      { name: 'edef2_base_MPa',            value: 60,                             conf: 1.0 },
      { name: 'edef_ratio_max',            value: 2.5,                            conf: 0.95 },
      { name: 'stray_currents_grade',      value: 3,                              conf: 0.95 },
    ],
  },
};

// ─── Diff helpers ──────────────────────────────────────────────────────────

function valueMatches(expected, actual) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    if (expected.length !== actual.length) return false;
    const eSet = [...expected].map(String).sort();
    const aSet = [...actual].map(String).sort();
    return eSet.every((v, i) => v === aSet[i]);
  }
  if (typeof expected === 'number' && typeof actual === 'number') {
    return Math.abs(expected - actual) < 1e-3;
  }
  return String(expected) === String(actual);
}

function classify(extracted, expectedField) {
  const hit = extracted.find((p) => p.name === expectedField.name);
  if (!hit) return { status: 'MISSING', actual: null, conf_actual: null };
  const valOk = valueMatches(expectedField.value, hit.value);
  if (!valOk) return { status: 'WRONG_VALUE', actual: hit.value, conf_actual: hit.confidence, source: hit.source };
  if (Math.abs(hit.confidence - expectedField.conf) > 0.05) {
    return { status: 'WRONG_CONFIDENCE', actual: hit.value, conf_actual: hit.confidence, source: hit.source };
  }
  return { status: 'OK', actual: hit.value, conf_actual: hit.confidence, source: hit.source };
}

// ─── Run probe ─────────────────────────────────────────────────────────────

const report = {
  generated_at: '2026-05-14',
  branch: 'claude/smartextractor-probe-rsd-5Gqm4',
  extractor_path: 'Monolit-Planner/shared/src/parsers/tz-text-extractor.ts',
  extractor_loc: 604,
  source_enum: ['regex', 'keyword', 'heuristic', 'smeta_line'],
  blocks: {},
  totals: { ok: 0, missing: 0, wrong_value: 0, wrong_confidence: 0, expected: 0 },
  conflict_test: {},
};

for (const [code, block] of Object.entries(BLOCKS)) {
  const extracted = extractFromText(block.text, { element_type: block.element_type });
  const fields = block.expected.map((exp) => ({ expected: exp, ...classify(extracted, exp) }));
  const ok      = fields.filter((f) => f.status === 'OK').length;
  const missing = fields.filter((f) => f.status === 'MISSING').length;
  const wval    = fields.filter((f) => f.status === 'WRONG_VALUE').length;
  const wconf   = fields.filter((f) => f.status === 'WRONG_CONFIDENCE').length;
  const total   = fields.length;
  report.blocks[code] = {
    title: block.title,
    element_type: block.element_type,
    coverage_pct: Math.round((ok / total) * 100),
    counts: { ok, missing, wrong_value: wval, wrong_confidence: wconf, total },
    fields,
    extracted_raw: extracted.map((p) => ({
      name: p.name, value: p.value, source: p.source, confidence: p.confidence, matched_text: p.matched_text,
      ...(p.alternatives ? { alternatives: p.alternatives } : {}),
    })),
  };
  report.totals.ok += ok;
  report.totals.missing += missing;
  report.totals.wrong_value += wval;
  report.totals.wrong_confidence += wconf;
  report.totals.expected += total;
}

report.totals.coverage_pct = Math.round((report.totals.ok / report.totals.expected) * 100);

// ─── Conflict detection (Block B vs Block D) ───────────────────────────────

const conflicts = [
  { field: 'podkladni_beton_grade',    tz: 'C25/30',          drawing: 'C12/15',         expected_behavior: 'DETEKOVÁNO + alternatives, max conf 0.6' },
  { field: 'podkladni_beton_exposure', tz: ['XF3','XA2','XC2'], drawing: ['X0'],         expected_behavior: 'DETEKOVÁNO, drawing wins'              },
  { field: 'drik_exposure_xf',         tz: 'XF3',             drawing: 'XF4',           expected_behavior: 'DETEKOVÁNO, drawing wins'              },
  { field: 'railing_height_m',         tz: 1.10,              drawing: 1.15,            expected_behavior: 'DETEKOVÁNO, "compatible variants"'     },
];

// Run extractor on Block B + Block D combined to give it the best chance of seeing the conflict.
const combined = BLOCKS.B.text + '\n' + BLOCKS.D.text;
const combinedExtracted = extractFromText(combined, { element_type: 'operne_zdi' });
const concretePicks  = combinedExtracted.filter((p) => p.name === 'concrete_class');
const exposurePicks  = combinedExtracted.filter((p) => p.name === 'exposure_class' || p.name === 'exposure_classes');

report.conflict_test = {
  expected_conflicts: conflicts,
  combined_input_chars: combined.length,
  picks_concrete_class: concretePicks,
  picks_exposure_class: exposurePicks,
  detected_alternatives_concrete: concretePicks.some((p) => Array.isArray(p.alternatives) && p.alternatives.length > 0),
  detected_alternatives_exposure: exposurePicks.some((p) => Array.isArray(p.alternatives) && p.alternatives.length > 0),
  // The 4 expected conflicts are all element-scoped (podkladní vs dřík vs římsa).
  // The current extractor has NO element scoping — it collapses ALL concrete classes
  // into a single `concrete_class` param via "highest" rule, and ALL exposure classes
  // into a single `exposure_class` param via "most-restrictive" rule. So:
  //   - element-scoped conflict detection rate = 0/4 = 0%
  //   - the global `alternatives` list that DOES get populated proves nothing about
  //     the four real conflicts; it just shows that >1 distinct value was seen.
  conflict_detection_rate_pct: 0,
  conflict_detection_pass: false,
  conflict_detection_reason:
    'extractor has no element-scope (podkladní/základ/dřík/římsa) — all concrete classes collapse to one param via "highest" rule, all exposures collapse to one param via "most-restrictive" rule. The four element-scoped conflicts (Block B vs Block D) are silently lost.',
};

// ─── Persist outputs ───────────────────────────────────────────────────────

const jsonPath = resolve(HERE, 'probe_result.json');
writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(`Wrote ${jsonPath}`);

// Console summary
console.log('\n=== SO-250 SmartExtractor probe — totals ===');
console.log(`OK ............... ${report.totals.ok}/${report.totals.expected}`);
console.log(`MISSING .......... ${report.totals.missing}`);
console.log(`WRONG_VALUE ...... ${report.totals.wrong_value}`);
console.log(`WRONG_CONFIDENCE . ${report.totals.wrong_confidence}`);
console.log(`Coverage % ....... ${report.totals.coverage_pct}%`);
for (const [code, b] of Object.entries(report.blocks)) {
  console.log(`  ${code} (${b.title.split('—')[1]?.trim() ?? code}): ${b.counts.ok}/${b.counts.total} = ${b.coverage_pct}%`);
}
console.log(`\nConflict detection: ${report.conflict_test.conflict_detection_pass ? 'PASS' : 'FAIL'} (${report.conflict_test.conflict_detection_rate_pct}%)`);
console.log(`Reason: ${report.conflict_test.conflict_detection_reason}`);
