#!/usr/bin/env node
// Human-readable report of the UWO interiér/PSV sandbox pipeline.
// Usage: node run.mjs            (pretty report)
//        node run.mjs --json     (machine JSON, e.g. to freeze the baseline)

import { runPipeline } from './src/pipeline.mjs';

const r = runPipeline();

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ cost: r.cost, gaps: r.gaps.map((g) => g.key), sanity_flags: r.sanity_flags }, null, 2));
  process.exit(0);
}

const kc = (n) => `${n.toLocaleString('cs-CZ')} Kč`;
const STATUS_MARK = { exact: '✓exact', candidate: '~cand', group_only: '≈grp', not_verified: '·n/v' };

console.log('\n=== UWO sandbox — Rekonstrukce mezonetu (interiér/PSV) ===\n');

console.log('[1] Scope-Router → branch:');
for (const s of r.routed) console.log(`    ${s.id.padEnd(4)} ${(s.route.branch ?? 'HONEST-BLANK').padEnd(13)} ${s.label}`);
console.log(`    branch_summary: ${JSON.stringify(r.branch_summary)}\n`);

console.log('[2+3] Work-atoms (Work-First) + catalog binding (Catalog-Last):');
let sec = null;
for (const a of r.work_atoms) {
  if (a.section_id !== sec) { sec = a.section_id; console.log(`  --- ${sec} ---`); }
  const b = a.catalog_binding;
  const mark = STATUS_MARK[b.status] || b.status;
  const code = b.code ? b.code : (b.family ? `oddíl ${b.family}` : '—');
  const gap = a.gap_vs_master ? ' [GAP vs mistr]' : '';
  const qty = a.quantity == null ? '?' : a.quantity;
  console.log(`   ${mark.padEnd(7)} ${a.work}`);
  console.log(`           ${qty} ${a.unit} × ${kc(a.rate_czk)} = ${kc(a.cost_czk)} · ${a.rate_source} · ${a.quantity_provenance} · kód:${code} (${b.confidence})${gap}`);
}

console.log('\n[!] Sanity flags (suspicious/false-plausible codes):');
for (const f of r.sanity_flags) console.log(`    ${f.kind.padEnd(17)} ${f.atom} → ${f.code} (${f.confidence}): ${f.issue}`);

console.log('\n[GAPS] Atoms the master omitted:');
for (const g of r.gaps) console.log(`    ${g.work} (${g.section_id}) ≈ ${kc(g.cost_czk)}`);

console.log('\n[4] Orientační cost:');
const c = r.cost;
console.log(`    Master offer (baseline ref):      ${kc(c.master_offer_total)}`);
console.log(`    UWO grand ORIENTAČNÍ:             ${kc(c.grand_orientacni)}`);
console.log(`      ↳ by rate_source: master ${kc(c.by_rate_source.master)} · rule_of_thumb ${kc(c.by_rate_source.rule_of_thumb)}`);
console.log(`      ↳ by status: candidate ${kc(c.by_status.candidate)} · group_only ${kc(c.by_status.group_only)} · not_verified ${kc(c.by_status.not_verified)}`);
console.log(`    not_verified value (NOT exact):   ${kc(c.not_verified_value)}`);
console.log(`    Δ vs mistr:                       ${kc(c.delta_vs_master)} (+${c.delta_vs_master_pct} %)`);
console.log(`    ${c.label}\n`);
