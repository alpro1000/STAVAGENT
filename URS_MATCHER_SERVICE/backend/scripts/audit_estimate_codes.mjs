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
 *        [--delay 400] [--limit N] [--dry]
 *   --dry    jen parsování, žádné síťové dotazy (kontrola extrakce)
 *   --delay  pauza mezi dotazy v ms (default 400 — konzervativně, cizí endpoint)
 *   --limit  jen prvních N kódovaných řádků (zkušební běh)
 *
 * Síť: potřebuje egress na frontoffice (z CI/sandboxu bývá blokován) — spouštět
 * z prostředí s přístupem. Selhání dotazu = status NEDOSTUPNE, nikdy ne závěr.
 */

import fs from 'fs';
import path from 'path';
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

async function auditRow(row, { delayMs }) {
  if (!row.kod) return { ...row, status: 'BEZ_KODU' };
  if (!CATALOG_CODE_RE.test(row.kod)) return { ...row, status: 'MIMO_KATALOG' };
  let items;
  try {
    items = await searchCatalog(row.kod, { limit: 5 });
  } catch {
    items = null;
  }
  await new Promise((r) => setTimeout(r, delayMs));
  if (items === null) return { ...row, status: 'NEDOSTUPNE' };
  const exact = (items || []).find((i) => i.urs_code === row.kod);
  if (!exact) return { ...row, status: 'KOD_NENALEZEN', catalog_version: CATALOG_VERSION };
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

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const flag = (n, d) => { const i = argv.indexOf(n); return i !== -1 ? argv[i + 1] : d; };
const DRY = argv.includes('--dry');
const DELAY = Number(flag('--delay', 400));
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
