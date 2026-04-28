/**
 * Tests for the JWT auth middleware (src/middleware/auth.js).
 *
 * Covers the cookie-fallback path added in this PR plus the
 * pre-existing Authorization-header path so we don't regress either.
 *
 * Uses Node's built-in test runner. Run:
 *   node --test stavagent-portal/backend/tests/auth.middleware.test.js
 *
 * No fixtures, no mocks beyond a tiny req/res scaffolding — the
 * middleware is pure function-of-input (req → 401 OR req.user populated
 * + next()), so we just exercise it with controlled input objects.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

// JWT_SECRET is read at module-load. Set it BEFORE importing the
// middleware so test tokens we sign verify with the same key.
process.env.JWT_SECRET = 'test-secret-key-do-not-use-in-prod';
delete process.env.DISABLE_AUTH; // make sure we exercise real path

const { requireAuth } = await import('../src/middleware/auth.js');

const VALID_PAYLOAD = { userId: 42, email: 'test@example.com', role: 'admin' };

function signValid() {
  return jwt.sign(VALID_PAYLOAD, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function signExpired() {
  // jsonwebtoken's expiresIn is interpreted at SIGN time; for a
  // guaranteed-expired token we set `exp` claim to a past unix-second.
  return jwt.sign(
    { ...VALID_PAYLOAD, exp: Math.floor(Date.now() / 1000) - 60 },
    process.env.JWT_SECRET,
  );
}

function makeReq({ header, cookie } = {}) {
  return {
    method: 'POST',
    path: '/api/test',
    headers: header ? { authorization: header } : {},
    cookies: cookie !== undefined ? { stavagent_jwt: cookie } : {},
  };
}

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

describe('requireAuth — cookie + header fallback', () => {
  // beforeEach intentionally minimal; each test builds its own
  // req / res / next so there's no shared mutable state to reset.
  beforeEach(() => {});

  it('accepts a valid Authorization: Bearer header (legacy path)', () => {
    const token = signValid();
    const req = makeReq({ header: `Bearer ${token}` });
    const res = makeRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null, 'should not have set a 401');
    assert.equal(req.user.userId, 42);
    assert.equal(req.authSource, 'header', 'auth came from header');
  });

  it('accepts a valid stavagent_jwt cookie (new fallback path)', () => {
    const token = signValid();
    const req = makeReq({ cookie: token });
    const res = makeRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, null);
    assert.equal(req.user.userId, 42);
    assert.equal(req.authSource, 'cookie', 'auth came from cookie');
  });

  it('prefers header over cookie when both are present', () => {
    // Sign two distinct tokens so we can detect which one decoded.
    const headerToken = jwt.sign({ ...VALID_PAYLOAD, userId: 100 }, process.env.JWT_SECRET);
    const cookieToken = jwt.sign({ ...VALID_PAYLOAD, userId: 200 }, process.env.JWT_SECRET);
    const req = makeReq({ header: `Bearer ${headerToken}`, cookie: cookieToken });
    const res = makeRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.user.userId, 100, 'header token wins');
    assert.equal(req.authSource, 'header');
  });

  it('returns 401 with no token in either channel', () => {
    const req = makeReq();
    const res = makeRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'Unauthorized');
    assert.match(res.body.message, /Chybí autorizační token/);
  });

  it('returns 401 when cookie holds an invalid (signature-mismatch) token', () => {
    const token = jwt.sign(VALID_PAYLOAD, 'wrong-secret');
    const req = makeReq({ cookie: token });
    const res = makeRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /Neplatný token/);
  });

  it('returns 401 when cookie holds an expired token', () => {
    const token = signExpired();
    const req = makeReq({ cookie: token });
    const res = makeRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /vypršel/);
  });

  it('returns 401 when header is malformed (no Bearer prefix)', () => {
    // Note: this used to silently fall through with the old
    // `authHeader.split(' ')[1]` extraction. New code requires the
    // exact `Bearer ` prefix so malformed headers are rejected as
    // "no token" rather than being misinterpreted.
    const token = signValid();
    const req = makeReq({ header: token /* no "Bearer " */ });
    const res = makeRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  it('falls back to cookie when header is malformed but cookie is valid', () => {
    const cookieToken = signValid();
    const req = makeReq({ header: 'Garbage no-bearer', cookie: cookieToken });
    const res = makeRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true, 'cookie path saved the request');
    assert.equal(req.user.userId, 42);
    assert.equal(req.authSource, 'cookie');
  });

  it('handles a request with no req.cookies (cookie-parser absent)', () => {
    // Defensive: the middleware must not crash if cookie-parser
    // didn't run for some reason — `req.cookies` would be undefined.
    const token = signValid();
    const req = {
      method: 'POST',
      path: '/api/test',
      headers: { authorization: `Bearer ${token}` },
      // no .cookies property at all
    };
    const res = makeRes();
    let nextCalled = false;
    requireAuth(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(req.authSource, 'header');
  });
});
