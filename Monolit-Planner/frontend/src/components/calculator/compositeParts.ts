/**
 * compositeParts — Fáze 2 #7 (composite-element-parts) Gate 5 frontend helper.
 *
 * Turns the calculator's compact per-part form rows (PartFormState) into the
 * `CompositePartInput[]` the shared `planComposite` engine consumes. Each part
 * INHERITS the parent's firm-level + environmental settings (concrete class,
 * temperature, season, crews, wages, shift) and is given its own element_type,
 * its own exposure/curing from getSmartDefaults(type), and a resolved volume:
 *   explicit volume_m3  > geometry L×W×H (estimateElementVolume)  > omitted (→ ODHAD).
 *
 * Compact-form decision (Gate 5 interview 2026-06-26, option (a)): a part is
 * type + (volume OR L×W×H) + optional formwork override — NOT a full N× form.
 */

import { estimateElementVolume } from '@stavagent/monolit-shared';
import type { PlannerInput, CompositePartInput, StructuralElementType } from '@stavagent/monolit-shared';
import { getSmartDefaults } from './helpers';
import type { PartFormState } from './types';

let partSeq = 0;

/** Build a fresh empty part row of the given type. */
export function makePart(element_type: StructuralElementType, part_label: string): PartFormState {
  return {
    id: `part-${Date.now().toString(36)}-${partSeq++}`,
    element_type,
    part_label,
    volume_m3: '',
    length_m: '',
    width_m: '',
    height_m: '',
    formwork_system_name: '',
  };
}

/**
 * The opěra template (Gate 0 ratified, design.md §5.6): dřík + úložný práh +
 * závěrná zídka + křídla. element_types map 1:1 to PLACEHOLDER_PART_VOLUME_RATIOS
 * keys so an all-ODHAD opěra closes to 100 % of the parent total.
 */
export const ABUTMENT_PART_TEMPLATE: Array<{ element_type: StructuralElementType; part_label: string }> = [
  { element_type: 'driky_piliru', part_label: 'Dřík' },
  { element_type: 'opery_ulozne_prahy', part_label: 'Úložný práh' },
  { element_type: 'mostni_zavirne_zidky', part_label: 'Závěrná zídka' },
  { element_type: 'kridla_opery', part_label: 'Křídla' },
];

/** Seed the 4-part opěra template (each part = ODHAD until the user fills it). */
export function makeAbutmentTemplate(): PartFormState[] {
  return ABUTMENT_PART_TEMPLATE.map((t) => makePart(t.element_type, t.part_label));
}

/**
 * Parent-input keys that are element-specific and must NOT leak onto a part.
 * The part inherits firm-level + environmental settings (the rest of parent)
 * but builds its own geometry / multiplicity / overrides.
 */
const PARENT_STRIP_KEYS = [
  'volume_m3', 'formwork_area_m2', 'height_m', 'deck_thickness_m', 'length_m', 'width_m',
  'total_length_m', 'span_m', 'num_spans', 'nk_width_m', 'bridge_deck_subtype', 'is_prestressed',
  'construction_technology', 'mss_tact_days', 'num_identical_elements', 'formwork_sets_count',
  'num_tacts_override', 'tact_volume_m3_override', 'num_dilatation_sections', 'tacts_per_section',
  'adjacent_sections', 'scheduling_mode_override', 'lost_formwork_area_m2', 'formwork_system_name',
  'formwork_shape_correction', 'tz_facts', 'element_name', 'rebar_mass_kg', 'rebar_diameter_mm',
] as const;

/**
 * Map ONE compact part form-row to a CompositePartInput, inheriting shared
 * settings from the parent PlannerInput. Pure — never mutates inputs.
 */
export function buildPartInput(part: PartFormState, parent: PlannerInput): CompositePartInput {
  const d = getSmartDefaults(part.element_type);
  const input: Record<string, unknown> = { ...parent };
  for (const k of PARENT_STRIP_KEYS) delete input[k];

  input.element_type = part.element_type;
  input.has_dilatacni_spary = false;
  input.num_dilatation_sections = 1;
  // Environmental defaults are part-specific (a dřík and its křídla differ).
  input.exposure_classes = [...d.exposure_classes];
  if (d.exposure_class) input.exposure_class = d.exposure_class;
  if (d.curing_class) input.curing_class = parseInt(d.curing_class, 10) as 2 | 3 | 4;
  if (d.is_prestressed) input.is_prestressed = true;
  if (part.part_label) (input as { part_label?: string }).part_label = part.part_label;

  // Volume: explicit > geometry (exact) > omitted (→ ODHAD split in planComposite).
  const vExplicit = parseFloat(part.volume_m3);
  if (Number.isFinite(vExplicit) && vExplicit > 0) {
    input.volume_m3 = vExplicit;
  } else {
    const L = parseFloat(part.length_m);
    const W = parseFloat(part.width_m);
    const H = parseFloat(part.height_m);
    if (L > 0 && W > 0 && H > 0) {
      const geom = estimateElementVolume(part.element_type, { length_m: L, width_m: W, height_m: H });
      if (geom.applicable && geom.volume_m3 != null) {
        input.volume_m3 = geom.volume_m3;
        if (geom.formwork_area_m2 != null) input.formwork_area_m2 = geom.formwork_area_m2;
      }
      input.height_m = H;
    }
    // else: leave volume_m3 unset → ODHAD share of the parent total.
  }

  if (part.formwork_system_name) input.formwork_system_name = part.formwork_system_name;
  return input as unknown as CompositePartInput;
}
