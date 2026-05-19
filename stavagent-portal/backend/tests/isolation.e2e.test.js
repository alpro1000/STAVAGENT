/**
 * E2E isolation tests — user A vs user B (HTTP-level).
 *
 * Verifies the security boundary added by the security-isolation-hotfix
 * branch by booting the portal-projects + integration routers on a
 * throwaway Express app, stubbing pg.Pool with an in-process spy, and
 * firing real HTTP requests with JWTs signed for two distinct users.
 *
 * The tests don't need a live Postgres — they assert two things:
 *   (a) anonymous requests hit 401 (the requireAuth layer fires),
 *   (b) authenticated requests have `WHERE owner_id = $userId` bound
 *       to the JWT's userId, not a query/body parameter.
 *
 * Run:
 *   node --test stavagent-portal/backend/tests/isolation.e2e.test.js
 *
 * Per audit §2.5 — 5 scenarios from the security-hotfix task §3.4.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import jwt from 'jsonwebtoken';

// Module-load env. JWT_SECRET, DATABASE_URL are read at module import,
// so set them BEFORE any `await import(...)` of the app modules.
process.env.JWT_SECRET = 'test-secret-isolation-suite';
// USE_POSTGRES is computed at db/index.js module-load from
// `!!process.env.DATABASE_URL`. We don't connect — the seam
// __setPoolForTesting swaps the pool — but the truthy check must pass.
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test_no_connect';
delete process.env.DISABLE_AUTH;

// In-memory spy that intercepts every pool.query() call so the tests
// can inspect SQL + params. Each test resets `calls` via beforeEach.
const poolSpy = {
  calls: [],
  // Canned responses keyed by sql-fragment regex. The test populates
  // these per scenario.
  responders: [],
  reset() {
    this.calls = [];
    this.responders = [];
  },
  on(sqlRegex, respond) {
    this.responders.push({ sqlRegex, respond });
  },
  async query(sql, params = []) {
    this.calls.push({ sql, params });
    for (const r of this.responders) {
      if (r.sqlRegex.test(sql)) return r.respond(sql, params);
    }
    // Default: empty result set.
    return { rows: [], rowCount: 0 };
  },
  async connect() {
    const self = this;
    return {
      query: (sql, params) => self.query(sql, params),
      release: () => {},
    };
  },
};

// Import routes FIRST — this triggers db/index.js → initPostgres()
// which sets pool = new pg.Pool({...}). Order matters: only AFTER
// that side effect can we overwrite the pool with our spy via the
// __setPoolForTesting seam. Otherwise initPostgres clobbers the spy.
const portalProjects = (await import('../src/routes/portal-projects.js')).default;
const integration = (await import('../src/routes/integration.js')).default;
const { __setPoolForTesting } = await import('../src/db/postgres.js');
__setPoolForTesting(poolSpy);

// Boot Express on an ephemeral port.
const app = express();
app.use(express.json());
app.use('/api/portal-projects', portalProjects);
app.use('/api/integration', integration);

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const { port } = server.address();
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const USER_A = { userId: 42, email: 'a@test.local', role: 'user' };
const USER_B = { userId: 99, email: 'b@test.local', role: 'user' };

function token(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function http_(method, path, { token: tok, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* empty */ }
  return { status: res.status, body: json, raw: text };
}

// ====================================================================
// Scenario 1 — Project LIST isolation
// ====================================================================
// User A creates a project, user B's GET /api/portal-projects does NOT
// include it. The SQL must contain `WHERE owner_id = $1` bound to
// userB's userId, NOT user A's.

describe('Scenario 1 — project list isolation', () => {
  it('anonymous GET /api/portal-projects → 401', async () => {
    poolSpy.reset();
    const r = await http_('GET', '/api/portal-projects');
    assert.equal(r.status, 401, 'anonymous read must 401');
  });

  it('user B GET /api/portal-projects → WHERE owner_id bound to user B', async () => {
    poolSpy.reset();
    // Stub: return a row only if owner_id = 99 (user B); empty for owner_id = 42 (user A).
    poolSpy.on(/FROM portal_projects/i, (sql, params) => {
      const ownerParam = params[0];
      if (ownerParam === 42) return { rows: [{ portal_project_id: 'A-1', project_name: 'A-only' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const r = await http_('GET', '/api/portal-projects', { token: token(USER_B) });
    assert.equal(r.status, 200);
    const ownerScopedCall = poolSpy.calls.find((c) => /owner_id\s*=\s*\$1/i.test(c.sql));
    assert.ok(ownerScopedCall, 'list query must be owner-scoped');
    assert.equal(ownerScopedCall.params[0], USER_B.userId,
      'list query owner_id parameter must be the JWT userId, not user A');
  });
});

// ====================================================================
// Scenario 2 — Project READ isolation
// ====================================================================

describe('Scenario 2 — project read isolation', () => {
  it('anonymous GET /api/portal-projects/:id → 401', async () => {
    poolSpy.reset();
    const r = await http_('GET', '/api/portal-projects/proj-A-1');
    assert.equal(r.status, 401);
  });

  it('user B GET /api/portal-projects/:projA → 404 (SQL has owner_id = userB)', async () => {
    poolSpy.reset();
    // Pool returns empty when owner_id ≠ 42 (project A's owner). Route
    // therefore returns 404 for user B even with a valid project_id.
    poolSpy.on(/FROM portal_projects WHERE/i, (sql, params) => {
      const [projectId, ownerId] = params;
      if (projectId === 'proj-A-1' && ownerId === 42) {
        return { rows: [{ portal_project_id: 'proj-A-1', project_name: 'A' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const r = await http_('GET', '/api/portal-projects/proj-A-1', { token: token(USER_B) });
    assert.equal(r.status, 404, 'user B must not see user A project');
    const projectQuery = poolSpy.calls.find((c) => /portal_project_id\s*=\s*\$1\s+AND\s+owner_id\s*=\s*\$2/i.test(c.sql));
    assert.ok(projectQuery, 'read query must enforce owner_id filter');
    assert.equal(projectQuery.params[1], USER_B.userId);
  });
});

// ====================================================================
// Scenario 3 — Project UPDATE isolation (PUT /api/portal-projects/:id)
// ====================================================================

describe('Scenario 3 — project update isolation', () => {
  it('anonymous PUT /api/portal-projects/:id → 401', async () => {
    poolSpy.reset();
    const r = await http_('PUT', '/api/portal-projects/proj-A-1', { body: { project_name: 'hijack' } });
    assert.equal(r.status, 401);
  });

  it("user B PUT /api/portal-projects/:projA can't update A's project (owner-scoped check returns empty → 404)", async () => {
    poolSpy.reset();
    poolSpy.on(/FROM portal_projects WHERE/i, (_, params) => {
      const [projectId, ownerId] = params;
      if (projectId === 'proj-A-1' && ownerId === 42) {
        return { rows: [{ portal_project_id: 'proj-A-1' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const r = await http_('PUT', '/api/portal-projects/proj-A-1', {
      token: token(USER_B),
      body: { project_name: 'hijack' },
    });
    assert.equal(r.status, 404, 'PUT must return 404 cross-tenant');
  });
});

// ====================================================================
// Scenario 4 — Project DELETE isolation
// ====================================================================

describe('Scenario 4 — project delete isolation', () => {
  it('anonymous DELETE /api/portal-projects/:id → 401', async () => {
    poolSpy.reset();
    const r = await http_('DELETE', '/api/portal-projects/proj-A-1');
    assert.equal(r.status, 401);
  });

  it("user B DELETE /api/portal-projects/:projA → 404 (no `OR owner_id = 1` branch any more)", async () => {
    poolSpy.reset();
    // Stub: existence check returns empty for user B (owner_id mismatch).
    poolSpy.on(/FROM portal_projects WHERE/i, (_, params) => {
      const [, ownerId] = params;
      return ownerId === 42 ? { rows: [{ portal_project_id: 'proj-A-1' }], rowCount: 1 } : { rows: [], rowCount: 0 };
    });
    const r = await http_('DELETE', '/api/portal-projects/proj-A-1', { token: token(USER_B) });
    assert.equal(r.status, 404);
    // Crucially, no SQL query in the calls log contains the dangerous
    // `OR owner_id = 1` clause any more.
    const risky = poolSpy.calls.find((c) => /OR\s+owner_id\s*=\s*1/i.test(c.sql));
    assert.equal(risky, undefined, 'DELETE branch must not contain OR owner_id = 1');
  });
});

// ====================================================================
// Scenario 5 — Cross-kiosk isolation
// ====================================================================
// /api/integration/list-registry-projects must scope to caller's
// owner_id (was previously open + returned every user's data).

describe('Scenario 5 — cross-kiosk isolation', () => {
  it('anonymous GET /api/integration/list-registry-projects → 401', async () => {
    poolSpy.reset();
    const r = await http_('GET', '/api/integration/list-registry-projects');
    assert.equal(r.status, 401);
  });

  it('user B GET /api/integration/list-registry-projects has owner_id filter bound to user B', async () => {
    poolSpy.reset();
    poolSpy.on(/FROM portal_projects pp/i, (_, params) => {
      // For this query the owner_id parameter is $1 (only one param).
      if (params[0] === 42) {
        return { rows: [{ portal_project_id: 'proj-A', project_name: 'A only' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const r = await http_('GET', '/api/integration/list-registry-projects', { token: token(USER_B) });
    assert.equal(r.status, 200);
    const listCall = poolSpy.calls.find((c) => /pp\.owner_id\s*=\s*\$1/i.test(c.sql));
    assert.ok(listCall, 'list-registry-projects must scope by owner_id');
    assert.equal(listCall.params[0], USER_B.userId);
    assert.equal(r.body.projects.length, 0, 'user B should get empty list when no projects of theirs');
  });

  it('/api/integration/import-from-monolit anonymous → 401', async () => {
    poolSpy.reset();
    const r = await http_('POST', '/api/integration/import-from-monolit', {
      body: { project_name: 'x', objects: [] },
    });
    assert.equal(r.status, 401);
  });
});
