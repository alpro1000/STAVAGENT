/**
 * Admin API-key gate tests (Sprint A, 2026-07)
 *
 * POST /api/settings/model was anonymous — anyone could switch the GLOBAL
 * runtime LLM model for every user. The gate is fail-closed: no configured
 * key → 503, missing key → 401, wrong key → 403, right key → pass.
 */

import express from 'express';
import request from 'supertest';
import { requireApiKey, requireApiKeyIfEnabled } from '../src/api/middleware/requireApiKey.js';
import settingsRouter from '../src/api/routes/settings.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/settings', settingsRouter);
  return app;
}

describe('requireApiKey middleware', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env.URS_ADMIN_API_KEY = ORIGINAL_ENV.URS_ADMIN_API_KEY;
    process.env.URS_REQUIRE_API_KEY = ORIGINAL_ENV.URS_REQUIRE_API_KEY;
    if (ORIGINAL_ENV.URS_ADMIN_API_KEY === undefined) delete process.env.URS_ADMIN_API_KEY;
    if (ORIGINAL_ENV.URS_REQUIRE_API_KEY === undefined) delete process.env.URS_REQUIRE_API_KEY;
  });

  it('POST /api/settings/model without configured key → 503 (fail-closed)', async () => {
    delete process.env.URS_ADMIN_API_KEY;
    const res = await request(buildApp())
      .post('/api/settings/model')
      .send({ model: 'deepseek-chat' });
    expect(res.status).toBe(503);
  });

  it('POST /api/settings/model without X-API-Key → 401', async () => {
    process.env.URS_ADMIN_API_KEY = 'test-admin-key';
    const res = await request(buildApp())
      .post('/api/settings/model')
      .send({ model: 'deepseek-chat' });
    expect(res.status).toBe(401);
  });

  it('POST /api/settings/model with wrong key → 403', async () => {
    process.env.URS_ADMIN_API_KEY = 'test-admin-key';
    const res = await request(buildApp())
      .post('/api/settings/model')
      .set('X-API-Key', 'wrong-key-000')
      .send({ model: 'deepseek-chat' });
    expect(res.status).toBe(403);
  });

  it('POST /api/settings/model/reset without key → 401', async () => {
    process.env.URS_ADMIN_API_KEY = 'test-admin-key';
    const res = await request(buildApp()).post('/api/settings/model/reset');
    expect(res.status).toBe(401);
  });

  it('GET /api/settings/model stays open (read-only)', async () => {
    delete process.env.URS_ADMIN_API_KEY;
    const res = await request(buildApp()).get('/api/settings/model');
    expect(res.status).toBe(200);
  });

  it('requireApiKeyIfEnabled passes through when flag is off', async () => {
    delete process.env.URS_REQUIRE_API_KEY;
    const app = express();
    app.get('/probe', requireApiKeyIfEnabled, (_req, res) => res.json({ ok: true }));
    const res = await request(app).get('/probe');
    expect(res.status).toBe(200);
  });

  it('requireApiKeyIfEnabled enforces the gate when flag is on', async () => {
    process.env.URS_REQUIRE_API_KEY = 'true';
    process.env.URS_ADMIN_API_KEY = 'test-admin-key';
    const app = express();
    app.get('/probe', requireApiKeyIfEnabled, (_req, res) => res.json({ ok: true }));
    const denied = await request(app).get('/probe');
    expect(denied.status).toBe(401);
    const allowed = await request(app).get('/probe').set('X-API-Key', 'test-admin-key');
    expect(allowed.status).toBe(200);
  });

  it('correct key passes the hard gate', async () => {
    process.env.URS_ADMIN_API_KEY = 'test-admin-key';
    const app = express();
    app.post('/probe', requireApiKey, (_req, res) => res.json({ ok: true }));
    const res = await request(app).post('/probe').set('X-API-Key', 'test-admin-key');
    expect(res.status).toBe(200);
  });
});
