/**
 * Formwork Systems Catalog Tests (2026-04-17)
 *
 * Covers the pour_role taxonomy + applicable_element_types allow-list +
 * MSS entries added in commit "Formwork taxonomy + MSS — Commit 1".
 */
import { describe, it, expect } from 'vitest';
import {
  FORMWORK_SYSTEMS,
  findFormworkSystem,
  getSystemsByPourRole,
  isApplicableForElement,
  findMssSystem,
  type FormworkSystemSpec,
} from './formwork-systems.js';

describe('Formwork Systems Catalog — pour_role taxonomy', () => {
  it('every catalog entry declares a pour_role', () => {
    const missing = FORMWORK_SYSTEMS.filter(s => !s.pour_role).map(s => s.name);
    expect(missing).toEqual([]);
  });

  it('Top 50 is classified as formwork with subtype nosnikove (Gate 2.1 canonical §9.1)', () => {
    const top50 = findFormworkSystem('Top 50');
    expect(top50).toBeDefined();
    // Gate 2.1 Gap #8 fix: Top 50 is nosníkové bednění (Vrstva 1 per
    // canonical §9.2), NOT falsework. DOKA katalog: Top 50 = "Nosníkové
    // bednění Top 50". Real falsework under bridge decks is Staxo 100
    // (Vrstva 3, pour_role='props' currently — separately classified).
    expect(top50!.pour_role).toBe('formwork');
    expect(top50!.formwork_subtype).toBe('nosnikove');
  });

  it('Dokaflex is formwork_props (slab form + integrated props)', () => {
    const dokaflex = findFormworkSystem('Dokaflex');
    expect(dokaflex).toBeDefined();
    expect(dokaflex!.pour_role).toBe('formwork_props');
  });

  it('Staxo 100 + UP Rosett Flex are classified as props (stojky)', () => {
    expect(findFormworkSystem('Staxo 100')!.pour_role).toBe('props');
    expect(findFormworkSystem('UP Rosett Flex')!.pour_role).toBe('props');
  });

  it('Framax / Frami / TRIO / MAXIMO are wall formwork (no props)', () => {
    for (const name of ['Framax Xlife', 'Frami Xlife', 'TRIO', 'MAXIMO']) {
      expect(findFormworkSystem(name)!.pour_role).toBe('formwork');
    }
  });
});

describe('Formwork Systems Catalog — applicable_element_types allow-list', () => {
  it('Dokaflex is NOT applicable for mostovkova_deska (bridge deck)', () => {
    const dokaflex = findFormworkSystem('Dokaflex')!;
    expect(isApplicableForElement(dokaflex, 'mostovkova_deska')).toBe(false);
  });

  it('Dokaflex IS applicable for stropni_deska (building slab)', () => {
    const dokaflex = findFormworkSystem('Dokaflex')!;
    expect(isApplicableForElement(dokaflex, 'stropni_deska')).toBe(true);
  });

  it('Top 50 (no allow-list) is applicable for any element type', () => {
    const top50 = findFormworkSystem('Top 50')!;
    // Top 50 intentionally has no applicable_element_types — universal.
    expect(top50.applicable_element_types).toBeUndefined();
    expect(isApplicableForElement(top50, 'mostovkova_deska')).toBe(true);
    expect(isApplicableForElement(top50, 'stropni_deska')).toBe(true);
  });

  it('VARIOKIT HD 200 is applicable for mostovka + rigel (formwork_beam, Vrstva 2)', () => {
    const variokit = findFormworkSystem('VARIOKIT HD 200')!;
    // Gate 2.1 Gap #8 fix: VARIOKIT HD 200 is a horizontal load-spreading
    // beam component (Vrstva 2 per canonical §9.2), NOT falsework
    // (Vrstva 3). The actual PERI falsework under bridge decks is
    // VARIOKIT VST. Selector keeps VARIOKIT HD applicable for mostovka
    // + rigel via allow-list — only its pour_role classification corrected.
    expect(variokit.pour_role).toBe('formwork_beam');
    expect(isApplicableForElement(variokit, 'mostovkova_deska')).toBe(true);
    expect(isApplicableForElement(variokit, 'rigel')).toBe(true);
    expect(isApplicableForElement(variokit, 'stena')).toBe(false);
  });

  it('other slab formwork (MULTIFLEX, SKYDECK, CC-4) all exclude mostovka', () => {
    for (const name of ['MULTIFLEX', 'SKYDECK', 'CC-4']) {
      const sys = findFormworkSystem(name)!;
      expect(isApplicableForElement(sys, 'mostovkova_deska')).toBe(false);
    }
  });
});

describe('Formwork Systems Catalog — MSS entries', () => {
  it('DOKA MSS entry exists with mss_integrated pour_role + reuse factor 0.35', () => {
    const doka = findFormworkSystem('DOKA MSS')!;
    expect(doka).toBeDefined();
    expect(doka.pour_role).toBe('mss_integrated');
    expect(doka.mss_reuse_factor).toBe(0.35);
    expect(doka.rental_czk_m2_month).toBe(0); // bundled in MSS mobilization
  });

  it('PERI VARIOKIT Mobile entry exists with mss_integrated pour_role', () => {
    const peri = findFormworkSystem('VARIOKIT Mobile')!;
    expect(peri).toBeDefined();
    expect(peri.pour_role).toBe('mss_integrated');
    expect(peri.mss_reuse_factor).toBe(0.35);
  });

  it('both MSS entries are only applicable for bridge deck types', () => {
    for (const name of ['DOKA MSS', 'VARIOKIT Mobile']) {
      const sys = findFormworkSystem(name)!;
      expect(isApplicableForElement(sys, 'mostovkova_deska')).toBe(true);
      expect(isApplicableForElement(sys, 'stena')).toBe(false);
      expect(isApplicableForElement(sys, 'stropni_deska')).toBe(false);
    }
  });

  it('findMssSystem() prefers the given manufacturer, falls back otherwise', () => {
    expect(findMssSystem('DOKA')!.name).toBe('DOKA MSS');
    expect(findMssSystem('PERI')!.name).toBe('VARIOKIT Mobile');
    expect(findMssSystem('UnknownVendor')!.pour_role).toBe('mss_integrated'); // fallback
    expect(findMssSystem(undefined)!.pour_role).toBe('mss_integrated');
  });
});

describe('Formwork Systems Catalog — helper integrity', () => {
  it('getSystemsByPourRole returns expected populations per pour_role', () => {
    const formwork = getSystemsByPourRole('formwork');
    const formworkBeam = getSystemsByPourRole('formwork_beam');
    const formworkProps = getSystemsByPourRole('formwork_props');
    const falsework = getSystemsByPourRole('falsework');
    const props = getSystemsByPourRole('props');
    const mss = getSystemsByPourRole('mss_integrated');

    expect(formwork.length).toBeGreaterThan(0);
    expect(formworkBeam.length).toBe(1); // VARIOKIT HD 200 (Gate 2.1)
    expect(formworkProps.length).toBeGreaterThan(0);
    // Gate 2.1 Gap #8: falsework category currently empty in catalog.
    // Top 50 + VARIOKIT HD 200 reclassified to formwork / formwork_beam.
    // Staxo 100 reclassification (props → falsework per canonical Vrstva 3)
    // is deferred to Phase 3 / Gate 3 — when done, this assertion changes
    // to .toBeGreaterThan(0) and Staxo 100 moves out of props bucket.
    expect(falsework.length).toBe(0);
    expect(props.length).toBeGreaterThanOrEqual(2); // Staxo 100 + UP Rosett
    expect(mss.length).toBe(2); // DOKA MSS + VARIOKIT Mobile

    // No overlap: each system in exactly one bucket.
    const total = formwork.length + formworkBeam.length + formworkProps.length + falsework.length + props.length + mss.length;
    expect(total).toBe(FORMWORK_SYSTEMS.length);
  });
});
