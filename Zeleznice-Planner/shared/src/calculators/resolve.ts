/**
 * Input resolution — sestava svršku je primární volba (TASK §3.2): z jednoho
 * assembly_id se deterministicky odvodí kolejnice, pražce, upevnění a
 * rozdělení. Neznámé id = RailInputError s výčtem povolených hodnot
 * (žádné tiché fallbacky).
 */
import {
  RAIL_PROFILES,
  SLEEPER_TYPES,
  FASTENING_SYSTEMS,
  SLEEPER_SPACING_TABLE,
  TRACK_ASSEMBLIES,
  type RailProfileSpec,
  type SleeperTypeSpec,
  type FasteningSystemSpec,
  type SleeperSpacingRow,
  type TrackAssemblySpec,
} from '../kb-generated/zeleznice-svrsek.js';
import { RailInputError, RailUncalculatedError, type RailPlannerInput } from '../types.js';

export interface ResolvedAssembly {
  assembly: TrackAssemblySpec;
  profile: RailProfileSpec;
  sleeper: SleeperTypeSpec;
  fastening: FasteningSystemSpec;
  /** null jen pro count_mode='spacing' (pražce Y). */
  spacing_row: SleeperSpacingRow | null;
  spacing_code: string | null;
  field_length_m: number;
  delka_trati_m: number;
  delka_koleje_m: number;
  track_count: number;
  km_od: number | null;
  km_do: number | null;
}

export function resolveSectionLength(input: RailPlannerInput): {
  delka_trati_m: number;
  km_od: number | null;
  km_od_raw?: number;
  km_do: number | null;
} {
  if (typeof input.section_length_m === 'number' && input.section_length_m > 0) {
    return { delka_trati_m: input.section_length_m, km_od: null, km_do: null };
  }
  if (typeof input.km_od === 'number' && typeof input.km_do === 'number') {
    const delka = Math.abs(input.km_do - input.km_od) * 1000;
    if (delka > 0) return { delka_trati_m: delka, km_od: input.km_od, km_do: input.km_do };
  }
  throw new RailUncalculatedError(
    'NEPOČÍTÁNO — chybí délka úseku (zadejte staničení km od–do nebo délku v metrech).',
    ['section_length_m', 'km_od', 'km_do'],
  );
}

export function resolveAssembly(input: RailPlannerInput): ResolvedAssembly {
  const assembly = TRACK_ASSEMBLIES.find(a => a.id === input.assembly_id);
  if (!assembly) {
    throw new RailInputError(
      `Neznámá sestava svršku '${input.assembly_id}'. Povolené: ${TRACK_ASSEMBLIES.map(a => a.id).join(', ')}`,
    );
  }

  const profile = RAIL_PROFILES.find(p => p.id === assembly.rail_profile)!;
  const sleeper = SLEEPER_TYPES.find(s => s.id === assembly.sleeper_type)!;
  const fastening = FASTENING_SYSTEMS.find(f => f.id === assembly.fastening)!;

  const field_length_m = input.field_length_m ?? assembly.default_field_length_m;
  if (!assembly.allowed_field_lengths_m.includes(field_length_m)) {
    throw new RailInputError(
      `Délka pole ${field_length_m} m není pro sestavu ${assembly.id} povolena. Povolené: ${assembly.allowed_field_lengths_m.join(', ')} m`,
    );
  }

  let spacing_code: string | null = null;
  let spacing_row: SleeperSpacingRow | null = null;
  if (sleeper.count_mode === 'table') {
    spacing_code = input.spacing_code ?? assembly.default_spacing;
    if (!spacing_code) {
      throw new RailInputError(`Sestava ${assembly.id} vyžaduje rozdělení pražců (spacing_code).`);
    }
    if (!assembly.allowed_spacings.includes(spacing_code)) {
      throw new RailInputError(
        `Rozdělení '${spacing_code}' není pro sestavu ${assembly.id} povoleno. Povolené: ${assembly.allowed_spacings.join(', ')}`,
      );
    }
    spacing_row =
      SLEEPER_SPACING_TABLE.find(
        r => r.code === spacing_code && r.field_length_m === field_length_m,
      ) ?? null;
    if (!spacing_row) {
      throw new RailInputError(
        `Rozdělení '${spacing_code}' @ ${field_length_m} m není v tabulce rozdělení pražců.`,
      );
    }
  }

  const trackCount = input.track_count;
  if (!Number.isInteger(trackCount) || trackCount < 1 || trackCount > 8) {
    throw new RailInputError('track_count musí být celé číslo 1–8 (počítá se NA KOLEJ).');
  }

  const { delka_trati_m, km_od, km_do } = resolveSectionLength(input);

  return {
    assembly,
    profile,
    sleeper,
    fastening,
    spacing_row,
    spacing_code,
    field_length_m,
    delka_trati_m,
    delka_koleje_m: delka_trati_m * trackCount,
    track_count: trackCount,
    km_od,
    km_do,
  };
}
