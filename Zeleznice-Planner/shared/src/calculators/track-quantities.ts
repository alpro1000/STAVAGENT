/**
 * Deterministické výměry kolejového roštu ze sestavy + délky (TASK §3.3/§3.4).
 *
 * Klíčové doménové převody (vše vzorec, confidence 1.0 na geometrii,
 * confidence tabulky na tabulkových hodnotách):
 * - počet pražců: tabulka rozdělení (ks/km × km koleje, po kolejích) NEBO
 *   rozteč upevňovacích bodů (pražce Y — samostatný vzorec);
 * - dvojčitý dřevěný pražec u styku stykované koleje = DVA pražce;
 * - kolejnice: 2 pásy × délka koleje; hmotnost z metrové hmotnosti tvaru
 *   (chybí-li v KB → honest-blank, např. tvar T);
 * - upevnění: pražce × upevňovací uzly na pražec;
 * - stykovaná: kolejová pole + vnitřní styky; bezstyková: svary mezipásové
 *   z dodávané délky pásů + závěrné svary.
 */
import {
  BK_PARAMS,
  SPACING_TABLE_CONFIDENCE,
  SPACING_TABLE_SOURCE,
} from '../kb-generated/zeleznice-svrsek.js';
import type { RailPlannerInput, RailQuantity } from '../types.js';
import { qBlank, qOk, round } from './quantity.js';
import type { ResolvedAssembly } from './resolve.js';

export interface TrackQuantitiesResult {
  prazce_ks: RailQuantity;
  prazce_hmotnost_t: RailQuantity;
  kolejnice_delka_m: RailQuantity;
  kolejnice_hmotnost_t: RailQuantity;
  upevneni_komplety_ks: RailQuantity;
  kolejova_pole_ks: RailQuantity;
  styky_ks: RailQuantity;
  svary_mezipasove_ks: RailQuantity;
  zaverne_svary_ks: RailQuantity;
  /** Doprovodné poznámky (⚠️/ℹ️ řádky pro orchestrátor). */
  warnings: string[];
}

export function calculateTrackQuantities(
  input: RailPlannerInput,
  r: ResolvedAssembly,
): TrackQuantitiesResult {
  const warnings: string[] = [];
  const L = r.delka_trati_m;
  const tracks = r.track_count;
  const geomSource = { document: 'geometrický převod (délka × sestava)', note: 'determinismus 1.0' };

  // ── Pražce ────────────────────────────────────────────────────────────────
  let prazce: RailQuantity;
  const poliNaKolej = Math.ceil(L / r.field_length_m);

  if (r.sleeper.count_mode === 'spacing') {
    // Pražec tvaru Y — počet z rozteče upevňovacích bodů (TASK §3.3),
    // nikdy z tabulky rozdělení.
    const spacing = input.y_sleeper_spacing_m ?? r.sleeper.default_spacing_m ?? null;
    if (spacing == null || spacing <= 0) {
      prazce = qBlank(
        'ks',
        'Rozteč upevňovacích bodů pražce Y není zadána ani v KB — počet pražců NEPOČÍTÁN.',
      );
    } else {
      const perTrack = Math.ceil(L / spacing);
      const total = perTrack * tracks;
      const userGiven = typeof input.y_sleeper_spacing_m === 'number';
      if (!userGiven) {
        warnings.push(
          `⚠️ Rozteč pražců Y ${spacing} m převzata z KB (orientační katalogová hodnota) — potvrďte projektem.`,
        );
      }
      prazce = qOk(
        total,
        'ks',
        `ceil(${L} m / ${spacing} m) × ${tracks} kolej(e) = ${perTrack} × ${tracks}`,
        userGiven
          ? { document: 'rozteč zadaná uživatelem', note: 'pražce Y — vzorec z rozteče' }
          : {
              document: r.sleeper.spacing_source?.document ?? 'KB',
              note: 'pražce Y — vzorec z rozteče (orientační)',
            },
        userGiven ? 0.99 : 0.7,
      );
    }
  } else {
    const row = r.spacing_row!;
    const perTrack = Math.ceil((L / 1000) * row.sleepers_per_km);
    let total = perTrack * tracks;
    let formula = `ceil(${L / 1000} km × ${row.sleepers_per_km} ks/km) × ${tracks} kolej(e) = ${perTrack} × ${tracks}`;

    // Dvojčitý dřevěný pražec u styku stykované koleje = 2 pražce.
    if (r.assembly.track_form === 'stykovana' && r.sleeper.twin_at_joints) {
      const stykuMist = Math.max(0, poliNaKolej - 1) * tracks;
      total += stykuMist;
      formula += ` + ${stykuMist} dvojčitých u styků (1 navíc na styk)`;
      warnings.push(
        `ℹ️ Dvojčité dřevěné pražce u styků: +${stykuMist} ks (dvojčitý pražec se počítá jako dva — ÚRS 824-1 příloha).`,
      );
    }
    prazce = qOk(
      total,
      'ks',
      formula,
      {
        document: SPACING_TABLE_SOURCE.document,
        note: `rozdělení '${r.spacing_code}' @ pole ${r.field_length_m} m; průměr vč. zhuštění u styků`,
      },
      SPACING_TABLE_CONFIDENCE,
    );
  }

  // Hmotnost pražců (vstup pro dopravu a jeřáby — TASK §3.4).
  let prazceHmotnost: RailQuantity;
  if (prazce.status === 'ok' && r.sleeper.mass_kg != null) {
    const t = round((prazce.value! * r.sleeper.mass_kg) / 1000);
    prazceHmotnost = qOk(
      t,
      't',
      `${prazce.value} ks × ${r.sleeper.mass_kg} kg / 1000`,
      { document: r.sleeper.mass_source.document, note: r.sleeper.mass_source.note ?? undefined },
      Math.min(prazce.confidence, r.sleeper.confidence),
    );
  } else {
    prazceHmotnost = qBlank(
      't',
      prazce.status !== 'ok'
        ? 'Počet pražců NEPOČÍTÁN — hmotnost nelze odvodit.'
        : `Hmotnost pražce '${r.sleeper.id}' není v KB — doplňte zdroj (katalog výrobce).`,
    );
  }

  // ── Kolejnice ─────────────────────────────────────────────────────────────
  const delkaPasu = L * 2 * tracks;
  const kolejniceDelka = qOk(
    delkaPasu,
    'm',
    `${L} m × 2 pásy × ${tracks} kolej(e)`,
    geomSource,
    1.0,
  );
  let kolejniceHmotnost: RailQuantity;
  if (r.profile.mass_kg_per_m != null) {
    const t = round((delkaPasu * r.profile.mass_kg_per_m) / 1000);
    kolejniceHmotnost = qOk(
      t,
      't',
      `${delkaPasu} m × ${r.profile.mass_kg_per_m} kg/m / 1000`,
      { document: r.profile.source.document, note: r.profile.source.note ?? undefined },
      r.profile.confidence,
    );
  } else {
    kolejniceHmotnost = qBlank(
      't',
      `Metrová hmotnost tvaru '${r.profile.id}' není v KB (${r.profile.source.document}) — hmotnost kolejnic NEPOČÍTÁNA.`,
    );
    warnings.push(
      `⚠️ Hmotnost kolejnic NEPOČÍTÁNA — tvar '${r.profile.id}' nemá metrovou hmotnost v KB (doplňte zdroj).`,
    );
  }

  // ── Upevnění ──────────────────────────────────────────────────────────────
  let upevneni: RailQuantity;
  if (prazce.status === 'ok') {
    const nodes = r.sleeper.fastening_nodes_per_sleeper;
    upevneni = qOk(
      prazce.value! * nodes,
      'kompletů',
      `${prazce.value} pražců × ${nodes} upevňovací uzly/pražec`,
      {
        document: r.fastening.source.document,
        note: `komplet = 1 uzel (${r.fastening.name_cs}); složení kompletu viz KB`,
      },
      Math.min(prazce.confidence, r.fastening.confidence),
    );
  } else {
    upevneni = qBlank('kompletů', 'Počet pražců NEPOČÍTÁN — upevnění nelze odvodit.');
  }

  // ── Stykovaná: pole + styky / Bezstyková: svary ──────────────────────────
  let pole: RailQuantity;
  let styky: RailQuantity;
  let svary: RailQuantity;
  let zaverne: RailQuantity;

  if (r.assembly.track_form === 'stykovana') {
    pole = qOk(
      poliNaKolej * tracks,
      'ks',
      `ceil(${L} / ${r.field_length_m}) × ${tracks} kolej(e) = ${poliNaKolej} × ${tracks}`,
      geomSource,
      1.0,
    );
    const stykyKs = Math.max(0, poliNaKolej - 1) * 2 * tracks;
    styky = qOk(
      stykyKs,
      'ks',
      `(${poliNaKolej} polí − 1) × 2 pásy × ${tracks} kolej(e) — vnitřní styky; koncové napojení mimo úsek nezapočteno`,
      geomSource,
      1.0,
    );
    svary = qBlank('ks', 'Stykovaná kolej — svary mezipásové se nezřizují (jen případné závěrné u napojení na BK mimo rozsah v1).');
    zaverne = qBlank('ks', 'Stykovaná kolej — závěrné svary jsou součást zřízení BK.');
  } else {
    pole = qBlank('ks', 'Bezstyková kolej — kolejová pole se nepočítají (pásy svařeny do BK).');
    styky = qBlank('ks', 'Bezstyková kolej — styky jen izolované (samostatná položka dle zadání).');
    const delivery = input.rail_delivery_length_m ?? BK_PARAMS.default_rail_delivery_length_m;
    const svaruNaPas = Math.max(0, Math.ceil(L / delivery) - 1);
    svary = qOk(
      svaruNaPas * 2 * tracks,
      'ks',
      `(ceil(${L} / ${delivery} m dodávané délky) − 1) × 2 pásy × ${tracks} kolej(e) = ${svaruNaPas} × 2 × ${tracks}`,
      {
        document: BK_PARAMS.delivery_source.document,
        note: `dodávaná délka pásů ${delivery} m${input.rail_delivery_length_m ? ' (zadáno uživatelem)' : ' (KB default — ověřte dle zakázky)'}`,
      },
      input.rail_delivery_length_m ? 0.99 : 0.8,
    );
    if (!input.rail_delivery_length_m) {
      warnings.push(
        `ℹ️ Dodávaná délka kolejnicových pásů ${delivery} m = KB default — počet svarů ověřte dle skutečné dodávky.`,
      );
    }
    const zav = 2 * BK_PARAMS.zaverne_svary_per_ras_end * 2 * tracks;
    zaverne = qOk(
      zav,
      'ks',
      `2 konce × ${BK_PARAMS.zaverne_svary_per_ras_end} × 2 pásy × ${tracks} kolej(e)`,
      { document: 'předpis S3/2 (orientační) — závěrné svary na koncích BK', note: 'dýchající konce' },
      0.8,
    );
  }

  return {
    prazce_ks: prazce,
    prazce_hmotnost_t: prazceHmotnost,
    kolejnice_delka_m: kolejniceDelka,
    kolejnice_hmotnost_t: kolejniceHmotnost,
    upevneni_komplety_ks: upevneni,
    kolejova_pole_ks: pole,
    styky_ks: styky,
    svary_mezipasove_ks: svary,
    zaverne_svary_ks: zaverne,
    warnings,
  };
}
