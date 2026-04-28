/**
 * Tests for the cross-subdomain Portal JWT cookie reader. The reader
 * is the single integration point between Portal's auth and every
 * Registry network call that needs a user identity (auto-sync,
 * future kiosk-shared endpoints), so a regression here silently
 * breaks the whole owner-id chain.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getPortalJwt, isPortalLoggedIn, portalAuthHeader } from './portalAuth';

/**
 * Vitest runs in node env (no DOM). The `getPortalJwt` reader only
 * needs `document.cookie` as a string getter — we expose a writable
 * mock so each test can stage its own cookie state.
 */
function setCookie(value: string): void {
  (globalThis as unknown as { document: { cookie: string } }).document = { cookie: value };
}

beforeEach(() => {
  setCookie('');
});

describe('getPortalJwt', () => {
  it('returns null when document.cookie is empty', () => {
    expect(getPortalJwt()).toBeNull();
  });

  it('returns null when only unrelated cookies are set', () => {
    setCookie('other_app_token=xyz; some_pref=dark');
    expect(getPortalJwt()).toBeNull();
  });

  it('extracts the JWT when stavagent_jwt is present', () => {
    setCookie('stavagent_jwt=abc.def.ghi');
    expect(getPortalJwt()).toBe('abc.def.ghi');
  });

  it('extracts the JWT when stavagent_jwt is mixed with other cookies', () => {
    setCookie('theme=dark; stavagent_jwt=abc.def.ghi; analytics=on');
    expect(getPortalJwt()).toBe('abc.def.ghi');
  });

  it('decodes URL-encoded cookie values', () => {
    // JWTs themselves are URL-safe, but other percent-escapes can
    // appear if the value passes through middleware that re-encodes.
    setCookie('stavagent_jwt=abc%2Edef.ghi');
    expect(getPortalJwt()).toBe('abc.def.ghi');
  });

  it('returns null on an empty stavagent_jwt value', () => {
    // Logout sets max-age=0 with empty value before the cookie is purged
    // — a transient state where document.cookie still contains the name.
    setCookie('stavagent_jwt=; theme=dark');
    expect(getPortalJwt()).toBeNull();
  });

  it('does not match a cookie name that contains stavagent_jwt as a suffix', () => {
    // Defensive — if a future ad-tech cookie is e.g. `not_stavagent_jwt`,
    // the prefix scan must NOT mistake it for ours.
    setCookie('not_stavagent_jwt=garbage');
    expect(getPortalJwt()).toBeNull();
  });
});

describe('isPortalLoggedIn', () => {
  it('mirrors getPortalJwt presence', () => {
    expect(isPortalLoggedIn()).toBe(false);
    setCookie('stavagent_jwt=abc.def.ghi');
    expect(isPortalLoggedIn()).toBe(true);
  });
});

describe('portalAuthHeader', () => {
  it('returns an empty object when no JWT is present', () => {
    expect(portalAuthHeader()).toEqual({});
  });

  it('returns Authorization Bearer when JWT is present', () => {
    setCookie('stavagent_jwt=abc.def.ghi');
    expect(portalAuthHeader()).toEqual({
      Authorization: 'Bearer abc.def.ghi',
    });
  });

  it('is safe to spread into a fetch headers init', () => {
    setCookie('stavagent_jwt=token-xyz');
    const headers = {
      'Content-Type': 'application/json',
      ...portalAuthHeader(),
    };
    expect(headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-xyz',
    });
  });
});
