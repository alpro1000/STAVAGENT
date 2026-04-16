/**
 * Planner Advisor Prompt Builder Tests
 *
 * Tests buildApproachPrompt() with 4 scenarios matching SO-202/203/207 golden data.
 */
import { describe, test, expect } from '@jest/globals';
import { buildApproachPrompt } from '../../src/routes/advisor-prompt.js';

describe('buildApproachPrompt', () => {
  test('SO-202 mostovka — includes prestress + bridge + exposure', () => {
    const prompt = buildApproachPrompt({
      elementLabel: 'Mostovková deska',
      element_type: 'mostovkova_deska',
      volume_m3: 605,
      concrete_class: 'C35/45',
      exposure_class: 'XF2',
      curing_class: 4,
      temperature_c: 15,
      is_prestressed: true,
      num_cables: 12,
      prestress_tensioning: 'one_sided',
      span_m: 20,
      num_spans: 6,
      nk_width_m: 10.25,
      total_length_m: 111.5,
      construction_technology: 'fixed_scaffolding',
      computed_results: { total_days: 85, curing_days: 9, prestress_days: 11, num_tacts: 1 },
      tz_excerpt: 'Předpětí 12 kabelů Y1860S7, napínání jednostranné',
      user_question: 'Jaká jsou rizika?',
    });

    expect(prompt).toContain('XF2');
    expect(prompt).toContain('ošetřování: 4');
    expect(prompt).toContain('12');               // num_cables
    expect(prompt).toContain('jednostranné');
    expect(prompt).toContain('20');                // span_m
    expect(prompt).toContain('6 polí');
    expect(prompt).toContain('Předpětí 12 kabelů');  // tz_excerpt
    expect(prompt).toContain('Jaká jsou rizika');
    expect(prompt).toContain('85');               // total_days
    expect(prompt).toContain('MOSTNÍ NK');
    expect(prompt).toContain('PŘEDPĚTÍ');
    expect(prompt).not.toContain('PILOTA');
  });

  test('SO-202 pilota — includes pile section, no bridge', () => {
    const prompt = buildApproachPrompt({
      elementLabel: 'Pilota',
      element_type: 'pilota',
      volume_m3: 908,
      concrete_class: 'C30/37',
      exposure_class: 'XA2',
      temperature_c: 15,
    });

    expect(prompt).toContain('PILOTA');
    expect(prompt).toContain('XA2');
    expect(prompt).toContain('pažnice');
    expect(prompt).not.toContain('MOSTNÍ NK');
    expect(prompt).not.toContain('PŘEDPĚTÍ');
  });

  test('základ — minimal context, no optional sections', () => {
    const prompt = buildApproachPrompt({
      elementLabel: 'Základ opěry',
      element_type: 'zaklady_piliru',
      volume_m3: 40,
      concrete_class: 'C25/30',
      temperature_c: 15,
    });

    expect(prompt).toContain('C25/30');
    expect(prompt).toContain('Základ opěry');
    expect(prompt).not.toContain('MOSTNÍ NK');
    expect(prompt).not.toContain('PŘEDPĚTÍ');
    expect(prompt).not.toContain('PILOTA');
    expect(prompt).not.toContain('KONTEXT Z TZ');
  });

  test('backward compat — 7-field payload still works', () => {
    const prompt = buildApproachPrompt({
      elementLabel: 'Stěna',
      element_type: 'stena',
      volume_m3: 50,
      has_dilatacni_spary: true,
      concrete_class: 'C30/37',
      temperature_c: 20,
      spara_spacing_m: 8,
    });

    expect(prompt).toContain('C30/37');
    expect(prompt).toContain('sekční betonáž');
    expect(prompt).toContain('8 m');
    expect(prompt).toContain('JSON');
  });

  test('tz_excerpt is truncated at 2000 chars', () => {
    const longText = 'x'.repeat(3000);
    const prompt = buildApproachPrompt({
      elementLabel: 'Test',
      element_type: 'stena',
      volume_m3: 10,
      tz_excerpt: longText,
    });

    // tz_excerpt truncated to 2000 chars — prompt should not contain full 3000 'x' run
    expect(prompt).not.toContain('x'.repeat(2500));
    expect(prompt).toContain('KONTEXT Z TZ');
  });
});
