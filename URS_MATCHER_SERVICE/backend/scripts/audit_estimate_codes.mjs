#!/usr/bin/env node
/**
 * Revize kódů hotové sметы proti ŽIVÉMU katalogu CS ÚRS (frontoffice).
 *
 * Obrácený režim matcheru: ne "popis → najdi kód", ale "kód+popis → ověř pár".
 * Pro každý kódovaný řádek KROS Export Komplet XLSX:
 *   1. existuje kód v živém CS ÚRS 2026?           (zastaralé/překlepnuté kódy)
 *   2. odpovídá katalogový název popisu řádku?      (kolize přečíslování — kód
 *      existuje, ale znamená JINOU práci)
 *   3. souhlasí MJ?                                 (m2 vs m3 vs kus — tichá chyba)
 * Pracovní kódy (O02, Z01, R-…) se poctivě hlásí MIMO_KATALOG — bez lookupů.
 *
 * VĚDOMĚ NEPOUŽÍVÁ lokální ÚRS data (URS201801 = ročník 2018 — vyřazen,
 * viz docs/bugs/urs-local-door-2018-vintage/). Jediný zdroj = frontoffice
 * (živý katalog, verze se stampuje do každého výsledku).
 *
 * Usage:
 *   node scripts/audit_estimate_codes.mjs <smeta.xlsx> [--out report.json]
 *        [--delay 6500] [--limit N] [--dry]
 *   --dry    jen parsování, žádné síťové dotazy (kontrola extrakce)
 *   --delay  pauza mezi dotazy v ms (default 6500 — frontoffice limituje
 *            ~10 požadavků/min; živý běh 2026-07-22 s 400 ms prošel prvních 10
 *            lookupů a pak dostával prázdné odpovědi, které se BEZ rozlišení
 *            statusu tvářily jako "kód nenalezen")
 *   --limit  jen prvních N kódovaných řádků (zkušební běh)
 *
 * Poctivost měření (mlčení ≠ úspěch): HTTP status každého dotazu se zachytává
 * přes injektovaný fetchImpl. Prázdná odpověď s non-200 (429/5xx/síť) se hlásí
 * jako OMEZENO (+1 retry po pauze), NIKDY jako KOD_NENALEZEN — throttling nesmí
 * vypadat jako verdikt o smetě.
 *
 * ZNÁMÉ OMEZENÍ — požadavek na v2 (ratifikováno Alexandrem 2026-07-22):
 * PŘÍPLATKOVÉ položky NELZE kontrolovat po řádcích. Správnost příplatku určuje
 * VAZBA, ne řádek: (1) rodičovská hlavní pozice musí existovat ve stejném dílu
 * (živý vzor Vidímova: rodič 764215608 „Oplechování atiky" 399 m + příplatek
 * 764215646 hned pod ním — sdílejí 6místný prefix kódu; dtto 764216644/-665);
 * (2) MJ příplatku má být kus × počet rohů/uzlů — „1 soubor" skrývá základ
 * doplatku; (3) množství se má vázat na geometrii rodiče. Dnešní řádková
 * kontrola takový korektní pár flaguje jako OVERIT/MJ_NESOUHLASI — falešný
 * poplach na každém příplatku. v2: katalogový název začínající „Příplatek" →
 * najít souseda se shodným 6místným prefixem v témže dílu a validovat PÁR
 * (rodič existuje? MJ kus? počet vs rodič?); flag jen když pár chybí.
 * UPŘESNĚNÍ MJ (KROS 2026 screenshot, rodina 174, ověřeno 2026-07-23):
 * příplatky jsou plnohodnotné katalogové pozice s VLASTNÍ jednotkou, která
 * sleduje rodinu — 174111109 «Příplatek k ceně za prohození sypaniny sítem»
 * je za m³, klempířské příplatky za kus. v2 tedy validuje MJ proti
 * KATALOGOVÉ jednotce daného příplatkového kódu, nikdy proti napevno «kus».
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import xlsx from 'xlsx';
import { searchCatalog, CATALOG_VERSION } from '../src/services/frontofficeClient.js';
import { calculateSimilarity } from '../src/utils/similarity.js';

const CATALOG_CODE_RE = /^\d{6,9}$/;   // ÚRS položkové kódy; vše ostatní = pracovní označení

function normMj(mj) {
  return String(mj ?? '').toLowerCase().replace(/\s+/g, '')
    .replace('²', '2').replace('³', '3').replace(/^kus$/, 'ks');
}

export function parseKrosExport(file) {
  const wb = xlsx.readFile(file);
  const rows = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const grid = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    // find the item-table header: a row containing PČ + Typ + Kód
    const hdrIdx = grid.findIndex((r) => r && r.includes('PČ') && r.includes('Typ') && r.includes('Kód'));
    if (hdrIdx === -1) continue;
    const hdr = grid[hdrIdx];
    const col = (name) => hdr.indexOf(name);
    const cTyp = col('Typ'); const cKod = col('Kód'); const cPop = col('Popis');
    const cMj = col('MJ'); const cMn = col('Množství');
    for (let i = hdrIdx + 1; i < grid.length; i++) {
      const r = grid[i];
      if (!r) continue;
      const typ = r[cTyp];
      if (typ !== 'K' && typ !== 'M') continue;
      rows.push({
        sheet: sheetName, row: i + 1, typ,
        kod: r[cKod] != null ? String(r[cKod]).trim() : null,
        popis: r[cPop] != null ? String(r[cPop]).trim() : '',
        mj: r[cMj] != null ? String(r[cMj]).trim() : '',
        mnozstvi: r[cMn],
      });
    }
  }
  return rows;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One catalog lookup with HTTP-status capture. searchCatalog is fail-soft ([]),
// so without the injected fetchImpl an outage/throttle is indistinguishable
// from "code absent" — the exact confusion the 2026-07-22 live run produced.
async function lookupWithStatus(kod) {
  let httpStatus = null;
  const spy = (url, opts) => globalThis.fetch(url, opts).then((res) => { httpStatus = res.status; return res; });
  let items;
  try {
    items = await searchCatalog(kod, { limit: 5, fetchImpl: spy });
  } catch {
    items = [];
  }
  return { items: items || [], httpStatus };
}

export async function auditRow(row, { delayMs, retryBackoffMs = 65000 }) {
  if (!row.kod) return { ...row, status: 'BEZ_KODU' };
  if (!CATALOG_CODE_RE.test(row.kod)) return { ...row, status: 'MIMO_KATALOG' };
  let { items, httpStatus } = await lookupWithStatus(row.kod);
  await sleep(delayMs);
  if (items.length === 0 && httpStatus !== 200) {
    // throttled / server error / network — wait out the rate window, retry once
    console.error(`  … ${row.kod}: HTTP ${httpStatus ?? 'síť'} — čekám ${Math.round(retryBackoffMs / 1000)}s a zkouším znovu`);
    await sleep(retryBackoffMs);
    ({ items, httpStatus } = await lookupWithStatus(row.kod));
    await sleep(delayMs);
    if (items.length === 0 && httpStatus !== 200) {
      return { ...row, status: 'OMEZENO', http_status: httpStatus, catalog_version: CATALOG_VERSION };
    }
  }
  const exact = items.find((i) => i.urs_code === row.kod);
  if (!exact) {
    // Materials (typ M, specifikace) are NOT in the frontoffice search index —
    // live evidence 2026-07-22 (Vidímova, properly paced run): 0 of 38 M codes
    // found vs 129 of 129 K work codes answered. An M miss is therefore a
    // COVERAGE limit of this verification channel, not a verdict on the code.
    if (row.typ === 'M') return { ...row, status: 'MATERIAL_NELZE_OVERIT', catalog_version: CATALOG_VERSION };
    return { ...row, status: 'KOD_NENALEZEN', catalog_version: CATALOG_VERSION };
  }
  const nameSim = +calculateSimilarity(row.popis, exact.urs_name || exact.description || '').toFixed(3);
  const mjOk = !normMj(exact.unit) || !normMj(row.mj) ? null : normMj(exact.unit) === normMj(row.mj);
  let status = 'OK';
  if (mjOk === false) status = 'MJ_NESOUHLASI';
  else if (nameSim < 0.25) status = 'NAZEV_ODLISNY';       // podezření na kolizi/přečíslování
  else if (nameSim < 0.5) status = 'OVERIT_NAZEV';
  return {
    ...row, status,
    catalog_name: exact.urs_name || exact.description || null,
    catalog_mj: exact.unit ?? null,
    name_similarity: nameSim,
    mj_match: mjOk,
    catalog_version: exact.catalog_version || CATALOG_VERSION,
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const argv = process.argv.slice(2);
  const file = argv.find((a) => !a.startsWith('--'));
  const flag = (n, d) => { const i = argv.indexOf(n); return i !== -1 ? argv[i + 1] : d; };
  const DRY = argv.includes('--dry');
  const DELAY = Number(flag('--delay', 6500));
  const LIMIT = flag('--limit') ? Number(flag('--limit')) : Infinity;
  const OUT = flag('--out');

  if (!file) {
    console.error('usage: audit_estimate_codes.mjs <smeta.xlsx> [--out report.json] [--delay ms] [--limit N] [--dry]');
    process.exit(2);
  }

  const rows = parseKrosExport(file);
  const coded = rows.filter((r) => r.kod && CATALOG_CODE_RE.test(r.kod));
  const working = rows.filter((r) => r.kod && !CATALOG_CODE_RE.test(r.kod));
  console.error(`parsed: ${rows.length} položek (${coded.length} katalogových kódů, ${working.length} pracovních)`);

  if (DRY) {
    console.log(JSON.stringify({
      file: path.basename(file), dry: true,
      n_rows: rows.length, n_catalog_coded: coded.length, n_working: working.length,
      working_codes: working.map((w) => w.kod),
      sample: rows.slice(0, 5),
    }, null, 2));
    process.exit(0);
  }

  const results = [];
  let done = 0;
  for (const row of rows) {
    if (row.kod && CATALOG_CODE_RE.test(row.kod) && done >= LIMIT) break;
    const res = await auditRow(row, { delayMs: DELAY });
    if (res.status !== 'MIMO_KATALOG' && res.status !== 'BEZ_KODU') done++;
    results.push(res);
  }
  const counts = {};
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  const report = {
    file: path.basename(file),
    checked_against: `frontoffice ${CATALOG_VERSION} (živý katalog; lokální 2018 data VĚDOMĚ nepoužita)`,
    audited_at: new Date().toISOString(),
    counts,
    problems: results.filter((r) => !['OK', 'MIMO_KATALOG'].includes(r.status)),
    working_codes: results.filter((r) => r.status === 'MIMO_KATALOG').map((r) => ({ kod: r.kod, popis: r.popis.slice(0, 60) })),
    results,
  };
  const json = JSON.stringify(report, null, 2);
  if (OUT) { fs.writeFileSync(path.resolve(OUT), json + '\n'); console.error(`written: ${OUT}`); }
  else console.log(json);
  console.error('souhrn:', JSON.stringify(counts));
}
