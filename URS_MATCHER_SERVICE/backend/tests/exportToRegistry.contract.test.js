/**
 * Static-contract test for the Klasifikátor → Registr export click handler.
 *
 * The kiosk's /public/ folder is plain HTML + a single big app.js (no module
 * system, no test runner wired for it). Adding a real DOM-level integration
 * test would require jsdom + heavy scaffolding for a script that's not
 * structured for testing. Instead, this Jest test loads app.js as text and
 * asserts that the critical export-handler signatures are preserved across
 * label-only edits:
 *
 *   - The button binding selector is still 'btnExportRegistry'.
 *   - The fetch URL is still the Registry import endpoint.
 *   - The POST body still includes positions[], sourceKiosk, projectName.
 *   - The payload's per-item shape still uses code/description/unit/metadata.
 *
 * Any label edit (e.g. 'Kód ÚRS' -> 'Kód') that accidentally rewrites part
 * of the fetch URL or payload shape will trip these assertions immediately.
 *
 * Added 2026-05-08 alongside the URS-label scrub in v3.2 Gate 2.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_JS_PATH = path.resolve(
  __dirname,
  '../../frontend/public/app.js',
);

describe('Klasifikátor Export to Registr — static contract', () => {
  let appJs;

  beforeAll(() => {
    appJs = fs.readFileSync(APP_JS_PATH, 'utf8');
  });

  test('app.js exists and is non-empty', () => {
    expect(appJs.length).toBeGreaterThan(1000);
  });

  test('exportToRegistry handler is wired to a Registry fetch URL', () => {
    expect(appJs).toMatch(
      /fetch\(\s*['"]https:\/\/registry\.stavagent\.cz\/api\/sync\?action=import-positions['"]/,
    );
  });

  test('export uses HTTP POST with JSON body', () => {
    // The fetch call must be a POST with Content-Type application/json.
    expect(appJs).toMatch(/method:\s*['"]POST['"]/);
    expect(appJs).toMatch(/['"]Content-Type['"]:\s*['"]application\/json['"]/);
  });

  test('export payload includes the required top-level keys', () => {
    // Top-level body must still be { positions, sourceKiosk, projectName, metadata }.
    expect(appJs).toMatch(/body:\s*JSON\.stringify\(\s*{[\s\S]*?positions[\s\S]*?sourceKiosk[\s\S]*?projectName/);
  });

  test('sourceKiosk is the urs-matcher identifier (Registry switches on this)', () => {
    // 'urs-matcher' is the wire identifier the Registry uses to recognise
    // imports from this kiosk. Renaming it would break the Registry contract.
    expect(appJs).toMatch(/sourceKiosk:\s*['"]urs-matcher['"]/);
  });

  test('per-item payload shape is preserved (code / description / unit / metadata)', () => {
    // The Registry receiver expects each item to have at least these keys.
    expect(appJs).toMatch(/code:\s*item\.urs_code/);
    expect(appJs).toMatch(/description:\s*item\.urs_name/);
    expect(appJs).toMatch(/unit:\s*item\.unit/);
    expect(appJs).toMatch(/metadata:\s*{/);
  });

  test('Export button binding still references exportToRegistryBtn', () => {
    // Renaming the button id would orphan the click handler. The id is
    // declared in /public/index.html and looked up by getElementById in
    // app.js around line 50.
    expect(appJs).toMatch(/getElementById\(['"]exportToRegistryBtn['"]\)/);
    expect(appJs).toMatch(/exportToRegistryBtn\?\.addEventListener\(['"]click['"]/);
  });

  test('No literal "URS" appears in user-facing column headers (post-scrub guard)', () => {
    // After the v3.2 Gate 2 scrub, the rendered table column headers must
    // not say "Kód ÚRS" anywhere. The wire-level urs_code/urs_name object
    // keys are exempt — those are internal API contract with the backend
    // and the Registry receiver.
    const tableHeaderHits = appJs.match(/<th>\s*Kód\s*ÚRS\s*<\/th>/g) || [];
    expect(tableHeaderHits).toHaveLength(0);

    // CSV export headers also must not include 'Kód ÚRS' as a column name.
    const csvHeaderHits = appJs.match(/Kód\s*ÚRS;/g) || [];
    expect(csvHeaderHits).toHaveLength(0);
  });

  test('No literal ÚRS appears in plain-text export titles (post-scrub guard)', () => {
    expect(appJs).not.toMatch(/Výsledky hledání ÚRS/);
    expect(appJs).not.toMatch(/DOPORUČENÉ POZICE ÚRS/);
  });
});
