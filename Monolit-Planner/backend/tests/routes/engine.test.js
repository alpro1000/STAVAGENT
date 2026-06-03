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
});
