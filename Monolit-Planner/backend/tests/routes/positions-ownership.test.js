/**
 * Positions + Planner Variants ownership tests (Sprint A, 2026-07)
 *
 * Verifies the bridge-owner access chain:
 *   positions.bridge_id → monolith_projects.portal_user_id / bridges.owner_id
 *
 * Rules under test:
 *   - owned bridge + anonymous caller  → 403
 *   - owned bridge + different user    → 403
 *   - owned bridge + owner JWT         → 200
 *   - NULL-owner (legacy kiosk) bridge → open
 *   - anonymous POST that would auto-create a bridge → 401
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

// Same dev fallback as src/middleware/auth.js (tests run without JWT_SECRET)
const JWT_SECRET = 'dev-secret-key-change-in-production';
const tokenFor = (userId) => jwt.sign({ userId, email: `u${userId}@test.cz` }, JWT_SECRET);

const OWNER_ID = 42;
const INTRUDER_ID = 7;

// --- Mock db before importing routes ---

const mockDb = {
  prepare: jest.fn(),
  transaction: jest.fn((fn) => (...args) => fn(mockDb, ...args)),
};

jest.unstable_mockModule('../../src/db/init.js', () => ({ default: mockDb }));
jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));
jest.unstable_mockModule('../../src/utils/text.js', () => ({
  extractPartName: jest.fn((name) => name)
}));
jest.unstable_mockModule('../../src/services/calculator.js', () => ({
  calculatePositions: jest.fn((positions) => positions),
  calculateKPI: jest.fn(() => ({}))
}));
jest.unstable_mockModule('../../src/services/timeNormsService.js', () => ({
  suggestDays: jest.fn()
}));
jest.unstable_mockModule('../../src/services/portalWriteBack.js', () => ({
  writeBackBatch: jest.fn(() => Promise.resolve())
}));

const { default: positionsRoutes } = await import('../../src/routes/positions.js');
const { default: plannerVariantsRoutes } = await import('../../src/routes/planner-variants.js');

const app = express();
app.use(express.json());
app.use('/api/positions', positionsRoutes);
app.use('/api/planner-variants', plannerVariantsRoutes);

/**
 * SQL-aware db mock. ownerConfig:
 *   { mpOwner, bridgeOwner } — values returned for the two owner lookups;
 *   `undefined` = row missing entirely, `null` = row exists, owner NULL.
 */
function primeDb({ mpOwner, bridgeOwner } = {}) {
  mockDb.prepare.mockImplementation((sql) => ({
    get: jest.fn().mockImplementation(() => {
      if (sql.includes('FROM monolith_projects')) {
        return mpOwner === undefined ? undefined : { portal_user_id: mpOwner };
      }
      if (sql.includes('owner_id FROM bridges') || (sql.includes('FROM bridges') && sql.includes('owner_id'))) {
        return bridgeOwner === undefined ? undefined : { owner_id: bridgeOwner };
      }
      if (sql.includes('FROM bridges')) {
        return { bridge_id: 'bridge-1', portal_project_id: null, registry_project_id: null };
      }
      if (sql.includes('FROM planner_variants')) {
        return { id: 'var_1', position_id: 'pos-1', is_plan: 0 };
      }
      if (sql.includes('FROM positions')) {
        return { id: 'pos-1', bridge_id: 'bridge-1' };
      }
      if (sql.includes('FROM project_config')) {
        return { defaults: '{}', days_per_month_mode: 30 };
      }
      return undefined;
    }),
    all: jest.fn().mockReturnValue([]),
    run: jest.fn().mockReturnValue({ changes: 1 }),
  }));
}

describe('Positions ownership (Sprint A)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET on an owned bridge without JWT → 403', async () => {
    primeDb({ mpOwner: String(OWNER_ID), bridgeOwner: OWNER_ID });
    const res = await request(app).get('/api/positions?bridge_id=bridge-1');
    expect(res.status).toBe(403);
  });

  it('GET on an owned bridge with a different user JWT → 403', async () => {
    primeDb({ mpOwner: String(OWNER_ID), bridgeOwner: OWNER_ID });
    const res = await request(app)
      .get('/api/positions?bridge_id=bridge-1')
      .set('Authorization', `Bearer ${tokenFor(INTRUDER_ID)}`);
    expect(res.status).toBe(403);
  });

  it('GET on an owned bridge with the owner JWT → 200', async () => {
    primeDb({ mpOwner: String(OWNER_ID), bridgeOwner: OWNER_ID });
    const res = await request(app)
      .get('/api/positions?bridge_id=bridge-1')
      .set('Authorization', `Bearer ${tokenFor(OWNER_ID)}`);
    expect(res.status).toBe(200);
  });

  it('GET on a legacy NULL-owner bridge stays open (kiosk mode)', async () => {
    primeDb({ mpOwner: null, bridgeOwner: null });
    const res = await request(app).get('/api/positions?bridge_id=bridge-1');
    expect(res.status).toBe(200);
  });

  it('PUT on an owned bridge without JWT → 403', async () => {
    primeDb({ mpOwner: String(OWNER_ID), bridgeOwner: OWNER_ID });
    const res = await request(app)
      .put('/api/positions')
      .send({ bridge_id: 'bridge-1', updates: [{ id: 'pos-1', days: 5 }] });
    expect(res.status).toBe(403);
  });

  it('anonymous POST that would auto-create a bridge → 401', async () => {
    // No monolith_projects row, no bridges row → auto-create path
    primeDb({ mpOwner: undefined, bridgeOwner: undefined });
    // The Phase-11 dedup lookup also returns undefined:
    mockDb.prepare.mockImplementation((sql) => ({
      get: jest.fn().mockReturnValue(undefined),
      all: jest.fn().mockReturnValue([]),
      run: jest.fn().mockReturnValue({ changes: 1 }),
    }));
    const res = await request(app)
      .post('/api/positions')
      .send({
        bridge_id: 'brand-new',
        positions: [{ part_name: 'Test', subtype: 'beton', unit: 'M3', qty: 10, days: 5 }],
      });
    expect(res.status).toBe(401);
  });

  it('POST with a VICTIM\'s portal_project_id (Phase-11 dedup) → 403 for intruder', async () => {
    // Direct bridge_id lookup misses; dedup lookup by portal_project_id
    // resolves the victim's bridge; the write guard on the RESOLVED
    // bridge must reject the intruder.
    mockDb.prepare.mockImplementation((sql) => ({
      get: jest.fn().mockImplementation(() => {
        if (sql.includes('FROM bridges WHERE bridge_id = ?')) return undefined;
        if (sql.includes('WHERE portal_project_id = ?')) {
          return { bridge_id: 'victim-bridge', portal_user_id: null, registry_project_id: null };
        }
        if (sql.includes('FROM monolith_projects')) return { portal_user_id: String(OWNER_ID) };
        if (sql.includes('owner_id FROM bridges')) return { owner_id: OWNER_ID };
        return undefined;
      }),
      all: jest.fn().mockReturnValue([]),
      run: jest.fn().mockReturnValue({ changes: 1 }),
    }));

    const res = await request(app)
      .post('/api/positions')
      .set('Authorization', `Bearer ${tokenFor(INTRUDER_ID)}`)
      .send({
        bridge_id: 'anything',
        portal_project_id: 'victims-portal-project',
        positions: [{ part_name: 'Test', subtype: 'beton', unit: 'M3', qty: 10, days: 5 }],
      });
    expect(res.status).toBe(403);
  });

  it('anonymous POST /:id/suggest-days → 401 (LLM cost endpoint)', async () => {
    primeDb({ mpOwner: null, bridgeOwner: null });
    mockDb.prepare.mockImplementation((sql) => ({
      get: jest.fn().mockReturnValue(
        sql.includes('FROM positions') ? { id: 'pos-1', bridge_id: 'bridge-1', qty: 10 } : undefined
      ),
      all: jest.fn().mockReturnValue([]),
      run: jest.fn().mockReturnValue({ changes: 1 }),
    }));
    const res = await request(app).post('/api/positions/pos-1/suggest-days');
    expect(res.status).toBe(401);
  });
});

describe('Planner variants ownership (Sprint A)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET variants of an owned position without JWT → 403', async () => {
    primeDb({ mpOwner: String(OWNER_ID), bridgeOwner: OWNER_ID });
    const res = await request(app).get('/api/planner-variants?position_id=pos-1');
    expect(res.status).toBe(403);
  });

  it('GET variants with the owner JWT → 200', async () => {
    primeDb({ mpOwner: String(OWNER_ID), bridgeOwner: OWNER_ID });
    const res = await request(app)
      .get('/api/planner-variants?position_id=pos-1')
      .set('Authorization', `Bearer ${tokenFor(OWNER_ID)}`);
    expect(res.status).toBe(200);
  });

  it('DELETE a variant on an owned bridge with a different user JWT → 403', async () => {
    primeDb({ mpOwner: String(OWNER_ID), bridgeOwner: OWNER_ID });
    const res = await request(app)
      .delete('/api/planner-variants/var_1')
      .set('Authorization', `Bearer ${tokenFor(INTRUDER_ID)}`);
    expect(res.status).toBe(403);
  });

  it('POST a variant on a legacy NULL-owner chain stays open (kiosk mode)', async () => {
    primeDb({ mpOwner: null, bridgeOwner: null });
    const res = await request(app)
      .post('/api/planner-variants')
      .send({ position_id: 'pos-1', input_params: { a: 1 }, calc_result: { b: 2 } });
    expect(res.status).toBe(200);
  });
});
