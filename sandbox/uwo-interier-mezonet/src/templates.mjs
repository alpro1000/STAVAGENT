// Deterministic interiér/PSV work-atom templates — the §5 library.
// SANDBOX-LOCAL (not production KB). Migrates to B5_tech_cards/technological_postupy/
// later, as a separate task. One section → a PACK of atoms (never one catalog code).
//
// atom fields:
//   key          — stable id (maps to catalog-findings.json atom_key when bindable)
//   work         — Czech work description (codeless, priceless at decomposition time)
//   unit         — m2 | ks | komplet | bm
//   qty_source   — how the decomposer resolves quantity from corpus
//   gap          — true = NOT present in the master's baseline offer (test must flag it)
//
// NB: monolit atoms (bednění/výztuž/beton/ošetřování) are DELIBERATELY ABSENT here.
//     The scope-router guarantees the monolit branch is never applied to interiér.

export const INTERIER_PSV_TEMPLATES = {
  // S1 — Stěny: sanace povrchů. malba is the FINISH atom the master forgot.
  S1: [
    { key: 'priprava_odstraneni_nateru', work: 'Odstranění starých nátěrů stěn (oškrabání)', unit: 'm2', qty_source: 'section_m2', gap: false },
    { key: 'armovaci_sterka_perlinka', work: 'Armovací stěrka s perlinkou (sítka + lepidlo)', unit: 'm2', qty_source: 'section_m2', gap: false },
    { key: 'stuk', work: 'Štuková omítka vnitřní stěn', unit: 'm2', qty_source: 'section_m2', gap: false },
    { key: 'malba_steny', work: 'Malba stěn 2× — finální (po štuku, POVINNÁ)', unit: 'm2', qty_source: 'section_m2', gap: true },
  ],

  // S2 — Koupelna+WC: the canonical "one position ≠ one code" pack.
  S2: [
    { key: 'demontaz_zp', work: 'Demontáž zařizovacích předmětů (vana/WC/umyvadlo/baterie)', unit: 'komplet', qty_source: 'fixed_1', gap: false },
    { key: 'demontaz_obkladu_dlazby', work: 'Demontáž stávajících obkladů a dlažby', unit: 'komplet', qty_source: 'fixed_1', gap: false },
    { key: 'vyrovnani_rozvody', work: 'Vyrovnání podkladu + ZTI rozvody (voda/kanalizace)', unit: 'komplet', qty_source: 'fixed_1', gap: false },
    { key: 'hydroizolace_koupelna', work: 'Hydroizolační stěrka pod obklad/dlažbu', unit: 'm2', qty_source: 'koupelna_hi_m2', gap: true },
    { key: 'obklad_sten', work: 'Obklad keramický stěn', unit: 'm2', qty_source: 'koupelna_obklad_m2', gap: false },
    { key: 'dlazba_podlah', work: 'Dlažba keramická podlah', unit: 'm2', qty_source: 'koupelna_dlazba_m2', gap: false },
    { key: 'montaz_zp', work: 'Montáž nových zařizovacích předmětů (vana/sprcha/WC/umyvadlo)', unit: 'komplet', qty_source: 'fixed_1', gap: true },
  ],

  // S3 — Vinyl podlahy.
  S3: [
    { key: 'demontaz_krytin', work: 'Demontáž stávající podlahové krytiny (kuchyně)', unit: 'm2', qty_source: 'kuchyne_demontaz_m2', gap: false },
    { key: 'samonivelacni_sterka', work: 'Samonivelační stěrka podkladu pod vinyl', unit: 'm2', qty_source: 'vinyl_m2', gap: true },
    { key: 'vinyl_pokladka', work: 'Pokládka vinylové podlahy + podložka', unit: 'm2', qty_source: 'vinyl_m2', gap: false },
    { key: 'soklove_listy', work: 'Soklové lišty', unit: 'komplet', qty_source: 'fixed_1', gap: false },
  ],

  // S4 — Renovace parket.
  S4: [
    { key: 'parket_brouseni_lak', work: 'Broušení + tmelení + lakování parket', unit: 'm2', qty_source: 'section_m2', gap: false },
  ],

  // S5 — SDK podhledy + malba podhledů (forgotten finish).
  S5: [
    { key: 'sdk_podhled', work: 'SDK podhled (rošt CD/UD + opláštění + tmelení)', unit: 'm2', qty_source: 'section_m2', gap: false },
    { key: 'malba_podhledy', work: 'Malba podhledů 2× — finální (POVINNÁ)', unit: 'm2', qty_source: 'section_m2', gap: true },
  ],

  // S6 — Elektro: demontáž → rozvody → přístroje → revize.
  S6: [
    { key: 'el_demontaz', work: 'Demontáž stávající elektroinstalace', unit: 'komplet', qty_source: 'fixed_1', gap: false },
    { key: 'el_rozvody', work: 'Nové rozvody silnoproud', unit: 'komplet', qty_source: 'fixed_1', gap: false },
    { key: 'el_pristroje', work: 'Zařizovací předměty (zásuvky/vypínače/svítidla) + rozvaděč', unit: 'komplet', qty_source: 'fixed_1', gap: false },
    { key: 'el_revize', work: 'Výchozí revize elektroinstalace', unit: 'komplet', qty_source: 'fixed_1', gap: false },
  ],

  // S7 — Plynový kotel: FULL GAP (the master priced none of it).
  S7: [
    { key: 'kotel_demontaz', work: 'Demontáž starého plynového kotle', unit: 'ks', qty_source: 'section_ks', gap: true },
    { key: 'kotel_montaz', work: 'Montáž nového plynového kotle', unit: 'ks', qty_source: 'section_ks', gap: true },
    { key: 'spalinova_cesta', work: 'Spalinová cesta (komín/odkouření)', unit: 'komplet', qty_source: 'fixed_1', gap: true },
    { key: 'kotel_revize', work: 'Revize plynu + spalinové cesty', unit: 'komplet', qty_source: 'fixed_1', gap: true },
  ],

  // S8 — Okna a dveře.
  S8: [
    { key: 'okna_dvere_renovace', work: 'Broušení + tmelení + výměna zasklívacích lišt + nátěr oken a dveří', unit: 'komplet', qty_source: 'fixed_1', gap: false },
  ],

  // S9 — Schodiště: ochrana PŘED pracemi (VRN, separate atom) + renovace.
  S9: [
    { key: 'schodiste_ochrana', work: 'Ochrana/zakrytí schodiště PŘED stavebními pracemi (VRN)', unit: 'komplet', qty_source: 'fixed_1', gap: true },
    { key: 'schodiste_renovace', work: 'Renovace schodiště — odstranění skřípání + lak', unit: 'komplet', qty_source: 'fixed_1', gap: false },
  ],

  // S10 — VRN.
  S10: [
    { key: 'doprava', work: 'Doprava materiálu', unit: 'komplet', qty_source: 'fixed_1', gap: false },
    { key: 'odvoz_suti', work: 'Odvoz a likvidace suti', unit: 'komplet', qty_source: 'fixed_1', gap: true },
    { key: 'administrativa', work: 'Administrativa / koordinace', unit: 'komplet', qty_source: 'fixed_1', gap: true },
    { key: 'hodinove_prace', work: 'Hodinové práce (drobné/nepředvídané)', unit: 'komplet', qty_source: 'fixed_1', gap: true },
  ],
};

// Quantity resolution from corpus (provenance-aware). Returns { quantity, unit, provenance }.
// Derived bathroom split (obklad 32 / dlažba 18 = 50 m² master keramika) keeps the
// master total reproducible while modelling obklad and dlažba as separate atoms.
export function resolveQuantity(qty_source, section, corpus) {
  const KOUPELNA_OBKLAD = 32, KOUPELNA_DLAZBA = 18, KOUPELNA_HI = 35;
  switch (qty_source) {
    case 'section_m2': return { quantity: section.quantity.m2, provenance: section.quantity.provenance };
    case 'section_ks': return { quantity: section.quantity.ks, provenance: section.quantity.provenance };
    case 'fixed_1': return { quantity: 1, provenance: section.quantity.provenance ?? 'needs_input' };
    case 'koupelna_obklad_m2': return { quantity: KOUPELNA_OBKLAD, provenance: 'derived_from_scope' };
    case 'koupelna_dlazba_m2': return { quantity: KOUPELNA_DLAZBA, provenance: 'derived_from_scope' };
    case 'koupelna_hi_m2': return { quantity: KOUPELNA_HI, provenance: 'derived_from_scope' };
    case 'vinyl_m2': return { quantity: corpus.scope_sections.find(s => s.id === 'S3').quantity.vinyl_m2, provenance: 'derived_from_scope' };
    case 'kuchyne_demontaz_m2': return { quantity: 15, provenance: 'from_soupis' };
    default: return { quantity: null, provenance: 'needs_input' };
  }
}
