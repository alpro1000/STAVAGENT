/**
 * planRailSection — deterministický orchestrátor železničního modulu.
 *
 * Vstup: délka úseku + sestava svršku (+ volitelné vrstvy: lože profil,
 * výhybky, spodek, mechanizace, výluky). Výstup: výměry s formulí a zdrojem,
 * výkaz oddělený po vrstvách spodek/svršek, technologická posloupnost se
 * závislostmi, nasazení strojní linky, osádky a varování.
 *
 * Invarianty (docs/specs/zeleznicni-svrsek-spodek/):
 * - replay guarantee: stejné vstupy → stejný výstup (žádný čas/náhoda);
 * - honest-blank: chybějící vstup/norma = NEPOČÍTÁNO s důvodem, nikdy odhad;
 * - vrstvy spodek/svršek se nemíchají (layer tag všude);
 * - katalog až PO dekompozici (bindCatalog poslední krok);
 * - km trati ≠ km koleje (vícekolejné úseky na kolej).
 */
import type {
  RailPlanResult,
  RailPlannerInput,
  RailStructuredWarning,
  RailVykazItem,
} from '../types.js';
import { calculateBallast } from './ballast.js';
import { bindCatalog } from './catalog-binding.js';
import { buildCrewPlan } from './crew-plan.js';
import { assignMachineToPhase, computeDeployment } from './machine-plan.js';
import { qBlank, qOk } from './quantity.js';
import { resolveAssembly } from './resolve.js';
import { buildTechnologySequence } from './sequence.js';
import { calculateTrackQuantities } from './track-quantities.js';
import { calculateTurnoutWorks } from './turnout-works.js';

export const RAIL_ENGINE_VERSION = '1.0.0';

/** ⛔ critical / ⚠️ warning / ℹ️ info — zrcadlí konvenci Monolit enginu (v4.22/v4.38). */
function structureWarnings(warnings: string[]): RailStructuredWarning[] {
  return warnings.map(message => {
    if (message.startsWith('⛔')) return { severity: 'critical', message };
    if (message.startsWith('⚠️')) return { severity: 'warning', message };
    return { severity: 'info', message };
  });
}

export function planRailSection(input: RailPlannerInput): RailPlanResult {
  const warnings: string[] = [];

  // ── 1. Rezoluce sestavy + délky (sestava je primární volba — TASK §3.2) ──
  const r = resolveAssembly(input);
  const contractType = input.contract_type ?? 'sz_verejna';
  if (!input.contract_type) {
    warnings.push(
      'ℹ️ Typ zakázky nezadán — katalogový routing default SŽ/veřejná (OTSKP ŽS + ÚOŽI). Pro vlečku zvolte typ „vlečka" (ÚRS 824-1).',
    );
  }

  // ── 2. Deterministické výměry svršku ─────────────────────────────────────
  const q = calculateTrackQuantities(input, r);
  warnings.push(...q.warnings);

  // ── 3. Kolejové lože z příčného profilu (nikdy paušál) ───────────────────
  const ballast = calculateBallast(input, r);
  warnings.push(...ballast.warnings);

  // ── 4. Výhybky — kusové konstrukce ───────────────────────────────────────
  const turnouts = calculateTurnoutWorks(input, r.assembly.track_form);
  warnings.push(...turnouts.warnings);

  // ── 5. Technologická posloupnost se závislostmi (spodek → … → předání) ──
  const seq = buildTechnologySequence(input, r, q, ballast);
  warnings.push(...seq.warnings);

  // ── 6. Strojní linka: přiřazení strojů + doby (užiratelská norma > KB) ──
  for (const phase of seq.phases) {
    phase.machine = assignMachineToPhase(phase, input, r, warnings);
  }
  const deployment = computeDeployment(seq.phases, input);
  warnings.push(...deployment.warnings);
  // Duration zpět do fází (jediný zdroj — deployment).
  for (const row of deployment.rows) {
    const phase = seq.phases.find(p => p.id === row.phase_id);
    if (phase) phase.duration_days = row.days;
  }

  // ── 7. Osádky (stroj) + četa (Pattern 50) + bezpečnostní role ───────────
  const crewPlan = buildCrewPlan(input, r, deployment.rows);
  warnings.push(...crewPlan.warnings);

  // ── 8. Výkaz výměr — vrstvy se NIKDY nemíchají ──────────────────────────
  const vykazUnbound: RailVykazItem[] = [];
  const push = (item: RailVykazItem) => vykazUnbound.push(item);

  push({ id: 'kolejnice', layer: 'svrsek', name_cs: `Kolejnice ${r.profile.name_cs} — dodávka a pokládka`, unit: 't', quantity: q.kolejnice_hmotnost_t, phase_id: 'pokladka_rostu' });
  push({ id: 'kolejnice_delka', layer: 'svrsek', name_cs: `Kolejnicové pásy ${r.profile.name_cs}`, unit: 'm', quantity: q.kolejnice_delka_m, phase_id: 'pokladka_rostu' });
  push({ id: 'prazce', layer: 'svrsek', name_cs: `Pražce ${r.sleeper.name_cs} — rozdělení ${r.spacing_code ?? 'dle rozteče'}`, unit: 'ks', quantity: q.prazce_ks, phase_id: 'pokladka_rostu' });
  push({ id: 'prazce_hmotnost', layer: 'svrsek', name_cs: 'Pražce — hmotnost (doprava, jeřáby)', unit: 't', quantity: q.prazce_hmotnost_t, phase_id: 'pokladka_rostu' });
  push({ id: 'upevneni', layer: 'svrsek', name_cs: `Upevnění ${r.fastening.name_cs} — komplety`, unit: 'kompletů', quantity: q.upevneni_komplety_ks, phase_id: 'pokladka_rostu' });
  push({ id: 'loze', layer: 'svrsek', name_cs: 'Kolejové lože — kamenivo (z příčného profilu)', unit: 'm³', quantity: ballast.loze_objem_m3, phase_id: 'loze_spodni_vrstva' });

  if (r.assembly.track_form === 'stykovana') {
    push({ id: 'styky', layer: 'svrsek', name_cs: 'Kolejnicové styky (spojky + spojkové šrouby)', unit: 'ks', quantity: q.styky_ks, phase_id: 'pokladka_rostu' });
  } else {
    push({ id: 'svary', layer: 'svrsek', name_cs: 'Svary mezipásové (zřízení BK)', unit: 'ks', quantity: q.svary_mezipasove_ks, phase_id: 'bk_svarovani' });
    push({ id: 'zaverne_svary', layer: 'svrsek', name_cs: 'Závěrné svary BK', unit: 'ks', quantity: q.zaverne_svary_ks, phase_id: 'bk_zaverne_svary' });
    push({ id: 'bk_upnuti_item', layer: 'svrsek', name_cs: 'Napínání / upnutí bezstykové koleje', unit: 'm', quantity: qOk(r.delka_koleje_m, 'm', `${r.delka_trati_m} m × ${r.track_count} kolej(e)`, { document: 'geometrický převod' }, 1.0), phase_id: 'bk_upnuti' });
  }
  if (input.izolovane_styky_ks && input.izolovane_styky_ks > 0) {
    push({ id: 'izolovane_styky', layer: 'svrsek', name_cs: 'Izolované styky', unit: 'ks', quantity: qOk(input.izolovane_styky_ks, 'ks', 'zadáno uživatelem', { document: 'zadání uživatele' }, 0.99), phase_id: 'pokladka_rostu' });
  }

  for (const t of turnouts.results) {
    push({ id: `vyhybka_${t.form_id}`, layer: 'svrsek', name_cs: `Výhybka ${t.name_cs} — montáž`, unit: 'ks', quantity: qOk(t.count, 'ks', 'zadáno uživatelem', { document: 'zadání uživatele' }, 0.99), phase_id: 'vyhybky_montaz' });
    if (t.bk_svary_ks.status === 'ok' && (t.bk_svary_ks.value ?? 0) > 0) {
      push({ id: `vyhybka_${t.form_id}_bk_svary`, layer: 'svrsek', name_cs: `Vevaření výhybky ${t.name_cs} do BK — svary`, unit: 'ks', quantity: t.bk_svary_ks, phase_id: 'bk_svarovani' });
    }
  }

  const obst = input.obstacles ?? {};
  const obstEntries: Array<[string, string, number | undefined, string]> = [
    ['prejezdy', 'Přejezdy — demontáž a zpětná montáž', obst.prejezdy, 'ks'],
    ['prechody', 'Přechody — demontáž a zpětná montáž', obst.prechody, 'ks'],
    ['ukolejneni', 'Ukolejnění — demontáž a zpětná montáž', obst.ukolejneni, 'ks'],
    ['pojistne_uhelniky', 'Pojistné úhelníky — demontáž a zpětná montáž', obst.pojistne_uhelniky_m, 'm'],
    ['magneticke_body', 'Magnetické informační body — demontáž a zpětná montáž', obst.magneticke_body, 'ks'],
  ];
  for (const [id, name, count, unit] of obstEntries) {
    if (count && count > 0) {
      push({ id: `prekazky_${id}`, layer: 'svrsek', name_cs: name, unit, quantity: qOk(count, unit, 'zadáno uživatelem (samostatné položky — TASK §3.9)', { document: 'zadání uživatele' }, 0.99), phase_id: 'demontaz_prekazek' });
    }
  }

  // Spodek — pass-through položky, vždy layer='spodek' (nikdy do svršku).
  (input.spodek_items ?? []).forEach((item, i) => {
    const wt = item.work_type ?? 'ostatni';
    const phaseId =
      wt === 'zemni_prace' ? 'zemni_prace_spodku'
      : wt === 'plan_spodku' ? 'plan_spodku'
      : wt === 'konstrukcni_vrstvy' ? 'konstrukcni_vrstvy'
      : wt === 'odvodneni' ? 'odvodneni_spodku'
      : undefined;
    push({
      id: `spodek_${i}_${wt}`,
      layer: 'spodek',
      name_cs: item.name_cs,
      unit: item.unit,
      quantity: qOk(item.quantity, item.unit, 'výměra spodku zadaná uživatelem (v1 pass-through)', { document: 'zadání uživatele' }, 0.99),
      phase_id: phaseId,
    });
  });

  // ── 9. Katalog AŽ NAKONEC (Catalog-Last — Pattern 15) ───────────────────
  const vykaz = bindCatalog(vykazUnbound, contractType);

  return {
    meta: {
      engine_version: RAIL_ENGINE_VERSION,
      replay_note:
        'Replay guarantee: stejné vstupy → stejný výstup; každé číslo nese vzorec, zdroj a confidence. Chybějící vstup/norma = NEPOČÍTÁNO, nikdy odhad.',
    },
    section: {
      km_od: r.km_od,
      km_do: r.km_do,
      delka_trati_m: r.delka_trati_m,
      delka_koleje_m: r.delka_koleje_m,
      track_count: r.track_count,
    },
    assembly: {
      assembly_id: r.assembly.id,
      name_cs: r.assembly.name_cs,
      rail_profile: r.profile.name_cs,
      sleeper_type: r.sleeper.name_cs,
      fastening: r.fastening.name_cs,
      track_form: r.assembly.track_form,
      spacing_code: r.spacing_code,
      field_length_m: r.field_length_m,
    },
    quantities: {
      prazce_ks: q.prazce_ks,
      prazce_hmotnost_t: q.prazce_hmotnost_t,
      kolejnice_delka_m: q.kolejnice_delka_m,
      kolejnice_hmotnost_t: q.kolejnice_hmotnost_t,
      upevneni_komplety_ks: q.upevneni_komplety_ks,
      kolejova_pole_ks: q.kolejova_pole_ks,
      styky_ks: q.styky_ks,
      svary_mezipasove_ks: q.svary_mezipasove_ks,
      zaverne_svary_ks: q.zaverne_svary_ks,
      loze_prurez_m2: ballast.loze_prurez_m2,
      loze_objem_m3: ballast.loze_objem_m3,
    },
    vykaz,
    turnouts: turnouts.results,
    bk_chain: seq.phases.filter(p => p.id.startsWith('bk_')),
    sequence: seq.phases,
    machine_deployment: deployment.rows,
    crews: crewPlan.crews,
    warnings,
    warnings_structured: structureWarnings(warnings),
  };
}
