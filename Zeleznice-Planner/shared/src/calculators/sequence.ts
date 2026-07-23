/**
 * Technologická posloupnost (TASK §3.9) — výstupem jsou ZÁVISLOSTI, ne
 * plochý seznam. Kanonický řetězec:
 *
 *   zemní práce spodku → pláň → konstrukční vrstvy → kolejové lože (spodní
 *   vrstva) → [demontáž překážek] → pokládka roštu → doplnění a úprava lože
 *   → 1. podbití → 2. podbití → dynamická stabilizace → zřízení BK
 *   (příprava → ověření polohy → svařování → upnutí → závěrné svary) →
 *   finální směrová a výšková úprava → kontrolní měření GPK → [zpětná montáž
 *   překážek] → předání
 *
 * Doménová pravidla:
 * - ověření prostorové polohy koleje PŘED zřízením BK (předchůdce, ne volba);
 * - demontáž/zpětná montáž překážek = samostatné položky (konkurence je
 *   zapomíná) — generují se automaticky;
 * - počet podbití není konstanta (novostavba/rekonstrukce/údržba — KB data);
 * - vrstvy spodek/svršek se nemíchají (layer tag na každé fázi).
 */
import { BK_PARAMS, TECHNOLOGY_PARAMS } from '../kb-generated/zeleznice-svrsek.js';
import type {
  ObstaclesInput,
  RailPhase,
  RailPlannerInput,
  RailQuantity,
} from '../types.js';
import { qBlank, qOk } from './quantity.js';
import type { ResolvedAssembly } from './resolve.js';
import type { TrackQuantitiesResult } from './track-quantities.js';
import type { BallastResult } from './ballast.js';

const GEOM = { document: 'geometrický převod (délka × sestava)', note: 'determinismus 1.0' };

function phase(
  id: string,
  name_cs: string,
  layer: 'spodek' | 'svrsek',
  depends_on: string[],
  extra: Partial<Pick<RailPhase, 'work_type' | 'quantity'>> = {},
): RailPhase {
  return {
    id,
    name_cs,
    layer,
    depends_on,
    work_type: extra.work_type,
    quantity: extra.quantity,
    machine: null,
    duration_days: qBlank('d', 'Doba se doplní z výkonové normy stroje / čety (viz nasazení strojů).'),
  };
}

function spodekQty(input: RailPlannerInput, workType: string): RailQuantity | undefined {
  const items = (input.spodek_items ?? []).filter(i => (i.work_type ?? 'ostatni') === workType);
  if (items.length === 0) return undefined;
  const units = new Set(items.map(i => i.unit));
  if (units.size > 1) {
    return qBlank(
      'mix',
      `Položky spodku (${workType}) mají různé jednotky (${[...units].join(', ')}) — agregát NEPOČÍTÁN, viz jednotlivé položky výkazu.`,
    );
  }
  const sum = items.reduce((a, i) => a + i.quantity, 0);
  return qOk(
    sum,
    items[0].unit,
    `Σ položek spodku typu '${workType}' (${items.map(i => i.quantity).join(' + ')})`,
    { document: 'výměry spodku zadané uživatelem (v1 pass-through)' },
    0.99,
  );
}

export function countObstacles(o: ObstaclesInput | undefined): number {
  if (!o) return 0;
  return (
    (o.prejezdy ?? 0) + (o.prechody ?? 0) + (o.ukolejneni ?? 0) + (o.magneticke_body ?? 0)
  );
}

export function buildTechnologySequence(
  input: RailPlannerInput,
  r: ResolvedAssembly,
  q: TrackQuantitiesResult,
  ballast: BallastResult,
): { phases: RailPhase[]; warnings: string[] } {
  const warnings: string[] = [];
  const kind = input.project_kind ?? 'novostavba';
  const passes = TECHNOLOGY_PARAMS.tamping_passes_by_project_kind[kind];
  const stabilize = TECHNOLOGY_PARAMS.dynamic_stabilization_by_project_kind[kind];
  const isBk = r.assembly.track_form === 'bezstykova';
  const L = r.delka_trati_m;
  const lenQty = (label: string): RailQuantity =>
    qOk(r.delka_koleje_m, 'm koleje', `${L} m trati × ${r.track_count} kolej(e) — ${label}`, GEOM, 1.0);

  const phases: RailPhase[] = [];
  const hasSpodek = kind === 'novostavba' || (input.spodek_items ?? []).length > 0;

  // ── Spodek ────────────────────────────────────────────────────────────────
  let lastSpodek: string | null = null;
  if (hasSpodek) {
    phases.push(
      phase('zemni_prace_spodku', 'Zemní práce železničního spodku', 'spodek', [], {
        quantity: spodekQty(input, 'zemni_prace'),
      }),
      phase('plan_spodku', 'Pláň tělesa železničního spodku (příčný sklon)', 'spodek', ['zemni_prace_spodku'], {
        quantity: spodekQty(input, 'plan_spodku'),
      }),
      phase('konstrukcni_vrstvy', 'Konstrukční vrstvy pod kolejovým ložem', 'spodek', ['plan_spodku'], {
        quantity: spodekQty(input, 'konstrukcni_vrstvy'),
      }),
    );
    if ((input.spodek_items ?? []).some(i => (i.work_type ?? '') === 'odvodneni')) {
      phases.push(
        phase('odvodneni_spodku', 'Odvodnění (trativody, příkopy, drenáže)', 'spodek', ['plan_spodku'], {
          quantity: spodekQty(input, 'odvodneni'),
        }),
      );
    }
    lastSpodek = 'konstrukcni_vrstvy';
    if ((input.spodek_items ?? []).length === 0 && kind === 'novostavba') {
      warnings.push(
        'ℹ️ Novostavba bez zadaných výměr spodku — fáze spodku jsou v posloupnosti, výměry doplňte jako položky spodku (vrstvy se nemíchají se svrškem).',
      );
    }
  }

  // ── Překážky (demontáž PŘED strojní linkou) ──────────────────────────────
  const obstaclesCount = countObstacles(input.obstacles);
  const demontazDeps = lastSpodek ? [lastSpodek] : [];
  phases.push(
    phase('demontaz_prekazek', 'Demontáž překážek před nasazením strojní linky (přejezdy, přechody, ukolejnění, MIB)', 'svrsek', demontazDeps, {
      quantity:
        obstaclesCount > 0
          ? qOk(obstaclesCount, 'ks', 'Σ překážek ze zadání (přejezdy + přechody + ukolejnění + MIB)', { document: 'zadání uživatele' }, 0.99)
          : qBlank('ks', 'Počty překážek nezadány — položka se generuje automaticky, doplňte počty (konkurence je běžně zapomíná).'),
    }),
  );
  if (obstaclesCount === 0) {
    warnings.push(
      'ℹ️ Překážky (přejezdy, přechody, ukolejnění, pojistné úhelníky, magnetické informační body) nezadány — demontáž/zpětná montáž je v posloupnosti s prázdnou výměrou.',
    );
  }

  // ── Svršek — lože, rošt, podbití ─────────────────────────────────────────
  if (kind === 'rekonstrukce') {
    phases.push(
      phase('cisteni_loze', 'Čištění kolejového lože (pročištění, doplnění kameniva)', 'svrsek', ['demontaz_prekazek'], {
        work_type: 'cisteni_loze',
        quantity: lenQty('čištění lože'),
      }),
    );
  }

  const lozeDeps = lastSpodek ? [lastSpodek] : [];
  if (kind !== 'udrzba') {
    phases.push(
      phase('loze_spodni_vrstva', 'Kolejové lože — spodní vrstva', 'svrsek', lozeDeps, {
        quantity: ballast.loze_objem_m3,
      }),
    );
    // pokládka roštu jde po spodní vrstvě lože a po demontáži překážek
    phases.push(
      phase('pokladka_rostu', 'Pokládka kolejového roštu', 'svrsek', ['loze_spodni_vrstva', 'demontaz_prekazek'], {
        work_type: 'pokladka_rostu',
        quantity: lenQty('pokládka roštu'),
      }),
    );
    phases.push(
      phase(
        'doplneni_loze',
        'Doplnění a úprava kolejového lože do profilu',
        'svrsek',
        kind === 'rekonstrukce' ? ['pokladka_rostu', 'cisteni_loze'] : ['pokladka_rostu'],
        { work_type: 'uprava_loze', quantity: lenQty('úprava lože do profilu') },
      ),
    );
  }

  const podbitiBase = kind === 'udrzba' ? ['demontaz_prekazek'] : ['doplneni_loze'];
  phases.push(
    phase('podbiti_1', '1. podbití (ASP)', 'svrsek', podbitiBase, {
      work_type: 'podbiti_trate',
      quantity: lenQty('1. podbití'),
    }),
  );
  let lastTamping = 'podbiti_1';
  if (passes >= 2) {
    phases.push(
      phase('podbiti_2', '2. podbití (ASP, propracování)', 'svrsek', ['podbiti_1'], {
        work_type: 'podbiti_trate',
        quantity: lenQty('2. podbití'),
      }),
    );
    lastTamping = 'podbiti_2';
  }
  if (stabilize) {
    phases.push(
      phase('stabilizace', 'Dynamická stabilizace', 'svrsek', [lastTamping], {
        work_type: 'stabilizace',
        quantity: lenQty('dynamická stabilizace'),
      }),
    );
    lastTamping = 'stabilizace';
  }

  // ── Výhybky ──────────────────────────────────────────────────────────────
  const turnoutCount = (input.turnouts ?? []).reduce((a, t) => a + t.count, 0);
  if (turnoutCount > 0) {
    const montazDeps = kind !== 'udrzba' ? ['pokladka_rostu'] : ['demontaz_prekazek'];
    phases.push(
      phase('vyhybky_montaz', 'Montáž výhybek', 'svrsek', montazDeps, {
        work_type: 'montaz_vyhybek',
        quantity: qOk(turnoutCount, 'ks', 'Σ výhybek ze zadání', { document: 'zadání uživatele' }, 0.99),
      }),
      phase('vyhybky_podbiti', 'Podbití výhybek (výhybková ASP)', 'svrsek', ['vyhybky_montaz', 'podbiti_1'], {
        work_type: 'podbiti_vyhybek',
        quantity: qOk(turnoutCount, 'ks', 'Σ výhybek ze zadání', { document: 'zadání uživatele' }, 0.99),
      }),
    );
  }

  // ── Bezstyková kolej (TASK §3.5 — nikdy jen „svar × počet") ──────────────
  if (isBk) {
    const svaryQty =
      q.svary_mezipasove_ks.status === 'ok'
        ? q.svary_mezipasove_ks
        : qBlank('ks', 'Počet svarů NEPOČÍTÁN (viz výměry).');
    phases.push(
      phase('bk_priprava', 'Směrová a výšková úprava koleje před zřízením BK (S3/1)', 'svrsek', [lastTamping], {
        quantity: lenQty('úprava před BK'),
      }),
      phase('bk_overeni_polohy', 'Ověření prostorové polohy koleje (geodet, M20/MP004) — PŘED upnutím', 'svrsek', ['bk_priprava'], {
        quantity: lenQty('ověření polohy'),
      }),
      phase('bk_svarovani', 'Svařování kolejnicových pásů', 'svrsek', ['bk_overeni_polohy'], {
        work_type: 'svarovani_kolejnic',
        quantity: svaryQty,
      }),
      phase('bk_upnuti', `Napínání / upnutí BK (upínací teplota ${BK_PARAMS.upinaci_teplota_c.min}–${BK_PARAMS.upinaci_teplota_c.max} °C; mimo rozsah = napínání/ohřev jako samostatná práce)`, 'svrsek', ['bk_svarovani'], {
        quantity: lenQty('upnutí BK'),
      }),
      phase('bk_zaverne_svary', 'Závěrné svary (dýchající konce)', 'svrsek', ['bk_upnuti'], {
        work_type: 'svarovani_kolejnic',
        quantity: q.zaverne_svary_ks,
      }),
      phase('bk_kontrolni_mereni', 'Kontrolní měření po zřízení BK', 'svrsek', ['bk_zaverne_svary'], {
        quantity: lenQty('kontrolní měření BK'),
      }),
    );
  }

  // ── Finál ────────────────────────────────────────────────────────────────
  const finalDeps = isBk ? ['bk_kontrolni_mereni'] : [lastTamping];
  if (turnoutCount > 0) finalDeps.push('vyhybky_podbiti');
  phases.push(
    phase('finalni_uprava', 'Finální směrová a výšková úprava koleje', 'svrsek', finalDeps, {
      work_type: 'podbiti_trate',
      quantity: lenQty('finální úprava'),
    }),
    phase('mereni_gpk', 'Kontrolní měření GPK (geometrické parametry koleje)', 'svrsek', ['finalni_uprava'], {
      quantity: lenQty('měření GPK'),
    }),
    phase('montaz_prekazek', 'Zpětná montáž překážek po strojní lince', 'svrsek', ['mereni_gpk'], {
      quantity:
        obstaclesCount > 0
          ? qOk(obstaclesCount, 'ks', 'Σ překážek ze zadání (zpětná montáž)', { document: 'zadání uživatele' }, 0.99)
          : qBlank('ks', 'Počty překážek nezadány.'),
    }),
    phase('predani', 'Předání (přejímka, doklady, GPK protokoly)', 'svrsek', ['montaz_prekazek'], {}),
  );

  // Sanity: každá závislost existuje (deterministický DAG bez překlepů).
  const ids = new Set(phases.map(p => p.id));
  for (const p of phases) {
    for (const dep of p.depends_on) {
      if (!ids.has(dep)) {
        throw new Error(`Interní chyba sekvence: fáze '${p.id}' závisí na neexistující '${dep}'`);
      }
    }
  }

  return { phases, warnings };
}
