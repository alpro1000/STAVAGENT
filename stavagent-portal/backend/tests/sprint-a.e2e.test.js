/**
 * Sprint A negative tests (2026-07) — anonymous → 401/403 on the newly
 * gated Portal routes + fail-closed middleware behavior.
 *
 * Covers:
 *   - /api/pump/*           requireAuth mount (was fully anonymous)
 *   - /api/kb/research      requireAuth mount (burned Core LLM credits)
 *   - /api/parse-preview/*  requireAuth mount (/import minted owner_id=1 rows)
 *   - /api/core credited POST without JWT → 401 (billing fail-closed)
 *   - requireServiceKey with no configured key → 503 (was allow-all)
 *   - requireAuthOrServiceKey with no key + no JWT → 401 (was allow-all)
 *
 * Run:
 *   node --test stavagent-portal/backend/tests/sprint-a.e2e.test.js
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';

// Module-load env — must be set BEFORE importing app modules.
process.env.JWT_SECRET = 'test-secret-sprint-a-suite';
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test_no_connect';
delete process.env.DISABLE_AUTH;
delete process.env.SERVICE_API_KEY; // exercise the fail-closed no-key branches
delete process.env.NODE_ENV;        // dev mode: secrets.js must not throw

const { requireAuth } = await import('../src/middleware/auth.js');
const { requireServiceKey, requireAuthOrServiceKey } = await import('../src/middleware/serviceAuth.js');
const pumpRoutes = (await import('../src/routes/pump.js')).default;
const kbResearchRoutes = (await import('../src/routes/kb-research.js')).default;
const parsePreviewRoutes = (await import('../src/routes/parse-preview.js')).default;
const coreProxyRoutes = (await import('../src/routes/core-proxy.js')).default;
const { optionalAuth } = await import('../src/middleware/auth.js');

// Mounts mirror server.js
const app = express();
app.use(express.json());
app.use('/api/pump', requireAuth, pumpRoutes);
app.use('/api/kb/research', requireAuth, kbResearchRoutes);
app.use('/api/parse-preview', requireAuth, parsePreviewRoutes);
app.use('/api/core', optionalAuth, coreProxyRoutes);
app.get('/probe/service-key', requireServiceKey, (_req, res) => res.json({ ok: true }));
app.get('/probe/auth-or-key', requireAuthOrServiceKey, (_req, res) => res.json({ ok: true }));

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => server?.close());

const tokenFor = (userId) => jwt.sign({ userId, email: `u${userId}@t.cz` }, process.env.JWT_SECRET);

describe('Sprint A — anonymous → 401 on newly gated routes', () => {
  it('GET /api/pump/suppliers without JWT → 401', async () => {
    const res = await fetch(`${baseUrl}/api/pump/suppliers`);
    assert.equal(res.status, 401);
  });

  it('POST /api/pump/suppliers without JWT → 401', async () => {
    const res = await fetch(`${baseUrl}/api/pump/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'evil', name: 'Evil', billing_model: 'hourly' }),
    });
    assert.equal(res.status, 401);
  });

  it('POST /api/kb/research without JWT → 401', async () => {
    const res = await fetch(`${baseUrl}/api/kb/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'ČSN EN 206 beton' }),
    });
    assert.equal(res.status, 401);
  });

  it('POST /api/parse-preview/import without JWT → 401', async () => {
    const res = await fetch(`${baseUrl}/api/parse-preview/import`, { method: 'POST' });
    assert.equal(res.status, 401);
  });

  it('POST /api/parse-preview/import WITH JWT passes the gate (400 = no file)', async () => {
    const res = await fetch(`${baseUrl}/api/parse-preview/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenFor(5)}` },
    });
    assert.equal(res.status, 400); // handler reached: "No file uploaded"
  });
});

describe('Sprint A — billing fail-closed on credited core-proxy POST', () => {
  it('anonymous POST to a credited prefix (passport) → 401, no proxy call', async () => {
    const res = await fetch(`${baseUrl}/api/core/passport/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.operation, 'passport_generate');
  });
});

describe('Sprint A — service-key middleware fail-closed (no key configured)', () => {
  it('requireServiceKey denies with 503 when SERVICE_API_KEY unset', async () => {
    const res = await fetch(`${baseUrl}/probe/service-key`);
    assert.equal(res.status, 503);
  });

  it('requireAuthOrServiceKey falls through to 401 without JWT or key', async () => {
    const res = await fetch(`${baseUrl}/probe/auth-or-key`);
    assert.equal(res.status, 401);
  });

  it('requireAuthOrServiceKey still accepts a valid JWT', async () => {
    const res = await fetch(`${baseUrl}/probe/auth-or-key`, {
      headers: { Authorization: `Bearer ${tokenFor(9)}` },
    });
    assert.equal(res.status, 200);
  });
});
