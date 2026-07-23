/**
 * Backend thin-wrapper tests — hermetic (no network, no DB, no AI).
 * Mirrors Monolit engine.test.js discipline: the endpoint exposes the
 * canonical engine verbatim and maps typed failures to 400/422.
 */
import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';

const BASE_INPUT = {
  section_length_m: 1000,
  track_count: 1,
  assembly_id: 'UIC60_bezstykova',
  project_kind: 'novostavba',
};

describe('zeleznice backend API', () => {
  let app;
  beforeEach(() => {
    delete process.env.SERVICE_API_KEY;
    app = createApp();
  });

  test('GET /health → 200 + engine version', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('zeleznice-planner-api');
    expect(res.body.engine_version).toBe('1.0.0');
  });

  test('GET /api/rail/catalog → registry snapshot (sestavy, stroje, výhybky)', async () => {
    const res = await request(app).get('/api/rail/catalog');
    expect(res.status).toBe(200);
    expect(res.body.assemblies.some(a => a.id === 'UIC60_bezstykova')).toBe(true);
    expect(res.body.machines.some(m => m.id === 'asp_kontinualni_16')).toBe(true);
    expect(res.body.turnout_forms.some(t => t.id === 'J60_1_9_300')).toBe(true);
    expect(res.body.spacing_table.length).toBeGreaterThanOrEqual(6);
  });

  test('POST /api/rail/calculate → plán verbatim z enginu (1680 pražců/km)', async () => {
    const res = await request(app).post('/api/rail/calculate').send(BASE_INPUT);
    expect(res.status).toBe(200);
    expect(res.body.quantities.prazce_ks.value).toBe(1680);
    expect(res.body.vykaz.length).toBeGreaterThan(4);
    expect(res.body.sequence.some(p => p.id === 'bk_overeni_polohy')).toBe(true);
  });

  test('neznámá sestava → 400 s výčtem povolených (human text v error — Monolit parity)', async () => {
    const res = await request(app)
      .post('/api/rail/calculate')
      .send({ ...BASE_INPUT, assembly_id: 'nesmysl' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('UIC60_bezstykova');
  });

  test('chybějící délka → 422 uncalculated (honest NEPOČÍTÁNO, ne 500)', async () => {
    const res = await request(app)
      .post('/api/rail/calculate')
      .send({ track_count: 1, assembly_id: 'UIC60_bezstykova' });
    expect(res.status).toBe(422);
    expect(res.body.uncalculated).toBe(true);
    expect(res.body.reason_cs).toContain('NEPOČÍTÁNO');
    expect(res.body.missing_fields).toContain('section_length_m');
  });

  test('SERVICE_API_KEY nastaven → compute fail-closed bez klíče, 200 s klíčem', async () => {
    process.env.SERVICE_API_KEY = 'test-key-123';
    const denied = await request(app).post('/api/rail/calculate').send(BASE_INPUT);
    expect(denied.status).toBe(401);

    const allowed = await request(app)
      .post('/api/rail/calculate')
      .set('X-Service-Key', 'test-key-123')
      .send(BASE_INPUT);
    expect(allowed.status).toBe(200);
    delete process.env.SERVICE_API_KEY;
  });

  test('katalog je veřejný i s nastaveným service key (read-only KB)', async () => {
    process.env.SERVICE_API_KEY = 'test-key-123';
    const res = await request(app).get('/api/rail/catalog');
    expect(res.status).toBe(200);
    delete process.env.SERVICE_API_KEY;
  });
});
