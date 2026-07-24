#!/usr/bin/env node
/**
 * READ-ONLY diagnostic for the live ÚRS frontoffice — no matcher change, no DB.
 *
 * The paced live corpus run (2026-07-24, online_status {"200":50}) reached the
 * catalog on every line yet harvested ZERO frontoffice candidates. Two
 * hypotheses fit "HTTP 200 + empty on every text query":
 *   (1) STALE versionId — the client pins dsdCAHQZh6lFvriEi3aB and falls back
 *       to it when metadata auto-resolve finds nothing; a rotated ÚRS release
 *       makes every /v1/search return empty while still answering 200.
 *   (2) WRONG SECTION — the client (searchCatalog) reads only
 *       advancedSearch.items, but the URL sends textsPage/categoriesPage/
 *       itemsPage, i.e. the response is faceted; text matches may live under
 *       .texts / .categories which the client discards.
 *
 * This probe discriminates: a BARE CODE lookup exercises `items` (a live
 * versionId ALWAYS finds an existing code → if the bare code is empty too,
 * hypothesis 1); dumping EVERY array path in the response reveals whether text
 * matches sit in a section the client ignores (hypothesis 2).
 *
 * Must run where egress to *.run.app is allowed (Cloud Shell); paces 6.5s
 * between calls (~10 req/min live limit).
 *
 * Usage:  node eval/probe-frontoffice.mjs
 */

import {
  FRONTOFFICE_BASE,
  CATALOG_VERSION,
  resolveVersionId,
} from '../src/services/frontofficeClient.js';

const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  Origin: 'https://podminky.urs.cz',
  Referer: 'https://podminky.urs.cz/',
  'Accept-Language': 'cs',
  'User-Agent': 'StavAgent/1.0 (construction cost estimator)',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function raw(url) {
  try {
    const res = await fetch(url, { headers: HEADERS });
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, body };
  } catch (e) {
    return { status: `ERR:${e.message}`, body: null };
  }
}

// List every array-valued path (with length) up to 3 levels deep — reveals
// which response section holds results, without knowing the schema in advance.
function arrayPaths(obj, prefix = '', depth = 0) {
  const out = [];
  if (!obj || typeof obj !== 'object' || depth > 3) { return out; }
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      out.push(`${p}[${v.length}]`);
      if (v.length && typeof v[0] === 'object') { out.push(...arrayPaths(v[0], `${p}[0]`, depth + 1)); }
    } else if (v && typeof v === 'object') {
      out.push(...arrayPaths(v, p, depth + 1));
    }
  }
  return out;
}

function firstItemAnywhere(body) {
  const adv = body?.advancedSearch || body?.simpleSearch || body || {};
  for (const [section, v] of Object.entries(adv)) {
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
      const it = v[0];
      return { section, code: it.code ?? it.referenceCode ?? null, unit: it.measureUnit ?? null, type: it.type ?? null, desc: String(it.description ?? it.name ?? '').slice(0, 55) };
    }
  }
  return null;
}

const QUERIES = [
  ['174111101', 'BARE CODE — stale-versionId discriminator (must find the item if versionId is live)'],
  ['Zásyp', 'single object word'],
  ['Zásyp sypaninou', 'two words'],
  ['Zásyp sypaninou ručně', 'SHORT intent query (what the strategy sends)'],
  ['Zásyp sypaninou z jakékoliv horniny ručně se zhutněním', 'longer'],
];

async function main() {
  const versionId = await resolveVersionId();
  console.log('FRONTOFFICE_BASE  :', FRONTOFFICE_BASE);
  console.log('CATALOG_VERSION   :', CATALOG_VERSION);
  console.log('resolved versionId:', versionId, versionId === 'dsdCAHQZh6lFvriEi3aB' ? '(= the PINNED fallback — metadata auto-resolve found nothing or matched the pin)' : '(auto-resolved fresh)');
  console.log();

  await sleep(6500);
  const meta = await raw(`${FRONTOFFICE_BASE}/v1/version/metadata/${encodeURIComponent(CATALOG_VERSION)}`);
  console.log(`metadata /v1/version/metadata/${CATALOG_VERSION}  http=${meta.status}`);
  console.log('  body:', JSON.stringify(meta.body).slice(0, 400));
  console.log();

  for (const [q, note] of QUERIES) {
    await sleep(6500);
    const params = new URLSearchParams({ versionId, query: q, textsPage: '1', categoriesPage: '1', itemsPage: '1', limit: '10' });
    const r = await raw(`${FRONTOFFICE_BASE}/v1/search?${params.toString()}`);
    console.log(`QUERY "${q}"  (${note})`);
    console.log(`  http=${r.status}  top-level keys=${r.body ? JSON.stringify(Object.keys(r.body)) : 'null'}`);
    console.log('  array paths:', arrayPaths(r.body).join('  ') || '(no arrays — empty/blocked body)');
    const first = firstItemAnywhere(r.body);
    console.log('  first item :', first ? JSON.stringify(first) : '(none in any section)');
  }

  await sleep(6500);
  const ac = await raw(`${FRONTOFFICE_BASE}/v1/autocomplete?query=${encodeURIComponent('zásyp')}`);
  console.log(`autocomplete /v1/autocomplete?query=zásyp  http=${ac.status}`);
  console.log('  array paths:', arrayPaths(ac.body).join('  ') || '(none)');
  console.log('  body:', JSON.stringify(ac.body).slice(0, 300));
}

main().catch((e) => { console.error('probe failed:', e); process.exit(1); });
