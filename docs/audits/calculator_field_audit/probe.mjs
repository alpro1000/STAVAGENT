/**
 * SO-250 calculator engine probe — replays the user's UI session through
 * `planElement()` to reproduce + diagnose the bugs flagged in
 * `2026-05-14_full_ui_walkthrough.md` (#1 wrong type, #3 manual-override undo,
 * #4 D14 vs D12, #5 J1/J2/J3 hierarchy, #7 montage 6.99 d/záběr too high,
 * SANITY 18.1 M Kč for 837 m³).
 *
 * Two scenarios:
 *   1. **user_replay**  — exact form state described in the worksheet,
 *                         including the wrong-classification + obratkovost
 *                         layering that produced 18.1 M Kč and 928 d.
 *   2. **corrected**    — same physical wall, but cleaned up: correct
 *                         element_type (operne_zdi), no double-count of
 *                         num_identical_elements with num_dilatation_sections.
 *
 * Outputs: probe_result.json
 */

import { planElement } from '../../../Monolit-Planner/shared/dist/calculators/planner-orchestrator.js';
import { classifyElement } from '../../../Monolit-Planner/shared/dist/classifiers/element-classifier.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// ─── Common SO-250 facts (from test-data/SO_250/tz/SO-250.md briefing) ─────
// Geometrie: délka 515.20 m, base 0.56×2.75 m, dřík 0.45×(1.65–3.50) m.
// 42 dilatation cells: 40 × 12.50 m + 2 × 7.60 m.
// 4 betonáže: podkladní C12/15 / základ C25/30 / dřík C30/37 / římsa C30/37.
//
// The worksheet header claims 837.2 m³ + "ZÁKLADY ZE ŽB DO C25/30", and W2
// shows element_type = zaklady_piliru (BUG #1). The 837.2 m³ is consistent
// with the SUM of base + dřík + římsa for SO-250 (rough cross-check):
//   base    = 0.56 × 2.75 × 515.20             ≈  793   m³  (oversized — TZ
//                                                            quotes 700 m³
//                                                            for dřík only)
// So 837 m³ is plausibly "base ÷ řím ÷ dřík mixed" — the user is testing
// the engine, not validating the volume.

// Scenario 1 — exact replay of the worksheet
const user_replay = {
  // ── BUG #1: classifier returned wrong type. We pass it explicitly
  //    because the user observed "Element: zaklady_piliru (explicit)" in W2.
  element_type: 'zaklady_piliru',
  volume_m3: 837.2,

  // Geometry — user typed concrete volume directly; height for props/lateral
  // The wall is 515.2 m long but it's split into 42 sections — engine sees
  // one tact at a time. Average dřík height ≈ 2.65 m (1.65 + 3.50)/2 + 0.56
  // base ≈ 3.20 m. Tact volume ≈ 837 / 42 ≈ 19.93 m³.
  height_m: 3.20,
  formwork_area_m2: 622, // user-visible: "Plocha bednění: 621.5 m² per tact"

  // ── Dilatation hierarchy (Block A 2026-04) ──
  has_dilatation_joints: true,
  num_dilatation_sections: 42,
  tacts_per_section: 1,
  // Resulting totalTacts = 42 × 1 = 42 (matches W4 "42 sekcí × 1 záběrů/sekce = 42")

  // ── Obrátkovost (BUG #5 / #6: USER FILLED BOTH dilatation_sections AND
  //    num_identical_elements with 42 — engine multiplies, 928 d falls out)
  num_identical_elements: 42,
  formwork_sets_count: 6,

  // ── Resources (from worksheet) ──
  num_formwork_crews: 3,
  crew_size: 6,                 // → 18 tesařů (S4)
  num_rebar_crews: 3,
  crew_size_rebar: 2,           // → 6 železářů (S18)
  // num_sets vs formwork_sets_count: the calculator's `useCalculator.buildInput`
  // hook routes the J2 (visible) / J3 (worksheet value 6) into BOTH PlannerInput
  // slots — `num_sets` drives parallelism of the per-tact chess scheduler
  // (savings vs sequential), `formwork_sets_count` drives the obrátkovost
  // rotation. Setting num_sets=1 here would force 1× parallelism (which is
  // why an earlier draft of this probe got 520d instead of the worksheet's
  // 132d). Use 6 to match the user's UI state.
  num_sets: 6,

  shift_h: 12,                  // M1
  wage_czk_h: 398,              // M2

  // ── Concrete / curing ──
  concrete_class: 'C25/30',
  cement_type: 'CEM_I',
  temperature_c: 15,
  season: 'normal',
  curing_class: '3',
  // exposure handled via classes — worksheet didn't show explicit selection

  // ── Other context ──
  scheduling_mode_override: 'chess', // W7 "MANUAL → chess"
  working_joints_allowed: 'unknown', // Q2 warning in worksheet
  rebar_norm_kg_m3: 134,             // D10 worksheet "Funguje ✓ 134"
  rebar_mass_kg: 114156,             // D11 "Funguje ✓ 114156"
  // rebar_diameter_mm intentionally left empty — engine should pick the
  // element default. BUG #4 claim is that the UI labels this as D14 instead
  // of D12 (for walls). zaklady_piliru is a foundation (slabs_foundations
  // category, D20 default). The user's S19 shows "Norma 14 h/t" — that's
  // the h/t rate, not D14 diameter. Worksheet appears to have conflated
  // those two numbers; the probe will confirm.
};

// Scenario 2 — corrected (single wall, no obratkovost double-count)
const corrected = {
  ...user_replay,
  element_type: 'operne_zdi',         // ← BUG #1 fixed
  num_identical_elements: 1,          // ← BUG #5/#6 fixed (single continuous wall)
  formwork_sets_count: undefined,     // not relevant when N=1
};

// Scenario 3 — BUG #7 verification: identical to user_replay BUT WITHOUT
// the 622 m² user-supplied per-tact area. The new length-aware estimate
// should derive per-cell area from total_length_m + numTacts + height_m.
// total_length_m = 515.2 (worksheet F4), numTacts = 42, height_m = 0.56
// → L_per_cell = 12.27 m, W = 19.93 / (12.27 × 0.56) = 2.90 m,
// → area = 2(12.27 + 2.90) × 0.56 = 17 m² per cell (engineer-realistic).
const realistic_estimate = {
  ...user_replay,
  element_type: 'zaklady_oper',       // BUG #1 fix consumed
  num_identical_elements: 1,          // BUG #5/#6 fix consumed
  formwork_sets_count: undefined,
  formwork_area_m2: undefined,        // ← BUG #7: let estimate fire
  height_m: 0.56,                     // SO-250 base block height (not 3.20)
  total_length_m: 515.2,              // total wall length
};

// ─── Run both ──────────────────────────────────────────────────────────────

function summarise(label, input) {
  const t0 = Date.now();
  let out;
  try {
    out = planElement(input);
  } catch (e) {
    return { label, ERROR: e.message, stack: e.stack };
  }
  const t1 = Date.now();
  return {
    label,
    runtime_ms: t1 - t0,
    headlines: {
      element_type_reported: out.element_type,
      formwork_system: out.formwork?.system?.name,
      formwork_manufacturer: out.formwork?.system?.manufacturer,
      total_days_critical_path: out.schedule?.total_days,
      total_days_sequential: out.schedule?.sequential_days,
      savings_pct: out.schedule?.savings_pct,
      total_tacts: out.pour?.num_tacts,
      tact_volume_m3: out.pour?.tact_volume_m3,
      formwork_area_per_tact: out.formwork?.formwork_area_m2,
      formwork_assembly_days_per_tact: out.formwork?.assembly_days,
      formwork_disassembly_days_per_tact: out.formwork?.disassembly_days,
      formwork_curing_days: out.formwork?.curing_days,
      rebar_mass_kg: out.rebar?.mass_kg,
      rebar_duration_days: out.rebar?.duration_days,
      rebar_norm_h_per_t: out.rebar?.norm_h_per_t,
      rebar_used_diameter_mm: out.rebar?.used_diameter_mm,
      pour_crew_total: out.resources?.pour_crew_total ?? out.resources?.pour_crew_breakdown,
      num_pumps: out.pour?.pumps_required,
    },
    costs: out.costs,
    obratkovost: out.obratkovost,
    resource_ceiling: out.resource_ceiling,
    resource_violations: out.resource_violations,
    decision_log: out.decision_log,
    warnings: out.warnings,
    input,
  };
}

// ─── P0 BUG #1 classifier replay (2026-05-14) ──────────────────────────────
// Verifies the disambiguation rule: "Základy ze ŽB ... pro zárubní zeď"
// must classify as zaklady_oper, not zaklady_piliru. Compares 3 part_name
// variants the user might see in a real ŘSD soupis položek.
const classifier_replay = {
  so250_full_context: classifyElement('Základy ze ŽB do C25/30 pro zárubní zeď SO 250'),
  so250_opera_variant: classifyElement('Základy pro opěrnou zeď'),
  so250_kotvena_variant: classifyElement('Základy kotvené zdi'),
  plain_zaklady: classifyElement('Základy ze ŽB do C25/30'), // no wall context — falls back
  real_piliru: classifyElement('Základy pilířů P1-P4'),       // must stay zaklady_piliru
};

const result = {
  generated_at: '2026-05-14',
  branch: 'claude/calculator-field-audit',
  driver: 'test-data/SO_250/tz/SO-250.md',
  classifier_replay: Object.fromEntries(
    Object.entries(classifier_replay).map(([k, v]) => [
      k,
      { element_type: v.element_type, confidence: v.confidence, classification_source: v.classification_source },
    ]),
  ),
  scenarios: {
    user_replay: summarise('user_replay (BUG #1 + #5/#6 + #7-user-622)', user_replay),
    corrected:   summarise('corrected (operne_zdi, no double-count)', corrected),
    realistic_estimate: summarise('realistic_estimate (BUG #7 length-aware)', realistic_estimate),
  },
};

// Compute the two headline diffs the user asked about
const u = result.scenarios.user_replay;
const c = result.scenarios.corrected;
result.diff = {
  total_cost_czk_user:      u.costs?.total_all_czk,
  total_cost_czk_corrected: c.costs?.total_all_czk,
  cost_per_m3_user:         u.costs ? Math.round((u.costs.total_all_czk ?? 0) / 837.2) : null,
  cost_per_m3_corrected:    c.costs ? Math.round((c.costs.total_all_czk ?? 0) / 837.2) : null,
  total_days_user:          u.obratkovost?.total_duration_days ?? u.headlines.total_days_critical_path,
  total_days_corrected:     c.obratkovost?.total_duration_days ?? c.headlines.total_days_critical_path,
  rental_user:              u.costs?.formwork_rental_czk,
  rental_corrected:         c.costs?.formwork_rental_czk,
  rental_per_element_user:  u.obratkovost?.rental_per_element_czk,
};

const path = resolve(HERE, 'probe_result.json');
writeFileSync(path, JSON.stringify(result, null, 2) + '\n');
console.log('Wrote', path);

// Console summary
console.log('\n=== SO-250 classifier replay (P0 BUG #1) ===');
for (const [k, v] of Object.entries(result.classifier_replay)) {
  const marker =
    (k.startsWith('so250_') && v.element_type === 'zaklady_oper') ||
    (k === 'plain_zaklady' && v.element_type === 'zaklady_piliru') ||
    (k === 'real_piliru' && v.element_type === 'zaklady_piliru')
      ? '✓'
      : '✗';
  console.log(`  ${marker} ${k.padEnd(22)} → ${v.element_type.padEnd(20)} (conf ${v.confidence.toFixed(2)}, src ${v.classification_source})`);
}

console.log('\n=== SO-250 calculator engine probe ===\n');
for (const [k, s] of Object.entries(result.scenarios)) {
  console.log(`--- ${k} ---`);
  if (s.ERROR) { console.log('  ERROR:', s.ERROR); continue; }
  console.log('  element_type   :', s.headlines.element_type_reported);
  console.log('  formwork       :', s.headlines.formwork_system, '(' + s.headlines.formwork_manufacturer + ')');
  console.log('  total_days     :', s.headlines.total_days_critical_path, 'd  (sequential', s.headlines.total_days_sequential + 'd)');
  console.log('  formwork asm/d :', s.headlines.formwork_assembly_days_per_tact, '/tact');
  console.log('  rebar h/t      :', s.headlines.rebar_norm_h_per_t, '(D' + s.headlines.rebar_used_diameter_mm + ')');
  console.log('  cost labor     :', s.costs?.total_labor_czk?.toLocaleString('cs'), 'Kč');
  console.log('  cost rental    :', s.costs?.formwork_rental_czk?.toLocaleString('cs'), 'Kč');
  console.log('  cost total     :', s.costs?.total_all_czk?.toLocaleString('cs'), 'Kč');
  if (s.obratkovost) {
    console.log('  obratkovost    :', s.obratkovost.obratkovost + '×, total', s.obratkovost.total_duration_days, 'd');
  }
}
console.log('\n--- Headline diff ---');
console.log('  cost_per_m3   user:', result.diff.cost_per_m3_user, 'Kč/m³');
console.log('  cost_per_m3   fix :', result.diff.cost_per_m3_corrected, 'Kč/m³');
console.log('  total_days    user:', result.diff.total_days_user, 'd');
console.log('  total_days    fix :', result.diff.total_days_corrected, 'd');

// BUG #7 verification block
const ur = result.scenarios.user_replay;
const re = result.scenarios.realistic_estimate;
const totUser = (ur.costs?.total_labor_czk ?? 0) + (ur.costs?.formwork_rental_czk ?? 0);
const totReal = (re.costs?.total_labor_czk ?? 0) + (re.costs?.formwork_rental_czk ?? 0);
const fwLine = re.decision_log?.find((l) => l.startsWith('Formwork area:'));
const sanityFired = ur.warnings?.some((w) => w.includes('vysoko nad realistickým rozsahem'));
console.log('\n--- BUG #7 verification ---');
console.log('  user-supplied 622 m² (per tact)        →', totUser.toLocaleString('cs'), 'Kč total');
console.log('  length-aware estimate (realistic 17 m²)→', totReal.toLocaleString('cs'), 'Kč total');
console.log('  Ratio reduction                        →', (totUser / Math.max(totReal, 1)).toFixed(1) + '×');
console.log('  Estimate log line                      →', fwLine ?? '(not found)');
console.log('  Sanity warning fired on user_replay    →', sanityFired ? '✓ YES' : '✗ NO');
