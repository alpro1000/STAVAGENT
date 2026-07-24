#!/usr/bin/env node
/**
 * Stage-0 catalog-matching measurement harness (SPEC §13).
 *
 * Measurement only: it drives the live matcher over a corpus of human-confirmed
 * (description → code) lines and reports the five §13 metrics per catalog.
 * All run/compare commands and the corpus schema live in eval/README.md — the
 * README is the single source for the protocol; this header intentionally
 * repeats none of it.
 *
 * Isolation (not operator discipline): a run REQUIRES an explicit --db pointing
 * at a per-catalog-version eval DB (built by scripts/import_otskp_to_sqlite.mjs
 * --db …), sets URS_LEARNING=0 so the learned-mappings layer neither answers
 * from cache nor writes (run A cannot poison run B), silences pipeline INFO
 * logs off stdout, and records a DB fingerprint (resolved path + row count,
 * with a floor that rejects the auto-seeded 36-item toy DB).
 *
 * Explicit measurement mode: --mode otskp disables the frontoffice ÚRS door
 * (URS_FRONTOFFICE_SEARCH=0) so the 2025-vs-2026 OTSKP delta measures the
 * catalog, not the network; --mode urs leaves it on. The mode and every
 * behaviour-determining knob are stamped into the run record so two runs are
 * never confused.
 *
 * Instrument verification: eval/selfcheck.mjs runs this harness's exported
 * functions against synthetic lines with known outcomes. Run it after ANY edit
 * to this file, before trusting new numbers.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  OTSKP_CATALOG_FILENAME,
  OTSKP_CATALOG_VERSION,
} from '../src/config/otskpCatalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// work_vs_material: montáž ↔ dodávka pairs (different descriptions, different codes).
// supply_volume stays RESERVED for the Stage-4 case (SAME description, different
// code by scope of supply) — the Vidímova source contained 0 such lines.
export const CATEGORIES = ['plain', 'nodiacritics', 'spec', 'work_vs_material', 'supply_volume', 'nonexistent'];

// The five §13 metrics — single list shared by computeMetrics and compare so a
// new metric cannot silently drop out of the go/no-go comparison.
export const METRIC_KEYS = [
  'top1_hit_rate',
  'candidate_recall',
  'fabrication_rate',
  'honest_skip_rate',
  'online_calls_per_position',
];

// Per-metric regression direction for the STOP rule. fabrication RISING is the
// danger (a negative fabrication delta is an improvement); quality/honesty
// metrics regress by DROPPING; online calls are informational cost.
export const METRIC_DIRECTION = {
  top1_hit_rate: 'drop = regression (STOP)',
  candidate_recall: 'drop = regression (STOP)',
  fabrication_rate: 'RISE = regression (STOP); drop is an improvement',
  honest_skip_rate: 'drop = regression (STOP)',
  online_calls_per_position: 'informational (cost)',
};

// ---------------------------------------------------------------------------
// Corpus parsing — validation is the instrument's first stage. Real FILE line
// numbers are kept for error messages (comment/blank lines count).
// ---------------------------------------------------------------------------
export function parseCorpus(filePath, { mode } = {}) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const rows = [];
  const seenIds = new Set();
  raw.split('\n').forEach((line, idx) => {
    const fileLine = idx + 1;
    const l = line.trim();
    if (!l || l.startsWith('//')) {return;}
    let row;
    try {
      row = JSON.parse(l);
    } catch (e) {
      throw new Error(`${filePath}:${fileLine}: invalid JSON — ${e.message}`);
    }
    if (!row.id) {throw new Error(`${filePath}:${fileLine}: missing id`);}
    if (seenIds.has(row.id)) {throw new Error(`${filePath}:${fileLine}: duplicate id "${row.id}"`);}
    seenIds.add(row.id);
    if (!row.description) {throw new Error(`${filePath}:${fileLine} (${row.id}): missing description`);}
    if (!('expected_code' in row)) {
      throw new Error(`${filePath}:${fileLine} (${row.id}): missing expected_code (use null for a "nonexistent" line)`);
    }
    const category = row.category ?? 'plain';
    if (!CATEGORIES.includes(category)) {
      throw new Error(`${filePath}:${fileLine} (${row.id}): unknown category "${row.category}" (allowed: ${CATEGORIES.join(', ')})`);
    }
    // Both directions of the nonexistent⇔null pairing — a null code with a
    // typo'd category would otherwise fall out of EVERY metric bucket silently.
    if (category === 'nonexistent' && row.expected_code !== null) {
      throw new Error(`${filePath}:${fileLine} (${row.id}): category "nonexistent" must have expected_code: null`);
    }
    if (row.expected_code === null && category !== 'nonexistent') {
      throw new Error(`${filePath}:${fileLine} (${row.id}): expected_code null requires category "nonexistent"`);
    }
    if (!row.source) {
      throw new Error(`${filePath}:${fileLine} (${row.id}): missing source (ground-truth provenance is mandatory — real estimate / human, never system output)`);
    }
    if (row.catalog !== undefined && mode && row.catalog !== mode) {
      throw new Error(`${filePath}:${fileLine} (${row.id}): catalog "${row.catalog}" does not match --mode ${mode} (wrong corpus file?)`);
    }
    rows.push({ ...row, category, _line: fileLine });
  });
  if (rows.length === 0) {
    throw new Error(`${filePath}: corpus has no data lines — a run against an empty corpus would produce a legitimate-looking all-null baseline`);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Per-row execution. matcher/skipCheck are injected: the CLI wires the real
// pipeline; eval/selfcheck.mjs wires stubs with known outcomes.
// top_code is candidates[0] AS RETURNED — no re-sort. The pipeline's own
// ordering is part of what is being measured; re-sorting would mask a
// selection/ordering bug, the exact class top1_hit_rate exists to catch.
// The pipeline emits `urs_code` on every branch (frontoffice, local, web,
// OTSKP-supplement, learned); `code` is kept as a fallback only.
// ---------------------------------------------------------------------------
export async function runOne(matcher, skipCheck, row, onlineCounter) {
  const base = {
    id: row.id,
    category: row.category ?? 'plain',
    expected_code: row.expected_code ?? null,
  };
  const skipReason = skipCheck ? skipCheck(row.description) : null;
  if (skipReason) {
    // The matcher's own input pre-filter would drop this line. Tagged so the
    // metrics can separate "matcher said no" from "input filter ate it".
    return { ...base, input_filtered: skipReason, top_code: null, candidate_codes: [], online_calls: 0 };
  }
  const before = onlineCounter ? onlineCounter() : 0;
  let candidates;
  try {
    candidates = await matcher(row.description, row.quantity ?? 0, row.unit ?? 'ks');
  } catch (e) {
    return { ...base, error: e.message, top_code: null, candidate_codes: [], online_calls: onlineCounter ? onlineCounter() - before : 0 };
  }
  const list = Array.isArray(candidates) ? candidates : [];
  const codeOf = (c) => c?.urs_code ?? c?.code ?? null;
  const top = list[0] ?? null;
  return {
    ...base,
    top_code: codeOf(top),
    top_confidence: Number.isFinite(top?.confidence) ? top.confidence : null,
    candidate_codes: list.map(codeOf).filter(Boolean),
    online_calls: onlineCounter ? onlineCounter() - before : 0,
  };
}

export async function runRows(rows, { matcher, skipCheck = null, onlineCounter = null } = {}) {
  const results = [];
  // Sequential ON PURPOSE: web sources are rate-limited, and per-row
  // online-call attribution against the single shared counter is only correct
  // one row at a time. Do not parallelize.
  for (const row of rows) {results.push(await runOne(matcher, skipCheck, row, onlineCounter));}
  return results;
}

// ---------------------------------------------------------------------------
// §13 metrics. Semantics:
// - error rows measure infra, not matching → excluded from every quality/
//   honesty denominator, surfaced as n_errors (compare warns when nonzero).
// - input_filtered rows: kept in the QUALITY denominators (production really
//   drops these lines, so they are real top-1/recall misses) but excluded from
//   the HONESTY bucket (the matcher never saw them, so they prove nothing
//   about fabrication/honest-skip).
// ---------------------------------------------------------------------------
export function computeMetrics(results) {
  const errors = results.filter((r) => r.error !== undefined);
  const filtered = results.filter((r) => r.input_filtered !== undefined);
  const ok = results.filter((r) => r.error === undefined);
  const withCode = ok.filter((r) => r.expected_code !== null);
  const honestyPool = ok.filter((r) => r.input_filtered === undefined && r.category === 'nonexistent');
  const hit1 = withCode.filter((r) => r.top_code !== null && r.top_code === r.expected_code).length;
  const recalled = withCode.filter((r) => r.candidate_codes.includes(r.expected_code)).length;
  const fabricated = honestyPool.filter((r) => r.top_code !== null).length;
  const honest = honestyPool.filter((r) => r.top_code === null).length;
  const totalOnline = results.reduce((s, r) => s + (r.online_calls || 0), 0);
  const pct = (n, d) => (d === 0 ? null : Number((n / d).toFixed(4)));
  return {
    n_lines: results.length,
    n_errors: errors.length,
    n_input_filtered: filtered.length,
    n_with_code: withCode.length,
    n_nonexistent: honestyPool.length,
    top1_hit_rate: pct(hit1, withCode.length),
    candidate_recall: pct(recalled, withCode.length),
    fabrication_rate: pct(fabricated, honestyPool.length),
    honest_skip_rate: pct(honest, honestyPool.length),
    online_calls_per_position: pct(totalOnline, results.length),
  };
}

// ---------------------------------------------------------------------------
// Compare two saved runs. Refuses cross-corpus / cross-mode comparisons and
// reports id drift; a null (unmeasurable) metric raises a loud warning instead
// of masquerading as "no change" — fabrication_rate silently dropping out of
// the STOP protocol is exactly how a flip gets approved on zero safety data.
// ---------------------------------------------------------------------------
export function compare(a, b) {
  if (a.run?.corpus !== b.run?.corpus) {
    throw new Error(`refusing to compare different corpora: "${a.run?.corpus}" vs "${b.run?.corpus}"`);
  }
  if (a.run?.mode !== b.run?.mode) {
    throw new Error(`refusing to compare different modes: "${a.run?.mode}" vs "${b.run?.mode}"`);
  }
  const warnings = [];
  const delta = {};
  for (const k of METRIC_KEYS) {
    const va = a.metrics[k];
    const vb = b.metrics[k];
    if (va == null || vb == null) {
      warnings.push(`${k} is UNMEASURABLE in ${va == null ? 'run A' : 'run B'} (empty denominator) — this metric is NOT covered by this comparison`);
    }
    delta[k] = {
      a: va,
      b: vb,
      delta: va == null || vb == null ? null : Number((vb - va).toFixed(4)),
      direction: METRIC_DIRECTION[k],
    };
  }
  for (const [label, run] of [['A', a], ['B', b]]) {
    if (run.metrics.n_errors > 0) {
      warnings.push(`run ${label} has ${run.metrics.n_errors} errored line(s) — infra failures, excluded from metrics; re-run before trusting the delta`);
    }
  }
  if ((a.metrics.n_input_filtered ?? 0) !== (b.metrics.n_input_filtered ?? 0)) {
    warnings.push(`input-filtered line counts differ (A=${a.metrics.n_input_filtered}, B=${b.metrics.n_input_filtered}) — the input pre-filter behaved differently between runs`);
  }
  const byIdA = Object.fromEntries((a.results || []).map((r) => [r.id, r]));
  const idsB = new Set((b.results || []).map((r) => r.id));
  const only_in_a = (a.results || []).filter((r) => !idsB.has(r.id)).map((r) => r.id);
  const only_in_b = (b.results || []).filter((r) => !byIdA[r.id]).map((r) => r.id);
  if (only_in_a.length || only_in_b.length) {
    warnings.push(`corpus drift between runs: ${only_in_a.length} id(s) only in A, ${only_in_b.length} only in B — the metric deltas are computed over different line sets`);
  }
  const top_code_changed = (b.results || [])
    .filter((r) => byIdA[r.id] && byIdA[r.id].top_code !== r.top_code)
    .map((r) => ({ id: r.id, expected: r.expected_code, a_code: byIdA[r.id].top_code, b_code: r.top_code }));
  return {
    a: { version: a.run.otskp_catalog_version, file: a.run.otskp_catalog_filename, mode: a.run.mode },
    b: { version: b.run.otskp_catalog_version, file: b.run.otskp_catalog_filename, mode: b.run.mode },
    warnings,
    metric_delta: delta,
    top_code_changed,
    only_in_a,
    only_in_b,
  };
}

// ---------------------------------------------------------------------------
// CLI (real pipeline). Guarded so importing this module (selfcheck) runs
// nothing. Env is set BEFORE the lazy pipeline imports: LOG_LEVEL is read at
// logger module load, so stdout stays pure JSON; DATABASE_URL is read at first
// DB open; URS_LEARNING / URS_FRONTOFFICE_SEARCH are read per call.
// ---------------------------------------------------------------------------
function usage() {
  console.error(
    'usage:\n' +
    '  run-corpus.mjs --mode otskp|urs --db <eval-db-file> [--out <file>] [--allow-incomplete] <corpus.jsonl>\n' +
    '  run-corpus.mjs --compare <runA.json> <runB.json>\n' +
    'See eval/README.md for the full protocol.'
  );
  process.exit(2);
}

function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : undefined;
}

async function cliRun(argv) {
  const mode = argValue(argv, '--mode');
  const dbArg = argValue(argv, '--db');
  const outFile = argValue(argv, '--out');
  const allowIncomplete = argv.includes('--allow-incomplete');
  const positional = argv.filter((x, i) => !x.startsWith('--') && argv[i - 1] !== '--mode' && argv[i - 1] !== '--db' && argv[i - 1] !== '--out');
  const corpusPath = positional[0];
  if (!corpusPath || !mode || !['otskp', 'urs'].includes(mode) || !dbArg) {usage();}

  const rows = parseCorpus(corpusPath, { mode });
  if (!allowIncomplete && !rows.some((r) => r.category === 'nonexistent')) {
    throw new Error('corpus has no "nonexistent" lines — fabrication_rate would be unmeasurable (the safety metric). Add them or pass --allow-incomplete to acknowledge.');
  }

  // --- environment BEFORE any pipeline import ---
  const dbPath = path.resolve(dbArg);
  if (!fs.existsSync(dbPath)) {
    throw new Error(`eval DB not found: ${dbPath} — build it first (see eval/README.md; the runtime would otherwise auto-create a 36-item toy DB and the baseline would be garbage)`);
  }
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.LOG_LEVEL = process.env.EVAL_LOG_LEVEL || 'ERROR'; // keep stdout = pure JSON
  process.env.URS_LEARNING = '0'; // no cache answers, no store writes — run A cannot poison run B
  if (mode === 'otskp') {
    process.env.URS_FRONTOFFICE_SEARCH = '0'; // measure the catalog, not the network
  }

  // --- pipeline imports (after env) ---
  const frontoffice = await import('../src/services/frontofficeClient.js');
  const onlineHosts = new Set([
    new URL(frontoffice.FRONTOFFICE_BASE).hostname,
    'api.perplexity.ai',
    'api.search.brave.com',
  ]);
  // Fetch spy: counts RESOLVED requests to the exact online-source hosts (a
  // failed/offline attempt is not a served online call; attempts are recorded
  // separately). Handles string / URL / Request arguments.
  // HTTP-status breakdown is recorded too ("молчание ≠ успех", third
  // occurrence of the class — this time in the meter itself): a proxy that
  // refuses egress with 403 still RESOLVES the fetch, and a run full of
  // proxy-403s used to read as "the channel was consulted". online_status
  // makes a blocked channel visible in the run record: all-4xx = the online
  // door was never actually reachable, whatever the resolved count says.
  let resolved = 0;
  let attempts = 0;
  const statusCounts = {};
  const origFetch = globalThis.fetch;
  globalThis.fetch = (input, ...rest) => {
    let host = '';
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url ?? '';
      host = raw ? new URL(raw).hostname : '';
    } catch { /* counting must never break a run */ }
    const counted = onlineHosts.has(host);
    if (counted) {attempts += 1;}
    const p = origFetch(input, ...rest);
    if (counted) {
      p.then((res) => {
        resolved += 1;
        const s = String(res?.status ?? 'unknown');
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      }, () => {});
    }
    return p;
  };

  const { matchUrsItems, shouldSkipText } = await import('../src/services/ursMatcher.js');

  // --- DB fingerprint: the run must prove WHAT it measured against ---
  const { getDatabase } = await import('../src/db/init.js');
  const db = await getDatabase();
  const { count } = await db.get('SELECT COUNT(*) as count FROM urs_items');
  const floor = Number(process.env.EVAL_DB_MIN_ITEMS || 1000);
  if (!(count >= floor)) {
    throw new Error(`eval DB ${dbPath} holds ${count} urs_items (< floor ${floor}) — this is not a real catalog (auto-seed is 36 toy items). Build it via the importer; see eval/README.md.`);
  }

  const results = await runRows(rows, {
    matcher: matchUrsItems,
    skipCheck: shouldSkipText,
    onlineCounter: () => resolved,
  });

  const out = {
    run: {
      corpus: corpusPath,
      mode,
      started_at: new Date().toISOString(),
      node: process.version,
      // Catalog axes — both of them. Two runs under different releases/knobs
      // must be distinguishable from the artifacts alone.
      otskp_catalog_version: OTSKP_CATALOG_VERSION,
      otskp_catalog_filename: OTSKP_CATALOG_FILENAME,
      urs_catalog_version: frontoffice.CATALOG_VERSION,
      // Behaviour-determining knobs (capability token NOT recorded, only set/default):
      frontoffice_search: process.env.URS_FRONTOFFICE_SEARCH === '0' ? 'disabled' : 'enabled',
      urs_frontoffice_version_id: process.env.URS_FRONTOFFICE_VERSION_ID ? 'env-set' : 'default',
      urs_catalog_mode: process.env.URS_CATALOG_MODE || '(default: local)',
      urs_learning: 'disabled',
      urs_local_conf_floor: process.env.URS_LOCAL_CONF_FLOOR || '(default: MEDIUM 0.6)',
      db: { path: dbPath, urs_items_count: count },
      online_attempts: attempts,
      online_status: statusCounts,
    },
    metrics: computeMetrics(results),
    results,
  };
  const json = JSON.stringify(out, null, 2);
  if (outFile) {
    fs.writeFileSync(path.resolve(outFile), json + '\n');
    console.error(`written: ${outFile}`);
  } else {
    console.log(json);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--compare') {
    if (argv.length !== 3) {usage();}
    try {
      const a = JSON.parse(fs.readFileSync(argv[1], 'utf-8'));
      const b = JSON.parse(fs.readFileSync(argv[2], 'utf-8'));
      console.log(JSON.stringify(compare(a, b), null, 2));
    } catch (e) {
      console.error(e.message);
      process.exit(2);
    }
  } else {
    cliRun(argv).catch((e) => {
      console.error(e.stack || e.message);
      process.exit(1);
    });
  }
}
