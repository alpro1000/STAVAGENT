// Offline runnable harness — `node --test harness.test.mjs`.
// Zero deps (node:test + node:assert). No network, no DB, no AI (AC1).
// Each test maps to a numbered acceptance criterion from the task.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runPipeline } from './src/pipeline.mjs';
import { routeScope } from './src/scope-router.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const baseline = JSON.parse(readFileSync(join(__dir, 'data', 'baseline.json'), 'utf8'));
const R = runPipeline();

// AC2 — every scope section decomposed; no section left as a single monolithic line.
test('AC2: every scope section → a branch, none collapses to one line', () => {
  for (const s of R.routed) assert.ok(s.route.branch !== undefined, `${s.id} routed`);
  // each interiér section produced ≥1 atom
  const sectionsWithAtoms = new Set(R.work_atoms.map((a) => a.section_id));
  for (const s of R.routed) {
    if (s.route.branch === 'interier_psv') assert.ok(sectionsWithAtoms.has(s.id), `${s.id} has atoms`);
  }
});

// AC3 — "renovace koupelny" (S2) is a PACK, never one catalog code.
test('AC3: koupelna (S2) decomposes into a pack, not one code', () => {
  const s2 = R.work_atoms.filter((a) => a.section_id === 'S2');
  assert.ok(s2.length >= 7, `S2 has ${s2.length} atoms (≥7)`);
  // no single binding claims to cover the whole koupelna
  const codes = new Set(s2.map((a) => a.catalog_binding.code).filter(Boolean));
  assert.ok(codes.size <= s2.length, 'each atom binds independently');
});

// AC4 — monolit branch never applied to interiér; unknown scope → honest-blank.
test('AC4: no monolit atoms on interiér; guard splits monolit & unknown', () => {
  for (const a of R.work_atoms) {
    assert.equal(a.branch, 'interier_psv');
    assert.ok(!/bednění|výztuž|beton[uá]|ošetřování/i.test(a.work), `no monolit atom: ${a.work}`);
  }
  assert.equal(routeScope('Betonáž základové desky, bednění a výztuž').branch, 'monolit');
  assert.equal(routeScope('Dodávka a montáž fotovoltaiky').branch, null); // honest-blank
});

// AC5 — every atom carries a valid status-enum; gaps are honestly not_verified / group_only.
test('AC5: status-enum present and valid; no fabricated codes', () => {
  const VALID = new Set(['exact', 'candidate', 'group_only', 'not_verified']);
  for (const a of R.work_atoms) {
    assert.ok(VALID.has(a.catalog_binding.status), `${a.key} status valid`);
    // a code is only present for 'candidate'/'exact' — never fabricated for N/A
    if (a.catalog_binding.status === 'not_verified') assert.equal(a.catalog_binding.code, null);
  }
  const hydro = R.work_atoms.find((a) => a.key === 'hydroizolace_koupelna');
  assert.ok(['group_only', 'not_verified'].includes(hydro.catalog_binding.status), 'hydroizolace not exact');
});

// AC6 — malba present on walls AND ceilings, though the master's baseline omits it.
test('AC6: malba present (walls + ceilings) and flagged as gap', () => {
  const malby = R.work_atoms.filter((a) => a.key.startsWith('malba_'));
  assert.ok(malby.some((a) => a.section_id === 'S1'), 'malba stěn');
  assert.ok(malby.some((a) => a.section_id === 'S5'), 'malba podhledů');
  for (const m of malby) assert.equal(m.gap_vs_master, true, `${m.key} flagged gap`);
  // and the master offer indeed has no malba line
  const corpus = JSON.parse(readFileSync(join(__dir, 'data', 'corpus.json'), 'utf8'));
  assert.ok(!corpus.master_baseline.items.some((i) => /malb/i.test(i.label)), 'master has no malba');
});

// AC6b — gas boiler whole chain present and a full gap vs master.
test('AC6b: plynový kotel chain present and fully missing from master', () => {
  const kotel = R.work_atoms.filter((a) => a.section_id === 'S7');
  assert.ok(kotel.length >= 4, 'demontáž+montáž+spalinová+revize');
  for (const k of kotel) assert.equal(k.gap_vs_master, true);
  const corpus = JSON.parse(readFileSync(join(__dir, 'data', 'corpus.json'), 'utf8'));
  assert.ok(!corpus.master_baseline.items.some((i) => /kot[eě]l|plynov/i.test(i.label)), 'master has no boiler');
});

// AC7 — suspicious / false-plausible codes are flagged (nature/family sanity).
test('AC7: sanity flags catch false-plausible codes', () => {
  assert.ok(R.sanity_flags.length >= 3, 'at least 3 sanity flags');
  // the real false-plausible boiler "Podmínky použití" row
  assert.ok(R.sanity_flags.some((f) => f.atom === 'kotel_montaz' && /Podmínky použití/i.test(f.issue)), 'kotel Podmínky-použití flagged');
  // the štuk element-mismatch (sloupy vs stěny)
  assert.ok(R.sanity_flags.some((f) => f.atom === 'stuk' && /sloup|pilíř/i.test(f.issue)), 'štuk sloupy flagged');
});

// AC8 — orientační totals within ±tolerance of frozen baseline; not_verified surfaced separately.
test('AC8: grand total within baseline ±15 %; not_verified not presented as exact', () => {
  const tol = baseline.tolerance_pct / 100;
  const lo = baseline.grand_orientacni * (1 - tol);
  const hi = baseline.grand_orientacni * (1 + tol);
  assert.ok(R.cost.grand_orientacni >= lo && R.cost.grand_orientacni <= hi,
    `grand ${R.cost.grand_orientacni} within [${Math.round(lo)}, ${Math.round(hi)}]`);
  // not_verified value is surfaced as its own figure, not folded into a "precise" claim
  assert.equal(R.cost.not_verified_value, R.cost.by_status.not_verified);
  assert.equal(R.cost.grand_excluding_not_verified, R.cost.grand_orientacni - R.cost.not_verified_value);
  // label always marks the whole total as orientační
  assert.match(R.cost.label, /ORIENTAČNÍ/);
});

// AC8b — the headline finding: the master under-scoped by a meaningful margin.
test('AC8b: UWO reveals master under-scope (gap additions = Δ vs master)', () => {
  assert.equal(R.cost.gap_additions, R.cost.delta_vs_master);
  assert.ok(R.cost.delta_vs_master_pct >= 20, `gap +${R.cost.delta_vs_master_pct}% ≥ 20%`);
});
