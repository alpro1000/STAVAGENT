/**
 * Import-from-Registry auth forwarding tests (2026-07-08)
 *
 * Sprint A made both upstream sources requireAuth:
 *   - Portal /api/integration/list-registry-projects (owner-scoped)
 *   - Registry backend /api/registry/projects (JWT-derived owner)
 * The Monolit proxy fetched them anonymously → 401 upstream → the
 * «Načíst z Rozpočtu» modal showed «Žádné projekty v Registry» for
 * every user. Rules under test:
 *   - GET /projects with Bearer  → forwards Authorization to BOTH upstreams
 *   - GET /projects anonymous    → empty list, no upstream calls
 *   - POST / anonymous           → 401 (fail fast, no misleading 404)
 *   - POST / with Bearer         → forwards Authorization to Portal + Registry fallback
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'dev-secret-key-change-in-production';
const tokenFor = (userId) => jwt.sign({ userId, email: `u${userId}@test.cz` }, JWT_SECRET);
const USER_ID = 42;

// --- Mocks before importing the route ---

const mockDb = {
  prepare: jest.fn(() => ({ run: jest.fn(), get: jest.fn(), all: jest.fn(() => []) })),
  transaction: jest.fn((fn) => (...args) => fn(...args)),
  isPostgres: false,
};

jest.unstable_mockModule('../../src/db/init.js', () => ({ default: mockDb }));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));
jest.unstable_mockModule('@stavagent/monolit-shared', () => ({
  isMonolithicElement: jest.fn(() => true),
}));

const { default: importFromRegistryRoutes } = await import('../../src/routes/import-from-registry.js');

const app = express();
app.use(express.json());
app.use('/api/import-from-registry', importFromRegistryRoutes);

const realFetch = global.fetch;

describe('import-from-registry auth forwarding', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, projects: [] }),
    }));
  });

  afterAll(() => { global.fetch = realFetch; });

  test('GET /projects forwards the caller Bearer to Portal AND Registry upstreams', async () => {
    const token = tokenFor(USER_ID);
    const res = await request(app)
      .get('/api/import-from-registry/projects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    for (const [url, opts] of global.fetch.mock.calls) {
      expect(String(url)).toMatch(/list-registry-projects|\/api\/registry\/projects/);
      expect(opts.headers.Authorization).toBe(`Bearer ${token}`);
    }
  });

  test('GET /projects anonymous returns empty list without touching upstreams', async () => {
    const res = await request(app).get('/api/import-from-registry/projects');

    expect(res.status).toBe(200);
    expect(res.body.projects).toEqual([]);
    expect(res.body.debug?.reason).toBe('anonymous');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('POST / anonymous fails fast with 401 (not a misleading 404)', async () => {
    const res = await request(app)
      .post('/api/import-from-registry')
      .send({ portal_project_id: 'proj_abc' });

    expect(res.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('POST / with Bearer forwards Authorization to Portal and Registry fallback', async () => {
    // Portal + Registry both come back empty → route ends 404, but every
    // upstream call must have carried the caller's token.
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    }));

    const token = tokenFor(USER_ID);
    const res = await request(app)
      .post('/api/import-from-registry')
      .set('Authorization', `Bearer ${token}`)
      .send({ portal_project_id: 'proj_abc' });

    expect(res.status).toBe(404);
    expect(global.fetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    for (const [, opts] of global.fetch.mock.calls) {
      expect(opts.headers.Authorization).toBe(`Bearer ${token}`);
    }
  });
});
