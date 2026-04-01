/**
 * Construction Sequence — canonical ordering for bridge and building elements.
 *
 * Bridge: pilota → základy → pilíře → opěry → mostovka → přechodová deska → římsa → závěrné zídky
 * Building: pilota → základy → stěny/sloupy → stropy → schodiště → střecha
 *
 * Used by: PositionsTable (sort), ProjectGantt (sequence), Gantt dependencies.
 */

import type { StructuralElementType } from '../calculators/pour-decision.js';

// ─── Bridge construction sequence (technologická posloupnost) ────────────────

/**
 * Canonical bridge construction order.
 * Lower number = built first (foundations → superstructure → finishing).
 */
export const BRIDGE_ELEMENT_ORDER: Record<StructuralElementType, number> = {
  // Group 1: Foundations (Zakládání)
  pilota:               10,
  zakladova_patka:      20,
  zakladovy_pas:        25,
  zakladova_deska:      30,
  zaklady_piliru:       35,

  // Group 2: Substructure (Spodní stavba)
  driky_piliru:         40,
  opery_ulozne_prahy:   50,
  operne_zdi:           55,

  // Group 3: Superstructure (Nosná konstrukce)
  rigel:                60,
  mostovkova_deska:     70,
  prechodova_deska:     75,

  // Group 4: Finishing (Dokončení svršku)
  rimsa:                80,
  mostni_zavirne_zidky: 85,

  // Group 5: Non-bridge elements (lower priority in bridge context)
  stena:                90,
  sloup:                91,
  stropni_deska:        92,
  pruvlak:              93,
  schodiste:            94,
  nadrz:                95,
  podzemni_stena:       96,
  other:               100,
};

// ─── Building construction sequence ─────────────────────────────────────────

/**
 * Canonical building construction order.
 * Lower number = built first (foundations → frame → floors → finishing).
 */
export const BUILDING_ELEMENT_ORDER: Record<StructuralElementType, number> = {
  // Group 1: Foundations
  pilota:               10,
  podzemni_stena:       15,
  zakladova_patka:      20,
  zakladovy_pas:        25,
  zakladova_deska:      30,

  // Group 2: Frame (svislé nosné)
  stena:                40,
  sloup:                45,

  // Group 3: Horizontal (vodorovné nosné)
  pruvlak:              50,
  stropni_deska:        55,
  schodiste:            60,

  // Group 4: Special
  nadrz:                70,

  // Group 5: Bridge elements (if mixed project)
  zaklady_piliru:       80,
  driky_piliru:         81,
  opery_ulozne_prahy:   82,
  operne_zdi:           83,
  rigel:                84,
  mostovkova_deska:     85,
  prechodova_deska:     86,
  rimsa:                87,
  mostni_zavirne_zidky: 88,

  other:               100,
};

// ─── Part name → sequence matching (for ProjectGantt / PositionsTable) ──────

/**
 * Bridge part name sequence (Czech KROS/ÚRS naming convention).
 * Used for fuzzy-matching part_name strings to construction order.
 */
export const BRIDGE_PART_SEQUENCE = [
  'PILOTY', 'ZÁKLADY', 'ZÁKLADY PILÍŘŮ', 'DŘÍKY PILÍŘŮ', 'PILÍŘE', 'STATIVA',
  'OPĚRY', 'ÚLOŽNÉ PRAHY', 'OPĚRNÉ ZDI',
  'PŘÍČNÍKY', 'PŘÍČNÍK', 'HLAVICE',
  'MOSTOVKA', 'MOSTOVKOVÁ DESKA', 'NOSNÁ KONSTRUKCE',
  'PŘECHODOVÉ DESKY', 'PŘECHODOVÁ DESKA',
  'ŘÍMSY', 'ŘÍMSOVÁ DESKA', 'ZÁBRADELNÍ',
  'ZÁVĚRNÉ ZÍDKY',
  'IZOLACE', 'VOZOVKA', 'SVODIDLA', 'ZÁBRADLÍ',
] as const;

/**
 * Building part name sequence.
 */
export const BUILDING_PART_SEQUENCE = [
  'ZEMNÍ PRÁCE', 'PILOTY', 'ZÁKLADY', 'ZÁKLADOVÁ DESKA', 'ZÁKLADOVÝ PAS',
  'PODZEMNÍ STĚNY',
  'STĚNY', 'SLOUPY', 'JÁDRO',
  'PRŮVLAKY', 'STROPNÍ DESKA', 'STROP',
  'SCHODIŠTĚ',
  'STŘECHA',
  'IZOLACE', 'FASÁDA',
] as const;

/**
 * Find the sequence index of a part name in a sequence array.
 * Uses fuzzy substring matching (normalized, case-insensitive).
 *
 * @returns index in sequence (lower = earlier), or 999 for unmatched parts
 */
export function getPartSequenceIndex(partName: string, sequence: readonly string[]): number {
  const upper = partName.toUpperCase().trim();
  for (let i = 0; i < sequence.length; i++) {
    if (upper.includes(sequence[i]) || sequence[i].includes(upper)) return i;
  }
  return 999;
}

/**
 * Detect if a set of part names is more likely a bridge or building project.
 * Returns the appropriate sequence array.
 */
export function detectProjectSequence(partNames: string[]): readonly string[] {
  const bridgeScore = partNames.reduce(
    (s, n) => s + (getPartSequenceIndex(n, BRIDGE_PART_SEQUENCE) < 999 ? 1 : 0), 0,
  );
  const buildingScore = partNames.reduce(
    (s, n) => s + (getPartSequenceIndex(n, BUILDING_PART_SEQUENCE) < 999 ? 1 : 0), 0,
  );
  return bridgeScore >= buildingScore ? BRIDGE_PART_SEQUENCE : BUILDING_PART_SEQUENCE;
}

/**
 * Sort part names by construction sequence.
 * Bridge parts sorted by BRIDGE_PART_SEQUENCE, building by BUILDING_PART_SEQUENCE.
 * Auto-detects project type from part names.
 */
export function sortPartsBySequence(partNames: string[]): string[] {
  const sequence = detectProjectSequence(partNames);
  return [...partNames].sort((a, b) =>
    getPartSequenceIndex(a, sequence) - getPartSequenceIndex(b, sequence),
  );
}
