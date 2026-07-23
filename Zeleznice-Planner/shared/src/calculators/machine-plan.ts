/**
 * Nasazení strojní linky (TASK §3.7) — jádro odlišení od konkurence.
 *
 * Výkon stroje NENÍ konstanta: závisí na režimu nasazení. Priorita zdrojů:
 *   uživatelská norma firmy 0.99 > technologický list / katalog (KB) > nikdy
 *   AI odhad — chybějící norma = honest-blank NEPOČÍTÁNO.
 * Volba stroje respektuje omezení (pražce Y, poloměr oblouku) — nevhodný
 * stroj se nenabídne, nebo jen s explicitním varováním (AC 9).
 */
import {
  RAIL_MACHINES,
  type RailMachineSpec,
  type MachineModeSpec,
} from '../kb-generated/zeleznice-mechanizace.js';
import type {
  RailMachineAssignment,
  RailMachineDeploymentRow,
  RailPhase,
  RailPlannerInput,
} from '../types.js';
import { qBlank, qOk, round } from './quantity.js';
import type { ResolvedAssembly } from './resolve.js';

const USER_NORM_SOURCE = 'uživatelská norma firmy';
const KB_NORM_SOURCE = 'technologický list / katalogový údaj (KB — orientační)';

/** Preferované režimy podle fáze — deterministická volba, vždy přebitelná vstupem. */
const MODE_HINTS: Record<string, string[]> = {
  podbiti_1: ['po_pokladce', 'dva_zabery', 'tratove_podbiti', 's_apk'],
  podbiti_2: ['propracovani', 's_apk', 'tratove_podbiti'],
  vyhybky_podbiti: ['jednoducha_vyhybka', 'slozita_vyhybka'],
};

export function resolveMachineRate(
  machine: RailMachineSpec,
  mode: MachineModeSpec,
  userNorms: RailPlannerInput['user_machine_norms'],
): { value: number | null; unit: 'm/h' | 'h/ks'; source: string; confidence: number } {
  const norm = (userNorms ?? []).find(
    n => n.machine_id === machine.id && (!n.mode_id || n.mode_id === mode.id),
  );
  if (norm) {
    return { value: norm.rate_value, unit: norm.rate_unit, source: USER_NORM_SOURCE, confidence: 0.99 };
  }
  return {
    value: mode.rate.value,
    unit: mode.rate.unit,
    source: mode.rate.value == null ? 'norma není v KB (honest-blank)' : KB_NORM_SOURCE,
    confidence: mode.rate.value == null ? 0 : mode.confidence,
  };
}

function pickMode(machine: RailMachineSpec, phaseId: string, modeId?: string): MachineModeSpec {
  if (modeId) {
    const m = machine.modes.find(x => x.id === modeId);
    if (m) return m;
  }
  for (const hint of MODE_HINTS[phaseId] ?? []) {
    const m = machine.modes.find(x => x.id === hint);
    if (m) return m;
  }
  return machine.modes[0];
}

function pickMachine(
  workType: string,
  input: RailPlannerInput,
  r: ResolvedAssembly,
  warnings: string[],
): { machine: RailMachineSpec | null; modeId?: string } {
  const choice = (input.machines ?? []).find(m => m.work_type === workType);
  if (choice) {
    const machine = RAIL_MACHINES.find(m => m.id === choice.machine_id) ?? null;
    if (!machine) {
      warnings.push(`⚠️ Zvolený stroj '${choice.machine_id}' není v registru — použit auto výběr.`);
    } else {
      if (!machine.work_types.includes(workType)) {
        warnings.push(
          `⚠️ Stroj ${machine.name_cs} není určen pro práci '${workType}' — ponechán dle volby uživatele, ověřte technologický list.`,
        );
      }
      if (machine.restrictions.excluded_sleeper_types.includes(r.sleeper.id)) {
        warnings.push(
          `⛔ Stroj ${machine.name_cs} nelze nasadit na pražce '${r.sleeper.name_cs}' (omezení registru: ${machine.restrictions.note_cs ?? 'viz technologický list'}).`,
        );
      }
      return { machine, modeId: choice.mode_id };
    }
  }
  // Auto: první vhodný stroj v pořadí registru, respektuje omezení pražců.
  const suitable = RAIL_MACHINES.filter(
    m => m.work_types.includes(workType) && !m.restrictions.excluded_sleeper_types.includes(r.sleeper.id),
  );
  if (suitable.length > 0) return { machine: suitable[0] };
  const anyMachine = RAIL_MACHINES.find(m => m.work_types.includes(workType));
  if (anyMachine) {
    warnings.push(
      `⛔ Pro práci '${workType}' na pražcích '${r.sleeper.name_cs}' není v registru vhodný stroj — ${anyMachine.name_cs} je vyloučen omezením.`,
    );
  }
  return { machine: null };
}

export function assignMachineToPhase(
  phase: RailPhase,
  input: RailPlannerInput,
  r: ResolvedAssembly,
  warnings: string[],
): RailMachineAssignment | null {
  if (!phase.work_type) return null;
  const { machine, modeId } = pickMachine(phase.work_type, input, r, warnings);
  if (!machine) return null;

  if (
    typeof input.curve_min_radius_m === 'number' &&
    machine.restrictions.min_curve_radius_m != null &&
    input.curve_min_radius_m < machine.restrictions.min_curve_radius_m
  ) {
    warnings.push(
      `⚠️ ${machine.name_cs}: nejmenší poloměr oblouku úseku ${input.curve_min_radius_m} m je pod pracovním limitem stroje ${machine.restrictions.min_curve_radius_m} m — ověřte nasazení (technologický list).`,
    );
  }

  const mode = pickMode(machine, phase.id, modeId);
  const rate = resolveMachineRate(machine, mode, input.user_machine_norms);
  return {
    machine_id: machine.id,
    machine_name_cs: machine.name_cs,
    mode_id: mode.id,
    mode_name_cs: mode.name_cs,
    rate_value: rate.value,
    rate_unit: rate.unit,
    rate_source: rate.source,
    rate_confidence: rate.confidence,
    crew_size: machine.crew_size,
  };
}

/**
 * Doba nasazení: hodiny = výměra / výkon (m/h) nebo výměra × pracnost (h/ks);
 * dny = hodiny / efektivní okno (výluka nebo směna). Ztrátové časy strojů
 * jsou v registru zatím null (S8/3 nenahráno) → ℹ️ poznámka, žádný odhad.
 */
export function computeDeployment(
  phases: RailPhase[],
  input: RailPlannerInput,
): { rows: RailMachineDeploymentRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const windowH = input.possession_window_h ?? input.shift_hours ?? 8;
  const windowLabel = input.possession_window_h
    ? `výlukové okno ${windowH} h/den`
    : `směna ${windowH} h/den (bez výlukového omezení)`;
  let setupNoted = false;

  const rows: RailMachineDeploymentRow[] = [];
  for (const phase of phases) {
    if (!phase.work_type) continue;
    const m = phase.machine ?? null;
    const qty = phase.quantity;

    if (!m || qty == null || qty.status !== 'ok') {
      const reason = !m
        ? 'Stroj nepřiřazen (žádný vhodný v registru).'
        : 'Řídicí výměra fáze NEPOČÍTÁNA.';
      rows.push({
        phase_id: phase.id,
        phase_name_cs: phase.name_cs,
        machine: m,
        hours: qBlank('h', reason),
        days: qBlank('d', reason),
      });
      continue;
    }

    if (m.rate_value == null) {
      const reason = `Výkonová norma stroje ${m.machine_name_cs} (režim ${m.mode_name_cs}) není v KB — doplňte firemní normou nebo nahrajte technologický list S8/3. AI odhad je zakázán.`;
      rows.push({
        phase_id: phase.id,
        phase_name_cs: phase.name_cs,
        machine: m,
        hours: qBlank('h', reason),
        days: qBlank('d', reason),
      });
      warnings.push(`⚠️ ${phase.name_cs}: doba NEPOČÍTÁNA — ${reason}`);
      continue;
    }

    if (!setupNoted) {
      warnings.push(
        'ℹ️ Ztrátové časy strojů (přestavení do pracovní/přepravní polohy, přejezdy) nejsou v KB — doba nasazení je čistý výkon; doplňte z technologických listů S8/3.',
      );
      setupNoted = true;
    }

    const hoursVal =
      m.rate_unit === 'm/h' ? qty.value! / m.rate_value : qty.value! * m.rate_value;
    const hours = qOk(
      round(hoursVal, 2),
      'h',
      m.rate_unit === 'm/h'
        ? `${qty.value} ${qty.unit} / ${m.rate_value} m/h (${m.mode_name_cs})`
        : `${qty.value} ${qty.unit} × ${m.rate_value} h/ks (${m.mode_name_cs})`,
      { document: m.rate_source, note: `${m.machine_name_cs}, režim ${m.mode_name_cs}` },
      m.rate_confidence,
    );
    const days = qOk(
      round(hoursVal / windowH, 2),
      'd',
      `${round(hoursVal, 2)} h / ${windowH} h (${windowLabel})`,
      { document: m.rate_source, note: windowLabel },
      m.rate_confidence,
    );
    rows.push({ phase_id: phase.id, phase_name_cs: phase.name_cs, machine: m, hours, days });
  }
  return { rows, warnings };
}
