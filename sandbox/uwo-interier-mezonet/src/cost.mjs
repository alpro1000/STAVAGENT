// [Stage 4] Orientační cost (downstream of binding). ALWAYS labelled orientační.
// rate_source: 'master' (the contractor's real offer rate) | 'rule_of_thumb' (sandbox estimate
// for the atoms the master forgot). not_verified-status atoms are surfaced separately and
// must not be presented as exact figures (AC8).

const RATES = {
  // S1
  priprava_odstraneni_nateru: { rate: 70, source: 'master' },
  armovaci_sterka_perlinka: { rate: 600, source: 'master' },
  stuk: { rate: 280, source: 'master' },
  malba_steny: { rate: 120, source: 'rule_of_thumb' },
  // S2
  demontaz_zp: { rate: 60000, source: 'master' },
  demontaz_obkladu_dlazby: { rate: 0, source: 'master' },
  vyrovnani_rozvody: { rate: 25000, source: 'master' },
  hydroizolace_koupelna: { rate: 600, source: 'rule_of_thumb' }, // Kč/m² (stěrka 2×); 35 m² ≈ 21k (vs majitelův odhad 15–25k)
  obklad_sten: { rate: 1350, source: 'master' },
  dlazba_podlah: { rate: 1350, source: 'master' },
  montaz_zp: { rate: 25000, source: 'rule_of_thumb' },
  // S3
  demontaz_krytin: { rate: 100, source: 'master' },
  samonivelacni_sterka: { rate: 80, source: 'rule_of_thumb' },
  vinyl_pokladka: { rate: 1200, source: 'master' },
  soklove_listy: { rate: 0, source: 'master' },
  // S4
  parket_brouseni_lak: { rate: 1300, source: 'master' },
  // S5
  sdk_podhled: { rate: 1300, source: 'master' },
  malba_podhledy: { rate: 120, source: 'rule_of_thumb' },
  // S6
  el_demontaz: { rate: 0, source: 'master' },
  el_rozvody: { rate: 170000, source: 'master' },
  el_pristroje: { rate: 0, source: 'master' },
  el_revize: { rate: 0, source: 'master' },
  // S7 — full gap
  kotel_demontaz: { rate: 8000, source: 'rule_of_thumb' },
  kotel_montaz: { rate: 45000, source: 'rule_of_thumb' },
  spalinova_cesta: { rate: 12000, source: 'rule_of_thumb' },
  kotel_revize: { rate: 5000, source: 'rule_of_thumb' },
  // S8
  okna_dvere_renovace: { rate: 100000, source: 'master' },
  // S9
  schodiste_ochrana: { rate: 8000, source: 'rule_of_thumb' },
  schodiste_renovace: { rate: 45000, source: 'master' },
  // S10
  doprava: { rate: 40000, source: 'master' },
  odvoz_suti: { rate: 25000, source: 'rule_of_thumb' },
  administrativa: { rate: 50000, source: 'rule_of_thumb' },
  hodinove_prace: { rate: 50000, source: 'rule_of_thumb' },
};

export function priceAtoms(atoms) {
  return atoms.map((atom) => {
    if (atom.branch !== 'interier_psv' || !atom.key) return atom;
    const r = RATES[atom.key] || { rate: 0, source: 'rule_of_thumb' };
    const qty = atom.quantity ?? 1;
    const cost = Math.round(r.rate * qty);
    return { ...atom, rate_czk: r.rate, rate_source: r.source, cost_czk: cost };
  });
}

export function totals(atoms, masterOfferTotal) {
  const priced = atoms.filter((a) => a.branch === 'interier_psv' && a.key);
  const sum = (pred) => priced.filter(pred).reduce((s, a) => s + (a.cost_czk || 0), 0);

  const grand_orientacni = sum(() => true);
  const by_rate_source = {
    master: sum((a) => a.rate_source === 'master'),
    rule_of_thumb: sum((a) => a.rate_source === 'rule_of_thumb'),
  };
  const by_status = {
    candidate: sum((a) => a.catalog_binding?.status === 'candidate'),
    group_only: sum((a) => a.catalog_binding?.status === 'group_only'),
    not_verified: sum((a) => a.catalog_binding?.status === 'not_verified'),
    exact: sum((a) => a.catalog_binding?.status === 'exact'),
  };
  const gap_additions = sum((a) => a.gap_vs_master === true); // atoms the master omitted

  return {
    currency: 'CZK',
    label: 'ORIENTAČNÍ (±10–15 %) — detail u dodavatele',
    grand_orientacni,
    by_rate_source,
    by_status,
    not_verified_value: by_status.not_verified, // surfaced separately; NOT an exact figure
    grand_excluding_not_verified: grand_orientacni - by_status.not_verified,
    gap_additions,
    master_offer_total: masterOfferTotal,
    delta_vs_master: grand_orientacni - masterOfferTotal,
    delta_vs_master_pct: Math.round(((grand_orientacni - masterOfferTotal) / masterOfferTotal) * 1000) / 10,
  };
}
