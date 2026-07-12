/**
 * compositeParts tests — pilíř as a 2nd composite template (design.md §5.7).
 *
 * Pins:
 *   1. compositeTemplateFor maps parent element_type → template family.
 *   2. makePierTemplate seeds dřík + hlavice with EXPLICIT placeholder ratios.
 *   3. makeAbutmentTemplate stays ratio-free (parity — opěra unchanged).
 *   4. buildPartInput forwards volume_ratio only when set (decouples the shared
 *      driky_piliru type from the abutment map).
 */
import { describe, it, expect } from 'vitest';
import type { PlannerInput } from '@stavagent/monolit-shared';
import {
  makePierTemplate,
  makeAbutmentTemplate,
  buildPartInput,
  compositeTemplateFor,
  PIER_PART_TEMPLATE,
} from './compositeParts';

const parent: PlannerInput = {
  element_type: 'driky_piliru',
  volume_m3: 100,
  concrete_class: 'C30/37',
  has_dilatacni_spary: false,
} as PlannerInput;

describe('compositeTemplateFor', () => {
  it('maps opěra → abutment, pilíř → pier, everything else → null', () => {
    expect(compositeTemplateFor('opery_ulozne_prahy')).toBe('abutment');
    expect(compositeTemplateFor('driky_piliru')).toBe('pier');
    expect(compositeTemplateFor('mostovkova_deska')).toBeNull();
    expect(compositeTemplateFor('rimsa')).toBeNull();
  });
});

describe('makePierTemplate', () => {
  it('seeds 2 parts: dřík (driky_piliru) + hlavice (rigel) with explicit ratios', () => {
    const parts = makePierTemplate();
    expect(parts).toHaveLength(2);
    expect(parts.map((p) => p.element_type)).toEqual(['driky_piliru', 'rigel']);
    expect(parts.map((p) => p.part_label)).toEqual(['Dřík', 'Hlavice']);
    expect(parts.map((p) => p.volume_ratio)).toEqual([0.75, 0.25]);
    // stable unique ids
    expect(new Set(parts.map((p) => p.id)).size).toBe(2);
  });

  it('template ratios match the exported PIER_PART_TEMPLATE constant', () => {
    expect(PIER_PART_TEMPLATE.map((t) => t.volume_ratio)).toEqual([0.75, 0.25]);
  });
});

describe('makeAbutmentTemplate stays ratio-free (opěra parity)', () => {
  it('none of the 4 opěra parts carry a volume_ratio', () => {
    const parts = makeAbutmentTemplate();
    expect(parts).toHaveLength(4);
    expect(parts.every((p) => p.volume_ratio === undefined)).toBe(true);
  });
});

describe('buildPartInput — volume_ratio forwarding', () => {
  it('forwards the explicit ratio when the part has no volume (→ ODHAD split)', () => {
    const [drik] = makePierTemplate();
    const input = buildPartInput(drik, parent) as PlannerInput & { volume_ratio?: number };
    expect(input.volume_ratio).toBe(0.75);
    expect(input.volume_m3).toBeUndefined(); // omitted → ratio drives the split
    expect(input.element_type).toBe('driky_piliru');
  });

  it('still forwards the ratio next to an explicit volume (planComposite ignores it downstream)', () => {
    const [drik] = makePierTemplate();
    const input = buildPartInput({ ...drik, volume_m3: '60' }, parent) as PlannerInput & { volume_ratio?: number };
    expect(input.volume_m3).toBe(60);
    expect(input.volume_ratio).toBe(0.75);
  });

  it('omits volume_ratio for abutment parts (map-driven, decoupled from pier)', () => {
    const [drikAbutment] = makeAbutmentTemplate();
    const input = buildPartInput(drikAbutment, parent) as PlannerInput & { volume_ratio?: number };
    expect(input.volume_ratio).toBeUndefined();
  });
});
