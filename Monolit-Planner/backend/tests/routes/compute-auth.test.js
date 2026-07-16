/**
 * HOTFIX-2 (2026-07-16) — compute/AI endpoints are fail-closed.
 *
 * Prod logs 2026-07-16: an anonymous python-httpx bot (Microsoft IP) ran full
 * POST /api/calculate (200, 16 KB) — the compute surface sat behind no auth.
 * `requireAuthOrServiceKey` closes it: valid Portal JWT OR the shared
 * X-Service-Key (server-to-server, e.g. the Core MCP delegate) → pass;
 * anonymous → 401.
 *
 * Scope decision (Alexander, 2026-07-16): gate the COMPUTE/AI layer only; the
 * data-CRUD kiosk mode keeps optionalAuth + isolation. So this suite pins the
 * middleware behavior itself (mounted like the real compute routes) without
 * booting the whole server.
 *
 * Hermetic: no network, no DB, no AI.
 */
import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'dev-secret-key-change-in-production';
const SERVICE_KEY = 'test-shared-service-key';

// SERVICE_API_KEY must be set BEFORE importing auth.js (read at module load).
process.env.SERVICE_API_KEY = SERVICE_KEY;

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const { requireAuthOrServiceKey } = await import('../../src/middleware/auth.js');

/** Minimal app that mounts a compute route exactly like server.js does. */
function makeApp() {
  const app = express();
  app.use(express.json());
  // Public probe stays open (parity with server.js /healthcheck).
  app.get('/healthcheck', (req, res) => res.json({ status: 'alive' }));
  // Compute route behind the gate — echoes who authenticated.
  app.post('/api/calculate', requireAuthOrServiceKey, (req, res) =>
    res.json({ ok: true, via: req.serviceCaller ? 'service' : `user:${req.user?.userId}` }),
  );
  return app;
}

const tokenFor = (userId) => jwt.sign({ userId, email: `u${userId}@test.cz` }, JWT_SECRET);

describe('HOTFIX-2 requireAuthOrServiceKey on compute endpoints', () => {
  const app = makeApp();

  it('anonymous POST /api/calculate → 401 (the bot case)', async () => {
    const res = await request(app).post('/api/calculate').send({ volume_m3: 10 });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('invalid/garbage Bearer → 401', async () => {
    const res = await request(app)
      .post('/api/calculate')
      .set('Authorization', 'Bearer not-a-real-jwt')
      .send({ volume_m3: 10 });
    expect(res.status).toBe(401);
  });

  it('valid Portal JWT → 200, no behavior change (identifies the user)', async () => {
    const res = await request(app)
      .post('/api/calculate')
      .set('Authorization', `Bearer ${tokenFor(42)}`)
      .send({ volume_m3: 10 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, via: 'user:42' });
  });

  it('shared X-Service-Key (server-to-server, e.g. MCP delegate) → 200', async () => {
    const res = await request(app)
      .post('/api/calculate')
      .set('X-Service-Key', SERVICE_KEY)
      .send({ volume_m3: 10 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, via: 'service' });
  });

  it('wrong X-Service-Key → 401 (constant compare, no partial accept)', async () => {
    const res = await request(app)
      .post('/api/calculate')
      .set('X-Service-Key', 'wrong-key')
      .send({ volume_m3: 10 });
    expect(res.status).toBe(401);
  });

  it('public probe stays open (no auth)', async () => {
    const res = await request(app).get('/healthcheck');
    expect(res.status).toBe(200);
  });
});
