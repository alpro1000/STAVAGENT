/**
 * SSOT delegate endpoints — parity tests (TASK_FIX_SSOT_MCP_Delegate, Phase 1).
 *
 * The MCP/agent surface must return the SAME result as the UI. These thin HTTP
 * endpoints expose the canonical TS engine (planElement / classifyElement) with
 * NO new computational logic. The contract this suite pins:
 *
 *     POST /api/calculate  output  ===  planElement(input) called directly
 *     POST /api/classify   output  ===  classifyElement(name, ctx) directly
 *
 * `norm()` = JSON round-trip of the direct call, so it matches what HTTP/json
 * serialization produces (drops `undefined`, same number precision).
 */
import { describe, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { planElement, classifyElement } from '@stavagent/monolit-shared';
import engineRouter from '../../src/routes/engine.js';

const app = express();
app.use(express.json());
app.use('/api', engineRouter);

const norm = (x) => JSON.parse(JSON.stringify(x));

describe('POST /api/calculate — thin delegate to planElement', () => {
  test('parity: endpoint === direct planElement (stena)', async () => {
    const input = { element_type: 'stena', volume_m3: 10, height_m: 3, has_dilatacni_spary: false };
    const direct = norm(planElement(input));
    const res = await request(app).post('/api/calculate').send(input);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(direct);
  });

  test('parity: mostovka (bridge deck) full output', async () => {
    const input = {
      element_type: 'mostovkova_deska', volume_m3: 605, height_m: 6,
      has_dilatacni_spary: false, concrete_class: 'C35/45', is_prestressed: true,
    };
    const direct = norm(planElement(input));
    const res = await request(app).post('/api/calculate').send(input);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(direct);
  });

  test('parity: auto-classify via element_name only', async () => {
    const input = { element_name: 'Pilíř P2', volume_m3: 40, height_m: 8, has_dilatacni_spary: false };
    const direct = norm(planElement(input));
    const res = await request(app).post('/api/calculate').send(input);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(direct);
  });

  test('400 when volume_m3 missing', async () => {
    const res = await request(app).post('/api/calculate').send({ element_type: 'stena' });
    expect(res.status).toBe(400);
  });

  test('400 when no element_type and no element_name', async () => {
    const res = await request(app).post('/api/calculate').send({ volume_m3: 10 });
    expect(res.status).toBe(400);
  });

  test('400 when volume_m3 negative', async () => {
    const res = await request(app).post('/api/calculate').send({ element_type: 'stena', volume_m3: -1 });
    expect(res.status).toBe(400);
  });

  test('400 when volume_m3 above domain ceiling (100000)', async () => {
    const res = await request(app).post('/api/calculate').send({ element_type: 'stena', volume_m3: 100001, has_dilatacni_spary: false });
    expect(res.status).toBe(400);
  });

  test('400 when element_type too long (>100 chars)', async () => {
    const res = await request(app).post('/api/calculate').send({ element_type: 'x'.repeat(101), volume_m3: 10 });
    expect(res.status).toBe(400);
  });

  test('400 when element_name too long (>500 chars)', async () => {
    const res = await request(app).post('/api/calculate').send({ element_name: 'x'.repeat(501), volume_m3: 10 });
    expect(res.status).toBe(400);
  });

  // Lower-bound parity (probe-confirmed): volume_m3=0 is VALID for pilota (volume
  // derives from pile geometry) → 200; for non-pilota the rebar engine throws
  // ("mass_t must be positive") → surfaced as a generic 500 engine_error, NOT
  // pre-rejected, so the endpoint mirrors the engine.
  test('volume_m3=0 with pilota → 200 (engine derives volume from geometry)', async () => {
    const input = { element_type: 'pilota', volume_m3: 0, has_dilatacni_spary: false };
    const direct = norm(planElement(input));
    const res = await request(app).post('/api/calculate').send(input);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(direct);
  });

  test('volume_m3=0 with stena → 500 engine_error, no leaked detail', async () => {
    const res = await request(app).post('/api/calculate').send({ element_type: 'stena', volume_m3: 0, has_dilatacni_spary: false });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'engine_error' });
    expect(res.body.detail).toBeUndefined();
  });
});

describe('POST /api/classify — thin delegate to classifyElement', () => {
  test('parity: mostovka, is_bridge=true', async () => {
    const direct = norm(classifyElement('Mostovková deska', { is_bridge: true }));
    const res = await request(app).post('/api/classify').send({ name: 'Mostovková deska', is_bridge: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(direct);
  });

  test('object_type "bridge" maps to is_bridge=true', async () => {
    const direct = norm(classifyElement('Pilíř P2', { is_bridge: true }));
    const res = await request(app).post('/api/classify').send({ name: 'Pilíř P2', object_type: 'bridge' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(direct);
  });

  test('object_type "retaining_wall" maps to is_bridge=false', async () => {
    const direct = norm(classifyElement('Opěrná zeď', { is_bridge: false }));
    const res = await request(app).post('/api/classify').send({ name: 'Opěrná zeď', object_type: 'retaining_wall' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(direct);
  });

  test('400 when name missing', async () => {
    const res = await request(app).post('/api/classify').send({});
    expect(res.status).toBe(400);
  });

  test('400 when name too long (>500 chars)', async () => {
    const res = await request(app).post('/api/classify').send({ name: 'x'.repeat(501) });
    expect(res.status).toBe(400);
  });
});
