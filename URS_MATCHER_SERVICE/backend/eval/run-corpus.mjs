#!/usr/bin/env node
/**
 * Stage-0 catalog-matching measurement harness (SPEC §13).
 *
 * MEASUREMENT ONLY — this does not import into, or change, the matching
 * pipeline's behaviour. It drives the live matcher over a corpus of
 * human-confirmed (description → code) lines and reports the five §13 metrics,
 * per catalog.
 *
 * Two-baseline design (the point of Stage 0 now that the catalog version is a
 * knob): run the SAME corpus on the SAME code twice, changing only the env
 * (OTSKP_CATALOG_FILENAME / OTSKP_CATALOG_VERSION). The delta between the runs
 * is the answer to "what did the 36 new 2026 positions do" — which is otherwise
 * unknowable. Every result carries the catalog version it was produced under,
 * so the two runs are never confused (Alexander's correction to Stage 0).
 *
 * Usage:
 *   # baseline on the current-prod catalog (2025):
 *   node eval/run-corpus.mjs eval/corpus.otskp.jsonl > eval/results/otskp_2025.json
 *
 *   # same code, only env differs → the 2026 catalog:
 *   OTSKP_CATALOG_FILENAME=2026_otskp.xml OTSKP_CATALOG_VERSION="OTSKP 2026" \
 *     node eval/run-corpus.mjs eval/corpus.otskp.jsonl > eval/results/otskp_2026.json
 *
 *   # the delta (no pipeline needed, pure comparison of two saved runs):
 *   node eval/run-corpus.mjs --compare eval/results/otskp_2025.json eval/results/otskp_2026.json
 *
 * NB: the local OTSKP door reads the SQLite `urs_items` built by
 * import_otskp_to_sqlite.mjs, AND the in-memory otskpCatalogService — both are
 * driven by the same facade env. So before each run, rebuild the SQLite DB
 * under the chosen version (see eval/README.md). The online ÚRS door
 * (frontoffice) needs network egress and is measured where it is reachable;
 * offline it fails soft to [] and online_calls_per_position reflects that.
 *
 * Corpus line (JSONL), one JSON object per line — see corpus.schema.md:
 *   { id, catalog, description, unit, quantity, expected_code, category, source }
 *   category ∈ nodiacritics | spec | supply_volume | nonexistent | plain
 *   expected_code === null  ⇔  category "nonexistent" (no correct code exists)
 *   source = provenance of the ground truth (real estimate / human) — NEVER system output.
 */

import fs from 'fs';
import { OTSKP_CATALOG_VERSION } from '../src/config/otskpCatalog.js';

// ---------------------------------------------------------------------------
// online-call counter — a non-invasive global fetch spy (does not touch the
// pipeline). Counts outbound HTTP to the known online-catalog hosts so metric 5
// (calls per position) is measured without instrumenting matcher code.
// ---------------------------------------------------------------------------
const ONLINE_HOSTS = ['frontoffice-', '.run.app', 'perplexity', 'brave'];
let _onlineCalls = 0;
if (typeof globalThis.fetch === 'function') {
  const _origFetch = globalThis.fetch;
  globalThis.fetch = (url, ...rest) => {
    try {
      const u = typeof url === 'string' ? url : (url?.url ?? '');
      if (ONLINE_HOSTS.some((h) => u.includes(h))) _onlineCalls += 1;
    } catch { /* counting must never break a run */ }
    return _origFetch(url, ...rest);
  };
}

function parseCorpus(path) {
  const raw = fs.readFileSync(path, 'utf-8');
  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));
  return lines.map((l, i) => {
    let row;
    try { row = JSON.parse(l); } catch (e) { throw new Error(`corpus line ${i + 1}: invalid JSON — ${e.message}`); }
    if (!row.id) throw new Error(`corpus line ${i + 1}: missing id`);
    if (!row.description) throw new Error(`corpus line ${i + 1}: missing description`);
    if (!('expected_code' in row)) throw new Error(`corpus line ${i + 1} (${row.id}): missing expected_code (use null for a "nonexistent" line)`);
    if (row.category === 'nonexistent' && row.expected_code !== null) {
      throw new Error(`corpus line ${row.id}: category "nonexistent" must have expected_code: null`);
    }
    if (!row.source) throw new Error(`corpus line ${row.id}: missing source (ground-truth provenance is mandatory — real estimate / human, never system output)`);
    return row;
  });
}

async function runOne(matchUrsItems, row) {
  const before = _onlineCalls;
  let candidates = [];
  try {
    candidates = await matchUrsItems(row.description, row.quantity ?? 0, row.unit ?? 'ks');
  } catch (e) {
    return { id: row.id, error: e.message, top_code: null, candidate_codes: [], online_calls: _onlineCalls - before };
  }
  // defensive: best-first regardless of pipeline ordering
  const sorted = [...(candidates || [])].sort((a, b) => (b?.confidence ?? 0) - (a?.confidence ?? 0));
  const top = sorted[0] || null;
  return {
    id: row.id,
    category: row.category ?? 'plain',
    expected_code: row.expected_code ?? null,
    top_code: top?.code ?? null,
    top_confidence: top?.confidence ?? null,
    candidate_codes: sorted.map((c) => c?.code).filter(Boolean),
    online_calls: _onlineCalls - before,
  };
}

function computeMetrics(results) {
  const withCode = results.filter((r) => r.expected_code !== null);
  const nonexistent = results.filter((r) => r.category === 'nonexistent');
  const hit1 = withCode.filter((r) => r.top_code && r.top_code === r.expected_code).length;
  const recalled = withCode.filter((r) => r.candidate_codes.includes(r.expected_code)).length;
  const fabricated = nonexistent.filter((r) => r.top_code !== null).length;   // invented a code where none exists
  const honest = nonexistent.filter((r) => r.top_code === null).length;       // correctly returned nothing
  const totalOnline = results.reduce((s, r) => s + (r.online_calls || 0), 0);
  const pct = (n, d) => (d === 0 ? null : +(n / d).toFixed(4));
  return {
    n_lines: results.length,
    n_with_code: withCode.length,
    n_nonexistent: nonexistent.length,
    // §13 five metrics:
    top1_hit_rate: pct(hit1, withCode.length),          // общее качество
    candidate_recall: pct(recalled, withCode.length),   // стадия 2 (порождение кандидатов)
    fabrication_rate: pct(fabricated, nonexistent.length), // безопасность — измеримо ТОЛЬКО через nonexistent
    honest_skip_rate: pct(honest, nonexistent.length),  // честность
    online_calls_per_position: pct(totalOnline, results.length), // стоимость
  };
}

async function runCorpus(corpusPath) {
  const rows = parseCorpus(corpusPath);
  // lazy import: only run mode pulls in the pipeline (DB/XML side effects)
  const { matchUrsItems } = await import('../src/services/ursMatcher.js');
  const results = [];
  for (const row of rows) results.push(await runOne(matchUrsItems, row));
  return {
    run: {
      corpus: corpusPath,
      // catalog version this run was produced under — makes 2025 vs 2026 runs
      // distinguishable, which is why it is recorded here and not only in Stage 6.
      otskp_catalog_version: OTSKP_CATALOG_VERSION,
      otskp_catalog_filename: process.env.OTSKP_CATALOG_FILENAME || '2025_03_otskp.xml',
      node: process.version,
    },
    metrics: computeMetrics(results),
    results,
  };
}

function compare(pathA, pathB) {
  const a = JSON.parse(fs.readFileSync(pathA, 'utf-8'));
  const b = JSON.parse(fs.readFileSync(pathB, 'utf-8'));
  const keys = ['top1_hit_rate', 'candidate_recall', 'fabrication_rate', 'honest_skip_rate', 'online_calls_per_position'];
  const delta = {};
  for (const k of keys) {
    const va = a.metrics[k]; const vb = b.metrics[k];
    delta[k] = { a: va, b: vb, delta: va == null || vb == null ? null : +(vb - va).toFixed(4) };
  }
  // per-line code changes (where the emitted top code differs between versions)
  const byId = Object.fromEntries((a.results || []).map((r) => [r.id, r]));
  const changed = (b.results || [])
    .filter((r) => byId[r.id] && byId[r.id].top_code !== r.top_code)
    .map((r) => ({ id: r.id, expected: r.expected_code, a_code: byId[r.id].top_code, b_code: r.top_code }));
  return {
    a: { version: a.run.otskp_catalog_version, file: a.run.otskp_catalog_filename },
    b: { version: b.run.otskp_catalog_version, file: b.run.otskp_catalog_filename },
    metric_delta: delta,
    top_code_changed: changed,
    note: 'fabrication_rate must not rise; top1/recall are the improvement signal. A negative delta on any metric is a STOP-and-report per the task.',
  };
}

const argv = process.argv.slice(2);
if (argv[0] === '--compare') {
  if (argv.length !== 3) { console.error('usage: run-corpus.mjs --compare <runA.json> <runB.json>'); process.exit(2); }
  console.log(JSON.stringify(compare(argv[1], argv[2]), null, 2));
} else if (argv.length === 1) {
  runCorpus(argv[0]).then((out) => console.log(JSON.stringify(out, null, 2))).catch((e) => { console.error(e.stack || e.message); process.exit(1); });
} else {
  console.error('usage:\n  run-corpus.mjs <corpus.jsonl>\n  run-corpus.mjs --compare <runA.json> <runB.json>');
  process.exit(2);
}
