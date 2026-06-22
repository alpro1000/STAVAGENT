#!/usr/bin/env node
// Export the sandbox pipeline result as an HK212-style atomic_decomposition_map.json
// (the source the Excel atomic-worklist generator consumes). Single source of truth =
// the sandbox pipeline; this only re-keys atoms into the HK212 schema + adds kapitola.
//
// Usage: node export-atomic-map.mjs <output_path.json>

import { writeFileSync } from 'node:fs';
import { runPipeline } from './src/pipeline.mjs';

const OUT = process.argv[2];
if (!OUT) { console.error('usage: node export-atomic-map.mjs <out.json>'); process.exit(1); }

// atom.key → HK212 kapitola (profession bucket for an apartment renovation)
const KAP = {
  priprava_odstraneni_nateru: 'HSV-6 Bourací práce',
  armovaci_sterka_perlinka: 'PSV-78 Povrchové úpravy',
  stuk: 'PSV-78 Povrchové úpravy',
  malba_steny: 'PSV-78 Povrchové úpravy',
  demontaz_zp: 'HSV-6 Bourací práce',
  demontaz_obkladu_dlazby: 'HSV-6 Bourací práce',
  vyrovnani_rozvody: 'PSV-72 ZTI',
  hydroizolace_koupelna: 'PSV-71 Izolace HI',
  obklad_sten: 'PSV-78 Povrchové úpravy',
  dlazba_podlah: 'PSV-77 Podlahy',
  montaz_zp: 'PSV-72 ZTI',
  demontaz_krytin: 'HSV-6 Bourací práce',
  samonivelacni_sterka: 'PSV-77 Podlahy',
  vinyl_pokladka: 'PSV-77 Podlahy',
  soklove_listy: 'PSV-77 Podlahy',
  parket_brouseni_lak: 'PSV-77 Podlahy',
  sdk_podhled: 'PSV-76 SDK konstrukce',
  malba_podhledy: 'PSV-78 Povrchové úpravy',
  el_demontaz: 'M-21 ELI silnoproud',
  el_rozvody: 'M-21 ELI silnoproud',
  el_pristroje: 'M-21 ELI silnoproud',
  el_revize: 'M-21 ELI silnoproud',
  kotel_demontaz: 'PSV-73 Vytápění',
  kotel_montaz: 'PSV-73 Vytápění',
  spalinova_cesta: 'PSV-73 Vytápění',
  kotel_revize: 'PSV-73 Vytápění',
  okna_dvere_renovace: 'PSV-76 Výplně otvorů',
  schodiste_ochrana: 'VRN — Společné',
  schodiste_renovace: 'PSV-76 Truhlář',
  doprava: 'VRN — Doprava + odpad',
  odvoz_suti: 'VRN — Doprava + odpad',
  administrativa: 'VRN — Společné',
  hodinove_prace: 'VRN — Společné',
};

// parent master line (frozen item ref). GAP atoms → mimo nabídku mistra.
const PARENT = {
  priprava_odstraneni_nateru: 'mistr: Odstranění nátěrů',
  armovaci_sterka_perlinka: 'mistr: Perlinka + lepidlo',
  stuk: 'mistr: Štukové omítky',
  demontaz_zp: 'mistr: Demontáž koupelny a WC',
  demontaz_obkladu_dlazby: 'mistr: Demontáž koupelny a WC',
  vyrovnani_rozvody: 'mistr: Vyrovnání + rozvody vody',
  obklad_sten: 'mistr: Pokládka obkladů a dlažby',
  dlazba_podlah: 'mistr: Pokládka obkladů a dlažby',
  demontaz_krytin: 'mistr: Demontáž podlahy kuchyně',
  vinyl_pokladka: 'mistr: Pokládka vinylové podlahy',
  soklove_listy: 'mistr: Pokládka vinylové podlahy',
  parket_brouseni_lak: 'mistr: Renovace parket',
  sdk_podhled: 'mistr: Sádrokartonové podhledy',
  el_demontaz: 'mistr: Elektroinstalace komplet',
  el_rozvody: 'mistr: Elektroinstalace komplet',
  el_pristroje: 'mistr: Elektroinstalace komplet',
  el_revize: 'mistr: Elektroinstalace komplet',
  okna_dvere_renovace: 'mistr: Oprava oken a dveří',
  schodiste_renovace: 'mistr: Renovace schodiště',
  doprava: 'mistr: Doprava materiálu',
};

// atoms that were split out of a bundled master line (decomposition children)
const DECOMPOSED = new Set([
  'demontaz_zp', 'demontaz_obkladu_dlazby', 'vyrovnani_rozvody', 'hydroizolace_koupelna',
  'obklad_sten', 'dlazba_podlah', 'montaz_zp',
  'el_demontaz', 'el_rozvody', 'el_pristroje', 'el_revize',
  'kotel_demontaz', 'kotel_montaz', 'spalinova_cesta', 'kotel_revize',
]);

const SKLADBA = {
  demontaz_zp: 'Koupelna+WC renovace', demontaz_obkladu_dlazby: 'Koupelna+WC renovace',
  vyrovnani_rozvody: 'Koupelna+WC renovace', hydroizolace_koupelna: 'Koupelna+WC renovace',
  obklad_sten: 'Koupelna+WC renovace', dlazba_podlah: 'Koupelna+WC renovace', montaz_zp: 'Koupelna+WC renovace',
  el_demontaz: 'Elektro výměna', el_rozvody: 'Elektro výměna', el_pristroje: 'Elektro výměna', el_revize: 'Elektro výměna',
  kotel_demontaz: 'Výměna kotle', kotel_montaz: 'Výměna kotle', spalinova_cesta: 'Výměna kotle', kotel_revize: 'Výměna kotle',
  samonivelacni_sterka: 'Podlaha vinyl', vinyl_pokladka: 'Podlaha vinyl', soklove_listy: 'Podlaha vinyl', demontaz_krytin: 'Podlaha vinyl',
};

const FORMULA = {
  obklad_sten: '50 m² keramiky (mistr) → obklad 32 m²',
  dlazba_podlah: '50 m² keramiky (mistr) → dlažba 18 m²',
  hydroizolace_koupelna: 'mokrá zóna koupelny ≈ 35 m² (odvozeno)',
  vinyl_pokladka: '17,1+25,0+26,0+16,0 = 84,1 m² (≈84 mistr)',
  samonivelacni_sterka: 'plocha vinylu 84 m²',
  malba_podhledy: 'plocha SDK podhledů 96 m²',
  sdk_podhled: 'stropy − ~35 m² druhý svět = 96 m²',
};

function provenanceText(p) {
  return { from_soupis: 'z podkladu mistra', derived_from_scope: 'odvozeno ze scope', needs_input: 'vyžaduje zadání (komplet)' }[p] || p;
}

// status string the generator's classify_status() understands
function statusString(b) {
  if (b.status === 'candidate') return 'matched_websearch'; // 9-digit, NOT verified → kandidát-verify
  if (b.status === 'group_only') return 'family_only';
  return ''; // not_verified → blank
}

const R = runPipeline();
let poradi = 0;
const ops = R.work_atoms.map((a) => {
  poradi += 1;
  const b = a.catalog_binding;
  const sanity = (b.sanity_flags || []).map((f) => `${f.code}: ${f.issue}`).join(' | ');
  let pozn = '';
  if (a.gap_vs_master) pozn = 'CHYBÍ v nabídce mistra (gap)';
  if (sanity) pozn = (pozn ? pozn + '  ' : '') + 'SANITY: ' + sanity;
  return {
    poradi,
    atomic_id: a.key,
    objekt: 'mezonet',
    kapitola: KAP[a.key] || 'PSV-78 Povrchové úpravy',
    atomic_operace_popis: a.work,
    mj: a.unit,
    mnozstvi: a.quantity,
    qty_formula: FORMULA[a.key] || provenanceText(a.quantity_provenance),
    quantity_provenance: a.quantity_provenance,
    urs_kod_kandidat: b.code || null,
    urs_code_family_6digit: b.family || null,
    urs_confidence: b.confidence,
    status: statusString(b),
    binding_status: b.status,
    parent_frozen_item_id: `${a.section_id} · ${PARENT[a.key] || '(mimo nabídku mistra)'}`,
    decomposition_type: DECOMPOSED.has(a.key) ? 'skladba_vrstva' : null,
    realizuje_skladbu: SKLADBA[a.key] || null,
    gap_vs_master: a.gap_vs_master,
    rate_czk: a.rate_czk,
    rate_source: a.rate_source,
    cost_czk: a.cost_czk,
    pozn,
  };
});

// decomposition map: parent master line → children (where >1 atom shares a parent)
const byParent = {};
for (const o of ops) { (byParent[o.parent_frozen_item_id] ||= []).push(o); }
const decomposition_map = Object.entries(byParent)
  .filter(([, kids]) => kids.length > 1)
  .map(([parent, kids]) => ({
    parent_frozen_item_id: parent,
    parent_kapitola: kids[0].kapitola,
    parent_popis: parent,
    parent_mj: 'soubor',
    parent_qty: kids.length,
    n_atomic_children: kids.length,
    atomic_children_ids: kids.map((k) => k.atomic_id),
  }));

// kapitola + status distributions for the Souhrn sheet
const atomic_per_kapitola = {};
for (const o of ops) atomic_per_kapitola[o.kapitola] = (atomic_per_kapitola[o.kapitola] || 0) + 1;
const familia_distribution = {};
for (const o of ops) { const f = o.urs_code_family_6digit || (o.urs_kod_kandidat ? o.urs_kod_kandidat.slice(0, 3) : '(blank)'); familia_distribution[f] = (familia_distribution[f] || 0) + 1; }

const out = {
  _meta: {
    case: 'Rekonstrukce mezonetu — interiér/PSV (UWO sandbox projection)',
    generated_from: 'sandbox/uwo-interier-mezonet pipeline (Work-First → Catalog-Last)',
    principle: 'HK212 atomic operations · Pattern 15 Work-First · Pattern 26 honest blanks (no 999/TBD)',
    catalog_probe: 'jednorázový reálný ÚRS proba (privátní → ÚRS), zmražený',
  },
  _summary: {
    frozen_items_total: R.cost.master_offer_total ? 15 : 0,
    atomic_operations_total: ops.length,
    items_decomposed: decomposition_map.length,
    atomic_children_from_decomposition: ops.filter((o) => o.decomposition_type).length,
    items_carried_1to1: ops.filter((o) => !o.decomposition_type).length,
    atomic_per_kapitola,
    familia_distribution,
    cost: R.cost,
    gaps: R.gaps.map((g) => g.key),
    sanity_flags: R.sanity_flags,
  },
  atomic_operations: ops,
  decomposition_map,
};

writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log(`wrote ${ops.length} atomic ops + ${decomposition_map.length} decomposition parents → ${OUT}`);
