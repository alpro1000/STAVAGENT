/**
 * Osádky a čety (TASK §3.8 + Pattern 50 front-capacity staffing):
 * - osádka stroje je vázaná na STROJ (registr), ne na objem práce;
 * - četa na trati je omezena KAPACITOU PRACOVNÍ FRONTY (délkou výlukového
 *   úseku), ne objemem — zvětšení objemu ≠ lineární nárůst lidí;
 * - bezpečnostní role (hlídka, dozor) jsou POVINNOU součástí osádky, ne režií.
 */
import {
  SAFETY_ROLES,
  TRACK_GANG,
} from '../kb-generated/zeleznice-mechanizace.js';
import type {
  RailCrewPlan,
  RailMachineDeploymentRow,
  RailPlannerInput,
} from '../types.js';
import type { ResolvedAssembly } from './resolve.js';

export function buildCrewPlan(
  input: RailPlannerInput,
  r: ResolvedAssembly,
  deployment: RailMachineDeploymentRow[],
): { crews: RailCrewPlan; warnings: string[] } {
  const warnings: string[] = [];

  // Osádky strojů — deduplikované podle stroje (jeden stroj = jedna osádka).
  const seen = new Set<string>();
  const machine_crews: RailCrewPlan['machine_crews'] = [];
  for (const row of deployment) {
    const m = row.machine;
    if (!m || seen.has(m.machine_id)) continue;
    seen.add(m.machine_id);
    machine_crews.push({
      machine_id: m.machine_id,
      machine_name_cs: m.machine_name_cs,
      crew_size: m.crew_size,
      source:
        m.crew_size == null
          ? 'obsazení stroje není v KB (S8/3 technologický list nenahrán) — honest-blank'
          : 'registr mechanizace (KB — orientační)',
    });
    if (m.crew_size == null) {
      warnings.push(
        `⚠️ Obsazení stroje ${m.machine_name_cs} není v KB — doplňte z technologického listu S8/3 nebo firemní normou.`,
      );
    }
  }

  // Pattern 50: četa = min(base, kapacita fronty); fronta = výlukový úsek.
  const front = input.front_length_m ?? r.delka_trati_m;
  const capacity = Math.max(1, Math.floor(front / TRACK_GANG.workspace_m_per_worker));
  const gangSize = Math.max(2, Math.min(TRACK_GANG.base_size, capacity));
  if (capacity < TRACK_GANG.base_size) {
    warnings.push(
      `ℹ️ Pracovní fronta ${front} m omezuje četu na ${gangSize} os. (kapacita fronty ${capacity} — Pattern 50: četu určuje fronta, ne objem).`,
    );
  }

  const safety_roles = SAFETY_ROLES.map(role => ({
    id: role.id,
    name_cs: role.name_cs,
    count: role.count_per_gang,
    mandatory: role.mandatory,
  }));

  warnings.push(
    '⚠️ Velikost čety a kapacita fronty jsou ORIENTAČNÍ KB hodnoty — kalibrujte firemní normou / golden objektem.',
  );

  return {
    crews: {
      machine_crews,
      track_gang: {
        size: gangSize,
        base_size: TRACK_GANG.base_size,
        front_length_m: front,
        front_capacity_limit: capacity,
        workspace_m_per_worker: TRACK_GANG.workspace_m_per_worker,
        source: `${TRACK_GANG.base_size_source}; fronta: ${TRACK_GANG.workspace_source}`,
        confidence: TRACK_GANG.confidence,
      },
      safety_roles,
    },
    warnings,
  };
}
