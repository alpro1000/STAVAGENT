/**
 * Výhybky (TASK §3.6) — KUSOVÉ konstrukce s pracností v h/ks podle tvaru.
 * Metrická (m/h) a kusová (h/ks) metrika se NIKDY nemíchají.
 *
 * Podbití: orientační rozsah z KB (výhybková ASP), použit střed rozsahu se
 * zdrojem a rozsahem ve vzorci. Montáž: norma není v KB → honest-blank,
 * dokud ji nedodá uživatelská norma (stroj 'jerab_montaz_vyhybek').
 */
import { TURNOUT_FORMS, type TurnoutFormSpec } from '../kb-generated/zeleznice-vyhybky.js';
import { RAIL_MACHINES } from '../kb-generated/zeleznice-mechanizace.js';
import { RailInputError, type RailPlannerInput, type RailTurnoutResult } from '../types.js';
import { qBlank, qOk, round } from './quantity.js';
import { resolveMachineRate } from './machine-plan.js';

export function findTurnoutForm(formId: string): TurnoutFormSpec {
  const form = TURNOUT_FORMS.find(t => t.id === formId);
  if (!form) {
    throw new RailInputError(
      `Neznámý tvar výhybky '${formId}'. Povolené: ${TURNOUT_FORMS.map(t => t.id).join(', ')}`,
    );
  }
  return form;
}

export function calculateTurnoutWorks(
  input: RailPlannerInput,
  trackForm: 'stykovana' | 'bezstykova',
): { results: RailTurnoutResult[]; warnings: string[] } {
  const warnings: string[] = [];
  const results: RailTurnoutResult[] = [];
  const montazMachine = RAIL_MACHINES.find(m => m.id === 'jerab_montaz_vyhybek');

  for (const t of input.turnouts ?? []) {
    if (!Number.isInteger(t.count) || t.count < 1) {
      throw new RailInputError(`Počet výhybek tvaru '${t.form_id}' musí být celé číslo ≥ 1.`);
    }
    const form = findTurnoutForm(t.form_id);
    const mid = round((form.tamping_h_per_unit.min + form.tamping_h_per_unit.max) / 2, 2);
    const podbiti = qOk(
      round(mid * t.count, 2),
      'h',
      `${t.count} ks × ${mid} h/ks (střed rozsahu ${form.tamping_h_per_unit.min}–${form.tamping_h_per_unit.max} h/ks, tvar ${form.name_cs})`,
      {
        document: 'technologické listy ASP pro výhybky (S8/3) — orientační',
        note: `složitost: ${form.complexity}`,
      },
      form.confidence,
    );

    // Montáž: KB nemá normu (null) → honest-blank; uživatelská norma přes
    // stroj 'jerab_montaz_vyhybek' (h/ks) ji dodá s prioritou 0.99.
    let montaz = qBlank(
      'h',
      `Montážní norma výhybky (${form.name_cs}) není v KB — doplňte firemní normou (stroj 'jerab_montaz_vyhybek', h/ks) nebo nahrajte technologický list.`,
    );
    if (montazMachine) {
      const rate = resolveMachineRate(montazMachine, montazMachine.modes[0], input.user_machine_norms);
      if (rate.value != null && rate.unit === 'h/ks') {
        montaz = qOk(
          round(rate.value * t.count, 2),
          'h',
          `${t.count} ks × ${rate.value} h/ks (${rate.source})`,
          { document: rate.source },
          rate.confidence,
        );
      }
    }

    const bkSvary =
      trackForm === 'bezstykova'
        ? qOk(
            form.bk_welds_per_unit * t.count,
            'ks',
            `${t.count} ks × ${form.bk_welds_per_unit} svarů/ks (vevaření do BK — kolejnicové konce × pásy, orientační)`,
            { document: 'předpis S3/2 — vevaření výhybek do BK (orientační do nahrání)' },
            0.8,
          )
        : qBlank('ks', 'Stykovaná kolej — výhybka se nevevařuje do BK.');

    results.push({
      form_id: form.id,
      name_cs: form.name_cs,
      complexity: form.complexity,
      count: t.count,
      podbiti_hours: podbiti,
      montaz_hours: montaz,
      bk_svary_ks: bkSvary,
    });
  }

  if (results.some(r => r.montaz_hours.status === 'nepocitano')) {
    warnings.push(
      '⚠️ Montáž výhybek: pracnost NEPOČÍTÁNA — montážní norma není v KB (doplňte firemní normou, AI odhad je zakázán).',
    );
  }
  return { results, warnings };
}
