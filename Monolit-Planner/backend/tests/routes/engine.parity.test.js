/**
 * SSOT parity anchor — TASK_FIX_SSOT_MCP_Delegate, Phase 2a (calculate).
 *
 * The concrete-agent MCP `calculate_concrete_works` tool delegates to
 * POST /api/calculate and replays captured engine output offline in its own
 * (Python-only) CI. THIS suite is the cross-language anchor: it runs where Node
 * is live and pins (a) endpoint === planElement for the parity set, and (b) the
 * canonical numbers the Python replay fixtures depend on — most importantly
 * mostovková deska rebar = 150 (the retired Python table said 180).
 *
 * If the engine contract drifts, this suite fails here first → re-capture the
 * concrete-agent replay fixtures (engine_fixtures.json + replay_calculate.json).
 */
import { describe, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { planElement } from '@stavagent/monolit-shared';
import engineRouter from '../../src/routes/engine.js';

const app = express();
app.use(express.json());
app.use('/api', engineRouter);

const norm = (x) => JSON.parse(JSON.stringify(x));

// Same element set as the concrete-agent parity fixtures + the jest parity.
const PARITY = {
  mostovkova_deska: { element_type: 'mostovkova_deska', volume_m3: 605, concrete_class: 'C35/45', height_m: 6, span_m: 20, num_spans: 6, is_prestressed: true, has_dilatacni_spary: false },
  rimsa: { element_type: 'rimsa', volume_m3: 12.5, concrete_class: 'C30/37', height_m: 0.5, has_dilatacni_spary: false },
  driky_piliru: { element_type: 'driky_piliru', volume_m3: 24, concrete_class: 'C30/37', height_m: 8.0, has_dilatacni_spary: false },
  zaklady_piliru: { element_type: 'zaklady_piliru', volume_m3: 35, concrete_class: 'C25/30', height_m: 1.2, has_dilatacni_spary: false },
  pilota: { element_type: 'pilota', volume_m3: 50, concrete_class: 'C30/37', pile_diameter_mm: 900, pile_count: 10, pile_geology: 'below_gwt', has_dilatacni_spary: false },
  stena: { element_type: 'stena', volume_m3: 30, concrete_class: 'C25/30', height_m: 2.8, has_dilatacni_spary: false },
  opery_ulozne_prahy: { element_type: 'opery_ulozne_prahy', volume_m3: 55, concrete_class: 'C30/37', height_m: 5.0, has_dilatacni_spary: false },
};

describe('SSOT parity — POST /api/calculate === planElement (what MCP delegates to)', () => {
  for (const [name, input] of Object.entries(PARITY)) {
    test(`parity: ${name}`, async () => {
      const direct = norm(planElement(input));
      const res = await request(app).post('/api/calculate').send(input);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(direct);
    });
  }
});

describe('SSOT parity — canonical profile rebar ratios (the "150 not 180" anchor)', () => {
  // These are the values the concrete-agent replay fixtures encode. Pinning them
  // here catches any cross-language drift the Python side cannot see.
  const REBAR = {
    mostovkova_deska: 150, // retired Python ELEMENT_TYPES said 180
    driky_piliru: 150,
    zaklady_piliru: 120,
    rimsa: 120,
    pilota: 60,
    stena: 80,
    opery_ulozne_prahy: 140,
  };
  for (const [name, expected] of Object.entries(REBAR)) {
    test(`${name} profile rebar = ${expected} kg/m³`, async () => {
      const res = await request(app).post('/api/calculate').send(PARITY[name]);
      expect(res.status).toBe(200);
      expect(res.body.element.profile.rebar_ratio_kg_m3).toBe(expected);
    });
  }
});

describe('SSOT parity — SO-202 domain anchors through the endpoint', () => {
  test('NK curing ≥ 9 days (class 4 @ 15°C)', async () => {
    const res = await request(app).post('/api/calculate').send({
      element_type: 'mostovkova_deska', volume_m3: 605, concrete_class: 'C35/45',
      exposure_class: 'XF2', curing_class: 4, temperature_c: 15, is_prestressed: true,
      bridge_deck_subtype: 'dvoutram', span_m: 20, num_spans: 6, has_dilatacni_spary: false,
    });
    expect(res.body.formwork.curing_days).toBeGreaterThanOrEqual(9);
  });

  test('Bridge pile Ø900 rebar ≥ 80 kg/m³', async () => {
    const res = await request(app).post('/api/calculate').send({
      element_type: 'pilota', volume_m3: 50.9, concrete_class: 'C30/37',
      pile_diameter_mm: 900, has_dilatacni_spary: false,
    });
    expect(res.body.rebar.mass_kg / 50.9).toBeGreaterThanOrEqual(80);
  });

  test('Prestressed NK adds ≥ 11 days', async () => {
    const res = await request(app).post('/api/calculate').send({
      element_type: 'mostovkova_deska', volume_m3: 605, concrete_class: 'C35/45',
      is_prestressed: true, span_m: 20, num_spans: 6, has_dilatacni_spary: false,
    });
    expect(res.body.prestress.days).toBeGreaterThanOrEqual(11);
  });

  test('TZ §7.2 fixed-scaffolding override is honored', async () => {
    const res = await request(app).post('/api/calculate').send({
      element_type: 'mostovkova_deska', volume_m3: 605, concrete_class: 'C35/45',
      span_m: 20, num_spans: 6, construction_technology: 'fixed_scaffolding', has_dilatacni_spary: false,
    });
    expect(res.body.bridge_technology.technology).toBe('fixed_scaffolding');
  });
});
