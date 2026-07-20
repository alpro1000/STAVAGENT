#!/usr/bin/env node
/**
 * Instrument self-check for the Stage-0 measurement harness.
 *
 * Runs the harness's exported functions against synthetic lines with KNOWN
 * outcomes and asserts the exact metrics. This tests the INSTRUMENT, not the
 * matching system — the stub matcher stands in for the pipeline, so this file
 * needs no node_modules, no SQLite, no network. Synthetic lines are legal here
 * precisely because they verify the meter; they are NOT corpus material.
 *
 * Run after ANY edit to run-corpus.mjs, before trusting new numbers:
 *   node eval/selfcheck.mjs        # exit 0 = instrument sane, exit 1 = broken
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseCorpus, runRows, computeMetrics, compare, METRIC_KEYS } from './run-corpus.mjs';

const failures = [];
let checks = 0;
function assert(cond, msg) {
  checks += 1;
  if (!cond) failures.push(msg);
}
function assertThrows(fn, needle, msg) {
  checks += 1;
  try {
    fn();
    failures.push(`${msg} — expected a throw, got none`);
  } catch (e) {
    if (needle && !String(e.message).includes(needle)) {
      failures.push(`${msg} — threw, but message lacks "${needle}": ${e.message}`);
    }
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-selfcheck-'));
const writeCorpus = (name, lines) => {
  const p = path.join(tmp, name);
  fs.writeFileSync(p, lines.join('\n') + '\n');
  return p;
};

try {
  // ------------------------------------------------------------------
  // 1. The five synthetic lines with known outcomes:
  //    sc-1 matches · sc-2 nonexistent (honest) · sc-3 wrong code (miss)
  //    sc-4 pipeline error · sc-5 exact code in text (legacy `code` field)
  // ------------------------------------------------------------------
  const corpusPath = writeCorpus('main.jsonl', [
    '// synthetic self-check corpus — instrument test, NOT ground truth',
    JSON.stringify({ id: 'sc-1', catalog: 'otskp', description: 'beton základů C25/30', unit: 'm3', quantity: 10, expected_code: '111111111', category: 'plain', source: 'selfcheck synthetic' }),
    JSON.stringify({ id: 'sc-2', catalog: 'otskp', description: 'práce která nemá kód', unit: 'ks', quantity: 1, expected_code: null, category: 'nonexistent', source: 'selfcheck synthetic' }),
    JSON.stringify({ id: 'sc-3', catalog: 'otskp', description: 'výztuž B500B do stěn', unit: 't', quantity: 2, expected_code: '222222222', category: 'plain', source: 'selfcheck synthetic' }),
    JSON.stringify({ id: 'sc-4', catalog: 'otskp', description: 'bednění stěn tl. 200 mm', unit: 'm2', quantity: 5, expected_code: '444444444', category: 'spec', source: 'selfcheck synthetic' }),
    JSON.stringify({ id: 'sc-5', catalog: 'otskp', description: 'položka 333333333 dle výkazu', unit: 'm3', quantity: 1, expected_code: '333333333', category: 'plain', source: 'selfcheck synthetic' }),
  ]);
  const rows = parseCorpus(corpusPath, { mode: 'otskp' });
  assert(rows.length === 5, `parseCorpus: expected 5 rows, got ${rows.length}`);
  assert(rows[0]._line === 2, `parseCorpus: file line numbers must count comment lines (got ${rows[0]._line}, want 2)`);

  const stub = async (text) => {
    if (text.includes('C25/30')) return [{ urs_code: '111111111', confidence: 0.9 }];
    if (text.includes('nemá kód')) return [];
    if (text.includes('B500B')) return [{ urs_code: '999999999', confidence: 0.8 }];
    if (text.includes('bednění')) throw new Error('synthetic pipeline failure');
    if (text.includes('333333333')) return [{ code: '333333333', confidence: 1.0 }]; // legacy field fallback
    return [];
  };
  const results = await runRows(rows, { matcher: stub });
  const m = computeMetrics(results);
  assert(m.n_lines === 5, `n_lines: ${m.n_lines} ≠ 5`);
  assert(m.n_errors === 1, `n_errors: ${m.n_errors} ≠ 1 (sc-4 must be an error row, not a miss)`);
  assert(m.n_input_filtered === 0, `n_input_filtered: ${m.n_input_filtered} ≠ 0`);
  assert(m.n_with_code === 3, `n_with_code: ${m.n_with_code} ≠ 3 (errored sc-4 must leave the denominator)`);
  assert(m.n_nonexistent === 1, `n_nonexistent: ${m.n_nonexistent} ≠ 1`);
  assert(m.top1_hit_rate === 0.6667, `top1_hit_rate: ${m.top1_hit_rate} ≠ 0.6667 (2 of 3)`);
  assert(m.candidate_recall === 0.6667, `candidate_recall: ${m.candidate_recall} ≠ 0.6667`);
  assert(m.fabrication_rate === 0, `fabrication_rate: ${m.fabrication_rate} ≠ 0`);
  assert(m.honest_skip_rate === 1, `honest_skip_rate: ${m.honest_skip_rate} ≠ 1`);
  assert(m.online_calls_per_position === 0, `online_calls_per_position: ${m.online_calls_per_position} ≠ 0`);
  const sc4 = results.find((r) => r.id === 'sc-4');
  assert(sc4.error !== undefined && sc4.category === 'spec' && sc4.expected_code === '444444444',
    'error row must keep category + expected_code (denominator integrity)');
  const sc5 = results.find((r) => r.id === 'sc-5');
  assert(sc5.top_code === '333333333', `legacy \`code\` field fallback broken: ${sc5.top_code}`);

  // ------------------------------------------------------------------
  // 2. Input-filter semantics: quality counts it as a miss, honesty excludes it
  // ------------------------------------------------------------------
  const fRows = [
    { id: 'f-1', description: 'CELKEM oddíl 3', expected_code: '555555555', category: 'plain', source: 's' },
    { id: 'f-2', description: 'zdivo nosné', expected_code: '666666666', category: 'plain', source: 's' },
    { id: 'f-3', description: 'SUMA', expected_code: null, category: 'nonexistent', source: 's' },
  ];
  const fResults = await runRows(fRows, {
    matcher: async () => [{ urs_code: '666666666', confidence: 0.9 }],
    skipCheck: (t) => (t === 'CELKEM oddíl 3' || t === 'SUMA' ? 'total-row' : null),
  });
  const fm = computeMetrics(fResults);
  assert(fm.n_input_filtered === 2, `filtered: n_input_filtered ${fm.n_input_filtered} ≠ 2`);
  assert(fm.top1_hit_rate === 0.5, `filtered with-code line must count as a production miss (top1 ${fm.top1_hit_rate} ≠ 0.5)`);
  assert(fm.fabrication_rate === null && fm.honest_skip_rate === null,
    'filtered nonexistent line must NOT count as matcher honesty (empty honesty pool → null)');

  // ------------------------------------------------------------------
  // 3. Parser rejections — each silent-corruption path must be a hard error
  // ------------------------------------------------------------------
  assertThrows(() => parseCorpus(writeCorpus('empty.jsonl', ['// only comments'])), 'no data lines', 'empty corpus must be rejected');
  assertThrows(() => parseCorpus(writeCorpus('typo.jsonl', [JSON.stringify({ id: 't1', description: 'x y z', expected_code: null, category: 'nonexistant', source: 's' })])), 'unknown category', 'category typo must be rejected');
  assertThrows(() => parseCorpus(writeCorpus('dup.jsonl', [
    JSON.stringify({ id: 'd1', description: 'a b c', expected_code: '1', category: 'plain', source: 's' }),
    JSON.stringify({ id: 'd1', description: 'd e f', expected_code: '2', category: 'plain', source: 's' }),
  ])), 'duplicate id', 'duplicate ids must be rejected');
  assertThrows(() => parseCorpus(writeCorpus('nullcode.jsonl', [JSON.stringify({ id: 'n1', description: 'x y z', expected_code: null, category: 'plain', source: 's' })])), 'requires category "nonexistent"', 'null code without nonexistent must be rejected');
  assertThrows(() => parseCorpus(writeCorpus('wrongcat.jsonl', [JSON.stringify({ id: 'w1', catalog: 'urs', description: 'x y z', expected_code: '1', category: 'plain', source: 's' })]), { mode: 'otskp' }), 'does not match --mode', 'catalog/mode mismatch must be rejected');
  assertThrows(() => parseCorpus(writeCorpus('nosource.jsonl', [JSON.stringify({ id: 's1', description: 'x y z', expected_code: '1', category: 'plain' })])), 'missing source', 'missing ground-truth provenance must be rejected');

  // ------------------------------------------------------------------
  // 4. compare(): identity guards, unmeasurable warning, drift, direction
  // ------------------------------------------------------------------
  const runShape = (over) => ({
    run: { corpus: 'c.jsonl', mode: 'otskp', otskp_catalog_version: 'OTSKP 2025', otskp_catalog_filename: 'f.xml', ...over.run },
    metrics: { n_errors: 0, n_input_filtered: 0, top1_hit_rate: 0.7, candidate_recall: 0.9, fabrication_rate: 0, honest_skip_rate: 1, online_calls_per_position: 0, ...over.metrics },
    results: over.results ?? [{ id: 'x1', expected_code: '1', top_code: '1' }],
  });
  assertThrows(() => compare(runShape({ run: { corpus: 'a.jsonl' } }), runShape({ run: { corpus: 'b.jsonl' } })), 'different corpora', 'cross-corpus compare must be rejected');
  assertThrows(() => compare(runShape({ run: {} }), runShape({ run: { mode: 'urs' } })), 'different modes', 'cross-mode compare must be rejected');
  const cmp = compare(
    runShape({ metrics: { fabrication_rate: null, honest_skip_rate: null, n_errors: 1 } }),
    runShape({ results: [{ id: 'x1', expected_code: '1', top_code: '2' }, { id: 'x2', expected_code: '3', top_code: '3' }] })
  );
  assert(cmp.warnings.some((w) => w.includes('fabrication_rate is UNMEASURABLE')), 'null fabrication_rate must raise an UNMEASURABLE warning, not read as no-change');
  assert(cmp.warnings.some((w) => w.includes('errored line')), 'n_errors > 0 must raise a warning');
  assert(cmp.warnings.some((w) => w.includes('corpus drift')), 'id drift must raise a warning');
  assert(cmp.only_in_b.includes('x2'), 'only_in_b must list drifted ids');
  assert(cmp.top_code_changed.some((c) => c.id === 'x1' && c.a_code === '1' && c.b_code === '2'), 'top_code_changed must report the flip');
  assert(cmp.metric_delta.fabrication_rate.direction.includes('RISE'), 'fabrication direction must warn on RISE, not on negative delta');
  assert(METRIC_KEYS.every((k) => k in cmp.metric_delta), 'every metric key must appear in the comparison');
} catch (e) {
  failures.push(`unexpected self-check crash: ${e.stack || e.message}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`SELF-CHECK FAIL — ${failures.length} of ${checks} assertions failed:`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
} else {
  console.error(`SELF-CHECK PASS — ${checks} assertions, instrument sane.`);
}
