/**
 * Lint-style regression tests — every Registry → Portal `fetch()` call
 * site listed in PR-1 of the cross-subdomain auth fix series MUST
 * carry `credentials: 'include'` and spread `portalAuthHeader()` into
 * the headers init. Without these, Portal backend's requireAuth
 * (PR #1043) returns 401 — silently breaking PortalLinkBadge / DOV
 * write-back / Monolith data fetch / portal-handoff URL flows.
 *
 * If a future change drops auth from any of these sites, the matching
 * assertion fails. If a NEW Portal fetch is added in another file
 * without auth, this suite won't catch it on its own — list it below.
 *
 * Implemented as static source-text checks (read file, regex match)
 * rather than fetch-mocking. Each file pulls in zustand / IDB / etc.
 * which would require a heavyweight jsdom env to import safely.
 * Static checks are O(1) and catch the exact regression class —
 * "fetch added without auth" — that PR-1 fixes.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

interface WiredSite {
  /** Path relative to repo root (rozpocet-registry/). */
  file: string;
  /** Substring that must appear in the source — proves PR-1 wiring
   *  is still in place for this site. URL marker is enough since
   *  each file has only one Portal fetch that needs auth. */
  urlMarker: string;
}

const PR1_SITES: WiredSite[] = [
  { file: 'src/components/portal/PortalLinkBadge.tsx', urlMarker: '/api/portal-projects' },
  { file: 'src/services/dovWriteBack.ts',               urlMarker: '/api/positions/' },
  { file: 'src/services/portalMonolithFetch.ts',         urlMarker: '/api/integration/for-registry/' },
  { file: 'src/App.tsx',                                  urlMarker: '/parsed-data/for-kiosk/registry' },
  { file: 'src/App.tsx',                                  urlMarker: '/api/integration/for-registry/' },
];

describe('PR-1 auth wiring — Registry → Portal fetch sites', () => {
  for (const site of PR1_SITES) {
    it(`${site.file} (marker: ${site.urlMarker}) carries auth`, () => {
      const path = resolve(ROOT, site.file);
      const source = readFileSync(path, 'utf-8');

      // The site exists in this file (sanity check — protects against
      // someone removing the call entirely without removing the test).
      expect(
        source.includes(site.urlMarker),
        `${site.file}: URL marker "${site.urlMarker}" not found in file`,
      ).toBe(true);

      // The file imports portalAuthHeader. Path is relative — services/
      // files use './portalAuth', components/portal/ files use
      // '../../services/portalAuth', App.tsx uses './services/portalAuth'.
      // Match any of those by suffix.
      expect(
        /from ['"][^'"]*portalAuth['"]/.test(source),
        `${site.file}: missing import of portalAuthHeader from a portalAuth module`,
      ).toBe(true);

      // The file calls portalAuthHeader() somewhere — proves the
      // imported helper is actually used (catches the "imported but
      // unused" regression that some linters miss).
      expect(
        /portalAuthHeader\(\)/.test(source),
        `${site.file}: portalAuthHeader() never invoked`,
      ).toBe(true);

      // The file passes credentials: 'include' on at least one fetch.
      // Presence-only check — for files with a single Portal fetch
      // (the case for all 5 PR-1 sites; App.tsx has 2 calls but both
      // need credentials), a file-level hit guarantees the wiring is
      // there for SOME call. Tighter "this exact URL has credentials
      // in its options block" check needs a TS AST walk, deferred.
      expect(
        /credentials:\s*['"]include['"]/.test(source),
        `${site.file}: no fetch with credentials: 'include' — Portal cookie won't reach backend`,
      ).toBe(true);
    });
  }
});
